<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { GgConsole } from '@leftium/gg';
	import EventLog from '$lib/EventLog.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<GgConsole />
<EventLog />
{@render children()}
