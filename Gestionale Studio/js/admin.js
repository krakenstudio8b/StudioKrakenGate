import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// Questa funzione non è nell'auth-guard, quindi dobbiamo importare tutto
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtQZkX6r4F2W0BsIo6nsD27dUZHv3e8RU",
    authDomain: "studio-kraken-gate.firebaseapp.com",
    projectId: "studio-kraken-gate",
    storageBucket: "studio-kraken-gate.firebasestorage.app",
    messagingSenderId: "744360512833",
    appId: "1:744360512833:web:ed0952f304c37bd5ee25c0",
    measurementId: "G-39RLC549LJ",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const usersContainer = document.querySelector('.card'); // Selezioniamo il contenitore principale

async function fetchAndDisplayUsers() {
    // Per ottenere la lista utenti dobbiamo usare una Cloud Function,
    // perché per motivi di privacy non è possibile farlo direttamente dal client.
    // Per ora, simuleremo la gestione dei ruoli per gli utenti già presenti nel DB.

    usersContainer.innerHTML = `
        <h2 class="text-2xl font-semibold mb-4 border-b pb-2">Gestione Ruoli Utenti</h2>
        <div id="users-list" class="space-y-3">
            <p class="text-gray-500">Caricamento utenti...</p>
        </div>
    `;

    const usersListEl = document.getElementById('users-list');
    const usersDbRef = ref(database, 'users');
    const snapshot = await get(usersDbRef);

    if (snapshot.exists()) {
        usersListEl.innerHTML = '';
        const usersData = snapshot.val();
        
        for (const uid in usersData) {
            const user = usersData[uid];
            const userEl = document.createElement('div');
            userEl.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-lg';
            
            // Per avere l'email, dovremmo usare una Cloud Function.
            // Per ora mostriamo solo l'UID e il ruolo.
            userEl.innerHTML = `
                <div>
                    <p class="font-mono text-sm">${uid}</p>
                    <p class="text-xs text-gray-500">Ruolo attuale: ${user.role || 'utente'}</p>
                </div>
                <div class="flex items-center gap-2">
                    <label for="role-${uid}" class="text-sm font-medium">È admin?</label>
                    <input type="checkbox" id="role-${uid}" data-uid="${uid}" class="admin-checkbox h-5 w-5 rounded" ${user.role === 'admin' ? 'checked' : ''}>
                </div>
            `;
            usersListEl.appendChild(userEl);
        }
    } else {
        usersListEl.innerHTML = '<p class="text-gray-500">Nessun utente trovato nel database.</p>';
    }
}

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('admin-checkbox')) {
        const uid = e.target.dataset.uid;
        const isAdmin = e.target.checked;
        
        const userRoleRef = ref(database, `users/${uid}/role`);
        
        if (isAdmin) {
            set(userRoleRef, 'admin')
                .then(() => alert(`L'utente ${uid} è ora un amministratore.`))
                .catch(err => console.error(err));
        } else {
            set(userRoleRef, null) // Rimuove il ruolo di admin
                .then(() => alert(`L'utente ${uid} non è più un amministratore.`))
                .catch(err => console.error(err));
        }
    }
});

// Avvia il caricamento degli utenti quando la pagina è pronta
document.addEventListener('DOMContentLoaded', () => {
    // In un'app reale, qui verificheremmo di nuovo se l'utente è admin prima di mostrare i dati
    fetchAndDisplayUsers();
});
