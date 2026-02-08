/**
 * VoiceInputController — reactive controller for voice input lifecycle.
 *
 * Encapsulates source creation, auto-listen on focus/blur, and toggle UI state.
 * Usage:
 *   const voice = new VoiceInputController();
 *   <button onclick={voice.toggle}>{voice.enabled ? 'Disable' : 'Enable'}</button>
 *   <div {@attach voice.autoListen}>...</div>
 */

import { isErr } from 'wellcrafted/result';
import { WebSpeechSource } from '$lib/sources/web-speech.svelte';

export class VoiceInputController {
	#source: WebSpeechSource | null = null;
	#container: HTMLElement | null = null;

	enabled = $state(false);

	get listening(): boolean {
		return this.#source?.listening ?? false;
	}

	// --- Source lifecycle ---

	#ensureSource(): WebSpeechSource {
		if (!this.#source) {
			this.#source = new WebSpeechSource();
			this.#source.onError = (error, message) => {
				this.enabled = false;
				console.error(`[VoiceInput] Fatal error: ${error} — ${message}`);
			};
		}
		return this.#source;
	}

	#start() {
		const s = this.#ensureSource();
		if (!s.listening) {
			const result = s.startListening();
			if (isErr(result)) {
				console.error(result.error.message);
			}
		}
	}

	#stop() {
		this.#source?.stopListening();
	}

	// --- Public API ---

	toggle = () => {
		if (this.enabled) {
			this.enabled = false;
			this.#stop();
		} else {
			this.enabled = true;
			// Focus the container's textarea so focusin → #start() fires,
			// and future focusout pausing works correctly.
			this.#focusContainer();
		}
	};

	#focusContainer() {
		if (!this.#container) return;
		// Find the textarea inside the container (or the container itself if focusable)
		const target =
			this.#container.querySelector<HTMLElement>('textarea, [contenteditable]') ?? this.#container;
		target.focus();
	}

	/** Attachment — auto-pauses/resumes listening on focus/blur of container.
	 *  IMPORTANT: Does not read $state in the body to avoid Svelte re-running
	 *  the attachment on every enabled/listening change. All reactive reads
	 *  happen inside event handlers (which don't create reactive dependencies). */
	autoListen = (node: HTMLElement) => {
		this.#container = node;

		const handleFocusIn = () => {
			if (this.enabled) {
				this.#start();
			}
		};

		const handleFocusOut = (e: FocusEvent) => {
			const goingTo = e.relatedTarget as Node | null;
			if (!this.enabled) return;
			if (goingTo && node.contains(goingTo)) return;

			// When relatedTarget is null, focus moved to a non-focusable element
			// (page background) OR the browser/speech prompt stole focus.
			// Check if focus actually left the container via activeElement.
			if (!goingTo) {
				// If activeElement is still inside the container, focus didn't
				// really leave (e.g., Chrome speech prompt stole then returned).
				if (node.contains(document.activeElement)) return;
			}

			this.#stop();
		};

		node.addEventListener('focusin', handleFocusIn);
		node.addEventListener('focusout', handleFocusOut);

		return () => {
			node.removeEventListener('focusin', handleFocusIn);
			node.removeEventListener('focusout', handleFocusOut);
			this.#container = null;
		};
	};
}
