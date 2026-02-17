# Realtime Interactive Fluid Transcription (RIFT)

- **Realtime:** each word is transformed into text as you speak (not after)
- **Interactive:** click, select, type—even while transcription is in progress
- **Fluid:** switch between speaking and editing (ASR catches up in background)
- **Time-travel:** undo any edit or play back audio in edited order

## Project Purpose

This project is a testing ground to prototype UX ideas for [Whispering](https://github.com/EpicenterHQ/epicenter/tree/main/apps/whispering) and [Handy](https://handy.computer/). The concepts explored here are intended to validate approaches before integrating them into those production apps.

### Key concepts being prototyped

- **Realtime streaming transcription** — Words appear as you speak, with interim/partial results and multiple source support. Distinct from Whispering's current batch model (record → stop → transcribe). See [streaming-transcription-demos](https://github.com/Leftium/rift-transcription/blob/main/reference/streaming-transcription-demos.md) and [Streaming Transcription Provider Comparison](https://github.com/Leftium/rift-transcription/blob/main/reference/whispering-io-analysis.md#streaming-transcription-provider-comparison) for research.

- **Script-based transformation (pre/post processing)** — A sandboxed `script` transformation type that runs user-authored JavaScript (with TypeScript support) to process text locally — no API keys, no cost, no latency. Covers use cases like personal dictionaries, punctuation commands, filler word removal, and multi-step pipelines that Whispering's existing `find_replace` and `prompt_transform` types can't handle alone. See [whispering-script-transformation.md](https://github.com/Leftium/epicenter/blob/feat/script-transformation/specs/whispering-script-transformation.md) for the full spec.

- **Actor model (isolated/swappable extensions)** — Each subsystem (recorder, transcriber, transformer, clipboard) runs as an isolated actor with private state, communicating only via message passing. Enables hot-swapping sources, fault isolation, and multi-core parallelism. See [Actor Model for Multi-Core Parallelism](https://github.com/Leftium/rift-transcription/blob/main/reference/epicenter-plugin-architecture-feasibility.md#actor-model-for-multi-core-parallelism) for the full architecture.

- **Wide events (context)** — Rich, structured events that capture full app-level context (settings, environment, operation history) with every significant action — not just on errors. Enables one-click debug log export and "nothing happened" bug reproduction. See the [Wide Context Spec](https://github.com/Leftium/wellcrafted/blob/spec/context/specs/wide-context/README.md) and [sample event](https://github.com/Leftium/wellcrafted/blob/spec/context/specs/wide-context/sample-wide-context.json) for details.

---

## Usage scenario

1. Speak words `This is realtime transcription`
2. Select text `realtime`
3. Speak word `fluid`

**Result:** `This is fluid transcription`

### More Examples

| Goal                                                                | Original Transcription | Editing Steps                                                    | Result                         |
| ------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------- | ------------------------------ |
| **Insert word**<br><small>(voice)</small>                           | It's in stock          | 1. click after `It's`<br>2. speak `no longer`                    | It's _no longer_ in stock      |
| **Insert term\***<br><small>(keyboard)</small>                      | Download the app       | 1. click after `the`<br>2. type `Lyft `                          | Download the _Lyft_ app        |
| **Insert term\***<br><small>(keyboard+voice)</small>                |                        | 1. type `Svelte `<br>2. speak `component`                        | _Svelte component_             |
| **Insert punctuation**<br><small>(keyboard+voice)</small><br>&nbsp; | ASL                    | 1. type ` (`<br>2. speak `American Sign Language`<br>3. type `)` | ASL _(American Sign Language)_ |
| **Edit word**<br><small>(voice)</small>                             | Meet at the cafe       | 1. select `cafe`<br>2. speak `library`                           | Meet at the _library_          |
| **Edit suffix**<br><small>(keyboard)</small>                        | It works perfectly     | 1. delete `s` in `works`<br>2. type `ed`                         | It work*ed* perfectly          |
| **Improve transcription**<br><small>(action)</small>                | Your welcome           | 1. select `Your welcome`<br>2. 🪄 Enhance Transcription          | _You're welcome_               |

\*ASR often mistranscribes terms: "Lyft" → "lift"/"left", "Svelte" → "belt"/"spelt"/"help".

---

## Architecture

### ProseMirror as Event Log

ProseMirror transactions are already event-sourced—each change is a `Step` that can be stored, inverted, and rebased. We use transaction metadata to track origin and audio references.

See [Editor Implementation → Source of Truth Decision](#source-of-truth-decision) for details.

**Key mappings:**

| Concept               | ProseMirror                                  |
| --------------------- | -------------------------------------------- |
| Operation with origin | `Transaction` + `setMeta('origin', ...)`     |
| Operation log         | Plugin state tracking committed transactions |
| Spans with metadata   | Marks on text nodes                          |
| Pauses                | Atomic inline nodes                          |

### Why Not CRDT?

Initially considered treating keyboard and transcription as two CRDT "users", but:

- CRDT libs optimize away metadata we need
- Compact tombstones lose audio refs
- Don't expose operation log cleanly

ProseMirror's transaction model gives us event sourcing with first-class support for metadata, inversion, and rebasing.

---

## Utterance Tracking Layer

A middleware between the WebSocket API and event consumer that tags and tracks utterances:

```
+-------------+     +-----------------+     +--------------+
| WebSocket   |---->| Utterance       |---->| Event        |
| (API)       |     | Tracker         |     | Consumer     |
+-------------+     +-----------------+     +--------------+
```

### Benefits

- Single WebSocket connection (no pool needed)
- No reconnect latency
- Utterance boundaries are logical, not physical
- Consumer doesn't care about WebSocket lifecycle

### Implementation

```typescript
type Utterance = {
  id: string
  status: 'active' | 'draining' | 'complete'
  anchorPosition: number   // where text inserts in document
  cutoffTime?: number      // for filtering late-arriving words
  audioRef?: string        // recording this utterance belongs to
  startTime?: number       // audio start time
}

type UtteranceTracker = {
  currentUtteranceId: string
  utterances: Map<string, Utterance>
}

// Raw from WebSocket
{ text: "This is realtime", isFinal: false }

// Enriched to consumer
{
  text: "This is realtime",
  isFinal: false,
  utteranceId: "utt_001",
  anchorPosition: 0
}
```

### On Cursor Interrupt

When user clicks to reposition where new speech will be inserted:

1. Mark current utterance as `'draining'` with cutoff timestamp
2. Create new utterance with `'active'` status at cursor position
3. Optionally send `finalize` to API to speed up draining
4. All on same WebSocket—no reconnection needed

```typescript
function handleCursorInterrupt(position: number, time: number) {
	// Mark current utterance as draining
	tracker.utterances.get(tracker.currentUtteranceId).status = 'draining';
	tracker.utterances.get(tracker.currentUtteranceId).cutoffTime = time;

	// Start new utterance (same WebSocket!)
	const newId = generateId();
	tracker.utterances.set(newId, {
		id: newId,
		status: 'active',
		anchorPosition: position
	});
	tracker.currentUtteranceId = newId;

	// Force endpoint on API (optional, helps speed up draining)
	websocket.send({ type: 'finalize' });
}
```

### Handling Latency

Network round-trip before endpoint activates (150-500ms). Words might sneak in.

**Solution:** Optimistic local cutoff—filter words by timestamp on client:

```typescript
function handleTranscriptResult(result: TranscriptResult) {
	const utterance = tracker.utterances.get(result.utteranceId);

	if (utterance.cutoffTime) {
		// Filter words to only those before cutoff
		result.words = result.words.filter((w) => w.time[1] < utterance.cutoffTime);
	}
	// ...
}
```

### When New Utterance Starts Listening

Wait for `final` event from old utterance before accepting interims into new:

```
t=1.200  Click -> old='draining', new='active' (but waiting)
t=1.300  interim "more text" -> ignored (old still draining)
t=1.400  final "This is realtime transcription" -> commit old, new ready
t=1.500  interim "super" -> accepted into new utterance
```

### Interim Text Styling

Text from an `active` utterance that hasn't received `isFinal` yet should be visually distinct:

- **Underline** — like IME composition
- **Faded/gray** — indicates "may change"
- **Both** — belt and suspenders

ProseMirror decoration based on utterance status:

```typescript
function interimDecoration(utteranceId: string, from: number, to: number) {
	return Decoration.inline(from, to, {
		class: 'interim-text', // styled via CSS
		'data-utterance': utteranceId
	});
}
```

---

## Rich Metadata / Span Model

Spans are **derived from ProseMirror marks** for downstream applications (export, playback):

```typescript
// Derived from walking ProseMirror doc and extracting marks
type Span = {
	text: string;
	range: [start: number, end: number];
	origin: 'keyboard' | 'transcription' | 'paste';

	audio?: {
		recordingId: string;
		timeRange: [number, number];
	};
};

// Extract spans from ProseMirror doc
function extractSpans(doc: Node): Span[] {
	const spans: Span[] = [];
	doc.descendants((node, pos) => {
		if (node.isText) {
			const mark = node.marks.find((m) => m.type.name === 'transcription');
			spans.push({
				text: node.text!,
				range: [pos, pos + node.nodeSize],
				origin: mark?.attrs.origin ?? 'keyboard',
				audio: mark?.attrs.audioRef
					? {
							recordingId: mark.attrs.audioRef,
							timeRange: mark.attrs.timeRange
						}
					: undefined
			});
		}
	});
	return mergeAdjacentSpans(spans); // combine contiguous same-origin spans
}
```

### Applications

| Operation           | Result                               |
| ------------------- | ------------------------------------ |
| Reorder words       | Audio playback reorders clips        |
| Delete word         | Gap in audio, or smoothed            |
| Type new word       | TTS synthesis fills gap              |
| Replace spoken word | Original audio retained for undo     |
| Export              | Render hybrid audio from clips + TTS |

---

## Pause Visualization

Inspired by [Audapolis](https://github.com/bugbakery/audapolis), silences/pauses between words should be visualized as inline pause markers.

### Why Pause Markers?

- **Editable** — user can select and delete pauses
- **Non-textual** — doesn't clutter the transcript with "[pause]" text
- **Compact** — inline with text

### Rendering Options

Implementation can choose:

- **Icon/SVG** — custom pause icon (most flexible)
- **Musical rest** — if font supports it (Audapolis uses custom font)
- **Emoji** — ⏸️ (pause button) has decent cross-platform support
- **Text** — `…` or `[·]` as fallback

```
"This is ⏸️ fluid realtime ⏸️ transcription"
          ↑                 ↑
       ~800ms            ~300ms
```

### Pause Node (ProseMirror)

Pauses are **atomic inline nodes** in ProseMirror (not marks, since they don't wrap text):

```typescript
// ProseMirror node spec (see also ProseMirror Implementation below)
const pauseNode = {
	group: 'inline',
	inline: true,
	atom: true, // can't place cursor inside
	attrs: {
		duration: {}, // milliseconds
		audioRef: {}, // recording ID
		timeRange: {} // [start, end] in recording
	}
};

// Derived type for export/playback
type PauseSpan = {
	type: 'pause';
	duration: number;
	position: number; // position in document
	audio: {
		recordingId: string;
		timeRange: [number, number];
	};
};
```

### Visual Treatment

Pauses can vary in visual weight based on duration (implementation detail):

```
"This is ⏸️⏸️ fluid realtime ⏸️ transcription"
           ↑                  ↑
       ~800ms              ~300ms
```

### Interactions

| Action       | Result                             |
| ------------ | ---------------------------------- |
| Click pause  | Select it                          |
| Delete pause | Remove silence from audio playback |

### Endpoint Markers (Optional)

Endpoints are natural speech boundaries detected by ASR (sentence ends, breath pauses). Unlike pauses which have duration, endpoints are instantaneous markers.

**Should we render them?**

| Render | Pros                                                            | Cons                                           |
| ------ | --------------------------------------------------------------- | ---------------------------------------------- |
| Yes    | Shows sentence structure, aids batch re-transcription selection | Visual clutter, may not align with punctuation |
| No     | Cleaner view                                                    | Lose ASR's segmentation hints                  |

**Recommendation:** Don't render by default—the information is in the data (via `isEndpoint` on Transcript), but showing it adds noise. Could be a debug/power-user toggle.

If rendered, use a subtle visual like a thin vertical bar `│` or dot `·` that doesn't compete with the pause emoji.

### ProseMirror Implementation

Pauses as atomic inline nodes:

```typescript
const pauseNode = {
	group: 'inline',
	inline: true,
	atom: true, // can't put cursor inside
	attrs: {
		duration: { default: 500 },
		audioRef: { default: null },
		timeRange: { default: null }
	},
	toDOM(node) {
		return [
			'span',
			{
				class: 'pause-marker',
				'data-duration': node.attrs.duration,
				title: `${node.attrs.duration}ms pause`
			},
			'⏸️'
		];
	}
};
```

---

## Comparison to Descript

| Descript                                | RIFT                                           |
| --------------------------------------- | ---------------------------------------------- |
| Media-first (audio exists, derive text) | Input-first (text accumulates, audio attached) |
| Edit text -> implicitly edit audio      | Edit text -> explicitly decide audio fate      |
| Single recording session                | Multi-session, multi-source                    |
| EDL (Edit Decision List)                | ProseMirror transaction history                |

RIFT captures **intent** (keyboard vs speech), not just **effect** (keep/cut).

---

## Transcription Sources

Six sources with different tradeoffs:

| Source                | Purpose                               | Latency             | Accuracy        | Setup         | Price       |
| --------------------- | ------------------------------------- | ------------------- | --------------- | ------------- | ----------- |
| **Web Speech API**    | Zero-config demo, broad compatibility | Medium (~300-500ms) | Good            | None          | Free        |
| **Sherpa**            | Research, optimal latency, offline    | Low (~100-200ms)    | Good (~4-6%)    | Local install | Free        |
| **Moonshine v2**      | Edge, diarization, smallest models    | Very low (50-258ms) | Excellent (~7%) | Local install | Free        |
| **Soniox v4**         | Production streaming, best RIFT fit   | Very low (<100ms)   | Excellent       | API key       | $0.002/min  |
| **Voxtral Realtime**  | Production streaming, best value      | Very low (<200ms)   | Excellent (~4%) | API key       | $0.006/min  |
| **ElevenLabs Scribe** | Production accuracy, most languages   | Low (~150ms)        | Excellent (~6%) | API key       | ~$0.015/min |

### Web Speech API

Browser-native speech recognition. Zero dependencies, works immediately.

```typescript
type WebSpeechSource = {
	type: 'web-speech';
	// No config needed - uses browser's built-in recognition
};

// Usage
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

recognition.onresult = (event) => {
	const result = event.results[event.resultIndex];
	const transcript = result[0].transcript;
	const isFinal = result.isFinal;
	// Map to our unified format
};
```

**Limitations:**

- Requires internet (sends audio to Google/Apple servers)
- No word-level timestamps (only full transcript)
- No confidence scores per word
- No native `finalize` (can fake via stop + restart, higher latency)
- Browser-specific behavior (Chrome vs Safari vs Firefox)

**Audio capture:** `capturesSelf = true` — browser's `SpeechRecognition` handles mic internally. No `pushAudio`. The controller runs `AudioCapture` in parallel for recording only.

**Best for:** Demos, quick prototyping, users who don't want to install anything.

### Sherpa (sherpa-onnx)

Local ASR via WebAssembly or native. Full control, no network dependency.

```typescript
type SherpaSource = {
	type: 'sherpa';
	modelPath: string;
	// Supports word-level timestamps, confidence scores, force endpoint
};
```

**Capabilities:**

- Word-level timestamps ✓
- Confidence scores ✓
- Force endpoint (`finalize`) ✓
- Works offline ✓
- Customizable models ✓

**Audio capture:** `capturesSelf = false` — receives 16kHz Float32 samples via `pushAudio()`, forwarded to local sherpa-onnx server (or rift-local) over WebSocket.

**Best for:** Research, latency-sensitive use cases, privacy-conscious users.

### Moonshine v2 (Moonshine AI)

Local ASR with built-in diarization, VAD, and intent recognition in a single cross-platform library. Very small models with competitive accuracy.

```typescript
type MoonshineSource = {
	type: 'moonshine';
	// No native WebSocket server — requires a bridge (Python or future WASM)
	bridgeUrl?: string; // e.g., 'ws://localhost:8765'
	modelSize?: 'tiny' | 'small' | 'medium';
};
```

**Architecture:** Sliding-window streaming encoder (genuinely streaming, not chunked batch) with autoregressive decoder. Encoder caches previous computations and processes new audio incrementally with only 80ms lookahead. See [Moonshine v2 paper (arXiv:2602.12241)](https://arxiv.org/abs/2602.12241).

**Capabilities:**

- Segment-level timestamps (`start_time`, `duration`) — **no word-level timestamps**
- Built-in speaker diarization (`speaker_id` on `LineCompleted` events) ✓
- Built-in VAD ✓
- Built-in intent recognition (semantic fuzzy matching via Gemma 300M embeddings) ✓
- Works offline ✓
- Event-based API: `LineStarted` / `LineTextChanged` / `LineCompleted`
- Interims may be revised (non-monotonic) — similar to Web Speech API

**Models (English streaming):**

| Model  | Params | WER    | Latency (M3 CPU) |
| ------ | ------ | ------ | ---------------- |
| Tiny   | 34M    | 12.00% | 50ms             |
| Small  | 123M   | 7.84%  | 148ms            |
| Medium | 245M   | 6.65%  | 258ms            |

Medium beats Whisper Large v3 (7.44% WER, 1.5B params) with 6x fewer parameters.

**Limitations:**

- No WebSocket server mode — needs a Python bridge or future WASM build for browser integration
- No word-level timestamps (only segment-level) — RIFT's per-word confidence coloring won't work
- Non-monotonic interims — text may be revised before `LineCompleted`, requiring `isFinal`/`isEndpoint` handling similar to Web Speech
- Streaming models English-only (7 other languages have non-streaming v1 models)
- Not optimized for GPU batch throughput

**Integration path for RIFT:** Served via rift-local, which wraps Moonshine's push API behind the standard WebSocket protocol. The `LineStarted`/`LineTextChanged`/`LineCompleted` event model maps naturally to RIFT's `Transcript` type.

**Audio capture:** `capturesSelf = false` — receives samples via `pushAudio()`, forwarded to rift-local over WebSocket (same as Sherpa).

**Best for:** Edge deployment with diarization, smallest possible models, privacy-first use cases where speaker identification matters.

### Soniox v4 Real-Time

Cloud API purpose-built for low-latency voice interactions. Best fit for RIFT's architecture.

```typescript
type SonioxSource = {
	type: 'soniox';
	apiKey: string;
	model: 'stt-rt-v4';
	enableEndpointDetection?: boolean;
	maxEndpointDelayMs?: number; // configurable latency-accuracy tradeoff
};
```

**Key features:**

- **Token-level `is_final` streaming** — individual tokens arrive with `is_final` flags, not full-transcript replacements. Maps naturally to ProseMirror's per-word marks.
- **Manual finalization** — send `"type": "finalize"` over WebSocket, get high-accuracy finals in milliseconds. Ideal for RIFT's cursor interrupt / utterance draining.
- **Semantic endpointing** — understands context, rhythm, and intent (not just silence detection). Configurable via `max_endpoint_delay_ms`. Won't cut off a user reading a phone number.
- **60+ languages** with single multilingual model, automatic language detection, speaker diarization
- **Real-time translation** — transcribe and translate simultaneously in a single stream (3,600+ language pairs)
- **Context/domain adaptation** — structured context (domain, topic, terms) sent at connection time

**Pricing:** ~$0.12/hour ($0.002/min) — cheapest cloud streaming option.

**WebSocket URL:** `wss://stt-rt.soniox.com/transcribe-websocket`

**Audio formats:** Auto-detected (aac, flac, mp3, ogg, wav, webm) or raw PCM/μ-law/A-law.

**Why best fit for RIFT:**

1. `finalize()` returns millisecond-latency finals (vs Web Speech's stop+restart hack)
2. Semantic endpointing maps to `isEndpoint` — understands thought completion, not just silence
3. Token-level streaming is closer to word-level ProseMirror operations than transcript-level replacements
4. Speaker diarization available in real-time (not batch-only like Voxtral)

**Audio capture:** `capturesSelf = false` — receives samples via `pushAudio()`, converts and sends to Soniox WebSocket.

**Best for:** Production RIFT deployment where cursor interrupts and semantic endpointing matter.

### Voxtral Realtime (Mistral)

Cloud API with best price/performance ratio. Native streaming architecture (not chunked batch).

```typescript
type VoxtralSource = {
	type: 'voxtral';
	apiKey: string;
	mode: 'streaming' | 'batch';
	latencyMode?: 'fast' | 'balanced' | 'accurate'; // configurable latency-accuracy tradeoff
};
```

**Streaming mode:** Real-time via WebSocket, sub-200ms latency (configurable down to ~200ms for speed or ~2.4s for batch-equivalent accuracy).

**Batch mode:** Voxtral Mini Transcribe V2 at $0.003/min with speaker diarization and context biasing.

**Key features:**

- ~4% WER on FLEURS benchmark (state-of-the-art)
- 13 languages (EN, ZH, HI, ES, AR, FR, PT, RU, DE, JA, KO, IT, NL)
- Word-level timestamps (segment granularity)
- **Open weights available** (Apache 2.0) — future self-hosting possible
- GDPR/HIPAA compliant deployments

**Limitations:**

- No realtime diarization (batch only)
- Context biasing English-optimized
- Fewer languages than ElevenLabs (13) or Soniox (60+)

**Audio capture:** `capturesSelf = false` — receives samples via `pushAudio()`, converts and sends to Voxtral WebSocket.

**Best for:** Production streaming when cost matters, future self-hosting path.

### ElevenLabs Scribe

Cloud API with broadest language support. Two modes:

```typescript
type ScribeSource = {
	type: 'scribe';
	apiKey: string;
	mode: 'streaming' | 'batch';
};
```

**Streaming mode:** Real-time via WebSocket, <150ms latency with predictive transcription.

**Batch mode:** Upload audio, get polished transcript. Higher accuracy, higher latency.

**Key features:**

- ~6.5% WER across 90+ languages
- Automatic language detection and code-switching
- Up to 48 speakers diarization (batch)
- Entity detection for compliance (56 categories)

**Audio capture:** `capturesSelf = false` — receives samples via `pushAudio()`, converts and sends to ElevenLabs WebSocket.

**Best for:** Production use when language coverage or diarization matters.

### Unified Interface

All sources implement the same interface:

```typescript
import { Result, Ok, Err } from 'wellcrafted/result';
import { createTaggedError } from 'wellcrafted/error';

// Errors
const { TranscriptionError, TranscriptionErr } = createTaggedError(
	'TranscriptionError'
).withContext<{ source: string }>();
type TranscriptionError = ReturnType<typeof TranscriptionError>;

// Source interface (aligned with transcription-rs naming: "Source" = push-based, "Engine" = pull-based)
// See: https://github.com/Leftium/transcribe-rs/blob/docs/streaming-api-spec/specs/transcription-rs.md
interface TranscriptionSource {
	readonly name: string; // 'web-speech' | 'sherpa' | 'moonshine' | 'soniox' | 'voxtral' | 'scribe'

	startListening(): Result<void, TranscriptionError>;
	stopListening(): Result<void, TranscriptionError>;
	finalize(): void; // Force endpoint without stopping (RIFT addition — not in transcription-rs)

	// Receive audio samples from external capture.
	// WebSocket-based sources forward to their backend.
	// Browser-native sources (WebSpeech) omit this — they capture internally.
	pushAudio?(samples: Float32Array): void;

	// True if this source manages its own audio capture (e.g., WebSpeech).
	// When true, the controller still runs AudioCapture in parallel for recording,
	// but doesn't expect the source to receive audio via pushAudio.
	readonly capturesSelf: boolean;

	onResult: (result: Transcript) => void;
}

// Aligned with transcription-rs Transcript type
// See: https://github.com/Leftium/transcribe-rs/blob/docs/streaming-api-spec/specs/transcription-rs-appendix.md
type Transcript = {
	text: string;

	// Result-level finality
	isFinal: boolean; // this result won't be revised
	isEndpoint: boolean; // natural speech boundary detected (silence/pause)
	segmentId: number; // same ID for all revisions of one utterance

	// Timing (seconds from stream start)
	start?: number;
	end?: number;

	// Confidence
	confidence?: number; // 0.0–1.0, overall confidence score

	// Language
	language?: string; // detected/specified language code (e.g., "en", "en-US")
	languageConfidence?: number; // 0.0–1.0, confidence in language detection

	// Speaker diarization
	speaker?: Speaker; // speaker identifier for this segment

	// Word-level detail
	words?: Word[];

	// N-best alternatives
	alternatives?: Alternative[]; // alternative transcriptions for same audio

	// Raw backend response for debug/niche fields
	raw?: unknown; // full backend response (opt-in, disabled by default)
};

// Speaker identifier — backends use different schemes
type Speaker =
	| { type: 'id'; id: number } // numeric ID (0, 1, 2...) — Deepgram, Azure, Rev.ai
	| { type: 'label'; label: string }; // string label ("A", "B") — AssemblyAI, Google

// Alternative transcription hypothesis (n-best)
type Alternative = {
	text: string;
	confidence?: number;
	words?: Word[];
};

type Word = {
	text: string;
	punctuated?: string; // with punctuation/caps (e.g., "yeah" → "Yeah.")
	start: number; // start time (seconds)
	end: number; // end time (seconds)
	confidence?: number; // 0.0–1.0
	speaker?: Speaker; // speaker for this word (may differ from segment)
};
```

**Design notes** (from [transcription-rs appendix](https://github.com/Leftium/transcribe-rs/blob/docs/streaming-api-spec/specs/transcription-rs-appendix.md)):

- **`isFinal` vs `isEndpoint`** — `isFinal` means "this text won't be revised" (use for UI: show as committed text). `isEndpoint` means "speaker paused/stopped, segment complete" (use to trigger utterance boundary logic). A result can be `isFinal` without being `isEndpoint` — text is stable but speaker hasn't paused yet.
- **`segmentId`** — groups all revisions of one utterance. Partials share the same ID as their final. Use to replace previous interim text with updated results.
- **`confidence`** — serves dual purpose: model certainty for finals, stability indicator for interims (how likely this partial will change). Backends with boolean `Stable` (e.g., AWS) map to `1.0`/`0.5`.
- **`speaker`** — backends vary: Deepgram/Azure use numeric IDs, AssemblyAI/Google use string labels. The discriminated union preserves this distinction.
- **`punctuated`** (on `Word`) — Deepgram's `punctuated_word` pattern. Useful when you need both raw (`"yeah"`) and display (`"Yeah."`) forms.
- **`alternatives`** — n-best hypotheses for the same audio segment. Primary hypothesis is in `text`/`words`; alternatives provide ranked fallbacks.
- **`raw`** — full backend response for debugging or accessing niche fields not in this type. Disabled by default for performance; enable via backend config.
- **Batch results** always have `isFinal: true` and `isEndpoint: true`.

**Source capability matrix:**

| Field          | Web Speech           | Sherpa  | Moonshine v2      | Soniox v4      | Voxtral | Scribe  |
| -------------- | -------------------- | ------- | ----------------- | -------------- | ------- | ------- |
| `text`         | ✓                    | ✓       | ✓                 | ✓              | ✓       | ✓       |
| `isFinal`      | ✓                    | ✓       | ✓ (LineCompleted) | ✓ (per-token)  | ✓       | ✓       |
| `isEndpoint`   | forced only          | ✓       | ✓ (LineCompleted) | ✓ (semantic)   | ✓       | ✓       |
| `segmentId`    | ✓ (client-generated) | ✓       | ✓ (lineId)        | ✓              | ✓       | ✓       |
| `start`/`end`  | ✗                    | ✓       | segment only      | ✓              | ✓       | ✓       |
| `words`        | ✗                    | ✓       | ✗                 | ✓ (tokens)     | segment | ✓       |
| `confidence`   | ✗                    | ✓       | ✗                 | ?              | ?       | ✓       |
| `speaker`      | ✗                    | ✗       | ✓ (built-in)      | ✓ (real-time)  | batch   | batch   |
| `monotonic`    | No                   | **Yes** | No                | No             | ?       | ?       |
| `alternatives` | ✗                    | ✗       | ✗                 | ✗              | ✗       | ✗       |
| `finalize`     | fake (stop+restart)  | ✓       | ✓ (stop)          | ✓ (ms-latency) | ✓       | ✓       |
| Languages      | browser-dependent    | 10+     | 8 (EN streaming)  | 60+            | 13      | 90+     |
| Price/min      | free                 | free    | free              | $0.002         | $0.006  | ~$0.015 |

**Notes:**

- **`monotonic`** = interim results are append-only (earlier tokens/words are never revised). When `Yes`, all interims can be treated as `isFinal: true` for display purposes (sherpa-onnx transducer models). When `No`, the source may revise earlier text in subsequent interims — the UI must track `segmentId` and replace previous interim text.
- Web Speech API's `finalize()` implemented as stop + restart (higher latency)
- Web Speech lacks timing/word data — utterance tracker treats full transcript as single segment
- Soniox streams individual tokens with `is_final` flags (not full-transcript replacements)
- Voxtral provides segment-level timestamps; word-level granularity TBD
- Moonshine v2 provides segment-level `start_time` + `duration` but no per-word timestamps or confidence
- Moonshine v2 has built-in diarization and intent recognition — unique among local/free sources
- `speaker` row shows diarization availability (same data that was previously in a separate "Diarization" row)
- `alternatives` not yet available from any streaming source we support; future addition
- Uses WellCrafted Result type for explicit error handling

### Source Selection Logic

Auto-detect best available source, fall back to Web Speech API:

```typescript
const { SourceError, SourceErr } = createTaggedError('SourceError');
type SourceError = ReturnType<typeof SourceError>;

function detectSource(): Result<TranscriptionSource, SourceError> {
	// Prefer Sherpa if available (e.g., WASM loaded, native module present)
	if (isSherpaAvailable()) {
		return Ok(createSherpaSource(config));
	}

	// Prefer Moonshine if bridge available (diarization, smallest models)
	if (isMoonshineAvailable()) {
		return Ok(createMoonshineSource(config));
	}

	// Prefer Soniox if API key configured (best RIFT fit: finalize + semantic endpointing)
	if (config.sonioxApiKey) {
		return Ok(createSonioxSource(config));
	}

	// Prefer Voxtral if API key configured (best price/performance)
	if (config.voxtralApiKey) {
		return Ok(createVoxtralSource(config));
	}

	// Prefer Scribe if API key configured (most languages)
	if (config.scribeApiKey) {
		return Ok(createScribeSource(config));
	}

	// Fall back to Web Speech API (zero-config, works in most browsers)
	if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
		return Ok(createWebSpeechSource());
	}

	return SourceErr({ message: 'No transcription source available' });
}

// Allow explicit override
function selectSource(config: Config): Result<TranscriptionSource, SourceError> {
	if (config.preferredSource) {
		return Ok(createSource(config.preferredSource));
	}
	return detectSource();
}
```

**Priority order:**

1. Sherpa (if available) — best latency, offline, word-level timestamps, monotonic interims
2. Moonshine (if bridge available) — diarization, smallest models, edge-first
3. Soniox (if API key configured) — best RIFT fit (ms-finalize, semantic endpointing, token streaming)
4. Voxtral (if API key configured) — best price/performance, future self-hosting
5. Scribe (if API key configured) — most languages, code-switching
6. Web Speech API — zero-config fallback

### Hot-Swapping Sources

Switch sources on the fly without losing state:

```typescript
class TranscriptionManager {
	private source: TranscriptionSource;
	private audioBuffer: Float32Array[] = []; // keep recent audio for re-transcription

	switchSource(
		newSource: TranscriptionSource,
	): Result<void, TranscriptionError> {
		// Finalize current utterance
		this.source.finalize();

		// Swap
		const { error } = this.source.stopListening();
		if (error) return error;

		this.source = newSource;
		this.source.onResult = this.handleResult.bind(this);

		return this.source.startListening();
	}

  // Re-transcribe selection with batch API for higher accuracy
  async retranscribe(from: number, to: number): Promise<Result<Transcript, TranscriptionError>> {
    // Extract audio refs from marks in selection
    const audioClips = this.getAudioClipsForRange(from, to);

    // Stitch audio clips (may be reordered/edited by user)
    const stitchedAudio = stitchAudioClips(audioClips);

    // Batch transcription: more accurate than streaming
    // - Larger models (not constrained by latency)
    // - Full context (sees entire utterance)
    // - More post-processing (punctuation, formatting)
    return transcribeBatch(stitchedAudio, {
      source: 'scribe',
      model: 'scribe_v2',
    });
  }

  // Get audio clips for a document range, respecting edit order
  private getAudioClipsForRange(from: number, to: number): AudioClip[] {
    const clips: AudioClip[] = [];

    doc.nodesBetween(from, to, (node, pos) => {
      if (node.isText) {
        const mark = node.marks.find(m => m.type.name === 'transcription');
        if (mark?.attrs.audioRef) {
          clips.push({
            audioRef: mark.attrs.audioRef,
            timeRange: mark.attrs.timeRange,
          });
        }
      }
    });

    return clips;  // in document order (user's edited order)
  }
}
}
```

**Use cases:**

| Scenario                          | Action                                |
| --------------------------------- | ------------------------------------- |
| User clicks "enhance" on segment  | Re-transcribe with batch API          |
| Sherpa confidence < threshold     | Auto-queue for batch re-transcription |
| Network goes offline              | Fall back to Sherpa streaming         |
| User toggles "high accuracy mode" | Switch to Scribe streaming            |

**Streaming vs Batch:**

| Mode      | Latency    | Accuracy | Use                                 |
| --------- | ---------- | -------- | ----------------------------------- |
| Streaming | ~100-500ms | Good     | Real-time feedback while speaking   |
| Batch     | ~1-5s      | Best     | Re-transcription, "enhance" feature |

**🪄 Enhance Transcription modes:**

| Mode       | What's sent                    | What's replaced       | Use                               |
| ---------- | ------------------------------ | --------------------- | --------------------------------- |
| Precise    | User's selection               | Selection only        | Fix specific word/phrase          |
| Contextual | Expanded to sentence/paragraph | Entire expanded range | Better accuracy from more context |

**Re-transcribe edited selections:**

User can reorder, delete, insert—then re-transcribe any selection:

```
Original:  "The quick brown fox jumps"
Edited:    "brown fox quick jumps"      ← user reordered words
Selection: "brown fox quick"

Audio extraction (in document order):
  "brown fox" → rec_001 [1.2s, 1.8s]
  "quick"     → rec_001 [0.4s, 0.7s]

Stitch audio → batch transcribe → replace selection with result
```

Works because ProseMirror marks preserve audio refs through copy/paste/reorder.

**Requirements:**

- Keep audio buffer for recent segments (for batch re-transcription)
- Utterance tracker handles source changes transparently
- UI shows which source produced each segment (optional)
- Replace text in ProseMirror when batch result arrives

### Externalized Audio Capture

Audio capture is owned by the controller (not by individual sources), enabling recording, source sharing, and batch re-transcription.

#### Problem

If each WebSocket-based source creates its own `AudioCapture` internally:

1. **No recorded audio.** The span model requires `audioRef` + `timeRange` on ProseMirror marks for playback, re-transcription, and time-travel undo. Audio flows through sources and is discarded — nothing to reference.
2. **Duplicated capture.** Every WebSocket source repeats the same `getUserMedia` → `AudioWorklet` → `onAudioData` → `ws.send()` wiring. Every future source will copy it.
3. **No audio sharing.** Hot-swapping sources requires each to open its own mic. Feeding non-mic audio (file playback, re-transcription) is impossible since sources assume `getUserMedia`.

#### Design

The controller captures audio once, records it, and distributes samples to whichever source is active:

```
VoiceInputController (owns AudioCapture + RecordingBuffer)
  │
  │  audioCapture.onAudioData = (samples) => {
  │    recordingBuffer.write(samples);      // always persist
  │    source.pushAudio?.(samples);         // feed active source
  │  };
  │
  ├── AudioCapture (single mic pipeline, started/stopped by controller)
  │
  ├── RecordingBuffer (persists audio, generates audioRef + timeRange)
  │
  └── TranscriptionSource (receives audio via pushAudio, emits Transcript via onResult)
        ├── LocalSource.pushAudio(samples)     → ws.send(samples.buffer)
        ├── DeepgramSource.pushAudio(samples)  → ws.send(float32ToInt16(samples).buffer)
        └── WebSpeechSource                    → no pushAudio (browser owns mic)
```

Sources that need audio implement `pushAudio(samples: Float32Array)` and set `capturesSelf = false`. They no longer create `AudioCapture` instances — `startListening()` only opens the WebSocket, `stopListening()` only closes it. Audio arrives via `pushAudio`.

`WebSpeechSource` sets `capturesSelf = true` and omits `pushAudio`. The browser's `SpeechRecognition` captures its own mic internally. The controller still runs `AudioCapture` in parallel for recording — two mic streams from the same device is fine (the OS shares the hardware). The parallel stream provides audio for the `RecordingBuffer` that WebSpeech can't expose.

#### RecordingBuffer

```typescript
class RecordingBuffer {
	private chunks: { samples: Float32Array; timestamp: number }[] = [];
	private recordingId: string = generateId();
	private startTime: number = 0;

	write(samples: Float32Array): void {
		if (this.chunks.length === 0) this.startTime = Date.now();
		this.chunks.push({ samples, timestamp: Date.now() });
	}

	/** Current recording ID (for audioRef on ProseMirror marks). */
	get currentRecordingId(): string {
		return this.recordingId;
	}

	/** Elapsed time in seconds (for timeRange on marks). */
	get elapsed(): number {
		return (Date.now() - this.startTime) / 1000;
	}

	/** Extract audio for a time range (for re-transcription / playback). */
	getAudioForRange(start: number, end: number): Float32Array {
		/* ... */
	}

	/** Export as WAV/WebM for persistence. */
	async export(): Promise<Blob> {
		/* ... */
	}
}
```

#### Hot-Swap Without Audio Gap

During source hot-swap, `AudioCapture` never stops. The mic stays open, the recording continues, only the `pushAudio` target changes:

```typescript
setSource(type: SourceType) {
	const wasEnabled = this.enabled;
	if (wasEnabled) this.#source?.stopListening();  // stop source, NOT audio
	this.#source = null;
	this.sourceType = type;
	if (wasEnabled) {
		const s = this.#ensureSource();
		s.startListening();
		// AudioCapture still running — just rewire pushAudio to new source
		this.#audioCapture.onAudioData = (samples) => {
			this.#recordingBuffer.write(samples);
			s.pushAudio?.(samples);
		};
	}
}
```

No gap in audio, no mic permission re-prompts.

#### Batch Re-Transcription Flow

When the user selects text and clicks "Enhance Transcription":

1. Extract audio refs from ProseMirror marks in the selection
2. Get the corresponding audio from `RecordingBuffer.getAudioForRange()`
3. Open a second WebSocket to rift-local with `?asr=batch-model&mode=batch`
4. Send the recorded audio at read speed via `pushAudio()`
5. `mode=batch` tells rift-local to suppress interims (only send finals with endpoint data)
6. Collect final segments, replace ProseMirror selection with the result

Progress is calculated client-side: RIFT knows total audio duration from the buffer and tracks how much has been sent / how far results have progressed via `start_time` on returned transcripts.

#### What This Enables

| Feature (from spec)             | Requires                       | Before                   | After                                       |
| ------------------------------- | ------------------------------ | ------------------------ | ------------------------------------------- |
| `audioRef` on ProseMirror marks | Recorded audio with IDs        | No audio retained        | `RecordingBuffer` provides IDs + timestamps |
| Re-transcription (Enhance)      | Audio for arbitrary selections | No audio available       | `RecordingBuffer.getAudioForRange()`        |
| Audio playback in edited order  | Stored audio clips             | No audio stored          | `RecordingBuffer` + export                  |
| Hot-swap without audio gap      | Shared mic stream              | Each source restarts mic | `AudioCapture` stays running                |
| Feed file/recorded audio        | External audio source          | Impossible               | `pushAudio()` accepts any samples           |
| Testing with fixture audio      | Inject known samples           | Impossible               | `pushAudio()` directly                      |

---

## Planned Tech Stack

- **Transcription** — Web Speech API (demo) / Sherpa (research) / Moonshine v2 (edge, diarization) / Soniox v4 (production, best RIFT fit) / Voxtral (value) / Scribe (languages)
- **ElevenLabs TTS** — Synthesize typed text, potentially voice-cloned

---

## TranscriptArea: Textarea-Shaped Voice Input

### Core Concept

A `TranscriptArea` is a textarea that also accepts input events triggered by voice. From the component's perspective, voice is just another input source — like an IME or autocomplete. The component doesn't own the mic or recording logic; it receives `Transcript` events and handles display/composition.

**The component is a display/composition layer, not a transcription engine.** It accepts the `Transcript` type already defined in this spec — text with an `isFinal` flag — and manages the interim→final lifecycle. Audio capture, recording control, and source selection all live outside the component.

```
mic → recorder → audio → transcriber → Transcript → TranscriptArea
                                        ^^^^^^^^^^    ^^^^^^^^^^^^^^
                                        this type     this component
```

This makes the R&D portable:

- **In rift-transcription**: a thin wrapper adds a mic button and calls Web Speech, feeds `Transcript` events into the component
- **In Whispering**: the existing recording pipeline (global hotkey, toolbar, VAD) feeds `Transcript` events into the same component
- **In Handy**: whatever trigger mechanism they use, same component

### How Text Enters an Input Element

Every way text gets into a textarea follows the same pattern: events fire _on the element_. The element is a sink for input events from multiple sources.

| Source                          | Events on the element                                                                         | Composition?             |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------ |
| **Keyboard**                    | `keydown` → `input` → `keyup`                                                                 | No                       |
| **IME** (CJK, etc.)             | `compositionstart` → `compositionupdate` + `input` (isComposing) → `compositionend` → `input` | Yes                      |
| **Pen/stylus handwriting**      | OS handwriting recognizer → arrives as composition events                                     | Yes                      |
| **OS dictation** (system-level) | OS speech service → arrives as composition events or direct `input`                           | Yes (platform-dependent) |
| **Voice (Web Speech API)**      | Events fire on a separate `SpeechRecognition` object. **Nothing hits the textarea.**          | **Gap**                  |

Pen handwriting is the most instructive comparison: the user draws strokes, the OS recognizes characters, and the result arrives at the textarea as composition events — the element never sees raw strokes.

#### The EditContext pipeline

The [EditContext API](https://developer.mozilla.org/en-US/docs/Web/API/EditContext_API) (experimental, Chromium-only) makes the platform's text input pipeline explicit. MDN identifies [5 actors](https://developer.mozilla.org/en-US/docs/Web/API/EditContext_API#concept) involved in text entry:

```
(1) User        — provides input (keystrokes, pen strokes, speech)
      ↓
(2) Input method — converts raw input to text (IME, handwriting recognizer)
      ↓
(3) OS text input service — routes text to the focused element
      ↓
(4) Text edit context — manages text buffer, selection, composition state
      ↓
(5) Editable region — renders the text (textarea, contenteditable, canvas)
```

For `<textarea>` and `contenteditable`, the browser handles (3)–(5) automatically. EditContext lets apps take over (4)–(5) for custom rendering (canvas, WebGL, etc.) while still receiving input from the OS.

**All indirect text input — IME, handwriting, OS dictation — flows through (3).** That's why pen handwriting arrives as composition events without any app code. The OS does the recognition; the element just sees text.

**Voice via Web Speech API bypasses this pipeline entirely.** The `SpeechRecognition` object is a standalone API — results fire on the recognition object, not the element. It skips steps (3)–(4):

```
(1) User speaks
      ↓
(2) Web Speech API (recognizer)
      ↓
    ✗ Results fire on SpeechRecognition object, NOT on the textarea
```

**TranscriptArea fills this gap** — it acts as (4), receiving `Transcript` events from the voice recognizer and managing the composition lifecycle that the OS would normally handle. This makes voice input behave like every other text input source from the element's perspective.

### Voice Input as IME Composition

Voice input maps 1:1 to [IME composition](https://developer.mozilla.org/en-US/docs/Glossary/Input_method_editor). One utterance = one composition session:

| Composition event   | IME trigger                    | Voice trigger                            |
| ------------------- | ------------------------------ | ---------------------------------------- |
| `compositionstart`  | User begins typing in IME mode | Speech starts (first interim arrives)    |
| `compositionupdate` | Candidate string changes       | New interim result (partial recognition) |
| `compositionend`    | User confirms candidate        | `isFinal: true` from source              |

Browsers have [`compositionstart`](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event), [`compositionupdate`](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionupdate_event), [`compositionend`](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event) events for exactly this lifecycle:

```
compositionstart  → { data: "" }              // speech starts
compositionupdate → { data: "hello" }         // interim result
compositionupdate → { data: "hello world" }   // more words recognized
compositionend    → { data: "Hello world." }  // isFinal: true
input             → value updated              // text committed
```

While composition is active, `input` events fire but are marked with `event.isComposing === true`, so well-behaved code can ignore half-formed input.

**Cursor interrupt** maps to ending one composition and starting another:

```
compositionend    → old utterance committed/discarded at old position
compositionstart  → new utterance begins at new cursor position
```

**The analogy holds — differences are of degree, not kind:**

|                          | IME                                                                  | Voice                                                        |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| Buffer length            | characters → full sentence (CJK routinely composes entire sentences) | words → full sentence                                        |
| Revision of earlier text | Normal (whole buffer changes as context shifts)                      | Normal (whole interim revises as model processes more audio) |
| Once finalized           | Text won't change                                                    | Text won't change (`isFinal: true`)                          |
| What triggers updates    | Keystroke                                                            | Network/model (async)                                        |
| Concurrent compositions  | One at a time                                                        | One at a time (one active utterance)                         |

The only structural difference is **async timing**: IME updates arrive in response to user keystrokes; voice updates arrive asynchronously from the network/model. But `compositionupdate` doesn't specify _what triggers it_ — just that the composition buffer changed.

### Input Contract

The component receives `Transcript` events — the same way a textarea receives `input` and `composition` events. Voice results are input events pushed _into_ the component, not props observed by it.

```typescript
// Consumer wires the transcription source to the component
source.onResult = (transcript) => {
	// Dispatches composition events on the component internally
	transcriptArea.handleTranscript(transcript);
};
```

The component manages the composition lifecycle internally:

- Interim (`isFinal: false`) → active composition, display with visual distinction
- Final (`isFinal: true`) → end composition, commit text into value
- Tracks `segmentId` to know which interim to replace on each update

**What maps cleanly from textarea:**

- `value` / `bind:value` — committed text (finals only)
- `placeholder` — "Type or speak..."
- `disabled`, `readonly`
- `oninput` — fires on both typing and final transcription commits
- Selection/cursor — insertion point for new speech
- Copy/paste still works

**What the consumer owns:** mic access, recording start/stop, source selection, pushing `Transcript` events into the component

**What the component owns:** composition lifecycle (interim→final), visual distinction of uncommitted text, cursor/insertion behavior

### Interim Text Display: Transparent Textarea Overlay

The key challenge: a plain textarea can't style inline ranges. Interim (unconfirmed) text needs visual distinction from committed text.

The solution borrows a technique from [OverType](https://overtype.dev): a transparent `<textarea>` layered over a styled `<div>`. The textarea handles all input natively (keyboard, paste, selection, undo/redo, mobile keyboards, spellcheck). The div underneath renders the same text with visual distinction for interim ranges.

```
┌─────────────────────────────────────────────┐
│ Hello world I am still speaking...          │  ← textarea (transparent text,
│                                             │     visible caret only)
│                                             │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ Hello world I am still speaking...          │  ← preview div (styled —
│             ^^^^^^^^^^^^^^^^^^^^^^^^           │     interim text gray/underlined)
│                                             │
└─────────────────────────────────────────────┘
```

The CSS trick is minimal:

```css
textarea {
	background: transparent;
	color: transparent;
	caret-color: black; /* cursor stays visible */
	position: absolute; /* overlays the preview div */
}
```

The textarea and preview div use identical monospace font, size, padding, and line-height, so characters align perfectly. The textarea value is the source of truth; the preview div is a reactive render of the same string with interim spans wrapped in styled elements.

**Constraints (acceptable for TranscriptArea):**

- **Monospace font required** — variable-width fonts break character alignment between layers. Fine for a voice input component; the full RIFT editor (Tiptap/ProseMirror) handles proportional fonts.
- **Fixed font size** — all text the same size. Fine for single-purpose input.
- **No rich formatting in the textarea** — bold, headers, etc. aren't possible. Not needed here; TranscriptArea is for text capture, not document editing.

These constraints don't apply to the full RIFT editor, which uses ProseMirror (see below).

### Implementation Options

The composition model (voice input = IME composition) frames the design. Two implementation options:

1. **~~Dispatch real CompositionEvents~~** — ~~the textarea natively handles uncommitted text display (underlined by default).~~ **Ruled out.** Tested in `static/test-composition.html`: synthetic `CompositionEvent`s dispatched from JavaScript fire on the DOM (listeners see them) but the browser's rendering pipeline does not apply composition styling (underline). The composition underline is driven by the platform's text input service (actor (3) in the EditContext pipeline), not by DOM events. Also tested `InputEvent` with `isComposing: true` and `inputType: insertCompositionText` — same result: no visual effect.

2. **Mirror the pattern conceptually** — implement the same lifecycle internally using the transparent textarea overlay for display. More control, more portable across frameworks. Avoids colliding with a real IME session if the user has one active.

**Option 2 is the only viable approach.** The mental model from option 1 is correct — voice input is a composition session — but the browser won't render it as one unless the OS text input service initiates it. The overlay gives full control over interim display without depending on browser internals.

### MVP Scope

The first implementation validates the input contract and overlay technique with minimal complexity:

**In scope:**

- Transparent textarea over styled preview div (OverType technique)
- `handleTranscript()` method receives `Transcript` events
- Interim text (`isFinal: false`) displayed inline with visual distinction (gray/underlined in preview div)
- Final text (`isFinal: true`) committed into textarea value
- Keyboard and voice input coexist on the same element
- `value` / `bind:value` reflects committed text

**Known limitations:**

- **Undo/redo is broken** — Svelte reactively sets the textarea's `value`, which the browser treats as a programmatic write (not a user edit), destroying the native undo stack. Fixing this in TranscriptArea would mean reimplementing an undo stack manually. Not worth it — ProseMirror's `history` plugin handles this natively for the RIFT Editor, where voice insertions are invertible transactions in the same undo stack as keyboard edits.

**Deferred:**

- Composition interrupt on cursor move
- Multiple simultaneous composition sessions

This is the simplest thing that proves: (a) the overlay technique works for inline interim styling, (b) the event-driven input contract is correct, and (c) voice and keyboard input coexist naturally.

### Two Components, One Contract

TranscriptArea and the full RIFT Editor are **separate components for different use cases**, not stages of one migration. They share the same input contract:

|                           | **TranscriptArea**                                             | **RIFT Editor**                                   |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| **Use case**              | Simple voice-enabled text input                                | Rich transcription editor with metadata           |
| **Rendering**             | Textarea + transparent overlay                                 | Tiptap / ProseMirror                              |
| **Input contract**        | `handleTranscript(transcript)`                                 | `handleTranscript(transcript)`                    |
| **Fonts**                 | Monospace (overlay constraint)                                 | Any (ProseMirror handles layout)                  |
| **Interim display**       | Styled span in preview div                                     | ProseMirror decoration                            |
| **Rich spans / metadata** | No                                                             | Yes (word-level timestamps, confidence, speaker)  |
| **Multiple cursors**      | No                                                             | Yes (user cursor + transcription insertion point) |
| **Complexity**            | Minimal — one CSS trick + event handler                        | Full editor framework                             |
| **Good for**              | Chat input, search bars, simple forms, embedding in other apps | RIFT's primary editing surface                    |

Consumer code that pushes `Transcript` events is identical for both:

```typescript
source.onResult = (transcript) => {
	// Same call regardless of which component is on the page
	component.handleTranscript(transcript);
};
```

TranscriptArea is not a stepping stone to be discarded — it's a lightweight option for integrations that don't need rich editing. Apps like Whispering or Handy could ship TranscriptArea today and never need the full editor.

---

## Editor Implementation

### Why Not Textarea for the Full Editor?

The TranscriptArea (textarea + overlay) handles simple voice input well, but the full RIFT editor needs capabilities beyond what a textarea can provide:

1. **Rich spans with metadata** — each word/phrase knows its origin, audio ref, timestamps
2. **Multiple cursors/anchors** — transcription insertion point vs user cursor
3. **Custom rendering** — confidence highlighting, speaker colors, proportional fonts
4. **Programmatic manipulation** — inserting at arbitrary positions while user types elsewhere

### Library Options

| Library                      | Pros                                | Cons                            |
| ---------------------------- | ----------------------------------- | ------------------------------- |
| **ProseMirror**              | Low-level, full control, proven     | Steep learning curve, verbose   |
| **Tiptap**                   | ProseMirror + nicer API, extensions | Still complex for this use case |
| **Lexical** (Meta)           | Modern, designed for extensibility  | Newer, less ecosystem           |
| **Slate**                    | React-focused, flexible model       | React-only, some instability    |
| **CodeMirror 6**             | Great for structured text, fast     | More code-editor oriented       |
| **Custom `contenteditable`** | Full control                        | Pain, browser inconsistencies   |

### Recommendation: ProseMirror/Tiptap

ProseMirror's model maps well to the requirements:

| RIFT Concept         | ProseMirror Equivalent         |
| -------------------- | ------------------------------ |
| Span with metadata   | Mark with attrs                |
| Pause                | Atomic inline node             |
| Transcription cursor | Decoration (widget)            |
| Interim text styling | Decoration (inline)            |
| Operation log        | Transaction history via plugin |
| Insert at position   | `tr.insert(pos, content)`      |

### Source of Truth Decision

ProseMirror is already event-sourced under the hood—transactions are first-class values that can be stored, inverted, and rebased. See:

- [Change tracking example](https://prosemirror.net/examples/track/) — blame map, commit history, revert
- [Collab example](https://prosemirror.net/examples/collab/) — OT-style sync

**Recommendation:** Use ProseMirror's native transaction system.

```typescript
// Plugin tracks origin metadata per transaction
const trackPlugin = new Plugin({
	state: {
		init() {
			return { commits: [], uncommittedSteps: [] };
		},
		apply(tr, tracked) {
			if (tr.docChanged) {
				const origin = tr.getMeta('origin') ?? 'keyboard'; // 'transcription' | 'keyboard' | 'paste'
				const audioRef = tr.getMeta('audioRef');
				// Store inverted steps for potential revert
				const inverted = tr.steps.map((step, i) => ({
					step: step.invert(tr.docs[i]),
					origin,
					audioRef
				}));
				return {
					...tracked,
					uncommittedSteps: tracked.uncommittedSteps.concat(inverted)
				};
			}
			return tracked;
		}
	}
});

// When inserting transcription
view.dispatch(
	tr
		.insert(pos, content)
		.setMeta('origin', 'transcription')
		.setMeta('audioRef', utterance.audioRef)
		.setMeta('timeRange', [start, end])
);
```

**Benefits:**

- No separate event log to maintain—ProseMirror transactions _are_ the log
- Built-in support for inversion (undo), rebasing (collab), blame tracking
- Metadata travels with transactions naturally via `setMeta`/`getMeta`

### Clipboard Handling

ProseMirror supports rich clipboard content via props:

- `clipboardSerializer` — custom serialization for copy (preserves marks as data attributes)
- `clipboardParser` — custom parsing for paste (restores marks from data attributes)
- `transformCopied` / `transformPasted` — hooks to modify slices

This preserves audio metadata through cut/copy → paste within the editor:

```typescript
const editorProps = {
	// Serialize marks to data attributes for clipboard
	clipboardSerializer: DOMSerializer.fromSchema(schema), // default works if toDOM includes data-*

	// Parse data attributes back to marks on paste
	clipboardParser: DOMParser.fromSchema(schema), // default works if parseDOM handles data-*

	// Or intercept paste for custom handling
	handlePaste(view, event, slice) {
		// slice contains marks with audio metadata intact
		const tr = view.state.tr.replaceSelection(slice).setMeta('origin', 'paste');
		view.dispatch(tr);
		return true;
	}
};
```

**Notes:**

- Metadata only survives paste within the same editor (or editors with compatible schemas). Pasting into external apps loses the metadata—just plain text transfers.
- Plain text clipboard content should strip pause/endpoint markers (user expects clean text, not `⏸️` literals).

### Custom Mark Schema

```typescript
const transcriptionMark = {
	attrs: {
		origin: { default: 'keyboard' },
		audioRef: { default: null },
		timeRange: { default: null },
		confidence: { default: null },
		utteranceId: { default: null }
	},
	toDOM(mark) {
		return [
			'span',
			{
				class: `origin-${mark.attrs.origin}`,
				'data-audio-ref': mark.attrs.audioRef,
				'data-time-range': JSON.stringify(mark.attrs.timeRange)
			},
			0
		];
	}
};
```

### Interim Text Rendering

Use ProseMirror decorations for active utterances (see also "Interim Text Styling" above):

```typescript
function utteranceDecorations(utterance: Utterance, from: number, to: number) {
	return DecorationSet.create(doc, [
		// Underline for interim text
		Decoration.inline(from, to, {
			class: 'interim-text'
		}),
		// Widget showing where next words will insert
		Decoration.widget(utterance.anchorPosition, () => {
			const marker = document.createElement('span');
			marker.className = 'transcription-cursor';
			return marker;
		})
	]);
}
```

### Handling Concurrent Input

When transcription arrives while user is typing:

```typescript
function insertTranscription(view: EditorView, text: string, utterance: Utterance) {
	const { state } = view;
	const tr = state.tr;

	// Insert at utterance anchor, not user cursor
	tr.insert(
		utterance.anchorPosition,
		schema.text(text, [
			schema.marks.transcription.create({
				origin: 'transcription',
				audioRef: utterance.audioRef,
				timeRange: utterance.timeRange
			})
		])
	);

	// Map user's selection to account for inserted text
	// (ProseMirror handles this via mapping)

	view.dispatch(tr);
}
```

---

## Feedback Loop

User corrections can feed back into the system:

```
User corrects ASR error: "realtime" was transcribed as "real time"
User selects "real time", types "realtime"

Potential actions:
1. Log correction for personal dictionary suggestion
2. Send as context/bias hint to ASR for rest of session
3. Learn that "realtime" is a frequent word for this user
```

ProseMirror's transaction history captures this:

```typescript
// Transaction 1: transcription insert
tr.insertText('This is real time transcription')
	.setMeta('origin', 'transcription')
	.setMeta('audioRef', 'rec_001');

// Transaction 2: user correction (replaceWith stores inverted step)
tr.replaceWith(8, 17, schema.text('realtime')).setMeta('origin', 'keyboard');
// Plugin can extract: oldText from inverted step, newText from transaction
```

The plugin's commit history gives us:

- What ASR said ("real time") — from inverted step
- What user meant ("realtime") — from transaction
- The audio for that segment — from mark attrs on original text

---

## Prior Art: Audapolis

[Audapolis](https://github.com/bugbakery/audapolis) is an open-source (AGPL-3.0) editor for spoken-word audio with automatic transcription. Key learnings from their implementation:

### Document Model

Audapolis uses a flat list of `DocumentItem`s with explicit paragraph markers:

```typescript
// Audapolis item types
type DocumentItem =
	| {
			type: 'paragraph_start';
			speaker: string;
			language: string | null;
			uuid: string;
	  }
	| { type: 'paragraph_end'; uuid: string }
	| {
			type: 'text';
			source: string;
			sourceStart: number;
			length: number;
			text: string;
			conf: number;
			uuid: string;
	  }
	| {
			type: 'non_text';
			source: string;
			sourceStart: number;
			length: number;
			uuid: string;
	  } // silence from recording
	| { type: 'artificial_silence'; length: number; uuid: string }; // inserted silence
```

**Key insight:** `non_text` vs `artificial_silence` distinction:

- `non_text` — silence from actual recording (has `source` reference)
- `artificial_silence` — silence inserted by user (no source, just duration)

This maps to our model: pauses from speech vs pauses from editing.

### Render Items (for Playback)

Audapolis converts document items to "render items" for playback:

```typescript
type RenderItem =
	| {
			type: 'media';
			absoluteStart: number;
			length: number;
			source: string;
			sourceStart: number;
			speaker: string | null;
	  }
	| { type: 'silence'; absoluteStart: number; length: number };
```

Adjacent items from the same source are **merged** for smoother playback. The `renderItems()` function collapses contiguous segments.

### Playback Implementation

Their `Player` class:

1. Computes render items from document
2. Tracks `currentTime` as playback position
3. For media: seeks to `sourceStart + offset` in the source element
4. For silence: uses `setTimeout`-based synthetic silence
5. Chains render items via `requestAnimationFrame` callback

**Key insight:** They use a hybrid time tracking approach:

```typescript
// Element-based time can be buggy, so they also track system clock
const elementBasedPosition =
	element.currentTime - currentRenderItem.sourceStart + currentRenderItem.absoluteStart;
const clockBasedPosition = Date.now() / 1000 - startTime + currentRenderItem.absoluteStart;
return Math.max(elementBasedPosition, clockBasedPosition);
```

### File Format

Audapolis stores documents as ZIP files containing:

- `document.json` — content, metadata, version
- `sources/` — media files referenced by ID

This is a good model for persistence—self-contained, portable.

### Speaker Diarization

They support multiple speakers per document via `paragraph_start.speaker`. The UI shows speaker names in the left margin (visible in screenshot).

### What RIFT Adds

| Audapolis                      | RIFT                                          |
| ------------------------------ | --------------------------------------------- |
| Post-hoc editing               | Real-time editing during transcription        |
| Single transcription source    | Multiple input sources (keyboard, ASR, paste) |
| Speaker as paragraph attribute | Origin metadata per word/span                 |
| Edit → replay                  | Edit → replay + TTS synthesis for typed text  |

---

## Implementation Order

Start with **Web Speech API**, then add production sources:

| Phase | Source     | Why                                                      |
| ----- | ---------- | -------------------------------------------------------- |
| 1     | Web Speech | Zero setup, fast iteration, proves architecture          |
| 2     | Sherpa     | Adds word timestamps, real `finalize`, offline support   |
| 2b    | Moonshine  | Adds diarization, smallest models, edge-first            |
| 3a    | Soniox     | Best RIFT fit: ms-finalize, semantic endpointing, tokens |
| 3b    | Voxtral    | Alternative: best price/performance (~$0.006/min)        |
| 3c    | Scribe     | Alternative if 90+ languages or diarization needed       |

**Why Web Speech first:**

- **5 lines to first result** — no WASM loading, no model downloads
- **No server required** — Sherpa/Soniox/Voxtral/Scribe WebSocket APIs work but need audio capture setup
- **Handles its own audio** — Web Speech connects directly to mic; other APIs need audio capture (`getUserMedia` → `AudioWorklet` → WebSocket). Doesn't affect our unified `Transcript` interface, but adds implementation work.
- **Architecture is source-agnostic** — Sherpa adds optional fields (`words[]`, `confidence`), doesn't change shape
- **Becomes the fallback anyway** — work isn't thrown away

**Why Soniox for Phase 3a:**

- **Manual finalization in milliseconds** — send `finalize`, get high-accuracy finals instantly. Critical for RIFT's cursor interrupt flow where latency during utterance draining directly impacts UX.
- **Semantic endpointing** — understands thought completion, not just silence. Prevents premature cuts during phone numbers, addresses, deliberate pauses. Configurable via `max_endpoint_delay_ms`.
- **Token-level `is_final` streaming** — individual tokens arrive with finality flags, mapping naturally to ProseMirror's per-word marks. Other APIs send full-transcript replacements.
- **Cheapest cloud streaming** — ~$0.002/min vs $0.006 (Voxtral) and ~$0.015 (Scribe)
- **60+ languages** with real-time diarization and translation

**When to use Voxtral instead:**

- Need open weights / self-hosting path (Apache 2.0)
- Want configurable latency-accuracy tradeoff at runtime

**When to use Scribe instead:**

- Need 90+ languages (Soniox: 60+, Voxtral: 13)
- Need automatic code-switching
- Already using ElevenLabs for TTS

**Risk is low** because:

- All sources implement the same `Transcript` type shape
- The hard part (cursor interrupt, draining, timestamp filtering) is source-agnostic
- `finalize` behavioral difference (Web Speech fakes via stop+restart) doesn't affect utterance tracker logic

## Open Questions / Next Steps

- Test latency of force-endpoint across different ASR APIs (Sherpa, Soniox, Voxtral, ElevenLabs Scribe)
- Handle Web Speech API's lack of word timestamps gracefully
- Visual treatment of interim text (underline style, fading)
- How corrections feed back to ASR (contextual biasing / personal dictionary)
- Evaluate Soniox's `context` feature (domain, topic, terms) for domain adaptation during streaming
- Test Soniox semantic endpointing vs acoustic VAD for RIFT's cursor interrupt timing
- Benchmark Soniox token-level streaming vs Scribe/Voxtral transcript-level for ProseMirror integration
- File format for persistence (consider Audapolis ZIP format as starting point)
- Experiment with different commit triggers and timing thresholds
- Consider OTIO (OpenTimelineIO) export for interop with video editors
- Monitor community tooling for Voxtral self-hosting (sherpa-onnx integration, etc.)
- Evaluate Moonshine v2 Python WebSocket bridge feasibility and latency overhead
- Test Moonshine v2 diarization quality for RIFT's speaker attribution use case
- Monitor Moonshine for word-level timestamps and WASM/browser deployment support
