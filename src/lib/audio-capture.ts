/**
 * AudioCapture — manages getUserMedia → AudioContext → AudioWorklet pipeline.
 *
 * Reusable by any non-Web-Speech source that needs raw mic audio
 * (Sherpa, Soniox, Deepgram, etc.). Delivers 16kHz Float32 chunks
 * via the onAudioData callback.
 */

export class AudioCapture {
	private context: AudioContext | null = null;
	private stream: MediaStream | null = null;
	private sourceNode: MediaStreamAudioSourceNode | null = null;
	private workletNode: AudioWorkletNode | null = null;

	/** Consumer callback — receives 16kHz Float32Array chunks. */
	onAudioData: ((samples: Float32Array) => void) | null = null;

	/** The actual mic sample rate (for debug display). Available after start(). */
	get sampleRate(): number {
		return this.context?.sampleRate ?? 0;
	}

	async start(): Promise<void> {
		// Request mic access
		this.stream = await navigator.mediaDevices.getUserMedia({
			audio: {
				channelCount: 1,
				echoCancellation: true,
				noiseSuppression: true
			}
		});

		// Create audio context
		this.context = new AudioContext();

		// Load AudioWorklet processor (served from static/)
		await this.context.audioWorklet.addModule('/audio-processor.js');

		// Wire: mic → source → worklet
		this.sourceNode = this.context.createMediaStreamSource(this.stream);
		this.workletNode = new AudioWorkletNode(this.context, 'audio-processor');

		this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
			this.onAudioData?.(event.data);
		};

		this.sourceNode.connect(this.workletNode);
		// Don't connect worklet to destination — we don't want playback
	}

	stop(): void {
		// Disconnect audio nodes
		if (this.workletNode) {
			this.workletNode.port.onmessage = null;
			this.workletNode.disconnect();
			this.workletNode = null;
		}
		if (this.sourceNode) {
			this.sourceNode.disconnect();
			this.sourceNode = null;
		}

		// Stop all mic tracks
		if (this.stream) {
			for (const track of this.stream.getTracks()) {
				track.stop();
			}
			this.stream = null;
		}

		// Close audio context
		if (this.context) {
			this.context.close();
			this.context = null;
		}
	}
}
