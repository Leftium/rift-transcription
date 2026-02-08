/**
 * DeepgramSource — TranscriptionSource backed by Deepgram's streaming WebSocket API.
 *
 * Connects to wss://api.deepgram.com/v1/listen, captures mic audio via AudioWorklet,
 * converts Float32 → Int16 PCM (linear16), and maps Deepgram JSON responses to Transcript.
 *
 * Deepgram streaming JSON response:
 * {
 *   type: "Results",
 *   channel_index: [0, 1],
 *   duration: number,
 *   start: number,
 *   is_final: boolean,
 *   speech_final: boolean,
 *   channel: {
 *     alternatives: [{
 *       transcript: string,
 *       confidence: number,
 *       words: [{ word, start, end, confidence, punctuated_word }]
 *     }]
 *   }
 * }
 *
 * Key behaviors:
 * - is_final: true means Deepgram won't revise this segment further
 * - speech_final: true means natural endpoint (pause in speech)
 * - We treat speech_final as the commit point (isFinal + isEndpoint)
 * - is_final without speech_final = stable interim (won't change but sentence continues)
 */

import { Ok } from 'wellcrafted/result';
import type { TranscriptionSource, Transcript, Word } from '$lib/types.js';
import { broadcastTranscript } from '$lib/types.js';
import { AudioCapture } from '$lib/audio-capture.js';

// ---------------------------------------------------------------------------
// Deepgram response types
// ---------------------------------------------------------------------------

interface DeepgramWord {
	word: string;
	start: number;
	end: number;
	confidence: number;
	punctuated_word?: string;
}

interface DeepgramAlternative {
	transcript: string;
	confidence: number;
	words: DeepgramWord[];
}

interface DeepgramResponse {
	type: string;
	channel_index?: number[];
	duration?: number;
	start?: number;
	is_final?: boolean;
	speech_final?: boolean;
	channel?: {
		alternatives: DeepgramAlternative[];
	};
	metadata?: unknown;
	from_finalize?: boolean;
}

// ---------------------------------------------------------------------------
// DeepgramSource
// ---------------------------------------------------------------------------

export class DeepgramSource implements TranscriptionSource {
	readonly name = 'deepgram';

	/** Callback for results. Defaults to broadcastTranscript. */
	onResult: ((result: Transcript) => void) | null = broadcastTranscript;
	onError: ((error: string, message: string) => void) | null = null;

	/** Reactive — true while audio is being captured and sent. */
	listening = $state(false);

	/** Reactive — true while WebSocket is connected. */
	connected = $state(false);

	private apiKey: string;
	private audioCapture: AudioCapture;
	private ws: WebSocket | null = null;
	private shouldBeListening = false;

	// Segment tracking — Deepgram doesn't use segment IDs, so we assign our own.
	// Each speech_final increments the segment counter.
	private nextSegmentId = 0;

	// Accumulate is_final text within a speech turn for the interim display.
	// Reset on speech_final.
	private accumulatedText = '';

