/**
 * WebSpeechSource — TranscriptionSource adapter for the Web Speech API.
 *
 * Uses browser-native SpeechRecognition. Zero dependencies, works immediately.
 * See: specs/rift-transcription.md "Web Speech API" section.
 *
 * Limitations:
 * - No word-level timestamps
 * - No confidence scores per word
 * - finalize() faked via stop + restart (higher latency)
 * - Chrome silently kills recognition after ~60s silence / ~5min continuous
 */

import { Ok } from 'wellcrafted/result';
import type { TranscriptionSource, Transcript } from '$lib/types.js';
import { SourceErr } from '$lib/types.js';

// ---------------------------------------------------------------------------
// Browser type shim — SpeechRecognition is not in lib.dom.d.ts everywhere
// ---------------------------------------------------------------------------

type SpeechRecognitionEvent = {
	resultIndex: number;
	results: SpeechRecognitionResultList;
};

type SpeechRecognitionResultList = {
	readonly length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
};

type SpeechRecognitionResult = {
	readonly length: number;
	readonly isFinal: boolean;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionAlternative = {
	readonly transcript: string;
	readonly confidence: number;
};

type SpeechRecognitionErrorEvent = {
	error: string;
	message: string;
};

type SpeechRecognitionInstance = {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	start(): void;
	stop(): void;
	abort(): void;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onend: (() => void) | null;
	onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
	if (typeof window === 'undefined') return null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const w = window as any;
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ---------------------------------------------------------------------------
// WebSpeechSource
// ---------------------------------------------------------------------------

export function createWebSpeechSource(lang = 'en-US'): WebSpeechSource {
	return new WebSpeechSource(lang);
}

export class WebSpeechSource implements TranscriptionSource {
	readonly name = 'web-speech';

	onResult: ((result: Transcript) => void) | null = null;
	onError: ((error: string, message: string) => void) | null = null;

	/** Reactive — true while recognition is active. */
	listening = $state(false);

	private recognition: SpeechRecognitionInstance | null = null;
	private shouldBeListening = false;
	private nextSegmentId = 0;

	constructor(private lang: string = 'en-US') {}

	startListening() {
		const Ctor = getSpeechRecognition();
		if (!Ctor) {
			return SourceErr({
				message: 'Web Speech API not available in this browser',
				context: { source: this.name }
			});
		}

		if (this.shouldBeListening) {
			return Ok(undefined);
		}

		this.shouldBeListening = true;
		this.startRecognition(Ctor);
		return Ok(undefined);
	}

	stopListening() {
		this.shouldBeListening = false;
		if (this.recognition) {
			this.recognition.onend = null; // prevent auto-restart
			this.recognition.stop();
			this.recognition = null;
		}
		this.listening = false;
		return Ok(undefined);
	}

	finalize() {
		// Web Speech has no native finalize — fake it via stop + restart.
		// The onend handler will restart if shouldBeListening is still true.
		if (this.recognition && this.shouldBeListening) {
			this.recognition.stop();
			// Bump segmentId so the next utterance gets a new ID
			this.nextSegmentId++;
		}
	}

	// -----------------------------------------------------------------------
	// Private
	// -----------------------------------------------------------------------

	private startRecognition(Ctor: SpeechRecognitionConstructor) {
		const recognition = new Ctor();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = this.lang;
		this.recognition = recognition;

		recognition.onstart = () => {
			this.listening = true;
		};

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			if (!this.onResult) return;

			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const alt = result[0];

				// Use resultIndex as segmentId — groups interims with their final
				const segmentId = this.nextSegmentId + i;

				const transcript: Transcript = {
					text: alt.transcript,
					isFinal: result.isFinal,
					isEndpoint: result.isFinal, // Web Speech: final ≈ endpoint
					segmentId,
					confidence: alt.confidence > 0 ? alt.confidence : undefined
				};

				this.onResult(transcript);

				// After a final, bump the segment counter past this index
				if (result.isFinal) {
					this.nextSegmentId = segmentId + 1;
				}
			}
		};

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			// 'no-speech' and 'aborted' are expected during normal lifecycle
			if (event.error === 'no-speech' || event.error === 'aborted') return;

			console.error(`[WebSpeechSource] error: ${event.error} — ${event.message}`);

			// Fatal errors — stop the restart loop
			this.shouldBeListening = false;
			this.listening = false;
			this.onError?.(event.error, event.message);
		};

		recognition.onend = () => {
			this.listening = false;

			// Chrome kills recognition periodically — restart if we should still be listening
			if (this.shouldBeListening) {
				const Ctor = getSpeechRecognition();
				if (Ctor) {
					this.startRecognition(Ctor);
				}
			}
		};

		recognition.start();
	}
}
