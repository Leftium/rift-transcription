# Online Realtime Streaming Transcription Demos

Demos to experience different transcription UIs before building our own. Focus: partial/interim results as you speak, and ways to use the transcribed text (copy, export, etc.).

---

## Top Picks (Best for UI Research)

| Demo                         | URL                                                           | Why                                                                                                           |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Soniox Compare**           | https://soniox.com/compare/                                   | Compares 7 APIs side-by-side in real-time. [Open-source framework](https://github.com/soniox/soniox-compare). |
| **ElevenLabs Scribe**        | https://elevenlabs.io/speech-to-text                          | Clean UI, real-time streaming, copy button. Scribe v2 Realtime <150ms.                                        |
| **Google Chrome Web Speech** | https://www.google.com/intl/en/chrome/demos/speech.html       | Browser-native. "Copy and Paste" + "Create Email" buttons. Zero setup.                                        |
| **Deepgram Free Tool**       | https://deepgram.com/free-transcription                       | Mic + file + YouTube URL input. Copy text or download .txt. No signup.                                        |
| **Voxtral Mini Realtime**    | https://huggingface.co/spaces/mistralai/Voxtral-Mini-Realtime | Mistral's streaming model. Sub-200ms latency.                                                                 |
| **Speechmatics Real-Time**   | https://www.speechmatics.com/product/real-time                | Inline 2-min demo (no signup). 90% accuracy, <1s latency, 55+ languages.                                      |
| **Kyutai STT**               | https://kyutai.org/stt                                        | Inline demo (no signup). 500ms latency, semantic VAD (end-of-speech detection). Open-source.                  |

---

## All Demos by Category

### Cloud Provider Demos

| Provider                   | URL                                                           | Streaming? | Partial Results? | Copy/Export? | Signup?         |
| -------------------------- | ------------------------------------------------------------- | ---------- | ---------------- | ------------ | --------------- |
| **ElevenLabs Scribe**      | https://elevenlabs.io/speech-to-text                          | Yes        | Yes              | Yes          | No              |
| **Deepgram Free Tool**     | https://deepgram.com/free-transcription                       | Yes (mic)  | Yes              | Yes (.txt)   | No              |
| **Deepgram Playground**    | https://playground.deepgram.com                               | Yes        | Yes              | Yes          | Yes             |
| **Voxtral Realtime**       | https://huggingface.co/spaces/mistralai/Voxtral-Mini-Realtime | Yes        | Yes              | Unknown      | No              |
| **Mistral Studio**         | https://console.mistral.ai/build/audio/speech-to-text         | Yes        | Unknown          | Unknown      | Yes             |
| **Speechmatics Real-Time** | https://www.speechmatics.com/product/real-time                | Yes        | Yes              | Unknown      | No (2-min demo) |
| **Speechmatics Portal**    | https://portal.speechmatics.com                               | Yes        | Yes              | Yes          | Yes (free tier) |
| **Google Cloud STT**       | https://cloud.google.com/speech-to-text (inline demo)         | Yes        | Unknown          | Unknown      | Yes (GCP)       |
| **Azure Speech Studio**    | https://speech.microsoft.com/portal                           | Yes        | Yes              | Yes          | Yes (Azure)     |
| **AssemblyAI Playground**  | https://www.assemblyai.com/playground                         | No (batch) | No               | Yes          | No              |
| **Gladia Playground**      | https://app.gladia.io/playground                              | Yes        | Yes (<100ms)     | Unknown      | Yes (free tier) |
| **Soniox Compare**         | https://soniox.com/compare/                                   | Yes        | Yes (per-token)  | Unknown      | Unknown         |
| **Kyutai STT**             | https://kyutai.org/stt                                        | Yes        | Yes              | Unknown      | No              |

### Multi-Provider Comparison

| Tool                        | URL                                 | Providers Compared                                                | Notes                                                                                      |
| --------------------------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Soniox Compare**          | https://soniox.com/compare/         | Soniox, OpenAI, Google, Azure, Speechmatics, Deepgram, AssemblyAI | Real API calls, not canned demos. [Open-source](https://github.com/soniox/soniox-compare). |
| **Deepgram ASR Comparison** | https://deepgram.com/asr-comparison | Deepgram vs OpenAI, AWS, Google, Azure                            | Upload audio comparison (not live streaming).                                              |

### Web Speech API (Browser-Native, Free)

