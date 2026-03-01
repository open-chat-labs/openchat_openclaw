# openchat-openclaw

An [OpenClaw](https://openclaw.ai) plugin that adds [OpenChat](https://oc.app) as a channel. Users interact with the AI agent by sending a `/prompt` command to a bot in OpenChat.

## Prerequisites

- OpenClaw gateway running and accessible from the internet (OpenChat needs to reach your `/bot_definition` and `/execute_command` endpoints)
- `openssl` on your PATH (for key generation)
- Node 22+

## Installation

```sh
openclaw plugins install @open-ic/openchat_openclaw
```

## Setup

### 1. Generate a bot identity

```sh
npx --package @open-ic/openchat_openclaw generate-key
```

This generates a secp256k1 private key, writes it to `~/.openclaw/openchat-bot.pem` (mode 600), and prints the corresponding Internet Computer principal. Save the principal — you'll need it when registering the bot on OpenChat.

### 2. Supply required environment variables

The plugin requires two env vars that must be set before starting the gateway. Add them to `~/.openclaw/.env` (or export them in your shell):

```sh
# OpenChat's ES256 public key — used to verify JWTs on incoming bot commands.
# Obtain from: https://oc.app/api
OC_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

# User index canister ID — provided by OpenChat for your deployment.
OC_USER_INDEX_CANISTER="<canister-id>"
```

| Variable                    | Required  | Default                       | Description                                          |
| --------------------------- | --------- | ----------------------------- | ---------------------------------------------------- |
| `OC_PUBLIC_KEY`             | Yes       | —                             | OpenChat's ES256 public key for JWT verification     |
| `OC_USER_INDEX_CANISTER`    | Yes       | —                             | OpenChat user index canister ID                      |
| `OC_PRIVATE_KEY`            | See below | —                             | Bot private key PEM (alternative to config)          |
| `OC_IC_HOST`                | No        | `https://icp-api.io`          | Internet Computer host (override for local replicas) |
| `OC_STORAGE_INDEX_CANISTER` | No        | `nbpzs-kqaaa-aaaar-qaaua-cai` | Storage index canister ID                            |

### 3. Configure the private key

The bot private key (from step 1) can be supplied in three ways, in priority order:

**Option A — Key file (recommended):**

The `generate-key` script writes the PEM to `~/.openclaw/openchat-bot.pem` and prints the exact command to run:

```sh
openclaw config set channels.openchat.privateKeyFile ~/.openclaw/openchat-bot.pem
```

**Option B — Env var:**

```sh
# In ~/.openclaw/.env or your shell:
OC_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
```

**Option C — Inline config (not recommended for production):**

```sh
openclaw config set channels.openchat.privateKey "-----BEGIN EC PRIVATE KEY-----\n..."
```

### 4. Start the gateway

```sh
openclaw gateway run
```

### 5. Register the bot on OpenChat

Once the gateway is running and reachable from the browser, go to [oc.app](https://oc.app), run the `/register_bot` command from any chat. To register the bot you can give it the name and avatar of your choice and you will also need the following two details.

- **Gateway endpoint origin**: `https://<your-gateway-host>:<gateway-port>`
- **Principal**: the value printed in step 1

OpenChat will call `GET /bot_definition` to verify your endpoint is reachable before completing registration, and `POST /execute_command` each time a user sends `/prompt`.

### 6. Install the bot as a direct chat.

Search for the bot you registered as if searching for a user. Install the bot as a direct chat (which involves accepting the required permissions). Start talking to the bot! Congratulations, you are now talking to OpenClaw directly from OpenChat.
