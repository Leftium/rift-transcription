# Realtime Interactive Fluid Transcription (RIFT)

- **Realtime:** each word is transformed into text as you speak (not after)
- **Interactive:** click, select, type—even while transcription is in progress
- **Fluid:** switch between speaking and editing (ASR catches up in background)
- **Time-travel:** undo any edit or play back audio in edited order

## Usage scenario

1. Speak: `This is realtime transcription`
2. Edit: select `realtime`, speak `fluid`
3. Result: `This is fluid transcription`

### More Examples

| Goal                | Original Transcription | Editing Actions                                         | Result                      |
| ------------------- | ---------------------- | ------------------------------------------------------- | --------------------------- |
| **Insert (voice)**  | Send the report        | 1. click after `the`<br>2. speak `quarterly`            | Send the _quarterly_ report |
| **Insert (typed)**  | Call me tomorrow       | 1. click after `me`<br>2. type ` back`                  | Call me _back_ tomorrow     |
| **Replace (voice)** | Meet at the cafe       | 1. select `cafe`<br>2. speak `library`                  | Meet at the _library_       |
| **Fix homophone**   | Your welcome           | 1. select `Your welcome`<br>2. 🪄 Enhance Transcription | _You're welcome_            |
| **Delete + voice**  | The very big dog       | 1. select `very big`<br>2. speak `small`                | The _small_ dog             |
| **Format (mixed)**  | Yes                    | 1. type ` (`<br>2. speak `finally`<br>3. type `!)`      | Yes _(finally!)_            |
| **Type then speak** |                        | 1. type `Svelte `\*<br>2. speak `component`             | _Svelte component_          |

\*ASR often transcribes "Svelte" as "Belt", "Help", "Spelt", etc.

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
		anchorPosition: position,
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
		'data-utterance': utteranceId,
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
							timeRange: mark.attrs.timeRange,
						}
					: undefined,
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
		timeRange: {}, // [start, end] in recording
	},
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
		timeRange: { default: null },
	},
	toDOM(node) {
		return [
			'span',
			{
				class: 'pause-marker',
				'data-duration': node.attrs.duration,
				title: `${node.attrs.duration}ms pause`,
			},
			'⏸️',
		];
	},
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

## Transcription Backends

Three backends with different tradeoffs:

| Backend               | Purpose                               | Latency             | Accuracy  | Setup         |
| --------------------- | ------------------------------------- | ------------------- | --------- | ------------- |
| **Web Speech API**    | Zero-config demo, broad compatibility | Medium (~300-500ms) | Good      | None          |
| **Sherpa**            | Research, optimal latency             | Low (~100-200ms)    | Good      | Local install |
| **ElevenLabs Scribe** | Production accuracy                   | Higher (~500ms+)    | Excellent | API key       |

### Web Speech API

Browser-native speech recognition. Zero dependencies, works immediately.

