import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Firefox has stricter localhost WebSocket handling than Chromium.
		// When the HMR websocket fails to connect in Firefox, Vite's
		// setupForwardConsoleHandler throws on every console call, creating
		// a runaway error cascade that eats memory. Explicitly pin the HMR
		// server port and host so Firefox can connect reliably.
		hmr: {
			protocol: 'ws',
			host: 'localhost',
			port: 5173,
			clientPort: 5173
		}
	}
});
