<script lang="ts">
	const codeBlocks: Record<string, string> = {
		'install-uv': `brew install uv`,
		install: `uv tool install rift-local`,
		'install-pip': `python3 -m venv .venv && source .venv/bin/activate\npip install rift-local`,
		'install-sherpa': `uv tool install "rift-local[sherpa]"`,
		'install-sherpa-pip': `pip install "rift-local[sherpa]"`,
		'serve-open': `rift-local serve --open`,
		serve: `rift-local serve`,
		'serve-sherpa': `rift-local serve --asr zipformer-en-kroko`,
		'serve-moonshine-small': `rift-local serve --asr moonshine-en-small`,
		list: `rift-local list`
	};

	let copiedId = $state('');
	let showAdvanced = $state(false);

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
	<ul class="intro-bullets">
		<li>
			RIFT supports local servers for private offline transcription and even LLM transformations.
		</li>
		<li>
			<a href="https://github.com/Leftium/rift-local" target="_blank" rel="noopener">rift-local</a>
			is the recommended server: it handles model downloads, server configuration, and supports multiple
			backends.
		</li>
	</ul>

	<h2>Quick Start</h2>
	<p>
		Requires Python 3.10+. Install <a
			href="https://docs.astral.sh/uv/"
			target="_blank"
			rel="noopener">uv</a
		> first:
	</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('install-uv')}>
			{copiedId === 'install-uv' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['install-uv']}</code></pre>
	</div>

	<p>Then install rift-local:</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('install')}>
			{copiedId === 'install' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['install']}</code></pre>
	</div>

	<p>Start the server and open RIFT in your browser:</p>
	<div class="code-block">
		<button class="copy-btn" onclick={() => copyCode('serve-open')}>
			{copiedId === 'serve-open' ? '✓' : 'Copy'}
		</button>
		<pre><code>{codeBlocks['serve-open']}</code></pre>
	</div>

	<p class="quick-note">
		That's it! Your browser will open with the Local source pre-selected. Click Enable Voice Input
		to start.
	</p>

	<details class="pip-alternative">
		<summary>Alternative: install with pip</summary>
		<div class="details-content">
			<div class="code-block">
				<button class="copy-btn" onclick={() => copyCode('install-pip')}>
					{copiedId === 'install-pip' ? '✓' : 'Copy'}
				</button>
				<pre><code>{codeBlocks['install-pip']}</code></pre>
			</div>
		</div>
	</details>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="advanced-section">
		<h3
			class="collapsible-header"
			onclick={() => (showAdvanced = !showAdvanced)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					showAdvanced = !showAdvanced;
				}
			}}
			role="button"
			tabindex="0"
		>
			<span class="toggle-icon">{showAdvanced ? '▼' : '▶'}</span>
			Advanced Usage
		</h3>

		{#if showAdvanced}
			<div class="advanced-content">
				<h4>Server Only (no browser)</h4>
				<div class="code-block">
					<button class="copy-btn" onclick={() => copyCode('serve')}>
						{copiedId === 'serve' ? '✓' : 'Copy'}
					</button>
					<pre><code>{codeBlocks['serve']}</code></pre>
				</div>
				<p>
					Starts the server on <code>ws://localhost:2177</code> using
					<code>moonshine-en-medium</code> without opening a browser.
				</p>

				<h4>Optional: sherpa-onnx Backend</h4>
				<p>For additional sherpa-onnx models (Nemotron, Kroko):</p>
				<div class="code-block">
					<button class="copy-btn" onclick={() => copyCode('install-sherpa')}>
						{copiedId === 'install-sherpa' ? '✓' : 'Copy'}
					</button>
					<pre><code>{codeBlocks['install-sherpa']}</code></pre>
				</div>
				<p class="pip-note">
					Or with pip (inside a venv): <code>{codeBlocks['install-sherpa-pip']}</code>
				</p>

				<h4>Using Different Models</h4>
				<p>Use a lighter sherpa-onnx model:</p>
				<div class="code-block">
					<button class="copy-btn" onclick={() => copyCode('serve-sherpa')}>
						{copiedId === 'serve-sherpa' ? '✓' : 'Copy'}
					</button>
					<pre><code>{codeBlocks['serve-sherpa']}</code></pre>
				</div>

				<p>Use a smaller moonshine model:</p>
				<div class="code-block">
					<button class="copy-btn" onclick={() => copyCode('serve-moonshine-small')}>
						{copiedId === 'serve-moonshine-small' ? '✓' : 'Copy'}
					</button>
					<pre><code>{codeBlocks['serve-moonshine-small']}</code></pre>
				</div>

				<h4>Listing Models</h4>
				<p>See all available models:</p>
				<div class="code-block">
					<button class="copy-btn" onclick={() => copyCode('list')}>
						{copiedId === 'list' ? '✓' : 'Copy'}
					</button>
					<pre><code>{codeBlocks['list']}</code></pre>
				</div>

				<p>
					See the <a
						href="https://github.com/Leftium/rift-local#readme"
						target="_blank"
						rel="noopener">rift-local README</a
					> for more options.
				</p>
			</div>
		{/if}
	</div>

	<h3>Available Models</h3>

	<h4>sherpa-onnx</h4>
	<table>
		<thead>
			<tr>
				<th>Model</th>
				<th>Params</th>
				<th>Disk</th>
				<th>Notes</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>nemotron-en</code></td>
				<td>0.6B</td>
				<td>600MB</td>
				<td>Best accuracy (int8)</td>
			</tr>
			<tr>
				<td><code>zipformer-en-kroko</code></td>
				<td>~30M</td>
				<td>68MB</td>
				<td>Lightweight, fast</td>
			</tr>
		</tbody>
	</table>

	<h4>moonshine</h4>
	<table>
		<thead>
			<tr>
				<th>Model</th>
				<th>Params</th>
				<th>Disk</th>
				<th>Notes</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>moonshine-en-medium</code></td>
				<td>245M</td>
				<td>190MB</td>
				<td>Default; best moonshine accuracy</td>
			</tr>
			<tr>
				<td><code>moonshine-en-small</code></td>
				<td>123M</td>
				<td>95MB</td>
				<td>Balanced</td>
			</tr>
			<tr>
				<td><code>moonshine-en-tiny</code></td>
				<td>34M</td>
				<td>26MB</td>
				<td>Fastest</td>
			</tr>
		</tbody>
	</table>

	<h2>Alternative Server (without Python)</h2>
	<p>
		See the <a href="/sherpa">sherpa-onnx C++ server setup guide</a>.
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
		margin-bottom: 12px;
	}

	.intro-bullets {
		font-size: 14px;
		line-height: 1.6;
		color: #555;
		margin: 0 0 16px;
		padding-left: 20px;
	}

	.intro-bullets li {
		margin-bottom: 8px;
	}

	.intro-bullets a {
		color: #4a90d9;
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

	.quick-note {
		color: #666;
		font-size: 13px;
		margin: 12px 0 24px;
		font-style: italic;
	}

	.advanced-section {
		margin: 24px 0;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		padding: 0;
		background: #fafafa;
	}

	.collapsible-header {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		user-select: none;
		padding: 12px 16px;
		margin: 0;
		font-size: 0.95rem;
		transition: background 0.15s;
	}

	.collapsible-header:hover {
		background: #f0f0f0;
	}

	.toggle-icon {
		font-size: 0.7em;
		color: #999;
		transition: transform 0.2s;
	}

	.advanced-content {
		padding: 0 16px 16px;
	}

	.advanced-content h4 {
		margin-top: 16px;
		margin-bottom: 8px;
	}

	.advanced-content h4:first-child {
		margin-top: 0;
	}

	.pip-alternative {
		margin: 16px 0 24px;
		font-size: 14px;
	}

	.pip-alternative summary {
		cursor: pointer;
		color: #666;
		font-size: 13px;
	}

	.pip-alternative summary:hover {
		color: #333;
	}

	.details-content {
		padding-top: 8px;
	}

	.pip-note {
		font-size: 12px;
		color: #888;
		margin: 4px 0 12px;
	}
</style>
