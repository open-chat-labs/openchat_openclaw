import type { ChannelOnboardingAdapter, OpenClawConfig } from "openclaw/plugin-sdk";

type OcConfig = { privateKeyFile?: string; privateKey?: string };

function setEnabled(cfg: OpenClawConfig, enabled: boolean): OpenClawConfig {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      openchat: { ...cfg.channels?.openchat, enabled },
    },
  };
}

function isConfigured(cfg: OpenClawConfig): boolean {
  const oc = cfg.channels?.openchat as OcConfig | undefined;
  return Boolean(
    process.env.OC_PRIVATE_KEY || oc?.privateKeyFile?.trim() || oc?.privateKey?.trim(),
  );
}

export const openChatOnboardingAdapter: ChannelOnboardingAdapter = {
  channel: "openchat",
  getStatus: async ({ cfg }) => {
    const configured = isConfigured(cfg);
    return {
      channel: "openchat",
      configured,
      statusLines: [configured ? "OpenChat: Configured" : "OpenChat: Not configured"],
      quickstartScore: configured ? 1 : 0,
    };
  },
  configure: async ({ cfg, prompter }) => {
    const oc = cfg.channels?.openchat as OcConfig | undefined;

    // Prefer file path — avoids PEM newline escaping issues in YAML.
    // Users can also set OC_PRIVATE_KEY env var to skip this entirely.
    const privateKeyFile = await prompter.text({
      message:
        "Path to your OpenChat bot PEM key file (e.g. ~/.openclaw/openchat-bot.pem)\n" +
        "  Leave blank to use the OC_PRIVATE_KEY env var instead.",
      initialValue: oc?.privateKeyFile ?? "",
    });

    const next: OpenClawConfig = {
      ...cfg,
      channels: {
        ...cfg.channels,
        openchat: {
          ...cfg.channels?.openchat,
          enabled: true,
          privateKeyFile: String(privateKeyFile ?? "").trim() || undefined,
        },
      },
    };
    return { cfg: next, accountId: "default" };
  },
  disable: (cfg) => setEnabled(cfg, false),
};
