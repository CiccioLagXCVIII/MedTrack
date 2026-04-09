-- AA Pulizia Preliminare
DROP VIEW IF EXISTS medici_con_stato_visite;
DROP TABLE IF EXISTS visite;
DROP TABLE IF EXISTS medici;

-- AA Tabella Medici
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

-- AA Tabella Visite
CREATE TABLE visite (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid(),
  medico_id uuid REFERENCES medici(id) ON DELETE CASCADE,
  data_visita DATE NOT NULL,
  ora_visita TIME NOT NULL,
  note TEXT,
  is_walkin_done BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- AA Configurazione RLS
ALTER TABLE medici ENABLE ROW LEVEL SECURITY;
ALTER TABLE visite ENABLE ROW LEVEL SECURITY;

-- AA Policies
CREATE POLICY "L'Utente Vede I Propri Dati" ON medici FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "L'Utente Vede Le Proprie Visite" ON visite FOR ALL USING (auth.uid() = user_id);

-- BB Sostituisci IL_TUO_USER_ID_AUTH con il tuo UUID
CREATE POLICY "Developer God Mode Medici" ON medici FOR ALL USING (auth.uid() = 'IL_TUO_USER_ID_AUTH');
CREATE POLICY "Developer God Mode Visite" ON visite FOR ALL USING (auth.uid() = 'IL_TUO_USER_ID_AUTH');

-- AA Creazione Vista Per Anagrafica Medici Con Stato Visite
CREATE VIEW medici_con_stato_visite AS
SELECT 
    m.id, m.nome, m.citta, m.indirizzo, m.cellulare, 
    m.specializzazione, m.giorni_liberi, m.user_id, 
    (SELECT v.data_visita FROM visite v WHERE v.medico_id = m.id AND v.data_visita <= CURRENT_DATE ORDER BY v.data_visita DESC LIMIT 1) as ultima_visita_passata,
    (SELECT v.data_visita FROM visite v WHERE v.medico_id = m.id AND v.data_visita > CURRENT_DATE ORDER BY v.data_visita ASC LIMIT 1) as prossima_visita_futura,
    (SELECT v.note FROM visite v WHERE v.medico_id = m.id ORDER BY v.data_visita DESC LIMIT 1) as nota_ultima_visita
FROM medici m;

ALTER VIEW medici_con_stato_visite SET (security_invoker = on);

-- AA Aggiunta Campo Task
CREATE TABLE tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid DEFAULT auth.uid(),
  titolo TEXT NOT NULL,
  descrizione TEXT,
  priorita INTEGER DEFAULT 1, -- 1 Bassa, 2 Media, 3 Alta
  scadenza DATE,
  medico_id uuid REFERENCES medici(id) ON DELETE SET NULL, -- Link al medico
  completato BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User Access Tasks" ON tasks FOR ALL USING (auth.uid() = user_id);