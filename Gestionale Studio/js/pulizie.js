// js/pulizie.js
import { database } from './firebase-config.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// --- FUNZIONE PER CAPIRE LA SETTIMANA CORRENTE ---
function getWeekId(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    // Return "YYYY-W##"
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Funzione per ottenere le date di inizio/fine settimana (bonus)
function getWeekDateRange(weekId) {
    const [year, weekNum] = weekId.split('-W').map(Number);
    const d = new Date(Date.UTC(year, 0, 1 + (weekNum - 1) * 7));
    d.setUTCDate(d.getUTCDate() + (1 - (d.getUTCDay() || 7))); // Vai a Lunedì
    const startDate = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    d.setUTCDate(d.getUTCDate() + 6); // Vai a Domenica
    const endDate = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    return `${startDate} - ${endDate}`;
}

// --- FUNZIONE DI INIZIALIZZAZIONE ---
document.addEventListener('authReady', () => {
    const tasksContainer = document.getElementById('tasks-container');
    const loadingMessage = document.getElementById('loading-tasks');
    const weekDatesEl = document.getElementById('week-dates');

    const currentWeekId = getWeekId(); // Es. "2025-W46"
    weekDatesEl.textContent = getWeekDateRange(currentWeekId);

    const weekScheduleRef = ref(database, `cleaningSchedule/${currentWeekId}`);

    onValue(weekScheduleRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            const assignments = data.assignments || [];
            
            // Svuota il contenitore
            tasksContainer.innerHTML = ''; 

            if (assignments.length === 0) {
                tasksContainer.innerHTML = '<p class="text-gray-500">Nessun turno assegnato per questa settimana.</p>';
                return;
            }

            // Crea una card per ogni task
            assignments.forEach((task, index) => {
                const card = document.createElement('div');
                card.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg border';
                
                const isDone = task.done;
                
                card.innerHTML = `
                    <div class="flex items-center">
                        <input id="task-${index}" type="checkbox" ${isDone ? 'checked' : ''} 
                               class="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                        <label for="task-${index}" class="ml-3">
                            <span class="block text-lg font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}">${task.zone}</span>
                            <span class="block text-sm ${isDone ? 'text-gray-400' : 'text-gray-500'}">Assegnato a: <strong>${task.memberName}</strong></span>
                        </label>
                    </div>
                `;
                
                // Aggiungi l'evento alla checkbox
                const checkbox = card.querySelector(`#task-${index}`);
                checkbox.addEventListener('change', (e) => {
                    const doneStatus = e.target.checked;
                    // Scrivi il nuovo stato "done" su Firebase
                    const taskRef = ref(database, `cleaningSchedule/${currentWeekId}/assignments/${index}/done`);
                    update(ref(database), {
                        [`cleaningSchedule/${currentWeekId}/assignments/${index}/done`]: doneStatus
                    });
                });

                tasksContainer.appendChild(card);
            });

        } else {
            // Nessun dato trovato per questa settimana
            loadingMessage.textContent = 'Turni non ancora generati per questa settimana. Contatta un admin.';
        }
    });
});
