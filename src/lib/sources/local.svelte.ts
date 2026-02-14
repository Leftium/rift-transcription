/**
 * LocalSource — TranscriptionSource backed by a local WebSocket server.
 *
 * Connects to a local server (rift-local or standalone sherpa-onnx C++/Python),
 * captures mic audio via AudioWorklet, streams 16kHz Float32 binary frames,
 * and maps server JSON responses to the Transcript type.
 *
 * rift-local JSON:  { type: "result", text, tokens, timestamps, ys_probs, lm_probs,
 *                     context_scores, segment, start_time, is_final, model }
 * C++ server JSON:  { text, tokens, timestamps, ys_probs, lm_probs, context_scores,
 *                     segment, start_time, is_final, is_eof }
 * Python server JSON: { text, segment } (no is_final — detect by segment increment)
 *
 * Finality semantics:
 *   is_final means "endpoint detected" (silence/pause), NOT "text might change."
 *   Interims are append-only — earlier tokens are never revised, regardless of
 *   model (Zipformer, Nemotron, Moonshine, etc.). So all results set isFinal: true
 *   (text is stable) and only set isEndpoint: true when the server signals
 *   is_final (utterance done).
 */

import { Ok } from 'wellcrafted/result';
import type { TranscriptionSource, Transcript, Word } from '$lib/types.js';
import { SourceErr, broadcastTranscript } from '$lib/types.js';
import { AudioCapture } from '$lib/audio-capture.js';

// ---------------------------------------------------------------------------
// Server response shape (superset of rift-local, C++, and Python servers)
// ---------------------------------------------------------------------------

interface LocalServerMessage {
	text: string;
	segment: number;
	// rift-local adds a type discriminator:
	type?: 'info' | 'result';
	// C++ server / rift-local:
	is_final?: boolean;
	is_eof?: boolean;
	tokens?: string[];
	timestamps?: number[];
	ys_probs?: number[]; // per-token ASR model log-probs
	lm_probs?: number[]; // per-token language model log-probs
	context_scores?: number[]; // per-token hotword/context boosting log-probs
	start_time?: number;
	words?: unknown[];
	// rift-local info handshake fields:
	model?: string;
	model_display?: string;
	params?: string;
	backend?: string;
	streaming?: boolean;
	languages?: string[];
	features?: {
		timestamps: boolean;
		confidence: boolean;
		endpoint_detection: boolean;
		diarization: boolean;
	};
	sample_rate?: number;
	version?: string;
}

// ---------------------------------------------------------------------------
// LocalSource
// ---------------------------------------------------------------------------

export class LocalSource implements TranscriptionSource {
	readonly name = 'local';

	/** Callback for results. Defaults to broadcastTranscript. */
	onResult: ((result: Transcript) => void) | null = broadcastTranscript;
	onError: ((error: string, message: string) => void) | null = null;

	/** Reactive — true while audio is being captured and sent. */
	listening = $state(false);

	/** Reactive — true while WebSocket is connected. */
	connected = $state(false);

	/** Reactive — server info from the INFO handshake (rift-local only). */
	serverInfo = $state<{
		model: string;
		model_display: string;
		params: string;
		backend: string;
		streaming: boolean;
		languages: string[];
		features: {
			timestamps: boolean;
			confidence: boolean;
			endpoint_detection: boolean;
			diarization: boolean;
		};
		sample_rate: number;
		version: string;
	} | null>(null);

	private serverUrl: string;
	private audioCapture: AudioCapture;
	private ws: WebSocket | null = null;
	private shouldBeListening = false;

	// Segment tracking
	private currentSegment = -1;
	private nextSegmentId = 0;
	private lastTextBySegment = new Map<number, string>();

	// Reconnect backoff (mirrors WebSpeechSource pattern)
	private restartAttempts = 0;
	private restartTimer: ReturnType<typeof setTimeout> | null = null;
	private static readonly MAX_RESTART_ATTEMPTS = 5;
	private static readonly RESTART_DELAY_MS = 300;

	constructor(serverUrl: string = 'ws://localhost:2177') {
		this.serverUrl = serverUrl;
		this.audioCapture = new AudioCapture();
	}

