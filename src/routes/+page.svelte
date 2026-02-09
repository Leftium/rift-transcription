<script lang="ts">
	import TranscribeArea from '$lib/TranscribeArea.svelte';
	import { transcribable } from '$lib/transcribable.js';
	import CopyButton from '$lib/CopyButton.svelte';
	import EventLog from '$lib/EventLog.svelte';
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

	async function seedTestData() {
		// Focus the TranscribeArea textarea so it receives the events
		const textarea = transcribeAreaEl?.querySelector('textarea');
		if (textarea) textarea.focus();
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
			}
		];

		for (const t of utterances) {
			broadcastTranscript(t);
			await tick();
		}

		showUtterances = true;
		showConfidence = true;
	}

	// Persist Deepgram API key in localStorage
	const DG_KEY = 'deepgram-api-key';
	onMount(() => {
		voice.deepgramApiKey = localStorage.getItem(DG_KEY) ?? '';
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
		Voice input that works like a textarea. Focus any input below and speak. See the <a
			href="https://github.com/Leftium/rift-transcription/blob/main/specs/rift-transcription.md#transcribearea-textarea-shaped-voice-input"
			>spec</a
		> for details.
	</p>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="input-group" {@attach voice.autoListen}>
		<div class="controls">
			<button onclick={voice.toggle}>
				{voice.enabled ? 'Disable Voice Input' : 'Enable Voice Input'}
			</button>

			<select value={voice.sourceType} onchange={(e) => voice.setSource(e.currentTarget.value)}>
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

		<section class="level">
			<h2>Level 2: <code>&lt;TranscribeArea&gt;</code> component</h2>
			<p class="level-desc">
				Full experience. 3-axis rendering: underline (uncommitted), italic (unstable), opacity
				(confidence).
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
				<button class="seed-btn" onclick={seedTestData}>Seed test data</button>
			</div>
			<div bind:this={transcribeAreaEl}>
				<TranscribeArea
					bind:value={value2}
					placeholder="Type or speak (with interims)..."
					{showUtterances}
					{showConfidence}
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
			></textarea>
			<CopyButton value={value1} />
		</section>

		<section class="level">
			<h2>Level 0: Plain <code>&lt;textarea&gt;</code></h2>
			<p class="level-desc">No voice input. Baseline for comparison.</p>
			<textarea class="plain-textarea" bind:value={value0} placeholder="Type here (no voice)..."
			></textarea>
			<CopyButton value={value0} />
		</section>
	</div>

	<EventLog />
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
		font-size: 14px;
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
		gap: 12px;
		margin-bottom: 20px;
		padding-bottom: 12px;
		border-bottom: 1px solid #eee;
	}

	button {
		padding: 8px 16px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: #f5f5f5;
		cursor: pointer;
		font-size: 14px;
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
