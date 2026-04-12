/**
 * Browser compatibility gate. Until we resolve the Firefox HMR/WebSocket
 * cascade and any WebKit-specific Svelte 5 reactivity issues, the SPA
 * only supports Chromium-based browsers.
 *
 * Returns null if the browser is supported, otherwise a user-facing reason.
 */
export function unsupportedReason(): string | null {
	if (typeof navigator === 'undefined') return null;
	const ua = navigator.userAgent;

	if (ua.includes('Firefox')) {
		return 'Firefox is not yet supported. Please open this app in Chrome, Edge, Brave, Arc, or another Chromium-based browser.';
	}
	// Safari identifies as WebKit + Safari without Chrome in the UA.
	// Chromium-based browsers include both "Chrome" and "Safari".
	if (ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium')) {
		return 'Safari is not yet supported. Please open this app in Chrome, Edge, Brave, Arc, or another Chromium-based browser.';
	}
	return null;
}
