// js/admin.js (VERSIONE COMPLETA, CON MODULO PULIZIE INTEGRATO)
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
const weekSelect = document.getElementById('week-select');
const generateCleaningBtn = document.getElementById('generate-cleaning-btn');
const generationFeedback = document.getElementById('generation-feedback');


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
const cleaningScheduleBaseRef = ref(database, 'cleaningSchedule'); // Ref di base


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

// Utility per PULIZIE: Calcolo ID settimana
function getWeekId(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + 7 * offset); 
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Utility per PULIZIE: Calcolo date settimana
function getWeekDateRange(weekId) {
    const [year, weekNum] = weekId.split('-W').map(Number);
    const d = new Date(Date.UTC(year, 0, 1 + (weekNum - 1) * 7));
    d.setUTCDate(d.getUTCDate() + (1 - (d.getUTCDay() || 7))); // Lunedì
    const start = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    d.setUTCDate(d.getUTCDate() + 6); // Domenica
    const end = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    return `${start} - ${end}`;
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
function initializeCleaningModule() {
    // Mostra la sezione (il controllo permessi è già in initializeAdminPage)
    cleaningManagementSection.classList.remove('hidden'); 

    // Popola il selettore con la settimana corrente e le 3 successive
    weekSelect.innerHTML = ''; // Pulisci opzioni vecchie
    for (let i = 0; i < 4; i++) {
        const weekId = getWeekId(i);
        const option = document.createElement('option');
        option.value = weekId;
        option.textContent = `Settimana ${weekId.split('-W')[1]} (${getWeekDateRange(weekId)})`;
        weekSelect.appendChild(option);
    }

    // Aggiungi l'listener al pulsante
    // Rimuovi listener vecchi per sicurezza se questa funzione viene chiamata più volte
    generateCleaningBtn.removeEventListener('click', handleGeneration); 
    generateCleaningBtn.addEventListener('click', handleGeneration);
}

async function handleGeneration() {
    generateCleaningBtn.disabled = true;
    generationFeedback.textContent = "Sto generando i turni...";
    generationFeedback.className = "mt-4 text-sm text-yellow-600";
    const selectedWeekId = weekSelect.value; 

    try {
        // 1. Controlla se i turni per quella settimana esistono GIÀ
        const scheduleRef = ref(database, `cleaningSchedule/${selectedWeekId}`);
        const scheduleSnapshot = await get(scheduleRef);
        if (scheduleSnapshot.exists()) {
            throw new Error(`I turni per la settimana ${selectedWeekId} esistono già.`);
        }

        // 2. Recupera tutti i membri ('members') e lo stato attuale
        const [membersSnapshot, stateSnapshot] = await Promise.all([
            get(membersRef),
            get(cleaningStateRef)
        ]);

        if (!membersSnapshot.exists() || membersSnapshot.val().length === 0) {
            throw new Error("Lista 'members' non trovata o vuota in Firebase.");
        }

        const allMembers = Array.isArray(membersSnapshot.val()) 
            ? membersSnapshot.val() 
            : Object.values(membersSnapshot.val());

        const currentState = stateSnapshot.val() || { lastMemberIndex: -1 };
        let lastIndex = currentState.lastMemberIndex;

        // 3. Seleziona i prossimi N membri
        const membersForThisWeek = [];
        for (let i = 0; i < NUM_ZONES; i++) {
            lastIndex++;
            if (lastIndex >= allMembers.length) {
                lastIndex = 0;
            }
            membersForThisWeek.push(allMembers[lastIndex]);
        }
        
        // 4. Calcola la rotazione delle ZONE
        const weekNumber = parseInt(selectedWeekId.split('-W')[1], 10);
        const zoneShift = weekNumber % NUM_ZONES; // 0, 1, 2, o 3

        const assignments = [];
        for (let i = 0; i < NUM_ZONES; i++) {
            const member = membersForThisWeek[i];
            const zoneIndex = (i + zoneShift) % NUM_ZONES; // Applica rotazione
            const zoneName = ZONES[zoneIndex];

            assignments.push({
                zone: zoneName,
                memberId: member.id || 'id_sconosciuto', // Assicurati che i membri abbiano 'id'
                memberName: member.name,
                done: false
            });
        }

        // 5. Prepara l'oggetto da salvare
        const weekDates = getWeekDateRange(selectedWeekId).split(' - ');
        const newSchedule = {
            startDate: weekDates[0],
            endDate: weekDates[1],
            assignments: assignments
        };

        // 6. Scrivi i dati su Firebase
        const updates = {};
        updates[`cleaningSchedule/${selectedWeekId}`] = newSchedule;
        updates[`cleaningState/lastMemberIndex`] = lastIndex;

        await update(ref(database), updates);

        // 7. Feedback finale
        generationFeedback.textContent = `Turni per la settimana ${selectedWeekId} generati con successo!`;
        generationFeedback.className = "mt-4 text-sm text-green-600 font-semibold";

    } catch (error) {
        console.error("Errore generazione turni:", error);
        generationFeedback.textContent = `Errore: ${error.message}`;
        generationFeedback.className = "mt-4 text-sm text-red-600 font-semibold";
    } finally {
        generateCleaningBtn.disabled = false; // Riattiva il pulsante
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
    const key = target.dataset.key;
    if (!key) return; // Esce subito se non c'è un data-key (ignora il pulsante pulizie)

    if (target.matches('.approve-expense-btn')) {
        const snapshot = await get(ref(database, `expenseRequests/${key}`));
        if (snapshot.exists()) approveExpenseRequest(key, snapshot.val());
    }
    if (target.matches('.reject-expense-btn')) {
        rejectExpenseRequest(key);
    }
    if (target.matches('.approve-calendar-btn')) {
        const snapshot = await get(ref(database, `pendingCalendarEvents/${key}`));
        if (snapshot.exists()) approveCalendarEvent(key, snapshot.val());
    }
    if (target.matches('.reject-calendar-btn')) {
        rejectCalendarEvent(key);
    }
});

// --- PUNTO DI INGRESSO ---
// Aspetta che l'autenticazione sia pronta, poi avvia la logica della pagina.
document.addEventListener('authReady', initializeAdminPage);
