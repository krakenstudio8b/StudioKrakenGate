// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// Your web app's Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);