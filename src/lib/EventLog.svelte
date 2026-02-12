<script lang="ts">
	import { TRANSCRIPT_EVENT, type TranscriptEvent } from '$lib/types.js';
	import { gg, fg, bg } from '@leftium/gg';

	$effect(() => {
		function handleTranscript(e: Event) {
			const { detail } = e as TranscriptEvent;
			const t = detail;
			const conf = t.confidence != null ? ` ${(t.confidence * 100).toFixed(0)}%` : '';
			if (t.isFinal) {
				gg(bg('#f0f8f0').fg('#2e7d32')`final seg=${t.segmentId} "${t.text}"${conf}`);
			} else {
				gg(fg('#888')`interim seg=${t.segmentId} "${t.text}"${conf}`);
			}
		}

		document.addEventListener(TRANSCRIPT_EVENT, handleTranscript);

		return () => {
			document.removeEventListener(TRANSCRIPT_EVENT, handleTranscript);
		};
	});
</script>
