# Moonshine JS Research Notes

Comparison of Moonshine JS SDK vs RIFT's audio capture and transcription approach, with notes on browser mic permission behavior.

---

## Moonshine JS Overview

- **SDK**: `@moonshine-ai/moonshine-js` ([npm](https://www.npmjs.com/package/@moonshine-ai/moonshine-js)) ([docs](https://dev.moonshine.ai/js/)) ([GitHub](https://github.com/moonshine-ai/moonshine-js))
- **Architecture**: Runs ONNX models entirely in-browser via WASM. No server, no API key, no network round-trip.
- **Audio capture**: Handled internally by the SDK. Developer just picks a model and gets text back.
- **Models hosted on HuggingFace**: [UsefulSensors/moonshine](https://huggingface.co/UsefulSensors/moonshine/tree/main/onnx/merged)

---

## API Comparison: RIFT vs Moonshine JS

### Audio Capture

|                   | RIFT                                                                                                       | Moonshine JS                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Approach**      | Manual pipeline (`AudioCapture` class)                                                                     | Abstracted by SDK                                    |
| **getUserMedia**  | Called in `audio-capture.ts:25`                                                                            | Called internally by `MicrophoneTranscriber.start()` |
| **Resampling**    | Custom `AudioWorkletProcessor` (linear interpolation, native rate -> 16kHz) in `static/audio-processor.js` | Handled internally                                   |
| **Audio format**  | Float32Array chunks via `onAudioData` callback                                                             | Not directly exposed as a stream                     |
| **Lines of code** | ~150 across 2 files for audio capture alone                                                                | ~3 lines to get transcription                        |

### Transcription

|                          | RIFT                                                            | Moonshine JS                            |
| ------------------------ | --------------------------------------------------------------- | --------------------------------------- |
| **Where inference runs** | Server-side (WebSocket to local/cloud server)                   | Client-side (ONNX/WASM in browser)      |
| **Multiple backends**    | Yes: Web Speech API, local server (sherpa-onnx), Deepgram cloud | Single backend (local ONNX model)       |
| **Interim results**      | `interim` transcript                                            | `onTranscriptionUpdated(text, audio)`   |
| **Final results**        | `endpoint` transcript                                           | `onTranscriptionCommitted(text, audio)` |
| **VAD**                  | Server-side                                                     | Client-side (built-in, toggleable)      |
| **Word-level data**      | Yes (timestamps, confidence, BPE coalescing)                    | Not exposed in public API               |

### Wire Format (RIFT only -- Moonshine has no wire)

| Source       | Format               | Sample Rate | Transport                |
| ------------ | -------------------- | ----------- | ------------------------ |
| Local server | Float32 PCM          | 16kHz       | `ws://localhost:2177`    |
| Deepgram     | Int16 PCM (linear16) | 16kHz       | `wss://api.deepgram.com` |

---

## Audio Data Access for Playback

Moonshine JS **does** provide audio data alongside transcription text via callbacks:

```typescript
interface TranscriberCallbacks {
	onTranscriptionCommitted(text: string, audio: Float32Array): any;
	onTranscriptionUpdated(text: string, audio: Float32Array): any;
	onSpeechStart(): any;
	onSpeechContinuing(audio: Float32Array): any;
	onSpeechEnd(audio: Float32Array): any;
	// ... lifecycle callbacks (no audio)
}
```

In RIFT, audio data flows one-way to the WebSocket server via `onAudioData`. To capture for playback, you'd tap into that callback and accumulate chunks yourself.

---

## Real-Time Waveform Visualization (Pre-Transcription)

|                                 | RIFT                                                                  | Moonshine JS                                                                         |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Continuous raw audio access** | Yes (`onAudioData` callback, every chunk)                             | No (only during speech/transcription events)                                         |
| **Pre-speech visualization**    | Easy: tap `onAudioData` or add `AnalyserNode` to existing audio graph | Requires calling `getUserMedia()` yourself + using base `Transcriber.attachStream()` |
| **Extra work needed**           | None -- pipeline already exposed                                      | Moderate -- defeats the high-level API's purpose                                     |

Moonshine's `MicrophoneTranscriber` doesn't expose the raw audio stream before VAD triggers. For a waveform visualizer showing silence/noise/speech continuously, you'd need to manage `getUserMedia()` yourself and share the `MediaStream` with Moonshine's base `Transcriber` class via `attachStream()`.

---

## Model Sizes & Browser Memory

### Available Models in moonshine-js

The JS SDK downloads models from HuggingFace. Each model has encoder + decoder ONNX files:

| Model    | Params | Precision        | Encoder | Decoder | Total Download |
| -------- | ------ | ---------------- | ------- | ------- | -------------- |
| **Tiny** | 27M    | float32          | 30.9 MB | 78.2 MB | **109 MB**     |
| **Tiny** | 27M    | quantized (int8) | 7.9 MB  | 20.2 MB | **28 MB**      |
| **Base** | 61M    | float32          | 80.8 MB | 166 MB  | **247 MB**     |
| **Base** | 61M    | quantized (int8) | 20.5 MB | 42.5 MB | **63 MB**      |

Default precision in constructor: `"quantized"` (int8).

### Estimated Runtime Memory (Browser)

| Model + Precision | Download | Est. Runtime Memory |
| ----------------- | -------- | ------------------- |
| Tiny quantized    | 28 MB    | ~60-80 MB           |
| Tiny float32      | 109 MB   | ~200-300 MB         |
| Base quantized    | 63 MB    | ~120-180 MB         |
| Base float32      | 247 MB   | ~500-700 MB         |

Overhead includes: ONNX Runtime WASM binary (~5-10 MB), VAD model, inference buffers, KV cache.

### Practical Limits

- **Tiny quantized** is the sweet spot for browser use. ~28 MB download, real-time capable.
- **Base quantized** is usable on desktop (~63 MB download), but may not be real-time on low-end mobile.
- **Base float32** (~247 MB) is at the practical ceiling for web apps.
- **Medium Streaming** (245M params, 6.65% WER) and **Small Streaming** (123M params) from Moonshine v2 are only available in native SDKs (C++/Python/Swift/Android), not in moonshine-js.

### Moonshine v2 Model Benchmark (Native Only)

From the [main repo README](https://github.com/moonshine-ai/moonshine):

| Model            | WER    | Params | MacBook Pro | Linux x86 | RPi 5 |
| ---------------- | ------ | ------ | ----------- | --------- | ----- |
| Medium Streaming | 6.65%  | 245M   | 107ms       | 269ms     | 802ms |
| Small Streaming  | 7.84%  | 123M   | 73ms        | 165ms     | 527ms |
| Tiny Streaming   | 12.00% | 34M    | 34ms        | 69ms      | 237ms |
| Whisper Large v3 | 7.44%  | 1.5B   | 11,286ms    | 16,919ms  | N/A   |

---

## Browser Mic Permission Behavior

### Key Finding: `getUserMedia()` Does NOT Require a User Gesture

Contrary to common belief, browsers do **not** block `getUserMedia()` from being called without a user gesture. What happens:

1. The call triggers the browser's native permission prompt
2. The user must click "Allow" on that prompt (this _is_ the interaction)
3. If previously granted for the origin, it succeeds silently -- no prompt at all
4. The permission prompt appearance is the same whether triggered from a click handler or from page load (verified in Chrome)

### What DOES Require a User Gesture

| Action                      | Requires gesture?                    |
| --------------------------- | ------------------------------------ |
| Calling `getUserMedia()`    | No -- but triggers permission prompt |
| `AudioContext` resumption   | Sometimes (Chrome autoplay policy)   |
| `SpeechRecognition.start()` | Yes (Chrome requires it)             |

### Demos That Call getUserMedia() on Page Load

- **sherpa-onnx WASM demo**: [HF Space](https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en) -- calls `getUserMedia()` unconditionally at script load, before any button click. Source: `app-asr.js`.
- **Moonshine Web demo**: [HF Space](https://huggingface.co/spaces/webml-community/moonshine-web) -- calls `getUserMedia()` inside `useEffect([], [])` (React mount). Source: [App.jsx](https://github.com/huggingface/transformers.js-examples/tree/main/moonshine-web). Uses `transformers.js` (not the moonshine-js SDK).

Both request mic permission immediately on load. Once granted, audio capture and transcription begin without any in-page button click.

### Idea: Pre-Authorize Mic in RIFT

RIFT could call `getUserMedia()` on page load to "prime" the permission, then start actual recording on button click.

**Option A: Keep the stream alive**

```
Page load  → getUserMedia() → store MediaStream (mic indicator turns on)
User click → create AudioContext, connect nodes, begin processing
```

Tradeoff: mic indicator appears before user clicks Start.

**Option B: Prime and release**

```
Page load  → getUserMedia() → immediately stop all tracks (mic indicator turns off)
User click → getUserMedia() again (instant, no prompt) → full pipeline
```

Tradeoff: two `getUserMedia()` calls, but no premature mic indicator. Second call is instant since permission is cached.

**Current RIFT behavior**: `getUserMedia()` only called when user clicks Start. This is the recommended UX practice but adds one extra step.

---

## References

- Moonshine JS docs: https://dev.moonshine.ai/js/
- Moonshine JS API docs: https://moonshine-ai.github.io/moonshine-js
- Moonshine JS GitHub: https://github.com/moonshine-ai/moonshine-js
- Moonshine (main repo): https://github.com/moonshine-ai/moonshine
- ONNX models on HuggingFace: https://huggingface.co/UsefulSensors/moonshine/tree/main/onnx/merged
- Moonshine Web demo source: https://github.com/huggingface/transformers.js-examples/tree/main/moonshine-web
- sherpa-onnx WASM demo: https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en
