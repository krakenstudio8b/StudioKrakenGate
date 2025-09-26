import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// NOTA: Non serve initializeApp qui, perché lo prende dalla pagina principale (es. finanze.js)

const auth = getAuth();
const logoutBtn = document.getElementById('logout-btn');

onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Se non c'è utente, torna al login
        window.location.href = 'login.html';
    } else {
        // L'utente è loggato, la pagina può essere visualizzata.
        // Qui in futuro controlleremo anche il suo ruolo.
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch((error) => console.error("Errore durante il logout:", error));
    });
}
