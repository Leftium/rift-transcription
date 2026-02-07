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
| **Speechmatics**             | https://speechmatics.com                                      | Homepage has embedded real-time transcription widget with sample clips.                                       |

---

## All Demos by Category

### Cloud Provider Demos

| Provider                  | URL                                                           | Streaming? | Partial Results? | Copy/Export? | Signup?         |
| ------------------------- | ------------------------------------------------------------- | ---------- | ---------------- | ------------ | --------------- |
| **ElevenLabs Scribe**     | https://elevenlabs.io/speech-to-text                          | Yes        | Yes              | Yes          | No              |
| **Deepgram Free Tool**    | https://deepgram.com/free-transcription                       | Yes (mic)  | Yes              | Yes (.txt)   | No              |
| **Deepgram Playground**   | https://playground.deepgram.com                               | Yes        | Yes              | Yes          | Yes             |
| **Voxtral Realtime**      | https://huggingface.co/spaces/mistralai/Voxtral-Mini-Realtime | Yes        | Yes              | Unknown      | No              |
| **Mistral Studio**        | https://console.mistral.ai/build/audio/speech-to-text         | Yes        | Unknown          | Unknown      | Yes             |
| **Speechmatics**          | https://speechmatics.com (homepage widget)                    | Yes        | Yes              | Unknown      | No              |
| **Speechmatics Portal**   | https://portal.speechmatics.com                               | Yes        | Yes              | Yes          | Yes             |
| **Google Cloud STT**      | https://cloud.google.com/speech-to-text (inline demo)         | Yes        | Unknown          | Unknown      | Yes (GCP)       |
| **Azure Speech Studio**   | https://speech.microsoft.com/portal                           | Yes        | Yes              | Yes          | Yes (Azure)     |
| **AssemblyAI Playground** | https://www.assemblyai.com/playground                         | No (batch) | No               | Yes          | No              |
| **Gladia Playground**     | https://app.gladia.io/playground                              | Yes        | Yes (<100ms)     | Unknown      | Yes (free tier) |
| **Soniox Compare**        | https://soniox.com/compare/                                   | Yes        | Yes (per-token)  | Unknown      | Unknown         |

### Multi-Provider Comparison

| Tool                        | URL                                 | Providers Compared                                                | Notes                                                                                      |
| --------------------------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Soniox Compare**          | https://soniox.com/compare/         | Soniox, OpenAI, Google, Azure, Speechmatics, Deepgram, AssemblyAI | Real API calls, not canned demos. [Open-source](https://github.com/soniox/soniox-compare). |
| **Deepgram ASR Comparison** | https://deepgram.com/asr-comparison | Deepgram vs OpenAI, AWS, Google, Azure                            | Upload audio comparison (not live streaming).                                              |

### Web Speech API (Browser-Native, Free)

| Demo                     | URL                                                     | Copy/Export?       | Notes                                              |
| ------------------------ | ------------------------------------------------------- | ------------------ | -------------------------------------------------- |
| **Google Chrome Demo**   | https://www.google.com/intl/en/chrome/demos/speech.html | Yes (copy + email) | Official Chrome demo. Best Web Speech API demo.    |
| **Dictation.io**         | https://dictation.io                                    | Yes (full editor)  | Full dictation notepad with voice commands.        |
| **Speechnotes**          | https://speechnotes.co                                  | Yes (export)       | Dictation notepad with formatting.                 |
| **MDN Web Speech demos** | https://mdn.github.io/dom-examples/web-speech-api/      | No                 | Educational demos (color changer, phrase matcher). |

### In-Browser / WASM (Offline, No Server)

| Demo                         | URL                                                                                          | Model                     | Copy?   | Notes                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------------- | ------- | -------------------------------------- |
| **sherpa-onnx (ZH+EN)**      | https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en                      | Zipformer                 | Unknown | True streaming. Requires WASM SIMD.    |
| **sherpa-onnx (Paraformer)** | https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en-paraformer           | Paraformer                | Unknown | Chinese + English.                     |
| **sherpa-onnx (Cantonese)**  | https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-cantonese-en-paraformer | Paraformer                | Unknown | Chinese + English + Cantonese.         |
| **Moonshine Web**            | https://huggingface.co/spaces/webml-community/moonshine-web                                  | Moonshine                 | Unknown | Designed for real-time in-browser ASR. |
| **Whisper Web**              | https://huggingface.co/spaces/Xenova/whisper-web                                             | Whisper (Transformers.js) | Unknown | Pseudo-streaming (chunked batch).      |
| **Vosk Browser**             | https://ccoreilly.github.io/vosk-browser/                                                    | Vosk                      | Unknown | Community WASM port.                   |
| **OpenAI Whisper (HF)**      | https://huggingface.co/spaces/openai/whisper                                                 | Whisper (Gradio)          | Yes     | Batch only, not streaming.             |

### No Public Demo (API-Only)

| Provider   | Notes                                                     |
| ---------- | --------------------------------------------------------- |
| **Groq**   | Batch Whisper only. No streaming, no browser demo.        |
| **OpenAI** | Realtime API supports streaming, but no public demo page. |
| **Rev.ai** | API-only with SDKs. No in-browser demo.                   |

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
- **Web Speech API demos** (Chrome demo, Dictation.io) are the simplest to try — no signup, no API key, works immediately in Chrome.
- **sherpa-onnx WASM demos** are the best examples of fully offline in-browser streaming transcription.
- Most cloud provider demos require signup; ElevenLabs and Deepgram are notable exceptions with free public demos.
