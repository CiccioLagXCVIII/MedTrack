// ==========================================================================
// AA 1: CONFIGURAZIONE, STATO GLOBALE E COSTANTI
// ==========================================================================

// BB Localizzazione E Setup Iniziale
dayjs.locale('it');

// BB Variabili Di Stato Dell'Applicazione
let clientsList = [];               // Lista completa dei medici (anagrafica)
let allVisits = [];                 // Tutte le visite caricate dal DB
let tasksList = [];                 // Lista completa delle attività (tasks)
let appointments = {};              // Mappa delle visite indicizzate per data ISO
let walkinQueue = [];               // Coda dei medici che ricevono senza appuntamento
let currentDate = dayjs();          // Data attualmente visualizzata nel calendario
let selectedDateISO = "";           // Data selezionata per la vista giornaliera
let currentTab = "scheduled";       // Tab attivo nella vista giorno (Orario/Liberi)

// BB Variabili Di Stato Per Modali E Operazioni Temporanee
let modalActionContext = null;      // Contesto dell'azione (es. 'walkin-done')
let modalTargetId = null;           // ID dell'oggetto target della modifica
let modalTargetOldDate = null;      // Data originale prima di uno spostamento

// BB Flag Di Controllo
const appState = {
    calendarNeedsRefresh: true,
    clientsNeedsRefresh: true,
    tasksNeedsRefresh: true
};

// ==========================================================================
// AA 2: INIZIALIZZAZIONE E GESTIONE VISTE (SPA LOGIC)
// ==========================================================================

// BB Event Listeners di Avvio
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
// BB Inizializzazione Logica Multi-Orario
document.addEventListener('DOMContentLoaded', () => injectTimeSlotLogic());
window.addEventListener('load', () => updateNetworkLED(navigator.onLine));

// BB Funzioni Core di Boot e Navigazione
function initApp() {
    console.log("🚀 MedTrack Avviata");
    document.getElementById('main-app').style.display = 'block';
    loadMonthDataFromSupabase(currentDate);
}
// BB Setup Event Listener Per Contenitori Checkbox Orari
function injectTimeSlotLogic() {
    const containers = ['available-days-checkboxes', 'modal-edit-days-checkboxes'];
    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.addEventListener('change', (e) => {
            if (e.target.classList.contains('btn-check')) {
                const dayId = e.target.value;
                toggleTimeInput(containerId, dayId, e.target.checked);
            }
        });
    });
}
function showView(viewId) {
    // CC Switch Visuale Sezioni
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    // CC Gestione Pulsanti Navbar
    const btnCal = document.getElementById('nav-btn-cal');
    const btnCli = document.getElementById('nav-btn-cli');
    const btnTsk = document.getElementById('nav-btn-tsk');

    if (viewId === 'calendar-view') {
        btnCal.classList.add('active');
        btnCli.classList.remove('active');
        btnTsk.classList.remove('active');
        if (appState.calendarNeedsRefresh) {
            loadMonthDataFromSupabase(currentDate);
        }
    } else if (viewId === 'clients-view') {
        btnCli.classList.add('active');
        btnCal.classList.remove('active');
        btnTsk.classList.remove('active');
        if (appState.clientsNeedsRefresh) {
            // Svuota Filtri Silenziosamente Senza renderClients() Prima Che loadAllDataFromSupabase Aggiorni Lo Stato
            const search = document.getElementById('search-client');
            if (search) search.value = '';
            const spec = document.getElementById('filter-spec');
            if (spec) spec.value = 'all';
            const city = document.getElementById('filter-city');
            if (city) city.value = 'all';
            const allRadio = document.querySelector('input[name="visitFilter"][value="all"]');
            if (allRadio) allRadio.checked = true;

            loadAllDataFromSupabase();
        }
    } else if (viewId === 'tasks-view') {
        btnTsk.classList.add('active');
        btnCal.classList.remove('active');
        btnCli.classList.remove('active');
        if (appState.tasksNeedsRefresh) {
            renderTasks();
        }
    }

    // CC Refresh icone Lucide dopo ogni cambio vista
    lucide.createIcons();
}

// ==========================================================================
// AA 3: CORE DATA E COMUNICAZIONE DATABASE (API ROUTER)
// ==========================================================================

