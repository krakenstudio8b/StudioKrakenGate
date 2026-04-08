// js/admin.js (VERSIONE COMPLETA - Team Rotation con Conteggio)
import { database } from './firebase-config.js';
import { ref, onValue, get, set, push, remove, update, query, orderByKey, limitToLast } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';
import { renderLeaderboard, renderLeaderboardHistory, adminSetWeeklyPoints, adminRestoreFromHistory } from './login-points.js';
import { logAudit } from './audit.js';

// --- RIFERIMENTI AGLI ELEMENTI HTML ---
const calendarApprovalSection = document.getElementById('calendar-approval-section');
const financeApprovalSection = document.getElementById('finance-approval-section');
const userManagementSection = document.getElementById('user-management-section');
const pendingEventsContainer = document.getElementById('pending-events-container');
const pendingFinanceContainer = document.getElementById('pending-finance-container');
const usersListEl = document.getElementById('users-list');

// Riferimenti per il modulo CLASSIFICA
const leaderboardSection = document.getElementById('leaderboard-section');
const leaderboardContainer = document.getElementById('leaderboard-container');
const leaderboardHistorySection = document.getElementById('leaderboard-history-section');
const leaderboardHistoryContainer = document.getElementById('leaderboard-history-container');

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
const CLEANING_DAYS = [1, 4]; // 1=Lunedì, 4=Giovedì

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
    logAudit('expense_approved', {
        amount: requestData.amount,
        description: requestData.description,
        requester: requestData.requesterName || 'N/D'
    });
    alert('Spesa approvata e registrata con successo!');
}
async function rejectExpenseRequest(requestKey) {
    if (confirm("Sei sicuro di voler rifiutare questa richiesta? L'azione è irreversibile.")) {
        const requestToUpdateRef = ref(database, `expenseRequests/${requestKey}`);
        const snap = await get(requestToUpdateRef);
        const reqData = snap.val() || {};
        await update(requestToUpdateRef, { status: 'rejected' });
        logAudit('expense_rejected', {
            description: reqData.description || 'N/D',
            requester: reqData.requesterName || 'N/D',
            amount: reqData.amount
        });
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
    logAudit('calendar_event_approved', { title: eventData.title, date: eventData.start });
    alert('Evento approvato e aggiunto al calendario.');
}
async function rejectCalendarEvent(eventKey, eventData) {
    if (confirm("Sei sicuro di voler rifiutare questo evento?")) {
        await remove(ref(database, `pendingCalendarEvents/${eventKey}`));
        logAudit('calendar_event_rejected', { title: eventData?.title || 'N/D', date: eventData?.start });
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

        // 2. Trova i 4 membri con il conteggio più basso
        const membersSnapshot = await get(membersRef);
        if (!membersSnapshot.exists()) {
            throw new Error("Nessun membro trovato nel database in '/members'.");
        }

        const membersData = membersSnapshot.val() || {};

        // Converti in array e ordina per 'cleaningCount'
        const sortedMembers = Object.entries(membersData).sort((a, b) => {
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

        // 6. Audit + Feedback
        logAudit('cleaning_generated', { date: nextCleaningDateStr });
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


// --- AUDIT LOG ---

const AUDIT_ACTION_LABELS = {
    expense_approved:          'Spesa approvata',
    expense_rejected:          'Spesa rifiutata',
    expense_added:             'Spesa aggiunta',
    expense_request_submitted: 'Richiesta spesa inviata',
    fixed_expense_added:       'Spesa fissa aggiunta',
    income_added:              'Entrata aggiunta',
    cash_movement_added:       'Movimento cassa',
    calendar_event_approved:   'Evento approvato',
    calendar_event_rejected:   'Evento rifiutato',
    role_changed:              'Ruolo modificato',
    cleaning_generated:        'Turno pulizie generato',
    task_created:              'Task creato',
    task_updated:              'Task modificato',
    task_deleted:              'Task eliminato',
    task_status_changed:       'Stato task cambiato',
    task_archived:             'Task archiviato',
    item_deleted:              'Elemento eliminato',
    future_movement_deleted:   'Movimento futuro eliminato',
};

function formatAuditDetails(entry) {
    const skip = new Set(['action', 'user', 'uid', 'timestamp']);
    return Object.entries(entry)
        .filter(([k]) => !skip.has(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ') || '—';
}

async function loadAuditLog() {
    const container = document.getElementById('audit-log-container');
    if (!container) return;

    try {
        const auditQuery = query(ref(database, 'auditLog'), orderByKey(), limitToLast(100));
        const snapshot   = await get(auditQuery);

        if (!snapshot.exists()) {
            container.innerHTML = '<tr><td colspan="4" class="p-3 text-gray-400 text-center">Nessuna voce registrata.</td></tr>';
            return;
        }

        const entries = [];
        snapshot.forEach(child => entries.push(child.val()));
        entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const actionColors = {
            approved: 'text-green-700 bg-green-50',
            rejected: 'text-red-700 bg-red-50',
            deleted:  'text-red-700 bg-red-50',
            added:    'text-blue-700 bg-blue-50',
            created:  'text-blue-700 bg-blue-50',
            changed:  'text-orange-700 bg-orange-50',
            generated:'text-indigo-700 bg-indigo-50',
        };

        function badgeClass(action) {
            const key = Object.keys(actionColors).find(k => action.includes(k));
            return key ? actionColors[key] : 'text-gray-700 bg-gray-100';
        }

        container.innerHTML = entries.map(entry => {
            const label   = AUDIT_ACTION_LABELS[entry.action] || entry.action;
            const dt      = new Date(entry.timestamp);
            const dateStr = dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
            const details = formatAuditDetails(entry);
            const badge   = badgeClass(entry.action);
            return `
                <tr class="border-b hover:bg-gray-50 transition-colors">
                    <td class="p-2 text-xs text-gray-500 whitespace-nowrap">${dateStr} ${timeStr}</td>
                    <td class="p-2 text-sm font-medium">${entry.user || '—'}</td>
                    <td class="p-2"><span class="text-xs font-semibold px-2 py-0.5 rounded-full ${badge}">${label}</span></td>
                    <td class="p-2 text-xs text-gray-600 max-w-xs truncate" title="${details}">${details}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<tr><td colspan="4" class="p-3 text-red-500">Errore caricamento: ${err.message}</td></tr>`;
    }
}


// --- BACKUP ---

async function loadBackups() {
    const container = document.getElementById('backup-list-container');
    if (!container) return;

    try {
        const snapshot = await get(ref(database, 'backups'));
        if (!snapshot.exists()) {
            container.innerHTML = '<p class="text-gray-400 text-sm">Nessun backup disponibile. Il primo verrà creato automaticamente alle 03:00.</p>';
            return;
        }

        const keys = Object.keys(snapshot.val()).sort().reverse(); // più recente prima
        container.innerHTML = keys.map(dateKey => {
            const backupData = snapshot.val()[dateKey];
            const createdAt  = backupData?.createdAt ? new Date(backupData.createdAt).toLocaleString('it-IT') : dateKey;
            const expCount   = backupData?.variableExpenses ? Object.keys(backupData.variableExpenses).length : 0;
            const incCount   = backupData?.incomeEntries    ? Object.keys(backupData.incomeEntries).length    : 0;
            const balance    = backupData?.cassaComune?.balance != null ? `€${parseFloat(backupData.cassaComune.balance).toFixed(2)}` : 'N/D';
            return `
                <div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg border flex-wrap gap-2">
                    <div>
                        <p class="font-semibold text-sm">${dateKey}</p>
                        <p class="text-xs text-gray-500">${createdAt} · ${expCount} spese · ${incCount} entrate · Cassa: ${balance}</p>
                    </div>
                    <button data-backup-key="${dateKey}" class="download-backup-btn bg-indigo-600 text-white font-semibold text-sm py-1 px-3 rounded-lg hover:bg-indigo-700 transition-colors">
                        Scarica JSON
                    </button>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = `<p class="text-red-500 text-sm">Errore caricamento backup: ${err.message}</p>`;
    }
}

async function downloadBackup(dateKey) {
    const snapshot = await get(ref(database, `backups/${dateKey}`));
    if (!snapshot.exists()) return alert('Backup non trovato.');
    const data = snapshot.val();
    const blob  = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href     = url;
    a.download = `gateradio-backup-${dateKey}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function runBackupNow() {
    const btn      = document.getElementById('run-backup-btn');
    const feedback = document.getElementById('backup-feedback');
    if (!btn || !feedback) return;

    btn.disabled = true;
    btn.textContent = 'Backup in corso...';
    feedback.textContent = '';

    try {
        const today = new Date().toISOString().split('T')[0];

        const [cassaSnap, varExpSnap, fixedExpSnap, incomeSnap, membersSnap, targetsSnap] =
            await Promise.all([
                get(ref(database, 'cassaComune')),
                get(ref(database, 'variableExpenses')),
                get(ref(database, 'fixedExpenses')),
                get(ref(database, 'incomeEntries')),
                get(ref(database, 'members')),
                get(ref(database, 'targets'))
            ]);

        const snapshot = {
            date:             today,
            createdAt:        new Date().toISOString(),
            cassaComune:      cassaSnap.val(),
            variableExpenses: varExpSnap.val(),
            fixedExpenses:    fixedExpSnap.val(),
            incomeEntries:    incomeSnap.val(),
            members:          membersSnap.val(),
            targets:          targetsSnap.val()
        };

        await set(ref(database, `backups/${today}`), snapshot);
        logAudit('backup_created', { date: today });
        feedback.textContent = `Backup del ${today} completato.`;
        feedback.className = 'mt-3 text-sm font-medium text-green-600';
        await loadBackups();
    } catch (err) {
        feedback.textContent = `Errore: ${err.message}`;
        feedback.className = 'mt-3 text-sm font-medium text-red-600';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Esegui Backup Ora';
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
        initializeCleaningModule();

        leaderboardSection?.classList.remove('hidden');
        leaderboardHistorySection?.classList.remove('hidden');
        renderLeaderboard(leaderboardContainer);
        renderLeaderboardHistory(leaderboardHistoryContainer);

        document.getElementById('audit-log-section')?.classList.remove('hidden');
        document.getElementById('backup-section')?.classList.remove('hidden');
        document.getElementById('gate-radio-section')?.classList.remove('hidden');
        loadAuditLog();
        loadBackups();
        initGateRadioCMS();
    }
}

// --- EVENT LISTENERS GLOBALI ---
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('role-radio')) {
        const uid = e.target.dataset.uid;
        const newRole = e.target.value;
        const userRoleRef = ref(database, `users/${uid}/role`);
        set(userRoleRef, newRole)
            .then(() => {
                logAudit('role_changed', { targetUid: uid, newRole });
                alert(`Ruolo aggiornato con successo.`);
            })
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
        const snapshot = await get(ref(database, `pendingCalendarEvents/${key}`));
        rejectCalendarEvent(key, snapshot.val());
    }
});

// --- RIPRISTINO BULK DA STORICO ---
const restoreBtn = document.getElementById('restore-from-history-btn');
const restoreFeedback = document.getElementById('restore-feedback');

if (restoreBtn) {
    restoreBtn.addEventListener('click', async () => {
        restoreBtn.disabled = true;
        restoreFeedback.textContent = '⏳ Ripristino in corso...';
        try {
            const result = await adminRestoreFromHistory();
            if (result.restored === 0) {
                restoreFeedback.textContent = 'ℹ️ Nessun dato trovato nella history per la settimana corrente.';
            } else {
                const names = Object.entries(result.details)
                    .map(([, pts]) => `${pts}pt`)
                    .join(', ');
                restoreFeedback.textContent = `✅ Ripristinati ${result.restored} utenti. (${names})`;
            }
        } catch (e) {
            restoreFeedback.textContent = '❌ Errore: ' + e.message;
        } finally {
            restoreBtn.disabled = false;
        }
    });
}

// --- OVERRIDE PUNTI SETTIMANALI ---
const overrideBtn = document.getElementById('override-points-btn');
const overrideFeedback = document.getElementById('override-feedback');
const overrideSelect = document.getElementById('override-uid');

// Popola il dropdown con tutti i membri
get(ref(database, 'members')).then(snap => {
    if (!snap.exists() || !overrideSelect) return;
    overrideSelect.innerHTML = '';
    snap.forEach(child => {
        const name = child.val().name || child.key;
        const opt = document.createElement('option');
        opt.value = child.key;
        opt.textContent = name;
        overrideSelect.appendChild(opt);
    });
});

if (overrideBtn) {
    overrideBtn.addEventListener('click', async () => {
        const uid = overrideSelect?.value;
        const points = parseInt(document.getElementById('override-points').value, 10);
        if (!uid) { overrideFeedback.textContent = '❌ Seleziona un utente.'; return; }
        if (isNaN(points) || points < 0 || points > 7) { overrideFeedback.textContent = '❌ Punti non validi (0–7).'; return; }
        overrideBtn.disabled = true;
        overrideFeedback.textContent = '⏳ Salvataggio...';
        try {
            await adminSetWeeklyPoints(uid, points);
            overrideFeedback.textContent = `✅ Punti impostati a ${points}.`;
        } catch (e) {
            overrideFeedback.textContent = '❌ Errore: ' + e.message;
        } finally {
            overrideBtn.disabled = false;
        }
    });
}

// --- BACKUP: event listeners ---
document.addEventListener('click', async (e) => {
    if (e.target.matches('.download-backup-btn')) {
        const dateKey = e.target.dataset.backupKey;
        if (dateKey) downloadBackup(dateKey);
    }
});

const runBackupBtn = document.getElementById('run-backup-btn');
if (runBackupBtn) runBackupBtn.addEventListener('click', runBackupNow);


// ═══════════════════════════════════════════════════════════════════════════
// GATE RADIO CMS
// ═══════════════════════════════════════════════════════════════════════════

window.grSwitchTab = function(tab) {
    document.getElementById('gr-streams-tab').classList.toggle('hidden', tab !== 'streams');
    document.getElementById('gr-events-tab').classList.toggle('hidden', tab !== 'events');
    document.getElementById('gr-tab-streams').className = tab === 'streams'
        ? 'gr-tab bg-indigo-600 text-white py-2 px-5 rounded-lg font-semibold text-sm transition-colors'
        : 'gr-tab bg-gray-200 text-gray-700 py-2 px-5 rounded-lg font-semibold text-sm transition-colors';
    document.getElementById('gr-tab-events').className = tab === 'events'
        ? 'gr-tab bg-indigo-600 text-white py-2 px-5 rounded-lg font-semibold text-sm transition-colors'
        : 'gr-tab bg-gray-200 text-gray-700 py-2 px-5 rounded-lg font-semibold text-sm transition-colors';
};

// Upload immagine su R2 tramite presigned URL
async function grUploadImage(fileInput, folder) {
    const file = fileInput.files[0];
    if (!file) return null;

    // Ottieni token Firebase per autenticazione
    const user = auth.currentUser;
    if (!user) throw new Error('Non autenticato');
    const token = await user.getIdToken();

    // 1. Richiedi presigned URL
    const res = await fetch('/api/r2-presign', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            folder: folder,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Errore server' }));
        throw new Error(err.error || 'Errore generazione URL upload');
    }

    const { presignedUrl, publicUrl } = await res.json();

    // 2. Upload diretto su R2
    const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
    });

    if (!uploadRes.ok) throw new Error('Upload immagine fallito');

    return publicUrl;
}

// Anteprima immagine selezionata
function grSetupImagePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (file) {
            const img = preview.querySelector('img');
            img.src = URL.createObjectURL(file);
            preview.classList.remove('hidden');
        } else {
            preview.classList.add('hidden');
        }
    });
}

// Toggle tra upload file e URL esistente
window.grToggleImageMode = function(prefix, mode) {
    const uploadDiv = document.getElementById(`gr-${prefix}-image-upload`);
    const urlDiv = document.getElementById(`gr-${prefix}-image-url`);
    const btnUpload = document.querySelector(`.gr-img-mode-${prefix}-upload`);
    const btnUrl = document.querySelector(`.gr-img-mode-${prefix}-url`);
    if (mode === 'upload') {
        uploadDiv.classList.remove('hidden');
        urlDiv.classList.add('hidden');
        btnUpload.className = `gr-img-mode-${prefix}-upload text-xs px-3 py-1 rounded-full bg-indigo-600 text-white font-semibold`;
        btnUrl.className = `gr-img-mode-${prefix}-url text-xs px-3 py-1 rounded-full bg-gray-200 text-gray-700 font-semibold`;
    } else {
        uploadDiv.classList.add('hidden');
        urlDiv.classList.remove('hidden');
        btnUrl.className = `gr-img-mode-${prefix}-url text-xs px-3 py-1 rounded-full bg-indigo-600 text-white font-semibold`;
        btnUpload.className = `gr-img-mode-${prefix}-upload text-xs px-3 py-1 rounded-full bg-gray-200 text-gray-700 font-semibold`;
    }
    document.getElementById(`gr-${prefix}-image-preview`).classList.add('hidden');
};

// Ottieni URL immagine: da upload o da URL esistente
async function grGetImageUrl(prefix, folder) {
    const uploadDiv = document.getElementById(`gr-${prefix}-image-upload`);
    const isUploadMode = !uploadDiv.classList.contains('hidden');

    if (isUploadMode) {
        const fileInput = document.getElementById(`gr-${prefix}-image`);
        if (fileInput.files[0]) {
            return await grUploadImage(fileInput, folder);
        }
        return '';
    } else {
        return document.getElementById(`gr-${prefix}-image-existing`).value.trim();
    }
}

function grFeedback(id, msg, ok = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? '#16a34a' : '#dc2626';
    setTimeout(() => { el.textContent = ''; }, 3000);
}

// ── Modale modifica evento/stream ──────────────────────────────────────────
let _grEditGallery = []; // array di URL immagini correnti

window.grOpenEditModal = function(type, key) {
    const modal = document.getElementById('gr-edit-modal');
    const path = type === 'stream' ? `gateRadio/streams/${key}` : `gateRadio/events/${key}`;

    get(ref(database, path)).then(snap => {
        const data = snap.val();
        if (!data) return alert('Elemento non trovato');

        document.getElementById('gr-edit-key').value = key;
        document.getElementById('gr-edit-type').value = type;
        document.getElementById('gr-edit-modal-title').textContent =
            type === 'stream' ? `Modifica: ${data.artist}` : `Modifica: ${data.title}`;

        // Campi comuni
        document.getElementById('gr-edit-title').value = type === 'stream' ? data.title : data.title;
        document.getElementById('gr-edit-date').value = data.date || '';
        document.getElementById('gr-edit-tags').value = (data.tags || []).join(', ');

        // Mostra/nascondi campi specifici
        document.querySelectorAll('.gr-edit-event-only').forEach(el => el.style.display = type === 'event' ? '' : 'none');
        document.querySelectorAll('.gr-edit-stream-only').forEach(el => el.style.display = type === 'stream' ? '' : 'none');

        if (type === 'event') {
            document.getElementById('gr-edit-location').value = data.location || '';
            document.getElementById('gr-edit-description').value = data.description || '';
            document.getElementById('gr-edit-details').value = data.details || '';
            _grEditGallery = data.galleryImages ? [...data.galleryImages] : (data.mainImage ? [data.mainImage] : []);
        } else {
            document.getElementById('gr-edit-artist').value = data.artist || '';
            document.getElementById('gr-edit-season').value = data.season || 'winter';
            document.getElementById('gr-edit-time-start').value = data.timeStart || '18:00';
            document.getElementById('gr-edit-time-end').value = data.timeEnd || '19:00';
            document.getElementById('gr-edit-url').value = data.soundcloudUrl || '';
            _grEditGallery = data.imageUrl ? [data.imageUrl] : [];
        }

        grRenderEditGallery();
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
    });
};

window.grCloseEditModal = function() {
    const modal = document.getElementById('gr-edit-modal');
    modal.style.display = 'none';
    modal.classList.add('hidden');
    _grEditGallery = [];
};

function grRenderEditGallery() {
    const container = document.getElementById('gr-edit-gallery');
    if (!container) return;
    if (_grEditGallery.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-xs">Nessuna immagine</p>';
        return;
    }
    container.innerHTML = _grEditGallery.map((url, i) => `
        <div class="relative group">
            <img src="${url}" class="h-20 w-20 object-cover rounded-lg border" alt="Img ${i + 1}">
            <button type="button" onclick="grRemoveEditImage(${i})"
                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
            ${i === 0 ? '<span class="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-white text-[10px] text-center rounded-b-lg">Principale</span>' : ''}
        </div>
    `).join('');
}

window.grRemoveEditImage = function(index) {
    _grEditGallery.splice(index, 1);
    grRenderEditGallery();
};

window.grAddEditImage = async function() {
    const fileInput = document.getElementById('gr-edit-new-image');
    const urlInput = document.getElementById('gr-edit-new-image-url');
    const feedback = document.getElementById('gr-edit-image-feedback');
    const type = document.getElementById('gr-edit-type').value;
    const folder = type === 'stream' ? 'Grafiche Gate' : 'Eventi Gate';

    try {
        let newUrl = '';
        if (fileInput.files[0]) {
            feedback.textContent = 'Upload in corso...';
            feedback.style.color = '#2563eb';
            newUrl = await grUploadImage(fileInput, folder);
            fileInput.value = '';
        } else if (urlInput.value.trim()) {
            newUrl = urlInput.value.trim();
            urlInput.value = '';
        } else {
            feedback.textContent = 'Seleziona un file o incolla un URL';
            feedback.style.color = '#dc2626';
            return;
        }
        _grEditGallery.push(newUrl);
        grRenderEditGallery();
        feedback.textContent = '✓ Immagine aggiunta';
        feedback.style.color = '#16a34a';
        setTimeout(() => { feedback.textContent = ''; }, 2000);
    } catch (err) {
        feedback.textContent = 'Errore: ' + err.message;
        feedback.style.color = '#dc2626';
    }
};

function grDeleteItem(path, label) {
    if (!confirm(`Eliminare "${label}"?`)) return;
    remove(ref(database, path))
        .then(() => logAudit('gate_radio_delete', { path, label }))
        .catch(err => alert('Errore: ' + err.message));
}
window.grDeleteItem = grDeleteItem;

// Submit modifica
document.getElementById('gr-edit-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const key = document.getElementById('gr-edit-key').value;
    const type = document.getElementById('gr-edit-type').value;
    const path = type === 'stream' ? `gateRadio/streams/${key}` : `gateRadio/events/${key}`;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Salvataggio...';

    try {
        let updates = {};
        const tags = document.getElementById('gr-edit-tags').value.split(',').map(t => t.trim()).filter(Boolean);
        const date = document.getElementById('gr-edit-date').value;

        if (type === 'stream') {
            updates = {
                title: document.getElementById('gr-edit-title').value.trim(),
                artist: document.getElementById('gr-edit-artist').value.trim(),
                date: date,
                timeStart: document.getElementById('gr-edit-time-start').value || '18:00',
                timeEnd: document.getElementById('gr-edit-time-end').value || '19:00',
                season: document.getElementById('gr-edit-season').value,
                soundcloudUrl: document.getElementById('gr-edit-url').value.trim() || '#',
                imageUrl: _grEditGallery[0] || '',
                tags: tags,
            };
        } else {
            updates = {
                title: document.getElementById('gr-edit-title').value.trim(),
                date: date,
                location: document.getElementById('gr-edit-location').value.trim(),
                description: document.getElementById('gr-edit-description').value.trim(),
                details: document.getElementById('gr-edit-details').value.trim(),
                mainImage: _grEditGallery[0] || '',
                galleryImages: _grEditGallery.length > 0 ? _grEditGallery : [],
                tags: tags,
            };
        }

        await update(ref(database, path), updates);
        await logAudit('gate_radio_edit', { type, key, title: updates.title || updates.artist });
        grCloseEditModal();
    } catch (err) {
        const feedback = document.getElementById('gr-edit-feedback');
        feedback.textContent = 'Errore: ' + err.message;
        feedback.style.color = '#dc2626';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salva Modifiche';
    }
});

function initGateRadioCMS() {
    // ── Streams ────────────────────────────────────────────────────────────
    const streamsRef = ref(database, 'gateRadio/streams');

    onValue(streamsRef, snap => {
        const container = document.getElementById('gr-streams-list');
        if (!container) return;
        const data = snap.val();
        if (!data) { container.innerHTML = '<p class="text-gray-400 text-sm">Nessuna live ancora.</p>'; return; }
        const items = Object.entries(data).sort((a, b) => new Date(b[1].date) - new Date(a[1].date));
        container.innerHTML = items.map(([key, s]) => `
            <div class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 border text-sm">
                <div>
                    <span class="font-semibold">${s.artist}</span>
                    <span class="text-gray-400 ml-2">${s.date}</span>
                    <span class="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${s.season}</span>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="grOpenEditModal('stream', '${key}')"
                        class="text-indigo-500 hover:text-indigo-700 text-xs font-semibold">Modifica</button>
                    <button onclick="grDeleteItem('gateRadio/streams/${key}', '${s.artist.replace(/'/g,"\'")}')"
                        class="text-red-500 hover:text-red-700 text-xs font-semibold">Elimina</button>
                </div>
            </div>
        `).join('');
    });

    grSetupImagePreview('gr-s-image', 'gr-s-image-preview');

    document.getElementById('gr-stream-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Caricamento...';
        try {
            grFeedback('gr-stream-feedback', 'Caricamento...');
            const imageUrl = await grGetImageUrl('s', 'Grafiche Gate');

            const stream = {
                artist:       document.getElementById('gr-s-artist').value.trim(),
                title:        document.getElementById('gr-s-title').value.trim() || 'LIVE STREAMING',
                date:         document.getElementById('gr-s-date').value,
                timeStart:    document.getElementById('gr-s-time-start').value || '18:00',
                timeEnd:      document.getElementById('gr-s-time-end').value || '19:00',
                season:       document.getElementById('gr-s-season').value,
                soundcloudUrl: document.getElementById('gr-s-url').value.trim() || '#',
                imageUrl:     imageUrl,
                tags:         document.getElementById('gr-s-tags').value.split(',').map(t => t.trim()).filter(Boolean),
            };
            await push(streamsRef, stream);
            await logAudit('gate_radio_stream_add', { artist: stream.artist, date: stream.date });
            grFeedback('gr-stream-feedback', '✓ Live pubblicata!');
            e.target.reset();
            document.getElementById('gr-s-title').value = 'LIVE STREAMING';
            document.getElementById('gr-s-image-preview').classList.add('hidden');
        } catch (err) {
            grFeedback('gr-stream-feedback', 'Errore: ' + err.message, false);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Pubblica Live';
        }
    });

    // ── Events ─────────────────────────────────────────────────────────────
    const eventsRef = ref(database, 'gateRadio/events');

    onValue(eventsRef, snap => {
        const container = document.getElementById('gr-events-list');
        if (!container) return;
        const data = snap.val();
        if (!data) { container.innerHTML = '<p class="text-gray-400 text-sm">Nessun evento ancora.</p>'; return; }
        const items = Object.entries(data).sort((a, b) => new Date(b[1].date) - new Date(a[1].date));
        container.innerHTML = items.map(([key, ev]) => `
            <div class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2 border text-sm">
                <div>
                    <span class="font-semibold">${ev.title}</span>
                    <span class="text-gray-400 ml-2">${ev.date}</span>
                    <span class="text-gray-500 ml-2 text-xs">${ev.location || ''}</span>
                </div>
                <div class="flex gap-2 ml-4">
                    <button onclick="grOpenEditModal('event', '${key}')"
                        class="text-indigo-500 hover:text-indigo-700 text-xs font-semibold">Modifica</button>
                    <button onclick="grDeleteItem('gateRadio/events/${key}', '${ev.title.replace(/'/g,"\'")}')"
                        class="text-red-500 hover:text-red-700 text-xs font-semibold">Elimina</button>
                </div>
            </div>
        `).join('');
    });

    grSetupImagePreview('gr-e-image', 'gr-e-image-preview');

    document.getElementById('gr-event-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Caricamento...';
        try {
            grFeedback('gr-event-feedback', 'Caricamento...');
            const mainImage = await grGetImageUrl('e', 'Eventi Gate');

            const event = {
                title:       document.getElementById('gr-e-title').value.trim(),
                date:        document.getElementById('gr-e-date').value,
                location:    document.getElementById('gr-e-location').value.trim(),
                description: document.getElementById('gr-e-description').value.trim(),
                details:     document.getElementById('gr-e-details').value.trim(),
                mainImage:   mainImage,
                galleryImages: mainImage ? [mainImage] : [],
                tags: document.getElementById('gr-e-tags').value.split(',').map(t => t.trim()).filter(Boolean),
            };
            await push(eventsRef, event);
            await logAudit('gate_radio_event_add', { title: event.title, date: event.date });
            grFeedback('gr-event-feedback', '✓ Evento pubblicato!');
            e.target.reset();
            document.getElementById('gr-e-image-preview').classList.add('hidden');
        } catch (err) {
            grFeedback('gr-event-feedback', 'Errore: ' + err.message, false);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Pubblica Evento';
        }
    });
}

// --- PUNTO DI INGRESSO ---
// Aspetta che l'autenticazione sia pronta, poi avvia la logica della pagina.
document.addEventListener('authReady', initializeAdminPage);