	// Reconnect backoff
	private restartAttempts = 0;
	private restartTimer: ReturnType<typeof setTimeout> | null = null;
	private static readonly MAX_RESTART_ATTEMPTS = 5;
	private static readonly RESTART_DELAY_MS = 300;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
		this.audioCapture = new AudioCapture();
	}

	startListening() {
		if (this.shouldBeListening) return Ok(undefined);

		if (!this.apiKey) {
			this.onError?.('no-api-key', 'Deepgram API key is required');
			return Ok(undefined);
		}

		this.shouldBeListening = true;
		this.restartAttempts = 0;
		this.nextSegmentId = 0;
		this.accumulatedText = '';
		this.connectAndStart();
		return Ok(undefined);
	}

	stopListening() {
		this.shouldBeListening = false;

		if (this.restartTimer != null) {
			clearTimeout(this.restartTimer);
			this.restartTimer = null;
		}

		this.audioCapture.stop();
		this.listening = false;

		if (this.ws) {
			try {
				if (this.ws.readyState === WebSocket.OPEN) {
					// Deepgram close signal
					this.ws.send(JSON.stringify({ type: 'CloseStream' }));
				}
			} catch {
				// ignore — socket may already be closing
			}
			this.ws.onclose = null;
			this.ws.onerror = null;
			this.ws.onmessage = null;
			this.ws.close();
			this.ws = null;
		}

		this.connected = false;
		return Ok(undefined);
	}

	finalize() {
		// Send Finalize message — Deepgram will flush any buffered audio
		// and return a final transcript with from_finalize: true
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: 'Finalize' }));
		}
	}

	// -----------------------------------------------------------------------
	// Private — connection lifecycle
	// -----------------------------------------------------------------------

	private async connectAndStart() {
		try {
			await this.connectWebSocket();
			// Wire audio capture to send Int16 PCM binary frames
			this.audioCapture.onAudioData = (samples: Float32Array) => {
				if (this.ws?.readyState === WebSocket.OPEN) {
					this.ws.send(float32ToInt16(samples).buffer);
				}
			};
			await this.audioCapture.start();
			this.listening = true;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[DeepgramSource] Failed to start: ${message}`);

			// Clean up partial state
			this.audioCapture.stop();
			this.listening = false;
			if (this.ws) {
				this.ws.onclose = null;
				this.ws.close();
				this.ws = null;
			}
			this.connected = false;

			if (this.shouldBeListening) {
				this.scheduleReconnect();
			} else {
				this.onError?.('connection-failed', message);
			}
		}
	}

	private connectWebSocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			const params = new URLSearchParams({
				model: 'nova-3',
				language: 'en',
				smart_format: 'true',
				interim_results: 'true',
				utterance_end_ms: '1000',
				vad_events: 'true',
				encoding: 'linear16',
				sample_rate: '16000',
				channels: '1'
			});

			const url = `wss://api.deepgram.com/v1/listen?${params}`;
			// Deepgram authenticates browser WebSockets via subprotocol, not headers or query params.
			// See: https://github.com/deepgram/deepgram-js-sdk AbstractLiveClient.ts
			const ws = new WebSocket(url, ['token', this.apiKey]);
			this.ws = ws;

			ws.onopen = () => {
				if (this.ws !== ws) return;
				this.connected = true;
				this.restartAttempts = 0;
				resolve();
			};

			ws.onmessage = (event: MessageEvent) => {
				if (this.ws !== ws) return;
				if (typeof event.data === 'string') {
					this.handleServerMessage(event.data);
				}
			};

			ws.onerror = (event: Event) => {
				if (this.ws !== ws) return;
				console.error('[DeepgramSource] WebSocket error', event);
				// Don't reject here — let onclose handle it with the actual code/reason
			};

			ws.onclose = (event: CloseEvent) => {
				if (this.ws !== ws) return;
				console.error(
					`[DeepgramSource] WebSocket closed: code=${event.code} reason="${event.reason}" wasClean=${event.wasClean}`
				);
				this.connected = false;
				this.listening = false;
				this.audioCapture.stop();

				// Reject the connection promise if it hasn't resolved yet
				reject(
					new Error(
						`WebSocket closed: code=${event.code}${event.reason ? ` reason="${event.reason}"` : ''}`
					)
				);

				// Deepgram returns specific close codes for auth errors
				if (event.code === 1008 || event.code === 1003) {
					this.shouldBeListening = false;
					this.onError?.(
						'auth-failed',
						`Deepgram auth failed (code ${event.code}): ${event.reason}`
					);
					return;
				}

				if (this.shouldBeListening) {
					this.scheduleReconnect();
				}
			};
		});
	}

	private handleServerMessage(data: string) {
		if (!this.onResult) return;

		let msg: DeepgramResponse;
		try {
			msg = JSON.parse(data);
		} catch {
			console.warn('[DeepgramSource] Non-JSON message:', data);
			return;
		}

		// Only handle Results type
		if (msg.type !== 'Results') return;

		const alt = msg.channel?.alternatives?.[0];
		if (!alt) return;

		const text = alt.transcript?.trim() ?? '';

		// Skip empty transcripts
		if (!text) return;

		// Build word-level detail
		const words: Word[] | undefined = alt.words?.length
			? alt.words.map((w) => ({
					text: w.punctuated_word ?? w.word,
					start: w.start,
					end: w.end,
					confidence: w.confidence
				}))
			: undefined;

		if (msg.speech_final) {
			// Natural endpoint — commit the full utterance
			const finalText = this.accumulatedText ? this.accumulatedText + ' ' + text : text;
			this.emitTranscript(finalText, this.nextSegmentId, true, words, alt.confidence, msg);
			this.nextSegmentId++;
			this.accumulatedText = '';
		} else if (msg.is_final) {
			// Stable partial — Deepgram won't revise, but utterance continues.
			// Accumulate for the final commit.
			this.accumulatedText = this.accumulatedText ? this.accumulatedText + ' ' + text : text;
			this.emitTranscript(
				this.accumulatedText,
				this.nextSegmentId,
				false,
				words,
				alt.confidence,
				msg
			);
		} else {
			// Interim — may be revised. Show accumulated + current interim.
			const displayText = this.accumulatedText ? this.accumulatedText + ' ' + text : text;
			this.emitTranscript(displayText, this.nextSegmentId, false, words, alt.confidence, msg);
		}
	}

	private emitTranscript(
		text: string,
		segmentId: number,
		isFinal: boolean,
		words: Word[] | undefined,
		confidence: number | undefined,
		raw: DeepgramResponse
	) {
		if (!this.onResult) return;

		const transcript: Transcript = {
			text,
			isFinal,
			isEndpoint: isFinal,
			segmentId,
			start: raw.start,
			end: raw.start != null && raw.duration != null ? raw.start + raw.duration : undefined,
			confidence,
			words,
			raw
		};

		this.onResult(transcript);
	}

	private scheduleReconnect() {
		if (this.restartAttempts >= DeepgramSource.MAX_RESTART_ATTEMPTS) {
			console.error(`[DeepgramSource] Giving up after ${this.restartAttempts} reconnect attempts`);
			this.shouldBeListening = false;
			this.onError?.('reconnect-failed', 'Too many reconnect attempts');
			return;
		}

		const delay = DeepgramSource.RESTART_DELAY_MS * Math.pow(2, this.restartAttempts);
		this.restartAttempts++;

		this.restartTimer = setTimeout(() => {
			this.restartTimer = null;
			if (this.shouldBeListening) {
				this.connectAndStart();
			}
		}, delay);
	}
}

// ---------------------------------------------------------------------------
// Utility — convert Float32 [-1,1] to Int16 PCM for Deepgram's linear16
// ---------------------------------------------------------------------------

function float32ToInt16(float32: Float32Array): Int16Array {
	const int16 = new Int16Array(float32.length);
	for (let i = 0; i < float32.length; i++) {
		const s = Math.max(-1, Math.min(1, float32[i]));
		int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}
	return int16;
}
