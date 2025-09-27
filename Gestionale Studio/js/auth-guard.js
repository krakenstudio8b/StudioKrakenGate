// js/auth-guard.js (VERSIONE CORRETTA)

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
// Importa le istanze di auth e database GIA' INIZIALIZZATE dal tuo file di configurazione
import { auth, database } from './firebase-config.js';

const logoutBtn = document.getElementById('logout-btn');
const adminPanelLink = document.getElementById('admin-panel-link');

// Esportiamo un oggetto mutabile per i dettagli dell'utente
export let currentUser = {};

// Logica per attendere che l'autenticazione sia completa
let authReadyFired = false;
onAuthStateChanged(auth, async (user) => {
    if (authReadyFired) return; // Evita esecuzioni multiple

    if (!user) {
        // Se non c'è utente, torna al login
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        // Se c'è un utente loggato, popoliamo il nostro oggetto currentUser
        currentUser.uid = user.uid;
        currentUser.email = user.email;

        // Ora controlliamo il suo ruolo nel database
        try {
            const userRef = ref(database, 'users/' + user.uid);
            const snapshot = await get(userRef);

            if (snapshot.exists()) {
                currentUser.role = snapshot.val().role || 'user';
            } else {
                currentUser.role = 'user';
            }
        } catch (error) {
            console.error("Errore nel recuperare il ruolo dell'utente:", error);
            currentUser.role = 'user'; // Imposta un ruolo di fallback in caso di errore
        }

        console.log(`Accesso effettuato come: ${currentUser.email} (Ruolo: ${currentUser.role})`);

        // Mostra il link al pannello admin se l'utente ha i permessi
        if (adminPanelLink) {
            if (currentUser.role === 'admin' || currentUser.role === 'calendar_admin') {
                adminPanelLink.classList.remove('hidden');
            } else {
                adminPanelLink.classList.add('hidden');
            }
        }
    }

    // A prescindere dall'esito, l'autenticazione è "pronta".
    // Lancia un evento globale per avvisare gli altri script che possono partire.
    authReadyFired = true;
    document.dispatchEvent(new CustomEvent('authReady'));
});

// Listener per il bottone di logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
    });
}
