# Whispering I/O Analysis

**Date**: 2026-01-26
**Purpose**: Document all input/output boundaries for Whispering to inform actor-based architecture design

## INPUTS (What Whispering Receives)

### 1. Audio Input Sources

| Source                      | Method                             | Format                       | Handler                                    |
| --------------------------- | ---------------------------------- | ---------------------------- | ------------------------------------------ |
| Microphone (Browser)        | `MediaRecorder` + `getUserMedia()` | webm/ogg Blob                | `NavigatorRecorderService`                 |
| Microphone (Desktop/CPAL)   | Rust CPAL stream                   | WAV file (16kHz/mono/16-bit) | `CpalRecorderService` → Rust `recorder.rs` |
| Microphone (Desktop/FFmpeg) | FFmpeg subprocess                  | WAV or Opus file             | `FfmpegRecorderService`                    |
| VAD-triggered audio         | `@ricky0123/vad-web`               | WAV Blob                     | `vadRecorder` store                        |
| File upload                 | `<input type="file">`              | Any audio/video file         | `commands.uploadRecordings`                |
| Existing recording          | SQLite/IndexedDB                   | Audio Blob                   | `db.recordings.getAudioBlob()`             |

### 2. User Interactions

| Input                     | Trigger         | Data                          | Handler                 |
| ------------------------- | --------------- | ----------------------------- | ----------------------- |
| Global shortcut (desktop) | OS-level hotkey | `Accelerator` string          | `GlobalShortcutManager` |
| Local shortcut (web)      | Keyboard event  | `KeyboardEventSupportedKey[]` | `LocalShortcutManager`  |
| UI buttons                | Click event     | Action callback               | Svelte components       |
| Settings changes          | Form inputs     | Validated settings object     | `settings` store        |
| Device selection          | Dropdown        | `DeviceIdentifier`            | Recorder queries        |
| Transformation selection  | Modal picker    | Transformation ID             | Transformation picker   |

### 3. External Data

| Input                   | Source              | Format            | Handler                      |
| ----------------------- | ------------------- | ----------------- | ---------------------------- |
| API keys                | User input          | Plaintext strings | `settings['apiKeys.*']`      |
| Custom endpoints        | User input          | URL strings       | `settings['apiEndpoints.*']` |
| Model files (Whisper)   | Download/filesystem | `.bin` (GGML)     | `ModelManager` (Rust)        |
| Model files (Parakeet)  | Download/filesystem | ONNX files        | `ModelManager` (Rust)        |
| Model files (Moonshine) | Download/filesystem | ONNX files        | `ModelManager` (Rust)        |
| Clipboard text          | System clipboard    | Plain text        | `text.readFromClipboard`     |

### 4. System Events

| Event             | Source          | Data       | Handler                |
| ----------------- | --------------- | ---------- | ---------------------- |
| App ready/exit    | Tauri lifecycle | `RunEvent` | `lib.rs`               |
| Permission grants | OS dialogs      | Boolean    | `PermissionsService`   |
| Update available  | Tauri updater   | Manifest   | `check-for-updates.ts` |
| FFmpeg installed  | Shell check     | Boolean    | `check-ffmpeg.ts`      |
| Window focus/blur | Window manager  | State      | Layout components      |

---

## OUTPUTS (What Whispering Produces)

### 1. Text Delivery

| Output            | Destination        | Format               | Handler                       |
| ----------------- | ------------------ | -------------------- | ----------------------------- |
| Copy to clipboard | System clipboard   | Plain text           | `text.copyToClipboard`        |
| Paste to cursor   | Active application | Simulated Cmd/Ctrl+V | `text.writeToCursor` → Rust   |
| Simulate Enter    | Active application | Key event            | `text.simulateEnterKeystroke` |

### 2. Audio Outputs

| Output              | Destination     | Format     | Handler            |
| ------------------- | --------------- | ---------- | ------------------ |
| Sound effects       | Speaker         | WAV/MP3    | `PlaySoundService` |
| Recording export    | Download folder | Audio file | `DownloadService`  |
| Temp recording file | App data folder | WAV        | Rust `WavWriter`   |

### 3. External API Calls

#### Transcription APIs

