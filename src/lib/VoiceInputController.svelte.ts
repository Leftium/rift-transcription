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
			const s = this.#ensureSource();
			if (!s.listening) {
				const result = s.startListening();
				if (isErr(result)) {
					console.error(result.error.message);
					return;
				}
			}
			this.enabled = true;
		}
	};

	/** Attachment — auto-pauses/resumes listening on focus/blur of container. */
	autoListen = (node: HTMLElement) => {
		const handleFocusIn = () => {
			if (this.enabled) {
				this.#start();
			}
		};

		const handleFocusOut = (e: FocusEvent) => {
			if (!this.enabled) return;
			const goingTo = e.relatedTarget as Node | null;
			if (goingTo && node.contains(goingTo)) return;
			this.#stop();
		};

		node.addEventListener('focusin', handleFocusIn);
		node.addEventListener('focusout', handleFocusOut);

		return () => {
			node.removeEventListener('focusin', handleFocusIn);
			node.removeEventListener('focusout', handleFocusOut);
		};
	};
}
