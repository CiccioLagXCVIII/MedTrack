
/* 
AA 1: CONFIGURAZIONE, STATO GLOBALE E COSTANTI
*/

// BB Localizzazione e Setup Iniziale
dayjs.locale('it');

// BB Variabili di Stato dell'Applicazione
let clientsList = [];               // Lista completa dei medici (anagrafica)
let allVisits = [];                 // Tutte le visite caricate dal DB
let appointments = {};              // Mappa delle visite indicizzate per data ISO
let walkinQueue = [];               // Coda dei medici che ricevono senza appuntamento
let currentDate = dayjs();          // Data attualmente visualizzata nel calendario
let selectedDateISO = "";           // Data selezionata per la vista giornaliera
let currentTab = "scheduled";       // Tab attivo nella vista giorno (Orario/Liberi)

// BB Variabili di Stato per Modali e Operazioni Temporanee
let modalActionContext = null;      // Contesto dell'azione (es. 'walkin-done')
let modalTargetId = null;           // ID dell'oggetto target della modifica
let modalTargetOldDate = null;      // Data originale prima di uno spostamento



/* 
AA 2: INIZIALIZZAZIONE E GESTIONE VISTE (SPA LOGIC)
*/

// BB Startup dell'Applicazione
document.addEventListener('DOMContentLoaded', async () => {
    const mainAppElement = document.getElementById('main-app');
    if (!mainAppElement) return;

    // DD: Verifichiamo la sessione prima di caricare i componenti UI per sicurezza
    const session = await checkSession();
    if (session) {
        try {
            // CC Caricamento dinamico dei modali per mantenere index.html pulito
            const response = await fetch('modals.html');
            const htmlText = await response.text();
            document.getElementById('modal-placeholder').innerHTML = htmlText;

            initApp();
        } catch (error) {
            console.error("Errore Caricamento Modals:", error);
            alert("Errore Critico Di Connessione. Impossibile Avviare Agenda. Ricarica La Pagina.");
        }
    }
});

// BB Funzione di Avvio Core
function initApp() {
    console.log("🚀 MedTrack Avviata");
    document.getElementById('main-app').style.display = 'block';
    loadMonthDataFromSupabase(currentDate);
}

// BB Gestore Navigazione tra Viste
function showView(viewId) {
    // CC Switch Visuale Sezioni
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    // CC Gestione Pulsanti Navbar
    const btnCal = document.getElementById('nav-btn-cal');
    const btnCli = document.getElementById('nav-btn-cli');

    if (viewId === 'calendar-view') {
        btnCal.classList.add('active');
        btnCli.classList.remove('active');
        loadMonthDataFromSupabase(currentDate);
    } else if (viewId === 'clients-view') {
        btnCli.classList.add('active');
        btnCal.classList.remove('active');
        resetAllFilters();
        loadAllDataFromSupabase();
    }

    // CC Refresh icone Lucide dopo ogni cambio vista
    lucide.createIcons();
}


/* 
AA 3: COMUNICAZIONE CON DATABASE (SUPABASE FETCHING)
*/

// BB Caricamento Dati Mensili (Calendario)
async function loadMonthDataFromSupabase(targetDate) {
    tempMonthYear = targetDate.format('MMMM YYYY');
    monthYearString = tempMonthYear.charAt(0).toUpperCase() + tempMonthYear.slice(1);
    console.log(`🔄 Caricamento Dati Per ${monthYearString}`);
    try {
        const startOfMonth = targetDate.startOf('month').format('YYYY-MM-DD');
        const endOfMonth = targetDate.endOf('month').format('YYYY-MM-DD');

        // CC Fetch Medici per risoluzione nomi
        let { data: medici, error: mediciError } = await sb.from('medici').select('*');
        if (mediciError) throw mediciError;

        clientsList = (medici || []).map(m => ({
            id: m.id,
            name: m.nome,
            city: m.citta,
            address: m.indirizzo || '',
            phone: m.cellulare || '',
            specialization: m.specializzazione,
            giorni_liberi: m.giorni_liberi
        }));

        // CC Fetch Visite limitate al range del mese per performance
        let { data: visite, error: visiteError } = await sb.from('visite')
            .select('*, medici(*)')
            .gte('data_visita', startOfMonth)
            .lte('data_visita', endOfMonth);
        if (visiteError) throw visiteError;

        allVisits = visite || [];

        // CC Aggiornamento UI
        processVisitsForCalendar();
        renderCalendar();
        updateExistingClientsSelect();
        updateSpecDropdowns();

    } catch (error) {
        console.error("Errore Caricamento Mese:", error);
        openAlert("Errore Caricamento Dati Per Il Mese Selezionato.");
    }
}

