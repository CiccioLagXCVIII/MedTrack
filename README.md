# 📅 ISFplan: Agenda Overpowered per ISF
### *SaaS-Style Progressive Web App (PWA) per Informatori Scientifici del Farmaco*

![ISFplan Banner](icon/ISFplanBanner.png)

<div align="center">

![Versione](https://img.shields.io/badge/Versione-1.6.2-deeppink)
![Stato](https://img.shields.io/badge/Stato-Production--Ready-success)
![PWA](https://img.shields.io/badge/PWA-Installable-purple)
![Offline](https://img.shields.io/badge/Offline-Support-blue)
![Stack](https://img.shields.io/badge/Stack-Vanilla_JS--Supabase--PostgreSQL-orange)

</div>

**ISFplan (Agenda Overpowered)** è una soluzione digitale avanzata progettata specificamente per centralizzare la gestione dei medici, pianificare le visite e monitorare i target di contatto. Strutturata come una SPA (Single Page Application) e configurata come **PWA (Progressive Web App)**, offre l'esperienza fluida di un software SaaS professionale, ottimizzata per l'uso nativo su smartphone (iOS/Android) e supportata da un solido backend relazionale.

---

## 🚀 Visione Generale
Il progetto risolve le sfide logistiche quotidiane di un **Informatore Scientifico del Farmaco (ISF)** attraverso:
*   **Pianificazione Intelligente:** Calendario dinamico mensile e viste giornaliere divise per tipologia di attività (su appuntamento o liberi/walk-in).
*   **Monitoraggio Target (Color Coding):** Calcolo automatico dei giorni trascorsi dall'ultima visita con alert cromatici immediati (Verde/Giallo/Rosso/Blu).
*   **Logistica One-Click:** Scelta rapida tra navigazione via Google Maps o Waze e pulsanti per chiamate/WhatsApp diretti.
*   **Gestione Multi-Utente Sicura:** Sistema di login e compartimentazione dei dati. Nessun ISF può vedere i dati di un altro collega.
*   **Continuità Operativa:** Progettata per funzionare all'interno di ospedali o strutture schermate grazie al motore di sincronizzazione offline.

---

## 🔐 Accesso e Utilizzo dell'App (Whitelist)
Per garantire la massima sicurezza e la corretta compartimentazione dei dati nel database, **la registrazione libera all'applicazione è momentaneamente disabilitata**. Il sistema di login è gestito in un ambiente chiuso e protetto tramite Supabase Auth.

Se sei un Informatore Scientifico, un collega o un utente interessato a utilizzare ISFplan per il tuo lavoro:
👉 **Devi essere aggiunto manualmente alla Whitelist.**

📧 **Come richiedere l'accesso:**
Scrivimi un'email all'indirizzo **francescolv78@gmail.com** specificando che vorresti provare ISFplan. Provvederò personalmente a creare il tuo account sicuro e a inviarti le credenziali di accesso per iniziare a usare la piattaforma.

---

## 🛠️ Architettura Tecnica & Stack
L'app è costruita seguendo i principi del **Modern Web Development**, privilegiando la velocità di esecuzione e la leggerezza dei pacchetti:

*   **Frontend PWA:** HTML5, CSS3 (Variabili CSS, Flexbox/Grid), JavaScript Moderno (ES6+ Vanilla).
*   **UI/UX Premium:** Bootstrap 5 (utility), [Lucide Icons](https://lucide.dev/), e **Skeleton Loading** animati per azzerare la percezione dei tempi di caricamento.
*   **Gestione Date:** [Day.js](https://day.js.org/) con localizzazione italiana per calcoli di scadenze e calendari.
*   **Backend & Database (BaaS):** [Supabase](https://supabase.com/) (PostgreSQL). Utilizzo di **SQL Views** (`medici_con_stato_visite`) per demandare calcoli complessi al server.
*   **Sicurezza:** Integrazione **Supabase Auth** e **Row Level Security (RLS)** per l'isolamento dei dati per singolo utente.
*   **Integrazioni:** API URL-based per Google Maps, Waze e WhatsApp.

---

## ✨ Funzionalità Core

### 1. Sistema di Accesso Protette (Auth)
Interfaccia di login dedicata con gestione sicura delle sessioni. Reindirizzamento automatico e blocco delle rotte non autorizzate tramite "Middleware" client-side.

### 2. Dashboard Calendario & LED di Stato
*   Visualizzazione mensile con badge numerici dinamici per il carico di lavoro.
*   **Smart Highlighting:** Giorno corrente evidenziato, festivi e prefestivi cromaticamente differenziati.
*   **Network LED:** Un indicatore visivo in tempo reale (Verde/Rosso/Blu) che mostra se l'utente è Online, Offline o in fase di Sincronizzazione.

### 3. Anagrafica Medici (Smart Card System)
Sistema di monitoraggio visivo guidato dal database (Vista SQL ottimizzata):
*   🔵 **Nuovo Medico:** Mai visitato.
*   🟢 **In Target:** Visitato da meno di 15 giorni.
*   🟡 **Warning:** Visita necessaria (15-29 giorni).
*   🔴 **Urgente:** Fuori target (>= 30 giorni).
*   Metriche precise: Giorni esatti dall'ultima visita e anteprima dell'ultima nota clinica/commerciale.

### 4. Gestione Giornaliera Dual-Tab (Scheduled vs Walk-in)
*   **Scheduled:** Appuntamenti fissati con orario preciso.
*   **Liberi (Walk-in):** Gestione avanzata multi-fascia. Il sistema mostra solo i medici disponibili per il giorno corrente e supporta la "promozione a visita" istantanea.

### 5. Gestione Attività (Task System)
*   To-Do List integrata per chiamate, richieste appuntamenti o task amministrativi.
*   Collegamento dinamico ai medici in anagrafica e sistema di priorità cromatico (Bassa/Media/Alta).

### 6. Briefing Giornaliero (Daily Report)
Una schermata dedicata (`dayReport.html`) accessibile ogni mattina tramite notifica, che riassume il percorso della giornata e le statistiche delle visite programmate con una timeline cronologica.

---

## 📶 Tecnologia Offline-First (Outbox Pattern)
ISFplan è progettata per il territorio. Grazie al modulo `offlineManager.js`:
1.  **Persistenza Locale:** I dati vengono salvati in **IndexedDB** per la consultazione senza rete.
2.  **Sync Queue:** Ogni azione (inserimento, nota, modifica) eseguita offline viene messa in coda.
3.  **Sincronizzazione Automatica:** Al ritorno della connessione, il Service Worker svuota la coda verso Supabase in ordine cronologico, garantendo l'integrità dei dati.
4.  **Notifiche Push Locali:** Avvisi automatici 15 minuti prima di una visita e briefing mattutino alle 07:00.

---

## 🏗️ Setup e Installazione

### 1. Configurazione Database (Supabase SQL Editor)
La struttura completa del database è definita nel file [`schema.sql`](./schema.sql).
1. Accedi a [Supabase](https://supabase.com/).
2. Vai nella sezione **SQL Editor**.
3. Incolla il contenuto di `schema.sql`.
4. **Importante:** Sostituisci `'YOUR_ADMIN_UID_HERE'` con il tuo UUID (sezione Authentication) per abilitare la God Mode.
5. Esegui lo script per generare Tabelle, RLS e la Vista `medici_con_stato_visite`.

### 2. Configurazione Frontend
Crea un file `config.js` nella root:
```javascript
const CONFIG = {
    SUPABASE_URL: 'https://tuo-progetto.supabase.co',
    SUPABASE_KEY: 'tua-chiave-anon-key'
};
```

### 3. Avvio Locale
Usa un server locale (es. **Live Server** per VS Code) per supportare i Moduli JS e i Service Worker.

---

## 📂 Struttura del Progetto
```text
agendaOverpoweredISF/
┣ icon/                  # Loghi e icone PWA
┣ auth.js                # Login e gestione sessioni
┣ config.js              # Credenziali API (GitIgnored)
┣ script.js              # Motore Core e logica SPA
┣ scriptProFeatures.js   # Funzioni avanzate (Jump to date, sync)
┣ offlineManager.js      # Gestione IndexedDB e Outbox Queue
┣ notificationManager.js # Motore notifiche push locali
┣ dayReportManager.js    # Logica per il briefing quotidiano
┣ pwaManager.js          # Registrazione e update SW
┣ sw.js                  # Service Worker (Network-First Cache)
┣ featuresDebug.js       # Strumenti di test per sviluppatori
┣ index.html             # Dashboard Principale
┣ login.html             # Portale Accesso
┣ dayReport.html         # Cruscotto di riepilogo
┣ modals.html            # Componenti UI caricati on-demand
┣ style.css              # Design System core
┣ styleProFeatures.css   # Stili specifici per moduli Premium
┣ manifest.json          # Configurazione installazione PWA
┗ schema.sql             # Definizione Database PostgreSQL
```

---

## 💡 Nota dell'Autore
Questo software è nato con un duplice obiettivo:
1.  **Sfida Tecnica:** Architettare una SPA Full-Stack professionale, con architettura PWA e logiche database relazionali, utilizzando JavaScript puro senza affidarsi a framework massicci come React.
2.  **Supporto Personale:** Risolvere concretamente i problemi logistici e di pianificazione della mia migliore amica, automatizzando la sua complessa attività di ISF.

Sebbene l'interfaccia sia di stampo commerciale, l'app rimane un progetto didattico creato con dedizione e scopo sociale.

---

## 📜 Licenza e Termini d'Uso
Il codice è condiviso esclusivamente per scopi di studio e consultazione.
*   ✅ **Consentito:** Uso personale non commerciale, analisi del codice, fork per scopi didattici.
*   ❌ **Vietato:** Commercializzazione, rivendita del software "as-is" o utilizzo del brand "ISFplan / Agenda Overpowered" per fini di lucro.

---
*Creato con tanto ☕ e dedizione per l'efficienza sul campo.*
