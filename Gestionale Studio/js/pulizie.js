// js/pulizie.js (VERSIONE NUOVA per Team Rotation)
import { database } from './firebase-config.js';
import { ref, onValue, update, query, orderByChild, startAt, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// --- RIFERIMENTI DOM ---
const sessionsListContainer = document.getElementById('cleaning-sessions-list');
const loadingMessage = document.getElementById('loading-tasks');
const substituteModal = document.getElementById('substitute-modal');
const memberToReplaceName = document.getElementById('member-to-replace-name');
const memberSelect = document.getElementById('member-select');
const cancelSubBtn = document.getElementById('cancel-sub-btn');
const confirmSubBtn = document.getElementById('confirm-sub-btn');

// --- STATO GLOBALE PER IL MODALE ---
let substitutionData = null; // Conterrà { date, taskIndex, oldMemberId, oldMemberName }

// --- FUNZIONI UTILITY ---
function getIsoDate(date) {
    return date.toISOString().split('T')[0];
}
function getReadableDate(dateString) {
    const date = new Date(dateString + 'T12:00:00Z');
    return date.toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

// --- FUNZIONI MODALE ---
async function openSubstituteModal(date, taskIndex, oldMemberId, oldMemberName) {
    substitutionData = { date, taskIndex, oldMemberId, oldMemberName };
    memberToReplaceName.textContent = oldMemberName;
    memberSelect.innerHTML = '<option value="">Caricamento...</option>';
    
    // Carica tutti i membri tranne quello da sostituire
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

    const { date, taskIndex, oldMemberId, oldMemberName } = substitutionData;
    const newMemberId = memberSelect.value;
    const newMemberName = memberSelect.options[memberSelect.selectedIndex].text.split(' (')[0];

    if (!newMemberId) {
        alert("Seleziona un membro sostituto.");
        return;
    }

    confirmSubBtn.disabled = true;
    
    try {
        // 1. Prendi i conteggi attuali
        const oldMemberRef = ref(database, `members/${oldMemberId}/cleaningCount`);
        const newMemberRef = ref(database, `members/${newMemberId}/cleaningCount`);
        
        const [oldMemberSnap, newMemberSnap] = await Promise.all([get(oldMemberRef), get(newMemberRef)]);
        
        const oldMemberCount = oldMemberSnap.val() || 0;
        const newMemberCount = newMemberSnap.val() || 0;

        // 2. Prepara l'aggiornamento
        const updates = {};
        // Aggiorna il turno
        updates[`cleaningSchedule/${date}/assignments/${taskIndex}/memberId`] = newMemberId;
        updates[`cleaningSchedule/${date}/assignments/${taskIndex}/memberName`] = newMemberName;
        // Aggiorna i conteggi (la parte fondamentale)
        updates[`members/${oldMemberId}/cleaningCount`] = oldMemberCount - 1;
        updates[`members/${newMemberId}/cleaningCount`] = newMemberCount + 1;
        
        // 3. Esegui l'aggiornamento
        await update(ref(database), updates);

        alert('Sostituzione completata! Il conteggio è stato aggiornato.');
        closeSubstituteModal();
    } catch (error) {
        console.error("Errore durante la sostituzione:", error);
        alert("Si è verificato un errore.");
    } finally {
        confirmSubBtn.disabled = false;
    }
}

// --- LOGICA DI VISUALIZZAZIONE PRINCIPALE ---
document.addEventListener('authReady', () => {
    const todayString = getIsoDate(new Date());
    const scheduleRef = ref(database, 'cleaningSchedule');
    const q = query(scheduleRef, orderByChild('date'), startAt(todayString));

    onValue(q, (snapshot) => {
        if (snapshot.exists()) {
            sessionsListContainer.innerHTML = ''; // Pulisci
            
            snapshot.forEach(childSnapshot => {
                const date = childSnapshot.key; // "YYYY-MM-DD"
                const session = childSnapshot.val();
                
                const sessionCard = document.createElement('div');
                sessionCard.className = 'card fade-in';
                sessionCard.innerHTML = `<h2 class="text-2xl font-semibold mb-4 border-b pb-2">${getReadableDate(date)}</h2><div class="space-y-3"></div>`;
                
                const tasksContainer = sessionCard.querySelector('.space-y-3');

                session.assignments.forEach((task, index) => {
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
                    tasksContainer.appendChild(taskEl);
                });
                sessionsListContainer.appendChild(sessionCard);
            });
        } else {
            loadingMessage.textContent = 'Nessun turno di pulizia in programma. Contatta un admin per generarli.';
        }
    });

    // --- EVENT LISTENERS GLOBALI ---
    sessionsListContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('task-checkbox')) {
            const date = e.target.dataset.date;
            const index = e.target.dataset.index;
            const isDone = e.target.checked;
            
            const taskRef = ref(database, `cleaningSchedule/${date}/assignments/${index}/done`);
            set(taskRef, isDone);
        }
    });

    sessionsListContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('substitute-btn')) {
            const data = e.target.dataset;
            openSubstituteModal(data.date, data.index, data.memberId, data.memberName);
        }
    });

    cancelSubBtn.addEventListener('click', closeSubstituteModal);
    confirmSubBtn.addEventListener('click', handleConfirmSubstitution);
});
