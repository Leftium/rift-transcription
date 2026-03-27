<script lang="ts">
	interface Props {
		value: string;
	}

	let { value }: Props = $props();

	let copied = $state(false);

	function copyToClipboard() {
		navigator.clipboard.writeText(value).then(
			() => {
				copied = true;
				setTimeout(() => {
					copied = false;
				}, 1500);
			},
			(err) => {
				console.warn('[CopyButton] clipboard write failed:', err);
			}
		);
	}
</script>

<div class="controls">
	<button class="copy-btn" onclick={copyToClipboard} disabled={!value}>
		{copied ? 'Copied!' : 'Copy'}
	</button>
	<span class="char-count">{value.length} chars</span>
</div>

<style>
	.controls {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}

	.char-count {
		font-size: 12px;
		color: #999;
	}

	/* nimble handles button styling */
</style>
