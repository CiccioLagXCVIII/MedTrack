/* AA GESTIONE OFFLINE AVANZATA (CACHE & OUTBOX PATTERN) */
const DB_NAME = 'MedTrackOfflineDB';
const CACHE_STORE = 'cacheStore';
const QUEUE_STORE = 'syncQueue';

async function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
            if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveToOfflineCache(key, data) {
    const db = await initIndexedDB();
    db.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).put(data, key);
}

async function getFromOfflineCache(key) {
    const db = await initIndexedDB();
    return new Promise(res => {
        const req = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(key);
        req.onsuccess = () => res(req.result);
    });
}

async function addToSyncQueue(operation, table, payload, matchCriteria = null) {
    const db = await initIndexedDB();
    db.transaction(QUEUE_STORE, 'readwrite').objectStore(QUEUE_STORE).add({
        operation, table, payload, matchCriteria, timestamp: Date.now()
    });
}

async function getSyncQueue() {
    const db = await initIndexedDB();
    return new Promise(res => {
        const req = db.transaction(QUEUE_STORE, 'readonly').objectStore(QUEUE_STORE).getAll();
        req.onsuccess = () => res(req.result);
    });
}

async function clearSyncQueue() {
    const db = await initIndexedDB();
    db.transaction(QUEUE_STORE, 'readwrite').objectStore(QUEUE_STORE).clear();
}

// MODIFICA IN offlineManager.js
async function processSyncQueue() {
    if (!navigator.onLine) return;
    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    console.log(`🚀 Sincronizzazione Di ${queue.length} Elementi...`);

    // Accendi LED Blu Di Sincronizzazione
    updateNetworkLED('syncing');

    // Uso L'Istanza DB Per Cancellare I Singoli Elementi
    const db = await initIndexedDB();

    for (const item of queue) {
        let query;
        const op = item.operation.toUpperCase();

        if (op === 'INSERT') {
            query = sb.from(item.table).insert(item.payload);
        } else if (op === 'UPDATE') {
            query = sb.from(item.table).update(item.payload);
            for (const [key, val] of Object.entries(item.matchCriteria)) {
                query = query.eq(key, val);
            }
        } else if (op === 'DELETE') {
            query = sb.from(item.table).delete();
            for (const [key, val] of Object.entries(item.matchCriteria)) {
                query = query.eq(key, val);
            }
        }

        const { error } = await query;
        if (error) {
            console.error("Sync Fallita per item:", item, error);
            // Non Cancellare L'Item, Che Rimane Per Il Prossimo Tentativo
        } else {
            // Cancella Solo L'Item Caricato Correttamente Nel DB
            db.transaction(QUEUE_STORE, 'readwrite').objectStore(QUEUE_STORE).delete(item.id);
        }
    }

    // Ricarica Lo Stato Della Web App Dopo La Sincronizzazione
    appState.calendarNeedsRefresh = true;
    appState.clientsNeedsRefresh = true;
    appState.tasksNeedsRefresh = true;
    console.log("✅ Sincronizzazione Completata!");
    updateNetworkLED('online');
    openAlert("Sincronizzazione Avvenuta Con Successo!", "success");

    // Ricarica Solo I Dati Necessari Per Aggiornare L'Interfaccia Utente Evitando Ricariche Inutili
    if (appState.calendarNeedsRefresh) loadMonthDataFromSupabase(currentDate);
    if (appState.clientsNeedsRefresh) loadAllDataFromSupabase();
}

// Network Listener
window.addEventListener('online', () => {
    updateNetworkLED(true);
    processSyncQueue();
});
window.addEventListener('offline', () => updateNetworkLED(false));


// http://192.168.1.37:5500