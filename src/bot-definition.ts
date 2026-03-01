import type { IncomingMessage, ServerResponse } from "node:http";
import { Permissions } from "@open-ic/openchat-botclient-ts";

const emptyPermissions = { chat: [], community: [], message: [] };

const BOT_DEFINITION = {
  description:
    "An AI agent powered by OpenClaw. Send it a /prompt and it will reply using your configured AI model.",
  // No autonomous_config — this bot only responds to explicit /prompt commands,
  // so it doesn't need to subscribe to all chat messages.
  commands: [
    {
      name: "prompt",
      default_role: "Participant",
      description: "Send a message to the AI agent",
      // Allow use in direct messages (the primary use case)
      direct_messages: true,
      permissions: Permissions.encodePermissions({
        ...emptyPermissions,
        message: ["Text"],
      }),
      params: [
        {
          name: "prompt",
          required: true,
          description: "Your message to the AI agent",
          placeholder: "Ask me anything...",
          param_type: {
            StringParam: {
              min_length: 1,
              max_length: 5000,
              choices: [],
              multi_line: true,
            },
          },
        },
      ],
    },
  ],
};

export function handleBotDefinition(req: IncomingMessage, res: ServerResponse): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  res.setHeader("Content-Type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify(BOT_DEFINITION));
  return true;
}