// BB Caricamento Dati Anagrafica (Vista SQL)
async function loadAllDataFromSupabase() {
    console.log("🔄 Caricamento Anagrafica Tramite Vista SQL...");
    try {
        // DD: Usiamo una Vista SQL su Supabase per ottenere i dati calcolati (ultima visita, prossima)
        // DD direttamente dal DB invece di calcolarli nel frontend, migliorando la reattività.
        let { data, error } = await sb.from('medici_con_stato_visite').select('*');

        if (error) throw error;

        clientsList = data.map(m => ({
            id: m.id,
            name: m.nome,
            city: m.citta,
            address: m.indirizzo || '',
            phone: m.cellulare || '',
            specialization: m.specializzazione,
            giorni_liberi: m.giorni_liberi,
            lastVisit: m.ultima_visita_passata,
            nextVisit: m.prossima_visita_futura,
            lastNote: m.nota_ultima_visita
        }));

        updateSpecDropdowns();
        updateCityFilter();
        renderClients();
    } catch (error) {
        console.error("Errore Caricamento Vista:", error);
        openAlert("Errore nel caricamento dei dati medici.");
    }
}

// BB Elaborazione Visite per logica interna
function processVisitsForCalendar() {
    appointments = {};
    walkinQueue = [];

    allVisits.forEach(v => {
        const dateISO = v.data_visita;
        if (!dateISO) return;
        if (!appointments[dateISO]) appointments[dateISO] = { scheduled: [] };

        const medicoInfo = v.medici || { nome: "Eliminato", citta: "N.D.", indirizzo: "" };
        appointments[dateISO].scheduled.push({
            id: v.medico_id,
            name: medicoInfo.nome,
            city: medicoInfo.citta,
            address: medicoInfo.indirizzo,
            phone: medicoInfo.cellulare || "",
            time: v.ora_visita ? v.ora_visita.substring(0, 5) : "00:00",
            note: v.note || "",
            isWalkinDone: v.is_walkin_done || false,
            dbId: v.id
        });
    });

    clientsList.forEach(m => {
        if (m.giorni_liberi && m.giorni_liberi.trim() !== '') {
            walkinQueue.push({
                id: m.id,
                name: m.name,
                city: m.city,
                phone: m.phone,
                availableDays: m.giorni_liberi.split(',').map(Number)
            });
        }
    });
}


/* 
AA 4: RENDERING CALENDARIO MENSILE
*/

// BB Disegno della Griglia
function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('month-year');
    grid.innerHTML = '';
    monthYear.innerText = currentDate.format('MMMM YYYY').toUpperCase();

    // CC Intestazioni giorni della settimana
    ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].forEach(d => {
        const el = document.createElement('div');
        el.className = 'day-name'; el.innerText = d;
        grid.appendChild(el);
    });

    const startOfMonth = currentDate.startOf('month');
    // DD: Calcolo dell'offset per allineare correttamente il primo del mese con il giorno della settimana
    const offset = (startOfMonth.day() === 0 ? 6 : startOfMonth.day() - 1);

    for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('div'));

    for (let i = 1; i <= currentDate.daysInMonth(); i++) {
        const dayObj = startOfMonth.date(i);
        const dateISO = dayObj.format('YYYY-MM-DD');
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.innerText = i;

        // CC Stile per festivi e oggi
        const dayOfWeek = dayObj.day();
        if (dayOfWeek === 0) dayDiv.classList.add('sun');
        else if (dayOfWeek === 6) dayDiv.classList.add('sat');

        if (dateISO === dayjs().format('YYYY-MM-DD')) {
            dayDiv.classList.add('today');
        }

        // CC Indicatori visite (Badge)
        let count = appointments[dateISO]?.scheduled?.length || 0;
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'badge'; badge.innerText = count;
            dayDiv.appendChild(badge);
        }

        dayDiv.onclick = () => openDayView(dateISO);
        grid.appendChild(dayDiv);
    }
}

