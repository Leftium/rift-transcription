/**
 * AudioWorklet processor — captures mic audio and resamples to 16kHz Float32.
 *
 * Runs in a dedicated audio thread. Posts resampled Float32Array chunks
 * to the main thread via port.postMessage(). The main thread forwards
 * these directly to a WebSocket as binary frames.
 *
 * Usage (main thread):
 *   await ctx.audioWorklet.addModule('/audio-processor.js');
 *   const node = new AudioWorkletNode(ctx, 'audio-processor');
 *   node.port.onmessage = (e) => ws.send(e.data); // Float32Array
 */

class AudioProcessor extends AudioWorkletProcessor {
	/** Fractional sample accumulator for resampling across process() calls. */
	_resampleOffset = 0;

	constructor() {
		super();
		// sampleRate is a global in AudioWorkletGlobalScope — the AudioContext's rate
		this._inputRate = sampleRate; // typically 44100 or 48000
		this._outputRate = 16000;
		this._ratio = this._inputRate / this._outputRate;
	}

	/**
	 * @param {Float32Array[][]} inputs  - inputs[0][0] is mono channel data
	 * @param {Float32Array[][]} _outputs
	 * @param {Record<string, Float32Array>} _parameters
	 * @returns {boolean} true to keep processor alive
	 */
	process(inputs, _outputs, _parameters) {
		const input = inputs[0]?.[0]; // channel 0 of input 0
		if (!input || input.length === 0) return true;

		// Downsample via linear interpolation
		const ratio = this._ratio;
		const inLen = input.length;
		// Estimate output size (may be +1 due to fractional offset carry)
		const outLen = Math.ceil((inLen - this._resampleOffset) / ratio);
		if (outLen <= 0) return true;

		const output = new Float32Array(outLen);
		let outIdx = 0;
		let pos = this._resampleOffset;

		while (pos < inLen && outIdx < outLen) {
			const idx = Math.floor(pos);
			const frac = pos - idx;
			// Linear interpolation between adjacent samples
			const a = input[idx];
			const b = idx + 1 < inLen ? input[idx + 1] : a;
			output[outIdx++] = a + frac * (b - a);
			pos += ratio;
		}

		// Carry fractional offset to next process() call for seamless resampling
		this._resampleOffset = pos - inLen;

		// Post only the filled portion (outIdx may be < outLen)
		this.port.postMessage(outIdx === outLen ? output : output.subarray(0, outIdx));

		return true;
	}
}

registerProcessor('audio-processor', AudioProcessor);
