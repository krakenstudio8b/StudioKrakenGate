// js/login.js - VERSIONE CON DEBUG MIGLIORATO

import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { auth } from './firebase-config.js'; // Importa solo 'auth'

// Controlla se l'utente è già loggato. Se sì, lo manda alla pagina principale.
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se l'utente è loggato, reindirizza alla pagina delle attività.
        if (window.location.pathname.endsWith('login.html')) {
            window.location.href = 'index.html';
        }
    }
});

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');

loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    errorMessage.textContent = '';

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // Login riuscito. L'onAuthStateChanged gestirà il redirect.
            console.log("Login effettuato con successo per:", userCredential.user.email);
        })
        .catch((error) => {
            // Mostriamo un errore più dettagliato nella console per il debug
            console.error("Errore durante il login:", error.code, error.message);

            // E mostriamo un messaggio generico all'utente
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage.textContent = 'Email o password non corrette.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage.textContent = 'Metodo di login non abilitato su Firebase.';
                    break;
                default:
                    errorMessage.textContent = 'Si è verificato un errore durante il login.';
                    break;
            }
        });
});
