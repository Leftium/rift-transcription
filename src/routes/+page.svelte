<script lang="ts">
	import { isErr } from 'wellcrafted/result';
	import TranscribeArea from '$lib/TranscribeArea.svelte';
	import { WebSpeechSource } from '$lib/sources/web-speech.svelte';
	import type { Transcript } from '$lib/types.js';

	let source = $state<WebSpeechSource | null>(null);
	let transcribeArea: TranscribeArea | undefined = $state();
	let value = $state('');
	let autoListenEnabled = $state(false);
	let containerEl: HTMLElement | undefined = $state();
	let nextEventId = 0;
	let eventLog = $state<Array<{ id: number; time: string; transcript: Transcript }>>([]);

	function ensureSource() {
		if (!source) {
			source = new WebSpeechSource();
			source.onResult = handleResult;
			source.onError = handleSourceError;
		}
		return source;
	}

	function handleSourceError(error: string, message: string) {
		// Fatal error from source — disable auto-listen so focusin
		// doesn't keep retrying a broken recognition instance.
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
			// Disable voice input mode
			autoListenEnabled = false;
			stopListening();
		} else {
			// Enable voice input mode — button click satisfies user gesture requirement
			const s = ensureSource();
			if (!s.listening) {
				const result = s.startListening();
				if (isErr(result)) {
					console.error(result.error.message);
					return; // Don't enable auto-listen if start failed
				}
			}
			autoListenEnabled = true;
		}
	}

	// --- Auto-listen on focus/blur ---
	// Uses focusin/focusout on a container wrapping textarea + controls.
	// focusout's relatedTarget tells us WHERE focus is going — if it's
	// still inside the container, we don't stop.

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

	let copied = $state(false);

	async function copyToClipboard() {
		await navigator.clipboard.writeText(value);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 1500);
	}

	function handleResult(transcript: Transcript) {
		const time = new Date().toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		eventLog = [{ id: nextEventId++, time, transcript }, ...eventLog].slice(0, 50);
		transcribeArea?.handleTranscript(transcript);
	}
</script>

<main>
	<h1>RIFT TranscribeArea MVP</h1>
	<p class="intro">
		A textarea that accepts voice input with inline interim styling. See the <a
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
		<TranscribeArea bind:this={transcribeArea} bind:value />

		<div class="controls">
			<button onclick={toggleVoiceInput}>
				{autoListenEnabled ? 'Disable Voice Input' : 'Enable Voice Input'}
			</button>
			<button onclick={copyToClipboard} disabled={!value}>
				{copied ? 'Copied!' : 'Copy'}
			</button>
			<span class="status">
				<span class="dot" class:active={source?.listening}></span>
				{source?.listening ? 'Listening — Web Speech API' : 'Idle'}
			</span>
		</div>
	</div>

	<details class="debug" open>
		<summary>Debug</summary>

		<div class="debug-section">
			<strong>value</strong> ({value.length} chars):
			<pre>{value || '(empty)'}</pre>
		</div>

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

	.intro {
		color: #555;
		font-size: 14px;
		margin: 0 0 16px;
	}

	.intro a {
		color: #4a90d9;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 8px;
		margin-bottom: 16px;
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

	pre {
		background: #f5f5f5;
		padding: 8px;
		border-radius: 4px;
		margin: 4px 0;
		white-space: pre-wrap;
		word-break: break-all;
		font-size: 12px;
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
