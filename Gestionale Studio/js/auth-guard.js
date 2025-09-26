// js/auth-guard.js

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
// Importa le istanze centralizzate di auth e database
import { auth, database } from './firebase-config.js';

const logoutBtn = document.getElementById('logout-btn');
const adminPanelLink = document.getElementById('admin-panel-link');

export let currentUser = {
    uid: null,
    email: null,
    displayName: null,
    role: 'user' // Ruolo di default
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Se non c'è utente, torna al login
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    } else {
        // Se c'è un utente loggato, popoliamo il nostro oggetto currentUser
        currentUser.uid = user.uid;
        currentUser.email = user.email;
        currentUser.displayName = user.displayName || user.email.split('@')[0];

        // Ora controlliamo il suo ruolo nel database
        const userRef = ref(database, 'users/' + user.uid);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            currentUser.role = snapshot.val().role || 'user';
            // Aggiorniamo anche il displayName se presente nel DB
            currentUser.displayName = snapshot.val().displayName || currentUser.displayName;
        } else {
            currentUser.role = 'user'; // Se non ha un ruolo definito, è un utente normale
        }
        
        console.log(`Accesso effettuato come: ${currentUser.email} (Ruolo: ${currentUser.role})`);
        
        // Mostra il link al pannello admin solo se si ha un ruolo speciale
        if (adminPanelLink) {
            if (currentUser.role === 'admin' || currentUser.role === 'calendar_admin') {
                adminPanelLink.classList.remove('hidden');
            } else {
                adminPanelLink.classList.add('hidden');
            }
        }

        // --- MODIFICA CHIAVE ---
        // Invia un evento per notificare alle altre parti dell'app che l'autenticazione è completa
        document.dispatchEvent(new CustomEvent('authReady', { detail: { user: currentUser } }));
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
    });
}