| Demo                     | URL                                                     | Copy/Export?                    | Notes                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Google Chrome Demo**   | https://www.google.com/intl/en/chrome/demos/speech.html | Yes (copy + email)              | Official Chrome demo. Best Web Speech API demo.                                                                                                                                                  |
| **Dictation.io**         | https://dictation.io                                    | Yes (full editor)               | Full dictation notepad with voice commands.                                                                                                                                                      |
| **SpeechTexter**         | https://www.speechtexter.com                            | Yes (.doc, .txt)                | 70+ languages, custom voice commands, dark theme.                                                                                                                                                |
| **Speechnotes**          | https://speechnotes.co                                  | Yes (export)                    | Dictation notepad with formatting.                                                                                                                                                               |
| **Revoice**              | https://revoice.magill.dev/                             | Unknown                         | Svelte 5 app. Very responsive. [Source](https://github.com/andymagill/revoice).                                                                                                                  |
| **Selqio Transcriber**   | https://selqio.com/tools/voice-to-text-transcriber      | Yes (TXT/DOCX/PDF/SRT/JSON)     | Voice commands for punctuation. TTS playback. Session stats (WPM). Keyboard shortcuts.                                                                                                           |
| **Basil AI Web**         | https://basilai.app/app/                                | Yes (ZIP: transcript + summary) | Web Speech API + on-device AI summary (Qwen2.5-0.5B via WebGPU). Summarizes every minute. No signup. Also has [iOS app](https://apps.apple.com/us/app/basil-private-ai-note-taker/id6749776500). |
| **Free Live Transcript** | https://freelivetranscript.com/                         | Yes (copy + shareable link)     | Named transcripts viewable/translatable on other devices in real-time. Light/dark toggle. Open-source ([Code for Atlanta](https://github.com/marktnoonan/transcription)).                        |
| **eesel AI STT**         | https://www.eesel.ai/tools/speech-to-text               | Yes (copy)                      | Minimal Web Speech API wrapper. 20 languages. From an AI support/chatbot company.                                                                                                                |
| **MDN Web Speech demos** | https://mdn.github.io/dom-examples/web-speech-api/      | No                              | Educational demos (color changer, phrase matcher).                                                                                                                                               |

### In-Browser / WASM (Offline, No Server)

| Demo                         | URL                                                                                          | Model                     | Copy?   | Notes                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------------- | ------- | -------------------------------------------- |
| **sherpa-onnx (ZH+EN)**      | https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en                      | Zipformer                 | Unknown | True streaming. Requires WASM SIMD.          |
| **sherpa-onnx (Paraformer)** | https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en-paraformer           | Paraformer                | Unknown | Chinese + English.                           |
| **sherpa-onnx (Cantonese)**  | https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-cantonese-en-paraformer | Paraformer                | Unknown | Chinese + English + Cantonese.               |
| **Moonshine Web**            | https://huggingface.co/spaces/webml-community/moonshine-web                                  | Moonshine                 | Unknown | Designed for real-time in-browser ASR.       |
| **Whisper Web**              | https://huggingface.co/spaces/Xenova/whisper-web                                             | Whisper (Transformers.js) | Unknown | Pseudo-streaming (chunked batch).            |
| **Vosk Browser**             | https://ccoreilly.github.io/vosk-browser/                                                    | Vosk                      | Unknown | Community WASM port.                         |
| **Picovoice Playground**     | https://picovoice.ai/playground/                                                             | Leopard / Cheetah         | Unknown | On-device. STT + streaming STT + VAD + more. |
| **OpenAI Whisper (HF)**      | https://huggingface.co/spaces/openai/whisper                                                 | Whisper (Gradio)          | Yes     | Batch only, not streaming.                   |

### No Public Demo (API-Only)

