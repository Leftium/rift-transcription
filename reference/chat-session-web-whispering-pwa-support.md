# Chat Session: Web Whispering PWA Support

**Session ID**: `ses_4068eb96effe6WS54EYnr0ZiIz`
**Date**: January 26, 2026
**Source**: epicenter project (OpenCode)

---

## Summary

Massive 159-turn session that started with "does Whispering web support PWA?" and evolved through Web Speech API feasibility, Vosk WASM analysis, streaming transcription API comparison (7+ APIs), push vs pull architecture debate, and culminated in designing the `StreamingTranscriptionEngine` trait for transcribe-rs with a `flush()` method. This session predates and feeds into the January 28 architecture session (`ses_3fb00b81`).

**Key outcomes:**

- Web Speech API identified as best zero-config default (no API key, no model download)
- Sherpa-ONNX discovered as superior to Vosk for browser WASM (10k stars, active, true streaming)
- Pull-based interface chosen over push (matches local APIs + actor model internals)
- Final streaming API: 2 methods (`transcribe_stream` + `flush`) with `StreamingResult` return type
- `flush()` method invented to handle end-of-stream buffered audio (improvement over Sherpa-ONNX's own API)

---

## Part 1: PWA Feasibility Assessment

### User

> Does the web version of whispering support PWA?

### Assistant

**No.** No manifest, no service worker, no PWA deps. Uses `@sveltejs/adapter-static` deployed to Cloudflare via Wrangler.

### User

> How much of whispering web can work without a network connection?

### Assistant

| Works Offline Now                                 | Requires Network                  |
| ------------------------------------------------- | --------------------------------- |
| Audio recording (MediaRecorder)                   | All transcription (cloud only)    |
| Data storage (IndexedDB/Dexie)                    | Text transformations (cloud LLMs) |
| Settings (localStorage)                           | Analytics (Aptabase)              |
| Sound effects, clipboard, notifications, playback |                                   |

**Bottom line:** PWA gives app-like experience + faster loading, but core value (transcription) still requires network. Offline benefit = review past transcriptions + record audio for later.

**Recommendation:** `@vite-pwa/sveltekit` over `vite-plugin-pwa` (SvelteKit-aware, handles routing/adapter/build automatically). `display: standalone` removes browser chrome. No significant permissions-based benefits for PWA vs regular web -- main benefit is **user psychology** (installed app feels more trustworthy).

---

## Part 2: Web Speech API as Zero-Config Default

### User

> How difficult would it be to add Web Speech API to whispering? The Web Speech API would enable transcription right after install on the desktop version, too, right? No need to configure API key or download model?

### Assistant

**Difficulty: Easy-Medium** (~1 day). New service file (~50-80 lines), registry update, switch case.

**Key architectural mismatch:** Web Speech API is **real-time streaming** (event-driven, mic-only); current Whispering is **batch** (`transcribe(audioBlob) -> Promise<Result<string>>`). Two approaches: (A) Real-time (medium-hard, refactor recording flow, better UX) or (B) Batch simulation (easy, hacky).

**Works in Tauri WebViews** -- WebView2 (Windows full), WebKit (macOS partial/prefix), WebKitGTK (Linux often unavailable).

|          | Web Speech API             | Cloud APIs             | Local Models        |
| -------- | -------------------------- | ---------------------- | ------------------- |
| Setup    | None                       | API key                | Download model      |
| Cost     | Free                       | Pay per use            | Free after download |
| Accuracy | Good                       | Excellent              | Excellent           |
| Offline  | No\*                       | No                     | Yes                 |
| Privacy  | Audio sent to Google/Apple | Audio sent to provider | Fully local         |

**Suggestion:** Make Web Speech API the **default** transcription service for zero-config onboarding.

---

## Part 3: Platform Support Matrix

### User

> Explain why Tauri support only full for Windows. What does the mobile landscape look like?

### Assistant

WebView2 (Windows) = full Chromium engine. WebKit (macOS) = partial, prefix needed. WebKitGTK (Linux) = often not implemented.

| Platform            | Web Speech API    | UX            |
| ------------------- | ----------------- | ------------- |
| Desktop Chrome/Edge | Full              | Great         |
| Desktop Safari      | Partial (prefix)  | Good          |
| Desktop Firefox     | Behind flag       | Degraded      |
| Tauri Windows       | Full              | Great         |
| Tauri macOS         | Partial (prefix)  | Good          |
| Tauri Linux         | Often unavailable | Degraded/None |
| iOS (all browsers)  | Yes (prefix)      | Good          |
| Android Chrome      | Full              | Great         |
| Android Firefox     | No                | None          |

**Coverage estimate:** Desktop ~85-90%, Mobile ~90-95%. Main gaps: Linux (Tauri) and Firefox Android.

**Three implementation challenges identified:**

1. **Mic-only API** -- can't feed audio blobs
2. **Real-time streaming** -- event-driven vs batch architecture mismatch
3. **Fallback UX** -- detection and graceful degradation for unsupported platforms

---

## Part 4: Vosk WASM & Bundling Analysis

### User

> How much would Vosk WASM bloat app size? Would model still need to be downloaded separately?

### Assistant

| Component           | Size                       |
| ------------------- | -------------------------- |
| Vosk WASM runtime   | ~5 MB                      |
| English small model | ~40 MB (separate download) |
| English big model   | ~1.8 GB                    |

**Cloudflare Pages has 25 MB per-file limit** -- can't bundle 40 MB model as static asset. Must use R2/CDN.

**`processLocally`** (Chrome 139+ desktop only): Still requires 50-200MB language pack download, still mic-only, ~24% global coverage. Only works on Windows in Tauri (WebView2).

**Key insight:** "There's no free lunch for offline speech recognition" -- all local options require model download. Web Speech API is the only true zero-config option.

### User

> I think speech api with zero config would be best UX. Keep models outside release.

### Assistant

**Recommended tiered UX:**

```
First Launch: "Ready to transcribe!" (Web Speech API, just works)
Settings -> Transcription:
  o Browser (online)         <- default, zero config
  o Browser (offline)        - Download 50 MB language pack
  o Vosk (offline)           - Download 40 MB model
  o Groq                     - Enter API key
  o OpenAI                   - Enter API key
```

---

## Part 5: Streaming API Comparison -- Discovery of Sherpa-ONNX

### User

> Do the APIs mentioned here support true streaming transcription? Let's take a look at Sherpa-ONNX and NeMo Parakeet Streaming APIs.

### Assistant

**True Streaming vs Chunked:**

| Type                            | Latency    | Examples                                 |
| ------------------------------- | ---------- | ---------------------------------------- |
| True Streaming (frame-by-frame) | ~100-200ms | Zipformer, NeMo Parakeet, Web Speech API |
| Chunked (30s buffers)           | ~seconds   | Whisper, most batch models               |

**Sherpa-ONNX discovered as strong candidate** -- 10k stars, true streaming, WASM support, 12 programming languages, active development. Vosk browser wrapper: 500 stars, 3 years stale.

**API architecture patterns:**

| Aspect       | Web Speech API | Vosk              | Sherpa-ONNX                      |
| ------------ | -------------- | ----------------- | -------------------------------- |
| Architecture | Push (events)  | Push (events)     | Pull (polling + explicit decode) |
| Audio Input  | Implicit (mic) | Explicit (buffer) | Explicit (buffer)                |
| Results      | Push (events)  | Push (events)     | Pull (getResult)                 |

**Vosk correction:** Vosk's **native** C API is actually pull-based (`AcceptWaveform` returns bool, then pull `Result()`); the JS wrapper adds event emitters on top.

---

## Part 6: Push vs Pull Survey

### User

> Are most real-time streaming transcription APIs push or pull? Costs of adapting push to pull and vice versa?

### Assistant

| Category        | Pull                                                                               | Push                                                             |
| --------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Local/Native    | **7** (Sherpa-ONNX, whisper.cpp, NeMo, Vosk native, DeepSpeech, Coqui, WhisperKit) | 2 (Web Speech, Vosk JS)                                          |
| Cloud/WebSocket | 0                                                                                  | **7** (Deepgram, AssemblyAI, Google, AWS, Azure, OpenAI, Rev.ai) |

**Why the split:** Local APIs prefer pull (caller controls CPU/GPU). Cloud APIs prefer push (WebSocket/gRPC naturally event-driven, server controls timing).

| Direction    | Complexity | Memory      |
| ------------ | ---------- | ----------- |
| Push -> Pull | Medium     | O(n) buffer |
| Pull -> Push | **Low**    | O(1)        |

**Decision:** Use **Pull as the native interface** (matches existing Whispering batch architecture + most local APIs). Wrap Web Speech API with push->pull adapter.

### User

> I thought push would fit actor model better because actor model itself is push/event-based. How come I was wrong?

### Assistant

**Critical insight -- Push between actors, pull from dependencies within actors:**

| Boundary                    | Pattern                    | Why                          |
| --------------------------- | -------------------------- | ---------------------------- |
| Between actors              | Push (messages in mailbox) | Decoupling, async, isolation |
| Inside actor (dependencies) | Pull                       | Actor controls timing        |

Push callbacks inside an actor break sequential mailbox processing, create race conditions, and remove backpressure. Pull inside actors preserves sequential processing and lets the actor control when work happens.

**Analogy:** Like HTTP request (push) -> server handler -> database query (pull). You wouldn't want the database pushing results at random times.

---

## Part 7: StreamingTranscriber Trait Design for transcribe-rs

### User

> Let's draft a concise reply to the [transcribe-rs streaming API issue](https://github.com/cjpais/transcribe-rs/issues/4).

### Assistant

**New `StreamingTranscriptionEngine` trait alongside existing batch `TranscriptionEngine`:**

Three modes all fit one interface:

- **Native streaming** (Zipformer): model maintains state internally
- **Sentence-based** (VAD-chunked): VAD triggers decode at phrase boundaries
- **Buffered streaming** (simulated): library handles chunking/overlap internally

**Trait evolution through the conversation:**

1. **Initial (Sherpa-ONNX mirror, 6 methods):**

```rust
pub trait StreamingTranscriptionEngine {
    fn accept_samples(&mut self, samples: &[f32]);
    fn is_ready(&self) -> bool;
    fn decode(&mut self);
    fn get_result(&self) -> Option<TranscriptionResult>;
    fn is_endpoint(&self) -> bool;
    fn reset(&mut self);
}
```

2. **Simplified (4 methods)** -- `is_ready`/`decode` removed because only Sherpa-ONNX benefits from that granularity:

```rust
pub trait StreamingTranscriptionEngine {
    fn accept_samples(&mut self, samples: &[f32]);
    fn get_result(&self) -> Option<TranscriptionResult>;
    fn is_endpoint(&self) -> bool;
    fn reset(&mut self);
}
```

3. **Further simplified (1 method)** -- everything collapsed:

```rust
pub trait StreamingTranscriptionEngine {
    fn transcribe_stream(&mut self, samples: &[f32]) -> StreamingResult;
}
```

---

## Part 8: TranscriptionResult Type Design

### User

> How do we handle the fact APIs all return different types of results?

### Assistant

**Result type field survey:**

| API         | text | timestamps | confidence | words | language | speaker | alternatives |
| ----------- | ---- | ---------- | ---------- | ----- | -------- | ------- | ------------ |
| Whisper     | Y    | Y          | -          | Y     | Y        | -       | -            |
| Vosk        | Y    | Y          | Y          | Y     | -        | Y       | Y            |
| Sherpa-ONNX | Y    | Y          | Y          | Y     | Y        | Y       | -            |
| Deepgram    | Y    | Y          | Y          | Y     | Y        | Y       | -            |
| Web Speech  | Y    | -          | Y          | -     | Y        | -       | Y            |

**Decision: Common core + raw escape hatch (Option 3):**

```rust
pub struct TranscriptionResult {
    pub text: String,
    pub is_final: bool,
    pub start: Option<f32>,
    pub end: Option<f32>,
    pub confidence: Option<f32>,
    pub language: Option<String>,
    pub speaker: Option<String>,
    pub words: Option<Vec<Word>>,
    pub raw: Option<serde_json::Value>,  // escape hatch for API-specific data
}
```

**Key decisions:**

- All fields `Option` except `text` and `is_final` (Web Speech lacks timestamps, etc.)
- `is_final: false` = partial (may change), `is_final: true` = complete utterance (stable)
- `raw` = latest API response only (most APIs send cumulative partials anyway)
- Streaming result is **superset** of batch (adds `is_final`)

**Word/Utterance/Segment terminology:**

| Level     | What it represents                                 | Typical duration |
| --------- | -------------------------------------------------- | ---------------- |
| Word      | Single word                                        | 0.1-1s           |
| Utterance | Continuous speech until pause/speaker change       | 1-30s            |
| Segment   | Model-dependent chunk (e.g., Whisper's 30s window) | varies           |

APIs use these inconsistently. Decision: `TranscriptionResult` = one utterance. No accumulation in engine -- caller collects `Vec<TranscriptionResult>`.

---

## Part 9: The flush() Debate

### User

> If transcribe_stream did not return results, the only way to get results is to feed it more samples? Perhaps better to split transcribe_stream into multiple functions?

### Assistant

**The problem:** Without flush, if the user stops mid-utterance, buffered audio has no way to produce a final result. This affects ALL pull-based APIs -- even Sherpa-ONNX has no flush method (their examples just run until Ctrl+C).

**Options explored:**

| Approach            | Pros            | Cons                      |
| ------------------- | --------------- | ------------------------- |
| Empty slice = flush | One method      | Magic behavior, ambiguous |
| Separate `flush()`  | Explicit intent | Extra method              |
| Auto-reset only     | Simplest        | Loses buffered audio      |

### User

> What if flush returns the final result itself? Can fit on one line?

### Assistant

Yes -- both methods return `StreamingResult`, enabling uniform handling:

```rust
let result = if done { engine.flush() } else { engine.transcribe_stream(&mic.read_chunk()) };
```

---

## Part 10: Final API Design

**Final trait (2 methods):**

```rust
pub trait StreamingTranscriptionEngine {
    /// Feed audio samples from a stream, returns current transcription state.
    fn transcribe_stream(&mut self, samples: &[f32]) -> StreamingResult;

    /// Signal end of stream, returns final result for any buffered audio.
    fn flush(&mut self) -> StreamingResult;
}

pub struct StreamingResult {
    pub transcription: TranscriptionResult,
    pub is_endpoint: bool,
    pub samples: Vec<f32>,  // accumulated audio for utterance, populated at endpoint
}
```

**Final usage example:**

```rust
let mut engine = SherpaOnnxStreamingEngine::new(config)?;
let mut all_samples: Vec<f32> = vec![];
let mut utterances: Vec<TranscriptionResult> = vec![];

loop {
    let done = user_stopped();
    let result = if done {
        engine.flush()
    } else {
        engine.transcribe_stream(&mic.read_chunk())
    };

    print!("\r{}", result.transcription.text);  // live partial display

    if result.is_endpoint {
        println!();  // finalize line
        all_samples.extend(&result.samples);  // accumulate audio
        utterances.push(result.transcription);  // collect utterance
    }

    if done { break; }
}

// At end: all_samples has full audio, utterances has all transcriptions
// Timestamps are 0-based per utterance; caller offsets to session-relative
let offset_secs = all_samples.len() as f32 / 16000.0;
```

**Key design insight:** `flush()` is an **improvement over Sherpa-ONNX's original API** -- explicit way to finalize without feeding fake silence. The original API also suffers from this problem but doesn't address it.

---

## Part 11: Session Model & Audio Persistence

### User

> Whispering also needs to persist the streamed audio. Timestamps should be relative to the persisted audio?

### Assistant

**Audio persistence approach:** Stream-first, reconstruct file from accumulated samples (guarantees timestamp alignment). `samples: Vec<f32>` in `StreamingResult` -- engine accumulates internally, returns on endpoint for guaranteed sync.

### User

> I want to shift to a new paradigm where the basic unit is not per-utterance but rather a "session" that could have multiple utterances.

### Assistant

**Session model is app-layer concern**, not transcription engine concern. The streaming API stays utterance-focused; the session layer above collects utterances:

```
[session start]
  |-- utterance 1 (VAD)
  |-- manual typing
  |-- utterance 2 (VAD)        -> unified transcript + combined audio
  |-- paste from clipboard
  |-- audio file dropped
[session end]
```

---

## Part 12: Breaking Changes Identified for transcribe-rs

1. **`transcribe_samples` signature**: `Vec<f32>` -> `&[f32]` -- allows passing slices without forced ownership transfer (trivial fix for callers)
2. **`transcribe_samples` return type**: `TranscriptionResult` -> `Vec<TranscriptionResult>` -- removes segments nesting, cleaner but breaking
3. **New streaming trait** added alongside existing batch trait -- same engine struct implements both

---

## Key Links & References

- [transcribe-rs streaming API issue](https://github.com/cjpais/transcribe-rs/issues/4)
- [@vite-pwa/sveltekit](https://vite-pwa-org.netlify.app/frameworks/sveltekit.html)
- [Web Speech API MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- Sherpa-ONNX: 10k+ GitHub stars, WASM support, Zipformer models
- Vosk browser: ~500 stars, 3 years stale
- Epicenter Plugin Architecture spec: `specs/20260122T013555-epicenter-plugin-architecture-feasibility.md`

## Key Numbers

| Metric                               | Value                         |
| ------------------------------------ | ----------------------------- |
| Vosk WASM runtime                    | ~5 MB                         |
| Vosk small English model             | ~40 MB                        |
| Cloudflare Pages file limit          | 25 MB                         |
| Web Speech API coverage (cloud)      | ~85-95%                       |
| Web Speech `processLocally` coverage | ~24%                          |
| Web Speech API integration estimate  | ~1 day                        |
| Session message count                | 410 (161 user, 249 assistant) |
