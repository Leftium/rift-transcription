<script lang="ts">
	const codeBlocks: Record<string, string> = {
		'download-binary': `mkdir -p ~/sherpa-onnx/bin && cd ~/sherpa-onnx
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.12.23/sherpa-onnx-v1.12.23-osx-universal2-shared.tar.bz2
tar xf sherpa-onnx-v1.12.23-osx-universal2-shared.tar.bz2
cp sherpa-onnx-v1.12.23-osx-universal2-shared/bin/sherpa-onnx-online-websocket-server bin/
cp -r sherpa-onnx-v1.12.23-osx-universal2-shared/lib .`,

		quarantine: `xattr -r -d com.apple.quarantine ~/sherpa-onnx/`,

		'model-small': `cd ~/sherpa-onnx && mkdir -p models && cd models
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06.tar.bz2
tar xf sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06.tar.bz2`,

		'model-large': `cd ~/sherpa-onnx && mkdir -p models && cd models
wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2
tar xf sherpa-onnx-streaming-zipformer-en-2023-06-26.tar.bz2`,

		'start-small': `~/sherpa-onnx/bin/sherpa-onnx-online-websocket-server \\
  --port=6006 \\
  --max-batch-size=1 \\
  --loop-interval-ms=10 \\
  --tokens=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06/tokens.txt \\
  --encoder=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06/encoder.onnx \\
  --decoder=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06/decoder.onnx \\
  --joiner=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06/joiner.onnx`,

		'start-large-fp32': `~/sherpa-onnx/bin/sherpa-onnx-online-websocket-server \\
  --port=6006 \\
  --max-batch-size=1 \\
  --loop-interval-ms=10 \\
  --tokens=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/tokens.txt \\
  --encoder=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/encoder-epoch-99-avg-1-chunk-16-left-128.onnx \\
  --decoder=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/decoder-epoch-99-avg-1-chunk-16-left-128.onnx \\
  --joiner=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/joiner-epoch-99-avg-1-chunk-16-left-128.onnx`,

		'start-large-int8': `~/sherpa-onnx/bin/sherpa-onnx-online-websocket-server \\
  --port=6006 \\
  --max-batch-size=1 \\
  --loop-interval-ms=10 \\
  --tokens=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/tokens.txt \\
  --encoder=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx \\
  --decoder=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx \\
  --joiner=$HOME/sherpa-onnx/models/sherpa-onnx-streaming-zipformer-en-2023-06-26/joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx`
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
	<title>Sherpa-ONNX Server Setup</title>
</svelte:head>

<main>
	<a href="/" class="back-link">&larr; Back to app</a>

	<h1>Sherpa-ONNX Server Setup</h1>
	<p class="intro">
		Sherpa-ONNX is a local speech recognition server. Running it alongside the app enables private,
		offline transcription via the "Sherpa (local)" source option.
	</p>

	<h2>1. Download Server Binary</h2>
	<p>For macOS (Universal — works on Intel and Apple Silicon):</p>
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

	<h2>2. Download a Model</h2>

	<h3>Small model (~55 MB, faster, lower accuracy)</h3>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('model-small')}>
			{copiedId === 'model-small' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['model-small']}</code></pre>
	</div>

	<h3>Large model (~296 MB, slower, higher accuracy)</h3>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('model-large')}>
			{copiedId === 'model-large' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['model-large']}</code></pre>
	</div>

	<p class="note">
		<strong>Note:</strong> The large model outputs ALL CAPS (trained on LibriSpeech).
	</p>

	<p>
		For all available models:
		<a
			href="https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-transducer/index.html"
			target="_blank"
			rel="noopener"
		>
			online transducer models
		</a>.
	</p>

	<h2>3. Start the Server</h2>

	<h3>With small model (kroko):</h3>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('start-small')}>
			{copiedId === 'start-small' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['start-small']}</code></pre>
	</div>

	<h3>With large model (fp32):</h3>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('start-large-fp32')}>
			{copiedId === 'start-large-fp32' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['start-large-fp32']}</code></pre>
	</div>

	<h3>With large model (int8 — faster, slightly less accurate):</h3>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('start-large-int8')}>
			{copiedId === 'start-large-int8' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['start-large-int8']}</code></pre>
	</div>

	<h2>Server Flags</h2>
	<ul class="flags">
		<li>
			<code>--port=6006</code> — WebSocket port (must match the URL in the app, default
			<code>ws://localhost:6006</code>)
		</li>
		<li>
			<code>--max-batch-size=1</code> — Process immediately instead of batching (reduces latency for single
			user)
		</li>
		<li>
			<code>--loop-interval-ms=10</code> — Server polling interval in ms (lower = less latency)
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
