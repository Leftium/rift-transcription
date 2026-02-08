<script lang="ts">
	import TranscribeArea from '$lib/TranscribeArea.svelte';
	import { transcribable } from '$lib/transcribable.js';
	import CopyButton from '$lib/CopyButton.svelte';
	import EventLog from '$lib/EventLog.svelte';
	import { VoiceInputController } from '$lib/VoiceInputController.svelte';

	const voice = new VoiceInputController();

	let value0 = $state('');
	let value1 = $state('');
	let value2 = $state('');
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
			{/if}

			<span class="status">
				<span class="dot" class:active={voice.listening}></span>
				{#if voice.listening}
					Listening — {voice.sourceType === 'sherpa' ? 'Sherpa' : 'Web Speech'}
				{:else}
					Idle
				{/if}
			</span>
		</div>

		<section class="level">
			<h2>Level 2: <code>&lt;TranscribeArea&gt;</code> component</h2>
			<p class="level-desc">Full experience. Interim text shown inline with dotted underline.</p>
			<TranscribeArea bind:value={value2} placeholder="Type or speak (with interims)..." debug />
			<CopyButton value={value2} />
		</section>

		<section class="level">
			<h2>Level 1: <code>&lt;textarea&gt;</code> + <code>transcribable</code> attachment</h2>
			<p class="level-desc">
				Voice input via attachment. Finals insert at cursor. No interim styling.
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

	.server-url {
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
