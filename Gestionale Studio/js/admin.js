// js/admin.js (VERSIONE COMPLETA - Team Rotation con Conteggio)
import { database } from './firebase-config.js';
import { ref, onValue, get, set, push, remove, update } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

// --- RIFERIMENTI AGLI ELEMENTI HTML ---
const calendarApprovalSection = document.getElementById('calendar-approval-section');
const financeApprovalSection = document.getElementById('finance-approval-section');
const userManagementSection = document.getElementById('user-management-section');
const pendingEventsContainer = document.getElementById('pending-events-container');
const pendingFinanceContainer = document.getElementById('pending-finance-container');
const usersListEl = document.getElementById('users-list');

// Riferimenti per il modulo PULIZIE
const cleaningManagementSection = document.getElementById('cleaning-management-section');
const generateCleaningBtn = document.getElementById('generate-cleaning-btn');
const generationFeedback = document.getElementById('generation-feedback');
const lastCleaningDayInfo = document.getElementById('last-cleaning-day-info');


// --- RIFERIMENTI AI NODI DI FIREBASE ---
const usersRef = ref(database, 'users');
const expenseRequestsRef = ref(database, 'expenseRequests');
const variableExpensesRef = ref(database, 'variableExpenses');
const cassaComuneRef = ref(database, 'cassaComune');
const pendingCalendarEventsRef = ref(database, 'pendingCalendarEvents');
const calendarEventsRef = ref(database, 'calendarEvents');

// Riferimenti per il modulo PULIZIE
const membersRef = ref(database, 'members'); // Lista membri per attività
const cleaningStateRef = ref(database, 'cleaningState');
const cleaningScheduleRef = ref(database, 'cleaningSchedule');


// --- FUNZIONI UTILITY ---
const displayDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date)) return 'Data non valida';
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Utility per PULIZIE: Costanti
const ZONES = [
    "Ingresso + Bagno",
    "Regia + Sala Gate",
    "Scale + 1 Piano",
    "Sala Mix + Sala Rec"
];
const NUM_ZONES = ZONES.length;
const CLEANING_DAYS = [1, 3, 5]; // 1=Lunedì, 3=Mercoledì, 5=Venerdì

// Utility per PULIZIE: Calcolo data YYYY-MM-DD
function getIsoDate(date) {
    return date.toISOString().split('T')[0];
}


// --- LOGICA PER APPROVAZIONE SPESE FINANZIARIE ---
async function approveExpenseRequest(requestKey, requestData) {
    if (!confirm(`Approvare la spesa di €${requestData.amount} per "${requestData.description}"?`)) return;
    const cassaSnapshot = await get(cassaComuneRef);
    const cassaComune = cassaSnapshot.val() || { balance: 0, movements: [] };
    if (requestData.payer === 'Cassa Comune' && requestData.amount > cassaComune.balance) {
        alert('Approvazione fallita: Fondi insufficienti nella cassa comune!');
        return;
    }
    const newExpenseId = Date.now().toString();
    const newExpense = {
        id: newExpenseId,
        date: requestData.date,
        payer: requestData.payer,
        amount: requestData.amount,
        description: requestData.description,
        category: requestData.category
    };
    const newExpenseRef = push(variableExpensesRef);
    await set(newExpenseRef, newExpense);
    if (requestData.payer === 'Cassa Comune') {
        cassaComune.balance -= requestData.amount;
        const newMovement = {
            id: (Date.now() + 1).toString(),
            date: requestData.date,
            type: 'withdrawal',
            amount: requestData.amount,
            description: `Spesa: ${requestData.description}`,
            member: '',
            linkedExpenseId: newExpenseId
        };
        const newMovementRef = push(ref(database, 'cassaComune/movements'));
        await set(newMovementRef, newMovement);
        await update(cassaComuneRef, { balance: cassaComune.balance });
    }
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

// --- LOGICA PER APPROVAZIONE EVENTI CALENDARIO ---
async function approveCalendarEvent(eventKey, eventData) {
    if (!confirm(`Approvare l'evento "${eventData.title}"?`)) return;
    const newEventRef = push(calendarEventsRef);
    await set(newEventRef, eventData);
    await remove(ref(database, `pendingCalendarEvents/${eventKey}`));
    alert('Evento approvato e aggiunto al calendario.');
}
async function rejectCalendarEvent(eventKey) {
    if (confirm("Sei sicuro di voler rifiutare questo evento?")) {
        await remove(ref(database, `pendingCalendarEvents/${eventKey}`));
        alert('Richiesta di evento rifiutata.');
    }
}
function renderPendingCalendarEvents() {
    onValue(pendingCalendarEventsRef, (snapshot) => {
        pendingEventsContainer.innerHTML = '';
        let hasPendingEvents = false;
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                hasPendingEvents = true;
                const eventKey = childSnapshot.key;
                const eventData = childSnapshot.val();
                const card = document.createElement('div');
                card.className = 'bg-gray-50 p-3 rounded-lg border flex justify-between items-center flex-wrap gap-2';
                card.innerHTML = `
                    <div class="flex-grow">
                        <p class="font-bold">${eventData.title}</p>
                        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-600">
                            <p><span class="font-semibold">Data:</span> ${displayDate(eventData.start)}</p>
                            <p><span class="font-semibold">Sala:</span> ${eventData.room || 'Nessuna'}</p>
                            <p><span class="font-semibold">Richiedente:</span> ${eventData.requesterEmail || 'N/D'}</p>
                        </div>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button data-key="${eventKey}" class="approve-calendar-btn bg-green-500 text-white font-semibold text-sm py-1 px-3 rounded-lg hover:bg-green-600">Approva</button>
                        <button data-key="${eventKey}" class="reject-calendar-btn bg-red-500 text-white font-semibold text-sm py-1 px-3 rounded-lg hover:bg-red-600">Rifiuta</button>
                    </div>
                `;
                pendingEventsContainer.appendChild(card);
            });
        }
        if (!hasPendingEvents) {
            pendingEventsContainer.innerHTML = '<p class="text-gray-500">Nessun evento da approvare.</p>';
        }
    });
}

