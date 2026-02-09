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
import { SourceErr, broadcastTranscript } from '$lib/types.js';

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

export class WebSpeechSource implements TranscriptionSource {
	readonly name = 'web-speech';

	/** Callback for results. Defaults to broadcastTranscript (dispatches
	 *  CustomEvent on document). Override for custom routing. */
	onResult: ((result: Transcript) => void) | null = broadcastTranscript;
	onError: ((error: string, message: string) => void) | null = null;

	/** Reactive — true while recognition is active. */
	listening = $state(false);

	private recognition: SpeechRecognitionInstance | null = null;
	private shouldBeListening = false;

	// Track which result indices have already been finalized.
	// Android Chrome re-delivers the entire results array on every onresult
	// (resultIndex=0 every time), so without this guard old finals get
	// re-emitted with new segmentIds, causing cumulative text duplication.
	private finalizedResultIndices = new Set<number>();

	// Track cumulative final text to extract deltas.
	// Android Chrome sends all-final cumulative results where each result's
	// text contains ALL previously recognized words plus new ones.
	// We compare against the last committed text to emit only the new portion.
	private lastCommittedText = '';

	// Monotonic segment counter for emitted transcripts. Incremented after
	// each real final so subsequent interims get a higher ID (avoiding
	// TranscribeArea's committedThroughSegment rejection).
	private nextSegmentId = 0;

	// Restart backoff — prevents tight restart loops when Chrome kills
	// recognition repeatedly (e.g., no microphone, permission denied).
	private restartAttempts = 0;
	private restartTimer: ReturnType<typeof setTimeout> | null = null;
	private static readonly MAX_RESTART_ATTEMPTS = 5;
	private static readonly RESTART_DELAY_MS = 300; // base delay, doubles each attempt

	constructor(private lang: string = 'en-US') {}

	startListening() {
		const Ctor = getSpeechRecognition();
		if (!Ctor) {
			return SourceErr({
				message: 'Web Speech API not available in this browser',
				context: { source: this.name }
			});
		}

		if (this.shouldBeListening) return Ok(undefined);

		this.shouldBeListening = true;
		this.restartAttempts = 0; // explicit start — reset backoff
		this.startRecognition(Ctor);
		return Ok(undefined);
	}

	stopListening() {
		this.shouldBeListening = false;
		// Cancel any pending restart to prevent a stale timeout from
		// spawning a second recognition instance after stop → start.
		if (this.restartTimer != null) {
			clearTimeout(this.restartTimer);
			this.restartTimer = null;
		}
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
		// The new recognition session gets a fresh results array, so
		// finalizedResultIndices is cleared in startRecognition.
		if (this.recognition && this.shouldBeListening) {
			this.recognition.stop();
		}
	}

	// -----------------------------------------------------------------------
	// Private
	// -----------------------------------------------------------------------

