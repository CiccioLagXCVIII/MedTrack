const CONFIG = {
    SUPABASE_URL: 'LA_TUA_URL',
    SUPABASE_KEY: 'LA_TUA_KEY',
};

const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);