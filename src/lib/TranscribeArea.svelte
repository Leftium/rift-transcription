<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import type { Transcript, TranscriptEvent, Word } from '$lib/types.js';
	import { TRANSCRIPT_EVENT, needsSpaceBefore, needsSpaceAfter } from '$lib/types.js';
	import { gg, fg, bg } from '@leftium/gg';

	interface Props extends HTMLTextareaAttributes {
		value?: string;
		placeholder?: string;
		debug?: boolean;
		showUtterances?: boolean;
		showConfidence?: boolean;
		/** When true, sets inputmode="none" to suppress mobile virtual keyboard. */
		suppressKeyboard?: boolean;
	}

	let {
		value = $bindable(''),
		placeholder = 'Type or speak...',
		debug = false,
		showUtterances = false,
		showConfidence = false,
		suppressKeyboard = false,
		oninput,
		...restProps
	}: Props = $props();

	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let containerEl: HTMLElement | undefined = $state();

	// Color schemes for gg() debug logging (match old debug log backgrounds)
	const ggTranscript = bg('#f3e5f5'); // light purple
	const ggInput = bg('#fff8e1'); // light amber

	type InterimSegment = {
		text: string;
		isFinal: boolean;
		confidence?: number;
		words?: Word[];
	};

	type UtteranceRange = { start: number; end: number; confidence?: number; words?: Word[] };
	let utteranceRanges: UtteranceRange[] = $state([]);

	// Track interims per segmentId — Web Speech fires interleaved results for
	// multiple segments simultaneously (e.g., seg=2 and seg=3 alternating).
	// Using SvelteMap for reactive .set()/.delete()/.clear() — but must use
	// .clear() not reassignment, since the variable isn't $state.
	const interims = new SvelteMap<number, InterimSegment>();

	// Insertion range: where voice text replaces in committed value.
	// Captured from selection on first interim; stays fixed until final commits.
	// null = no active voice session (next interim will capture selection).
	let insertionStart: number | null = $state(null);
	let insertionEnd: number | null = $state(null);

	// Schedule cursor restore after Svelte's DOM flush.
	// Called directly from handlers that know the desired position —
	// no effect needed, rAF runs after Svelte updates the textarea.
	function restoreCursor(pos: number) {
		const el = textareaEl;
		if (!el) return;
		requestAnimationFrame(() => {
			el.setSelectionRange(pos, pos);
		});
	}

	// After a final for segmentId N, ignore late-arriving interims for
	// segments <= N. Web Speech API fires interleaved multi-segment results
	// and seg=1 interims can arrive after seg=0's final clears the map.
	let committedThroughSegment = $state(-1);

	// When the user types during active interims, the interim text gets baked
	// into value. While true, ALL interims and finals are suppressed — the
	// entire pending utterance is stale. Cleared when a final arrives (which
	// means the engine has finished processing the baked audio).
	let interimsBaked = $state(false);

	let rawInterimText: string = $derived(
		Array.from(interims.values())
			.map((s) => s.text)
			.join('')
			.trim()
	);

	// OKLCH interpolation: teal (high confidence) → amber (low confidence).
	// Endpoints derived from #0d9488 (teal-600) and #d97706 (amber-600).
	// All three components (L, C, H) interpolate linearly with confidence.
	const TEAL = { L: 0.6, C: 0.104, H: 185 }; // #0d9488
	const AMBER = { L: 0.666, C: 0.157, H: 58 }; // #d97706
	function confidenceToColor(confidence: number | undefined): string {
		if (confidence == null) return `oklch(${TEAL.L} ${TEAL.C} ${TEAL.H})`;
		const L = AMBER.L + confidence * (TEAL.L - AMBER.L);
		const C = AMBER.C + confidence * (TEAL.C - AMBER.C);
		const H = AMBER.H + confidence * (TEAL.H - AMBER.H);
		return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
	}

	// All interim segments are stable if every segment has isFinal: true
	let interimStable: boolean = $derived(
		interims.size === 0 || Array.from(interims.values()).every((s) => s.isFinal)
	);

	// Aggregate confidence across interim segments (average), mapped to OKLCH color
	let interimColor: string = $derived.by(() => {
		const segs = Array.from(interims.values()).filter((s) => s.confidence != null);
		if (segs.length === 0) return confidenceToColor(undefined);
		const avgConf = segs.reduce((sum, s) => sum + s.confidence!, 0) / segs.length;
		return confidenceToColor(avgConf);
	});

	// Collect all words across interim segments for per-word rendering.
	// For BPE sources, trim leading whitespace from the first token —
	// All sources now emit whole-word Word objects (Sherpa coalesces BPE tokens
	// in SherpaSource). interimSpaceBefore handles smart spacing at the boundary.
	let interimWords: Word[] = $derived(Array.from(interims.values()).flatMap((s) => s.words ?? []));

	// Split committed text around insertion range for preview rendering.
	// Selected text is excluded — replaced by interim.
	let beforeCursor: string = $derived(
		insertionStart != null ? value.slice(0, insertionStart) : value
	);
	let afterCursor: string = $derived(insertionEnd != null ? value.slice(insertionEnd) : '');

	// Apply same smart spacing to interim display so preview matches final commit
	let interimSpaceBefore: string = $derived(
		rawInterimText && needsSpaceBefore(beforeCursor) ? ' ' : ''
	);
	let interimSpaceAfter: string = $derived(
		rawInterimText && needsSpaceAfter(afterCursor) ? ' ' : ''
	);
	let interimText: string = $derived(interimSpaceBefore + rawInterimText + interimSpaceAfter);

	// Textarea shows: text before cursor + interim + text after cursor
	let displayValue: string = $derived(beforeCursor + interimText + afterCursor);

	// --- Helper for utterance splitting ---

	type TextPart = { text: string; isUtterance: boolean; confidence?: number; words?: Word[] };

	function splitByUtterances(text: string, ranges: UtteranceRange[]): TextPart[] {
		if (ranges.length === 0) return [{ text, isUtterance: false }];
		const parts: TextPart[] = [];
		let pos = 0;
		for (const range of ranges) {
			if (range.start > pos) {
				parts.push({ text: text.slice(pos, range.start), isUtterance: false });
			}
			parts.push({
				text: text.slice(range.start, range.end),
				isUtterance: true,
				confidence: range.confidence,
				words: range.words
			});
			pos = range.end;
		}
		if (pos < text.length) {
			parts.push({ text: text.slice(pos), isUtterance: false });
		}
		return parts;
	}

	// --- Listen for transcript events on document ---

	function hasFocus(): boolean {
		const active = document.activeElement;
		if (!active) return false;
		// Check if focus is on our textarea or inside our container
		if (active === textareaEl) return true;
		if (containerEl?.contains(active)) return true;
		return false;
	}

	function handleTranscriptEvent(e: Event) {
		const transcript = (e as TranscriptEvent).detail;

		if (!hasFocus()) return;

		handleTranscript(transcript);
	}

	$effect(() => {
		document.addEventListener(TRANSCRIPT_EVENT, handleTranscriptEvent);
		return () => {
			document.removeEventListener(TRANSCRIPT_EVENT, handleTranscriptEvent);
		};
	});

	// Flag to distinguish voice-dispatched InputEvents from real user input
	let isVoiceCommit = false;

	// --- Transcript handling (internal) ---

	function handleTranscript(transcript: Transcript): void {
		if (debug) {
			const data = `final=${transcript.isFinal} ep=${transcript.isEndpoint} seg=${transcript.segmentId} "${transcript.text}" val=${value.length} interims=${interims.size} ins=${insertionStart}..${insertionEnd}`;
			gg.ns(
				'rift-transcription:TranscribeArea:transcript',
				ggTranscript.bold()`transcript` + ggTranscript` ${data}`
			);
		}

		if (transcript.isEndpoint) {
			// Reject finals for speech that was already baked into value
			// by keyboard input during interims — prevents duplicate text.
			// The final signals the engine is done with that utterance,
			// so clear the flag to allow the next utterance through.
			if (interimsBaked) {
				interims.clear();
				insertionStart = null;
				insertionEnd = null;
				interimsBaked = false;
				return;
			}

			// Clear ALL interims and reject late-arriving interims for any
			// segment we've seen. Web Speech fires interleaved multi-segment
			// results — seg=1 interims can arrive after seg=0's final,
			// re-populating the cleared map. Track the highest segmentId
			// across all interims so we reject ALL of them, not just seg=0.
			let maxSeen = transcript.segmentId;
			for (const id of interims.keys()) {
				if (id > maxSeen) maxSeen = id;
			}
			committedThroughSegment = maxSeen;
			const start = insertionStart ?? value.length;
			const end = insertionEnd ?? start;
			interims.clear();
			insertionStart = null;
			insertionEnd = null;

			const before = value.slice(0, start);
			const after = value.slice(end);

			// Trim — Web Speech results often have leading/trailing spaces
			// as segmentation artifacts, not intentional whitespace.
			const text = transcript.text.trim();
			if (!text) return;

			// Smart spacing: check both edges
			const spaceBefore = needsSpaceBefore(before) ? ' ' : '';
			const spaceAfter = needsSpaceAfter(after) ? ' ' : '';

			// Track utterance range for showUtterances rendering
			const insertedStart = before.length + spaceBefore.length;
			const insertedEnd = insertedStart + text.length;
			utteranceRanges = [
				...utteranceRanges,
				{
					start: insertedStart,
					end: insertedEnd,
					confidence: transcript.confidence,
					words: transcript.words
				}
			];

			value = before + spaceBefore + text + spaceAfter + after;

			// Place cursor right after the inserted text
			restoreCursor((before + spaceBefore + text + spaceAfter).length);

			// Dispatch InputEvent so consumer oninput handlers fire —
			// voice commits should be indistinguishable from keyboard input.
			if (textareaEl) {
				isVoiceCommit = true;
				textareaEl.dispatchEvent(
					new InputEvent('input', {
						bubbles: true,
						inputType: 'insertText',
						data: text
					})
				);
				isVoiceCommit = false;
			}
		} else {
			// Reject interims when baked (user typed during voice) or for
			// already-committed segments (late-arriving orphans).
			if (interimsBaked) return;
			if (transcript.segmentId <= committedThroughSegment) return;

			// Capture selection range on first interim of a voice session
			if (insertionStart == null) {
				insertionStart = textareaEl?.selectionStart ?? value.length;
				insertionEnd = textareaEl?.selectionEnd ?? insertionStart;
			}

			interims.set(transcript.segmentId, {
				text: transcript.text,
				isFinal: transcript.isFinal,
				confidence: transcript.confidence,
				words: transcript.words
			});

			// Keep cursor at end of interim preview (before afterCursor text)
			// so caret visually sits at the voice insertion point.
			const before = insertionStart != null ? value.slice(0, insertionStart) : value;
			// Compute interim text inline to get the length after spacing
			const raw = Array.from(interims.values())
				.map((s) => s.text)
				.join('')
				.trim();
			const sBefore = raw && needsSpaceBefore(before) ? ' ' : '';
			const after = insertionEnd != null ? value.slice(insertionEnd) : '';
			const sAfter = raw && needsSpaceAfter(after) ? ' ' : '';
			restoreCursor(before.length + sBefore.length + raw.length + sAfter.length);
		}
	}

	function handleInput(e: Event & { currentTarget: EventTarget & HTMLTextAreaElement }): void {
		// Voice-dispatched InputEvents: forward to consumer but don't
		// re-process — value is already updated by handleTranscript.
		if (isVoiceCommit) {
			oninput?.(e);
			return;
		}

		const rawValue = e.currentTarget.value;

		if (debug) {
			const data = `rawLen=${rawValue.length} val=${value.length} interims=${interims.size} snippet="${rawValue.slice(-40)}" trusted=${e.isTrusted} type=${(e as unknown as InputEvent).inputType}`;
			gg.ns('rift-transcription:TranscribeArea:input', ggInput.bold()`input` + ggInput` ${data}`);
		}

		// User typed while interims were active — interims are implicitly
		// committed (the textarea DOM already contains them baked into the
		// value). This is acceptable because the interim was a reasonable
		// approximation of what the speech engine heard. Mark segments as
		// baked so their finals get rejected (preventing duplicate text).
		let justBaked = false;
		if (interims.size > 0) {
			justBaked = true;
			interimsBaked = true;
			interims.clear();
			insertionStart = null;
			insertionEnd = null;
		}

		// Adjust utterance ranges to account for the user's edit.
		// When interims were just baked (user typed during voice), ranges
		// are invalidated — the displayValue included interim text that's
		// now baked in, so character offsets are meaningless.
		// Otherwise, shift ranges after the edit point and drop overlapping ones.
		// NOTE: This heuristic handles insertions, deletions, and backspace
		// correctly but may misidentify the edit region for select-and-replace.
		// In that case, overlapping ranges are conservatively dropped.
		if (justBaked || utteranceRanges.length === 0) {
			utteranceRanges = [];
		} else {
			const delta = rawValue.length - displayValue.length;
			const cursorAfter = e.currentTarget.selectionStart;
			// For insertion (delta >= 0): editStart..editStart is the insertion point
			// For deletion (delta < 0): editStart..editEnd is the deleted range
			const editStart = delta >= 0 ? cursorAfter - delta : cursorAfter;
			const editEnd = delta >= 0 ? editStart : editStart - delta;

			utteranceRanges = utteranceRanges
				.map((r) => {
					// Range entirely before edit — keep as-is
					if (r.end <= editStart) return r;
					// Range entirely after edit — shift by delta
					if (r.start >= editEnd) return { ...r, start: r.start + delta, end: r.end + delta };
					// Range overlaps edit — drop it (can't reliably adjust)
					return null;
				})
				.filter((r): r is UtteranceRange => r != null);
		}

		value = rawValue;

		// Forward to consumer's oninput handler
		oninput?.(e);
	}