	private startRecognition(Ctor: SpeechRecognitionConstructor) {
		// Abort any existing instance before creating a new one.
		// Chrome aborts new instances if an old one is still tearing down.
		if (this.recognition) {
			const old = this.recognition;
			old.onstart = null;
			old.onresult = null;
			old.onerror = null;
			old.onend = null;
			try {
				old.abort();
			} catch {
				// ignore — may already be stopped
			}
			this.recognition = null;
		}

		// New session — fresh results array, so reset tracking state
		this.finalizedResultIndices.clear();
		this.lastCommittedText = '';
		this.nextSegmentId = 0;

		const recognition = new Ctor();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = this.lang;
		this.recognition = recognition;

		recognition.onstart = () => {
			if (this.recognition !== recognition) return;
			this.listening = true;
		};

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			if (this.recognition !== recognition) return;
			// First real result confirms recognition is working — reset backoff
			this.restartAttempts = 0;

			if (!this.onResult) return;

			// Collect all interim text parts and emit as one combined interim.
			// Chrome fires multiple result indices per onresult — some are the
			// confident partial (90%) and others are speculative extensions (1%).
			// Emitting them separately with the same segmentId causes the last
			// one to overwrite the first in the interims map, losing text.
			let combinedInterimText = '';
			let bestInterimConfidence = 0;
			let hasInterim = false;

			for (let i = event.resultIndex; i < event.results.length; i++) {
				// Skip indices we've already finalized — Android re-delivers
				// the entire results array on every onresult (resultIndex=0).
				if (this.finalizedResultIndices.has(i)) continue;

				const result = event.results[i];
				const alt = result[0];

				// Android Chrome quirk: interim results are marked isFinal
				// with confidence 0. Real finals have confidence > 0.
				// Treat confidence-0 "finals" as interims so consumers get
				// proper interim previews on Android.
				// See: https://stackoverflow.com/a/43458449
				const isRealFinal = result.isFinal && alt.confidence > 0;
				const isFakeInterim = result.isFinal && alt.confidence === 0;
				const isFinal = isRealFinal;

				let text = alt.transcript;

				if (isFakeInterim) {
					// Android fake interims have cumulative text (each contains
					// the full utterance so far). Emit with nextSegmentId so
					// TranscribeArea's interims.set() replaces rather than
					// accumulates. Same segmentId for all fake interims within
					// one utterance — only bumped after a real final.
					const transcript: Transcript = {
						text,
						isFinal: false,
						isEndpoint: false,
						segmentId: this.nextSegmentId,
						confidence: undefined
					};
					this.onResult(transcript);
					continue;
				}

				if (isFinal) {
					// Real final — extract delta from cumulative text.
					// Android sends "hello", "hello world" etc. where each
					// final contains all previous words plus new ones.
					if (this.lastCommittedText && text.startsWith(this.lastCommittedText)) {
						text = text.slice(this.lastCommittedText.length);
					}
					this.finalizedResultIndices.add(i);
					this.lastCommittedText = alt.transcript;

					const segmentId = this.nextSegmentId;
					this.nextSegmentId++;

					const transcript: Transcript = {
						text,
						isFinal: true,
						isEndpoint: true,
						segmentId,
						confidence: alt.confidence > 0 ? alt.confidence : undefined
					};

					this.onResult(transcript);
				} else {
					// Accumulate interims — will emit as one combined result after loop
					combinedInterimText += text;
					if (alt.confidence > bestInterimConfidence) {
						bestInterimConfidence = alt.confidence;
					}
					hasInterim = true;
				}
			}

			// Emit combined interim as a single transcript
			if (hasInterim) {
				const transcript: Transcript = {
					text: combinedInterimText,
					isFinal: false,
					isEndpoint: false,
					segmentId: this.nextSegmentId,
					confidence: bestInterimConfidence > 0 ? bestInterimConfidence : undefined
				};
				this.onResult(transcript);
			}
		};

		recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
			if (this.recognition !== recognition) return;
			// 'no-speech' and 'aborted' are expected during normal lifecycle
			if (event.error === 'no-speech' || event.error === 'aborted') return;

			console.error(`[WebSpeechSource] error: ${event.error} — ${event.message}`);

			// Fatal errors — stop the restart loop
			this.shouldBeListening = false;
			this.listening = false;
			this.onError?.(event.error, event.message);
		};

		recognition.onend = () => {
			// Guard against stale callbacks from a replaced instance
			if (this.recognition !== recognition) return;
			this.listening = false;

			// Chrome kills recognition periodically — restart if we should still be listening.
			if (this.shouldBeListening) {
				if (this.restartAttempts >= WebSpeechSource.MAX_RESTART_ATTEMPTS) {
					console.error(
						`[WebSpeechSource] giving up after ${this.restartAttempts} restart attempts`
					);
					this.shouldBeListening = false;
					this.onError?.('restart-failed', 'Too many restart attempts');
					return;
				}

				const Ctor = getSpeechRecognition();
				if (Ctor) {
					const delay = WebSpeechSource.RESTART_DELAY_MS * Math.pow(2, this.restartAttempts);
					this.restartAttempts++;
					this.restartTimer = setTimeout(() => {
						this.restartTimer = null;
						if (this.shouldBeListening) {
							this.startRecognition(Ctor);
						}
					}, delay);
				}
			}
		};

		recognition.start();
	}
}
