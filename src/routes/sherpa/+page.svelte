<script lang="ts">
	// Model cache shared with rift-local: ~/.cache/rift-local/models/<model-name>/
	const MODELS = '$HOME/.cache/rift-local/models';

	const codeBlocks: Record<string, string> = {
		'download-binary': `mkdir -p ~/sherpa-onnx/bin && cd ~/sherpa-onnx
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.23/sherpa-onnx-v1.12.23-osx-universal2-shared.tar.bz2
tar xf sherpa-onnx-v1.12.23-osx-universal2-shared.tar.bz2
cp sherpa-onnx-v1.12.23-osx-universal2-shared/bin/sherpa-onnx-online-websocket-server bin/
cp -r sherpa-onnx-v1.12.23-osx-universal2-shared/lib .`,

		quarantine: `xattr -r -d com.apple.quarantine ~/sherpa-onnx/`,

		'model-nemotron': `mkdir -p ~/.cache/rift-local/models/nemotron-en && cd /tmp
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14.tar.bz2
tar xf sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14.tar.bz2
cp sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14/{tokens.txt,encoder.int8.onnx,decoder.int8.onnx,joiner.int8.onnx} ~/.cache/rift-local/models/nemotron-en/
rm -rf sherpa-onnx-nemotron-speech-streaming-en-0.6b-int8-2026-01-14*`,

		'model-zipformer-small': `mkdir -p ~/.cache/rift-local/models/zipformer-en-kroko && cd /tmp
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06.tar.bz2
tar xf sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06.tar.bz2
cp sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06/{tokens.txt,encoder.onnx,decoder.onnx,joiner.onnx} ~/.cache/rift-local/models/zipformer-en-kroko/
rm -rf sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06*`,

		'start-nemotron': `~/sherpa-onnx/bin/sherpa-onnx-online-websocket-server \\
  --port=2177 \\
  --max-batch-size=1 \\
  --loop-interval-ms=10 \\
  --tokens=${MODELS}/nemotron-en/tokens.txt \\
  --encoder=${MODELS}/nemotron-en/encoder.int8.onnx \\
  --decoder=${MODELS}/nemotron-en/decoder.int8.onnx \\
  --joiner=${MODELS}/nemotron-en/joiner.int8.onnx`,

		'start-zipformer-small': `~/sherpa-onnx/bin/sherpa-onnx-online-websocket-server \\
  --port=2177 \\
  --max-batch-size=1 \\
  --loop-interval-ms=10 \\
  --tokens=${MODELS}/zipformer-en-kroko/tokens.txt \\
  --encoder=${MODELS}/zipformer-en-kroko/encoder.onnx \\
  --decoder=${MODELS}/zipformer-en-kroko/decoder.onnx \\
  --joiner=${MODELS}/zipformer-en-kroko/joiner.onnx`
	};

	let copiedId = $state('');

	async function copyCode(id: string) {
		await navigator.clipboard.writeText(codeBlocks[id]);
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = '';
		}, 2000);
	}
</script>

<svelte:head>
	<title>Sherpa-ONNX Standalone Server Setup</title>
</svelte:head>

