import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

const auth = getAuth();
const database = getDatabase();
const logoutBtn = document.getElementById('logout-btn');
const adminPanelLink = document.getElementById('admin-panel-link');

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Se non c'è utente, torna al login
        window.location.href = 'login.html';
    } else {
        // L'utente è loggato, ora controlliamo il suo ruolo nel database
        const userRef = ref(database, 'users/' + user.uid);
        const snapshot = await get(userRef);

        let userRole = null;
        if (snapshot.exists()) {
            userRole = snapshot.val().role;
        }

        if (userRole === 'admin') {
            console.log("Accesso come Amministratore");
            if (adminPanelLink) {
                adminPanelLink.classList.remove('hidden'); // Mostra il link al pannello admin
            }
        } else {
            console.log("Accesso come Utente Standard");
            if (adminPanelLink) {
                adminPanelLink.classList.add('hidden'); // Nasconde il link se non si è admin
            }
        }
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
    });
}
