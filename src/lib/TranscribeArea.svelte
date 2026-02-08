<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { Transcript, TranscriptEvent } from '$lib/types.js';
	import { TRANSCRIPT_EVENT, needsSpaceBefore, needsSpaceAfter } from '$lib/types.js';

	interface Props {
		value: string;
		placeholder?: string;
		disabled?: boolean;
		oninput?: (e: Event) => void;
	}

	let {
		value = $bindable(''),
		placeholder = 'Type or speak...',
		disabled = false,
		oninput
	}: Props = $props();

	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let containerEl: HTMLElement | undefined = $state();

	// Track interims per segmentId — Web Speech fires interleaved results for
	// multiple segments simultaneously (e.g., seg=2 and seg=3 alternating).
	// Using SvelteMap for reactive .set()/.delete()/.clear() — but must use
	// .clear() not reassignment, since the variable isn't $state.
	const interims = new SvelteMap<number, string>();

	// Insertion range: where voice text replaces in committed value.
	// Captured from selection on first interim; stays fixed until final commits.
	// null = no active voice session (next interim will capture selection).
	let insertionStart: number | null = $state(null);
	let insertionEnd: number | null = $state(null);

	// Desired cursor position after Svelte updates the textarea value.
	// null = don't interfere (let browser handle, e.g. after user typing).
	let cursorAfterUpdate: number | null = $state(null);

	// After a final for segmentId N, ignore late-arriving interims for
	// segments <= N. Web Speech API fires interleaved multi-segment results
	// and seg=1 interims can arrive after seg=0's final clears the map.
	let committedThroughSegment = -1;

	let rawInterimText: string = $derived(Array.from(interims.values()).join('').trim());

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

	// Restore cursor position after Svelte writes displayValue to textarea.
	// Reads displayValue to create a reactive dependency so this runs
	// every time the textarea content actually changes.
	$effect(() => {
		displayValue; // reactive dependency
		untrack(() => {
			if (cursorAfterUpdate != null && textareaEl) {
				textareaEl.setSelectionRange(cursorAfterUpdate, cursorAfterUpdate);
				cursorAfterUpdate = null;
			}
		});
	});

	// Flag to distinguish voice-dispatched InputEvents from real user input
	let isVoiceCommit = false;

	// --- Transcript handling (internal) ---

	function handleTranscript(transcript: Transcript): void {
		if (transcript.isFinal) {
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

			value = before + spaceBefore + text + spaceAfter + after;

			// Place cursor right after the inserted text
			cursorAfterUpdate = (before + spaceBefore + text + spaceAfter).length;

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
			// Reject late-arriving interims for already-committed segments.
			// Web Speech fires interleaved results — seg=1 interims can
			// arrive after seg=0's final cleared the map.
			if (transcript.segmentId <= committedThroughSegment) return;

			// Capture selection range on first interim of a voice session
			if (insertionStart == null) {
				insertionStart = textareaEl?.selectionStart ?? value.length;
				insertionEnd = textareaEl?.selectionEnd ?? insertionStart;
			}

			interims.set(transcript.segmentId, transcript.text);

			// Keep cursor at end of interim preview (before afterCursor text)
			// so caret visually sits at the voice insertion point.
			const before = insertionStart != null ? value.slice(0, insertionStart) : value;
			// Compute interim text inline to get the length after spacing
			const raw = Array.from(interims.values()).join('').trim();
			const sBefore = raw && needsSpaceBefore(before) ? ' ' : '';
			const after = insertionEnd != null ? value.slice(insertionEnd) : '';
			const sAfter = raw && needsSpaceAfter(after) ? ' ' : '';
			cursorAfterUpdate = before.length + sBefore.length + raw.length + sAfter.length;
		}
	}

	function handleInput(e: Event): void {
		// Voice-dispatched InputEvents: forward to consumer but don't
		// re-process — value is already updated by handleTranscript.
		if (isVoiceCommit) {
			oninput?.(e);
			return;
		}

		const target = e.target as HTMLTextAreaElement;
		const rawValue = target.value;

		// If there was interim text and user typed, interims are implicitly cancelled
		if (interims.size > 0) {
			interims.clear();
			insertionStart = null;
			insertionEnd = null;
		}

		value = rawValue;

		// Forward to consumer's oninput handler
		oninput?.(e);
	}
</script>

<div class="transcribe-area" bind:this={containerEl}>
	<!-- Preview div: renders text with interim styling -->
	<div class="preview" aria-hidden="true">
		{#if displayValue}
			<span class="committed">{beforeCursor}</span><span class="interim">{interimText}</span><span
				class="committed">{afterCursor}</span
			>
		{:else}
			<span class="placeholder">{placeholder}</span>
		{/if}
	</div>

	<!-- Textarea: transparent text, visible caret, handles all input -->
	<textarea
		bind:this={textareaEl}
		class="input"
		{disabled}
		placeholder=""
		value={displayValue}
		oninput={handleInput}
	></textarea>
</div>

<style>
	.transcribe-area {
		position: relative;
		font-family: 'Courier New', Courier, monospace;
		font-size: 14px;
		line-height: 1.5;
	}

	.preview,
	.input {
		/* Must match exactly for character alignment */
		font-family: inherit;
		font-size: inherit;
		line-height: inherit;
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
	}

	.interim {
		color: #888;
		text-decoration: underline;
		text-decoration-color: #bbb;
		text-decoration-style: dotted;
	}

	.placeholder {
		color: #999;
	}

	.input:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}
</style>
