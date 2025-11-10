// js/auth-guard.js (VERSIONE COMPLETA E CORRETTA CON NUOVA LOGICA PERMESSI)

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { auth, database } from './firebase-config.js';

const logoutBtn = document.getElementById('logout-btn');
const adminPanelLink = document.getElementById('admin-panel-link');

export let currentUser = {};
let authReadyFired = false;

// --- NUOVA LOGICA PERMESSI ---
// Elenco delle pagine e i ruoli che NON possono vederle
const pagePermissions = {
    // Solo 'admin' può vedere le finanze
    'finanze.html': ['user', 'calendar_admin'], 
    
    // 'admin' e 'calendar_admin' possono vedere l'admin panel
    'admin.html': ['user'] 
};

function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split("/").pop();
    // Gestisce il caso in cui sei su "index.html" o sulla root "/"
    return page === '' ? 'index.html' : page;
}
// --- FINE NUOVA LOGICA ---


onAuthStateChanged(auth, async (user) => {
    if (authReadyFired) return; 
    const currentPage = getCurrentPage();

    if (!user) {
        // Utente NON LOGGATO
        // Se la pagina non è 'login.html', rimanda al login
        if (currentPage !== 'login.html') {
            window.location.href = 'login.html';
        }
    } else {
        // Utente LOGGATO
        currentUser.uid = user.uid;
        currentUser.email = user.email;

        try {
            // Recupera ruolo e nome in parallelo
            const userRef = ref(database, 'users/' + user.uid);
            const memberRef = ref(database, 'members/' + user.uid);

            const [userSnapshot, memberSnapshot] = await Promise.all([
                get(userRef),
                get(memberRef)
            ]);

            // Assegna ruolo (default 'user')
            if (userSnapshot.exists()) {
                currentUser.role = userSnapshot.val().role || 'user';
            } else {
                currentUser.role = 'user';
            }
            
            // Assegna nome (fallback a email)
            if (memberSnapshot.exists() && memberSnapshot.val().name) {
                currentUser.name = memberSnapshot.val().name;
            } else {
                currentUser.name = user.email; 
            }

            console.log(`Accesso effettuato come: ${currentUser.name} (Ruolo: ${currentUser.role})`);

            // --- NUOVO BLOCCO DI CONTROLLO PERMESSI ---
            const forbiddenRoles = pagePermissions[currentPage];
            if (forbiddenRoles && forbiddenRoles.includes(currentUser.role)) {
                // L'utente è su una pagina che non può vedere
                console.warn(`Accesso negato a ${currentPage} per ruolo: ${currentUser.role}`);
                alert("Non hai i permessi per visualizzare questa pagina.");
                window.location.href = 'index.html'; // Rimanda alla home
                return; // Interrompi l'esecuzione
            }
            // --- FINE BLOCCO CONTROLLO PERMESSI ---


            // Mostra il link al pannello admin (logica esistente)
            if (adminPanelLink) {
                if (currentUser.role === 'admin' || currentUser.role === 'calendar_admin') {
                    adminPanelLink.classList.remove('hidden');
                } else {
                    adminPanelLink.classList.add('hidden');
                }
            }
            
            // Se sei loggato e vai su login.html, ti rimanda alla home
            if (currentPage === 'login.html') {
                 window.location.href = 'index.html';
                 return;
            }

        } catch (error) {
            console.error("Errore nel recuperare i dati dell'utente (ruolo/nome):", error);
            // In caso di errore, esegui il logout per sicurezza
            signOut(auth);
            return;
        }
    }

    // Se tutti i controlli sono passati, spara l'evento
    authReadyFired = true;
    document.dispatchEvent(new CustomEvent('authReady'));
});

// Listener per il bottone di logout (logica esistente)
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
    });
}
