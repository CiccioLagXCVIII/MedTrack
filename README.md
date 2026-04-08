# 📅 MedTrack: Agenda Overpowered per ISF
### *SaaS-Style Progressive Web App (PWA) per Informatori Scientifici del Farmaco*

![Versione](https://img.shields.io/badge/Versione-1.0_SaaS-blue)
![Stato](https://img.shields.io/badge/Stato-Production--Ready-success)
![PWA](https://img.shields.io/badge/PWA-Installable-purple)
![Stack](https://img.shields.io/badge/Stack-Vanilla_JS--Supabase--PostgreSQL-orange)

**MedTrack (Agenda Overpowered)** è una soluzione digitale avanzata progettata specificamente per centralizzare la gestione dei medici, pianificare le visite e monitorare i target di contatto. Strutturata come una SPA (Single Page Application) e configurata come **PWA (Progressive Web App)**, offre l'esperienza fluida di un software SaaS professionale, ottimizzata per l'uso nativo su smartphone (iOS/Android) e supportata da un solido backend relazionale.

---

## 🚀 Visione Generale
Il progetto risolve le sfide logistiche quotidiane di un **Informatore Scientifico del Farmaco (ISF)** attraverso:
*   **Pianificazione Intelligente:** Calendario dinamico mensile e viste giornaliere divise per tipologia di attività (su appuntamento o liberi/walk-in).
*   **Monitoraggio Target (Color Coding):** Calcolo automatico dei giorni trascorsi dall'ultima visita con alert cromatici immediati (Verde/Giallo/Rosso/Blu).
*   **Logistica One-Click:** Scelta rapida tra navigazione via Google Maps o Waze e pulsanti per chiamate/WhatsApp diretti.
*   **Gestione Multi-Utente Sicura:** Sistema di login e compartimentazione dei dati. Nessun ISF può vedere i dati di un altro collega.

---

## 🛠️ Architettura Tecnica
*   **Frontend PWA:** HTML5, CSS3 (Variabili CSS, Flexbox/Grid), JavaScript Moderno (ES6+ Vanilla). Nessun framework pesante.
*   **UI/UX:** Bootstrap 5 (solo griglia e utility), [Lucide Icons](https://lucide.dev/), Modali caricati dinamicamente via `fetch` per un DOM pulito.
*   **Gestione Date:** [Day.js](https://day.js.org/) (Localizzazione IT) per calcoli temporali complessi.
*   **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL). Utilizzo avanzato di **Viste SQL (Views)** per demandare il calcolo delle date al database, azzerando i lag sul client.
*   **Sicurezza:** Autenticazione Supabase Auth e **Row Level Security (RLS)** su tabelle e viste.

---

## ✨ Funzionalità Core

### 1. Sistema di Accesso Protette (Auth)
Interfaccia di login dedicata con gestione sicura delle sessioni. Reindirizzamento automatico e blocco delle rotte non autorizzate.

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

> 💡 **Nota:** Lo script è progettato per essere idempotente; assicuratevi che il database sia vuoto o che non esistano conflitti di nome prima dell'esecuzione se state migrando da una versione precedente.

### 2. Configurazione Frontend (Protezione API)
Per connettere l'app al database:
1. Crea un file chiamato `config.js` nella root del progetto.
2. Inserisci le tue credenziali Supabase (usa la chiave pubblica `anon`):
   ```javascript
   const CONFIG = {
       SUPABASE_URL: 'https://tuo-progetto.supabase.co',
       SUPABASE_KEY: 'tua-chiave-anon-key'
   };
   ```
3. Assicurati che il file `config.js` sia inserito nel tuo `.gitignore`.

### 3. Avvio Locale
Poiché l'app utilizza ES Modules, `fetch()` per caricare i modali e un Service Worker per la PWA, **non puoi aprirla semplicemente facendo doppio click sul file `index.html`**. 
Devi servirla tramite un server HTTP locale (es. l'estensione *Live Server* su VS Code o Node `http-server`).

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
*   ❌ **Vietato:** Commercializzazione, rivendita del software "as-is" o utilizzo del brand "MedTrack / Agenda Overpowered" per fini di lucro.

---
*Creato con ☕ e WSL da un'idea di automazione reale.*
