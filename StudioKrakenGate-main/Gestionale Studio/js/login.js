// js/login.js

import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { auth } from './firebase-config.js';

// L'unico redirect che fa questo file è se un utente GIA' LOGGATO finisce qui.
onAuthStateChanged(auth, (user) => {
    if (user) {
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
            console.log("Login riuscito per:", userCredential.user.email);
            // Non facciamo nulla, onAuthStateChanged ci porterà alla pagina giusta.
        })
        .catch((error) => {
            console.error("Errore di login:", error.code);
            errorMessage.textContent = 'Email o password non corrette.';
        });
});