// BB Router Principale (Online/Offline)
async function executeDBAction(op, table, payload, matchCriteria = null) {
    if (navigator.onLine) {
        // CC ONLINE
        // DD Esegui Query Su Supabase
        let query;
        const operation = op.toUpperCase();

        if (operation === 'INSERT') {
            query = sb.from(table).insert(payload);
        } else if (operation === 'UPDATE') {
            query = sb.from(table).update(payload);
            for (const [key, val] of Object.entries(matchCriteria)) {
                query = query.eq(key, val);
            }
        } else if (operation === 'DELETE') {
            query = sb.from(table).delete();
            for (const [key, val] of Object.entries(matchCriteria)) {
                query = query.eq(key, val);
            }
        }

        return await query;

    } else {
        // CC OFFLINE
        // DD Aggiungi Operazione Alla Coda Di Sincronizzazione
        await addToSyncQueue(op, table, payload, matchCriteria);

        // DD Aggiorna La Cache Così Sopravvive Al Refresh Della Pagina
        if (op === 'INSERT' && table === 'visite') {
            const medicoIdx = clientsList.findIndex(c => c.id === payload.medico_id);
            const medico = medicoIdx !== -1 ? clientsList[medicoIdx] : null;

            allVisits.push({
                id: crypto.randomUUID(), // ID temporaneo 
                dbId: crypto.randomUUID(),
                medico_id: payload.medico_id,
                data_visita: payload.data_visita,
                ora_visita: payload.ora_visita,
                note: payload.note || "",
                is_walkin_done: payload.is_walkin_done || false,
                medici: medico ? { nome: medico.name, citta: medico.city, cellulare: medico.phone, indirizzo: medico.address } : null
            });
            await saveToOfflineCache('visitsData', allVisits);

            // Sincronizza Istantaneamente Stato Della Visita Nell'Anagrafica In RAM E Cache Offline
            if (medicoIdx !== -1) {
                const dataVisita = dayjs(payload.data_visita);
                const today = dayjs().startOf('day');

                if (dataVisita.isBefore(today) || dataVisita.isSame(today, 'day')) {
                    // Se La Visita È Nel Passato O Oggi, Aggiorna lastVisit Se È Più Recente
                    if (!clientsList[medicoIdx].lastVisit || dataVisita.isAfter(dayjs(clientsList[medicoIdx].lastVisit))) {
                        clientsList[medicoIdx].lastVisit = payload.data_visita;
                    }
                } else {
                    // Se la visita È Nel Futuro, Aggiorna nextVisit Se È Più Vicina
                    if (!clientsList[medicoIdx].nextVisit || dataVisita.isBefore(dayjs(clientsList[medicoIdx].nextVisit))) {
                        clientsList[medicoIdx].nextVisit = payload.data_visita;
                    }
                }
                await saveToOfflineCache('clientsData', clientsList);
            }
        }

        if (op === 'INSERT' && table === 'visite') {
            const medico = clientsList.find(c => c.id === payload.medico_id);
            allVisits.push({
                id: crypto.randomUUID(), // ID temporaneo 
                dbId: crypto.randomUUID(),
                medico_id: payload.medico_id,
                data_visita: payload.data_visita,
                ora_visita: payload.ora_visita,
                note: payload.note || "",
                is_walkin_done: payload.is_walkin_done || false,
                medici: medico ? { nome: medico.name, citta: medico.city, cellulare: medico.phone, indirizzo: medico.address } : null
            });
            await saveToOfflineCache('visitsData', allVisits);
        }

        if (op === 'UPDATE' && table === 'medici' && matchCriteria?.id) {
            const idx = clientsList.findIndex(c => c.id === matchCriteria.id);
            if (idx !== -1) {
                clientsList[idx] = { ...clientsList[idx], name: payload.nome || clientsList[idx].name, city: payload.citta || clientsList[idx].city, phone: payload.cellulare || clientsList[idx].phone, specialization: payload.specializzazione || clientsList[idx].specialization, giorni_liberi: payload.giorni_liberi || clientsList[idx].giorni_liberi };
                await saveToOfflineCache('clientsData', clientsList);
            }
        }

        if (op === 'UPDATE' && table === 'visite') {
            let idx = -1;
            if (matchCriteria?.id) { // Modifica per Note
                idx = allVisits.findIndex(v => v.id === matchCriteria.id || v.dbId === matchCriteria.id);
            } else if (matchCriteria?.medico_id && matchCriteria?.data_visita) { // Modifica Sposta Data
                idx = allVisits.findIndex(v => v.medico_id === matchCriteria.medico_id && v.data_visita === matchCriteria.data_visita);
            }
            if (idx !== -1) {
                allVisits[idx] = { ...allVisits[idx], ...payload };
                await saveToOfflineCache('visitsData', allVisits);
            }
        }

        if (op === 'DELETE' && table === 'medici' && matchCriteria?.id) {
            clientsList = clientsList.filter(c => c.id !== matchCriteria.id);
            allVisits = allVisits.filter(v => v.medico_id !== matchCriteria.id);
            await saveToOfflineCache('clientsData', clientsList);
            await saveToOfflineCache('visitsData', allVisits);
        }

        if (op === 'DELETE' && table === 'visite' && matchCriteria?.id) {
            allVisits = allVisits.filter(v => v.id !== matchCriteria.id && v.dbId !== matchCriteria.id);
            await saveToOfflineCache('visitsData', allVisits);
        }

        // DD Gestione Task
        // FIX: Gestione specifica per i Task in modalità Offline
        if (table === 'tasks') {
            if (op === 'INSERT') {
                const medicoInfo = payload.medico_id ? clientsList.find(c => c.id === payload.medico_id) : null;
                tasksList.push({
                    ...payload,
                    id: payload.id || crypto.randomUUID(),
                    completato: false,
                    medici: medicoInfo ? { nome: medicoInfo.name } : null
                });
            } else if (op === 'UPDATE') {
                const idx = tasksList.findIndex(t => t.id === matchCriteria.id);
                if (idx !== -1) tasksList[idx] = { ...tasksList[idx], ...payload };
            } else if (op === 'DELETE') {
                tasksList = tasksList.filter(t => t.id !== matchCriteria.id);
            }
            await saveToOfflineCache('tasksData', tasksList);
        }
        return { data: [payload], error: null };
    }
}

// BB Fetching Principale Da Supabase/Cache
async function loadMonthDataFromSupabase(targetDate) {
    const tempMonthYear = targetDate.format('MMMM YYYY');
    const monthYearString = tempMonthYear.charAt(0).toUpperCase() + tempMonthYear.slice(1);

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '<div class="skeleton-box" style="height: 300px; grid-column: span 7;"></div>';

    // CC Scenario Offline Per Calendario E Visite
    if (!navigator.onLine) {
        const cachedVisits = await getFromOfflineCache('visitsData');
        const cachedClients = await getFromOfflineCache('clientsData');

        if (cachedVisits && cachedClients) {
            allVisits = cachedVisits;
            clientsList = cachedClients;
            processVisitsForCalendar();
            renderCalendar();
            updateExistingClientsSelect();
            // Evitiamo Alert Multipli E Aggiorna In Silenzio Se Non Ho Dati In Cache
            checkMorningReport(allVisits);
            scheduleAllTodayVisits(allVisits);
        } else {
            openAlert("Nessuna Visita Salvata In Cache Per Il Mese Di " + monthYearString + ". Conntettiti A Internet Per Caricare I Dati.");
            renderCalendar(); // Rende Griglia Vuota
        }
        return;
    }

    // CC Scenario Online: Carichiamo I Dati Da Supabase
    try {
        const startOfMonth = targetDate.startOf('month').format('YYYY-MM-DD');
        const endOfMonth = targetDate.endOf('month').format('YYYY-MM-DD');

        let { data: medici, error: mediciError } = await sb.from('medici_con_stato_visite').select('*');
        if (mediciError) throw mediciError;

        clientsList = (medici || []).map(m => ({
            id: m.id, name: m.nome, city: m.citta, address: m.indirizzo || '',
            phone: m.cellulare || '', specialization: m.specializzazione,
            giorni_liberi: m.giorni_liberi,
            lastVisit: m.ultima_visita_passata,
            nextVisit: m.prossima_visita_futura,
            lastNote: m.nota_ultima_visita
        }));

        let { data: visite, error: visiteError } = await sb.from('visite')
            .select('*, medici(*)')
            .gte('data_visita', startOfMonth)
            .lte('data_visita', endOfMonth);
        if (visiteError) throw visiteError;

        allVisits = visite || [];

        // CC Salviamo In Cache Per Uso Offline
        if (typeof saveToOfflineCache === 'function') {
            saveToOfflineCache('visitsData', allVisits);
            saveToOfflineCache('clientsData', clientsList);
        }

        appState.calendarNeedsRefresh = false;
        processVisitsForCalendar();
        renderCalendar();
        updateExistingClientsSelect();
        updateSpecDropdowns();
        checkMorningReport(allVisits);
        scheduleAllTodayVisits(allVisits);

    } catch (error) {
        openAlert("Errore Caricamento Dati Per Il Mese Selezionato.");
        console.error("Errore Caricamento Dati Per Il Mese Selezionato:", error);
    }
}

