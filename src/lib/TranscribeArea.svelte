<script lang="ts">
	import type { Transcript } from '$lib/types.js';

	interface Props {
		value: string;
		placeholder?: string;
		disabled?: boolean;
	}

	let {
		value = $bindable(''),
		placeholder = 'Type or speak...',
		disabled = false
	}: Props = $props();

	let textareaEl: HTMLTextAreaElement | undefined = $state();

	// Track interims per segmentId — Web Speech fires interleaved results for
	// multiple segments simultaneously (e.g., seg=2 and seg=3 alternating).
	let interims = $state(new Map<number, string>());

	// Insertion range: where voice text replaces in committed value.
	// Captured from selection on first interim; stays fixed until final commits.
	// null = no active voice session (next interim will capture selection).
	let insertionStart: number | null = $state(null);
	let insertionEnd: number | null = $state(null);

	let rawInterimText: string = $derived(Array.from(interims.values()).join('').trim());

	// Split committed text around insertion range for preview rendering.
	// Selected text is excluded — replaced by interim.
	let beforeCursor: string = $derived(
		insertionStart != null ? value.slice(0, insertionStart) : value
	);
	let afterCursor: string = $derived(insertionEnd != null ? value.slice(insertionEnd) : '');

	// Apply same smart spacing to interim display so preview matches final commit
	let interimSpaceBefore: string = $derived(
		rawInterimText && beforeCursor.length > 0 && !/\s$/.test(beforeCursor) ? ' ' : ''
	);
	let interimSpaceAfter: string = $derived(
		rawInterimText && afterCursor.length > 0 && !/^\s/.test(afterCursor) ? ' ' : ''
	);
	let interimText: string = $derived(interimSpaceBefore + rawInterimText + interimSpaceAfter);

	// Textarea shows: text before cursor + interim + text after cursor
	let displayValue: string = $derived(beforeCursor + interimText + afterCursor);

	export function handleTranscript(transcript: Transcript): void {
		if (transcript.isFinal) {
			// Clear ALL interims FIRST — before updating value — so both
			// changes land in the same reactive tick. Otherwise the stale
			// orphaned interim (e.g., "cool") is briefly visible alongside
			// the newly committed final ("this is pretty cool").
			const start = insertionStart ?? value.length;
			const end = insertionEnd ?? start;
			interims = new Map();
			insertionStart = null;
			insertionEnd = null;

			const before = value.slice(0, start);
			const after = value.slice(end);

			// Trim — Web Speech results often have leading/trailing spaces
			// as segmentation artifacts, not intentional whitespace.
			const text = transcript.text.trim();
			if (!text) return;

			// Smart spacing: check both edges
			const needSpaceBefore = before.length > 0 && !/\s$/.test(before);
			const needSpaceAfter = after.length > 0 && !/^\s/.test(after);

			value = before + (needSpaceBefore ? ' ' : '') + text + (needSpaceAfter ? ' ' : '') + after;
		} else {
			// Capture selection range on first interim of a voice session
			if (insertionStart == null) {
				insertionStart = textareaEl?.selectionStart ?? value.length;
				insertionEnd = textareaEl?.selectionEnd ?? insertionStart;
			}

			interims.set(transcript.segmentId, transcript.text);
			// Trigger reactivity
			interims = new Map(interims);
		}
	}

	function handleInput(e: Event): void {
		const target = e.target as HTMLTextAreaElement;
		const rawValue = target.value;

		// If there was interim text and user typed, interims are implicitly cancelled
		if (interims.size > 0) {
			interims = new Map();
			insertionStart = null;
			insertionEnd = null;
		}

		value = rawValue;
	}
</script>

<div class="transcribe-area">
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
