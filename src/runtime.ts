import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setOpenChatRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getOpenChatRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("OpenChat runtime not initialized");
  }
  return runtime;
}
