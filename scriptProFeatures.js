function toggleQuickMenu() {
    const menu = document.getElementById('quick-add-menu');
    menu.classList.toggle('d-none');
    lucide.createIcons(); // Aggiorna icone se necessario
}

function goToToday() {
    const today = dayjs().format('YYYY-MM-DD');
    // Aggiorna Data Corrente
    currentDate = dayjs();
    // Apre Direttamente Vista Giorno
    openDayView(today);
}

// BB Gestione Vai A Data Specifica
function openJumpToDateModal() {
    // Imposta Default A Oggi
    document.getElementById('jump-to-date-input').value = dayjs().format('YYYY-MM-DD');
    openModal('modal-jump-date');
}

function jumpToDate() {
    const dateValue = document.getElementById('jump-to-date-input').value;
    if (!dateValue) return;

    // Aggiorna Data Corrente
    currentDate = dayjs(dateValue);

    // Chiude Modal
    closeModal('modal-jump-date');

    // Apre Direttamente Vista Giorno
    openDayView(dateValue);
}

function updatePref(key, value) {
    localStorage.setItem('pref_' + key, value);
    // Se Cambia Orario, Ricalcola Tutte Le Notifiche Per Oggi
    if (key === 'notifyTime' && typeof allVisits !== 'undefined') {
        scheduleAllTodayVisits(allVisits);
    }
}

async function forceSync() {
    if (!navigator.onLine) {
        openAlert("Devi Essere Online Per Sincronizzare I Dati!");
        return;
    }
    updateNetworkLED('syncing');
    await processSyncQueue();
    // Ricarica Dati Da Supabase Per Sicurezza
    await loadMonthDataFromSupabase(currentDate);
    openAlert("Sincronizzazione Completata Con Successo!");
}

async function clearAppCache() {
    // --- HELPER INTERNO: Sostituisce il confirm() nativo con il modal-confirm ---
    const askConfirm = (message) => {
        return new Promise((resolve) => {
            const desc = document.getElementById('modal-confirm-desc');
            const confirmBtn = document.getElementById('btn-execute-confirm');
            const cancelBtn = document.querySelector('#modal-confirm .btn-light');

            desc.innerText = message;

            // Funzioni con auto-rimozione: dopo il click si eliminano da sole
            // e ripristinano il comportamento originale degli altri modal
            const onConfirm = () => {
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeModal('modal-confirm');
                resolve(true);
            };

            const onCancel = () => {
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                closeModal('modal-confirm');
                resolve(false);
            };

            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);

            openModal('modal-confirm');
        });
    };

    // 1. Controllo Connessione
    if (!navigator.onLine) {
        const procediOffline = await askConfirm("ATTENZIONE: Sei Offline. Se Pulisci La Cache Ora, Perderai Tutte Le Modifiche Fatte Che Non Sono Ancora State Inviate Al Server. Vuoi Procedere Comunque?");
        if (!procediOffline) return;
    } else {
        // Se Online, Effettua Sincronizzazione di sicurezza
        try {
            console.log("🔄 Avvio Sincronizzazione Di Sicurezza Prima Della Pulizia Cache...");
            updateNetworkLED('syncing');

            await processSyncQueue();

            updateNetworkLED('online');
            console.log("✅ Sincronizzazione Di Sicurezza Completata.");
        } catch (error) {
            console.error("Errore Durante La Sincronizzazione:", error);
            updateNetworkLED('online');
            const ignoraErrore = await askConfirm("La Sincronizzazione Automatica È Fallita. Se Continui, I Dati Non Salvati Andranno Persi. Procedere Comunque?");
            if (!ignoraErrore) return;
        }
    }

    // 2. Conferma Finale Prima Di Pulire La Cache
    const confermaFinale = await askConfirm("I Dati Sono Stati Sincronizzati. Vuoi Procedere Con La Pulizia Della Cache Locale? L'App Verrà Riavviata.");

    if (confermaFinale) {
        try {
            const db = await initIndexedDB();

            // Pulizia effettiva dello store
            const tx = db.transaction(['cacheStore'], 'readwrite');
            tx.objectStore('cacheStore').clear();

            tx.oncomplete = () => {
                console.log("🧹 Cache Locale Svuotata Con Successo.");

                // Prepariamo il modal alert per il successo con ricarica pagina
                const alertDesc = document.getElementById('modal-alert-desc');
                const alertBtn = document.querySelector('#modal-alert .btn-primary');

                alertDesc.innerText = "Pulizia Completata. L'App Verrà Ricaricata Per Scaricare I Dati Aggiornati.";

                // Imposta Azione Tasto OK Dell'Alert Solo Per Questa Volta
                alertBtn.onclick = () => {
                    window.location.reload();
                };

                openModal('modal-alert');
            };

            tx.onerror = (err) => {
                console.error("Errore Durante Pulizia Di IndexedDB:", err);
                openAlert("Si È Verificato UN Errore Durante La Pulizia Della Cache.");
            };
        } catch (err) {
            console.error("Impossibile Accedere Al Database Per La Pulizia:", err);
            updateNetworkLED('online');
            openAlert("Impossibile Accedere Al Database Per La Pulizia.");
        }
    }
}

function reportProblem() {
    const email = "francescolv78@gmail.com";
    const subject = "Segnalazione Problema ISFplan v1.6.2";
    const body = "Descrivi Qui Il Problema Che Hai Riscontrato:\n\n- Passaggi Per Riprodurre:\n- Comportamento Atteso:\n- Comportamento Effettivo:\n\nGrazie Per Il Tuo Feedback!";
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const nav = localStorage.getItem('pref_defaultNav') || 'ask';
    const time = localStorage.getItem('pref_notifyTime') || '15';

    if (document.getElementById('pref-navigator')) document.getElementById('pref-navigator').value = nav;
    if (document.getElementById('pref-notify-time')) document.getElementById('pref-notify-time').value = time;
});