// --- LOGICA PER GESTIONE UTENTI ---
const loadUsersForManagement = () => {
    onValue(usersRef, (snapshot) => {
        usersListEl.innerHTML = '';
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            for (const uid in usersData) {
                const user = usersData[uid];
                const userEl = document.createElement('div');
                userEl.className = 'flex justify-between items-center bg-gray-50 p-3 rounded-lg';
                const displayName = user.email || uid;
                userEl.innerHTML = `
                    <div><p class="font-semibold text-sm">${displayName}</p></div>
                    <div class="flex items-center gap-4 flex-wrap">
                        <div class="flex items-center gap-2">
                            <label class="text-sm font-medium">Admin</label>
                            <input type="radio" name="role-${uid}" value="admin" data-uid="${uid}" class="role-radio h-4 w-4" ${user.role === 'admin' ? 'checked' : ''}>
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-sm font-medium">Admin Calendario</label>
                            <input type="radio" name="role-${uid}" value="calendar_admin" data-uid="${uid}" class="role-radio h-4 w-4" ${user.role === 'calendar_admin' ? 'checked' : ''}>
                        </div>
                         <div class="flex items-center gap-2">
                            <label class="text-sm font-medium">Utente</label>
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


// --- LOGICA PER GESTIONE PULIZIE (NUOVO MODULO) ---
async function initializeCleaningModule() {
    // Il controllo permessi è già in initializeAdminPage
    cleaningManagementSection.classList.remove('hidden'); 

    // Mostra info sull'ultimo turno generato
    try {
        const stateSnapshot = await get(cleaningStateRef);
        const lastDate = stateSnapshot.val()?.lastDateGenerated;
        if (lastDate) {
            lastCleaningDayInfo.innerHTML = `Ultima sessione generata: <strong>${lastDate}</strong>. Il prossimo turno sarà il primo giorno utile (Lun, Mer, Ven) dopo questa data.`;
        } else {
            lastCleaningDayInfo.textContent = "Nessun turno ancora generato. Il primo turno sarà il prossimo Lun, Mer o Ven.";
        }
    } catch (e) {
        lastCleaningDayInfo.textContent = "Impossibile caricare lo stato.";
    }

    generateCleaningBtn.removeEventListener('click', handleGeneration); 
    generateCleaningBtn.addEventListener('click', handleGeneration);
}

// In js/admin.js
async function handleGeneration() {
    generateCleaningBtn.disabled = true;
    generationFeedback.textContent = "Sto generando la sessione...";
    generationFeedback.className = "mt-4 text-sm text-yellow-600";
    
    try {
        // 1. Trova la prossima data utile (Questa logica non cambia)
        const stateSnapshot = await get(cleaningStateRef);
        const lastDateGenerated = stateSnapshot.val()?.lastDateGenerated 
                                  || getIsoDate(new Date(Date.now() - 86400000)); // Ieri
        let nextCleaningDate = new Date(lastDateGenerated + 'T12:00:00Z');
        let nextCleaningDateStr = "";
        while (true) {
            nextCleaningDate.setDate(nextCleaningDate.getDate() + 1);
            const dayOfWeek = nextCleaningDate.getUTCDay();
            if (CLEANING_DAYS.includes(dayOfWeek)) {
                nextCleaningDateStr = getIsoDate(nextCleaningDate);
                break;
            }
        }
        
        const scheduleSnapshot = await get(ref(database, `cleaningSchedule/${nextCleaningDateStr}`));
        if (scheduleSnapshot.exists()) {
            throw new Error(`Un turno per ${nextCleaningDateStr} esiste già.`);
        }

        // 2. Trova i 4 membri con il conteggio più basso (LOGICA MODIFICATA)
        const membersSnapshot = await get(membersRef);
        if (!membersSnapshot.exists()) {
            throw new Error("Nessun membro trovato nel database in '/members'.");
        }
        
        const allMembers = membersSnapshot.val(); // Ora è un OGGETTO
        
        // Converti in array e ordina per 'cleaningCount'
        // USIAMO Object.entries() INVECE DI allMembers
        const sortedMembers = Object.entries(allMembers).sort((a, b) => {
            // a[0] è l'UID, a[1] è {name, cleaningCount}
            const countA = a[1].cleaningCount || 0;
            const countB = b[1].cleaningCount || 0;
            return countA - countB;
        });

        const team = sortedMembers.slice(0, NUM_ZONES);
        if (team.length < NUM_ZONES) {
            throw new Error(`Non ci sono abbastanza membri (servono ${NUM_ZONES}, trovati ${team.length}).`);
        }

        // 3. Prepara gli aggiornamenti (Questa logica non cambia)
        const updates = {};
        const assignments = [];
        const zoneShift = nextCleaningDate.getDate() % NUM_ZONES; 

        for (let i = 0; i < NUM_ZONES; i++) {
            const memberId = team[i][0]; // "eb3RJKU..." (Questo ora è l'UID)
            const memberData = team[i][1]; // { name: "simone", ... }
            const newCount = (memberData.cleaningCount || 0) + 1;
            const zoneIndex = (i + zoneShift) % NUM_ZONES;
            const zoneName = ZONES[zoneIndex];

            assignments.push({
                zone: zoneName,
                memberId: memberId, // SALVIAMO L'UID
                memberName: memberData.name,
                done: false
            });
            
            updates[`members/${memberId}/cleaningCount`] = newCount;
        }

        // 4. Aggiungi il nuovo turno e lo stato (Questa logica non cambia)
        updates[`cleaningSchedule/${nextCleaningDateStr}`] = {
            date: nextCleaningDateStr,
            assignments: assignments
        };
        updates[`cleaningState/lastDateGenerated`] = nextCleaningDateStr;

        // 5. Esegui l'aggiornamento
        await update(ref(database), updates);

        // 6. Feedback
        generationFeedback.textContent = `Turno generato per ${nextCleaningDateStr} con successo!`;
        generationFeedback.className = "mt-4 text-sm text-green-600 font-semibold";
        lastCleaningDayInfo.innerHTML = `Ultima sessione generata: <strong>${nextCleaningDateStr}</strong>.`;

    } catch (error) {
        console.error("Errore generazione turni:", error);
        generationFeedback.textContent = `Errore: ${error.message}`;
        generationFeedback.className = "mt-4 text-sm text-red-600 font-semibold";
    } finally {
        generateCleaningBtn.disabled = false;
    }
}


// --- FUNZIONE DI INIZIALIZZAZIONE DELLA PAGINA ---
function initializeAdminPage() {
    // Controlla se siamo effettivamente nella pagina admin (usando un elemento che c'è solo lì)
    if (!userManagementSection) return;

    console.log("Inizializzazione pannello Admin...");

    if (currentUser.role === 'admin') {
        calendarApprovalSection?.classList.remove('hidden');
        financeApprovalSection?.classList.remove('hidden');
        userManagementSection?.classList.remove('hidden');
        
        renderPendingCalendarEvents();
        renderPendingFinanceRequests();
        loadUsersForManagement();
        initializeCleaningModule(); // AGGIUNTA CHIAMATA
        
    } else if (currentUser.role === 'calendar_admin') {
        calendarApprovalSection?.classList.remove('hidden');
        renderPendingCalendarEvents();
        initializeCleaningModule(); // AGGIUNTA CHIAMATA
    }
}

// --- EVENT LISTENERS GLOBALI ---
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

document.addEventListener('click', async (e) => {
    const target = e.target;
    // Modificato per non uscire se non c'è data-key (serve per il pulsante pulizie)
    if (target.matches('.approve-expense-btn')) {
        const key = target.dataset.key;
        const snapshot = await get(ref(database, `expenseRequests/${key}`));
        if (snapshot.exists()) approveExpenseRequest(key, snapshot.val());
    }
    if (target.matches('.reject-expense-btn')) {
        const key = target.dataset.key;
        rejectExpenseRequest(key);
    }
    if (target.matches('.approve-calendar-btn')) {
        const key = target.dataset.key;
        const snapshot = await get(ref(database, `pendingCalendarEvents/${key}`));
        if (snapshot.exists()) approveCalendarEvent(key, snapshot.val());
    }
    if (target.matches('.reject-calendar-btn')) {
        const key = target.dataset.key;
        rejectCalendarEvent(key);
    }
});

// --- PUNTO DI INGRESSO ---
// Aspetta che l'autenticazione sia pronta, poi avvia la logica della pagina.
document.addEventListener('authReady', initializeAdminPage);
