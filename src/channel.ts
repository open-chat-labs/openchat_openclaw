import { readFileSync } from "node:fs";
import { type ChannelPlugin, DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import { openChatOnboardingAdapter } from "./onboarding.js";

/**
 * Resolves the bot private key PEM using this priority order:
 *   1. OC_PRIVATE_KEY env var
 *   2. privateKeyFile path in config (reads the file)
 *   3. privateKey raw value in config (newlines may be escaped as \n)
 *
 * Returns undefined if none are set.
 */
export function resolvePrivateKey(config: OpenChatAccountConfig): string | undefined {
  if (process.env.OC_PRIVATE_KEY) {
    return process.env.OC_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  if (config.privateKeyFile) {
    try {
      return readFileSync(config.privateKeyFile, "utf8").trim();
    } catch (err) {
      throw new Error(
        `[openchat] Could not read privateKeyFile "${config.privateKeyFile}": ${String(err)}`,
      );
    }
  }
  if (config.privateKey) {
    return config.privateKey.replace(/\\n/g, "\n");
  }
  return undefined;
}

const meta = {
  id: "openchat",
  label: "OpenChat",
  selectionLabel: "OpenChat (Bot)",
  docsPath: "/channels/openchat",
  blurb: "Talk to the AI agent directly inside OpenChat via a bot.",
  systemImage: "bubble.left.and.bubble.right.fill",
};

export interface OpenChatAccountConfig {
  /** Path to the PEM file on disk. Takes priority over privateKey. */
  privateKeyFile?: string;
  /** Raw PEM string (with \n escaped as \\n). Use privateKeyFile instead when possible. */
  privateKey?: string;
  enabled?: boolean;
}

export interface ResolvedOpenChatAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  config: OpenChatAccountConfig;
  /** Resolved PEM: env var > key file > raw config value. */
  privateKey?: string;
}

export const openChatPlugin: ChannelPlugin<ResolvedOpenChatAccount> = {
  id: "openchat",
  meta,
  onboarding: openChatOnboardingAdapter,
  capabilities: {
    // Direct chat only — user installs the bot and talks to it 1:1
    chatTypes: ["direct"],
    media: false,
  },
  config: {
    listAccountIds: (cfg) => {
      const base = cfg.channels?.openchat as
        | (OpenChatAccountConfig & {
            accounts?: Record<string, OpenChatAccountConfig>;
          })
        | undefined;
      if (process.env.OC_PRIVATE_KEY || base?.privateKeyFile || base?.privateKey) {
        return [DEFAULT_ACCOUNT_ID];
      }
      const accountKeys = Object.keys(base?.accounts ?? {});
      return accountKeys.length ? accountKeys : [DEFAULT_ACCOUNT_ID];
    },
    resolveAccount: (cfg, accountId) => {
      const id = accountId || DEFAULT_ACCOUNT_ID;
      const base = cfg.channels?.openchat as
        | (OpenChatAccountConfig & {
            accounts?: Record<string, OpenChatAccountConfig>;
          })
        | undefined;
      const account = base?.accounts?.[id];

      const config: OpenChatAccountConfig = {
        privateKeyFile: (account?.privateKeyFile || base?.privateKeyFile) as string | undefined,
        privateKey: (account?.privateKey || base?.privateKey) as string | undefined,
        enabled: (account?.enabled ?? base?.enabled ?? true) as boolean,
      };

      return {
        accountId: id,
        name: id,
        enabled: config.enabled ?? true,
        config,
        privateKey: resolvePrivateKey(config),
      };
    },
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isConfigured: (account) => Boolean(account.privateKey?.trim()),
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.privateKey?.trim()),
    }),
  },
};
