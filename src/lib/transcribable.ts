/**
 * transcribable — Svelte attachment that makes any <textarea> receive voice input.
 *
 * Listens for 'rift:transcript' CustomEvents on document. When the textarea
 * is focused and an endpoint transcript arrives, inserts text at the cursor
 * using execCommand('insertText') — which:
 *   - Updates the textarea's value
 *   - Fires a native 'input' event
 *   - Creates an undo stack entry
 *   - Respects the current selection (replaces it)
 *
 * Non-endpoint transcripts are ignored — plain textareas can't style inline
 * ranges. For interim/stability display, use TranscribeArea instead.
 *
 * Usage:
 *   <textarea {@attach transcribable} bind:value />
 */

import { TRANSCRIPT_EVENT, needsSpaceBefore, needsSpaceAfter } from '$lib/types.js';
import type { Transcript, TranscriptEvent } from '$lib/types.js';

export function transcribable(node: HTMLTextAreaElement) {
	function handleTranscriptEvent(e: Event) {
		const transcript = (e as TranscriptEvent).detail;

		// Only handle endpoints — plain textareas can't show interims/stability
		if (!transcript.isEndpoint) return;

		// Only act when this textarea is focused
		if (document.activeElement !== node) return;

		const text = transcript.text.trim();
		if (!text) return;

		// Build the text to insert with smart spacing
		const before = node.value.slice(0, node.selectionStart);
		const after = node.value.slice(node.selectionEnd);
		const spaceBefore = needsSpaceBefore(before) ? ' ' : '';
		const spaceAfter = needsSpaceAfter(after) ? ' ' : '';
		const insertText = spaceBefore + text + spaceAfter;

		// execCommand('insertText') is deprecated but is the ONLY way to
		// programmatically insert text into a textarea that:
		//   1. Fires a native 'input' event
		//   2. Creates an undo stack entry
		//   3. Respects the current selection
		// There is no replacement API. All browsers still support it.
		node.focus();
		document.execCommand('insertText', false, insertText);
	}

	document.addEventListener(TRANSCRIPT_EVENT, handleTranscriptEvent);

	return () => {
		document.removeEventListener(TRANSCRIPT_EVENT, handleTranscriptEvent);
	};
}