// BB Navigazione Mese
function changeMonth(dir) {
    currentDate = currentDate.add(dir, 'month');
    loadMonthDataFromSupabase(currentDate);
}


/* 
AA 5: GESTIONE VISTA GIORNALIERA (DAY VIEW)
*/

// BB Apertura Dettaglio Giorno
function openDayView(dateISO) {
    selectedDateISO = dateISO;

    const dataBase = dayjs(dateISO).locale('it').format('DD MMMM YYYY');
    const titolo = `Visite del ${dataBase}`.replace(/\b\w/g, l => l.toUpperCase());
    document.getElementById('selected-date-title').innerText = titolo;

    // CC Adattamento responsive
    if (window.innerWidth <= 768) {
        toggleMobileListView('scheduled');
    } else {
        document.getElementById('col-scheduled').style.display = 'block';
        document.getElementById('col-walkins').style.display = 'block';
    }

    resetForm();
    updateExistingClientsSelect();
    renderDayAppointments();
    setTab('scheduled');
    showView('day-view');
}

// BB Switch Tab (Scheduled / Walk-in)
function setTab(tabName) {
    currentTab = tabName;

    document.getElementById('tab-scheduled').classList.toggle('active', tabName === 'scheduled');
    document.getElementById('tab-walkin').classList.toggle('active', tabName === 'walkin');

    if (tabName === 'scheduled') {
        document.getElementById('time-group').classList.remove('display-none');
        document.getElementById('days-group').classList.add('display-none');
    } else {
        document.getElementById('time-group').classList.add('display-none');
        document.getElementById('days-group').classList.remove('display-none');
    }

    lucide.createIcons();
}