| Provider   | Notes                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Groq**   | Batch Whisper only. No streaming, no browser demo.                                                                                                                                                                                                                                                                                                                                         |
| **OpenAI** | Realtime API supports streaming, but no public demo page.                                                                                                                                                                                                                                                                                                                                  |
| **Rev.ai** | API-only with SDKs. No in-browser demo. Open-sourced **Reverb ASR** model: trained on 200K hrs human-transcribed data, features `verbatimicity` parameter (0.0=clean formatted → 1.0=exact utterance with fillers/false starts). [HF demo](https://huggingface.co/spaces/Revai/reverb-asr) (batch, not streaming). Weights: [`reverb-asr-v2`](https://huggingface.co/Revai/reverb-asr-v2). |

---

## UI Patterns to Observe

When testing these demos, pay attention to:

1. **Interim text styling** — How do they show partial/unfinished results? (gray text, underline, separate area?)
2. **Final text transition** — How does interim text become final? (fade, snap, slide?)
3. **Copy mechanism** — Button placement, what gets copied (all text? selection?)
4. **Recording indicator** — How do you know it's listening? (pulsing dot, waveform, color?)
5. **Error handling** — What happens when mic access is denied or network drops?
6. **Language selection** — Auto-detect vs manual picker?
7. **Text formatting** — Punctuation, capitalization, paragraph breaks?
8. **Multi-speaker** — Any visual distinction between speakers?

---

## Notes

- **Soniox Compare** is the demo that compares multiple APIs simultaneously on the same audio. The framework is open-source at https://github.com/soniox/soniox-compare. Uses real API calls (Soniox, OpenAI, Google, Azure, Speechmatics, Deepgram, AssemblyAI). Soniox v4 Real-Time (Feb 2026) features token-level `is_final` streaming, semantic endpointing, and manual finalization — particularly relevant for RIFT's cursor interrupt architecture.
- **Revoice** is a Svelte 5 + SvelteKit voice transcription/recording app using the Web Speech API. Open-source: https://github.com/andymagill/revoice. Found via [r/sveltejs post](https://www.reddit.com/r/sveltejs/comments/1qc4y18/). Relevant as a Svelte 5 reference implementation for RIFT. Detailed source code review:
  - **Dual-track audio architecture**: `getUserMedia()` stream feeds (1) `AnalyserNode` for visualization + `MediaRecorder` for saving, while (2) `webkitSpeechRecognition.start()` opens its own separate internal mic — it ignores any stream passed to it. Two independent mic captures run simultaneously. This is unavoidable: the Web Speech API spec has no stream input parameter. A `cloneMediaStream()` utility exists in `audio.ts` (routes stream through `AudioContext` → `MediaStreamDestination`) but is dead code in the recording flow — it would be useful for real STT API engines that consume a stream, but irrelevant for Web Speech API.
  - **EQ Visualizer**: Canvas-based 32-bar frequency analyzer at 60fps via `requestAnimationFrame` + `analyser.getByteFrequencyData()`. Color-coded: red (recording), green (playback), amber (paused), gray (idle). Supports frozen state (snapshot on pause) and high-DPI displays.
  - **Playback visualization**: Separate `AudioContext` + `AnalyserNode` created via `AudioPlaybackProvider.svelte` using `createMediaElementSource()` on an `HTMLAudioElement`. Provided to `EqVisualizer` via Svelte context; playback analyser takes priority over recording analyser.
  - **Pluggable engine interface** (`ITranscriptionEngine`): `start(stream)`, `stop()`, `onResult()`, `onError()`, `getMetadata()`. Designed for swapping in Deepgram/AssemblyAI/local ML engines, but only `NativeEngine` (Web Speech API) is implemented. The stream parameter is a no-op for the native engine — correct abstraction for future engines that actually consume audio data.
  - **Auto-reconnection**: `NativeEngine` handles Chrome's recognition timeout (silence → `onend`) by automatically restarting recognition, with a `connecting` state until first result arrives.
  - **Session persistence**: Dexie.js (IndexedDB) stores sessions, audio blobs, and transcript segments. `MediaRecorder` collects chunks every 1s; blob is saved on pause. Base64 localStorage backup as fallback.
  - **Architecture relevance to RIFT**: The pluggable engine pattern is the right shape for supporting both Web Speech API (free tier) and real STT APIs (paid tier) — the engine interface accepts a stream that native engine ignores and real engines consume. Key difference: Web Speech API mode unavoidably requires two independent mic sessions (browser opens its own; `getUserMedia()` stream is only for viz/recording), while real API mode is cleaner — single `getUserMedia()` stream feeds viz, recording, _and_ STT. The `cloneMediaStream()` utility would be relevant in real API mode for feeding one stream to multiple consumers. RIFT also needs server-side routes for API key proxying, richer transcript data models (word-level timestamps, diarization), and the WebSocket layer for local STT servers.
  - **Transformers.js** is listed in Revoice's Phase 3 roadmap for on-device transcription. This is a third approach distinct from both Web Speech API (opaque cloud) and RIFT's local server (WebSocket to whisper.cpp/etc). Transformers.js runs models (e.g. Whisper) entirely in-browser via WASM/WebGPU — zero install, but limited to small models with lower quality, large initial download (40MB-1GB), and slow inference without WebGPU. See **Whisper Web** in the In-Browser/WASM table above for an existing demo of this approach.
  - **Tech stack**: SvelteKit, Svelte 5 (runes: `$state`, `$derived`, `$effect`), Tailwind CSS, shadcn-svelte, Dexie.js, static SPA on Cloudflare Pages.
- **Web Speech API demos** (Chrome demo, Dictation.io) are the simplest to try — no signup, no API key, works immediately in Chrome.
- **sherpa-onnx WASM demos** are the best examples of fully offline in-browser streaming transcription.
- **Kyutai STT** is an open-source streaming STT from the Moshi team. 500ms latency (1b model), SOTA accuracy. Notable for its **semantic VAD** — predicts end-of-speech probability that adapts to pauses rather than using a fixed silence timeout. This is directly relevant to RIFT's cursor interrupt design. Open weights: [`stt-1b-en_fr`](https://huggingface.co/kyutai/stt-1b-en_fr) (EN+FR), [`stt-2.6b-en`](https://huggingface.co/kyutai/stt-2.6b-en) (EN-only). Code: https://github.com/kyutai-labs/delayed-streams-modeling. Also powers [Unmute](https://unmute.sh), their voice chat app.
- Most cloud provider demos require signup; ElevenLabs and Deepgram are notable exceptions with free public demos.
