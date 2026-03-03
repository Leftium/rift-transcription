# Chat Session: Zero-Config Transcription for Whispering

**Session ID**: `ses_3fb3c3847ffecpwcBEw7yvo7Xf`
**Date**: January 28, 2026
**Source**: epicenter project (OpenCode)

---

## Summary

Main research session comparing sherpa-onnx and ElevenLabs for real-time streaming transcription. Covered WASM latency estimates, accuracy comparisons, WebSocket API shapes, VAD events, and explored prototype architectures (web vs native). Also briefly covered Fish Speech and CosyVoice2 (TTS). Ended with deciding on sherpa-onnx WebSocket server + SvelteKit UI + ElevenLabs as the prototype architecture.

---

## Conversation

### Adding sherpa-onnx to Whispering I/O Analysis

**User**: Add info about sherpa realtime streaming transcription to `docs/whispering-io-analysis.md`

**Assistant**: Added sherpa-onnx to the Browser/Local Options comparison table, comprehensive details section covering deployment options, streaming-capable models (20MB-220MB), WASM browser support with demo links, and Rust integration via sherpa-rs.

---

### Adding ElevenLabs Scribe v2 Info

**User**: Add info about https://elevenlabs.io/realtime-speech-to-text

**Assistant**: Added ElevenLabs Scribe v2 Realtime to Cloud Streaming Providers table ($0.28+/hr, 90+ languages, 150ms latency, WebSocket) and detailed section covering pricing, features (predictive transcription, text conditioning), accuracy benchmarks, and limitations.

---

### Sherpa vs ElevenLabs Comparison

**User**: Compare sherpa-onnx and ElevenLabs for real-time streaming transcription. What would sherpa's WASM latency be?

**Assistant**:

| Aspect          | sherpa-onnx (WASM)        | ElevenLabs Scribe v2 |
| --------------- | ------------------------- | -------------------- |
| Latency         | ~200-500ms (estimated)    | ~150ms               |
| Cost            | Free (open source)        | $0.28+/hour          |
| Privacy         | 100% local/offline        | Cloud-based          |
| Languages       | 20+ (model-dependent)     | 90+                  |
| First-use delay | 40-70MB model download    | None (cloud)         |
| Word timestamps | Yes                       | Yes                  |
| VAD             | Built-in                  | Built-in             |
| Browser support | WASM (requires COOP/COEP) | WebSocket API        |

**WASM Latency Estimate**: Native RTF 0.10-0.15, WASM overhead 2-5x slower, estimated ~200-500ms total. Chunk size (320ms default) is the minimum latency floor.

---

### Sherpa Latency by Platform

**User**: What platform would sherpa have lowest latency?

**Assistant**:

| Platform              | RTF       | Estimated Latency |
| --------------------- | --------- | ----------------- |
| Native C++/Rust + GPU | 0.05-0.08 | ~50-80ms          |
| Native C++/Rust CPU   | 0.10-0.15 | ~100-150ms        |
| Mobile (iOS/Android)  | 0.15-0.25 | ~150-250ms        |
| WASM (Browser)        | 0.30-0.75 | ~300-500ms        |

**Key insight**: For streaming, chunk size matters more than processing speed. Even with 50ms processing, minimum latency is ~320ms + processing.

---

### Accuracy Comparison

**User**: How does accuracy compare?

**Assistant**:

**Practical Accuracy Ranking (English, streaming):**

| Tier        | Model                 | Notes                             |
| ----------- | --------------------- | --------------------------------- |
| Best        | Deepgram Nova 3       | ~8-10% WER real-world             |
| Good        | ElevenLabs Scribe v2  | Claims 95%, unverified            |
| Good        | sherpa-onnx Zipformer | ~5-8% WER clean audio             |
| Decent      | Whisper large-v2      | ~10-15% WER, fewer hallucinations |
| Problematic | Whisper large-v3      | Hallucination issues              |

