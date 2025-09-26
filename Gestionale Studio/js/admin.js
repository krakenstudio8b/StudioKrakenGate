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

const displayDate = (dateString) => {
     if (!dateString) return 'N/A';
     const date = new Date(dateString);
     if (isNaN(date)) return 'Data non valida';
     const userTimezoneOffset = date.getTimezoneOffset() * 60000;
     return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Funzione per creare una card di approvazione generica
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

// Funzioni generiche per approvare/rifiutare
const approveRequest = async (mainNode, pendingNode, id, data) => {
    try {
        // Logica speciale per la cassa
        if (pendingNode === 'pendingCashMovements') {
            const cassaRef = ref(database, 'cassaComune');
            const snapshot = await get(cassaRef);
            const cassa = snapshot.val() || { balance: 0, movements: [] };
            let newBalance = cassa.balance;

            if (data.type === 'deposit') {
                newBalance += data.amount;
            } else {
                newBalance -= data.amount;
            }
            
            const movements = cassa.movements || [];
            movements.push(data);
            await set(cassaRef, { balance: newBalance, movements: movements });

        } else {
            const mainRef = ref(database, mainNode);
            const newEntryRef = push(mainRef);
            await set(newEntryRef, data);
        }
        await remove(ref(database, `${pendingNode}/${id}`));
        alert("Richiesta approvata con successo!");
    } catch (err) {
        console.error("Errore durante l'approvazione:", err);
        alert("Si è verificato un errore durante l'approvazione.");
    }
};

const rejectRequest = (pendingNode, id) => {
    if (confirm("Sei sicuro di voler rifiutare questa richiesta? L'azione è irreversibile.")) {
        remove(ref(database, `${pendingNode}/${id}`))
            .then(() => alert("Richiesta rifiutata."))
            .catch(err => console.error("Errore rifiuto:", err));
    }
};

// Funzione per caricare le richieste in sospeso
const loadPendingItems = (container, nodeName, titleKey, detailsBuilder, mainNode) => {
    const pendingRef = ref(database, nodeName);

    onValue(pendingRef, (snapshot) => {
        // Rimuove solo le card di questo tipo per evitare di cancellare altre richieste
        container.querySelectorAll(`[data-request-type="${nodeName}"]`).forEach(el => el.remove());
        
        // Se non ci sono più richieste di nessun tipo, mostra il messaggio di default
        if (container.children.length === 0) {
             container.innerHTML = '<p class="text-gray-500">Nessuna richiesta da approvare.</p>';
        }

        if (snapshot.exists()) {
            // Se esiste almeno una richiesta, rimuoviamo il messaggio di default
            const placeholder = container.querySelector('p');
            if (placeholder) placeholder.remove();

            snapshot.forEach(childSnapshot => {
                const id = childSnapshot.key;
                const data = childSnapshot.val();
                const card = createApprovalCard(id, data[titleKey] || "Senza Titolo", detailsBuilder(data),
                    () => approveRequest(mainNode, nodeName, id, data),
                    () => rejectRequest(nodeName, id)
                );
                card.dataset.requestType = nodeName;
                container.appendChild(card);
            });
        }
    });
};


// Funzione per la gestione utenti
const loadUsersForManagement = async () => {
    const usersDbRef = ref(database, 'users');
    // Nota: Per ottenere le email in un'app reale, si usano le Cloud Functions.
    // Qui le lasceremo fuori per semplicità, mostrando solo l'UID.
    
    onValue(usersDbRef, (snapshot) => {
        usersListEl.innerHTML = '';
        if (snapshot.exists()) {
            const usersData = snapshot.val();

            for (const uid in usersData) {
                const user = usersData[uid];
                const userEl = document.createElement('div');
                userEl.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-lg';
                
                userEl.innerHTML = `
                    <div>
                        <p class="font-semibold text-sm font-mono">${uid}</p>
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
    // Usiamo un piccolo ritardo per assicurarci che currentUser da auth-guard.js sia stato valorizzato
    setTimeout(() => {
        if (currentUser.role === 'admin') {
            calendarApprovalSection.classList.remove('hidden');
            financeApprovalSection.classList.remove('hidden');
            userManagementSection.classList.remove('hidden');
            
            loadPendingItems(pendingEventsContainer, 'pendingCalendarEvents', 'title', 
                data => ({ Sala: data.room || 'N/A', Data: displayDate(data.start), Richiesto_da: data.requesterEmail || data.createdBy }), 'calendarEvents');
            
            loadPendingItems(pendingFinanceContainer, 'pendingVariableExpenses', 'description', 
                data => ({ Importo: `€${data.amount}`, Pagato_da: data.payer, Tipo: 'Spesa', Richiesto_da: data.requesterEmail || data.createdBy }), 'variableExpenses');
                
            loadPendingItems(pendingFinanceContainer, 'pendingIncomeEntries', 'description', 
                data => ({ Importo: `+€${data.amount}`, Membri: (data.membersInvolved || []).join(', '), Tipo: 'Entrata', Richiesto_da: data.requesterEmail || data.createdBy }), 'incomeEntries');
            
            loadPendingItems(pendingFinanceContainer, 'pendingCashMovements', 'description', 
                data => ({ Importo: `${data.type === 'deposit' ? '+' : '-'}€${data.amount}`, Membro: data.member || 'N/A', Tipo: 'Mov. Cassa', Richiesto_da: data.requesterEmail || data.createdBy }), 'cassaComune');

            loadUsersForManagement();

        } else if (currentUser.role === 'calendar_admin') {
            calendarApprovalSection.classList.remove('hidden');
            loadPendingItems(pendingEventsContainer, 'pendingCalendarEvents', 'title', 
                data => ({ Sala: data.room || 'N/A', Data: displayDate(data.start), Richiesto_da: data.requesterEmail || data.createdBy }), 'calendarEvents');
        }
    }, 500); 
});
