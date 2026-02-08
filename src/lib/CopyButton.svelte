<script lang="ts">
	interface Props {
		value: string;
	}

	let { value }: Props = $props();

	let copied = $state(false);

	function copyToClipboard() {
		navigator.clipboard.writeText(value).then(() => {
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1500);
		});
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

	.copy-btn {
		padding: 8px 16px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: #f5f5f5;
		cursor: pointer;
		font-size: 14px;
	}

	.copy-btn:hover {
		background: #e8e8e8;
	}
</style>