// BB Rendering Liste Giornaliere
function renderDayAppointments() {
    const sUl = document.getElementById('scheduled-ul');
    const wUl = document.getElementById('walkins-ul');
    sUl.innerHTML = ''; wUl.innerHTML = '';

    let scheduled = (appointments[selectedDateISO]?.scheduled || []).sort((a, b) => a.time.localeCompare(b.time));
    let visitatiOggi = [];

    // DD: Helper interna per evitare ripetizione di codice per i pulsanti Phone, WA e Maps
    const generatePillButtons = (appOrWalkin) => {
        const mapQuery = `${appOrWalkin.address || ''} ${appOrWalkin.city || ''}`.trim();
        let cleanPhone = appOrWalkin.phone ? appOrWalkin.phone.replace(/\D/g, '') : '';
        if (cleanPhone && !cleanPhone.startsWith('39')) cleanPhone = '39' + cleanPhone;

        const mapBtn = mapQuery
            ? `<button onclick="openNavigator('${encodeURIComponent(mapQuery)}')" class="btn-action-pill btn-map"><i data-lucide="car"></i></button>`
            : `<button class="btn-action-pill btn-map opacity-50" onclick="openAlert('Indirizzo Mancante')"><i data-lucide="car"></i></button>`;

        const phoneBtn = cleanPhone
            ? `<a href="tel:+${cleanPhone}" class="btn-action-pill btn-phone"><i data-lucide="phone"></i></a>`
            : `<button class="btn-action-pill btn-phone opacity-50" onclick="openAlert('Cellulare Mancante')"><i data-lucide="phone"></i></button>`;

        const waBtn = cleanPhone
            ? `<a href="https://wa.me/${cleanPhone}" target="_blank" class="btn-action-pill btn-wa"><i data-lucide="message-circle"></i></a>`
            : `<button class="btn-action-pill btn-wa opacity-50" onclick="openAlert('Cellulare Mancante')"><i data-lucide="message-circle"></i></button>`;

        return `${phoneBtn} ${waBtn} ${mapBtn}`;
    };

    // CC Rendering Scheduled
    scheduled.forEach((app) => {
        visitatiOggi.push(app.id);
        const actionPillsHtml = generatePillButtons(app);

        const li = document.createElement('li');
        li.className = 'appointment-item shadow-sm';
        if (app.isWalkinDone) li.classList.add('walkin-moved');

        li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div class="list-info">
                    <span class="fw-bold text-primary fs-5">${app.time}</span>
                    <span class="fw-bold ms-2 text-dark fs-5">${escapeHTML(app.name)}</span>
                    <div class="text-secondary small mt-1"><i data-lucide="map-pin" style="width:12px; height:12px;"></i> ${escapeHTML(app.city)}</div>
                </div>
            </div>
            <div class="note-preview" onclick="editNote('${app.dbId}', \`${escapeHTML(app.note)}\`)">
                <i data-lucide="file-text" style="width:14px; height:14px;" class="me-1"></i> 
                ${app.note ? escapeHTML(app.note) : 'Aggiungi Note Visita...'}
            </div>
            <div class="action-buttons">
                <button class="btn btn-danger btn-action-main me-2" onclick="deleteApp('${app.dbId}')">
                    <i data-lucide="trash-2" style="width:14px; height:14px;" class="me-1"></i> Elimina
                </button>
                <div class="d-flex gap-1">${actionPillsHtml}</div>
            </div>`;
        sUl.appendChild(li);
    });

    // CC Rendering Walk-in (Filtra solo i disponibili oggi e non ancora visitati)
    const dayOfWeek = dayjs(selectedDateISO).day();
    walkinQueue.filter(w => w.availableDays.includes(dayOfWeek) && !visitatiOggi.includes(w.id)).forEach(w => {
        const clientFull = clientsList.find(c => c.id === w.id);
        const mergedData = { ...w, address: clientFull?.address, phone: clientFull?.phone };
        const actionPillsHtml = generatePillButtons(mergedData);

        const li = document.createElement('li');
        li.className = 'appointment-item shadow-sm';

        li.innerHTML = `
            <div class="list-info mb-3">
                <span class="fw-bold text-dark fs-5">${escapeHTML(w.name)}</span>
                <div class="text-secondary small mt-1"><i data-lucide="map-pin" style="width:12px; height:12px;"></i> ${escapeHTML(w.city)}</div>
            </div>
            <div class="action-buttons">
                <button class="btn btn-success btn-action-main me-2" onclick="markWalkinDone('${w.id}')">
                    <i data-lucide="check-circle" style="width:14px; height:14px;" class="me-1"></i> Visita
                </button>
                <div class="d-flex gap-1">${actionPillsHtml}</div>
            </div>`;
        wUl.appendChild(li);
    });

    lucide.createIcons();
}

function toggleMobileListView(view) {
}

/* 
AA 6: ANAGRAFICA MEDICI (CLIENTS VIEW RENDERING)
*/

// BB Disegno Card Anagrafica
function renderClients() {
    const container = document.getElementById('clients-container');
    if (!container) return;

    // CC Acquisizione valori filtri
    const searchTerm = document.getElementById('search-client').value.toLowerCase();
    const filterSpec = document.getElementById('filter-spec').value;
    const filterCity = document.getElementById('filter-city').value;
    const filterVisit = document.querySelector('input[name="visitFilter"]:checked').value;

    container.innerHTML = '';
    const today = dayjs().startOf('day');

    // CC Logica di Filtraggio
    const filtered = clientsList.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm);
        const matchesSpec = filterSpec === 'all' || c.specialization === filterSpec;
        const matchesCity = filterCity === 'all' || c.city === filterCity;

        let matchesVisit = true;
        if (filterVisit === 'visited') matchesVisit = c.lastVisit !== null;
        if (filterVisit === 'not-visited') matchesVisit = c.lastVisit === null;

        return matchesSearch && matchesSpec && matchesCity && matchesVisit;
    });

    // CC Generazione Card
    filtered.forEach(client => {
        let borderClass = 'border-neutral';
        let rigaUltimaVisita = "";
        let rigaGiorniTrascorsi = "";
        let actionButton = "";

        // DD: Calcolo dinamico dello stato visita (Verde/Giallo/Rosso) basato sui giorni trascorsi
        if (client.lastVisit) {
            const diff = today.diff(dayjs(client.lastVisit).startOf('day'), 'day');

            if (diff >= 30) borderClass = 'border-urgent';
            else if (diff >= 15) borderClass = 'border-warn';
            else borderClass = 'border-ok';

            rigaUltimaVisita = `Ultima Visita: <strong>${dayjs(client.lastVisit).format('DD/MM/YY')}</strong>`;
            rigaGiorniTrascorsi = diff === 0 ? "Visitato Oggi" : (diff === 1 ? "Visitato Ieri" : `Trascorsi: <strong>${diff} Giorni</strong>`);
            actionButton = `<button class="btn-small btn-undo" onclick="openEditVisit('${client.id}')"><i data-lucide="calendar-range" style="width:14px; height:14px; margin-right:5px;"></i> SPOSTA</button>`;

        } else if (client.nextVisit) {
            borderClass = 'border-neutral';
            rigaUltimaVisita = `Ultima Visita: <strong>Mai</strong>`;
            rigaGiorniTrascorsi = `In Programma Per Il <strong>${dayjs(client.nextVisit).format('DD/MM/YY')}</strong>`;
            actionButton = `<button class="btn-small btn-undo" onclick="openEditVisit('${client.id}')"><i data-lucide="calendar-range" style="width:14px; height:14px; margin-right:5px;"></i> SPOSTA</button>`;

        } else {
            borderClass = 'border-neutral';
            rigaUltimaVisita = `Ultima Visita: <strong>Mai</strong>`;
            rigaGiorniTrascorsi = "Nessuna Visita Effettuata";
            actionButton = `<button class="btn-small btn-done" onclick="openAddVisitModal('${client.id}')"><i data-lucide="plus-circle" style="width:14px; height:14px; margin-right:5px;"></i> VISITA</button>`;
        }

        const card = document.createElement('div');
        card.className = `client-card ${borderClass}`;
        let lastNote = client.lastNote
            ? (client.lastNote.length > 20
                ? escapeHTML(client.lastNote.substring(0, 20)) + '...'
                : escapeHTML(client.lastNote))
            : 'Nessuna Nota';

        card.innerHTML = `
            <span class="client-badge">${escapeHTML(client.specialization)}</span>
            <h3>${escapeHTML(client.name)}</h3>
            <div class="client-info"><i data-lucide="map-pin" style="width:14px; height:14px;"></i> ${escapeHTML(client.city)} ${client.address ? '- ' + escapeHTML(client.address) : ''}</div>
            
            <div class="last-visit-box">
                <div class="client-info">${rigaUltimaVisita}</div>
                <div class="client-info" style="font-size: 0.85rem; color: #555;">${rigaGiorniTrascorsi}</div>
                <div class="note-recap"><i data-lucide="file-text" style="width:14px; height:14px; margin-right:5px;"></i> ${lastNote}</div>
            </div>

            <div class="card-actions">
                <button class="btn-small btn-edit" onclick="openEditClient('${client.id}')"><i data-lucide="user-cog" style="width:14px; height:14px; margin-right:5px;"></i> PROFILO</button>
                ${actionButton}
                <button class="btn-small btn-delete" onclick="askDeleteClient('${client.id}', '${escapeHTML(client.name)}')"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
            </div>`;
        container.appendChild(card);
    });

    lucide.createIcons();
}

// BB Gestori Ricerca e Filtri
function resetAllFilters() {
    const specSelect = document.getElementById('filter-spec');
    const citySelect = document.getElementById('filter-city');
    const searchInput = document.getElementById('search-client');
    const allRadio = document.querySelector('input[name="visitFilter"][value="all"]');
    const clearBtn = document.getElementById('clear-search-btn');

    if (specSelect) specSelect.value = 'all';
    if (citySelect) citySelect.value = 'all';
    if (searchInput) searchInput.value = '';
    if (allRadio) allRadio.checked = true;
    if (clearBtn) clearBtn.classList.add('d-none');

    renderClients();
}

function handleSearchInput() {
    const input = document.getElementById('search-client');
    const clearBtn = document.getElementById('clear-search-btn');
    input.value.length > 0 ? clearBtn.classList.remove('d-none') : clearBtn.classList.add('d-none');
    renderClients();
}

function clearSearch() {
    const input = document.getElementById('search-client');
    const clearBtn = document.getElementById('clear-search-btn');
    input.value = '';
    clearBtn.classList.add('d-none');
    input.focus();
    renderClients();
}


/* 
AA 7: AZIONI E MUTAZIONI DATI (SCRITTURA SUPABASE)
*/

// BB Inserimento Appuntamenti e Medici
async function addAppointment() {
    const isNew = document.querySelector('input[name="clientType"]:checked').value === 'new';
    let clientId;

    if (isNew) {
        // CC Creazione nuovo medico al volo
        const nome = document.getElementById('new-client-name').value.trim();
        const citta = document.getElementById('new-client-city').value.trim();
        const indirizzo = document.getElementById('new-client-address').value.trim();
        const cellulare = document.getElementById('new-client-phone').value.trim();
        let spec = document.getElementById('new-client-spec').value;

        if (spec === 'NEW_SPEC') spec = document.getElementById('custom-spec-input').value.trim();
        if (!nome || !spec) return openAlert("Nome e Specializzazione Sono Obbligatori.");

        const { data, error } = await sb.from('medici').insert([{
            nome, citta, indirizzo, cellulare, specializzazione: spec
        }]).select();

        if (error) return openAlert("Errore salvataggio medico: " + error.message);
        clientId = data[0].id;
    } else {
        clientId = document.getElementById('existing-client-select').value;
        if (!clientId) return openAlert("Seleziona un medico.");
    }

    if (currentTab === 'scheduled') {
        // CC Salvataggio visita con orario
        const time = document.getElementById('appointment-time').value;
        if (!time) return openAlert("Inserisci l'orario.");
        await sb.from('visite').insert([{ medico_id: clientId, data_visita: selectedDateISO, ora_visita: time }]);
    } else {
        // CC Salvataggio giorni di ricevimento (Walk-in)
        const checkboxes = document.querySelectorAll('#available-days-checkboxes input:checked');
        const days = Array.from(checkboxes).map(cb => cb.value).join(',');
        await sb.from('medici').update({ giorni_liberi: days }).eq('id', clientId);
    }

    await loadMonthDataFromSupabase(currentDate);
    openDayView(selectedDateISO);
}

// BB Modifiche Medici e Visite
async function confirmEditClient() {
    const name = document.getElementById('modal-edit-name').value.trim();
    const city = document.getElementById('modal-edit-city').value.trim();
    const phone = document.getElementById('modal-edit-phone').value.trim();
    const spec = document.getElementById('modal-edit-spec').value;
    const checkboxes = document.querySelectorAll('#modal-edit-days-checkboxes input:checked');
    const days = Array.from(checkboxes).map(cb => cb.value).join(',');

    if (!name) return openAlert("Il nome è obbligatorio.");

    await sb.from('medici').update({
        nome: name, citta: city, cellulare: phone, specializzazione: spec, giorni_liberi: days
    }).eq('id', modalTargetId);

    closeModal('modal-edit-client');
    await loadAllDataFromSupabase();
    showView('clients-view');
}

async function confirmEditVisit() {
    const newDate = document.getElementById('edit-visit-date').value;
    const newTime = document.getElementById('edit-visit-time').value;

    if (!newDate || !newTime) return openAlert("Inserisci una data e un orario validi.");

    // CC Aggiornamento Visita DIRETTAMENTE Nel Database
    // In questo modo non dipende dall'array locale "allVisits" (che contiene solo il mese corrente),
    // permettendoci di spostare visite anche di mesi futuri o passati senza errori.
    const { error } = await sb.from('visite')
        .update({ data_visita: newDate, ora_visita: newTime })
        .eq('medico_id', modalTargetId)
        .eq('data_visita', modalTargetOldDate);

    if (error) {
        return openAlert("Errore Durante Aggiornamento: " + error.message);
    }

    closeModal('modal-edit-visit');

    // Forza il ricalcolo della View SQL per aggiornare le card

    if (document.getElementById('clients-view').classList.contains('active')) {
        // Se Siamo In Anagrafica
        await loadAllDataFromSupabase();
    } else {
        // Se Siamo Nel Calendario
        await loadMonthDataFromSupabase(currentDate);

        // Se avevamo il dettaglio di un giorno aperto, e la visita è stata 
        // spostata in un giorno diverso, torniamo al calendario
        if (selectedDateISO !== newDate) {
            showView('calendar-view');
        } else {
            openDayView(selectedDateISO);
        }
    }
}

// BB Gestione Note e Cancellazioni
function editNote(visitId, currentNote) {
    const input = document.getElementById('modal-note-input');
    const saveBtn = document.getElementById('btn-save-note');

    input.value = currentNote || "";
    openModal('modal-note');

    saveBtn.onclick = async () => {
        const newNote = input.value.trim();
        const { error } = await sb.from('visite').update({ note: newNote }).eq('id', visitId);
        if (error) {
            openAlert("Errore nel salvataggio della nota.");
        } else {
            closeModal('modal-note');
            await loadMonthDataFromSupabase(currentDate);
            openDayView(selectedDateISO);
        }
    };
}

async function deleteApp(visitDbId) {
    const desc = document.getElementById('modal-confirm-desc');
    const confirmBtn = document.getElementById('btn-execute-confirm');

    desc.innerText = `Vuoi cancellare questo appuntamento?`;
    openModal('modal-confirm');

    confirmBtn.onclick = async () => {
        await sb.from('visite').delete().eq('id', visitDbId);
        closeModal('modal-confirm');
        await loadMonthDataFromSupabase(currentDate);
        openDayView(selectedDateISO);
    };
}

// BB Logica Walk-in (Completamento Visita Libera)
async function markWalkinDone(id) {
    modalActionContext = 'walkin-done';
    modalTargetId = id;
    const client = walkinQueue.find(w => w.id === id);
    document.getElementById('modal-time-title').innerText = "Visita Effettuata";
    document.getElementById('modal-time-desc').innerText = `Orario per ${client.name}:`;
    document.getElementById('modal-time-input').value = dayjs().format('HH:mm');
    openModal('modal-time');
}

async function confirmTimeModal() {
    const time = document.getElementById('modal-time-input').value;
    if (modalActionContext === 'walkin-done') {
        await sb.from('visite').insert([{
            medico_id: modalTargetId,
            data_visita: selectedDateISO,
            ora_visita: time,
            is_walkin_done: true
        }]);
        closeModal('modal-time');
        await loadMonthDataFromSupabase(currentDate);
        openDayView(selectedDateISO);
    }
}


/* 
AA 8: GESTIONE MODALI E INTERAZIONI ESTERNE
*/

// BB Preparazione Modali Modifica/Pianificazione
function openEditClient(clientId) {
    const client = clientsList.find(c => c.id === clientId);
    if (!client) return;
    modalTargetId = clientId;
    document.getElementById('modal-edit-name').value = client.name;
    document.getElementById('modal-edit-city').value = client.city || '';
    document.getElementById('modal-edit-spec').value = client.specialization || '';
    document.getElementById('modal-edit-phone').value = client.phone || '';

    document.querySelectorAll('#modal-edit-days-checkboxes input').forEach(cb => cb.checked = false);
    if (client.giorni_liberi) {
        client.giorni_liberi.split(',').forEach(g => {
            const cb = document.querySelector(`#modal-edit-days-checkboxes input[value="${g}"]`);
            if (cb) cb.checked = true;
        });
    }
    openModal('modal-edit-client');
}

