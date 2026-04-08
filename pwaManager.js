/* ==========================================================================
   AA 1: REGISTRAZIONE E CONTROLLO SUPPORTO
   ========================================================================== */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('MedTrack: SW Online');

                /* BB 1: MONITORAGGIO NUOVE VERSIONI */
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;

                    /* CC 1: ASCOLTO CAMBIO STATO WORKER */
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateToast();
                        }
                    });
                });
            })
            .catch(err => console.error('MedTrack: Errore SW', err));
    });
}

/* ==========================================================================
   AA 2: LOGICA DI INTERFACCIA (UI)
   ========================================================================== */

/* BB 1: NOTIFICA AGGIORNAMENTO DISPONIBILE */
function showUpdateToast() {
    const updateConfirmed = confirm("MedTrack è stato aggiornato! Caricare la nuova versione?");
    if (updateConfirmed) {
        /* CC 1: REFRESH FORZATO DELLA PAGINA */
        window.location.reload();
    }
}