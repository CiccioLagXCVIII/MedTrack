dayjs.locale('it');
document.addEventListener('DOMContentLoaded', async () => {
    // Inizializza icone
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const todayISO = dayjs().format('YYYY-MM-DD');
    document.getElementById('report-date').innerText = dayjs().format('dddd D MMMM YYYY');

    const container = document.getElementById('report-list');

    // 1. RECUPERO DATI (Dalla cache offline creata in scriptPro.js)
    const cachedVisits = await getFromOfflineCache('visitsData') || [];

    // 2. FILTRO VISITE DI OGGI
    const todayVisits = cachedVisits.filter(v => v.data_visita === todayISO)
        .sort((a, b) => a.ora_visita.localeCompare(b.ora_visita));

    document.getElementById('total-visits').innerText = todayVisits.length;

    // 3. PULIZIA DEL LOADER (FONDAMENTALE)
    container.innerHTML = '';

    if (todayVisits.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <div class="bg-light rounded-circle d-inline-flex p-4 mb-3">
                    <i data-lucide="coffee" class="text-muted" style="width:40px; height:40px;"></i>
                </div>
                <h5 class="text-muted fw-bold">Nessun Appuntamento</h5>
                <p class="small text-secondary">Goditi Un Caffè, Oggi Non Ci Sono Appuntamenti</p>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    // 4. INIEZIONE DELLE CARD
    todayVisits.forEach(v => {
        const medico = v.medici ? v.medici.nome : "Medico";
        const ora = v.ora_visita.substring(0, 5);
        const citta = v.medici ? v.medici.citta : "Città N.D.";
        const indirizzo = v.medici ? v.medici.indirizzo : "";

        container.innerHTML += `
            <div class="visit-report-card">
                <div class="visit-time-badge">
                    <span class="time-val">${ora}</span>
                </div>
                <div class="visit-info">
                    <h4 class="mb-0">${medico}</h4>
                    <p class="small text-muted mb-0">
                        <i data-lucide="map-pin" style="width:12px;height:12px"></i>
                        ${citta} ${indirizzo ? '• ' + indirizzo : ''}
                    </p>
                </div>
            </div>
        `;
    });

    // Rinfresca le icone dopo aver aggiunto il contenuto
    if (typeof lucide !== 'undefined') lucide.createIcons();
});