function openEditVisit(clientId) {
    const client = clientsList.find(c => c.id === clientId);
    const dateToMove = client.nextVisit || client.lastVisit;
    if (!dateToMove) return openAlert("Nessuna Visita Trovata");

    modalTargetId = clientId;
    modalTargetOldDate = dateToMove;
    document.getElementById('modal-edit-visit-desc').innerHTML = `Sposta Visita Di <b>${escapeHTML(client.name)}</b>`;
    document.getElementById('edit-visit-date').value = dateToMove;
    document.getElementById('edit-visit-time').value = "09:00";
    openModal('modal-edit-visit');
}

// BB Integrazione Navigatori Stradali
function openNavigator(query) {
    const googleUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    const wazeUrl = `https://waze.com/ul?q=${query}`;

    document.getElementById('btn-nav-google').href = googleUrl;
    document.getElementById('btn-nav-waze').href = wazeUrl;

    const closeMod = () => {
        setTimeout(() => { bootstrap.Modal.getInstance(document.getElementById('modal-nav')).hide(); }, 500);
    };

    document.getElementById('btn-nav-google').onclick = closeMod;
    document.getElementById('btn-nav-waze').onclick = closeMod;

    openModal('modal-nav');
}

// BB Helpers per l'istanza Bootstrap dei Modali
function openModal(id) {
    const modalEl = document.getElementById(id);
    const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    bsModal.show();
}

