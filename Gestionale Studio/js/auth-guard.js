// js/auth-guard.js (VERSIONE CORRETTA E MODIFICATA per includere il NOME)

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

        // --- MODIFICA INIZIA QUI ---
        // Ora controlliamo il suo ruolo E IL SUO NOME nel database
        try {
            // 1. Definiamo i riferimenti
            const userRef = ref(database, 'users/' + user.uid); // Per il ruolo
            const memberRef = ref(database, 'members/' + user.uid); // Per il nome

            // 2. Chiamiamo entrambi in parallelo per efficienza
            const [userSnapshot, memberSnapshot] = await Promise.all([
                get(userRef),
                get(memberRef)
            ]);

            // 3. Elaboriamo il ruolo (da /users)
            if (userSnapshot.exists()) {
                currentUser.role = userSnapshot.val().role || 'user';
            } else {
                currentUser.role = 'user';
            }
            
            // 4. Elaboriamo il nome (da /members)
            if (memberSnapshot.exists() && memberSnapshot.val().name) {
                // Trovato! Aggiungilo all'oggetto
                currentUser.name = memberSnapshot.val().name;
            } else {
                // Fallback se l'utente non è in /members o non ha un nome
                currentUser.name = user.email; // Usiamo l'email come nome di riserva
                console.warn(`Nome non trovato per l'utente ${user.uid} in /members. Uso l'email come fallback.`);
            }
            // --- MODIFICA FINISCE QUI ---

        } catch (error) {
            console.error("Errore nel recuperare i dati dell'utente (ruolo/nome):", error);
            currentUser.role = 'user'; // Imposta un ruolo di fallback
            currentUser.name = user.email; // Imposta un nome di fallback
        }

        console.log(`Accesso effettuato come: ${currentUser.name} (Ruolo: ${currentUser.role})`);

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
