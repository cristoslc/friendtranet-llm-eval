/**
 * Nuke all persisted app state — IndexedDB + session storage + localStorage.
 * Keeps the theme preference since that's UX, not assessment data.
 */
export async function resetAllData(): Promise<void> {
	// Preserve theme across the wipe.
	const savedTheme = localStorage.getItem('theme');

	localStorage.clear();
	sessionStorage.clear();

	if (savedTheme) {
		localStorage.setItem('theme', savedTheme);
	}

	// Delete the IndexedDB database entirely.
	await new Promise<void>((resolve) => {
		const req = indexedDB.deleteDatabase('sovereignty-stack');
		req.onsuccess = () => resolve();
		req.onerror = () => resolve();
		req.onblocked = () => resolve();
		// Safety timeout — if IDB is stuck, don't hang forever.
		setTimeout(resolve, 2000);
	});
}