async function loadAllDataFromSupabase() {
    console.log("🔄 Caricamento Anagrafica Tramite Vista SQL...");
    const container = document.getElementById('clients-container');

    // CC Skeleton Loading
    container.innerHTML = `
        <div class="skeleton-box skeleton-card"></div>
        <div class="skeleton-box skeleton-card"></div>
        <div class="skeleton-box skeleton-card"></div>
        <div class="skeleton-box skeleton-card"></div>
    `;

    // CC Scenario Offline: Proviamo a Caricare Dati dalla Cache
    if (!navigator.onLine) {
        console.log("📡 Modalità Offline: Tentativo Caricamento Anagrafica Da Cache");
        const cachedData = await getFromOfflineCache('clientsData');
        if (cachedData) {
            clientsList = cachedData;
            updateSpecDropdowns();
            updateCityFilter();
            renderClients();
            return;
        } else {
            return openAlert("Sei Offline E Non Hai Dati In Cache.");
        }
    }

    // CC Scenario Online: Carichiamo I Dati Da Supabase
    try {
        // DD: Usiamo una Vista SQL su Supabase per ottenere i dati calcolati (ultima visita, prossima)
        // DD direttamente dal DB invece di calcolarli nel frontend, migliorando la reattività.
        let { data, error } = await sb.from('medici_con_stato_visite').select('*');

        if (!error) {
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
            // Dati Puliti Li Salvo In RAM
            appState.clientsNeedsRefresh = false;

            // CC Salvataggio Nella Memoria Del Telefono (Offline Cache)
            if (typeof saveToOfflineCache === 'function') {
                await saveToOfflineCache('clientsData', clientsList);
            }

            updateSpecDropdowns();
            updateCityFilter();
            renderClients();
        } else {
            openAlert("Errore Nel Caricamento Dei Dati Anagrafici.");
        }

    } catch (error) {
        console.error("Errore Caricamento Vista:", error);
        openAlert("Errore nel caricamento dei dati medici.");
    }
}

// BB Data Processing & Transformer
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
                giorni_liberi: m.giorni_liberi,
                availableDays: parseDays(m.giorni_liberi)
            });
        }
    });
}

// ==========================================================================
// AA 4: MODULO CALENDARIO MENSILE
// ==========================================================================

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

function changeMonth(dir) {
    currentDate = currentDate.add(dir, 'month');
    loadMonthDataFromSupabase(currentDate);
}

// ==========================================================================
// AA 5: MODULO DAY VIEW E LISTE GIORNALIERE
// ==========================================================================

// BB Gestione UI Vista
async function openDayView(dateISO) {
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

    // Controllo Che I Medici Siano Caricati Da Supabase O Da Cache
    if (clientsList.length === 0) {
        if (!navigator.onLine) {
            clientsList = await getFromOfflineCache('clientsData') || [];
        } else {
            await loadAllDataFromSupabase();
        }
    }

    resetForm();
    updateExistingClientsSelect();
    renderDayAppointments();
    setTab('scheduled');
    showView('day-view');
}

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

function toggleMobileListView(view) {
    const container = document.getElementById('day-view'); // O il genitore che contiene le due colonne
    const btnScheduled = document.getElementById('btn-show-scheduled');
    const btnWalkins = document.getElementById('btn-show-walkins');

    // Rimuoviamo le classi di stato precedenti
    container.classList.remove('show-scheduled', 'show-walkins');
    btnScheduled.classList.remove('active');
    btnWalkins.classList.remove('active');

    // Aggiungiamo la classe corretta
    if (view === 'scheduled') {
        container.classList.add('show-scheduled');
        btnScheduled.classList.add('active');
    } else {
        container.classList.add('show-walkins');
        btnWalkins.classList.add('active');
    }
}

