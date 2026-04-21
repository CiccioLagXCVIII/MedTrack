/**
 * ISFplan Debug Features
 * Espone funzioni globali per testare notifiche, database offline e stato della RAM.
 * Utilizzo: Apri la console del browser (F12) e scrivi 'debug.aiuto()'
 */

const debug = {
    // --- 1. AIUTO E STATO ---
    aiuto: function () {
        console.group("🚀 ISFplan Debug System");
        console.log("Comandi Notifiche:");
        console.log(" - debug.testNotificaMattina()  -> Simula il briefing delle 07:00");
        console.log(" - debug.testNotificaVisita()   -> Simula avviso visita tra 15 min");
        console.log(" - debug.permessiNotifiche()    -> Controlla stato permessi");

        console.log("\nComandi Dati e Sync:");
        console.log(" - debug.mostraRAM()            -> Mostra liste medici e visite caricate");
        console.log(" - debug.mostraCache()          -> Legge dati salvati in IndexedDB");
        console.log(" - debug.mostraCodaSync()       -> Mostra operazioni in attesa di internet");
        console.log(" - debug.svuotaTutto()          -> Cancella cache locale (Attenzione!)");

        console.log("\nComandi UI:");
        console.log(" - debug.vaiA(viewId)           -> Cambia vista (es: 'clients-view')");
        console.log(" - debug.apriModale(id)         -> Apre qualsiasi modale per ID");
        console.groupEnd();
    },

    // --- 2. TEST NOTIFICHE ---
    testNotificaMattina: function () {
        console.log("🧪 Test: Simulazione Briefing Mattutino...");
        if (typeof sendLocalNotification === 'function') {
            sendLocalNotification(
                "TEST: Briefing Pronto",
                "Hai 3 Visite simulate in programma oggi.",
                "dayReport.html"
            );
        } else {
            console.error("Funzione sendLocalNotification non trovata!");
        }
    },

    testNotificaVisita: function () {
        console.log("🧪 Test: Simulazione Promemoria Visita...");
        if (typeof sendLocalNotification === 'function') {
            sendLocalNotification(
                "Prossima Visita (TEST)",
                "Dr. Mario Rossi - Tra 15 minuti"
            );
        }
    },

    permessiNotifiche: function () {
        console.log("Stato attuale:", Notification.permission);
        if (Notification.permission === 'default') console.warn("Richiedi i permessi cliccando sulla campana nell'app.");
    },

    // --- 3. ISPEZIONE DATI ---
    mostraRAM: function () {
        console.group("📦 Stato attuale RAM (Variabili Globali)");
        console.log("Medici in memoria:", clientsList);
        console.log("Visite in memoria:", allVisits);
        console.log("Tasks in memoria:", tasksList);
        console.table(clientsList);
        console.groupEnd();
    },

    mostraCache: async function () {
        console.group("💾 Stato IndexedDB (Offline Cache)");
        try {
            const medici = await getFromOfflineCache('clientsData');
            const visite = await getFromOfflineCache('visitsData');
            const tasks = await getFromOfflineCache('tasksData');
            console.log("Medici salvati offline:", medici);
            console.log("Visite salvate offline:", visite);
            console.log("Tasks salvati offline:", tasks);
        } catch (e) {
            console.error("Errore lettura IndexedDB:", e);
        }
        console.groupEnd();
    },

    mostraCodaSync: async function () {
        if (typeof getSyncQueue === 'function') {
            const coda = await getSyncQueue();
            console.log("🔄 Operazioni in coda di sincronizzazione:", coda);
            console.table(coda);
        } else {
            console.error("Funzione getSyncQueue non trovata!");
        }
    },

    svuotaTutto: function () {
        if (confirm("Vuoi davvero cancellare tutta la cache locale? Dovrai ricaricare la pagina.")) {
            indexedDB.deleteDatabase("ISFplanOfflineDB");
            localStorage.clear();
            location.reload();
        }
    },

    // --- 4. TEST UI ---
    vaiA: function (viewId) {
        if (typeof showView === 'function') {
            showView(viewId);
            console.log(`Navigazione verso: ${viewId}`);
        }
    },

    apriModale: function (modalId) {
        if (typeof openModal === 'function') {
            openModal(modalId);
        } else {
            const m = new bootstrap.Modal(document.getElementById(modalId));
            m.show();
        }
    }
};

// Espongo l'oggetto debug globalmente
window.debug = debug;

console.log("%c🛠️ ISFplan Debug Tool Caricato!", "color: #bf4f8a; font-weight: bold; font-size: 14px;");
console.log("Scrivi 'debug.aiuto()' per i comandi.");