<svelte:head>
	<title>Local Server Setup</title>
</svelte:head>

<main>
	<a href="/" class="back-link">&larr; Back to app</a>

	<h1>Local Server Setup</h1>

	<p>
		Preferred: install and run
		<a href="https://github.com/Leftium/rift-local" target="_blank" rel="noopener">rift-local</a>
	</p>

	<p>
		Alternative:
		<a href="/sherpa">standalone sherpa-onnx server</a>
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

	p {
		font-size: 14px;
		line-height: 1.5;
		color: #333;
		margin: 8px 0;
	}

	a {
		color: #4a90d9;
	}
</style>
