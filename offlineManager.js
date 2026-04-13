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

async function processSyncQueue() {
    if (!navigator.onLine) return;

    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    console.log(`🚀 Sincronizzazione Di ${queue.length} Elementi...`);
    updateNetworkLED('syncing'); // Accende LED Blu

    // FONDAMENTALE: Diamo 1.5 secondi a Supabase per ripristinare il token Auth dopo il ritorno online
    await new Promise(resolve => setTimeout(resolve, 2000));

    const db = await initIndexedDB();

    for (const item of queue) {
        try {
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
                console.error(`❌ Sync Fallita Per ${item.table}:`, error);
                // In caso di errore spegniamo il LED (evita l'effetto loop) e interrompiamo.
                // L'elemento rimane in coda per il prossimo tentativo.
                updateNetworkLED('online');
                return;
            }

            // ✅ SUCCESSO: Elimina SOLO questo elemento dalla coda di IndexedDB
            await new Promise(res => {
                const req = db.transaction(QUEUE_STORE, 'readwrite').objectStore(QUEUE_STORE).delete(item.id);
                req.onsuccess = () => res();
            });

            console.log(`✅ Sincronizzato ${op} Per ${item.table}`);

        } catch (err) {
            console.error("Errore Critico Durante La Sincronizzazione:", err);
            updateNetworkLED('online');
            return;
        }
    }

    console.log("✅ Sincronizzazione Completata Con Successo!");
    updateNetworkLED('online'); // Torna LED Verde

    // Ricarichiamo i dati a schermo per allinearli al Server
    if (typeof appState !== 'undefined') {
        appState.calendarNeedsRefresh = true;
        appState.clientsNeedsRefresh = true;
        appState.tasksNeedsRefresh = true;

        // Aggiorna visivamente la pagina in cui ci troviamo
        if (document.getElementById('calendar-view').classList.contains('active')) {
            await loadMonthDataFromSupabase(currentDate);
        } else if (document.getElementById('clients-view').classList.contains('active')) {
            await loadAllDataFromSupabase();
        } else if (document.getElementById('tasks-view').classList.contains('active')) {
            await renderTasks();
        }
    }
}

// Network Listener
window.addEventListener('online', () => {
    updateNetworkLED(true);
    processSyncQueue();
});
window.addEventListener('offline', () => updateNetworkLED(false));


// http://192.168.1.37:5500