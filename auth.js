/* ==========================================================================
   AA 1: UTILITY E INIZIALIZZAZIONE INTERFACCIA (UI)
   ========================================================================== */

// BB: Gestione Icone (Libreria Lucide)
function refreshIcons() {
    // CC: Verifica esistenza libreria prima dell'esecuzione
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// BB: Inizializzazione Listener al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {

    // CC: Rendering iniziale delle icone
    lucide.createIcons();

    // CC: Logica per il Toggle della Password (Mostra/Nascondi)
    const toggleBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('login-password');

    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', function () {
            // DD: Determiniamo il nuovo stato basandoci sul tipo attuale dell'input.
            // Questa logica evita di mantenere una variabile di stato esterna booleana.
            const isPassword = passwordInput.type === 'password';

            // DD: Cambiamo il tipo di input per mostrare/nascondere i caratteri.
            passwordInput.type = isPassword ? 'text' : 'password';

            // DD: Sostituiamo dinamicamente l'icona aggiornando l'attributo data-lucide.
            // DD È fondamentale chiamare lucide.createIcons() subito dopo per trasformare 
            // DD il nuovo tag <i> nel corrispondente SVG.
            const newIconName = isPassword ? 'eye-off' : 'eye';
            this.innerHTML = `<i data-lucide="${newIconName}"></i>`;

            lucide.createIcons();
        });
    }
});


/* ==========================================================================
   AA 2: LOGICA DI AUTENTICAZIONE (SUPABASE AUTH)
   ========================================================================== */

// BB: Funzioni Core di Accesso
// CC: Gestore del Login (handleLogin)
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');
    const btnText = btn.querySelector('.btn-text');

    // CC: Reset UI e feedback di caricamento
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.classList.add('btn-loading-modern');

    try {
        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        // DD: Usiamo window.location.replace invece di .href per la redirezione post-login.
        // DD Questo impedisce all'utente di tornare alla pagina di login usando il tasto "Indietro" 
        // DD del browser, sovrascrivendo la cronologia corrente.
        setTimeout(() => {
            window.location.replace('index.html');
        }, 500);

    } catch (error) {
        errorEl.innerText = "Accesso Negato. Controlla Credenziali.";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.classList.remove('btn-loading-modern');
    }
}

// CC: Gestore del Logout (handleLogout)
async function handleLogout() {
    try {
        await sb.auth.signOut();
        window.location.replace('login.html');
    } catch (error) {
        console.error("Errore logout:", error);
    }
}

// BB: Gestione Sessione e Protezione Rotte
// CC: Controllo Sessione Esistente (checkSession)
async function checkSession() {
    const { data: { session }, error } = await sb.auth.getSession();

    // DD: Questa funzione funge da "Middleware" lato client. Se la sessione è nulla
    // DD e l'utente non si trova già sulla pagina di login, forziamo il redirect.
    // DD Inserire questo controllo all'avvio di ogni pagina protetta.
    if (error || !session) {
        if (!window.location.pathname.includes('login.html')) {
            window.location.replace('login.html');
        }
        return null;
    }
    return session;
}


/* ==========================================================================
   AA 3: AGGANCIO EVENTI (EVENT LISTENERS)
   ========================================================================== */

// BB: Listener Modulo di Login
var loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}