// BB Rendering Liste
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
    // --- LOGICA WALK-IN (LIBERI OGGI) ---
    const dayOfWeek = dayjs(selectedDateISO).day();

    walkinQueue.filter(w => w.availableDays.includes(dayOfWeek) && !visitatiOggi.includes(w.id)).forEach(w => {
        const clientFull = clientsList.find(c => c.id === w.id);
        const mergedData = { ...w, address: clientFull?.address, phone: clientFull?.phone };
        const actionPillsHtml = generatePillButtons(mergedData);

        let orarioInfoHtml = "";
        try {
            // Tentativo di parsing del nuovo formato JSON {"1": ["09:00-12:00", "15:00-18:00"]}
            const slotsObj = JSON.parse(w.giorni_liberi || "{}");

            // Verifichiamo se esistono fasce orarie per il giorno corrente (dayOfWeek)
            if (slotsObj[dayOfWeek] && Array.isArray(slotsObj[dayOfWeek]) && slotsObj[dayOfWeek].length > 0) {
                // Uniamo tutte le fasce orarie disponibili separate da una virgola
                const fasceTesto = slotsObj[dayOfWeek].join(', ');
                orarioInfoHtml = `
                <div class="text-primary small fw-bold mt-1 d-flex align-items-center gap-1">
                    <i data-lucide="clock" style="width:12px; height:12px;"></i>
                    <span>Riceve: ${fasceTesto}</span>
                </div>`;
            } else if (slotsObj[dayOfWeek] && typeof slotsObj[dayOfWeek] === 'string') {
                // Caso di transizione: se salvato come stringa singola
                orarioInfoHtml = `
                <div class="text-primary small fw-bold mt-1 d-flex align-items-center gap-1">
                    <i data-lucide="clock" style="width:12px; height:12px;"></i>
                    <span>Riceve: ${slotsObj[dayOfWeek]}</span>
                </div>`;
            } else {
                orarioInfoHtml = `<div class="text-muted small mt-1 italic">Nessun orario inserito</div>`;
            }
        } catch (e) {
            // Fallback: Se il campo non è JSON (vecchio formato "1,2,3"), mostriamo un messaggio generico
            orarioInfoHtml = `<div class="text-muted small mt-1">Orario non specificato</div>`;
        }

        const li = document.createElement('li');
        li.className = 'appointment-item shadow-sm';

        li.innerHTML = `
    <div class="list-info mb-3">
        <span class="fw-bold text-dark fs-5">${escapeHTML(w.name)}</span>
        <div class="text-secondary small mt-1">
            <i data-lucide="map-pin" style="width:12px; height:12px;"></i> ${escapeHTML(w.city)}
        </div>
        ${orarioInfoHtml}
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

// BB Azioni Della Vista (Walk-in)
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
        await executeDBAction('INSERT', 'visite', {
            medico_id: modalTargetId,
            data_visita: selectedDateISO,
            ora_visita: time,
            is_walkin_done: true
        });

        // CC Imposto Flag Di Refresh
        appState.calendarNeedsRefresh = true;
        appState.clientsNeedsRefresh = true;

        closeModal('modal-time');
        await loadMonthDataFromSupabase(currentDate);
        openDayView(selectedDateISO);
    }
}

// ==========================================================================
// AA 6: MODULO CRUD VISITE E APPUNTAMENTI
// ==========================================================================

// BB Creazione / Modifica
async function addAppointment() {
    const isNew = document.querySelector('input[name="clientType"]:checked').value === 'new';
    let clientId;
    let nomeMedico = "";
    let cittaMedico = "";

    if (isNew) {
        // CC Creazione Nuovo Medico Tramite Acquisizione Dati Dal Form
        const nome = document.getElementById('new-client-name').value.trim();
        const citta = document.getElementById('new-client-city').value.trim();
        const indirizzo = document.getElementById('new-client-address').value.trim();
        const cellulare = document.getElementById('new-client-phone').value.trim();
        let spec = document.getElementById('new-client-spec').value;

        if (spec === 'NEW_SPEC') spec = document.getElementById('custom-spec-input').value.trim();
        if (!nome || !spec) return openAlert("Nome E Specializzazione Sono Obbligatori.");

        // DD Generazione UUID Locale Per Linkare Medico Alla Visita
        clientId = crypto.randomUUID();
        nomeMedico = nome;
        cittaMedico = citta;

        const medicoPayload = {
            id: clientId,
            nome,
            citta,
            indirizzo,
            cellulare,
            specializzazione: spec
        };

        const response = await executeDBAction('INSERT', 'medici', medicoPayload);

        if (response?.error) {
            return openAlert("Errore Durante Inserimento Nuovo Medico");
        } else {
            // CC Aggiunta Alla Lista Locale In Modo Da Mostrarlo Nella UI
            clientsList.push({
                id: clientId,
                name: nome,
                city: citta,
                specialization: spec,
                address: indirizzo,
                phone: cellulare
            });
            updateExistingClientsSelect();
        }
    } else {
        // CC Caso Medico Esistente: Recupero ID Dal Select
        clientId = document.getElementById('existing-client-select').value;
        if (!clientId) return openAlert("Seleziona Un Medico Dalla Lista");

        // Prelevo Dati Da Lista In RAM
        const medico = clientsList.find(c => c.id === clientId);
        nomeMedico = medico ? medico.name : "Sconosciuto";
        cittaMedico = medico ? medico.city : "";
    }

    // CC Salvataggio Visita
    if (currentTab === 'scheduled') {
        const time = document.getElementById('appointment-time').value;
        if (!time) return openAlert("Inserisci Orario Visita.");

        // Salvataggio nel DB (o in coda se offline)
        await executeDBAction('INSERT', 'visite', {
            medico_id: clientId,
            data_visita: selectedDateISO,
            ora_visita: time
        });


        if (!navigator.onLine) {
            // DD Offline: Inserisco Manualmente L'Appuntamento Nella Vista
            if (!appointments[selectedDateISO]) appointments[selectedDateISO] = { scheduled: [] };

            appointments[selectedDateISO].scheduled.push({
                id: clientId,
                name: nomeMedico,
                city: cittaMedico,
                time: time,
                note: "",
                dbId: crypto.randomUUID(), // Genera Un ID Finto Per La Lista
                isWalkinDone: false
            });

            openAlert("Salvato In Locale. Sarà Sincronizzato Appena Torna Internet!");
            renderDayAppointments();
            resetForm();
        } else {
            // DD Online: Ricarichiamo Da Supabase Per Avere ID Reale E Relazioni
            await loadMonthDataFromSupabase(currentDate);
            openAlert("Appuntamento Aggiunto Con Successo!");
            renderDayAppointments();
            resetForm();
        }

    } else {
        // CC Salvataggio Giorni Di Ricevimento Con Multi-Orario (Walk-in)
        const daysJson = collectTimeSlots('available-days-checkboxes');

        // Salvataggio Su Database/Coda Offline
        await executeDBAction('UPDATE', 'medici', { giorni_liberi: daysJson }, { id: clientId });

        // Aggiornamento Istantaneo Della UI E Della RAM
        // Cerca il medico nella lista locale e aggiorna i suoi giorni_liberi
        const clientIdx = clientsList.findIndex(c => c.id === clientId);
        if (clientIdx !== -1) {
            clientsList[clientIdx].giorni_liberi = daysJson;
        }

        // Aggiornamento walkinQueue
        processVisitsForCalendar();
        // Rendering Immediato
        renderDayAppointments();

        if (!navigator.onLine) {
            openAlert("Orari Di Ricevimento Salvati In Locale. Saranno Sincronizzati Automaticamente.");
        } else {
            // Ricarichiamo Dati Per Aggiornare Calendario
            await loadMonthDataFromSupabase(currentDate);
            openAlert("Appuntamento Libero Aggiunto Con Successo!");
        }

        // Reset Form
        resetForm();

        // Rimozione Campi Orario Per Pulizia
        document.querySelectorAll('[id^="group-available-days-checkboxes"]').forEach(el => el.remove());
    }

    // CC Imposto Flag Di Refresh
    appState.calendarNeedsRefresh = true;
    appState.clientsNeedsRefresh = true;

    checkMorningReport(allVisits);
    scheduleAllTodayVisits(allVisits);
}

async function confirmNewVisitFromAnagrafica() {
    const date = document.getElementById('new-visit-date').value;
    const time = document.getElementById('new-visit-time').value;

    if (!date || !time) return openAlert("Inserisci data e ora");

    const payload = {
        medico_id: modalTargetId,
        data_visita: date,
        ora_visita: time,
        note: ""
    };

    // Il nostro router executeDBAction gestirà la coda se sei offline
    await executeDBAction('INSERT', 'visite', payload);

    closeModal('modal-add-visit');

    // Aggiorniamo la UI locale
    appState.clientsNeedsRefresh = true;
    appState.calendarNeedsRefresh = true;

    if (navigator.onLine) {
        await loadAllDataFromSupabase();
    } else {
        // Se offline, aggiorniamo manualmente la data dell'ultima visita nella RAM per i filtri
        const idx = clientsList.findIndex(c => c.id === modalTargetId);
        if (idx !== -1) {
            clientsList[idx].lastVisit = date;
            await saveToOfflineCache('clientsData', clientsList);
        }
        renderClients();
        openAlert("Visita salvata in locale!");
    }
}

async function confirmEditVisit() {
    const newDate = document.getElementById('edit-visit-date').value;
    const newTime = document.getElementById('edit-visit-time').value;

    if (!newDate || !newTime) return openAlert("Inserisci una data e un orario validi.");

    // CC Aggiornamento Visita DIRETTAMENTE Nel Database
    // DD In questo modo non dipende dall'array locale "allVisits" (che contiene solo il mese corrente),
    // DD permettendoci di spostare visite anche di mesi futuri o passati senza errori.
    const response = await executeDBAction('UPDATE', 'visite',
        { data_visita: newDate, ora_visita: newTime },
        { medico_id: modalTargetId, data_visita: modalTargetOldDate });

    // Operatore ?. È Il Null Safe Di JS. Se response è null O undefined Non Genera Errore Ma Si Limita A Restituire undefined, Evitando Crash In Caso Di Problemi Di Connessione O Altri Errori
    if (response?.error) {
        return openAlert("Errore Durante Aggiornamento");
    } else {
        closeModal('modal-edit-visit');
        // CC Imposto Flag Di Refresh
        appState.calendarNeedsRefresh = true;
        appState.clientsNeedsRefresh = true;
    }

    // CC Ricalcolo Vista SQL Per Aggiornare Le Card In Base Alle Nuove Date/Orari
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

function editNote(visitId, currentNote) {
    const input = document.getElementById('modal-note-input');
    const saveBtn = document.getElementById('btn-save-note');

    input.value = currentNote || "";
    openModal('modal-note');

    saveBtn.onclick = async () => {
        const newNote = input.value.trim();
        const response = await executeDBAction('UPDATE', 'visite', { note: newNote }, { id: visitId });

        // Operatore ?. È Il Null Safe Di JS. Se response è null O undefined Non Genera Errore Ma Si Limita A Restituire undefined, Evitando Crash In Caso Di Problemi Di Connessione O Altri Errori
        if (response?.error) {
            openAlert("Errore Nel Salvataggio Della Nota");
        } else {
            // CC Imposto Flag Di Refresh
            closeModal('modal-note');
            appState.clientsNeedsRefresh = true;
            // DD Il Calendario Si Refresha Sotto
            await loadMonthDataFromSupabase(currentDate);
            openDayView(selectedDateISO);
        }
    };
}

// BB Eliminazione
async function deleteApp(visitDbId) {
    console.log("Click rilevato per ID:", visitDbId);
    const desc = document.getElementById('modal-confirm-desc');
    const confirmBtn = document.getElementById('btn-execute-confirm');

    desc.innerText = `Vuoi Cancellare Questo Appuntamento?`;
    openModal('modal-confirm');

    confirmBtn.onclick = async () => {
        await executeDBAction('DELETE', 'visite', null, { id: visitDbId });

        // CC Imposto Flag Di Refresh
        appState.calendarNeedsRefresh = true;
        appState.clientsNeedsRefresh = true;

        allVisits = allVisits.filter(v => v.dbId !== visitDbId);
        processVisitsForCalendar(); // Ricalcola la mappa
        renderDayAppointments();
        closeModal('modal-confirm');
        await loadMonthDataFromSupabase(currentDate);
        openDayView(selectedDateISO);
    };
}

// ==========================================================================
// AA 7: MODULO ANAGRAFICA MEDICI (CLIENTS VIEW)
// ==========================================================================

// BB Rendering e UI
function renderClients() {
    const container = document.getElementById('clients-container');
    if (!container) return;

    // CC Acquisizione Valori Filtri
    const searchTerm = (document.getElementById('search-client')?.value || "").toLowerCase();
    const filterSpec = document.getElementById('filter-spec')?.value || 'all';
    const filterCity = document.getElementById('filter-city')?.value || 'all';

    // DD Se Non Trova Il Radio Button Imposta Il Filtro Di Default "all" Per Evitare Errori
    const filterVisitEl = document.querySelector('input[name="visitFilter"]:checked');
    const filterVisit = filterVisitEl ? filterVisitEl.value : 'all';

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

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center py-5">Nessun Medico Trovato Con Questi Filtri</p>';
        return;
    }

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

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// BB Ricerca e Filtri
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

// BB Modifica Dati Medico
async function confirmEditClient() {
    const name = document.getElementById('modal-edit-name').value.trim();
    const city = document.getElementById('modal-edit-city').value.trim();
    const phone = document.getElementById('modal-edit-phone').value.trim();
    const spec = document.getElementById('modal-edit-spec').value;
    const checkboxes = document.querySelectorAll('#modal-edit-days-checkboxes input:checked');
    const days = collectTimeSlots('available-days-checkboxes');

    if (!name) return openAlert("Il nome è obbligatorio.");

    await executeDBAction('UPDATE', 'medici', {
        nome: name, citta: city, cellulare: phone, specializzazione: spec, giorni_liberi: days
    }, { id: modalTargetId });

    // CC Imposto Flag Di Refresh
    appState.calendarNeedsRefresh = true;
    appState.clientsNeedsRefresh = true;

    closeModal('modal-edit-client');
    await loadAllDataFromSupabase();
    showView('clients-view');
}

async function askDeleteClient(clientId, clientName) {
    const desc = document.getElementById('modal-confirm-desc');
    const confirmBtn = document.getElementById('btn-execute-confirm');

    desc.innerText = `Sei Sicuro Di Voler Eliminare Il Medico "${clientName}"? Questa Operazione Eliminerà Anche Tutte Le Visite Collegate.`;
    openModal('modal-confirm');

    confirmBtn.onclick = async () => {
        // Esecuzione Eliminazione Tramite Router In Modo Che Gestisca Online/Offline
        await executeDBAction('DELETE', 'medici', null, { id: clientId });

        // Pulizia UI
        closeModal('modal-confirm');
        appState.clientsNeedsRefresh = true;
        appState.calendarNeedsRefresh = true;

        // Pulizia Forzata Della RAM Per Evitare Di Mostrare Dati Inconsistenti Fino Al Prossimo Caricamento Da DB
        allVisits = allVisits.filter(v => v.medico_id !== clientId);
        processVisitsForCalendar();

        // Ricarica Lista
        await loadAllDataFromSupabase();
        openAlert("Medico Elimitato Con Successo!");
    };
}

// ==========================================================================
// AA 8: MODULO TASK E ATTIVITÀ
// ==========================================================================

// BB Rendering e UI
async function renderTasks() {
    const container = document.getElementById('tasks-container');

    // CC Logica Online / Offline Per i Task
    if (!navigator.onLine) {
        const cachedTasks = await getFromOfflineCache('tasksData');
        console.log("📡 Modalità Offline: Caricamento Tasks Da Cache", cachedTasks);
        tasksList = cachedTasks || [];
    } else {
        const { data, error } = await sb.from('tasks').select('*, medici(nome)');
        if (!error) {
            tasksList = data || []; // Assegna i dati alla variabile globale
            if (typeof saveToOfflineCache === 'function') {
                saveToOfflineCache('tasksData', tasksList); // Aggiorna la cache
            }
        }
    }

    // CC Clonazione tasksList 
    let filteredTasks = [...tasksList];

    // Acquisizione Valori Filtri
    const statusF = document.getElementById('filter-task-status').value || 'all';
    const prioF = document.getElementById('sort-task-prio').value || 'desc';
    const contextF = document.getElementById('filter-task-context').value || 'all';

    // CC Applicazione Filtro STATO
    if (statusF === 'todo') {
        filteredTasks = filteredTasks.filter(t => !t.completato);
    }

    // CC Applicazione Filtro CONTESTO
    if (contextF === 'medici') {
        filteredTasks = filteredTasks.filter(t => t.medico_id !== null);
    } else if (contextF === 'admin') {
        filteredTasks = filteredTasks.filter(t => t.medico_id === null);
    }

    // CC Applicazione Ordinamento PRIORITÀ
    filteredTasks.sort((a, b) => {
        if (a.completato !== b.completato) return a.completato ? 1 : -1;
        return prioF === 'desc' ? b.priorita - a.priorita : a.priorita - b.priorita;
    });

    // CC Rendering A Schermo
    container.innerHTML = filteredTasks.length ? filteredTasks.map(t => `
    <div class="task-card ${t.completato ? 'task-done' : ''} task-prio-${t.priorita} shadow-sm">
        <div class="d-flex align-items-center w-100">
            <button class="task-checkbox" onclick="toggleTask('${t.id}', ${t.completato})">
                <i data-lucide="check" class="check-icon"></i>
            </button>
            <div class="task-content flex-grow-1 ms-3">
                <h6 class="task-title mb-1">${escapeHTML(t.titolo)}</h6>
                ${t.descrizione ? `<div class="text-muted small mb-1 fst-italic border-start border-2 ps-2 border-secondary opacity-75">${escapeHTML(t.descrizione)}</div>` : ''}
                <!-- FIX QUI: Aggiunto il punto interrogativo per evitare crash se medici è null -->
                ${t.medici?.nome ? `<div class="task-meta text-primary fw-semibold"><i data-lucide="user" class="icon-xs"></i> ${escapeHTML(t.medici.nome)}</div>` : ''}
            </div>
            <div class="task-actions d-flex gap-1 ms-2">
                <button class="btn-task-icon text-secondary" onclick="editTask('${t.id}')"><i data-lucide="edit-2"></i></button>
                <button class="btn-task-icon text-danger" onclick="deleteTask('${t.id}')"><i data-lucide="trash-2"></i></button>
            </div>
        </div>
    </div>
    `).join('') : `<div class="text-center py-5 mt-2"><p class="text-muted small">Nessun Task trovato.</p></div>`;
    lucide.createIcons();
}

function toggleTaskType() {
    const type = document.querySelector('input[name="taskType"]:checked').value;
    const groupGeneric = document.getElementById('task-group-generic');
    const labelMedico = document.getElementById('label-medico-task');

    if (type === 'gen') {
        // Generica: Mostra Titolo E Note,, Medico Opzionale
        groupGeneric.classList.remove('display-none');
        labelMedico.innerText = "Collega A Medico (Opzionale)";
    } else {
        // Chiamata / Appuntamento: Nascondi Titolo E Note, Medico Obbligatorio
        groupGeneric.classList.add('display-none');
        labelMedico.innerText = type === 'call' ? "Chi Devi Chiamare?" : "Con Chi Devi Prendere Appuntamento?";
    }
}

// BB Operazioni CRUD
async function openAddTaskModal() {
    if (clientsList.length === 0) {
        await loadAllDataFromSupabase();
    }

    const select = document.getElementById('task-medico-link');
    let html = '<option value="">Nessun Medico Specifico</option>';

    // Ordine alfabetico per facilitare la ricerca
    const sortedClients = [...clientsList].sort((a, b) => a.name.localeCompare(b.name));
    sortedClients.forEach(c => {
        html += `<option value="${c.id}">${escapeHTML(c.name)}</option>`;
    });
    select.innerHTML = html;

    // Reset UI
    document.getElementById('task-id-hidden').value = '';
    document.getElementById('task-titolo').value = '';
    document.getElementById('task-note').value = '';
    document.getElementById('task-priorita').value = '1';
    document.getElementById('type-gen').checked = true;                             // Default: Generica
    document.getElementById('task-modal-title').innerText = "Nuova Attività";
    document.getElementById('task-type-selector').classList.remove('display-none'); // Mostra I Bottoni Di Selezione Tipo Task

    toggleTaskType();
    openModal('modal-add-task');
}

async function saveTask() {
    let id = document.getElementById('task-id-hidden').value;
    const type = document.querySelector('input[name="taskType"]:checked').value;
    const priorita = parseInt(document.getElementById('task-priorita').value);
    const medico_id = document.getElementById('task-medico-link').value || null;

    let titolo = "";
    let descrizione = null;

    if (type === 'gen') {
        // CC Task Generica
        titolo = document.getElementById('task-titolo').value.trim();
        const noteInput = document.getElementById('task-note').value.trim();
        if (noteInput) descrizione = noteInput;
        if (!titolo) return openAlert("Inserisci un titolo per l'attività.");
    } else {
        // CC Task Collegata A Medico (Chiamata o Appuntamento)
        if (!medico_id) return openAlert("Devi Selezionare Un Medico Per Questo Tipo Di Attività");
        const medico = clientsList.find(c => c.id === medico_id);
        const nomeMedico = medico ? medico.name : "Medico Sconosciuto";
        titolo = type === 'call' ? `Chiamare ${nomeMedico}` : `Prendere Appuntamento Con ${nomeMedico}`;
    }

    const payload = {
        titolo,
        descrizione,
        priorita,
        medico_id
    };

    // CC Se Il Task È Nuovo Genero Un ID Temporaneo
    if (!id) {
        id = crypto.randomUUID();
        payload.id = id;
        payload.completato = false;
        await executeDBAction('INSERT', 'tasks', payload);
    } else {
        await executeDBAction('UPDATE', 'tasks', payload, { id: id });
    }

    // CC Gestione Offline Immediata Per UI (Aggiornamento Memoria RAM E Cache)
    if (!navigator.onLine) {
        const medicoInfo = medico_id ? clientsList.find(c => c.id === medico_id) : null;
        const taskPerUI = {
            ...payload,
            id: id,
            medici: medicoInfo ? { nome: medicoInfo.name } : null
        };

        const existingIndex = tasksList.findIndex(t => t.id === id);
        if (existingIndex !== -1) {
            tasksList[existingIndex] = { ...tasksList[existingIndex], ...taskPerUI };
        } else {
            tasksList.push(taskPerUI);
        }

        // CC Salvo In Cache Cosi Anche Ricaricando Non La Si Perde
        if (typeof saveToOfflineCache === 'function') {
            saveToOfflineCache('tasksData', tasksList);
        }
        openAlert("Task Salvato Offline. Verrà Sincronizzato Appena Torna La Rete.");
    }

    appState.tasksNeedsRefresh = true;
    closeModal('modal-add-task');
    renderTasks();
}

async function editTask(id) {
    let task;
    if (navigator.onLine) {
        const { data } = await sb.from('tasks').select('*').eq('id', id).single();
        task = data;
    } else {
        // Se Offline Cerca In Memoria
        task = tasksList.find(t => t.id === id);
    }
    if (!task) return;

    if (clientsList.length === 0) {
        await loadAllDataFromSupabase();
    }

    // CC Popola Medici
    const select = document.getElementById('task-medico-link');
    let html = '<option value="">Nessun Medico Specifico</option>';
    clientsList.forEach(c => { html += `<option value="${c.id}">${escapeHTML(c.name)}</option>`; });
    select.innerHTML = html;

    // CC Riempimento Campi
    document.getElementById('task-id-hidden').value = task.id;
    document.getElementById('task-titolo').value = task.titolo;
    document.getElementById('task-note').value = task.descrizione || '';
    document.getElementById('task-priorita').value = task.priorita;
    document.getElementById('task-medico-link').value = task.medico_id || '';
    document.getElementById('task-modal-title').innerText = "Modifica Attività";

    // CC Forza La UI Su "Generica" Durante Edit
    // DD Nasconde Selettore Per Non Creare Confusione
    document.getElementById('type-gen').checked = true;
    document.getElementById('task-type-selector').classList.add('display-none');
    toggleTaskType();

    openModal('modal-add-task');
}

async function toggleTask(id, attualeStato) {
    // CC Aggiungi In Coda Oppure Esegui Subito A Seconda Che Siamo Online O Offline
    await executeDBAction('UPDATE', 'tasks', { completato: !attualeStato }, { id: id });

    // CC Aggiornamento UI Immediato
    const taskIndex = tasksList.findIndex(t => t.id === id);
    if (taskIndex !== -1) {
        tasksList[taskIndex].completato = !attualeStato;
    }

    // CC Se Offline Salva In IndexedDB Così Sopravvive Al Refresh E Si Sincronizza Appena Torna La Rete
    if (!navigator.onLine && typeof saveToOfflineCache === 'function') {
        saveToOfflineCache('tasksData', tasksList);
    }

    // CC Con Flag false Per Non Fare Fetch Dal DB Se Siamo Offline
    // CC (Altrimenti Se Supabase È Lento A Rispondere, Il Task Torna Visivamente Allo Stato Precedente Per Un Millisecondo)
    appState.tasksNeedsRefresh = false;

    // CC Aggiornamento UI
    renderTasks();
}

async function deleteTask(id) {
    const desc = document.getElementById('modal-confirm-desc');
    const confirmBtn = document.getElementById('btn-execute-confirm');

    // CC Modal Di Conferma Eliminazione
    desc.innerText = "Vuoi Eliminare Questa Attività? Questa Azione Non Può Essere Annullata.";
    openModal('modal-confirm');

    confirmBtn.onclick = async () => {
        // Esegui o metti in coda l'eliminazione
        await executeDBAction('DELETE', 'tasks', null, { id: id });

        // Aggiorna la RAM locale rimuovendo il task
        tasksList = tasksList.filter(t => t.id !== id);

        // Se offline, aggiorna la cache locale per far sparire il task
        if (!navigator.onLine && typeof saveToOfflineCache === 'function') {
            saveToOfflineCache('tasksData', tasksList);
            openAlert("Task Eliminato Offline. Verrà Rimosso Definitivamente Appena Torna La Rete.");
        }

        // CC Si Può Evitare Di Fare Il Fetch Perché La RAM È Già Aggiornata
        appState.tasksNeedsRefresh = false;
        closeModal('modal-confirm');
        renderTasks();
    };
}

// ==========================================================================
// AA 9: GESTIONE MODALI E INTERAZIONI ESTERNE
// ==========================================================================

// BB Core Modals
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

// BB Apertura Modali Specifici
function openEditClient(clientId) {
    const client = clientsList.find(c => c.id === clientId);
    if (!client) return;
    modalTargetId = clientId;

    document.getElementById('modal-edit-name').value = client.name;
    document.getElementById('modal-edit-city').value = client.city || '';
    document.getElementById('modal-edit-spec').value = client.specialization || '';
    document.getElementById('modal-edit-phone').value = client.phone || '';

    document.querySelectorAll('[id^="slot-modal-edit-days-checkboxes"]').forEach(el => el.remove());

    if (client.giorni_liberi) {
        try {
            const slotsObj = JSON.parse(client.giorni_liberi);
            Object.keys(slotsObj).forEach(dayId => {
                const cb = document.querySelector(`#modal-edit-days-checkboxes input[value="${dayId}"]`);
                if (cb) {
                    cb.checked = true;
                    toggleTimeInput('modal-edit-days-checkboxes', dayId, true);

                    const groupId = `group-modal-edit-days-checkboxes-${dayId}`;
                    const container = document.querySelector(`#${groupId} .slots-container`);
                    container.innerHTML = ''; // Svuota il default

                    // Aggiunge ogni fascia salvata
                    slotsObj[dayId].forEach((timeRange, index) => {
                        const [from, to] = timeRange.split('-');
                        const div = document.createElement('div');
                        div.className = 'd-flex align-items-center gap-2 mb-1 slot-row';
                        div.innerHTML = `
                        <input type="time" class="form-control form-control-sm time-from" value="${from}">
                        <span class="small">al</span>
                        <input type="time" class="form-control form-control-sm time-to" value="${to}">
                        ${index > 0 ? '<button type="button" class="btn btn-sm text-danger p-0" onclick="this.parentElement.remove()">×</button>' : ''}
                    `;
                        container.appendChild(div);
                    });
                }
            });
        } catch (e) {
            // Se è vecchio formato (Stringa 1,2,3)
            client.giorni_liberi.split(',').forEach(g => {
                const cb = document.querySelector(`#modal-edit-days-checkboxes input[value="${g}"]`);
                if (cb) {
                    cb.checked = true;
                    toggleTimeInput('modal-edit-days-checkboxes', g, true);
                }
            });
        }
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

