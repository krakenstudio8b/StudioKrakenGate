import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// Questa configurazione è usata SOLO per il login.
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

// Controlla se l'utente è già loggato. Se sì, lo manda alla pagina principale.
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = 'index.html';
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
            // Login riuscito, l'onAuthStateChanged farà il resto.
        })
        .catch((error) => {
            errorMessage.textContent = 'Email o password non corrette.';
        });
});