```typescript
type WebSpeechBackend = {
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

**Best for:** Demos, quick prototyping, users who don't want to install anything.

### Sherpa (sherpa-onnx)

Local ASR via WebAssembly or native. Full control, no network dependency.

```typescript
type SherpaBackend = {
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

**Best for:** Research, latency-sensitive use cases, privacy-conscious users.

### ElevenLabs Scribe

Cloud API with state-of-the-art accuracy. Two modes:

```typescript
type ScribeBackend = {
	type: 'scribe';
	apiKey: string;
	mode: 'streaming' | 'batch';
};
```

**Streaming mode:** Real-time via WebSocket, similar latency profile to Sherpa.

**Batch mode:** Upload audio, get polished transcript. Higher accuracy, higher latency.

**Best for:** Production use, when accuracy matters more than latency.

### Unified Interface

All backends implement the same interface:

```typescript
import { Result, Ok, Err } from 'wellcrafted/result';
import { createTaggedError } from 'wellcrafted/error';

// Errors
const { TranscriptionError, TranscriptionErr } = createTaggedError(
	'TranscriptionError',
).withContext<{ backend: string }>();
type TranscriptionError = ReturnType<typeof TranscriptionError>;

// Backend interface
interface TranscriptionBackend {
	readonly name: string; // 'sherpa' | 'scribe' | 'web-speech'

	start(): Result<void, TranscriptionError>;
	stop(): Result<void, TranscriptionError>;
	finalize(): void; // Force endpoint (Web Speech: stop + restart)

	onResult: (result: Transcript) => void;
}

// Aligned with transcription-rs Transcript type
type Transcript = {
	text: string;

	// Result-level finality
	isFinal: boolean; // this result won't be revised
	isEndpoint: boolean; // natural speech boundary (pause/silence)
	segmentId: number; // correlates partials with their final

	// Timing (seconds)
	start?: number;
	end?: number;

	// Metadata
	confidence?: number;
	language?: string;

	// Word-level detail
	words?: Word[];
};

type Word = {
	text: string;
	start: number;
	end: number;
	confidence?: number;
};
```

**Backend capability matrix:**

| Field         | Web Speech           | Sherpa | Scribe |
| ------------- | -------------------- | ------ | ------ |
| `text`        | ✓                    | ✓      | ✓      |
| `isFinal`     | ✓                    | ✓      | ✓      |
| `isEndpoint`  | forced only          | ✓      | ✓      |
| `segmentId`   | ✓ (client-generated) | ✓      | ✓      |
| `start`/`end` | ✗                    | ✓      | ✓      |
| `words`       | ✗                    | ✓      | ✓      |
| `confidence`  | ✗                    | ✓      | ✓      |

**Notes:**

- Web Speech API's `finalize()` implemented as stop + restart (higher latency)
- Web Speech lacks timing/word data—utterance tracker treats full transcript as single segment
- Uses WellCrafted Result type for explicit error handling

### Backend Selection Logic

Auto-detect best available backend, fall back to Web Speech API:

```typescript
const { BackendError, BackendErr } = createTaggedError('BackendError');
type BackendError = ReturnType<typeof BackendError>;

function detectBackend(): Result<TranscriptionBackend, BackendError> {
	// Prefer Sherpa if available (e.g., WASM loaded, native module present)
	if (isSherpaAvailable()) {
		return Ok(createSherpaBackend(config));
	}

	// Prefer Scribe if API key configured
	if (config.scribeApiKey) {
		return Ok(createScribeBackend(config));
	}

	// Fall back to Web Speech API (zero-config, works in most browsers)
	if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
		return Ok(createWebSpeechBackend());
	}

	return BackendErr({ message: 'No transcription backend available' });
}

// Allow explicit override
function selectBackend(
	config: Config,
): Result<TranscriptionBackend, BackendError> {
	if (config.preferredBackend) {
		return Ok(createBackend(config.preferredBackend));
	}
	return detectBackend();
}
```

**Priority order:**

1. Sherpa (if available) — best latency, offline, no API costs
2. Scribe (if API key configured) — best accuracy
3. Web Speech API — zero-config fallback

### Hot-Swapping Backends

Switch backends on the fly without losing state:

```typescript
class TranscriptionManager {
	private backend: TranscriptionBackend;
	private audioBuffer: Float32Array[] = []; // keep recent audio for re-transcription

	switchBackend(
		newBackend: TranscriptionBackend,
	): Result<void, TranscriptionError> {
		// Finalize current utterance
		this.backend.finalize();

		// Swap
		const { error } = this.backend.stop();
		if (error) return error;

		this.backend = newBackend;
		this.backend.onResult = this.handleResult.bind(this);

		return this.backend.start();
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
      backend: 'scribe',
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
- Utterance tracker handles backend changes transparently
- UI shows which backend produced each segment (optional)
- Replace text in ProseMirror when batch result arrives

---

## Planned Tech Stack

- **Transcription** — Web Speech API (demo) / Sherpa (research) / Scribe (production)
- **ElevenLabs TTS** — Synthesize typed text, potentially voice-cloned

---

## Editor Implementation

### Why Not Textarea?

Regular `<textarea>` won't work because we need:

1. **Rich spans with metadata** — each word/phrase knows its origin, audio ref, timestamps
2. **Multiple cursors/anchors** — transcription insertion point vs user cursor
3. **Custom rendering** — interim text styling, confidence highlighting
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
					audioRef,
				}));
				return {
					...tracked,
					uncommittedSteps: tracked.uncommittedSteps.concat(inverted),
				};
			}
			return tracked;
		},
	},
});

// When inserting transcription
view.dispatch(
	tr
		.insert(pos, content)
		.setMeta('origin', 'transcription')
		.setMeta('audioRef', utterance.audioRef)
		.setMeta('timeRange', [start, end]),
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
	},
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
		utteranceId: { default: null },
	},
	toDOM(mark) {
		return [
			'span',
			{
				class: `origin-${mark.attrs.origin}`,
				'data-audio-ref': mark.attrs.audioRef,
				'data-time-range': JSON.stringify(mark.attrs.timeRange),
			},
			0,
		];
	},
};
```

### Interim Text Rendering

Use ProseMirror decorations for active utterances (see also "Interim Text Styling" above):

```typescript
function utteranceDecorations(utterance: Utterance, from: number, to: number) {
	return DecorationSet.create(doc, [
		// Underline for interim text
		Decoration.inline(from, to, {
			class: 'interim-text',
		}),
		// Widget showing where next words will insert
		Decoration.widget(utterance.anchorPosition, () => {
			const marker = document.createElement('span');
			marker.className = 'transcription-cursor';
			return marker;
		}),
	]);
}
```

### Handling Concurrent Input

When transcription arrives while user is typing:

```typescript
function insertTranscription(
	view: EditorView,
	text: string,
	utterance: Utterance,
) {
	const { state } = view;
	const tr = state.tr;

	// Insert at utterance anchor, not user cursor
	tr.insert(
		utterance.anchorPosition,
		schema.text(text, [
			schema.marks.transcription.create({
				origin: 'transcription',
				audioRef: utterance.audioRef,
				timeRange: utterance.timeRange,
			}),
		]),
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
	element.currentTime -
	currentRenderItem.sourceStart +
	currentRenderItem.absoluteStart;
const clockBasedPosition =
	Date.now() / 1000 - startTime + currentRenderItem.absoluteStart;
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

Start with **Web Speech API**, then add Sherpa:

| Phase | Backend    | Why                                                    |
| ----- | ---------- | ------------------------------------------------------ |
| 1     | Web Speech | Zero setup, fast iteration, proves architecture        |
| 2     | Sherpa     | Adds word timestamps, real `finalize`, offline support |
| 3     | Scribe     | Production accuracy, batch re-transcription            |

**Why Web Speech first:**

- **5 lines to first result** — no WASM loading, no model downloads
- **No server required** — Sherpa/Scribe WebSocket APIs work but need a running server
- **Handles its own audio** — Web Speech connects directly to mic; other APIs need audio capture (`getUserMedia` → `AudioWorklet` → WebSocket). Doesn't affect our unified `Transcript` interface, but adds implementation work.
- **Architecture is backend-agnostic** — Sherpa adds optional fields (`words[]`, `confidence`), doesn't change shape
- **Becomes the fallback anyway** — work isn't thrown away

**Risk is low** because:

- Sherpa's richer API adds fields, doesn't change the `Transcript` type shape
- The hard part (cursor interrupt, draining, timestamp filtering) is backend-agnostic
- `finalize` behavioral difference (Web Speech fakes via stop+restart) doesn't affect utterance tracker logic

## Open Questions / Next Steps

- Test latency of force-endpoint across different ASR APIs (Sherpa, ElevenLabs Scribe)
- Handle Web Speech API's lack of word timestamps gracefully
- Visual treatment of interim text (underline style, fading)
- How corrections feed back to ASR (contextual biasing / personal dictionary)
- File format for persistence (consider Audapolis ZIP format as starting point)
- Experiment with different commit triggers and timing thresholds
- Consider OTIO (OpenTimelineIO) export for interop with video editors