function openAddVisitModal(clientId) {
    modalTargetId = clientId;
    const client = clientsList.find(c => c.id === clientId);
    document.getElementById('modal-add-visit-desc').innerHTML = `Pianifica visita per <b>${client.name}</b>`;
    document.getElementById('new-visit-date').value = dayjs().format('YYYY-MM-DD');
    document.getElementById('new-visit-time').value = "09:00";
    openModal('modal-add-visit');
}

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

// BB Interazioni Esterne
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

// ==========================================================================
// AA 10: FORM HELPERS E GESTIONE UI (DOM MANIPULATION)
// ==========================================================================

// BB Aggiornamento Dropdown e Selettori
function updateSpecDropdowns() {
    const defaultSpecs = ["MMG", "MMG 2", "Neurologo", "Otorino", "Fisiatra", "Diabetologo", "Medicina Dello Sport", "Geriatra", "Nutrizionista"];
    const extraSpecs = [...new Set(clientsList.map(c => c.specialization))].filter(s => s && !defaultSpecs.includes(s)).sort();
    const allSpecs = [...defaultSpecs, ...extraSpecs];
    const selects = ['new-client-spec', 'modal-edit-spec', 'filter-spec'];

    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        let html = id === 'filter-spec'
            ? `<option value="all" ${currentVal === 'all' ? 'selected' : ''}>Tutte</option>`
            : `<option value="" disabled ${!currentVal ? 'selected' : ''}>Specializzazione</option>`;

        allSpecs.forEach(s => {
            // Aggiunta Attributo selected Nell'HTML
            html += `<option value="${s}" ${s === currentVal ? 'selected' : ''}>${s}</option>`;
        });

        if (id !== 'filter-spec') html += `<option value="NEW_SPEC"> + Aggiungi Specializzazione</option>`;
        el.innerHTML = html;
    });
}

