import type { Result } from 'wellcrafted/result';
import { createTaggedError } from 'wellcrafted/error';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const { SourceError, SourceErr } = createTaggedError('SourceError').withContext<
	{ source: string } | undefined
>();
export type SourceError = ReturnType<typeof SourceError>;

// ---------------------------------------------------------------------------
// Transcript — aligned with transcription-rs
// See: specs/rift-transcription.md "Unified Interface"
// ---------------------------------------------------------------------------

/** Speaker identifier — backends use different schemes. */
export type Speaker = { type: 'id'; id: number } | { type: 'label'; label: string };

/** A single recognized word with timing. */
export type Word = {
	text: string;
	punctuated?: string;
	start: number;
	end: number;
	confidence?: number;
	speaker?: Speaker;
};

/** Alternative transcription hypothesis (n-best). */
export type Alternative = {
	text: string;
	confidence?: number;
	words?: Word[];
};

/**
 * A transcription result — the unit of communication between a
 * TranscriptionSource and a consumer (TranscriptArea, RIFT Editor, etc.).
 */
export type Transcript = {
	text: string;

	// Result-level finality
	isFinal: boolean;
	isEndpoint: boolean;
	segmentId: number;

	// Timing (seconds from stream start)
	start?: number;
	end?: number;

	// Confidence
	confidence?: number;

	// Language
	language?: string;
	languageConfidence?: number;

	// Speaker diarization
	speaker?: Speaker;

	// Word-level detail
	words?: Word[];

	// N-best alternatives
	alternatives?: Alternative[];

	// Raw backend response for debug/niche fields
	raw?: unknown;
};

// ---------------------------------------------------------------------------
// Transcript event — global broadcast mechanism
// Sources dispatch this on document; receivers (transcribable action,
// TranscriptArea) listen when focused. No manual wiring needed.
// ---------------------------------------------------------------------------

export const TRANSCRIPT_EVENT = 'rift:transcript';

export type TranscriptEvent = CustomEvent<Transcript>;

/** Dispatch a Transcript as a CustomEvent on document. */
export function broadcastTranscript(transcript: Transcript): void {
	document.dispatchEvent(
		new CustomEvent<Transcript>(TRANSCRIPT_EVENT, {
			detail: transcript
		})
	);
}

// ---------------------------------------------------------------------------
// Smart spacing — shared between transcribable action and TranscriptArea
// ---------------------------------------------------------------------------

/** Add a space before text if the preceding character isn't whitespace. */
export function needsSpaceBefore(before: string): boolean {
	return before.length > 0 && !/\s$/.test(before);
}

/** Add a space after text if the following character isn't whitespace or punctuation. */
export function needsSpaceAfter(after: string): boolean {
	if (after.length === 0) return false;
	// Don't insert space before whitespace or closing/trailing punctuation
	if (/^[\s.,!?;:)\]}"']/.test(after)) return false;
	return true;
}

// ---------------------------------------------------------------------------
// TranscriptionSource — push-based interface
// See: specs/rift-transcription.md "Unified Interface"
// ---------------------------------------------------------------------------

export interface TranscriptionSource {
	readonly name: string;

	/** Reactive — true while recognition/capture is active. */
	listening: boolean;

	startListening(): Result<void, SourceError>;
	stopListening(): Result<void, SourceError>;

	/** Force endpoint without stopping (RIFT addition — not in transcription-rs). */
	finalize(): void;

	onResult: ((result: Transcript) => void) | null;
	onError: ((error: string, message: string) => void) | null;
}
