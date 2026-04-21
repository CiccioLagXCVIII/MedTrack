// AA 1: REGISTRAZIONE E CONTROLLO SUPPORTO

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log("%c🌐 ISFplan SW Online", "color: #bf4f8a; font-weight: bold; font-size: 14px;");

                // BB 1: MONITORAGGIO NUOVE VERSIONI */
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;

                    // CC 1: ASCOLTO CAMBIO STATO WORKER */
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateToast();
                        }
                    });
                });
            })
            .catch(err => console.error('ISFplan: Errore SW', err));
    });
}

// AA 2: LOGICA DI INTERFACCIA (UI)

// BB 1: NOTIFICA AGGIORNAMENTO DISPONIBILE */
function showUpdateToast() {
    const updateConfirmed = confirm("ISFplan Aggiornato! Scaricare La Nuova Versione?");
    if (updateConfirmed) {
        // CC 1: REFRESH FORZATO DELLA PAGINA */
        window.location.reload();
    }
}