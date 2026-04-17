# 📅 MedTrack: Agenda Overpowered per ISF
### *SaaS-Style Progressive Web App (PWA) per Informatori Scientifici del Farmaco*

![MedTrack Banner](icon/medTrackBanner.png)

<div align="center">

![Versione](https://img.shields.io/badge/Versione-1.6-blue?style=for-the-badge)
![Stato](https://img.shields.io/badge/Stato-Production--Ready-success?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-Installable-purple?style=for-the-badge)
![Stack](https://img.shields.io/badge/Stack-Vanilla_JS--Supabase--PostgreSQL-orange?style=for-the-badge)

</div>

---

## 🚀 Visione del Progetto
**MedTrack (Agenda Overpowered)** è una Single Page Application (SPA) avanzata, concepita come una **PWA (Progressive Web App)** professionale. Nasce per centralizzare la gestione dei medici, ottimizzare i percorsi logistici e monitorare i target di visita in tempo reale. L'interfaccia, ispirata ai moderni software SaaS, garantisce un'esperienza fluida su iOS e Android, supportata da un potente motore relazionale PostgreSQL.

### I pilastri dell'app:
*   **Pianificazione Strategica:** Calendario mensile dinamico e gestione giornaliera ottimizzata per tipologia di visita (appuntamenti fissi vs liberi).
*   **Monitoraggio Intelligente (Color Coding):** Algoritmo proprietario che calcola i giorni trascorsi dall'ultimo contatto, fornendo alert visivi istantanei (Verde/Giallo/Rosso/Blu).
*   **Logistica One-Click:** Integrazione con Google Maps e Waze per navigazione millimetrica, oltre a shortcut per chiamate e WhatsApp.
*   **Privacy & Sicurezza:** Architettura multi-utente con compartimentazione dei dati tramite policy di sicurezza a livello di riga (RLS).

---

## 🔐 Accesso e Whitelist
Per garantire la massima sicurezza e la corretta separazione dei dati, **la registrazione libera è disabilitata**. L'accesso è limitato agli utenti autorizzati tramite Supabase Auth.

### 📧 Come richiedere l'accesso:
Se sei un Informatore Scientifico o un collega interessato a testare MedTrack:
1. Invia un'email a: **francescoloverde05@gmail.com**
2. Specifica la richiesta di accesso per MedTrack.
3. Riceverai le credenziali sicure per il tuo account personale nella Whitelist.

---

## ✨ Funzionalità Core

### 1. Dashboard & Calendario
*   **Visualizzazione Mensile:** Griglia dinamica con badge numerici per il carico di lavoro giornaliero.
*   **Smart Highlighting:** Identificazione immediata di "Oggi", weekend e festività.

### 2. Anagrafica Medici (Smart Card System)
Monitoraggio visivo basato su Viste SQL ottimizzate:
*   🔵 **Nuovo Medico:** Mai visitato.
*   🟢 **In Target:** Visitato < 15 giorni fa.
*   🟡 **Warning:** Visita necessaria (15-29 giorni).
*   🔴 **Urgente:** Fuori target (≥ 30 giorni).
*   **Filtri Avanzati:** Ricerca istantanea per nome, città, specializzazione e stato visita.

### 3. Gestione Giornaliera (Dual-Tab Flow)
*   **Tab Scheduled:** Lista cronologica degli appuntamenti fissati.
*   **Tab Liberi (Walk-in):** Coda dinamica che mostra solo i medici che ricevono senza appuntamento nel giorno corrente e che non sono ancora stati visitati.

### 4. Sistema Task & Promemoria
*   To-Do List integrata per chiamate, burocrazia e scadenze.
*   Possibilità di collegare direttamente ogni task a un medico in anagrafica.
*   Filtri per priorità e contesto (Amministrativo vs Medico).

### 5. Architettura Offline-First
*   **Resilienza:** L'app funziona perfettamente anche in zone d'ombra (ospedali, ambulatori interrati).
*   **Sincronizzazione:** Le modifiche vengono salvate in `IndexedDB` e inviate a Supabase non appena torna il segnale.
*   **Feedback:** Un LED di stato indica in tempo reale se sei Online, Offline o in fase di Sincronizzazione.

---

## 🛠️ Stack Tecnologico
*   **Frontend:** HTML5, CSS3 (Variabili e Grid/Flex), JavaScript ES6+ Vanilla (zero framework pesanti).
*   **UI/UX:** Bootstrap 5 (grid/utility), [Lucide Icons](https://lucide.dev/), Modali asincroni via `fetch`.
*   **Date Manager:** [Day.js](https://day.js.org/) con localizzazione italiana.
*   **Backend:** [Supabase](https://supabase.com/) (PostgreSQL) con uso intensivo di **Viste SQL** per performance elevate.
*   **PWA Logic:** Service Worker (`sw.js`) per caching e `offlineManager.js` (Outbox Pattern).

---

## 🏗️ Setup e Installazione

### 1. Database (Supabase)
La struttura è contenuta nel file [`schema.sql`](./schema.sql).
1. Copia il contenuto di `schema.sql` nell'SQL Editor di Supabase.
2. **Importante:** Sostituisci `'IL_TUO_USER_ID_AUTH'` con il tuo UUID personale (sezione *Authentication > Users*) per abilitare la God Mode del developer.
3. Esegui lo script.

### 2. Frontend & API
Crea un file `config.js` nella root del progetto:
```javascript
const CONFIG = {
    SUPABASE_URL: 'https://tuo-progetto.supabase.co',
    SUPABASE_KEY: 'tua-chiave-anon-key'
};
```

### 3. Sviluppo Locale
Utilizza un server locale (es. **Live Server** di VS Code) per supportare i Moduli ES e il Service Worker. Per testare l'offline, usa i DevTools del browser (pannello Network).

---

## 📂 Struttura del Progetto
```text
agendaOverpoweredISF/
┣ 📂 .vscode/               # Configurazione Ambiente Di Sviluppo
┣ 📂 icon/                  # Loghi E Icone
┣ 📄 .gitignore             # Lista File Da Escludere Dal Caricamento Su Git
┣ 🎨 style.css              # Foglio Di Stile Principale
┣ 🎨 styleProFeatures.css   # Foglio Di Stile Per Features Aggiuntive
┣ 📄 dayReport.html         # Pagina Per Il Report Giornaliero Automatico
┣ 📄 index.html             # Dashboard Principale Applicazione
┣ 📄 login.html             # Interfaccia Di Autenticazione
┣ 📄 modals.html            # Modals Caricati Dinamicamente
┣ 📜 auth.js                # Gestione Sessioni E Protezione Rotte
┣ 📜 config.js              # Credenziali E Configurazione API Supabase
┣ 📜 dayReportManager.js    # Logica Generazione Report Giornalieri
┣ 📜 notificationManager.js # Logica Gestione Notifiche
┣ 📜 offlineManager.js      # Logica IndexedDB E Sincronizzazione
┣ 📜 pwaManager.js          # Gestione Gestione Installazione E Aggiornamenti PWA
┣ 📜 scriptPro.js           # Logica Principale Dell'Applicazione
┣ ⚙️ sw.js                  # Service Worker Per Caching E Uso Offline
┣ 📱 manifest.json          # Configurazione Installazione Su Mobile
┣ 📘 README.md              # Documentazione Progetto
┣ ✅ toDo.md                # Tracciamento Cose Da Fare E Miglioramenti Futuri
┗ 🗄️ schema.sql             # Query Per Setup Del Database Supabase (PostgreSQL)
```

---

## 💡 Nota dell'Autore
Questo software è nato da una doppia motivazione:
1.  **Sfida Tecnica:** Dimostrare che è possibile creare una SPA Full-Stack professionale e resiliente (offline-ready) usando JavaScript puro.
2.  **Supporto Reale:** Automatizzare e semplificare la complessa attività di pianificazione della mia migliore amica nel suo lavoro quotidiano di ISF.

---

## 📜 Licenza e Termini
Il codice è condiviso per scopi di **studio e consultazione**.
*   ✅ **Sì:** Studio del codice, fork didattici, uso personale non commerciale.
*   ❌ **No:** Rivendita, commercializzazione o uso del brand "MedTrack" per scopi di lucro.

---
*Realizzato con tanto ☕ per rispondere a necessità lavorative concrete.*