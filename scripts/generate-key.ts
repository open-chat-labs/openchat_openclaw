#!/usr/bin/env tsx
/**
 * Generates a secp256k1 private key, writes it to ~/.openclaw/openchat-bot.pem,
 * and prints the corresponding Internet Computer principal — everything needed
 * to register an OpenChat bot before the gateway is running.
 *
 * Usage:
 *   npx --package @open-ic/openchat_openclaw generate-key
 *
 * Output:
 *   ~/.openclaw/openchat-bot.pem  → configure with: openclaw config set channels.openchat.privateKeyFile ~/.openclaw/openchat-bot.pem
 *   Principal                     → use when registering the bot on OpenChat
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BotClientFactory } from "@open-ic/openchat-botclient-ts";

// Generate a secp256k1 key in traditional EC format (BEGIN EC PRIVATE KEY),
// which is what the @dfinity/identity-secp256k1 SDK expects.
const pem = execSync(
  "openssl ecparam -name secp256k1 -param_enc named_curve -genkey -noout | openssl ec -outform PEM 2>/dev/null",
)
  .toString()
  .trim();

// Write the PEM to ~/.openclaw/openchat-bot.pem (mode 600 — private key).
const pemDir = join(homedir(), ".openclaw");
const pemPath = join(pemDir, "openchat-bot.pem");
mkdirSync(pemDir, { recursive: true });
if (existsSync(pemPath)) {
  console.error(`Error: ${pemPath} already exists. Remove it first if you want to regenerate.`);
  process.exit(1);
}
writeFileSync(pemPath, pem + "\n", { encoding: "utf8" });
chmodSync(pemPath, 0o600);

// BotClientFactory logs "Principal: <text>" to console as a side effect of createAgent.
// We use a dummy public key and canister ID since we only need the identity to be created.
console.log("=== OpenChat Bot Identity ===\n");
console.log("Deriving principal from key (you will see it printed below)...\n");

new BotClientFactory({
  openchatPublicKey: "dummy",
  icHost: "https://icp-api.io",
  identityPrivateKey: pem,
  openStorageCanisterId: "aaaaa-aa",
});

console.log(`\nPrivate key saved to: ${pemPath}`);
console.log("\nConfigure OpenClaw to use it:");
console.log(`  openclaw config set channels.openchat.privateKeyFile ${pemPath}`);
console.log("\nEndpoint to register with OpenChat: https://<your-gateway-host>/openchat");
