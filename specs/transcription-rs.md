# transcription-rs API Design

## Overview

A new crate (`transcription-rs`) with a layered API design that exposes low-level control while providing high-level convenience. The existing `transcribe-rs` crate becomes a thin deprecated wrapper for backward compatibility.

### Crate Strategy

| Crate                  | Status     | Purpose                                                    |
| ---------------------- | ---------- | ---------------------------------------------------------- |
| **`transcription-rs`** | New        | Rich API with streaming support, `Transcript` type         |
| **`transcribe-rs`**    | Deprecated | Thin wrapper, transforms to old `TranscriptionResult` type |

**Migration path:**

```toml
# Old
[dependencies]
transcribe-rs = "0.2"  # now wraps transcription-rs

# New (recommended)
[dependencies]
transcription-rs = "0.1"
```

Consumers choose their level of abstraction within `transcription-rs`.

## API Layers

```
┌─────────────────────────────────────────────────────────────┐
│ HIGH LEVEL - Callback-based (library owns threads)          │
│ Engine::start_listening(callback) / push_audio / stop       │
├─────────────────────────────────────────────────────────────┤
│ LOW LEVEL - Pull-based (consumer owns loop)                 │
│ StreamingDecoder trait + drain_results() helper             │
├─────────────────────────────────────────────────────────────┤
│ sherpa-onnx / other backends                                │
└─────────────────────────────────────────────────────────────┘
```

## Data Types (Shared Across All Layers)

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

### Design Notes

- `is_final` - "this result text won't be revised" (matches Deepgram/AWS `IsPartial: false`)
- `is_endpoint` - "speaker paused/stopped, segment complete" (matches Deepgram `speech_final`, sherpa `is_endpoint()`)
- `segment_id` correlates partial updates with their final result
- `words` replaces both `tokens` and `timestamps` arrays - richer, aligned with cloud APIs
- `confidence` at word level: serves as both model certainty and stability indicator. Backends with boolean `Stable` map to `1.0`/`0.5`
- `raw` preserves full backend response for debugging or accessing niche fields
- Batch API should also return this type (with `is_final: true`, `is_endpoint: true` always)

### Type Naming Strategy

| Crate              | Type                  | Notes                                          |
| ------------------ | --------------------- | ---------------------------------------------- |
| `transcription-rs` | `Transcript`          | New rich type with streaming fields            |
| `transcribe-rs`    | `TranscriptionResult` | Old type, preserved for backward compatibility |

The name `Transcript` aligns with the new crate name (`transcription-rs`) and avoids collision with the deprecated type.

### API Survey Reference

| API            | Result Finality          | Endpoint Detection             | Word Confidence/Stability       |
| -------------- | ------------------------ | ------------------------------ | ------------------------------- |
| sherpa-onnx    | N/A                      | `is_endpoint()`                | N/A                             |
| ElevenLabs     | `partial` vs `committed` | `commit_strategy` (VAD/manual) | `logprob`                       |
| AWS Transcribe | `IsPartial: bool`        | natural segments               | `Stable: bool` → map to 1.0/0.5 |
| AssemblyAI     | `end_of_turn: bool`      | turn-based                     | N/A                             |
| Deepgram       | `is_final: bool`         | `speech_final: bool`           | `confidence`                    |
| Google Cloud   | interim vs final         | natural pauses                 | `stability` score               |

### Batch API Comparison

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

### Wrapper Implementation

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

---

## Low Level: StreamingDecoder Trait

Mirrors sherpa-onnx's actual API. Full control, consumer manages the decode loop.

```rust
pub trait StreamingDecoder {
    fn accept_waveform(&mut self, samples: &[f32]);
    fn input_finished(&mut self);  // signal end of stream, flush remaining frames
    fn is_ready(&self) -> bool;
    fn decode(&mut self);
    fn get_result(&self) -> Transcript;
    fn is_endpoint(&self) -> bool;
    fn reset(&mut self);
}
```

### Why Expose This?

One `accept_waveform` call can trigger **0, 1, or many** decode steps:

```rust
stream.accept_waveform(&samples);  // buffer audio

while stream.is_ready() {          // may loop 0+ times
    stream.decode();               // each call may update result
    let result = stream.get_result();
    // Handle intermediate result...
}
```

If we hide this loop and only return one result, **intermediate partials are lost**.

### Convenience Helper

```rust
/// Drain all pending results from decoder (runs decode loop internally)
pub fn drain_results(decoder: &mut impl StreamingDecoder) -> Vec<Transcript> {
    let mut results = vec![];
    while decoder.is_ready() {
        decoder.decode();
        results.push(decoder.get_result());
    }
    results
}
```

### Low-Level Usage

```rust
let mut decoder = SherpaDecoder::new(config)?;

loop {
    let samples = mic.read_chunk();
    decoder.accept_waveform(&samples);

    for result in drain_results(&mut decoder) {
        if result.is_final {
            println!("Final: {}", result.text);
            decoder.reset();
        } else {
            print!("\rPartial: {}", result.text);
        }
    }

    if user_stopped() {
        break;
    }
}

// Signal end of stream, flush remaining audio
decoder.input_finished();
for result in drain_results(&mut decoder) {
    println!("Final: {}", result.text);
}
```

---

## High Level: Callback-Based Engine

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

### High-Level Usage (Tauri)

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

### Internal Implementation

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

                // Drain ALL results, send each to callback thread
                for result in drain_results(&mut decoder) {
                    if result_tx.send(Ok(result)).is_err() {
                        break;
                    }
                    if decoder.is_endpoint() {
                        decoder.reset();
                    }
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

        self.audio_tx = Some(audio_tx);
        Ok(())
    }
}
```

---

## Thread Model (High Level)

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

---

## Error Handling

| Error Source      | Low Level                         | High Level                             |
| ----------------- | --------------------------------- | -------------------------------------- |
| Decode fails      | Returns error from `decode()`     | Sent as `Err(e)` to callback           |
| Consumer error    | Consumer handles directly         | Callback returns `Err`, loop stops     |
| End of stream     | Consumer calls `input_finished()` | `stop_listening()` calls it internally |
| Endpoint detected | Consumer calls `reset()`          | Auto-reset on endpoint                 |

---

## Choosing a Layer

| Use Case                      | Layer | Why                             |
| ----------------------------- | ----- | ------------------------------- |
| Tauri app, simple integration | High  | No threading concerns           |
| Custom buffering/timing       | Low   | Full control over decode loop   |
| WebSocket server              | Low   | Need to manage multiple streams |
| Testing/debugging             | Low   | Inspect each decode step        |

---

## Comparison with Original Proposal

| Aspect               | Original B++                    | Revised (`transcription-rs`)     |
| -------------------- | ------------------------------- | -------------------------------- |
| Result type          | `Partial(text)` / `Final(text)` | Rich `Transcript` struct         |
| Layers               | High only                       | Low + High                       |
| Intermediate results | Lost in decode loop             | All captured via `drain_results` |
| `samples` param      | Unclear                         | `&[f32]` (borrow, not owned)     |
| Backward compat      | Breaking change                 | `transcribe-rs` wrapper crate    |
