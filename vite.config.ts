import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), devtoolsJson()],
	server: {
		allowedHosts: ['.ngrok-free.app'],
		proxy: {
			'/ws/sherpa': {
				target: 'ws://localhost:6006',
				ws: true,
				rewriteWsOrigin: true
			}
		}
	}
});