function updateCityFilter() {
    const select = document.getElementById('filter-city');
    if (!select) return;
    const current = select.value;
    const cities = [...new Set(clientsList.map(c => c.city).filter(Boolean))].sort();
    // Aggiunta Attributo selected Nell'HTML
    select.innerHTML = `<option value="all" ${current === 'all' ? 'selected' : ''}>Tutte</option>` +
        cities.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
}

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

// BB Toggles UI Interattivi
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

// BB Funzioni Form Multi-Orario Ricevimento
function toggleTimeInput(containerId, dayId, show) {
    const parent = document.getElementById(containerId);
    let groupId = `group-${containerId}-${dayId}`;
    let existingGroup = document.getElementById(groupId);

    if (show && !existingGroup) {
        const div = document.createElement('div');
        div.id = groupId;
        div.className = 'mt-2 p-2 rounded-3 border bg-white animate-float w-100 day-time-group';
        div.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-2">
                <span class="badge bg-primary">${getDayLabel(dayId)}</span>
                <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" onclick="addExtraSlot('${groupId}')">+</button>
            </div>
            <div class="slots-container">
                <div class="d-flex align-items-center gap-2 mb-1 slot-row">
                    <input type="time" class="form-control form-control-sm time-from" value="09:00">
                    <span class="small">al</span>
                    <input type="time" class="form-control form-control-sm time-to" value="13:00">
                </div>
            </div>
        `;
        parent.after(div);
    } else if (!show && existingGroup) {
        existingGroup.remove();
    }
}

function addExtraSlot(groupId) {
    const container = document.querySelector(`#${groupId} .slots-container`);
    const div = document.createElement('div');
    div.className = 'd-flex align-items-center gap-2 mb-1 slot-row animate-float';
    div.innerHTML = `
        <input type="time" class="form-control form-control-sm time-from" value="15:00">
        <span class="small">al</span>
        <input type="time" class="form-control form-control-sm time-to" value="18:00">
        <button type="button" class="btn btn-sm text-danger p-0" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(div);
}

function collectTimeSlots(containerId) {
    const result = {};
    const container = document.getElementById(containerId);
    const checkedDays = container.querySelectorAll('.btn-check:checked');

    checkedDays.forEach(cb => {
        const dayId = cb.value;
        const group = document.getElementById(`group-${containerId}-${dayId}`);
        if (group) {
            const slots = [];
            group.querySelectorAll('.slot-row').forEach(row => {
                const from = row.querySelector('.time-from').value;
                const to = row.querySelector('.time-to').value;
                if (from && to) slots.push(`${from}-${to}`);
            });
            result[dayId] = slots;
        }
    });
    return JSON.stringify(result);
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

// ==========================================================================
// AA 11: UTILITY, DATA PARSING E SICUREZZA
// ==========================================================================

// BB Status e Sicurezza
function updateNetworkLED(state) {
    const led = document.getElementById('network-led');
    if (!led) return;

    // Reset Di Tutte Le Classi Mantenendo Solo Quella Base
    led.className = 'status-led';

    // Applicazione Stile E Classe In Base Allo Stato Della Rete
    if (state === true || state === 'online') {
        led.classList.add('online');
        led.title = "Connesso";
    } else if (state === false || state === 'offline') {
        led.classList.add('offline');
        led.title = "Offline (Dati In Coda)";
    } else if (state === 'syncing') {
        led.classList.add('syncing');
        led.title = "Sincronizzazione In Corso...";
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t]));
}

// BB Data Parsers
function parseDays(data) {
    if (!data) return [];
    try {
        return Object.keys(JSON.parse(data)).map(Number);
    } catch (e) {
        return data.split(',').map(Number);
    }
}

// BB Formattazione Stringhe Giorni
function getDayLabel(id) {
    const labels = { "1": "Lun", "2": "Mar", "3": "Mer", "4": "Gio", "5": "Ven" };
    return labels[id] || "";
}