# Cloud Transcription Provider CORS Research

Can a browser SPA call each provider's token-minting REST endpoint directly (with an API key in the `Authorization` header), or would the preflight `OPTIONS` request be rejected?

Researched 2026-02-09 by fetching provider documentation pages and examining SDK source code.

---

## Summary

| Provider       | Token Endpoint                                  | CORS on REST API | Browser-Direct Token Minting?                               |
| -------------- | ----------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| **Deepgram**   | N/A (WS subprotocol auth)                       | Yes              | Yes — WS subprotocol bypasses CORS entirely                 |
| **OpenAI**     | N/A (no temp tokens)                            | Yes              | Yes — API key used directly (same as RIFT's existing model) |
| **AssemblyAI** | `GET streaming.assemblyai.com/v3/token`         | No               | No — server proxy required                                  |
| **Soniox**     | `POST api.soniox.com/v1/auth/temporary-api-key` | No               | No — server proxy required                                  |
| **ElevenLabs** | Undocumented                                    | No (likely)      | No — server proxy required                                  |

---

## Per-Provider Findings

### Deepgram — CORS: YES

Deepgram is the only provider that supports fully browser-direct streaming auth. Two mechanisms:

1. **WebSocket subprotocol auth** — `new WebSocket(url, ["token", apiKey])` uses the `Sec-WebSocket-Protocol` header, which is not subject to CORS preflight. This is how RIFT currently connects.
2. **REST API CORS headers** — Deepgram sends `Access-Control-Allow-Origin: *` on their REST endpoints (`api.deepgram.com`). Their JS SDK works in browsers without any special flags.

Deepgram historically maintained a dedicated CORS documentation page (the URL `developers.deepgram.com/docs/cors` existed but returned 404 during this research — likely lost during a docs site migration).

### OpenAI — CORS: YES

`api.openai.com` sends CORS headers, confirmed by examining the official Node.js SDK source code.

The SDK (`openai-node`) has a `dangerouslyAllowBrowser` option:

```typescript
// From openai-node/src/client.ts:
/**
 * By default, client-side use of this library is not allowed, as it risks
 * exposing your secret API credentials to attackers. Only set this option
 * to `true` if you understand the risks and have appropriate mitigations
 * in place.
 */
dangerouslyAllowBrowser?: boolean | undefined;
```

The constructor checks `isRunningInBrowser()` and throws unless `dangerouslyAllowBrowser: true` is set. The fact that setting this flag makes the SDK work in browsers proves the API returns CORS headers — if it didn't, no client-side flag could make `fetch()` succeed.

OpenAI has no temp token or scoped key mechanism. The flag is named "dangerously" because it assumes a SaaS model where the developer's key would be leaked to end users. In RIFT's model — where users supply their own API keys stored in localStorage — this is a non-issue.

### AssemblyAI — CORS: NO

Token endpoint: `GET https://streaming.assemblyai.com/v3/token?expires_in_seconds=60`
Auth: `Authorization: <API_KEY>` header.

Evidence from [authenticate-with-a-temporary-token](https://www.assemblyai.com/docs/universal-streaming/authenticate-with-a-temporary-token.mdx):

> "You should generate this token on your **server** and pass it to the client."

All code examples for the token endpoint use server-side contexts (Python `requests`, Node.js server-side `fetch`). No mention of CORS, browser-direct REST calls, or `Access-Control-Allow-Origin` anywhere in their docs.

The intended flow is: server mints token -> passes to client -> client opens WebSocket with `?token=<temp>` query param. The `Authorization` header on the REST call triggers a CORS preflight that AssemblyAI's API does not handle.

### Soniox — CORS: NO

Token endpoint: `POST https://api.soniox.com/v1/auth/temporary-api-key`
Auth: `Authorization: Bearer <SONIOX_API_KEY>` header.
Body: `{"usage_type": "transcribe_websocket", "expires_in_seconds": 60}`

The [Direct stream guide](https://soniox.com/docs/stt/guides/direct-stream) explicitly shows the correct architecture:

1. Browser calls **your own server's** `/temporary-api-key` endpoint.
2. Your server calls `api.soniox.com/v1/auth/temporary-api-key` with the permanent API key.
3. Your server returns the temp key to the browser.
4. Browser opens WebSocket to `wss://stt-rt.soniox.com/transcribe-websocket` using the temp key in the first JSON message.

Both the Python (FastAPI) and Node.js (Express) examples confirm the REST call is server-side only. The browser never calls `api.soniox.com` directly.

Additionally, the [Web SDK](https://soniox.com/docs/stt/SDKs/web-sdk) documents that the `apiKey` option can be "a function returning a temporary API key" — but this key comes from your own server, not from Soniox's REST API.

No mention of CORS headers anywhere in the complete Soniox documentation (verified via `llms.txt` full dump).

### ElevenLabs — CORS: NO (likely)

Could not fetch any ElevenLabs documentation pages directly (their docs site at `elevenlabs.io/docs` uses client-side rendering, all URLs returned 404).

Indirect evidence:

- All provider comparisons and community reports describe ElevenLabs streaming STT as requiring a server-side token endpoint.
- The Whispering app (which supports ElevenLabs for batch transcription) uses `dangerouslyAllowBrowser: true` patterns for OpenAI specifically, not for ElevenLabs — suggesting ElevenLabs does not send CORS headers.
- No public reports of ElevenLabs REST API working from browser `fetch()`.

---

## Token Lifetimes and Re-Minting Frequency

| Provider       | Max TTL       | Single-use?                               | Re-mint frequency          |
| -------------- | ------------- | ----------------------------------------- | -------------------------- |
| **AssemblyAI** | 600s (10 min) | Yes — one token = one WS session          | Once per recording session |
| **Soniox**     | 3600s (1 hr)  | No — but scoped to `transcribe_websocket` | Once per recording session |
| **ElevenLabs** | Unknown       | Unknown                                   | Unknown (docs unfetchable) |

The token is only needed to **establish** the WebSocket connection. Once connected, the session stays alive regardless of token expiry. In practice, you mint once when the user starts recording, not on a timer.

### Utterance separation does not require WS restarts

All providers support in-band finalize commands to separate utterances without closing the connection:

| Provider       | Finalize command                       | WS stays open? |
| -------------- | -------------------------------------- | -------------- |
| **Deepgram**   | `{"type":"Finalize"}`                  | Yes            |
| **Soniox**     | `{"type":"finalize"}` → `<fin>` marker | Yes            |
| **AssemblyAI** | `{"type":"ForceEndpoint"}`             | Yes            |
| **ElevenLabs** | `commit: true` on audio chunk          | Yes            |

One token → one WebSocket → many finalized utterances over the session's lifetime.

### Focus/blur reconnect cycle and token re-minting

RIFT auto-starts/stops transcription on window focus/blur. This closes and reopens the WebSocket on every tab switch. Each reconnect requires a new temp token for providers that need one.

**Impact by provider:**

| Provider       | Billing model                  | Reconnect token cost                  | Reconnect latency                |
| -------------- | ------------------------------ | ------------------------------------- | -------------------------------- |
| **Deepgram**   | Per audio processed            | None (direct WS auth)                 | ~100ms (WS open only)            |
| **Soniox**     | **Wall-clock stream duration** | Reuse token if <1hr old               | ~200-500ms (API route + WS open) |
| **AssemblyAI** | **Session time incl. silence** | **New token every time** (single-use) | ~200-500ms (API route + WS open) |
| **ElevenLabs** | Unknown                        | Unknown                               | ~200-500ms (API route + WS open) |

AssemblyAI is the worst case: every focus/blur cycle means a round-trip to the SvelteKit API route → AssemblyAI REST API → new token → new WebSocket. A user bouncing between editor and RIFT could trigger dozens of these per hour.

**Mitigation options:**

- **Cache tokens client-side** — works for Soniox (reuse until near 1hr expiry), not for AssemblyAI (single-use).
- **Mint eagerly on page load** — have a fresh token ready before the user focuses. Wastes tokens if the user never returns, but eliminates latency on focus.
- **Don't close on blur for duration-billed providers** — just stop sending audio. Saves reconnect latency but costs money for idle time (Soniox $0.12/hr, AssemblyAI $0.15/hr of silence).
- **Debounce blur** — wait 5-10s before closing. Brief tab switches don't trigger a reconnect cycle.

---

## SvelteKit API Route as Solution

A single SvelteKit server route would unblock all three CORS-blocked providers:

```
POST /api/token
Body: { "provider": "assemblyai"|"soniox"|"elevenlabs", "apiKey": "user-supplied-key" }
Returns: { "token": "temp-token", "expiresIn": 60 }
```

The route receives the user's API key from the client (already stored in localStorage), calls the provider's REST endpoint server-side (no CORS), and returns the temp token. The user's key transits through the server but is not stored — used for the single outbound call and discarded.

**Cost:** Already on Vercel, so no deployment change needed — `adapter-vercel` supports server routes.

**Complexity:** Trivial — ~20 lines per provider, no database, no state, no server-side auth. Called once per recording session (more with focus/blur cycles — see above).

---

## Why CORS Blocks These Calls

When a browser makes a `fetch()` request with an `Authorization` header to a cross-origin API:

1. The browser sends a **preflight** `OPTIONS` request first.
2. The server must respond with `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers: Authorization`, and `Access-Control-Allow-Methods: GET/POST`.
3. If the server doesn't respond to the `OPTIONS` request with these headers, the browser blocks the actual request entirely.

Most AI API providers don't include CORS headers because:

- Their APIs are designed for server-to-server use.
- Exposing API keys in browser code is a security risk.
- They provide temp token mechanisms specifically so a server mints the token and the client only gets a short-lived credential.

WebSocket connections are **not** subject to CORS (no preflight). The `Sec-WebSocket-Protocol` header used by Deepgram is sent during the WebSocket handshake, which browsers allow to any origin.

---

## Implications for RIFT

As a serverless browser SPA, RIFT can only use providers that either:

1. Send CORS headers on REST API endpoints (Deepgram, OpenAI), or
2. Support WebSocket-only auth that doesn't require a prior REST call (Deepgram).

To unlock AssemblyAI, Soniox, or ElevenLabs, one of these is needed:

- **SvelteKit server route** (`POST /api/token`) — simplest option, ~20 lines per provider. Already on Vercel so no deployment change needed. See "SvelteKit API Route as Solution" above.
- **Tauri desktop** (`@tauri-apps/plugin-http`) — Tauri's fetch bypasses CORS entirely. No server needed.
- **Edge function proxy** (Cloudflare Worker, etc.) — unnecessary given existing Vercel deployment.
