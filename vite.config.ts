import devtoolsJson from 'vite-plugin-devtools-json';
import ggPlugins from '@leftium/gg/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), devtoolsJson(), ...ggPlugins()],
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
