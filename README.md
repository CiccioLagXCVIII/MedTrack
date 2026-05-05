# 📅 ISFplan: Agenda Overpowered per ISF
### *SaaS-Style Progressive Web App (PWA) per Informatori Scientifici del Farmaco*

![ISFplan Banner](icon/ISFplanBanner.png)

<div align="center">

![Versione](https://img.shields.io/badge/Versione-1.6-blue)
![Stato](https://img.shields.io/badge/Stato-Production--Ready-success)
![PWA](https://img.shields.io/badge/PWA-Installable-purple)
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

---

## 🔐 Accesso e Utilizzo dell'App (Whitelist)
Per garantire la massima sicurezza e la corretta compartimentazione dei dati nel database, **la registrazione libera all'applicazione è momentaneamente disabilitata**. Il sistema di login è gestito in un ambiente chiuso e protetto tramite Supabase Auth.

Se sei un Informatore Scientifico, un collega o un utente interessato a utilizzare ISFplan per il tuo lavoro:
👉 **Devi essere aggiunto manualmente alla Whitelist.**

📧 **Come richiedere l'accesso:**
Scrivimi un'email all'indirizzo **francescoloverde05@gmail.com** specificando che vorresti provare ISFplan. Provvederò personalmente a creare il tuo account sicuro e a inviarti le credenziali di accesso per iniziare a usare la piattaforma.

---

## 🛠️ Architettura Tecnica
*   **Frontend PWA:** HTML5, CSS3 (Variabili CSS, Flexbox/Grid), JavaScript Moderno (ES6+ Vanilla). Nessun framework pesante.
*   **UI/UX:** Bootstrap 5 (solo griglia e utility), [Lucide Icons](https://lucide.dev/), Modali caricati dinamicamente via `fetch` per un DOM pulito.
*   **Gestione Date:** [Day.js](https://day.js.org/) (Localizzazione IT) per calcoli temporali complessi.
*   **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL). Utilizzo avanzato di **Viste SQL (Views)** per demandare il calcolo delle date al database, azzerando i lag sul client.
*   **Sicurezza:** Autenticazione Supabase Auth e **Row Level Security (RLS)** su tabelle e viste.
*   **Offline-First:** Service Worker (`sw.js`) per caching delle risorse e `IndexedDB` (`offlineManager.js`) per gestire le code di sincronizzazione (Outbox Pattern).

---

## ✨ Funzionalità Core

### 1. Sistema di Accesso Protette (Auth)
Interfaccia di login dedicata con gestione sicura delle sessioni. Reindirizzamento automatico e blocco delle rotte non autorizzate tramite "Middleware" client-side.

### 2. Dashboard Calendario
*   Visualizzazione mensile con badge numerici dinamici per il carico di lavoro.
*   **Smart Highlighting:** Giorno corrente evidenziato, festivi e prefestivi cromaticamente differenziati.

### 3. Anagrafica Medici (Smart Card System)
Sistema di monitoraggio visivo guidato dal database (Vista SQL ottimizzata):
*   🔵 **Nuovo Medico:** Mai visitato.
*   🟢 **In Target:** Visitato da meno di 15 giorni.
*   🟡 **Warning:** Visita necessaria (15-29 giorni).
*   🔴 **Urgente:** Fuori target (>= 30 giorni).
*   Filtri live per ricerca testuale, specializzazione, città e stato visita.

### 4. Gestione Giornaliera Dual-Tab
Flusso di lavoro diviso in due modalità:
*   **Scheduled:** Appuntamenti prefissati con orario esatto.
*   **Liberi (Walk-in):** Coda intelligente che mostra *solo* i medici che ricevono senza appuntamento nel giorno corrente della settimana e che non sono ancora stati visitati oggi.

### 5. Gestione Attività (Task System)
*   To-Do List integrata per segnare chiamate, appuntamenti da prendere o attività burocratiche.
*   Possibilità di collegare un Task a un medico specifico dall'anagrafica.
*   Sistema di priorità visivo e filtraggio rapido (Da Fare, Completati, Relativi a Medici, Generici).

### 6. Modalità Offline-First Intelligente
*   L'app non si blocca se manca la connessione (es. dentro ospedali o ambulatori schermati).
*   Le modifiche, le nuove visite e i task creati senza rete vengono salvati nella memoria del dispositivo.
*   Un **LED indicatore** segnala lo stato della rete e sincronizza tutto automaticamente con il server Supabase non appena il telefono torna online.

---

## 🏗️ Setup e Installazione

### 1. Configurazione Database (Supabase SQL Editor)
La struttura completa del database è definita nel file [`schema.sql`](./schema.sql) presente nella root del progetto. 

Per configurare il tuo ambiente su Supabase:
1. Accedi alla tua Dashboard di [Supabase](https://supabase.com/).
2. Vai nella sezione **SQL Editor** dal menu laterale.
3. Copia l'intero contenuto del file `schema.sql` e incollalo nell'editor.
4. **Importante:** Prima di eseguire, cerca nello script la riga relativa alla `God Mode` (Policy Developer) e sostituisci `'IL_TUO_USER_ID_AUTH'` con il tuo **UUID personale** (lo trovi in *Authentication > Users* nella tua dashboard).
5. Clicca su **Run** per creare tabelle, relazioni, la Vista ottimizzata e le policy di sicurezza RLS.

### 2. Configurazione Frontend (Protezione API)
Per connettere l'app al database:
1. Crea un file chiamato `config.js` nella root del progetto.
2. Inserisci le tue credenziali Supabase:
   ```javascript
   const CONFIG = {
       SUPABASE_URL: 'https://tuo-progetto.supabase.co',
       SUPABASE_KEY: 'tua-chiave-anon-key'
   };
   ```

### 3. Avvio e Sviluppo
*   **Server Locale:** Poiché l'app utilizza moduli ES, Service Worker e `fetch` dinamico, è necessario utilizzare un server locale. Se usi VS Code, l'estensione **Live Server** è la scelta raccomandata.
*   **Offline Support:** Il Service Worker (`sw.js`) si occuperà di cacheare le risorse statiche. Per testare l'offline, usa il pannello "Network > Throttling > Offline" negli strumenti sviluppatore del browser.

---

## 📂 Struttura Cartelle
```text
agendaOverpoweredISF/
┣ icon/             # Asset grafici e icone
┣ config.js         # Credenziali API
┣ auth.js           # Logica di autenticazione
┣ script.js         # Core business logic
┣ sw.js             # Service Worker (Caching)
┣ offlineManager.js # Logica IndexedDB / Sync Queue
┣ pwaManager.js     # Gestione update PWA
┣ manifest.json     # Manifest per installazione app
┣ index.html        # SPA Main Dashboard
┣ login.html        # Pagina di autenticazione
┣ modals.html       # Finestre modali caricate dinamicamente
┣ style.css         # SaaS-style Design
┗ schema.sql        # Setup Database PostgreSQL
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
*Creato con tanto ☕ da una necessità reale.*