	startListening() {
		if (this.shouldBeListening) return Ok(undefined);

		this.shouldBeListening = true;
		this.restartAttempts = 0;
		this.currentSegment = -1;
		this.nextSegmentId = 0;
		this.lastTextBySegment.clear();
		this.serverInfo = null;
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
			// Signal end of audio to server
			try {
				if (this.ws.readyState === WebSocket.OPEN) {
					this.ws.send('Done');
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
		// No "force endpoint" command available. No-op for now.
		// Future: could close stream ("Done") and reopen, but that's
		// slower than Web Speech's stop/restart. Leave as no-op initially.
	}

	// -----------------------------------------------------------------------
	// Private — connection lifecycle
	// -----------------------------------------------------------------------

	private async connectAndStart() {
		try {
			await this.connectWebSocket();
			// Wire audio capture to send binary frames
			this.audioCapture.onAudioData = (samples: Float32Array) => {
				if (this.ws?.readyState === WebSocket.OPEN) {
					// Send raw Float32 buffer — server expects Float32 samples
					this.ws.send(samples.buffer);
				}
			};
			await this.audioCapture.start();
			this.listening = true;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`[LocalSource] Failed to start: ${message}`);

			// Clean up partial state
			this.audioCapture.stop();
			this.listening = false;
			if (this.ws) {
				this.ws.onclose = null;
				this.ws.close();
				this.ws = null;
			}
			this.connected = false;

			// Attempt reconnect if appropriate
			if (this.shouldBeListening) {
				this.scheduleReconnect();
			} else {
				this.onError?.('connection-failed', message);
			}
		}
	}

	private connectWebSocket(): Promise<void> {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(this.serverUrl);
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
				console.error('[LocalSource] WebSocket error', event);
				reject(new Error('WebSocket connection failed'));
			};

			ws.onclose = () => {
				if (this.ws !== ws) return;
				this.connected = false;
				this.listening = false;
				this.audioCapture.stop();

				if (this.shouldBeListening) {
					this.scheduleReconnect();
				}
			};
		});
	}

	private handleServerMessage(data: string) {
		let msg: LocalServerMessage;
		try {
			msg = JSON.parse(data);
		} catch {
			console.warn('[LocalSource] Non-JSON message:', data);
			return;
		}

		// Handle INFO handshake from rift-local
		if (msg.type === 'info') {
			this.serverInfo = {
				model: msg.model ?? 'unknown',
				model_display: msg.model_display ?? msg.model ?? 'Unknown model',
				params: msg.params ?? '',
				backend: msg.backend ?? 'unknown',
				streaming: msg.streaming ?? true,
				languages: msg.languages ?? [],
				features: msg.features ?? {
					timestamps: false,
					confidence: false,
					endpoint_detection: true,
					diarization: false
				},
				sample_rate: msg.sample_rate ?? 16000,
				version: msg.version ?? ''
			};
			console.info('[LocalSource] Server info:', this.serverInfo);
			return;
		}

		if (!this.onResult) return;

		// Ignore EOF marker
		if (msg.is_eof) return;

		const text = msg.text?.trim() ?? '';
		const segment = msg.segment ?? 0;

		// Skip empty-text messages — servers send these as segment
		// placeholders and empty finals that would pollute committedThroughSegment
		// tracking in TranscriptArea, blocking future interims.
		if (!text) return;

		// --- Detect server type and finality ---

		const hasFinalField = 'is_final' in msg;

		if (hasFinalField) {
			// C++ server / rift-local: has explicit is_final (= endpoint detected).
			// Use monotonic segmentIds so TranscriptArea's
			// committedThroughSegment rejection works correctly.
			// Server may reuse segment IDs after empty finals,
			// so map them to our own counter.
			const isEndpoint = !!msg.is_final;
			this.emitTranscript(text, this.nextSegmentId, isEndpoint, msg);
			if (isEndpoint) {
				this.nextSegmentId++;
			}
		} else {
			// Python server: detect endpoint by segment increment
			if (this.currentSegment >= 0 && segment > this.currentSegment) {
				// New segment started — endpoint for the previous one
				const prevText = this.lastTextBySegment.get(this.currentSegment) ?? '';
				if (prevText) {
					this.emitTranscript(prevText, this.nextSegmentId, true, msg);
					this.nextSegmentId++;
				}
			}

			// Emit current (not an endpoint yet)
			this.lastTextBySegment.set(segment, text);
			this.currentSegment = segment;
			this.emitTranscript(text, this.nextSegmentId, false, msg);
		}
	}

	private emitTranscript(
		text: string,
		segment: number,
		isEndpoint: boolean,
		raw: LocalServerMessage
	) {
		if (!this.onResult) return;

		// Build word-level detail from tokens + timestamps.
		// BPE subword tokens (e.g. " My", " na", "me") are coalesced into
		// whole words so downstream consumers get clean Word objects.
		// Raw tokens remain accessible via transcript.raw.
		let words: Word[] | undefined;
		if (raw.tokens && raw.timestamps && raw.tokens.length === raw.timestamps.length) {
			const startTime = raw.start_time ?? 0;
			const hasProbs = (raw.ys_probs?.length ?? 0) > 0 || (raw.lm_probs?.length ?? 0) > 0;

			// First pass: build per-token data
			const tokens = raw.tokens.map((token, i) => {
				const logProb =
					(raw.ys_probs?.[i] ?? 0) + (raw.lm_probs?.[i] ?? 0) + (raw.context_scores?.[i] ?? 0);
				return {
					text: token,
					start: startTime + raw.timestamps![i],
					end:
						i + 1 < raw.timestamps!.length
							? startTime + raw.timestamps![i + 1]
							: startTime + raw.timestamps![i] + 0.1,
					confidence: hasProbs ? Math.exp(logProb) : undefined
				};
			});

			// Second pass: coalesce BPE subword tokens into whole words.
			// BPE convention: leading whitespace = new word boundary.
			// e.g. [" My", " na", "me"] -> words ["My", "name"]
			words = [];
			let current: { texts: string[]; start: number; end: number; confidences: number[] } | null =
				null;

			for (const tok of tokens) {
				const isWordStart = /^\s/.test(tok.text) || current === null;
				if (isWordStart) {
					// Flush previous word
					if (current) {
						const avgConf =
							current.confidences.length > 0
								? current.confidences.reduce((a, b) => a + b, 0) / current.confidences.length
								: undefined;
						words.push({
							text: current.texts.join(''),
							start: current.start,
							end: current.end,
							...(avgConf != null ? { confidence: avgConf } : {})
						});
					}
					current = {
						texts: [tok.text.trimStart()],
						start: tok.start,
						end: tok.end,
						confidences: tok.confidence != null ? [tok.confidence] : []
					};
				} else {
					// Continuation token — append to current word
					current!.texts.push(tok.text);
					current!.end = tok.end;
					if (tok.confidence != null) current!.confidences.push(tok.confidence);
				}
			}
			// Flush last word
			if (current) {
				const avgConf =
					current.confidences.length > 0
						? current.confidences.reduce((a, b) => a + b, 0) / current.confidences.length
						: undefined;
				words.push({
					text: current.texts.join(''),
					start: current.start,
					end: current.end,
					...(avgConf != null ? { confidence: avgConf } : {})
				});
			}
		}

		// Transcript-level confidence: average across words (when available).
		const wordsWithConf = words?.filter((w) => w.confidence != null) ?? [];
		const confidence =
			wordsWithConf.length > 0
				? wordsWithConf.reduce((sum, w) => sum + w.confidence!, 0) / wordsWithConf.length
				: undefined;

		// Interims are append-only — earlier tokens never change.
		// isFinal: true always (text is stable), isEndpoint only on silence detection.
		const transcript: Transcript = {
			text,
			isFinal: true,
			isEndpoint,
			segmentId: segment,
			start: raw.start_time,
			confidence,
			words,
			raw
		};

		this.onResult(transcript);
	}

	private scheduleReconnect() {
		if (this.restartAttempts >= LocalSource.MAX_RESTART_ATTEMPTS) {
			console.error(`[LocalSource] Giving up after ${this.restartAttempts} reconnect attempts`);
			this.shouldBeListening = false;
			this.onError?.('reconnect-failed', 'Too many reconnect attempts');
			return;
		}

		const delay = LocalSource.RESTART_DELAY_MS * Math.pow(2, this.restartAttempts);
		this.restartAttempts++;

		this.restartTimer = setTimeout(() => {
			this.restartTimer = null;
			if (this.shouldBeListening) {
				this.connectAndStart();
			}
		}, delay);
	}
}
