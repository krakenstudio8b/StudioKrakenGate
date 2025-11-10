// js/auth-guard.js (VERSIONE DEFINITIVA - con link navbar nascosti)

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { auth, database } from './firebase-config.js';

// Riferimenti ai link della navbar
const logoutBtn = document.getElementById('logout-btn');
const adminPanelLink = document.getElementById('admin-panel-link');
const finanzeLink = document.querySelector('a[href="finanze.html"]'); // Aggiunto questo

export let currentUser = {};
let authReadyFired = false;

// --- LOGICA PERMESSI ---
const pagePermissions = {
    'finanze.html': ['user_base'], 
    'admin.html': ['user', 'calendar_admin', 'user_base'] 
};

function getCurrentPage() {
    const path = window.location.pathname;
    const page = path.split("/").pop();
    return page === '' ? 'index.html' : page;
}
// --- FINE LOGICA PERMESSI ---


onAuthStateChanged(auth, async (user) => {
    if (authReadyFired) return; 
    const currentPage = getCurrentPage();

    if (!user) {
        // Utente NON LOGGATO
        if (currentPage !== 'login.html') {
            window.location.href = 'login.html';
        }
    } else {
        // Utente LOGGATO
        currentUser.uid = user.uid;
        currentUser.email = user.email;

        try {
            const userRef = ref(database, 'users/' + user.uid);
            const memberRef = ref(database, 'members/' + user.uid);

            const [userSnapshot, memberSnapshot] = await Promise.all([
                get(userRef),
                get(memberRef)
            ]);

            // Assegna ruolo (default 'user_base')
            if (userSnapshot.exists()) {
                currentUser.role = userSnapshot.val().role || 'user_base'; 
            } else {
                currentUser.role = 'user_base';
            }
            
            // Assegna nome
            if (memberSnapshot.exists() && memberSnapshot.val().name) {
                currentUser.name = memberSnapshot.val().name;
            } else {
                currentUser.name = user.email; 
                currentUser.role = 'user_base'; 
            }

            console.log(`Accesso effettuato come: ${currentUser.name} (Ruolo: ${currentUser.role})`);

            // --- CONTROLLO ACCESSO PAGINA (BUTTAFUORI) ---
            const forbiddenRoles = pagePermissions[currentPage];
            if (forbiddenRoles && forbiddenRoles.includes(currentUser.role)) {
                console.warn(`Accesso negato a ${currentPage} per ruolo: ${currentUser.role}`);
                alert("Non hai i permessi per visualizzare questa pagina.");
                window.location.href = 'index.html'; 
                return; 
            }
            // --- FINE CONTROLLO ACCESSO ---


            // --- GESTIONE VISIBILITÀ LINK NAVBAR ---
            // 1. Link Pannello Admin
            if (adminPanelLink) {
                if (currentUser.role === 'admin') {
                    adminPanelLink.classList.remove('hidden');
                } else {
                    adminPanelLink.classList.add('hidden');
                }
            }
            
            // 2. Link Finanze (NASCONDE PER user_base)
            if (finanzeLink) {
                if (currentUser.role === 'user_base') {
                    finanzeLink.classList.add('hidden');
                } else {
                    finanzeLink.classList.remove('hidden');
                }
            }
            // --- FINE GESTIONE LINK ---
            
            // Se sei loggato e vai su login.html, ti rimanda alla home
            if (currentPage === 'login.html') {
                 window.location.href = 'index.html';
                 return;
            }

        } catch (error) {
            console.error("Errore nel recuperare i dati dell'utente (ruolo/nome):", error);
            signOut(auth);
            return;
        }
    }

    authReadyFired = true;
    document.dispatchEvent(new CustomEvent('authReady'));
});

// Listener per il bottone di logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
    });
}
