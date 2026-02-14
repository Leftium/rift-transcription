<script lang="ts">
	import TranscribeArea from '$lib/TranscribeArea.svelte';
	import { transcribable } from '$lib/transcribable.js';
	import CopyButton from '$lib/CopyButton.svelte';

	import { VoiceInputController } from '$lib/VoiceInputController.svelte';
	import { broadcastTranscript } from '$lib/types.js';
	import type { Transcript } from '$lib/types.js';

	import { onMount, tick } from 'svelte';

	const voice = new VoiceInputController();

	let value0 = $state('');
	let value1 = $state('');
	let value2 = $state('');
	let showUtterances = $state(false);
	let showConfidence = $state(false);
	let transcribeAreaEl: HTMLElement | undefined = $state();
	let lastFocusedTextarea: HTMLTextAreaElement | undefined = $state();
	let replaying = $state(false);

	// Replicates TranscribeArea's OKLCH confidence-to-color interpolation for the heading demo.
	const TEAL = { L: 0.6, C: 0.104, H: 185 };
	const AMBER = { L: 0.666, C: 0.157, H: 58 };
	function confidenceToColor(confidence: number): string {
		const L = AMBER.L + confidence * (TEAL.L - AMBER.L);
		const C = AMBER.C + confidence * (TEAL.C - AMBER.C);
		const H = AMBER.H + confidence * (TEAL.H - AMBER.H);
		return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
	}

	// "High to low" — each visible character gets a confidence step from 1.0 → 0.0
	const gradientText = 'high to low';
	const gradientChars: Array<{ char: string; color: string | null }> = (() => {
		const visible = [...gradientText].filter((c) => c !== ' ');
		const total = visible.length; // 9 chars: h,i,g,h,t,o,l,o,w
		let vi = 0;
		return [...gradientText].map((char) => {
			if (char === ' ') return { char, color: null };
			const confidence = 1 - vi / (total - 1);
			vi++;
			return { char, color: confidenceToColor(confidence) };
		});
	})();

	// -----------------------------------------------------------------------
	// Replay recorded events — real-time playback of a captured session.
	// Events are typed keystrokes and broadcastTranscript() calls replayed
	// at the original timestamps so the TranscribeArea renders interims,
	// finals, and user typing exactly as they happened live.
	// -----------------------------------------------------------------------

	type ReplayEvent =
		| { type: 'transcript'; ms: number; transcript: Transcript }
		| { type: 'input'; ms: number; text: string };

	// Timeline parsed from a real capture:
	//   voice says "left", user types "ium:", voice says " the element of creativity", user types "!"
	// Base timestamp: 03:19:39.210 — all offsets relative to that.
	const replayTimeline: ReplayEvent[] = [
		// seg=0 interim "left" (1% confidence)
		{
			type: 'transcript',
			ms: 0,
			transcript: {
				text: 'left',
				isFinal: false,
				isEndpoint: false,
				segmentId: 0,
				confidence: 0.01
			}
		},
		// seg=0 final "left" (69% confidence)
		{
			type: 'transcript',
			ms: 485,
			transcript: { text: 'left', isFinal: true, isEndpoint: true, segmentId: 0, confidence: 0.69 }
		},
		// User types "ium:" after "left" is committed
		{ type: 'input', ms: 1001, text: 'i' },
		{ type: 'input', ms: 1152, text: 'u' },
		{ type: 'input', ms: 1416, text: 'm' },
		{ type: 'input', ms: 1946, text: ':' },
		// seg=1 interims — voice recognizing " the element of creativity"
		{
			type: 'transcript',
			ms: 3506,
			transcript: {
				text: ' the',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.01
			}
		},
		{
			type: 'transcript',
			ms: 3699,
			transcript: {
				text: ' the element',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.01
			}
		},
		{
			type: 'transcript',
			ms: 4055,
			transcript: {
				text: ' the element of',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.01
			}
		},
		{
			type: 'transcript',
			ms: 4096,
			transcript: {
				text: ' the element of',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.9
			}
		},
		{
			type: 'transcript',
			ms: 4427,
			transcript: {
				text: ' the element of',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.9
			}
		},
		{
			type: 'transcript',
			ms: 4598,
			transcript: {
				text: ' the element of cre',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.9
			}
		},
		{
			type: 'transcript',
			ms: 4694,
			transcript: {
				text: ' the element of cre',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.9
			}
		},
		{
			type: 'transcript',
			ms: 4731,
			transcript: {
				text: ' the element of creativity',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.9
			}
		},
		{
			type: 'transcript',
			ms: 5278,
			transcript: {
				text: ' the element of creativity',
				isFinal: false,
				isEndpoint: false,
				segmentId: 1,
				confidence: 0.9
			}
		},
		// seg=1 final (97% confidence)
		{
			type: 'transcript',
			ms: 5437,
			transcript: {
				text: ' the element of creativity',
				isFinal: true,
				isEndpoint: true,
				segmentId: 1,
				confidence: 0.97
			}
		},
		// User types "!" after final commits
		{ type: 'input', ms: 5649, text: '!' }
	];

	async function replayRecordedEvents() {
		// Focus the right textarea (same pattern as seedTestData)
		const target = lastFocusedTextarea ?? transcribeAreaEl?.querySelector('textarea');
		if (target) target.focus();
		await tick();

		// Insert two newlines to separate from existing content (if any)
		if (target && target.value.length > 0) {
			document.execCommand('insertText', false, '\n\n');
			await tick();
		}

		replaying = true;
		let prevMs = 0;

		for (const event of replayTimeline) {
			// Wait the real-time delta between events
			const delta = event.ms - prevMs;
			if (delta > 0) {
				await new Promise((r) => setTimeout(r, delta));
			}
			prevMs = event.ms;

			if (event.type === 'transcript') {
				broadcastTranscript(event.transcript);
			} else {
				// Simulate keyboard typing via execCommand so the textarea's
				// input handler fires naturally (trusted-like behavior).
				const el = document.activeElement;
				if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
					document.execCommand('insertText', false, event.text);
				}
			}
			await tick();
		}

		replaying = false;
	}

	async function seedTestData() {
		// Re-focus the last-focused textarea (clicking the button steals focus);
		// fall back to the TranscribeArea textarea if none was previously focused.
		const target = lastFocusedTextarea ?? transcribeAreaEl?.querySelector('textarea');
		if (target) target.focus();
		await tick();

		// Simulate two utterances with deliberately varied word confidences
		const utterances: Transcript[] = [
			{
				text: 'The quick brown fox',
				isFinal: true,
				isEndpoint: true,
				segmentId: 0,
				confidence: 0.85,
				words: [
					{ text: 'The', start: 0, end: 0.3, confidence: 0.99 },
					{ text: 'quick', start: 0.3, end: 0.7, confidence: 0.72 },
					{ text: 'brown', start: 0.7, end: 1.1, confidence: 0.45 },
					{ text: 'fox', start: 1.1, end: 1.4, confidence: 0.91 }
				]
			},
			{
				text: 'jumps over the lazy dog',
				isFinal: true,
				isEndpoint: true,
				segmentId: 1,
				confidence: 0.6,
				words: [
					{ text: 'jumps', start: 1.5, end: 1.9, confidence: 0.88 },
					{ text: 'over', start: 1.9, end: 2.2, confidence: 0.3 },
					{ text: 'the', start: 2.2, end: 2.4, confidence: 0.95 },
					{ text: 'lazy', start: 2.4, end: 2.8, confidence: 0.15 },
					{ text: 'dog', start: 2.8, end: 3.1, confidence: 0.55 }
				]
			},
			{
				// Words "10"–"100" at 10% confidence increments (0.1, 0.2, …, 1.0)
				text: '10 20 30 40 50 60 70 80 90 100',
				isFinal: true,
				isEndpoint: true,
				segmentId: 2,
				confidence: 0.55,
				words: Array.from({ length: 10 }, (_, i) => ({
					text: String((i + 1) * 10),
					start: 4.0 + i * 0.4,
					end: 4.0 + (i + 1) * 0.4,
					confidence: (i + 1) / 10
				}))
			}
		];

		for (let i = 0; i < utterances.length; i++) {
			// Put the confidence gradient swatch on its own line
			if (i === 2) {
				value2 += '\n';
				await tick();
			}
			broadcastTranscript(utterances[i]);
			await tick();
		}

		showUtterances = true;
		showConfidence = true;
	}

	// Persist Deepgram API key and source type in localStorage
	const DG_KEY = 'deepgram-api-key';
	const SOURCE_TYPE_KEY = 'source-type';
	onMount(() => {
		voice.deepgramApiKey = localStorage.getItem(DG_KEY) ?? '';
		const savedSource = localStorage.getItem(SOURCE_TYPE_KEY);
		if (savedSource) {
			voice.setSource(savedSource);
		}
	});

	function setDeepgramKey(key: string) {
		voice.deepgramApiKey = key;
		if (key) {
			localStorage.setItem(DG_KEY, key);
		} else {
			localStorage.removeItem(DG_KEY);
		}
	}