| Provider           | Endpoint            | Format Sent           |
| ------------------ | ------------------- | --------------------- |
| OpenAI             | `api.openai.com`    | FormData (audio blob) |
| Groq               | `api.groq.com`      | FormData (audio blob) |
| Deepgram           | `api.deepgram.com`  | Audio blob            |
| ElevenLabs         | `api.elevenlabs.io` | FormData (audio blob) |
| Mistral            | `api.mistral.ai`    | FormData (audio blob) |
| speaches           | Custom URL          | FormData (audio blob) |
| Local (whispercpp) | Tauri command       | `Vec<u8>` audio bytes |
| Local (parakeet)   | Tauri command       | `Vec<u8>` audio bytes |
| Local (moonshine)  | Tauri command       | `Vec<u8>` audio bytes |

#### LLM/Transformation APIs

| Provider   | Endpoint                            | Format                   |
| ---------- | ----------------------------------- | ------------------------ |
| OpenAI     | `api.openai.com`                    | JSON (chat completion)   |
| Anthropic  | `api.anthropic.com`                 | JSON (messages)          |
| Google     | `generativelanguage.googleapis.com` | JSON                     |
| Groq       | `api.groq.com`                      | JSON (chat completion)   |
| OpenRouter | `openrouter.ai/api`                 | JSON (OpenAI-compatible) |
| Custom     | User-configured                     | JSON (OpenAI-compatible) |

### 4. Persistence

| Output               | Storage          | Format                           | Handler                |
| -------------------- | ---------------- | -------------------------------- | ---------------------- |
| Settings             | localStorage     | JSON (flat key-value)            | `createPersistedState` |
| Recordings (web)     | IndexedDB        | `{ recording, serializedAudio }` | `DbServiceWeb`         |
| Recordings (desktop) | SQLite + files   | Metadata + audio files           | `DbServiceDesktop`     |
| Transformations      | IndexedDB/SQLite | JSON objects                     | `db.transformations`   |
| Transformation runs  | IndexedDB/SQLite | JSON objects                     | `db.runs`              |
| Model cache          | App data dir     | Binary files                     | `ModelManager`         |

### 5. UI Feedback

| Output              | Destination                | Format                       | Handler                     |
| ------------------- | -------------------------- | ---------------------------- | --------------------------- |
| Toast notifications | Sonner library             | `UnifiedNotificationOptions` | `ToastService`              |
| OS notifications    | System notification center | Native notification          | `NotificationService`       |
| Status updates      | Loading toast              | `{ title, description }`     | Callback                    |
| Recording state     | Tray icon + UI             | Enum state                   | `recorder.getRecorderState` |
| Analytics events    | Aptabase                   | JSON events                  | `tauri-plugin-aptabase`     |

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INPUTS                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Microphone] ──┐                                                           │
│  [File Upload] ─┼──▶ [Audio Blob]                                           │
│  [VAD Trigger] ─┘                                                           │
│                                                                             │
│  [Keyboard Shortcut] ──▶ [Action Trigger]                                   │
│  [UI Click] ───────────▶ [Action Trigger]                                   │
│                                                                             │
│  [API Keys] ──────────▶ [Settings Store]                                    │
│  [Model Files] ───────▶ [Model Manager]                                     │
│  [Clipboard] ─────────▶ [Text for Transform]                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROCESSING                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Audio Blob] ──▶ [Optional Compress] ──▶ [Transcription] ──▶ [Text]        │
│                                                │                            │
│                                                ▼                            │
│                                    [Optional Transform] ──▶ [Final Text]    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OUTPUTS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Final Text] ──┬──▶ [Clipboard]                                            │
│                 ├──▶ [Paste to Cursor]                                      │
│                 └──▶ [Database (history)]                                   │
│                                                                             │
│  [Audio Blob] ──┬──▶ [Database (recording)]                                 │
│                 └──▶ [File Export]                                          │
│                                                                             │
│  [Status] ──────┬──▶ [Toast Notification]                                   │
│                 ├──▶ [Tray Icon]                                            │
│                 └──▶ [UI State]                                             │
│                                                                             │
│  [Analytics] ───────▶ [Aptabase]                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Observations for Actor Design

1. **Clear I/O boundaries exist** - Audio in, text out, with settings/storage as side channels

2. **Two main async pipelines:**
   - Recording → Transcription → Delivery
   - Clipboard → Transformation → Delivery

3. **Multiple audio source adapters** - Navigator, CPAL, FFmpeg, VAD all produce `Blob`