**Key finding**: sherpa-onnx Zipformer is purpose-built for streaming, less prone to hallucination (no autoregressive decoder). Whisper-v3 hallucinates 4x more than v2 per Deepgram analysis.

---

### Prototype Architecture

**User**: Thinking of prototyping realtime streaming transcription app. Sherpa + ElevenLabs + SvelteKit (web-based). Suggest better alternatives?

**Assistant**:

| Approach               | Time to Prototype | Main Challenge                   |
| ---------------------- | ----------------- | -------------------------------- |
| Web + Web Speech API   | 1-2 days          | Limited browser support          |
| Web + sherpa-onnx WASM | 1-2 weeks         | WASM integration, headers, build |
| Tauri + sherpa-rs      | 3-5 days          | Rust learning curve              |
| Electron + whisper.cpp | 3-5 days          | Native module compilation        |

**Web recommendation**: Web Speech API + Deepgram (prototype in a weekend)
**Native recommendation**: Tauri + sherpa-rs + Deepgram

---

### Fish Speech / CosyVoice2 (TTS Detour)

**User**: Tell me about Fish Speech / CosyVoice2

**Assistant**: These are **TTS** models, not STT. Fish Speech: open-source, good for Asian languages, Apache 2.0. CosyVoice2: Alibaba's latest, state-of-the-art Chinese quality, streaming support.

**Practical pairing**: Local: sherpa-onnx (STT) + Fish Speech (TTS). Cloud: Deepgram (STT) + ElevenLabs (TTS).

---

### Sherpa WebSocket Server Architecture

**User**: Could a separate local sherpa websocket server be run next to a SvelteKit UI?

**Assistant**: Yes! sherpa-onnx has a **built-in WebSocket server** (Python or C++). Performance is nearly identical to native - both run native sherpa-onnx.

```bash
python -m sherpa_onnx.websocket_server \
  --tokens=./tokens.txt --encoder=./encoder.onnx \
  --decoder=./decoder.onnx --joiner=./joiner.onnx --port=6006
```

| Goal              | Recommendation                 |
| ----------------- | ------------------------------ |
| Fastest prototype | WebSocket server + SvelteKit   |
| Best UX for users | Tauri + sherpa-rs (single app) |
| Production app    | Tauri + sherpa-rs              |

---

### WebSocket API Comparison

**User**: How do the APIs compare? Input and output shapes?

**Assistant**:

**Audio Input**: Both take binary PCM audio. sherpa uses float32, ElevenLabs uses int16.

**Output**:

sherpa-onnx:

```json
{
	"text": "hello world",
	"tokens": ["hello", " world"],
	"timestamps": [0.32, 0.64],
	"is_final": false
}
```

ElevenLabs:

```json
{
	"type": "transcript",
	"text": "hello world",
	"is_final": false,
	"speech_final": false,
	"words": [{ "word": "hello", "start": 0.32, "end": 0.48, "confidence": 0.98 }]
}
```

**Key differences**: ElevenLabs has confidence scores, language detection, `speech_final` (VAD). ~50 lines of adapter code to unify them.

---

### VAD Events

**User**: Tell me about VAD events

**Assistant**:

| Aspect       | sherpa-onnx               | ElevenLabs          |
| ------------ | ------------------------- | ------------------- |
| VAD included | Optional (Silero VAD)     | Built-in            |
| VAD events   | Separate or `is_endpoint` | `vad` message type  |
| Configurable | At server startup         | Per-connection JSON |

**Key difference**: `is_final` = transcription won't change (model confident). `speech_final` = user stopped speaking (VAD detected silence). These can differ.

---

## Session Handoff Summary

**Architecture decided**: sherpa-onnx WebSocket server + SvelteKit UI + ElevenLabs

**Key finding**: Both providers use WebSocket with similar patterns. Thin adapter layer (~50 lines) unifies them.

**Files Changed**: `docs/whispering-io-analysis.md` - Added sherpa-onnx details, ElevenLabs Scribe v2 section, updated provider comparison tables.
