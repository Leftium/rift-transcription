<script module lang="ts">
	let nextEventId = 0;
</script>

<script lang="ts">
	import { TRANSCRIPT_EVENT, type Transcript, type TranscriptEvent } from '$lib/types.js';

	let eventLog: { id: number; time: string; transcript: Transcript }[] = $state([]);

	$effect(() => {
		function handleTranscript(e: Event) {
			const { detail } = e as TranscriptEvent;
			const entry = {
				id: nextEventId++,
				time: new Date().toLocaleTimeString('en-US', {
					hour12: false,
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				}),
				transcript: detail
			};
			eventLog = [entry, ...eventLog].slice(0, 50);
		}

		document.addEventListener(TRANSCRIPT_EVENT, handleTranscript);

		return () => {
			document.removeEventListener(TRANSCRIPT_EVENT, handleTranscript);
		};
	});
</script>

<details open class="debug">
	<summary>Debug</summary>

	<div class="debug-section">
		<strong>Event Log ({eventLog.length} events):</strong>
		<div class="event-log">
			{#each eventLog as entry (entry.id)}
				<div class="log-entry" class:final={entry.transcript.isFinal}>
					<span class="log-time">{entry.time}</span>
					<span class="log-type">{entry.transcript.isFinal ? 'final' : 'interim'}</span>
					<span class="log-seg">seg={entry.transcript.segmentId}</span>
					<span class="log-text">"{entry.transcript.text}"</span>
					{#if entry.transcript.confidence != null}
						<span class="log-conf">{(entry.transcript.confidence * 100).toFixed(0)}%</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</details>

<style>
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