function closeModal(id) {
    const modalEl = document.getElementById(id);
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();
}

/* 
AA 9: UTILITY, FORM HELPERS E SICUREZZA
*/

// BB Gestione UI Form (Toggles e Dropdowns)
function toggleClientInput() {
    const isNew = document.querySelector('input[name="clientType"]:checked').value === 'new';
    if (isNew) {
        document.getElementById('new-client-div').classList.remove('display-none');
        document.getElementById('existing-client-div').classList.add('display-none');
    } else {
        document.getElementById('new-client-div').classList.add('display-none');
        document.getElementById('existing-client-div').classList.remove('display-none');
    }
}

function checkOtherSpec(select) {
    const customInput = document.getElementById('custom-spec-input');
    if (!customInput) return;

    if (select.value === 'NEW_SPEC') {
        select.classList.replace('w-100', 'w-50');
        customInput.classList.remove('display-none');
    } else {
        select.classList.replace('w-50', 'w-100');
        customInput.classList.add('display-none');
        customInput.value = '';
    }
}

// BB Popolamento Dinamico dei Dropdown
function updateSpecDropdowns() {
    const defaultSpecs = ["MMG", "MMG 2", "Neurologo", "Otorino", "Fisiatra", "Diabetologo", "Medicina Dello Sport", "Geriatra", "Nutrizionista"];
    const extraSpecs = [...new Set(clientsList.map(c => c.specialization))].filter(s => s && !defaultSpecs.includes(s)).sort();
    const allSpecs = [...defaultSpecs, ...extraSpecs];
    const selects = ['new-client-spec', 'modal-edit-spec', 'filter-spec'];

    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        let html = id === 'filter-spec' ? '<option value="all">Tutte</option>' : '<option value="" disabled selected>Specializzazione</option>';
        allSpecs.forEach(s => { html += `<option value="${s}">${s}</option>`; });
        if (id !== 'filter-spec') html += `<option value="NEW_SPEC"> + Aggiungi Specializzazione</option>`;
        el.innerHTML = html;
        if (currentVal) el.value = currentVal;
    });
}

