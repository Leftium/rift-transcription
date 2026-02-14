<script lang="ts">
	const codeBlocks: Record<string, string> = {
		install: `pip install rift-local[sherpa,moonshine]`,
		serve: `rift-local serve`,
		'serve-sherpa': `rift-local serve --model nemotron-streaming-en`,
		list: `rift-local list`
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
	<title>Local Server Setup</title>
</svelte:head>

<main>
	<a href="/" class="back-link">&larr; Back to app</a>

	<h1>Local Server Setup</h1>
	<p class="intro">
		RIFT supports local transcription servers for private, offline speech recognition.
		<a href="https://github.com/Leftium/rift-local" target="_blank" rel="noopener">rift-local</a>
		is the recommended option — it handles model downloads, server configuration, and supports multiple
		backends.
	</p>

	<h2>rift-local (Recommended)</h2>

	<p>
		<a href="https://github.com/Leftium/rift-local" target="_blank" rel="noopener">
			github.com/Leftium/rift-local
		</a>
	</p>

	<h3>Install</h3>
	<p>Install with both backends (sherpa-onnx and moonshine):</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('install')}>
			{copiedId === 'install' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['install']}</code></pre>
	</div>

	<h3>Usage</h3>
	<p>Start the server (default: moonshine-medium-en on port 2177):</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('serve')}>
			{copiedId === 'serve' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['serve']}</code></pre>
	</div>

	<p>Use a sherpa-onnx model instead:</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('serve-sherpa')}>
			{copiedId === 'serve-sherpa' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['serve-sherpa']}</code></pre>
	</div>

	<p>List all available models:</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('list')}>
			{copiedId === 'list' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['list']}</code></pre>
	</div>

	<h3>Available Models</h3>

	<h4>sherpa-onnx</h4>
	<table>
		<thead>
			<tr>
				<th>Model</th>
				<th>Params</th>
				<th>Notes</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>nemotron-streaming-en</code></td>
				<td>0.6B</td>
				<td>Best accuracy</td>
			</tr>
			<tr>
				<td><code>zipformer-small-en</code></td>
				<td>~30M</td>
				<td>Lightweight, fast</td>
			</tr>
			<tr>
				<td><code>zipformer-bilingual-zh-en</code></td>
				<td>~70M</td>
				<td>Bilingual ZH+EN</td>
			</tr>
		</tbody>
	</table>

	<h4>moonshine</h4>
	<table>
		<thead>
			<tr>
				<th>Model</th>
				<th>Params</th>
				<th>Notes</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>moonshine-tiny-en</code></td>
				<td>34M</td>
				<td>Fastest</td>
			</tr>
			<tr>
				<td><code>moonshine-small-en</code></td>
				<td>123M</td>
				<td>Balanced</td>
			</tr>
			<tr>
				<td><code>moonshine-medium-en</code></td>
				<td>245M</td>
				<td>Default; best moonshine accuracy</td>
			</tr>
		</tbody>
	</table>

	<h2>Alternative</h2>
	<p>
		For manual sherpa-onnx C++ server setup (without Python), see the
		<a href="/sherpa">standalone sherpa-onnx setup guide</a>.
	</p>
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

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		margin: 8px 0 16px;
	}

	th {
		text-align: left;
		padding: 6px 10px;
		border-bottom: 2px solid #ddd;
		font-size: 12px;
		color: #666;
		font-weight: 600;
	}

	td {
		padding: 5px 10px;
		border-bottom: 1px solid #eee;
		color: #333;
	}

	tr:last-child td {
		border-bottom: none;
	}
</style>