4. **Multiple transcription adapters** - 6 cloud + 3 local, all consume audio, produce text

5. **Multiple delivery adapters** - Clipboard, cursor paste, enter keystroke

6. **Persistence is a side effect** - Recordings saved to DB before transcription, not after

7. **No audio playback for transcripts** - Audio is stored but not played back synced to text

---

## Current Pipeline Order (as of 2026-01-26)

The current flow in `processRecordingPipeline()` is:

```
1. Stop recording → get Blob
2. Save to DB (blocking) ← POTENTIAL LATENCY
3. Show "Transcribing..." toast
4. Transcribe
5. Update DB with transcript
6. Deliver text
7. Optional: Transform → Deliver transformed
```

See: `src/lib/query/isomorphic/actions.ts:603-754`

---

## Streaming Transcription Provider Comparison

For future real-time transcription support, here's a comparison of streaming-capable providers:

### Cloud Streaming Providers

| Provider              | Streaming | Price/hr        | Languages          | Timestamps | Protocol       | Notes                                        |
| --------------------- | --------- | --------------- | ------------------ | ---------- | -------------- | -------------------------------------------- |
| **Deepgram**          | Yes       | $0.46           | 30+                | Word-level | WebSocket      | Best balance of price/features               |
| **AssemblyAI**        | Yes       | $0.65 streaming | 99+                | Word-level | WebSocket      | Best batch pricing ($0.15/hr)                |
| **Gradium**           | Yes       | $0.54-1.00      | 5 (en/fr/de/es/pt) | Word-level | WebSocket      | Semantic VAD, code-switching, integrated TTS |
| **Google Cloud**      | Yes       | Variable        | 125+               | Word-level | gRPC/WebSocket | Complex pricing                              |
| **Azure Speech**      | Yes       | $1.00           | 100+               | Word-level | WebSocket      | Enterprise-focused                           |
| **OpenAI Realtime**   | Yes       | $0.18-0.36      | ~50                | Word-level | WebSocket      | Newest, GPT-4o based                         |
| **ElevenLabs Scribe** | Yes       | $0.28+          | 90+                | Word-level | WebSocket      | 150ms latency, predictive transcription      |

### Browser/Local Options

| Provider               | Streaming | Price | Languages | Timestamps | Notes                               |
| ---------------------- | --------- | ----- | --------- | ---------- | ----------------------------------- |
| **Web Speech API**     | Yes       | Free  | Many      | **No**     | Browser-only, no timestamps         |
| **Vosk**               | Yes       | Free  | 20+       | Word-level | WASM available, true streaming      |
| **sherpa-onnx**        | Yes       | Free  | 20+       | Word-level | WASM + native, true streaming       |
| **Whisper.cpp stream** | Fake      | Free  | 99        | Word-level | Chunked batch with sliding window   |
| **WhisperLiveKit**     | Fake      | Free  | 99        | Word-level | Smart chunking with AlignAtt policy |

### Batch-Only (No Streaming)

| Provider           | Price/hr   | Languages | Notes                       |
| ------------------ | ---------- | --------- | --------------------------- |
| **Groq**           | $0.03-0.06 | 99        | Fastest batch, no streaming |
| **OpenAI Whisper** | $0.36      | 99        | Good accuracy, no streaming |

### Gradium Details

**Pricing (1 second STT = 3 credits):**

- Free: 3 hrs/month
- XS ($13/mo): 13 hrs ($1.00/hr)
- S ($43/mo): 50 hrs ($0.86/hr)
- M ($340/mo): 500 hrs ($0.68/hr)
- Pay-as-you-go: $5/100k credits (~$0.54/hr)

**Unique Features:**

- Semantic VAD (understands when speaker is "done thinking")
- Code switching (handles multilingual speakers)
- Controllable latency trade-off
- Same API for TTS (voice-to-voice agents)

**Limitations:**

- Only 5 languages (vs 30+ for Deepgram)
- Newer company, less proven at scale
- No free tier for commercial use

### sherpa-onnx Details

**Overview:** Open-source speech recognition toolkit from k2-fsa (Next-gen Kaldi). Supports true realtime streaming transcription with multiple deployment targets.

**Deployment Options:**

