import { database } from './firebase-config.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti Firebase
    const tasksRef = ref(database, 'tasks');
    const membersRef = ref(database, 'members');

    // Stato locale
    let allTasks = [];
    let allMembers = [];
    let currentTaskId = null;

    // Riferimenti DOM
    const columns = {
        todo: document.getElementById('column-todo'),
        inprogress: document.getElementById('column-inprogress'),
        done: document.getElementById('column-done')
    };
    const addTaskBtn = document.getElementById('add-task-btn');
    const modal = document.getElementById('task-modal');
    const modalTitle = document.getElementById('task-modal-title');
    const saveTaskBtn = document.getElementById('save-task-btn');
    const deleteTaskBtn = document.getElementById('delete-task-btn');
    const cancelTaskBtn = document.getElementById('cancel-task-btn');
    const titleInput = document.getElementById('task-title');
    const descriptionInput = document.getElementById('task-description');
    const membersCheckboxesContainer = document.getElementById('task-members-checkboxes');
    const dueDateInput = document.getElementById('task-due-date');
    const prioritySelect = document.getElementById('task-priority');

    const priorityMap = {
        low: { label: 'Bassa', color: 'bg-blue-500' },
        medium: { label: 'Media', color: 'bg-orange-500' },
        high: { label: 'Alta', color: 'bg-red-500' },
    };

    // FUNZIONI PRINCIPALI
    const createTaskCard = (task) => {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.taskId = task.id;

        const priority = priorityMap[task.priority] || priorityMap.low;
        const assignedMembersHtml = (task.assignedTo || [])
            .map(name => `<div class="w-6 h-6 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-xs font-bold" title="${name}">${name.substring(0, 2).toUpperCase()}</div>`)
            .join('');
        
        const dueDateHtml = task.dueDate 
            ? `<div class="text-xs text-gray-500 flex items-center gap-1 mt-2">
                 <i class="fa-regular fa-calendar"></i>
                 <span>${new Date(task.dueDate).toLocaleDateString('it-IT')}</span>
               </div>` 
            : '';

        card.innerHTML = `
            <div class="priority-badge ${priority.color}"></div>
            <p class="font-semibold">${task.title}</p>
            <div class="flex items-center justify-between mt-3">
                <div class="flex -space-x-2">
                    ${assignedMembersHtml}
                </div>
                ${dueDateHtml}
            </div>
        `;

        card.addEventListener('click', () => openModalForEdit(task.id));
        return card;
    };

    const renderTasks = () => {
        // Pulisce le colonne
        Object.values(columns).forEach(col => col.innerHTML = '');
        // Popola le colonne
        allTasks.forEach(task => {
            const card = createTaskCard(task);
            columns[task.status]?.appendChild(card);
        });
    };
    
    const saveData = () => set(tasksRef, allTasks);

    // LOGICA DEL MODALE
    const openModalForNew = () => {
        currentTaskId = null;
        modalTitle.textContent = 'Nuovo Task';
        titleInput.value = '';
        descriptionInput.value = '';
        dueDateInput.value = '';
        prioritySelect.value = 'low';
        membersCheckboxesContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
        deleteTaskBtn.classList.add('hidden');
        modal.classList.remove('hidden');
    };
    
    const openModalForEdit = (taskId) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        
        currentTaskId = taskId;
        modalTitle.textContent = 'Modifica Task';
        titleInput.value = task.title;
        descriptionInput.value = task.description || '';
        dueDateInput.value = task.dueDate || '';
        prioritySelect.value = task.priority || 'low';
        membersCheckboxesContainer.querySelectorAll('input').forEach(cb => {
            cb.checked = (task.assignedTo || []).includes(cb.value);
        });
        deleteTaskBtn.classList.remove('hidden');
        modal.classList.remove('hidden');
    };

    const closeModal = () => modal.classList.add('hidden');

    saveTaskBtn.addEventListener('click', () => {
        const title = titleInput.value.trim();
        if (!title) {
            alert('Il titolo è obbligatorio.');
            return;
        }

        const taskData = {
            title: title,
            description: descriptionInput.value.trim(),
            priority: prioritySelect.value,
            dueDate: dueDateInput.value,
            assignedTo: Array.from(membersCheckboxesContainer.querySelectorAll('input:checked')).map(cb => cb.value)
        };

        if (currentTaskId) { // Modifica
            const taskIndex = allTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                allTasks[taskIndex] = { ...allTasks[taskIndex], ...taskData };
            }
        } else { // Creazione
            const newTask = {
                id: Date.now().toString(),
                status: 'todo', // I nuovi task partono sempre da "Da Fare"
                ...taskData
            };
            allTasks.push(newTask);
        }
        
        saveData();
        renderTasks(); // Ri-renderizza subito per un feedback immediato
        closeModal();
    });

    deleteTaskBtn.addEventListener('click', () => {
        if (currentTaskId && confirm('Sei sicuro di voler eliminare questo task?')) {
            allTasks = allTasks.filter(t => t.id !== currentTaskId);
            saveData();
            renderTasks();
            closeModal();
        }
    });

    cancelTaskBtn.addEventListener('click', closeModal);
    addTaskBtn.addEventListener('click', openModalForNew);

    // INIZIALIZZAZIONE DI SORTABLEJS (DRAG-AND-DROP)
    Object.values(columns).forEach(columnEl => {
        new Sortable(columnEl, {
            group: 'shared', // Permette di spostare le card tra colonne
            animation: 150,
            ghostClass: 'sortable-ghost', // Classe CSS per l'elemento "fantasma"
            onEnd: (evt) => {
                const taskId = evt.item.dataset.taskId;
                const newStatus = evt.to.dataset.status;
                const task = allTasks.find(t => t.id === taskId);
                if (task && task.status !== newStatus) {
                    task.status = newStatus;
                    saveData();
                }
            }
        });
    });

    // CARICAMENTO DATI DA FIREBASE
    onValue(membersRef, (snapshot) => {
        allMembers = snapshot.val() || [];
        membersCheckboxesContainer.innerHTML = '';
        if (allMembers.length > 0) {
            allMembers.forEach(member => {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                div.innerHTML = `
                    <input id="task-member-${member}" type="checkbox" value="${member}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                    <label for="task-member-${member}" class="ml-2 block text-sm text-gray-900">${member}</label>
                `;
                membersCheckboxesContainer.appendChild(div);
            });
        } else {
            membersCheckboxesContainer.innerHTML = '<p class="text-gray-400">Nessun membro trovato.</p>';
        }
    });

    onValue(tasksRef, (snapshot) => {
        allTasks = snapshot.val() || [];
        renderTasks();
    });
});