function updateCityFilter() {
    const select = document.getElementById('filter-city');
    const current = select.value;
    const cities = [...new Set(clientsList.map(c => c.city).filter(Boolean))].sort();
    select.innerHTML = '<option value="all">Tutte</option>' + cities.map(c => `<option value="${c}">${c}</option>`).join('');
    select.value = current;
}

// BB Gestione Avvisi Tramite Modal
function openAlert(message) {
    const desc = document.getElementById('modal-alert-desc');
    if (desc) {
        desc.innerText = message;
        openModal('modal-alert');
    } else {
        // Fallback se la modale non è ancora caricata nel DOM
        alert(message);
    }
}

// BB Popolamento Select Medici Esistenti
function updateExistingClientsSelect() {
    const select = document.getElementById('existing-client-select');
    if (!select) return;

    // Ordiniamo la lista dei medici alfabeticamente per facilitare la ricerca
    const sortedClients = [...clientsList].sort((a, b) => a.name.localeCompare(b.name));

    let html = '<option value="" disabled selected>Seleziona Medico Dalla Lista...</option>';
    sortedClients.forEach(c => {
        html += `<option value="${c.id}">${c.name} (${c.city})</option>`;
    });

    select.innerHTML = html;
}

// BB Filtri Dinamici Mobile
function toggleMobileFilters() {
    const panel = document.getElementById('mobile-filter-panel');
    const icon = document.getElementById('filter-chevron');

    // Desktop Non Fare Nulla
    if (window.innerWidth >= 992) return;

    panel.classList.toggle('display-none');

    // Rotazione Icona
    if (!panel.classList.contains('display-none')) {
        icon.style.transform = "rotate(180deg)";
    } else {
        icon.style.transform = "rotate(0deg)";
    }
}

// BB Reset e Sanificazione
function resetForm() {
    document.querySelectorAll('#new-client-div input, #time-group input, #custom-spec-input').forEach(i => i.value = '');
    document.querySelectorAll('#available-days-checkboxes input').forEach(c => c.checked = false);
    document.querySelectorAll('select.form-select').forEach(s => s.value = '');

    const specSelect = document.getElementById('new-client-spec');
    const customInput = document.getElementById('custom-spec-input');
    if (specSelect && customInput) {
        specSelect.classList.replace('w-50', 'w-100');
        customInput.classList.add('display-none');
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t]));
}