<main>
	<a href="/" class="back-link">&larr; Back to app</a>

	<h1>Sherpa-ONNX Standalone Server Setup</h1>
	<p class="intro">
		Manual setup for the sherpa-onnx C++ WebSocket server. For an easier alternative that handles
		model downloads automatically, see
		<a href="/local-setup">rift-local (recommended)</a>.
	</p>
	<h2>1. Download Server Binary</h2>
	<p>For macOS (Universal -- works on Intel and Apple Silicon):</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('download-binary')}>
			{copiedId === 'download-binary' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['download-binary']}</code></pre>
	</div>

	<p class="note">
		<strong>Note:</strong> macOS will quarantine the binary. Run:
	</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('quarantine')}>
			{copiedId === 'quarantine' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['quarantine']}</code></pre>
	</div>

	<p>
		For other platforms, check the
		<a href="https://github.com/k2-fsa/sherpa-onnx/releases" target="_blank" rel="noopener">
			releases page
		</a>.
	</p>

	<h2>2. Choose a Model</h2>

	<details open class="model-group">
		<summary>
			<strong>Nemotron Streaming (~600 MB) -- recommended</strong>
			<span class="model-desc">
				NVIDIA's cache-aware streaming model (600M params int8). Avg WER 7.2% with punctuation and
				capitalization. Trained on 285k hours.
				<a
					href="https://huggingface.co/nvidia/nemotron-speech-streaming-en-0.6b"
					target="_blank"
					rel="noopener"
				>
					Model card
				</a>
			</span>
		</summary>
		<h4>Download</h4>
		<div class="code-block">
			<button class="copy-btn" onclick={() => copyCode('model-nemotron')}>
				{copiedId === 'model-nemotron' ? '✓' : 'Copy'}
			</button>
			<pre><code>{codeBlocks['model-nemotron']}</code></pre>
		</div>
		<h4>Start server</h4>
		<div class="code-block">
			<button class="copy-btn" onclick={() => copyCode('start-nemotron')}>
				{copiedId === 'start-nemotron' ? '✓' : 'Copy'}
			</button>
			<pre><code>{codeBlocks['start-nemotron']}</code></pre>
		</div>
	</details>

	<details class="model-group">
		<summary>
			<strong>Zipformer Kroko (~68 MB) -- lightweight alternative</strong>
			<span class="model-desc">
				Fast, lightweight Kroko ASR model. No punctuation or capitalization, lower accuracy.
				<a href="https://huggingface.co/Banafo/Kroko-ASR" target="_blank" rel="noopener">
					Model card
				</a>
			</span>
		</summary>
		<h4>Download</h4>
		<div class="code-block">
			<button class="copy-btn" onclick={() => copyCode('model-zipformer-small')}>
				{copiedId === 'model-zipformer-small' ? '✓' : 'Copy'}
			</button>
			<pre><code>{codeBlocks['model-zipformer-small']}</code></pre>
		</div>
		<h4>Start server</h4>
		<div class="code-block">
			<button class="copy-btn" onclick={() => copyCode('start-zipformer-small')}>
				{copiedId === 'start-zipformer-small' ? '✓' : 'Copy'}
			</button>
			<pre><code>{codeBlocks['start-zipformer-small']}</code></pre>
		</div>
	</details>

	<p>
		For all available models, check the
		<a
			href="https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/index.html"
			target="_blank"
			rel="noopener"
		>
			online transducer models
		</a>
		page or run <code>rift-local list</code>.
	</p>

	<h2>3. Server Flags</h2>
	<ul class="flags">
		<li>
			<code>--port=2177</code> -- WebSocket port (must match the URL in the app, default
			<code>ws://localhost:2177</code>)
		</li>
		<li>
			<code>--max-batch-size=1</code> -- Process immediately instead of batching (reduces latency for
			single user)
		</li>
		<li>
			<code>--loop-interval-ms=10</code> -- Server polling interval in ms (lower = less latency)
		</li>
	</ul>
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

	.back-link {
		display: inline-block;
		color: #4a90d9;
		text-decoration: none;
		font-size: 14px;
		margin-bottom: 12px;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	h1 {
		font-size: 1.3rem;
		margin-bottom: 4px;
	}

	h2 {
		font-size: 1.1rem;
		margin-top: 32px;
		margin-bottom: 8px;
	}

	h3 {
		font-size: 0.95rem;
		margin-top: 20px;
		margin-bottom: 6px;
	}

	h4 {
		font-size: 0.85rem;
		margin: 14px 0 4px;
		color: #555;
	}

	.model-group {
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 0 16px;
		margin: 12px 0;
	}

	.model-group[open] {
		padding-bottom: 12px;
	}

	.model-group summary {
		cursor: pointer;
		padding: 12px 0;
		list-style: revert;
	}

	.model-group summary strong {
		font-size: 0.95rem;
	}

	.model-desc {
		display: block;
		font-size: 13px;
		color: #666;
		margin-top: 4px;
		line-height: 1.4;
	}

	p {
		font-size: 14px;
		line-height: 1.5;
		color: #333;
		margin: 8px 0;
	}

	.intro {
		color: #555;
		font-size: 14px;
		margin: 0 0 16px;
	}

	.note {
		color: #666;
		font-size: 13px;
	}

	a {
		color: #4a90d9;
	}

	code {
		background: #f0f0f0;
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 0.85em;
	}

	.code-block {
		position: relative;
		margin: 8px 0 16px;
	}

	.code-block pre {
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 12px 16px;
		overflow-x: auto;
		margin: 0;
	}

	.code-block pre code {
		background: none;
		padding: 0;
		border-radius: 0;
		font-family: 'Courier New', Courier, monospace;
		font-size: 13px;
		line-height: 1.5;
		white-space: pre;
	}

	.copy-btn {
		position: absolute;
		top: 6px;
		right: 6px;
		padding: 2px 8px;
		font-size: 12px;
		border: 1px solid #ccc;
		border-radius: 3px;
		background: #fff;
		color: #666;
		cursor: pointer;
		z-index: 1;
		opacity: 0.7;
		transition: opacity 0.15s;
	}

	.copy-btn:hover {
		opacity: 1;
		background: #eee;
	}

	.flags {
		font-size: 14px;
		line-height: 1.7;
		padding-left: 20px;
		color: #333;
	}

	.flags li {
		margin-bottom: 6px;
	}

	.flags code {
		font-size: 0.85em;
	}
</style>
