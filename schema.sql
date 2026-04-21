
-- AA PULIZIA E PREPARAZIONE AMBIENTE
-- BB Rimozione Strutture Esistenti
-- DD Questo Blocco Assicura Che Non CI Siano Conflitti Con Configurazioni Precedenti, Rimuovendo Tabelle E Viste
DROP VIEW IF EXISTS medici_con_stato_visite;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS visite;
DROP TABLE IF EXISTS medici;

-- AA DEFINIZIONE STRUTTURA DATI (TABELLE)
-- BB Tabella Medici
-- DD Archivia L'Anagrafica Completa, I Recapiti E La Logica Dei Giorni Di Ricevimento (Giorni_liberi)
CREATE TABLE medici (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  citta TEXT,
  indirizzo TEXT,
  cellulare TEXT,
  specializzazione TEXT,
  giorni_liberi TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- BB Tabella Visite
-- DD Gestisce Lo Storico Delle Visite E La Pianificazione Futura. Include Note E Flag Per I Walk-in
CREATE TABLE visite (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid(),
  medico_id uuid REFERENCES medici(id) ON DELETE CASCADE,
  data_visita DATE NOT NULL,
  ora_visita TIME NOT NULL,
  is_walkin_done BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- BB Tabella Tasks
-- DD Sistema Di Gestione Attività (Chiamate, Appuntamenti O Task Generici) Con Priorità E Scadenze
CREATE TABLE tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid(),
  titolo TEXT NOT NULL,
  descrizione TEXT,
  priorita INTEGER DEFAULT 1,
  scadenza DATE,
  medico_id uuid REFERENCES medici(id) ON DELETE SET NULL,
  completato BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- AA SICUREZZA E ROW LEVEL SECURITY (RLS)
-- BB Attivazione RLS
-- DD  Protegge I Dati A Livello Di Riga, Impedendo Che Un Utente Possa Vedere I Dati Di UN Altro
ALTER TABLE medici ENABLE ROW LEVEL SECURITY;
ALTER TABLE visite ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- BB Policy Di Accesso Standard (User Access)
-- DD Permette A Ogni Utente Autenticato Di Gestire Esclusivamente I Propri Record
CREATE POLICY "User Access Medici" ON medici FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User Access Visite" ON visite FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User Access Tasks" ON tasks FOR ALL USING (auth.uid() = user_id);

-- BB Policy Amministrative (God Mode)
-- DD Accesso Totale Per Scopi Di Debug O Amministrazione Tramite Uid Specifico. Sostituire 'YOUR_ADMIN_UID_HERE'
CREATE POLICY "Admin God Mode Medici" ON medici FOR ALL USING (auth.uid() = 'YOUR_ADMIN_UID_HERE');
CREATE POLICY "Admin God Mode Visite" ON visite FOR ALL USING (auth.uid() = 'YOUR_ADMIN_UID_HERE');
CREATE POLICY "Admin God Mode Tasks" ON tasks FOR ALL USING (auth.uid() = 'YOUR_ADMIN_UID_HERE');

-- AA LOGICA APPLICATIVA AVANZATA (VIEWS)
-- BB Vista Medici con Stato Visite
-- DD Vista Calcolata Per Fornire Al Frontend L'ultima Visita Effettuata, La Prossima Programmata E L'ultima Nota Inserita Senza Query Multiple
CREATE VIEW medici_con_stato_visite AS
SELECT 
    m.id,
    m.nome,
    m.citta,
    m.indirizzo,
    m.cellulare,
    m.specializzazione,
    m.giorni_liberi,
    m.user_id, 
    (SELECT v.data_visita FROM visite v WHERE v.medico_id = m.id AND v.data_visita <= CURRENT_DATE ORDER BY v.data_visita DESC LIMIT 1) as ultima_visita_passata,
    (SELECT v.data_visita FROM visite v WHERE v.medico_id = m.id AND v.data_visita > CURRENT_DATE ORDER BY v.data_visita ASC LIMIT 1) as prossima_visita_futura,
    (SELECT v.note FROM visite v WHERE v.medico_id = m.id ORDER BY v.data_visita DESC LIMIT 1) as nota_ultima_visita
FROM medici m;

-- CC Sicurezza Della Vista
-- DD Applica Il Contesto Dell'utente Loggato Anche Alla Vista Dinamica
ALTER VIEW medici_con_stato_visite SET (security_invoker = on);

-- AA PROCEDURE DI MANUTENZIONE E PULIZIA (OPZIONALE)
-- BB Normalizzazione Stringhe e Sigle
-- DD Funzione Di Utilità Per Correggere Il Formato Del Testo (Title Case) E Forzare Le Sigle Maiuscole (es. MMG, ASL)
-- CC Formattazione Medici
UPDATE medici
SET 
  nome = REPLACE(REPLACE(REPLACE(REPLACE(INITCAP(nome), 'Mmg', 'MMG'), 'Asl', 'ASL'), 'Pes', 'PES'), 'Isf', 'ISF'),
  citta = REPLACE(REPLACE(REPLACE(REPLACE(INITCAP(citta), 'Mmg', 'MMG'), 'Asl', 'ASL'), 'Pes', 'PES'), 'Isf', 'ISF'),
  indirizzo = REPLACE(REPLACE(REPLACE(REPLACE(INITCAP(indirizzo), 'Mmg', 'MMG'), 'Asl', 'ASL'), 'Pes', 'PES'), 'Isf', 'ISF'),
  specializzazione = REPLACE(REPLACE(REPLACE(REPLACE(INITCAP(specializzazione), 'Mmg', 'MMG'), 'Asl', 'ASL'), 'Pes', 'PES'), 'Isf', 'ISF');

-- CC Formattazione Tasks
UPDATE tasks
SET 
  titolo = REPLACE(REPLACE(REPLACE(REPLACE(INITCAP(titolo), 'Mmg', 'MMG'), 'Asl', 'ASL'), 'Pes', 'PES'), 'Isf', 'ISF'),
  descrizione = REPLACE(REPLACE(REPLACE(REPLACE(INITCAP(descrizione), 'Mmg', 'MMG'), 'Asl', 'ASL'), 'Pes', 'PES'), 'Isf', 'ISF');