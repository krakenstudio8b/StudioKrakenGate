import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// Importa le istanze già inizializzate, invece di ricrearle
import { auth, database } from './firebase-config.js';

// La configurazione di Firebase è necessaria anche qui per accedere al database
const firebaseConfig = {
    apiKey: "AIzaSyBtQZkX6r4F2W0BsIo6nsD27dUZHv3e8RU",
    authDomain: "studio-kraken-gate.firebaseapp.com",
    projectId: "studio-kraken-gate",
    storageBucket: "studio-kraken-gate.firebasestorage.app",
    messagingSenderId: "744360512833",
    appId: "1:744360512833:web:ed0952f304c37bd5ee25c0",
    measurementId: "G-39RLC549LJ",
    databaseURL: "https://studio-kraken-gate-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const logoutBtn = document.getElementById('logout-btn');
const adminPanelLink = document.getElementById('admin-panel-link');

// Esportiamo un oggetto mutabile per i dettagli dell'utente
export const currentUser = {};

// NUOVA LOGICA: Funzione per attendere che l'Auth sia completo
let isAuthCompleted = false;
const onAuthReadyCallbacks = [];

/**
 * Registra una funzione da eseguire non appena l'utente corrente è stato completamente caricato.
 * @param {function} callback - La funzione da eseguire.
 */
export function onAuthReady(callback) {
    if (isAuthCompleted) {
        callback(currentUser); 
    } else {
        onAuthReadyCallbacks.push(callback);
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Se non c'è utente, torna al login
        if (window.location.pathname.endsWith('login.html') === false) {
            window.location.href = 'login.html';
        }
        
        // Segnala che l'auth è completato (anche se senza utente)
        isAuthCompleted = true;
        onAuthReadyCallbacks.forEach(callback => callback(currentUser));
        onAuthReadyCallbacks.length = 0; 
        
    } else {
        // Se c'è un utente loggato, popoliamo il nostro oggetto currentUser
        currentUser.uid = user.uid;
        currentUser.email = user.email;

        // Ora controlliamo il suo ruolo nel database
        const userRef = ref(database, 'users/' + user.uid);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            currentUser.role = snapshot.val().role || 'user';
        } else {
            currentUser.role = 'user'; 
        }

        console.log(`Accesso effettuato come: ${currentUser.email} (Ruolo: ${currentUser.role})`);
        
        // Mostra il link al pannello admin
        if (adminPanelLink) {
            if (currentUser.role === 'admin' || currentUser.role === 'calendar_admin') {
                adminPanelLink.classList.remove('hidden');
            } else {
                adminPanelLink.classList.add('hidden');
            }
        }
        
        // SEGNALA CHE L'AUTENTICAZIONE È COMPLETA E IL RUOLO È CARICATO
        isAuthCompleted = true;
        onAuthReadyCallbacks.forEach(callback => callback(currentUser));
        onAuthReadyCallbacks.length = 0; 
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
    });
}
