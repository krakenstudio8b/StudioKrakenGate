// js/index.js (o come si chiama il JS della tua pagina Attività)
// VERSIONE CORRETTA

import { database } from './firebase-config.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti Firebase
    const tasksRef = ref(database, 'tasks');
    const membersRef = ref(database, 'members');

    // Stato locale
    let allTasks = [];
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
    const checklistContainer = document.getElementById('checklist-container');
    const newChecklistItemInput = document.getElementById('new-checklist-item-input');
    const addChecklistItemBtn = document.getElementById('add-checklist-item-btn');

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

        // Questo codice ora funziona perché salviamo i nomi come array
        const assignedMembersHtml = (task.assignedTo || [])
            .map(memberName => `<div class="w-6 h-6 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center text-xs font-bold" title="${memberName}">${memberName.substring(0, 2).toUpperCase()}</div>`)
            .join('');

        const dueDateHtml = task.dueDate 
            ? `<div class="text-xs text-gray-500 flex items-center gap-1">
                 <i class="fa-regular fa-calendar"></i>
                 <span>${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('it-IT')}</span>
               </div>` 
            : '';

        const checklist = task.checklist || [];
        const completedItems = checklist.filter(item => item.done).length;
        const checklistProgressHtml = checklist.length > 0
            ? `<div class="checklist-progress">
                 <i class="fa-regular fa-square-check"></i>
                 <span>${completedItems}/${checklist.length}</span>
               </div>`
            : '';

        card.innerHTML = `
            <div class="priority-bar ${priority.color}"></div>
            <div class="task-card-content">
                <p class="task-card-title">${task.title}</p>
                <div class="task-card-footer">
                    <div class="flex -space-x-2">
                        ${assignedMembersHtml}
                    </div>
                    <div class="flex items-center gap-3">
                        ${checklistProgressHtml}
                        ${dueDateHtml}
                    </div>
                </div>
            </div>
        `;

        card.addEventListener('click', () => openModalForEdit(task.id));
        return card;
    };
    
    const renderTasks = () => {
        if (!columns.todo) return; // Sicurezza se lo script carica sulla pagina sbagliata
        Object.values(columns).forEach(col => col.innerHTML = '');
        allTasks.forEach(task => {
            const card = createTaskCard(task);
            columns[task.status]?.appendChild(card);
        });
    };
    
    const saveData = () => set(tasksRef, allTasks);

    // LOGICA DEL MODALE E CHECKLIST
    const renderChecklist = (checklist = []) => {
        checklistContainer.innerHTML = '';
        checklist.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'checklist-item';
            itemEl.innerHTML = `
                <input type="checkbox" id="check-${index}" ${item.done ? 'checked' : ''}>
                <label for="check-${index}" class="text-sm">${item.text}</label>
            `;
            checklistContainer.appendChild(itemEl);
        });
    };

    if (addChecklistItemBtn) addChecklistItemBtn.addEventListener('click', () => {
        const text = newChecklistItemInput.value.trim();
        if (!text) return;
        const newItem = { text, done: false };
        const itemEl = document.createElement('div');
        itemEl.className = 'checklist-item';
        itemEl.innerHTML = `
            <input type="checkbox" id="check-new-${Date.now()}">
            <label for="check-new-${Date.now()}" class="text-sm">${text}</label>
        `;
        checklistContainer.appendChild(itemEl);
        newChecklistItemInput.value = '';
    });
    
    const openModalForNew = () => {
        currentTaskId = null;
        modalTitle.textContent = 'Nuovo Task';
        titleInput.value = '';
        descriptionInput.value = '';
        dueDateInput.value = '';
        prioritySelect.value = 'low';
        membersCheckboxesContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
        renderChecklist([]);
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
        renderChecklist(task.checklist);
        deleteTaskBtn.classList.remove('hidden');
        modal.classList.remove('hidden');
    };

    const closeModal = () => modal.classList.add('hidden');

    if (saveTaskBtn) saveTaskBtn.addEventListener('click', () => {
        const title = titleInput.value.trim();
        if (!title) {
            alert('Il titolo è obbligatorio.');
            return;
        }

        const checklistItems = [];
        checklistContainer.querySelectorAll('.checklist-item').forEach(itemEl => {
            const checkbox = itemEl.querySelector('input[type="checkbox"]');
            const label = itemEl.querySelector('label');
            if (label && label.textContent) {
                checklistItems.push({
                    text: label.textContent,
                    done: checkbox.checked
                });
            }
        });

        const taskData = {
            title: title,
            description: descriptionInput.value.trim(),
            priority: prioritySelect.value,
            dueDate: dueDateInput.value,
            assignedTo: Array.from(membersCheckboxesContainer.querySelectorAll('input:checked')).map(cb => cb.value),
            checklist: checklistItems
        };

        if (currentTaskId) {
            const taskIndex = allTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                allTasks[taskIndex] = { ...allTasks[taskIndex], ...taskData };
            }
        } else {
            const newTask = {
                id: Date.now().toString(),
                status: 'todo',
                ...taskData
            };
            allTasks.push(newTask);
        }
        
        saveData();
        renderTasks();
        closeModal();
    });

    if (deleteTaskBtn) deleteTaskBtn.addEventListener('click', () => {
        if (currentTaskId && confirm('Sei sicuro di voler eliminare questo task?')) {
            allTasks = allTasks.filter(t => t.id !== currentTaskId);
            saveData();
            renderTasks();
            closeModal();
        }
    });

    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeModal);
    if (addTaskBtn) addTaskBtn.addEventListener('click', openModalForNew);

    // INIZIALIZZAZIONE DI SORTABLEJS (DRAG-AND-DROP)
    if (columns.todo) { // Esegui solo se le colonne esistono
        Object.values(columns).forEach(columnEl => {
            new Sortable(columnEl, {
                group: 'shared',
                animation: 150,
                ghostClass: 'sortable-ghost',
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
    }

    // ==========================================================
    // --- BLOCCO CARICAMENTO MEMBRI (CORRETTO) ---
    // ==========================================================
    onValue(membersRef, (snapshot) => {
        // 1. Prendiamo i dati come OGGETTO
        const membersObject = snapshot.val() || {};
        
        // 2. Trasformiamo l'oggetto in un array di [uid, {name: "...", ...}]
        const allMemberEntries = Object.entries(membersObject);

        if (membersCheckboxesContainer) {
            membersCheckboxesContainer.innerHTML = '';
            if (allMemberEntries.length > 0) {
                
                // 3. Iteriamo sul nuovo array
                allMemberEntries.forEach(([uid, member]) => {
                    // 'uid' è la chiave (es. "eb3RJKU...")
                    // 'member' è l'oggetto (es. { name: "simone", ... })
                    
                    const div = document.createElement('div');
                    div.className = 'flex items-center';
                    
                    // 4. Usiamo l'UID per l'ID e member.name per il testo e il valore
                    div.innerHTML = `
                        <input id="task-member-${uid}" type="checkbox" value="${member.name}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                        <label for="task-member-${uid}" class="ml-2 block text-sm text-gray-900">${member.name}</label>
                    `;
                    membersCheckboxesContainer.appendChild(div);
                });
            } else {
                membersCheckboxesContainer.innerHTML = '<p class="text-gray-400">Nessun membro trovato.</p>';
            }
        }
    });
    // ==========================================================
    // --- FINE BLOCCO CORRETTO ---
    // ==========================================================

    // Caricamento task
    onValue(tasksRef, (snapshot) => {
        // Controlla se i task sono un array (vecchio formato) o un oggetto
        const tasksData = snapshot.val();
        if (Array.isArray(tasksData)) {
            allTasks = tasksData;
        } else if (typeof tasksData === 'object' && tasksData !== null) {
            allTasks = Object.values(tasksData);
        } else {
            allTasks = [];
        }
        renderTasks();
    });
});