</script>

<main>
	<h1>RIFT TranscribeArea</h1>
	<p class="intro">
		Voice input that works like a textarea. Enable voice input, then focus any input below and
		speak. See the <a
			href="https://github.com/Leftium/rift-transcription/blob/main/specs/rift-transcription.md#transcribearea-textarea-shaped-voice-input"
			>spec</a
		> for details.
	</p>

	<div class="sticky-header">
		<div class="controls">
			<select
				value={voice.sourceType}
				onchange={(e) => {
					const newSource = e.currentTarget.value;
					voice.setSource(newSource);
					localStorage.setItem(SOURCE_TYPE_KEY, newSource);
				}}
			>
				<option value="web-speech">Web Speech API</option>
				<option value="sherpa">Sherpa (local)</option>
				<option value="deepgram">Deepgram (cloud)</option>
			</select>

			{#if voice.sourceType === 'sherpa'}
				<input
					type="text"
					class="server-url"
					bind:value={voice.sherpaUrl}
					placeholder="ws://localhost:6006"
					size="24"
				/>
				<a href="/sherpa" class="setup-link">Setup</a>
			{:else if voice.sourceType === 'deepgram'}
				<input
					type="password"
					class="api-key"
					value={voice.deepgramApiKey}
					oninput={(e) => setDeepgramKey(e.currentTarget.value)}
					placeholder="Deepgram API key"
					size="28"
				/>
			{/if}
		</div>

		<div class="controls">
			<button
				onclick={async () => {
					voice.toggle();
					if (voice.enabled) {
						// Wait for Svelte to flush inputmode="none" to the DOM
						// before focusing — otherwise mobile keyboard appears briefly.
						await tick();
						transcribeAreaEl?.querySelector('textarea')?.focus();
					}
				}}
			>
				{voice.enabled ? 'Disable Voice Input' : 'Enable Voice Input'}
			</button>

			<span class="status">
				<span class="dot" class:active={voice.listening}></span>
				{#if voice.listening}
					Listening — {voice.sourceType === 'sherpa'
						? 'Sherpa'
						: voice.sourceType === 'deepgram'
							? 'Deepgram'
							: 'Web Speech'}
				{:else}
					Idle
				{/if}
			</span>
		</div>

		<div class="controls">
			<button class="seed-btn" onclick={seedTestData}>Seed test data</button>
			<button class="seed-btn" onclick={replayRecordedEvents} disabled={replaying}>
				{replaying ? 'Replaying…' : 'Replay recorded events'}
			</button>
		</div>
	</div>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="input-group"
		onfocusin={(e: FocusEvent) => {
			if (e.target instanceof HTMLTextAreaElement) {
				lastFocusedTextarea = e.target;
			}
		}}
	>
		<section class="level">
			<h2>Level 2: <code>&lt;TranscribeArea&gt;</code> component</h2>
			<p class="level-desc">
				Full experience. 3 dimensions of transcription:
				<span class="desc-composing">composing</span>,
				<span class="desc-unstable">unstable</span>,
				<span class="gradient-label"
					>{#each gradientChars as { char, color }}{#if color}<span style:color>{char}</span
							>{:else}{char}{/if}{/each}</span
				> confidence.
			</p>
			<div class="level-toggles">
				<label>
					<input type="checkbox" bind:checked={showUtterances} />
					Show utterance boundaries
				</label>
				<label>
					<input type="checkbox" bind:checked={showConfidence} />
					Show confidence
				</label>
			</div>
			<div bind:this={transcribeAreaEl}>
				<TranscribeArea
					bind:value={value2}
					placeholder="Type or speak (with interims)..."
					{showUtterances}
					{showConfidence}
					suppressKeyboard={voice.enabled}
					debug
				/>
			</div>
			<CopyButton value={value2} />
		</section>

		<section class="level">
			<h2>Level 1: <code>&lt;textarea&gt;</code> + <code>rift:transcript</code> event handler</h2>
			<p class="level-desc">
				Listens for transcript events. Final text inserts at cursor. No interim display.
			</p>
			<textarea
				{@attach transcribable}
				class="plain-textarea"
				bind:value={value1}
				placeholder="Type or speak (finals only)..."
				inputmode={voice.enabled ? 'none' : undefined}
			></textarea>
			<CopyButton value={value1} />
		</section>

		<section class="level">
			<h2>Level 0: Plain <code>&lt;textarea&gt;</code></h2>
			<p class="level-desc">No voice input. Baseline for comparison.</p>
			<textarea
				class="plain-textarea"
				bind:value={value0}
				placeholder="Type here (no voice)..."
				inputmode={voice.enabled ? 'none' : undefined}
			></textarea>
			<CopyButton value={value0} />
		</section>
	</div>
</main>

<style>
	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 24px 16px;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	h1 {
		font-size: 1.3rem;
		margin-bottom: 4px;
	}

	h2 {
		font-size: 0.95rem;
		margin: 0 0 2px;
	}

	code {
		background: #f0f0f0;
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 0.85em;
	}

	.intro {
		color: #555;
		font-size: 14px;
		margin: 0 0 16px;
	}

	.intro a {
		color: #4a90d9;
	}

	.level {
		margin-bottom: 20px;
	}

	.level-desc {
		color: #888;
		font-size: 13px;
		margin: 0 0 6px;
	}

	/* Styled labels mirroring the 3 transcription dimensions */
	.desc-composing {
		text-decoration: underline dotted #bbb;
		font-weight: 600;
	}
	.desc-unstable {
		text-decoration: underline dotted #bbb;
		font-style: italic;
		font-weight: 600;
	}
	.desc-high {
		color: oklch(0.6 0.104 185);
		font-weight: 600;
	}
	.desc-low {
		color: oklch(0.666 0.157 58);
		font-weight: 600;
	}
	.gradient-label {
		font-weight: 600;
	}

	.level-toggles {
		display: flex;
		gap: 16px;
		margin-bottom: 6px;
		font-size: 13px;
		color: #555;
	}

	.level-toggles label {
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}

	.seed-btn {
		font-size: 12px;
		padding: 3px 8px;
	}

	.plain-textarea {
		font-family: 'Courier New', Courier, monospace;
		font-size: 16px;
		line-height: 1.5;
		padding: 8px;
		margin: 0;
		border: 1px solid #ccc;
		border-radius: 4px;
		width: 100%;
		min-height: 80px;
		box-sizing: border-box;
		resize: vertical;
	}

	.plain-textarea:focus {
		outline: 2px solid #4a90d9;
		outline-offset: -1px;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.sticky-header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: white;
		padding-bottom: 8px;
		border-bottom: 1px solid #eee;
		margin-bottom: 16px;
	}

	button {
		padding: 6px 12px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: #f5f5f5;
		cursor: pointer;
		font-size: 13px;
	}

	button:hover {
		background: #e8e8e8;
	}

	select {
		padding: 6px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: #f5f5f5;
		font-size: 13px;
	}

	.server-url,
	.api-key {
		padding: 6px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 13px;
		font-family: monospace;
	}

	.setup-link {
		color: #4a90d9;
		font-size: 13px;
		text-decoration: none;
	}

	.setup-link:hover {
		text-decoration: underline;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: #666;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ccc;
	}

	.dot.active {
		background: #e53935;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
