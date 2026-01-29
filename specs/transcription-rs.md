# transcription-rs API Design

## Overview

Batch transcription completes in a single call: audio in, text out. Although the results are similar, streaming transcription required a new architecture—essentially many small batch transcriptions with interim results.

For consistency, a new batch transcription API was created next to the streaming API. It returns `Vec<Transcript>` instead of a single result with nested segments. Additionally, the batch API was improved with borrowed `&[f32]` and richer metadata. The old crate became a thin deprecated wrapper of the new API.

### Crate Strategy

| Crate                  | Status     | Purpose                                                    |
| ---------------------- | ---------- | ---------------------------------------------------------- |
| **`transcription-rs`** | New        | Rich API with streaming support, `Transcript` type         |
| **`transcribe-rs`**    | Deprecated | Thin wrapper, transforms to old `TranscriptionResult` type |

<details>
<summary>Migration path</summary>

```toml
# Old
[dependencies]
transcribe-rs = "0.2"  # now wraps transcription-rs

# New (recommended)
[dependencies]
transcription-rs = "0.1"
```

The new crate introduces `Transcript`; the deprecated crate keeps `TranscriptionResult` for backward compatibility:

| Crate              | Type                  |
| ------------------ | --------------------- |
| `transcription-rs` | `Transcript`          |
| `transcribe-rs`    | `TranscriptionResult` |

</details>

## Data Types

Both API layers return the same `Transcript` type: text, timing, confidence, finality flags (`is_final`, `is_endpoint`, `segment_id`), and optional word-level detail. A `Word` struct provides per-word timing and confidence.

<details>
<summary>Struct definitions</summary>

```rust
pub struct Transcript {
    pub text: String,

    // Result-level finality
    pub is_final: bool,               // this result won't be revised
    pub is_endpoint: bool,            // natural speech boundary detected (silence/pause)
    pub segment_id: u32,              // increments on endpoint, correlates partials

    // Timing
    pub start: Option<f32>,           // utterance start time (seconds)
    pub end: Option<f32>,             // utterance end time (seconds)

    // Metadata
    pub confidence: Option<f32>,      // overall confidence score
    pub language: Option<String>,     // detected/specified language

    // Word-level detail
    pub words: Option<Vec<Word>>,

    // Escape hatch
    pub raw: Option<serde_json::Value>, // full backend response for debugging
}

pub struct Word {
    pub text: String,
    pub start: f32,
    pub end: f32,
    pub confidence: Option<f32>,      // 0.0-1.0, model certainty / stability
}
```

</details>

<details>
<summary>Design notes</summary>

- `is_final` - "this result text won't be revised" (matches Deepgram/AWS `IsPartial: false`). Use for UI display decisions.
- `is_endpoint` - "speaker paused/stopped, segment complete" (matches Deepgram `speech_final`, sherpa `is_endpoint()`). Use to trigger `reset()`.
- After `input_finished()`, drain until `is_ready()` returns false. `get_result()` returns `None` when no result is available.
- `segment_id` correlates partial updates with their final result
- `words` replaces both `tokens` and `timestamps` arrays - richer, aligned with cloud APIs
- `confidence` at word level: serves as both model certainty and stability indicator. Backends with boolean `Stable` map to `1.0`/`0.5`
- `raw` preserves full backend response for debugging or accessing niche fields
- Batch API returns this type (with `is_final: true`, `is_endpoint: true` always)

</details>

## API Layers

Choose one:

