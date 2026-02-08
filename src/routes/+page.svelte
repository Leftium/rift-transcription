<script lang="ts">
	import { isErr } from 'wellcrafted/result';
	import TranscribeArea from '$lib/TranscribeArea.svelte';
	import { transcribable } from '$lib/transcribable.js';
	import { WebSpeechSource } from '$lib/sources/web-speech.svelte';
	import { TRANSCRIPT_EVENT } from '$lib/types.js';
	import type { Transcript, TranscriptEvent } from '$lib/types.js';

	let source = $state<WebSpeechSource | null>(null);
	let autoListenEnabled = $state(false);
	let containerEl: HTMLElement | undefined = $state();

	// Each level gets its own value
	let value0 = $state('');
	let value1 = $state('');
	let value2 = $state('');

	// Event log — observes rift:transcript directly
	let nextEventId = 0;
	let eventLog = $state<Array<{ id: number; time: string; transcript: Transcript }>>([]);

	$effect(() => {
		function logTranscript(e: Event) {
			const transcript = (e as TranscriptEvent).detail;
			const time = new Date().toLocaleTimeString('en-US', {
				hour12: false,
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
			eventLog = [{ id: nextEventId++, time, transcript }, ...eventLog].slice(0, 50);
		}
		document.addEventListener(TRANSCRIPT_EVENT, logTranscript);
		return () => document.removeEventListener(TRANSCRIPT_EVENT, logTranscript);
	});

	// --- Source management ---

	function ensureSource() {
		if (!source) {
			source = new WebSpeechSource();
			// onResult defaults to broadcastTranscript — no wiring needed!
			source.onError = handleSourceError;
		}
		return source;
	}

	function handleSourceError(error: string, message: string) {
		autoListenEnabled = false;
		console.error(`[Voice Input] Fatal error: ${error} — ${message}`);
	}

	function startListening() {
		const s = ensureSource();
		if (!s.listening) {
			const result = s.startListening();
			if (isErr(result)) {
				console.error(result.error.message);
			}
		}
	}

	function stopListening() {
		source?.stopListening();
	}

	function toggleVoiceInput() {
		if (autoListenEnabled) {
			autoListenEnabled = false;
			stopListening();
		} else {
			const s = ensureSource();
			if (!s.listening) {
				const result = s.startListening();
				if (isErr(result)) {
					console.error(result.error.message);
					return;
				}
			}
			autoListenEnabled = true;
		}
	}

	// --- Auto-listen on focus/blur ---

	function handleFocusIn() {
		if (autoListenEnabled) {
			startListening();
		}
	}

	function handleFocusOut(e: FocusEvent) {
		if (!autoListenEnabled) return;
		const goingTo = e.relatedTarget as Node | null;
		if (goingTo && containerEl?.contains(goingTo)) return;
		stopListening();
	}

	// --- Helpers ---

	let copied = $state<0 | 1 | 2 | null>(null);

	async function copyToClipboard(level: 0 | 1 | 2) {
		const values = [value0, value1, value2];
		await navigator.clipboard.writeText(values[level]);
		copied = level;
		setTimeout(() => {
			copied = null;
		}, 1500);
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
	<div
		class="input-group"
		bind:this={containerEl}
		onfocusin={handleFocusIn}
		onfocusout={handleFocusOut}
	>
		<div class="controls">
			<button onclick={toggleVoiceInput}>
				{autoListenEnabled ? 'Disable Voice Input' : 'Enable Voice Input'}
			</button>
			<span class="status">
				<span class="dot" class:active={source?.listening}></span>
				{source?.listening ? 'Listening — Web Speech API' : 'Idle'}
			</span>
		</div>

		<section class="level">
			<h2>Level 2: TranscribeArea</h2>
			<p class="level-desc">Full experience. Interim text shown inline with dotted underline.</p>
			<TranscribeArea bind:value={value2} placeholder="Type or speak (with interims)..." />
			<div class="level-controls">
				<button onclick={() => copyToClipboard(2)} disabled={!value2}>
					{copied === 2 ? 'Copied!' : 'Copy'}
				</button>
				<span class="char-count">{value2.length} chars</span>
			</div>
		</section>

		<section class="level">
			<h2>Level 1: textarea + <code>use:transcribable</code></h2>
			<p class="level-desc">Voice input via action. Finals insert at cursor. No interim styling.</p>
			<textarea
				use:transcribable
				class="plain-textarea"
				bind:value={value1}
				placeholder="Type or speak (finals only)..."
			></textarea>
			<div class="level-controls">
				<button onclick={() => copyToClipboard(1)} disabled={!value1}>
					{copied === 1 ? 'Copied!' : 'Copy'}
				</button>
				<span class="char-count">{value1.length} chars</span>
			</div>
		</section>

		<section class="level">
			<h2>Level 0: Plain textarea</h2>
			<p class="level-desc">No voice input. Baseline for comparison.</p>
			<textarea class="plain-textarea" bind:value={value0} placeholder="Type here (no voice)..."
			></textarea>
			<div class="level-controls">
				<button onclick={() => copyToClipboard(0)} disabled={!value0}>
					{copied === 0 ? 'Copied!' : 'Copy'}
				</button>
				<span class="char-count">{value0.length} chars</span>
			</div>
		</section>
	</div>

	<details class="debug" open>
		<summary>Debug</summary>

		<div class="debug-section">
			<strong>Event Log</strong> ({eventLog.length} events):
			<div class="event-log">
				{#each eventLog as entry (entry.id)}
					<div class="log-entry" class:final={entry.transcript.isFinal}>
						<span class="log-time">{entry.time}</span>
						<span class="log-type">{entry.transcript.isFinal ? 'final' : 'interim'}</span>
						<span class="log-seg">seg={entry.transcript.segmentId}</span>
						<span class="log-text">"{entry.transcript.text}"</span>
						{#if entry.transcript.confidence != null}
							<span class="log-conf">({(entry.transcript.confidence * 100).toFixed(0)}%)</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</details>
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

	.level-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}

	.char-count {
		font-size: 12px;
		color: #999;
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

	.debug {
		margin-top: 24px;
		font-size: 13px;
	}

	.debug summary {
		cursor: pointer;
		font-weight: 600;
		margin-bottom: 8px;
	}

	.debug-section {
		margin-bottom: 12px;
	}

	.event-log {
		max-height: 300px;
		overflow-y: auto;
		border: 1px solid #eee;
		border-radius: 4px;
		padding: 4px;
	}

	.log-entry {
		display: flex;
		gap: 8px;
		padding: 2px 4px;
		font-family: 'Courier New', Courier, monospace;
		font-size: 12px;
		border-bottom: 1px solid #f5f5f5;
	}

	.log-entry.final {
		background: #f0f8f0;
	}

	.log-time {
		color: #999;
		flex-shrink: 0;
	}

	.log-type {
		width: 48px;
		flex-shrink: 0;
		font-weight: 600;
	}

	.log-entry.final .log-type {
		color: #2e7d32;
	}

	.log-entry:not(.final) .log-type {
		color: #888;
	}

	.log-seg {
		color: #999;
		flex-shrink: 0;
	}

	.log-text {
		color: #333;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.log-conf {
		color: #999;
		flex-shrink: 0;
	}
</style>
