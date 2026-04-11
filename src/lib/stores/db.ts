const DB_NAME = 'sovereignty-stack';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains('worksheets')) {
				db.createObjectStore('worksheets');
			}
			if (!db.objectStoreNames.contains('conversations')) {
				db.createObjectStore('conversations');
			}
			if (!db.objectStoreNames.contains('evaluations')) {
				db.createObjectStore('evaluations');
			}
			if (!db.objectStoreNames.contains('settings')) {
				db.createObjectStore('settings');
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	return dbPromise;
}

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, 'readonly');
		const req = tx.objectStore(store).get(key);
		req.onsuccess = () => resolve(req.result as T | undefined);
		req.onerror = () => reject(req.error);
	});
}

export async function dbSet<T>(store: string, key: string, value: T): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, 'readwrite');
		tx.objectStore(store).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, 'readonly');
		const req = tx.objectStore(store).getAll();
		req.onsuccess = () => resolve(req.result as T[]);
		req.onerror = () => reject(req.error);
	});
}

export async function dbDelete(store: string, key: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, 'readwrite');
		tx.objectStore(store).delete(key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
