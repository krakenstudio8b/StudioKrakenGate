//js/admin.js SOSTITUIRE COMPLETAMENTE CON QUESTO

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getDatabase, ref, onValue, get, set, push, remove, update } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

// La configurazione di Firebase è ridondante se usi 'database' importato, ma la lasciamo per coerenza
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
const database = getDatabase(app);

// Riferimenti ai container HTML
const calendarApprovalSection = document.getElementById('calendar-approval-section');
const financeApprovalSection = document.getElementById('finance-approval-section');
const userManagementSection = document.getElementById('user-management-section');
const pendingEventsContainer = document.getElementById('pending-events-container');
const pendingFinanceContainer = document.getElementById('pending-finance-container');
const usersListEl = document.getElementById('users-list');

// Riferimenti specifici ai nodi di Firebase
const usersRef = ref(database, 'users');
const expenseRequestsRef = ref(database, 'expenseRequests');
const variableExpensesRef = ref(database, 'variableExpenses');
const cassaComuneRef = ref(database, 'cassaComune');

let allUsersData = {}; 

const displayDate = (dateString) => {
     if (!dateString) return 'N/A';
     const date = new Date(dateString);
     if (isNaN(date)) return 'Data non valida';
     const userTimezoneOffset = date.getTimezoneOffset() * 60000;
     return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// --- LOGICA SPECIFICA PER APPROVAZIONE SPESE ---

async function approveExpenseRequest(requestKey, requestData) {
    if (!confirm(`Approvare la spesa di €${requestData.amount} per "${requestData.description}"?`)) {
        return;
    }

    // 1. Leggi lo stato attuale della cassa comune
    const cassaSnapshot = await get(cassaComuneRef);
    const cassaComune = cassaSnapshot.val() || { balance: 0, movements: [] };

    // 2. Controlla se ci sono fondi sufficienti se la spesa è dalla cassa
    if (requestData.payer === 'Cassa Comune' && requestData.amount > cassaComune.balance) {
        alert('Approvazione fallita: Fondi insufficienti nella cassa comune!');
        return;
    }

    // 3. Crea la nuova spesa in `variableExpenses`
    const newExpenseId = Date.now().toString();
    const newExpense = {
        id: newExpenseId,
        date: requestData.date,
        payer: requestData.payer,
        amount: requestData.amount,
        description: requestData.description,
        category: requestData.category
    };
    await push(variableExpensesRef, newExpense);

    // 4. Se necessario, aggiorna la cassa comune e crea il movimento collegato
    if (requestData.payer === 'Cassa Comune') {
        cassaComune.balance -= requestData.amount;
        if (!cassaComune.movements) {
            cassaComune.movements = [];
        }
        const newMovement = {
            id: (Date.now() + 1).toString(),
            date: requestData.date,
            type: 'withdrawal',
            amount: requestData.amount,
            description: `Spesa: ${requestData.description}`,
            member: '',
            linkedExpenseId: newExpenseId // <-- Collegamento cruciale!
        };
        // Per evitare problemi di concorrenza, non usiamo push ma sovrascriviamo l'array
        const movementsArray = cassaComune.movements ? Object.values(cassaComune.movements) : [];
        movementsArray.push(newMovement);
        cassaComune.movements = movementsArray;
        
        await set(cassaComuneRef, cassaComune);
    }

    // 5. Aggiorna lo stato della richiesta a "approved"
    const requestToUpdateRef = ref(database, `expenseRequests/${requestKey}`);
    await update(requestToUpdateRef, { status: 'approved' });

    alert('Spesa approvata e registrata con successo!');
}

async function rejectExpenseRequest(requestKey) {
    if (confirm("Sei sicuro di voler rifiutare questa richiesta? L'azione è irreversibile.")) {
        const requestToUpdateRef = ref(database, `expenseRequests/${requestKey}`);
        await update(requestToUpdateRef, { status: 'rejected' });
        alert('Richiesta rifiutata.');
    }
}

function renderPendingFinanceRequests() {
    onValue(expenseRequestsRef, (snapshot) => {
        pendingFinanceContainer.innerHTML = '';
        let hasPendingRequests = false;
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const requestKey = childSnapshot.key;
                const requestData = childSnapshot.val();

                if (requestData.status === 'pending') {
                    hasPendingRequests = true;
                    const card = document.createElement('div');
                    card.className = 'bg-gray-50 p-3 rounded-lg border flex justify-between items-center flex-wrap gap-2';
                    card.innerHTML = `
                        <div class="flex-grow">
                            <p class="font-bold">${requestData.description} - <span class="font-normal text-gray-600">€${requestData.amount.toFixed(2)}</span></p>
                            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-600">
                                <p><span class="font-semibold">Richiedente:</span> ${requestData.requesterName || 'N/D'}</p>
                                <p><span class="font-semibold">Pagante:</span> ${requestData.payer}</p>
                                <p><span class="font-semibold">Data:</span> ${displayDate(requestData.date)}</p>
                            </div>
                        </div>
                        <div class="flex gap-2 flex-shrink-0">
                            <button data-key="${requestKey}" class="approve-expense-btn bg-green-500 text-white font-semibold text-sm py-1 px-3 rounded-lg hover:bg-green-600">Approva</button>
                            <button data-key="${requestKey}" class="reject-expense-btn bg-red-500 text-white font-semibold text-sm py-1 px-3 rounded-lg hover:bg-red-600">Rifiuta</button>
                        </div>
                    `;
                    pendingFinanceContainer.appendChild(card);
                }
            });
        }

        if (!hasPendingRequests) {
            pendingFinanceContainer.innerHTML = '<p class="text-gray-500">Nessuna operazione finanziaria da approvare.</p>';
        }
    });
}


