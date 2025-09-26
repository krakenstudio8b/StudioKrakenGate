import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

const auth = getAuth();
const database = getDatabase();
const logoutBtn = document.getElementById('logout-btn');
const adminPanelLink = document.getElementById('admin-panel-link');

// Esportiamo una variabile globale per sapere chi è l'utente
export let currentUser = {
    uid: null,
    email: null,
    role: 'user' // Ruolo di default
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        currentUser.uid = user.uid;
        currentUser.email = user.email;

        const userRef = ref(database, 'users/' + user.uid);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            currentUser.role = snapshot.val().role || 'user';
        } else {
            currentUser.role = 'user';
        }

        console.log(`Accesso come: ${currentUser.role}`);
        
        // Mostra il link al pannello admin solo se si ha un ruolo speciale
        if (currentUser.role === 'admin' || currentUser.role === 'calendar_admin') {
            if (adminPanelLink) {
                adminPanelLink.classList.remove('hidden');
            }
        } else {
            if (adminPanelLink) {
                adminPanelLink.classList.add('hidden');
            }
        }
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
    });
}