| Platform       | Method      | Model Loading           | Notes                                                      |
| -------------- | ----------- | ----------------------- | ---------------------------------------------------------- |
| Desktop (Rust) | sherpa-rs   | Bundled or downloaded   | Via [sherpa-rs](https://github.com/thewh1teagle/sherpa-rs) |
| Browser        | WASM        | Downloaded on first use | ~40-70MB depending on model                                |
| Mobile         | Native libs | Bundled                 | iOS/Android support                                        |

**Available Models (Streaming-capable):**

| Model               | Size   | Languages | Notes                      |
| ------------------- | ------ | --------- | -------------------------- |
| Zipformer-en-20M    | ~20MB  | English   | Smallest, fastest          |
| Moonshine Tiny      | ~30MB  | English   | Good accuracy/size balance |
| Zipformer-bilingual | ~70MB  | EN+ZH     | Multilingual               |
| Paraformer          | ~220MB | Chinese   | Best for Mandarin          |

**Key Features:**

- **True streaming:** Processes audio chunks as they arrive (not chunked batch)
- **VAD integration:** Built-in voice activity detection
- **Word-level timestamps:** Available on most models
- **Offline/private:** No cloud dependency, runs entirely local
- **Cross-platform:** Same models work on desktop, mobile, and web

**WASM Browser Support:**

- Working demos: https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-zh-en
- Requires downloading model on first use (~40-70MB)
- Uses WebAudio API for microphone access
- SharedArrayBuffer required (COOP/COEP headers needed)

**Rust Integration (sherpa-rs):**

- Maintained by thewh1teagle (Whispering contributor)
- Streaming support: [PR #124](https://github.com/thewh1teagle/sherpa-rs/pull/124) (pending merge)
- Current Whispering uses sherpa-rs for Moonshine/Parakeet batch transcription

**Relevance to Whispering:**

1. **Desktop zero-config:** Bundle Moonshine Tiny (~30MB) for out-of-box local transcription
2. **Web local transcription:** WASM enables offline transcription in browser (not currently implemented)
3. **True streaming:** Could enable live captions/subtitles feature
4. **Privacy:** Complete offline operation, no API keys needed

### ElevenLabs Scribe v2 Realtime Details

**Overview:** ElevenLabs' newest streaming STT model, purpose-built for conversational AI and voice agents with ultra-low latency.

**Pricing:**

- $0.28/hour on annual Business plans
- Higher rates on pay-as-you-go (pricing not publicly listed)
- Part of ElevenLabs subscription tiers

**Key Features:**

| Feature       | Details                           |
| ------------- | --------------------------------- |
| Latency       | ~150ms end-to-end                 |
| Languages     | 90+ with diverse accent support   |
| Timestamps    | Word-level                        |
| Protocol      | WebSocket (streaming) or REST API |
| Audio formats | PCM (8-48 kHz), μ-law encoding    |
| VAD           | Built-in voice activity detection |

**Unique Capabilities:**

- **Predictive transcription:** Anticipates probable next words for lower latency
- **Text conditioning:** Seamless continuation after connection resets
- **Complex vocabulary:** Built-in support for technical terms, medications, proper nouns
- **Manual commit control:** Developer control over when to finalize transcripts

**Accuracy Benchmarks (per ElevenLabs):**

| Model              | Accuracy |
| ------------------ | -------- |
| Scribe v2 Realtime | ~95%     |
| Gemini Flash 2.5   | ~90%     |
| GPT-4o Mini        | ~85%     |
| Deepgram Nova 3    | ~80%     |

_Note: These are ElevenLabs' own benchmarks; independent verification recommended._

**Limitations:**

- No speaker diarization (especially problematic for non-English)
- No dual channel support
- Concurrency limit: 30+ for enterprise only
- Pricing less transparent than competitors

**Integration:**

- WebSocket API for streaming
- REST API for batch
- Integrated with ElevenLabs Agents platform
- Docs: https://elevenlabs.io/docs/overview/capabilities/speech-to-text

**Relevance to Whispering:**

- Whispering already supports ElevenLabs for batch transcription
- Could add streaming support for real-time use cases
- Higher price point than Deepgram ($0.28 vs $0.46/hr) but claims better accuracy
- Good fit if already using ElevenLabs for TTS

### Recommendation for Whispering

**Primary:** Deepgram - best price/features balance, proven reliability
**Alternative:** AssemblyAI - if batch pricing is priority
**Future consideration:** Gradium - if TTS integration needed
**Local/Privacy:** sherpa-onnx - best path for zero-config offline transcription on both desktop and web
