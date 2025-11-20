// js/pulizie.js (VERSIONE NUOVA per "Vista Settimanale")
import { database } from './firebase-config.js';
import { ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// --- RIFERIMENTI DOM ---
const substituteModal = document.getElementById('substitute-modal');
const memberToReplaceName = document.getElementById('member-to-replace-name');
const memberSelect = document.getElementById('member-select');
const cancelSubBtn = document.getElementById('cancel-sub-btn');
const confirmSubBtn = document.getElementById('confirm-sub-btn');

// Riferimenti alle 3 card
const dayCards = {
    1: document.getElementById('day-card-1'), // Lunedì
    3: document.getElementById('day-card-3'), // Mercoledì
    5: document.getElementById('day-card-5')  // Venerdì
};

// --- STATO GLOBALE PER IL MODALE ---
let substitutionData = null; // Conterrà { date, taskIndex, oldMemberId, oldMemberName }

// --- FUNZIONI UTILITY ---
function getIsoDate(date) {
    return date.toISOString().split('T')[0];
}

// Funzione per ottenere le date di Lun, Mer, Ven di QUESTA settimana
function getWeekDates() {
    const today = new Date();
    const currentDay = today.getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
    
    // Calcola il Lunedì di questa settimana
    const monday = new Date(today);
    const dayOffset = (currentDay === 0) ? -6 : 1 - currentDay; // Se è Dom, vai indietro di 6, altrimenti vai al Lunedì
    monday.setDate(today.getDate() + dayOffset);

    const wednesday = new Date(monday);
    wednesday.setDate(monday.getDate() + 2);

    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    return {
        1: getIsoDate(monday), // "YYYY-MM-DD"
        3: getIsoDate(wednesday),
        5: getIsoDate(friday)
    };
}

// --- FUNZIONI MODALE (Identiche a prima) ---
async function openSubstituteModal(date, taskIndex, oldMemberId, oldMemberName) {
    substitutionData = { date, taskIndex, oldMemberId, oldMemberName };
    memberToReplaceName.textContent = oldMemberName;
    memberSelect.innerHTML = '<option value="">Caricamento...</option>';
    
    const membersRef = ref(database, 'members');
    const snapshot = await get(membersRef);
    if (snapshot.exists()) {
        memberSelect.innerHTML = '';
        const members = snapshot.val();
        Object.entries(members).forEach(([id, member]) => {
            if (id !== oldMemberId) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${member.name} (Pulizie: ${member.cleaningCount || 0})`;
                memberSelect.appendChild(option);
            }
        });
    }
    substituteModal.classList.remove('hidden');
}

function closeSubstituteModal() {
    substitutionData = null;
    substituteModal.classList.add('hidden');
}

async function handleConfirmSubstitution() {
    if (!substitutionData) return;
    const { date, taskIndex, oldMemberId } = substitutionData;
    const newMemberId = memberSelect.value;
    const newMemberName = memberSelect.options[memberSelect.selectedIndex].text.split(' (')[0];

    if (!newMemberId) {
        alert("Seleziona un membro sostituto.");
        return;
    }
    confirmSubBtn.disabled = true;
    
    try {
        const oldMemberRef = ref(database, `members/${oldMemberId}/cleaningCount`);
        const newMemberRef = ref(database, `members/${newMemberId}/cleaningCount`);
        const [oldMemberSnap, newMemberSnap] = await Promise.all([get(oldMemberRef), get(newMemberRef)]);
        const oldMemberCount = oldMemberSnap.val() || 0;
        const newMemberCount = newMemberSnap.val() || 0;

        const updates = {};
        updates[`cleaningSchedule/${date}/assignments/${taskIndex}/memberId`] = newMemberId;
        updates[`cleaningSchedule/${date}/assignments/${taskIndex}/memberName`] = newMemberName;
        updates[`members/${oldMemberId}/cleaningCount`] = oldMemberCount - 1;
        updates[`members/${newMemberId}/cleaningCount`] = newMemberCount + 1;
        
        await update(ref(database), updates);
        alert('Sostituzione completata!');
        closeSubstituteModal();
    } catch (error) {
        console.error("Errore sostituzione:", error);
        alert("Si è verificato un errore.");
    } finally {
        confirmSubBtn.disabled = false;
    }
}

// --- LOGICA DI VISUALIZZAZIONE PRINCIPALE ---

// Funzione per renderizzare i task dentro una card
function renderTasksInCard(container, date, assignments) {
    container.innerHTML = ''; // Pulisci il "Caricamento..."
    
    if (!assignments || assignments.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Turno non ancora generato dall\'admin.</p>';
        return;
    }

    assignments.forEach((task, index) => {
        const taskEl = document.createElement('div');
        taskEl.className = `flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border ${task.done ? 'bg-gray-100' : 'bg-gray-50'}`;
        
        taskEl.innerHTML = `
            <div class="flex items-center flex-grow">
                <input id="task-${date}-${index}" data-date="${date}" data-index="${index}" type="checkbox" ${task.done ? 'checked' : ''} 
                       class="task-checkbox h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                <label for="task-${date}-${index}" class="ml-3">
                    <span class="block text-lg font-medium ${task.done ? 'text-gray-400 line-through' : 'text-gray-900'}">${task.zone}</span>
                    <span class="block text-sm ${task.done ? 'text-gray-400' : 'text-gray-500'}">Assegnato a: <strong>${task.memberName}</strong></span>
                </label>
            </div>
            <button data-date="${date}" 
                    data-index="${index}"
                    data-member-id="${task.memberId}" 
                    data-member-name="${task.memberName}"
                    class="substitute-btn mt-2 sm:mt-0 sm:ml-4 text-sm bg-gray-200 text-gray-800 font-semibold py-1 px-3 rounded-lg hover:bg-gray-300">
                Sostituisci
            </button>
        `;
        container.appendChild(taskEl);
    });
}


document.addEventListener('authReady', () => {
    const weekDates = getWeekDates(); // { 1: "YYYY-MM-DD", 3: "...", 5: "..." }
    const scheduleRef = ref(database, 'cleaningSchedule');

    // Imposta i titoli delle card
    dayCards[1].querySelector('h2').textContent = `Lunedì ${new Date(weekDates[1] + 'T12:00:00Z').toLocaleDateString('it-IT', {day: 'numeric', month: 'short'})}`;
    dayCards[3].querySelector('h2').textContent = `Mercoledì ${new Date(weekDates[3] + 'T12:00:00Z').toLocaleDateString('it-IT', {day: 'numeric', month: 'short'})}`;
    dayCards[5].querySelector('h2').textContent = `Venerdì ${new Date(weekDates[5] + 'T12:00:00Z').toLocaleDateString('it-IT', {day: 'numeric', month: 'short'})}`;

    // Ascolta l'intero nodo 'cleaningSchedule'
    onValue(scheduleRef, (snapshot) => {
        const allSessions = snapshot.val() || {};
        
        // Controlla e popola ogni card
        Object.keys(dayCards).forEach(dayKey => { // dayKey è 1, 3, o 5
            const dateString = weekDates[dayKey];
            const sessionData = allSessions[dateString]; // Cerca "2025-11-10"
            const container = dayCards[dayKey].querySelector('.space-y-3');

            renderTasksInCard(container, dateString, sessionData ? sessionData.assignments : null);
        });
    });

    // --- EVENT LISTENERS GLOBALI ---
    const weekViewContainer = document.getElementById('cleaning-week-view');

    weekViewContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('task-checkbox')) {
            const date = e.target.dataset.date;
            const index = e.target.dataset.index;
            const isDone = e.target.checked;
            
            const taskRef = ref(database, `cleaningSchedule/${date}/assignments/${index}/done`);
            set(taskRef, isDone);
        }
    });

    weekViewContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('substitute-btn')) {
            const data = e.target.dataset;
            openSubstituteModal(data.date, data.index, data.memberId, data.memberName);
        }
    });

    cancelSubBtn.addEventListener('click', closeSubstituteModal);
    confirmSubBtn.addEventListener('click', handleConfirmSubstitution);
});