- **[High Level](#high-level-callback-based-engine):** Push audio, receive callbacks. Library manages threading.
- **[Low Level](#low-level-streamingdecoder-trait):** Pull-based decode loop. Consumer has full control.

| Use Case                      | Layer | Why                             |
| ----------------------------- | ----- | ------------------------------- |
| Tauri app, simple integration | High  | No threading concerns           |
| Custom buffering/timing       | Low   | Full control over decode loop   |
| WebSocket server              | Low   | Need to manage multiple streams |
| Testing/debugging             | Low   | Inspect each decode step        |

### High Level: Callback-Based Engine

Library owns threading. Consumer just pushes audio and receives callbacks.

```rust
impl Engine {
    pub fn new(config: Config) -> Result<Self, Error>;

    pub fn start_listening<F>(&self, callback: F) -> Result<(), Error>
    where
        F: Fn(Result<Transcript, Error>) -> Result<(), Error> + Send + 'static;

    pub fn push_audio(&self, samples: &[f32]);

    pub fn stop_listening(&self) -> Result<(), Error>;
}
```

#### Usage (Tauri)

```rust
let engine = transcription_rs::Engine::new(config)?;

engine.start_listening(|result| {
    match result {
        Ok(r) if r.is_final => app.emit("final", &r)?,
        Ok(r) => app.emit("partial", &r.text)?,
        Err(e) => app.emit("error", e.to_string())?,
    }
    Ok(())  // return Err to stop listening
})?;

// Called from Tauri's cpal audio callback
engine.push_audio(&samples);

// When done
engine.stop_listening()?;
```

<details>
<summary>Internal implementation</summary>

High level is built on low level:

```rust
impl Engine {
    pub fn start_listening<F>(&self, callback: F) -> Result<(), Error>
    where
        F: Fn(Result<Transcript, Error>) -> Result<(), Error> + Send + 'static
    {
        let (audio_tx, audio_rx) = channel();
        let (result_tx, result_rx) = channel();

        // Decode thread - uses low-level API
        let mut decoder = self.create_decoder()?;
        thread::spawn(move || {
            loop {
                let samples: Vec<f32> = match audio_rx.recv() {
                    Ok(s) => s,
                    Err(_) => {
                        // Channel closed - flush remaining audio
                        decoder.input_finished();
                        for result in drain_results(&mut decoder) {
                            let _ = result_tx.send(Ok(result));
                        }
                        break;
                    }
                };

                decoder.accept_waveform(&samples);

                // Drain all results, send each to callback thread
                while decoder.is_ready() {
                    if let Err(e) = decoder.decode() {
                        let _ = result_tx.send(Err(e));
                        break;
                    }
                    if let Some(result) = decoder.get_result() {
                        if result_tx.send(Ok(result)).is_err() {
                            break;
                        }
                    }
                }
                // Reset after segment boundary (not inside drain loop)
                if decoder.is_endpoint() {
                    decoder.reset();
                }
            }
        });

        // Callback thread
        thread::spawn(move || {
            for result in result_rx {
                if callback(result).is_err() {
                    break;
                }
            }
        });

        *self.audio_tx.lock().unwrap() = Some(audio_tx);  // audio_tx: Mutex<Option<Sender>>
        Ok(())
    }
}
```

**Thread Model:**

```
CONSUMER THREAD                 transcription-rs INTERNAL THREADS

┌──────────────────┐           ┌──────────────────┐    ┌──────────────────┐
│ cpal callback    │           │ Decode Thread    │    │ Callback Thread  │
│                  │           │                  │    │                  │
│ engine           │   chan    │ accept_waveform  │chan│ loop {           │
│  .push_audio() ─────────────▶│ drain_results() ─────▶│   callback(r)   │
│                  │           │ for each result  │    │ }                │
└──────────────────┘           └──────────────────┘    └──────────────────┘
                                                              │
                                                              ▼
                                                        app.emit()
```

</details>

### Low Level: StreamingDecoder Trait

Mirrors sherpa-onnx's actual API. Full control, consumer manages the decode loop.

```rust
pub trait StreamingDecoder {
    fn accept_waveform(&mut self, samples: &[f32]);
    fn input_finished(&mut self);  // signal end of stream, flush remaining frames
    fn is_ready(&self) -> bool;
    fn decode(&mut self) -> Result<(), Error>;
    fn get_result(&self) -> Option<Transcript>;
    fn is_endpoint(&self) -> bool;
    fn reset(&mut self);
}
```

#### Usage

```rust
let mut decoder = SherpaDecoder::new(config)?;

loop {
    let samples = mic.read_chunk();
    decoder.accept_waveform(&samples);

    for result in drain_results(&mut decoder) {
        if result.is_final {
            println!("Final: {}", result.text);
        } else {
            print!("\rPartial: {}", result.text);
        }
    }
    // Reset after segment boundary (not inside drain loop)
    if decoder.is_endpoint() {
        decoder.reset();
    }

    if user_stopped() {
        break;
    }
}

// Signal end of stream, flush remaining audio
decoder.input_finished();
for result in drain_results(&mut decoder) {
    println!("{}", result.text);
}
```

<details>
<summary>Convenience helpers</summary>

```rust
/// Drain all pending results from decoder (runs decode loop internally)
pub fn drain_results(decoder: &mut impl StreamingDecoder) -> Vec<Transcript> {
    let mut results = vec![];
    while decoder.is_ready() {
        if decoder.decode().is_err() {
            break;
        }
        if let Some(result) = decoder.get_result() {
            results.push(result);
        }
    }
    results
}

/// Concatenate transcript text with spaces
pub fn joined_text(transcripts: &[Transcript]) -> String {
    transcripts.iter().map(|t| t.text.as_str()).collect::<Vec<_>>().join(" ")
}
```

`joined_text` replaces the old `TranscriptionResult.text` field. Also useful for streaming—accumulate transcripts and call `joined_text` to get the full text so far.

</details>

### FAQ

<details>
<summary>How does a consumer switch between online, sentence, or simulated streaming?</summary>

By choosing a backend. The streaming strategy is an implementation detail—all backends expose the same `StreamingDecoder` trait, so usage code is identical:

```rust
let engine = Engine::new(config)?;  // backend choice determines strategy
engine.start_listening(callback)?;
engine.push_audio(&samples);
```

| Strategy                                          | Implementation                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Online streaming** (Sherpa/NeMo)                | Implements `StreamingDecoder` directly                                          |
| **Sentence-based** (VAD)                          | Wrapper buffers until VAD signals end of speech, then calls batch transcription |
| **Simulated streaming** (streaming-whisper style) | Wrapper with sliding window, returns partials via `StreamingDecoder`            |

</details>

<details>
<summary>Why a low-level API?</summary>

One `accept_waveform` call can trigger **0, 1, or many** decode steps:

```rust
stream.accept_waveform(&samples);  // buffer audio

while stream.is_ready() {          // may loop 0+ times
    stream.decode()?;              // each call may update result
    if let Some(result) = stream.get_result() {
        // Handle intermediate result...
    }
}
```

If we hide this loop and only return one result, **intermediate partials are lost**.

</details>

<details>
<summary>Why <code>Fn</code> not <code>FnMut</code> for callbacks?</summary>

`Fn` means the callback cannot mutate captured state. This works for forwarding (e.g., `app.emit()`). To accumulate results, use `Mutex<Vec<_>>` or a channel.

</details>

<details>
<summary>What's the difference between <code>is_final</code> and <code>is_endpoint</code>?</summary>

- `is_final` — "this text won't be revised". Use for UI display decisions (show as committed text).
- `is_endpoint` — "speaker paused/stopped, segment complete". Use to trigger `reset()`.

A result can be `is_final` without being `is_endpoint` (text is stable but speaker hasn't paused yet).

</details>

<details>
<summary>How do errors propagate?</summary>

| Error Source      | High Level                         | Low Level                            |
| ----------------- | ---------------------------------- | ------------------------------------ |
| Decode fails      | Sent as `Err(e)` to callback       | Returns error from `decode()`        |
| Consumer error    | Callback returns `Err`, loop stops | Consumer handles directly            |
| End of stream     | `stop_listening()` signals end     | Consumer calls `input_finished()`    |
| Endpoint detected | Auto-reset after drain             | Consumer calls `reset()` after drain |

</details>

### Reference

<details>
<summary>API Survey</summary>

| API            | Result Finality          | Endpoint Detection             | Word Confidence/Stability       |
| -------------- | ------------------------ | ------------------------------ | ------------------------------- |
| sherpa-onnx    | N/A                      | `is_endpoint()`                | N/A                             |
| ElevenLabs     | `partial` vs `committed` | `commit_strategy` (VAD/manual) | `logprob`                       |
| AWS Transcribe | `IsPartial: bool`        | natural segments               | `Stable: bool` → map to 1.0/0.5 |
| AssemblyAI     | `end_of_turn: bool`      | turn-based                     | N/A                             |
| Deepgram       | `is_final: bool`         | `speech_final: bool`           | `confidence`                    |
| Google Cloud   | interim vs final         | natural pauses                 | `stability` score               |

</details>

<details>
<summary>Batch API Comparison</summary>

**`transcription-rs`** (new crate):

```rust
// Borrows samples, returns flat list of Transcript
fn transcribe_samples(&mut self, samples: &[f32], ...) -> Result<Vec<Transcript>, Error>;
fn transcribe_file(&mut self, path: &Path, ...) -> Result<Vec<Transcript>, Error>;
```

**`transcribe-rs`** (deprecated wrapper):

```rust
// Old signature preserved - wraps transcription-rs internally
fn transcribe_samples(&mut self, samples: Vec<f32>, ...) -> Result<TranscriptionResult, Error>;
fn transcribe_file(&mut self, path: &Path, ...) -> Result<TranscriptionResult, Error>;
```

| Aspect        | `transcription-rs` | `transcribe-rs` (wrapper)                    |
| ------------- | ------------------ | -------------------------------------------- |
| Samples param | `&[f32]` (borrow)  | `Vec<f32>` (owned)                           |
| Return type   | `Vec<Transcript>`  | `TranscriptionResult` with nested `segments` |
| Streaming     | Full support       | Not exposed                                  |

</details>

<details>
<summary>Wrapper Implementation</summary>

`transcribe-rs` internally depends on `transcription-rs` and transforms types:

```rust
// transcribe-rs/Cargo.toml
[dependencies]
transcription-rs = "0.1"

// transcribe-rs/src/lib.rs
use transcription_rs::Transcript;

pub struct TranscriptionResult {
    pub text: String,
    pub segments: Option<Vec<TranscriptionSegment>>,
}

pub struct TranscriptionSegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
}

impl TranscriptionEngine for WhisperEngine {
    fn transcribe_samples(&mut self, samples: Vec<f32>, params: Option<Self::InferenceParams>)
        -> Result<TranscriptionResult, Box<dyn std::error::Error>>
    {
        // Delegate to new crate
        let transcripts = transcription_rs::TranscriptionEngine::transcribe_samples(
            self, &samples, params
        )?;

        // Transform to old type
        Ok(TranscriptionResult {
            text: transcripts.iter().map(|t| t.text.as_str()).collect::<Vec<_>>().join(" "),
            segments: Some(transcripts.into_iter().map(|t| TranscriptionSegment {
                start: t.start.unwrap_or(0.0),
                end: t.end.unwrap_or(0.0),
                text: t.text,
            }).collect()),
        })
    }
}
```

</details>
