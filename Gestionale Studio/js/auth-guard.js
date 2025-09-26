// js/auth-guard.js

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { auth, database } from './firebase-config.js';

export let currentUser = {
    uid: null, email: null, displayName: null, role: 'user'
};

let authReadyFired = false;

onAuthStateChanged(auth, async (user) => {
    const logoutBtn = document.getElementById('logout-btn');
    const adminPanelLink = document.getElementById('admin-panel-link');

    // Associa l'evento di logout subito, se il pulsante esiste
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
        });
    }

    if (!user) {
        // Se non c'è utente e NON siamo sulla pagina di login, allora reindirizza.
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
        return; // Interrompe l'esecuzione se non c'è utente
    }
    
    // Se l'utente è loggato, procediamo
    currentUser.uid = user.uid;
    currentUser.email = user.email;
    currentUser.displayName = user.displayName || user.email.split('@')[0];

    const userRef = ref(database, 'users/' + user.uid);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        currentUser.role = snapshot.val().role || 'user';
        currentUser.displayName = snapshot.val().displayName || currentUser.displayName;
    } else {
        currentUser.role = 'user';
    }
    
    console.log(`Accesso effettuato come: ${currentUser.email} (Ruolo: ${currentUser.role})`);
    
    if (adminPanelLink) {
        if (currentUser.role === 'admin' || currentUser.role === 'calendar_admin') {
            adminPanelLink.classList.remove('hidden');
        } else {
            adminPanelLink.classList.add('hidden');
        }
    }
    
    // Invia il segnale che l'autenticazione è pronta, una sola volta
    if (!authReadyFired) {
        authReadyFired = true;
        document.dispatchEvent(new CustomEvent('authReady', { detail: { user: currentUser } }));
    }
});
