import { BotClientFactory } from "@open-ic/openchat-botclient-ts";

// Production OpenChat / Internet Computer constants.
// Override via environment variables for testing against a local replica.
const OC_IC_HOST = process.env.OC_IC_HOST ?? "https://icp-api.io";
const OC_PUBLIC_KEY = process.env.OC_PUBLIC_KEY ?? "";
const OC_USER_INDEX_CANISTER = process.env.OC_USER_INDEX_CANISTER ?? "";
const OC_STORAGE_INDEX_CANISTER =
  process.env.OC_STORAGE_INDEX_CANISTER ?? "nbpzs-kqaaa-aaaar-qaaua-cai";

let cached: { factory: BotClientFactory; privateKey: string } | null = null;

/**
 * Returns a BotClientFactory for the given private key, reusing the cached
 * instance when the key hasn't changed.
 */
export function getFactory(privateKey: string): BotClientFactory {
  if (cached?.privateKey === privateKey) {
    return cached.factory;
  }

  if (!OC_PUBLIC_KEY) {
    throw new Error(
      "OC_PUBLIC_KEY environment variable is required. " +
        "Set it to OpenChat's ES256 public key for JWT verification.",
    );
  }

  // Both keys may have literal \n in env vars — unescape them.
  const factory = new BotClientFactory({
    openchatPublicKey: OC_PUBLIC_KEY.replace(/\\n/g, "\n"),
    icHost: OC_IC_HOST,
    identityPrivateKey: privateKey,
    openStorageCanisterId: OC_STORAGE_INDEX_CANISTER,
    userIndexCanisterId: OC_USER_INDEX_CANISTER,
  });

  cached = { factory, privateKey };
  return factory;
}
