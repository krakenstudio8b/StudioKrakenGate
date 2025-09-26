import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, push, remove } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

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

// Funzione per creare una card di approvazione
const createApprovalCard = (id, title, details, onApprove, onReject) => {
    const card = document.createElement('div');
    card.className = 'bg-gray-50 p-3 rounded-lg border flex justify-between items-center flex-wrap gap-2';
    
    let detailsHtml = '';
    for (const [key, value] of Object.entries(details)) {
        detailsHtml += `<p class="text-xs text-gray-600 w-full md:w-auto"><span class="font-semibold">${key}:</span> ${value}</p>`;
    }

    card.innerHTML = `
        <div class="flex-grow">
            <p class="font-bold">${title}</p>
            <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                ${detailsHtml}
            </div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
            <button class="approve-btn bg-green-500 text-white font-semibold text-sm py-1 px-3 rounded-lg hover:bg-green-600">Approva</button>
            <button class="reject-btn bg-red-500 text-white font-semibold text-sm py-1 px-3 rounded-lg hover:bg-red-600">Rifiuta</button>
        </div>
    `;

    card.querySelector('.approve-btn').addEventListener('click', onApprove);
    card.querySelector('.reject-btn').addEventListener('click', onReject);
    
    return card;
};

// Funzioni per approvare/rifiutare
const approveRequest = async (mainNode, pendingNode, id, data) => {
    if (pendingNode === 'pendingCashMovements') {
        const cassaRef = ref(database, 'cassaComune');
        const snapshot = await get(cassaRef);
        const cassa = snapshot.val() || { balance: 0, movements: [] };
        let newBalance = cassa.balance;
        if (data.type === 'deposit') newBalance += data.amount;
        else newBalance -= data.amount;
        
        const movements = cassa.movements || [];
        movements.push(data);
        await set(cassaRef, { balance: newBalance, movements: movements });
    } else {
        const mainRef = ref(database, mainNode);
        const newEntryRef = push(mainRef);
        await set(newEntryRef, data);
    }
    await remove(ref(database, `${pendingNode}/${id}`));
};

const rejectRequest = (pendingNode, id) => {
    remove(ref(database, `${pendingNode}/${id}`)).catch(err => console.error("Errore rifiuto:", err));
};

// Funzione per caricare le richieste
const loadPendingItems = (nodeName, container, titleKey, detailsBuilder, mainNode) => {
    const pendingRef = ref(database, nodeName);
    onValue(pendingRef, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const id = childSnapshot.key;
                const data = childSnapshot.val();
                const card = createApprovalCard(id, data[titleKey], detailsBuilder(data),
                    () => approveRequest(mainNode, nodeName, id, data),
                    () => rejectRequest(nodeName, id)
                );
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `<p class="text-gray-500">Nessuna richiesta da approvare.</p>`;
        }
    });
};

// Funzione per la gestione utenti
const loadUsersForManagement = async () => {
    const usersDbRef = ref(database, 'users');
    const authUsersRef = ref(database, 'authUsers'); // Assumiamo esista un nodo con UID -> email
    
    onValue(usersDbRef, async (snapshot) => {
        usersListEl.innerHTML = '';
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            const authUsersSnapshot = await get(authUsersRef);
            const authUsers = authUsersSnapshot.exists() ? authUsersSnapshot.val() : {};

            for (const uid in usersData) {
                const user = usersData[uid];
                const userEl = document.createElement('div');
                userEl.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-lg';
                
                const email = authUsers[uid]?.email || 'Email non disponibile';

                userEl.innerHTML = `
                    <div>
                        <p class="font-semibold text-sm">${email}</p>
                        <p class="text-xs text-gray-500 font-mono">${uid}</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <label for="admin-role-${uid}" class="text-sm font-medium">Admin</label>
                            <input type="radio" name="role-${uid}" id="admin-role-${uid}" value="admin" data-uid="${uid}" class="role-radio h-4 w-4" ${user.role === 'admin' ? 'checked' : ''}>
                        </div>
                        <div class="flex items-center gap-2">
                            <label for="calendar-role-${uid}" class="text-sm font-medium">Admin Calendario</label>
                            <input type="radio" name="role-${uid}" id="calendar-role-${uid}" value="calendar_admin" data-uid="${uid}" class="role-radio h-4 w-4" ${user.role === 'calendar_admin' ? 'checked' : ''}>
                        </div>
                         <div class="flex items-center gap-2">
                            <label for="user-role-${uid}" class="text-sm font-medium">Utente</label>
                            <input type="radio" name="role-${uid}" id="user-role-${uid}" value="user" data-uid="${uid}" class="role-radio h-4 w-4" ${!user.role || user.role === 'user' ? 'checked' : ''}>
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

// Listener per i radio button dei ruoli
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('role-radio')) {
        const uid = e.target.dataset.uid;
        const newRole = e.target.value;
        
        const userRoleRef = ref(database, `users/${uid}/role`);
        
        set(userRoleRef, newRole)
            .then(() => alert(`Ruolo di ${uid} aggiornato a ${newRole}.`))
            .catch(err => console.error(err));
    }
});

// Inizializzazione della pagina
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (currentUser.role === 'admin') {
            calendarApprovalSection.classList.remove('hidden');
            financeApprovalSection.classList.remove('hidden');
            userManagementSection.classList.remove('hidden');
            
            loadPendingItems('pendingCalendarEvents', pendingEventsContainer, 'title', 
                data => ({ Sala: data.room || 'N/A', Data: displayDate(data.start) }), 'calendarEvents');
            
            // Uniamo tutte le richieste finanziarie in un unico contenitore
            loadPendingItems('pendingVariableExpenses', pendingFinanceContainer, 'description', 
                data => ({ Importo: `€${data.amount}`, Pagato_da: data.payer, Tipo: 'Spesa Variabile' }), 'variableExpenses');
                
            loadPendingItems('pendingIncomeEntries', pendingFinanceContainer, 'description', 
                data => ({ Importo: `+€${data.amount}`, Membri: data.membersInvolved.join(', '), Tipo: 'Entrata' }), 'incomeEntries');
            
            loadPendingItems('pendingCashMovements', pendingFinanceContainer, 'description', 
                data => ({ Importo: `${data.type === 'deposit' ? '+' : '-'}€${data.amount}`, Membro: data.member, Tipo: 'Mov. Cassa' }), 'cassaComune/movements');

            loadUsersForManagement();

        } else if (currentUser.role === 'calendar_admin') {
            calendarApprovalSection.classList.remove('hidden');
            loadPendingItems('pendingCalendarEvents', pendingEventsContainer, 'title', 
                data => ({ Sala: data.room || 'N/A', Data: displayDate(data.start) }), 'calendarEvents');
        }
    }, 500);
});
