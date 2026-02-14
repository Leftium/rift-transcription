/**
 * VoiceInputController — reactive controller for voice input lifecycle.
 *
 * Encapsulates source creation, manual start/stop, and toggle UI state.
 * Supports multiple transcription sources (Web Speech API, Sherpa-ONNX, etc.).
 *
 * Manual mode: toggle() directly starts/stops the source. Listening persists
 * regardless of focus — no auto-pause on blur. On mobile, textareas use
 * inputmode="none" while voice is enabled to suppress the virtual keyboard.
 *
 * Usage:
 *   const voice = new VoiceInputController();
 *   <button onclick={voice.toggle}>{voice.enabled ? 'Stop' : 'Start'}</button>
 */

import { isErr } from 'wellcrafted/result';
import type { TranscriptionSource } from '$lib/types.js';
import { WebSpeechSource } from '$lib/sources/web-speech.svelte';
import { SherpaSource } from '$lib/sources/sherpa.svelte';
import { DeepgramSource } from '$lib/sources/deepgram.svelte';

export type SourceType = 'web-speech' | 'sherpa' | 'deepgram';

export class VoiceInputController {
	#source: TranscriptionSource | null = $state(null);

	enabled = $state(false);
	sourceType = $state<SourceType>('web-speech');
	sherpaUrl = $state('ws://localhost:6006');
	deepgramApiKey = $state('');

	get listening(): boolean {
		return this.#source?.listening ?? false;
	}

	/** Reactive — true while WebSocket is connected (sherpa/deepgram). */
	get connected(): boolean {
		const s = this.#source;
		if (s && 'connected' in s) {
			return (s as SherpaSource | DeepgramSource).connected;
		}
		return false;
	}

	// --- Source lifecycle ---

	#ensureSource(): TranscriptionSource {
		if (!this.#source) {
			if (this.sourceType === 'deepgram') {
				this.#source = new DeepgramSource(this.deepgramApiKey);
			} else if (this.sourceType === 'sherpa') {
				this.#source = new SherpaSource(this.sherpaUrl);
			} else {
				this.#source = new WebSpeechSource();
			}
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
			this.#start();
		}
	};

	/** Switch transcription source. Stops current, destroys, next start uses new type.
	 *  Accepts string for direct use with <select> onchange values. */
	setSource(type: SourceType | string, url?: string) {
		const wasEnabled = this.enabled;
		if (wasEnabled) {
			this.enabled = false;
			this.#stop();
		}
		this.#source = null;
		this.sourceType = type as SourceType;
		if (url !== undefined) this.sherpaUrl = url;
		if (wasEnabled) {
			this.enabled = true;
			this.#start();
		}
	}
}
