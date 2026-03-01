import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { ResolvedOpenChatAccount } from "./channel.js";
import { getFactory } from "./factory.js";
import { getOpenChatRuntime } from "./runtime.js";

export function success(msg?: import("@open-ic/openchat-botclient-ts").Message) {
  return {
    message: msg?.toResponse(),
  };
}

/**
 * Handles POST /openchat/execute_command.
 *
 * OpenChat sends a signed JWT in the x-oc-jwt header. The JWT contains
 * the command name, arguments, and scope (which chat/user sent this).
 * We verify it via the SDK, dispatch to the agent pipeline, then send
 * the reply back via BotClient.sendMessage().
 */
export function makeExecuteCommandHandler(cfg: OpenClawConfig, account: ResolvedOpenChatAccount) {
  return async function handleExecuteCommand(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-oc-jwt");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return true;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return true;
    }

    const jwt = req.headers["x-oc-jwt"] as string | undefined;
    if (!jwt) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Missing x-oc-jwt header" }));
      return true;
    }

    if (!account.privateKey) {
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: "OpenChat bot not configured (missing privateKey)",
        }),
      );
      return true;
    }

    let client;
    try {
      const factory = getFactory(account.privateKey);
      client = factory.createClientFromCommandJwt(jwt);
    } catch (err) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: `Invalid JWT: ${String(err)}` }));
      return true;
    }

    if (client.commandName !== "prompt") {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          error: `Unknown command: ${client.commandName}`,
        }),
      );
      return true;
    }

    const promptText = client.stringArg("prompt");
    if (!promptText?.trim()) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "prompt argument is required" }));
      return true;
    }

    const placeholder = (await client.createTextMessage("Thinking ...")).setFinalised(false);

    // Respond immediately so OpenChat shows a placeholder while we process.
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(success(placeholder)));

    // Dispatch to the agent pipeline asynchronously.
    const core = getOpenChatRuntime();
    const log = core.logging.getChildLogger({ channel: "openchat" });
    const senderId = String(client.initiator ?? "unknown");
    const messageId = String(Date.now());

    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "openchat",
      accountId: account.accountId,
      peer: { kind: "direct", id: senderId },
    });

    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const storePath = core.channel.session.resolveStorePath(cfg.session?.store, {
      agentId: route.agentId,
    });
    const previousTimestamp = core.channel.session.readSessionUpdatedAt({
      storePath,
      sessionKey: route.sessionKey,
    });

    const body = core.channel.reply.formatAgentEnvelope({
      channel: "OpenChat",
      from: senderId,
      timestamp: Date.now(),
      previousTimestamp,
      envelope: envelopeOptions,
      body: promptText,
    });

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      BodyForAgent: promptText,
      RawBody: promptText,
      CommandBody: promptText,
      From: `openchat:${senderId}`,
      To: `openchat:${account.accountId}`,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: "direct",
      ConversationLabel: senderId,
      SenderId: senderId,
      Provider: "openchat",
      Surface: "openchat",
      MessageSid: messageId,
      MessageSidFull: messageId,
    });

    // OpenChat command/response model: one command → one reply message.
    // All messages created by a command BotClient share the same messageId, so we
    // must call sendMessage exactly once. Accumulate all delivered text segments
    // and send a single finalised message after dispatch completes.
    const replyParts: string[] = [];
    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: ctxPayload,
      cfg,
      dispatcherOptions: {
        deliver: async (payload) => {
          if (payload.text) {
            replyParts.push(payload.text);
          }
        },
        onError: (err) => {
          log.error(`[openchat] dispatch error: ${String(err)}`);
        },
      },
    });
    const replyText = replyParts.join("\n\n").trim();
    if (replyText) {
      try {
        const msg = await client.createTextMessage(replyText);
        msg.setBlockLevelMarkdown(true);
        msg.setFinalised(true);
        await client.sendMessage(msg);
      } catch (err) {
        log.error(`[openchat] failed to send reply: ${String(err)}`);
      }
    }

    return true;
  };
}
