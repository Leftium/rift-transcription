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
 * TranscriptionSource and a consumer (TranscribeArea, RIFT Editor, etc.).
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
// TranscriptionSource — push-based interface
// See: specs/rift-transcription.md "Unified Interface"
// ---------------------------------------------------------------------------

export interface TranscriptionSource {
	readonly name: string;

	startListening(): Result<void, SourceError>;
	stopListening(): Result<void, SourceError>;

	/** Force endpoint without stopping (RIFT addition — not in transcription-rs). */
	finalize(): void;

	onResult: ((result: Transcript) => void) | null;
}
