# Chat Session: Sherpa-ONNX WASM Browser Support

**Session ID**: `ses_3fff04cadffeMuIFIOr10nkbTg`
**Date**: January 28, 2026
**Source**: epicenter project (OpenCode)

---

## Summary

Explored whether sherpa-onnx offers WASM models that can run in a browser (Tauri webview). Concluded: yes, comprehensive WASM support exists with models as small as ~20MB. Streaming transcription works in WASM. A zero-config desktop app bundling a small model (~30-40MB) is feasible.

---

## Conversation

### User

> Does sherpa-onnx offer WASM model that can be run in browser (Tauri shell)?

### Assistant

**Yes, sherpa-onnx offers comprehensive WASM support** that can run in a browser (including Tauri's webview).

**Available WASM builds** (from build scripts in the repo):

- `build-wasm-simd-asr.sh` - Speech recognition (ASR)
- `build-wasm-simd-tts.sh` - Text-to-speech (TTS)
- `build-wasm-simd-vad.sh` - Voice activity detection
- `build-wasm-simd-vad-asr.sh` - VAD + ASR combined
- `build-wasm-simd-kws.sh` - Keyword spotting
- `build-wasm-simd-speaker-diarization.sh` - Speaker diarization
- `build-wasm-simd-speech-enhancement.sh` - Speech enhancement

**Live demos** (browser):

- Real-time ASR (Chinese + English): https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en
- VAD + SenseVoice: https://huggingface.co/spaces/k2-fsa/web-assembly-vad-asr-sherpa-onnx-zh-en-ja-ko-cantonese-sense-voice
- TTS (English): https://huggingface.co/spaces/k2-fsa/web-assembly-tts-sherpa-onnx-en
- Speaker diarization: https://huggingface.co/spaces/k2-fsa/web-assembly-speaker-diarization-sherpa-onnx

---

### User

> How large are the models? (smallest one, best balance between size/accuracy)

### Assistant

#### Smallest Models

| Model                                  | Language | Size (int8) | Notes                      |
| -------------------------------------- | -------- | ----------- | -------------------------- |
| sherpa-onnx-streaming-zipformer-zh-14M | Chinese  | ~14M total  | Suitable for Cortex A7 CPU |
| sherpa-onnx-streaming-zipformer-en-20M | English  | ~20M total  | Suitable for Cortex A7 CPU |
| Whisper tiny.en                        | English  | ~39M        | Non-streaming              |
| Moonshine tiny                         | English  | ~30-40M     | Non-streaming              |

#### Best Balance (Size vs Accuracy)

| Model                                                 | Language          | Size (int8) | Notes                 |
| ----------------------------------------------------- | ----------------- | ----------- | --------------------- |
| sherpa-onnx-streaming-zipformer-small-bilingual-zh-en | Chinese + English | ~70MB       | Good bilingual option |

#### VAD Model

- **silero_vad.onnx**: ~2MB

**Recommendations for Tauri/WASM:**

1. **Smallest**: `sherpa-onnx-streaming-zipformer-en-20M` (~20MB)
2. **Best balance**: bilingual zh-en (~70MB)
3. **Non-streaming**: Whisper tiny.en (~39MB) or Moonshine tiny (~30-40MB)

---

### User

> So would it be possible to make whispering a zero-config local app (no api key, no model download), just give mic permission via WASM?

### Assistant

Yes, technically possible with trade-offs:

| Approach               | Bundle Size | User Experience   |
| ---------------------- | ----------- | ----------------- |
| Whisper tiny.en (int8) | +~40MB      | English only      |
| Moonshine tiny (int8)  | +~35MB      | English only      |
| Zipformer 14M/20M      | +~15-20MB   | Single language   |
| Zipformer bilingual    | +~70MB      | Chinese + English |

**Challenges:**

- Initial load time (WASM model init takes a few seconds)
- Memory usage (~100-200MB RAM for small models)
- Performance (WASM slower than native)

**Bottom line**: A ~100-150MB app that "just works" with mic permission is realistic. Main question is whether tiny model accuracy meets quality bar.

---

### User

> What about streaming transcription? Supported by sherpa?

### Assistant

**Yes, sherpa-onnx fully supports streaming (real-time) transcription.**

| Type                    | How it works             | Latency          | Use case           |
| ----------------------- | ------------------------ | ---------------- | ------------------ |
| Online (Streaming)      | Transcribes as you speak | Low (~200-500ms) | Real-time          |
| Offline (Non-streaming) | Processes complete audio | Higher           | File transcription |

WASM builds for streaming:

- `build-wasm-simd-asr.sh` - Streaming ASR
- `build-wasm-simd-vad-asr.sh` - VAD + Streaming ASR

How streaming works:

```
Audio Input -> VAD (detect speech) -> Streaming ASR -> Partial results
     |              |                    |              |
  Mic chunks    silero-vad         Zipformer      "Hello wo..."
  (10-30ms)      (~2MB)           (~20-70MB)      "Hello world"
```

---

### User

> What about the Rust version of sherpa?

### Assistant

**sherpa-rs** (community-maintained Rust bindings):

- 280 stars, MIT licensed, actively maintained (v0.6.8)
- **Key limitation: No streaming transcription bindings yet** (only `OfflineRecognizer`)

| Aspect           | sherpa-rs (Native)        | WASM            |
| ---------------- | ------------------------- | --------------- |
| Performance      | Native speed, GPU support | Browser-limited |
| Streaming        | Not available yet         | Supported       |
| Build complexity | CMake + toolchain         | Simpler         |

**For zero-config with streaming, WASM is currently the way to go.** sherpa-rs needs streaming bindings added first.

---

### User

> Which bindings support streaming?

### Assistant

| Language/Binding     | Streaming | Notes                   |
| -------------------- | --------- | ----------------------- |
| C++                  | Yes       | Official                |
| C                    | Yes       | Official                |
| Python               | Yes       | Official                |
| JavaScript/WASM      | Yes       | Official                |
| Java                 | Yes       | Official                |
| Kotlin               | Yes       | Official (Android)      |
| Swift                | Yes       | Official (iOS)          |
| C#                   | Yes       | Official                |
| Go                   | Yes       | Official                |
| Dart/Flutter         | Yes       | Official                |
| **Rust (sherpa-rs)** | **No**    | Community, offline only |

---

### User

> How difficult to add streaming to sherpa-rs?

### Assistant

**Moderate difficulty** (~5-10 hours). The C API already exposes streaming functions. Pattern exists in sherpa-rs codebase.

---

### User

> What about this PR? https://github.com/thewh1teagle/sherpa-rs/pull/124

### Assistant

**PR #124 adds streaming API support to sherpa-rs** (opened Jan 6, 2026). Once merged, zero-config Tauri app with native Rust streaming transcription is very feasible.

---

### User

> So what would zero-config Tauri app with native Rust streaming transcription look like?

### Assistant

Architecture overview:

```
+-------------------------------------------------------+
| Tauri App (~150-200MB)                                |
|                                                       |
|  Frontend (Svelte)                                    |
|  - Request mic permission (WebAudio API)              |
|  - Stream audio chunks to Rust backend                |
|  - Display real-time transcription                    |
|                       |                               |
|                 Tauri IPC                              |
|                       v                               |
|  Backend (Rust + sherpa-rs)                            |
|  - OnlineRecognizer (streaming ASR)                   |
|  - Silero VAD                                         |
|  - Bundled model (~40-70MB)                           |
+-------------------------------------------------------+
```

**User experience**: Click install -> Launch -> Grant mic -> Transcribe. No API keys, no configuration, works offline.

**Web version**: WASM with CDN-cached models (~40MB download on first use, cached in IndexedDB after).

---

### User

> Let's draft a concise GH issue comment for https://github.com/EpicenterHQ/epicenter/issues/1277

### Assistant

Drafted and copied to clipboard: "Alternative: sherpa-onnx for true zero-config local transcription" covering model sizes, implementation paths (desktop via sherpa-rs, web via WASM), and trade-offs vs Web Speech API.

---

### User

> Current releases are as small as 12MB. Is zero config bundled install already possible?

### Assistant

**Key insight**: Whispering already has local engines (Moonshine, Parakeet) but models are **downloaded on first use**, not bundled.

**Desktop**: Zero-config is achievable by bundling Moonshine Tiny (~30MB). App grows from ~12MB to ~42MB.

**Web**: No local transcription at all. Users must configure cloud API key. Two paths: Web Speech API or sherpa-onnx WASM.

---

## Key Takeaways

1. sherpa-onnx has comprehensive WASM support with streaming
2. Models as small as ~20MB (Zipformer) make bundling feasible
3. Desktop zero-config: just bundle Moonshine Tiny (~30MB)
4. Web zero-config: needs new integration (WASM or Web Speech API)
5. sherpa-rs PR #124 adds streaming to Rust bindings
