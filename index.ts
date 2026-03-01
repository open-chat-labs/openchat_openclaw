import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { handleBotDefinition } from "./src/bot-definition.js";
import { openChatPlugin, type ResolvedOpenChatAccount } from "./src/channel.js";
import { makeExecuteCommandHandler } from "./src/execute-command.js";
import { setOpenChatRuntime } from "./src/runtime.js";

// Active per-account context, keyed by accountId.
// Populated by gateway.startAccount, removed on abort.
const activeAccounts = new Map<string, { cfg: OpenClawConfig; account: ResolvedOpenChatAccount }>();

const plugin = {
  id: "openchat_openclaw",
  name: "OpenChat",
  description: "OpenChat channel plugin — AI agent via a /prompt bot command",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setOpenChatRuntime(api.runtime);

    // Register the channel, with a gateway that tracks active accounts.
    api.registerChannel({
      plugin: {
        ...openChatPlugin,
        gateway: {
          startAccount: async (ctx) => {
            activeAccounts.set(ctx.accountId, {
              cfg: ctx.cfg,
              account: ctx.account as ResolvedOpenChatAccount,
            });
            ctx.abortSignal.addEventListener("abort", () => {
              activeAccounts.delete(ctx.accountId);
            });
          },
        },
      },
    });

    const executeCommandHandler = async (
      req: import("node:http").IncomingMessage,
      res: import("node:http").ServerResponse,
    ) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-oc-jwt");

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      // Use the first active account (single-account use case).
      // For multi-account support, the JWT scope could be used to pick the right one.
      const entry = activeAccounts.values().next().value;
      if (!entry) {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: "OpenChat channel not started" }));
        return;
      }
      const handler = makeExecuteCommandHandler(entry.cfg, entry.account);
      await handler(req, res);
    };

    // GET /bot_definition and POST /execute_command at root — OpenChat bot registration
    // only accepts an origin URL, so it expects these paths at the root.
    // We also register the /openchat/* prefixed variants for clarity.
    for (const prefix of ["", "/openchat"]) {
      api.registerHttpRoute({
        path: `${prefix}/bot_definition`,
        handler: (req, res) => {
          handleBotDefinition(req, res);
        },
      });
      api.registerHttpRoute({
        path: `${prefix}/execute_command`,
        handler: executeCommandHandler,
      });
    }
  },
};

export default plugin;