// --- GESTIONE UTENTI (invariata) ---
const loadUsersForManagement = () => {
    onValue(usersRef, (snapshot) => {
        usersListEl.innerHTML = '';
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            allUsersData = usersData; // Aggiorniamo la cache utenti
            for (const uid in usersData) {
                const user = usersData[uid];
                const userEl = document.createElement('div');
                userEl.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-lg';
                const displayName = user.email || uid;

                userEl.innerHTML = `
                    <div><p class="font-semibold text-sm">${displayName}</p></div>
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <label for="admin-role-${uid}" class="text-sm font-medium">Admin</label>
                            <input type="radio" name="role-${uid}" value="admin" data-uid="${uid}" class="role-radio h-4 w-4" ${user.role === 'admin' ? 'checked' : ''}>
                        </div>
                        <div class="flex items-center gap-2">
                            <label for="calendar-role-${uid}" class="text-sm font-medium">Admin Calendario</label>
                            <input type="radio" name="role-${uid}" value="calendar_admin" data-uid="${uid}" class="role-radio h-4 w-4" ${user.role === 'calendar_admin' ? 'checked' : ''}>
                        </div>
                         <div class="flex items-center gap-2">
                            <label for="user-role-${uid}" class="text-sm font-medium">Utente</label>
                            <input type="radio" name="role-${uid}" value="user" data-uid="${uid}" class="role-radio h-4 w-4" ${!user.role || user.role === 'user' ? 'checked' : ''}>
                        </div>
                    </div>
                `;
                usersListEl.appendChild(userEl);
            }
        } else {
            usersListEl.innerHTML = '<p class="text-gray-500">Nessun utente trovato nel database.</p>';
        }
    });
};

// --- INIZIALIZZAZIONE PAGINA ---
const initializeAdminPanel = () => {
    if (currentUser.role === 'admin') {
        financeApprovalSection.classList.remove('hidden');
        userManagementSection.classList.remove('hidden');
        // Aggiungi qui altre sezioni per admin completi
        
        renderPendingFinanceRequests();
        loadUsersForManagement();

    } else if (currentUser.role === 'calendar_admin') {
        // Logica per admin calendario
    }
    // Aggiungere logica per altri ruoli se necessario
};


// --- EVENT LISTENERS GLOBALI ---
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { // Timeout per assicurarsi che currentUser sia popolato da auth-guard
        initializeAdminPanel();
    }, 500); 
});

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('role-radio')) {
        const uid = e.target.dataset.uid;
        const newRole = e.target.value;
        const userRoleRef = ref(database, `users/${uid}/role`);
        set(userRoleRef, newRole)
            .then(() => alert(`Ruolo aggiornato con successo.`))
            .catch(err => console.error(err));
    }
});

document.addEventListener('click', (e) => {
    if (e.target.matches('.approve-expense-btn')) {
        const key = e.target.dataset.key;
        const requestRef = ref(database, `expenseRequests/${key}`);
        get(requestRef).then(snapshot => {
            if(snapshot.exists()) {
                approveExpenseRequest(key, snapshot.val());
            }
        });
    }
    if (e.target.matches('.reject-expense-btn')) {
        const key = e.target.dataset.key;
        rejectExpenseRequest(key);
    }
});
