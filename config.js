const CONFIG = {
    SUPABASE_URL: 'LA_TUA_URL',
    SUPABASE_KEY: 'LA_TUA_KEY',

    // ID Dell'Admin Per La Dev Mode
    ADMIN_UID: 'INCOLLA-QUI-IL-TUO-UID',

    // Mappatura ID -> Nome
    // Se Un ID Non Si Trova Qui, L'App Scriverà "Sconosciuto"
    TEAM_NAMES: {
        'INCOLLA-QUI-IL-TUO-UID': 'Admin',
        'INCOLLA-QUI-L-ID-DEL-COLLEGA-1': 'Marco',
        'INCOLLA-QUI-L-ID-DEL-COLLEGA-2': 'Giulia'
    }
};

const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);