</script>

<div class="transcribe-area" bind:this={containerEl}>
	<!-- Preview div: whitespace between inline elements is eliminated to prevent
	     collapsed-space misalignment vs the textarea's plain-text rendering.
	     Svelte preserves template whitespace as text nodes, so all tags/blocks
	     must be on one continuous line with no gaps. -->
	<div class="preview" aria-hidden="true">
		{#if displayValue}{#if utteranceRanges.length > 0}{@const parts = splitByUtterances(
					beforeCursor,
					utteranceRanges
				)}{#each parts as part, i (i)}{#if part.isUtterance}{#if showConfidence && part.words && part.words.length > 0}<span
								class:utterance={showUtterances}
								class:dictated={!showUtterances}
								>{#each part.words as word, wi (wi)}{#if wi > 0}{' '}{/if}<span
										class="confidence-word"
										style:color={confidenceToColor(word.confidence)}>{word.text}</span
									>{/each}</span
							>{:else if showConfidence && part.confidence != null}<span
								class:utterance={showUtterances}
								class:dictated={!showUtterances}
								style:color={confidenceToColor(part.confidence)}>{part.text}</span
							>{:else}<span class:utterance={showUtterances} class:dictated={!showUtterances}
								>{part.text}</span
							>{/if}{:else}<span class="committed">{part.text}</span>{/if}{/each}{:else}<span
					class="committed">{beforeCursor}</span
				>{/if}{#if interimWords.length > 0}{interimSpaceBefore}{#each interimWords as word, wi (wi)}{#if wi > 0}{' '}{/if}<span
						class="interim-word"
						class:stable={interimStable}
						class:unstable={!interimStable}
						style:color={confidenceToColor(word.confidence)}>{word.text}</span
					>{/each}{interimSpaceAfter}{:else if interimText}<span
					class="interim"
					class:stable={interimStable}
					class:unstable={!interimStable}
					style:color={interimColor}>{interimText}</span
				>{/if}<span class="committed">{afterCursor}</span>{:else}<span class="placeholder"
				>{placeholder}</span
			>{/if}
	</div>

	<!-- Textarea: transparent text, visible caret, handles all input -->
	<textarea
		{...restProps}
		bind:this={textareaEl}
		class="input"
		placeholder=""
		value={displayValue}
		oninput={handleInput}
		inputmode={suppressKeyboard ? 'none' : undefined}
	></textarea>
</div>

{#if debug}
	<details open class="ta-debug">
		<summary>TranscribeArea Debug</summary>
		<div class="ta-debug-state">
			<span><b>value:</b> {value.length}ch</span>
			<span><b>display:</b> {displayValue.length}ch</span>
			<span><b>interims:</b> {interims.size}</span>
			<span><b>ins:</b> {insertionStart ?? '-'}..{insertionEnd ?? '-'}</span>
			<span><b>baked:</b> {interimsBaked}</span>
			<span><b>committed≤:</b> {committedThroughSegment}</span>
			<span><b>stable:</b> {interimStable}</span>
			<span><b>color:</b> {interimColor}</span>
			<span><b>utterances:</b> {utteranceRanges.length}</span>
		</div>
		{#if interims.size > 0}
			<div class="ta-debug-interims">
				<b>Interim map:</b>
				{#each [...interims.entries()] as [seg, data] (seg)}
					<span class="ta-debug-interim"
						>seg={seg}: "{data.text}" final={data.isFinal} conf={data.confidence?.toFixed(2) ??
							'-'}</span
					>
				{/each}
			</div>
		{/if}
	</details>
{/if}

<style>
	.transcribe-area {
		position: relative;
		font-family: 'Courier New', Courier, monospace;
		font-size: 14px;
		line-height: 1.5;
		font-synthesis: none;
	}

	.preview,
	.input {
		/* Must match exactly for character alignment.
		   Browsers render <textarea> and <div> with subtly different defaults
		   for font metrics, kerning, spacing, etc. Explicitly resetting all
		   text-layout properties ensures identical character positioning.
		   See: https://github.com/panphora/overtype (same technique) */
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
		font-weight: normal;
		font-style: normal;
		font-variant: normal;
		font-stretch: normal;
		font-kerning: none;
		font-feature-settings: normal;
		font-variant-ligatures: none;
		letter-spacing: normal;
		word-spacing: normal;
		text-rendering: auto;
		-webkit-text-size-adjust: 100%;
		padding: 8px;
		margin: 0;
		border: 1px solid #ccc;
		border-radius: 4px;
		width: 100%;
		min-height: 120px;
		box-sizing: border-box;
		white-space: pre-wrap;
		word-wrap: break-word;
		overflow-wrap: break-word;
		tab-size: 4;
		-moz-tab-size: 4;
		text-indent: 0;
		resize: vertical;
	}

	.preview {
		/* Sits behind the textarea */
		pointer-events: none;
	}

	.input {
		/* Overlays the preview div */
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		height: 100%;
		background: transparent;
		color: transparent;
		caret-color: black;
		resize: none;
		overflow: auto;
	}

	.input:focus {
		outline: 2px solid #4a90d9;
		outline-offset: -1px;
	}

	.committed {
		color: #1a1a1a;
		font-weight: 600;
	}

	/* Dictated text without utterance underlines — teal at full confidence, no decoration */
	.dictated {
		color: oklch(0.6 0.104 185);
		font-weight: 600;
	}

	/* Committed voice-input text — solid underline to show utterance boundaries.
	   Color comes from inline style:color (OKLCH confidence hue) when showConfidence
	   is active; otherwise falls back to teal at full confidence. */
	.utterance {
		color: oklch(0.6 0.104 185);
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: #ccc;
		text-decoration-style: solid;
	}

	/* Per-word confidence inside an utterance — color set by inline style,
	   underline comes from the parent .utterance span to stay continuous. */
	.confidence-word {
		color: inherit;
		font-weight: 600;
	}

	/* Interim text (no per-word data)
	   Stable = dotted underline (text won't change, not yet committed)
	   Unstable = dotted underline + italic + desaturated (text may still change)
	   Color comes from inline style:color (OKLCH confidence hue) when available.
	   font-synthesis:none on .transcribe-area prevents faux-italic width drift. */
	.interim {
		text-decoration: underline;
		text-decoration-color: #bbb;
	}
	.interim.stable {
		color: oklch(0.6 0.104 185);
		font-weight: 600;
		text-decoration-style: dotted;
	}
	.interim.unstable {
		color: oklch(0.6 0.06 185);
		font-weight: 600;
		text-decoration-style: dotted;
		font-style: italic;
	}

	/* Per-word interim rendering — inline style:color sets OKLCH confidence hue */
	.interim-word {
		text-decoration: underline;
		text-decoration-color: #bbb;
	}
	.interim-word.stable {
		font-weight: 600;
		text-decoration-style: dotted;
	}
	.interim-word.unstable {
		font-weight: 600;
		text-decoration-style: dotted;
		font-style: italic;
	}

	.placeholder {
		color: #999;
	}

	.transcribe-area:has(.input:disabled) {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.input:disabled {
		cursor: not-allowed;
	}

	.ta-debug {
		margin-top: 8px;
		font-size: 11px;
		font-family: 'Courier New', Courier, monospace;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 4px 8px;
	}
	.ta-debug summary {
		cursor: pointer;
		font-weight: 600;
		font-size: 12px;
	}
	.ta-debug-state {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 4px 0;
		border-bottom: 1px solid #eee;
	}
	.ta-debug-interims {
		padding: 4px 0;
		border-bottom: 1px solid #eee;
	}
	.ta-debug-interim {
		display: block;
		padding-left: 8px;
		color: #888;
	}
</style>
