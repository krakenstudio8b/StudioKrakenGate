// js/attivita.js
// Sistema Kanban con Owner e createdAt

import { database } from './firebase-config.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

document.addEventListener('DOMContentLoaded', () => {
    // Riferimenti Firebase
    const tasksRef = ref(database, 'tasks');
    const membersRef = ref(database, 'members');
    const templatesRef = ref(database, 'taskTemplates');

    // Stato locale
    let allTasks = [];
    let allMembers = [];
    let allTemplates = [];
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
    const ownerSelect = document.getElementById('task-owner');
    const membersCheckboxesContainer = document.getElementById('task-members-checkboxes');
    const dueDateInput = document.getElementById('task-due-date');
    const prioritySelect = document.getElementById('task-priority');
    const checklistContainer = document.getElementById('checklist-container');
    const newChecklistItemInput = document.getElementById('new-checklist-item-input');
    const newChecklistAssignee = document.getElementById('new-checklist-assignee');
    const addChecklistItemBtn = document.getElementById('add-checklist-item-btn');
    const commentsSection = document.getElementById('comments-section');
    const commentsContainer = document.getElementById('comments-container');
    const newCommentInput = document.getElementById('new-comment-input');
    const addCommentBtn = document.getElementById('add-comment-btn');
    const templateSection = document.getElementById('template-section');
    const templateSelect = document.getElementById('template-select');
    const applyTemplateBtn = document.getElementById('apply-template-btn');

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

        // Owner badge
        const ownerHtml = task.owner
            ? `<div class="owner-badge flex items-center gap-1 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                 <i class="fa-solid fa-user-tie text-[10px]"></i>
                 <span>${task.owner}</span>
               </div>`
            : '';

        // Partecipanti (escludendo l'owner per evitare duplicati)
        const participants = (task.assignedTo || []).filter(name => name !== task.owner);
        const assignedMembersHtml = participants
            .map(memberName => `<div class="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold" title="${memberName}">${memberName.substring(0, 2).toUpperCase()}</div>`)
            .join('');

        // Calcola stato scadenza
        let dueDateClass = 'text-gray-500';
        if (task.dueDate && task.status !== 'done') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const due = new Date(task.dueDate + 'T00:00:00');
            const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) dueDateClass = 'text-red-600 font-semibold';
            else if (diffDays <= 3) dueDateClass = 'text-orange-500 font-semibold';
        }

        const dueDateHtml = task.dueDate
            ? `<div class="text-xs ${dueDateClass} flex items-center gap-1">
                 <i class="fa-regular fa-calendar"></i>
                 <span>${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('it-IT')}</span>
               </div>`
            : '';

        const checklist = task.checklist || [];
        const completedItems = checklist.filter(item => item.done).length;
        // Verifica se ci sono attività bloccate (la prossima non completata ha un predecessore non completato)
        const hasBlockedItems = checklist.length > 1 && completedItems < checklist.length && completedItems < checklist.length - 1;
        const lockHtml = hasBlockedItems && task.status !== 'done'
            ? `<div class="blocked-badge" title="${checklist.length - completedItems - 1} attività bloccate"><i class="fa-solid fa-lock"></i></div>`
            : '';
        const checklistProgressHtml = checklist.length > 0
            ? `<div class="checklist-progress">
                 <i class="fa-regular fa-square-check"></i>
                 <span>${completedItems}/${checklist.length}</span>
                 ${lockHtml}
               </div>`
            : '';

        card.innerHTML = `
            <div class="priority-bar ${priority.color}"></div>
            <div class="task-card-content">
                <div class="flex items-start justify-between gap-2 mb-1">
                    <p class="task-card-title flex-1">${task.title}</p>
                    ${ownerHtml}
                </div>
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

    // Ordina i task per scadenza (più vicina prima, senza scadenza in fondo)
    const sortByDueDate = (tasks) => {
        return [...tasks].sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
        });
    };

    // Calcola le attività in scadenza questa settimana (non completate)
    const getThisWeekTasks = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (7 - today.getDay())); // fine domenica
        endOfWeek.setHours(23, 59, 59, 999);

        return allTasks.filter(task => {
            if (!task.dueDate || task.status === 'done') return false;
            const due = new Date(task.dueDate + 'T00:00:00');
            return due >= today && due <= endOfWeek;
        });
    };

    const renderWeekAlert = () => {
        const existing = document.getElementById('week-alert');
        if (existing) existing.remove();

        const weekTasks = getThisWeekTasks();
        if (weekTasks.length === 0) return;

        const alertDiv = document.createElement('div');
        alertDiv.id = 'week-alert';
        alertDiv.className = 'week-alert';

        const taskList = weekTasks
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map(t => {
                const dateStr = new Date(t.dueDate + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
                const isOverdue = new Date(t.dueDate + 'T00:00:00') < new Date(new Date().toDateString());
                const badge = isOverdue ? '<span class="overdue-badge">SCADUTO</span>' : '';
                return `<li>${badge}<strong>${t.title}</strong> — ${dateStr}</li>`;
            })
            .join('');

        alertDiv.innerHTML = `
            <div class="week-alert-header">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>${weekTasks.length} attività in scadenza questa settimana</span>
            </div>
            <ul class="week-alert-list">${taskList}</ul>
        `;

        const board = document.getElementById('kanban-board');
        board.parentNode.insertBefore(alertDiv, board);
    };

    const renderTasks = () => {
        if (!columns.todo) return;
        Object.values(columns).forEach(col => col.innerHTML = '');
        const sorted = sortByDueDate(allTasks);
        sorted.forEach(task => {
            const card = createTaskCard(task);
            columns[task.status]?.appendChild(card);
        });
        renderWeekAlert();
    };

    const saveData = () => set(tasksRef, allTasks);

    // Popola il select Owner
    const populateOwnerSelect = () => {
        if (!ownerSelect) return;

        // Mantieni l'opzione vuota
        ownerSelect.innerHTML = '<option value="">-- Nessun responsabile --</option>';

        allMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.name;
            option.textContent = member.name;
            ownerSelect.appendChild(option);
        });
    };

    // LOGICA DEL MODALE E CHECKLIST
    const renderChecklist = (checklist = []) => {
        checklistContainer.innerHTML = '';
        checklist.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'checklist-item';

            // Blocco sequenziale: l'item è bloccato se il precedente non è completato
            const isBlocked = index > 0 && !checklist[index - 1].done;

            // Select per cambiare assegnatario
            const assigneeOptions = allMembers.map(m =>
                `<option value="${m.name}" ${item.assignee === m.name ? 'selected' : ''}>${m.name}</option>`
            ).join('');

            const lockIcon = isBlocked ? '<i class="fa-solid fa-lock text-red-400 text-xs mr-1" title="Completa prima l\'attività precedente"></i>' : '';
            const blockedClass = isBlocked ? 'checklist-blocked' : '';

            itemEl.classList.add(blockedClass || 'checklist-unlocked');

            itemEl.innerHTML = `
                ${lockIcon}
                <input type="checkbox" id="check-${index}" ${item.done ? 'checked' : ''} ${isBlocked ? 'disabled' : ''}>
                <label for="check-${index}" class="text-sm flex-1">${item.text}</label>
                <input type="date" class="checklist-duedate text-xs p-1 border rounded bg-white ml-1" value="${item.dueDate || ''}" data-index="${index}" title="Scadenza">
                <select class="checklist-assignee-select text-xs p-1 border rounded bg-white ml-1" data-index="${index}">
                    <option value="">Nessuno</option>
                    <option value="tutti" ${item.assignee === 'tutti' ? 'selected' : ''}>👥 Tutti</option>
                    ${assigneeOptions}
                </select>
                <button type="button" class="checklist-delete-btn ml-1 text-red-500 hover:text-red-700" data-index="${index}">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            `;
            checklistContainer.appendChild(itemEl);
        });
    };

    const newChecklistDueDate = document.getElementById('new-checklist-duedate');

    if (addChecklistItemBtn) addChecklistItemBtn.addEventListener('click', () => {
        const text = newChecklistItemInput.value.trim();
        if (!text) return;

        const assignee = newChecklistAssignee ? newChecklistAssignee.value : '';
        const dueDate = newChecklistDueDate ? newChecklistDueDate.value : '';
        const index = checklistContainer.querySelectorAll('.checklist-item').length;
        const id = `check-new-${Date.now()}`;

        const assigneeOptions = allMembers.map(m =>
            `<option value="${m.name}" ${assignee === m.name ? 'selected' : ''}>${m.name}</option>`
        ).join('');

        const itemEl = document.createElement('div');
        itemEl.className = 'checklist-item';
        itemEl.innerHTML = `
            <input type="checkbox" id="${id}">
            <label for="${id}" class="text-sm flex-1">${text}</label>
            <input type="date" class="checklist-duedate text-xs p-1 border rounded bg-white ml-1" value="${dueDate}" data-index="${index}" title="Scadenza">
            <select class="checklist-assignee-select text-xs p-1 border rounded bg-white ml-1" data-index="${index}">
                <option value="">Nessuno</option>
                <option value="tutti" ${assignee === 'tutti' ? 'selected' : ''}>👥 Tutti</option>
                ${assigneeOptions}
            </select>
            <button type="button" class="checklist-delete-btn ml-1 text-red-500 hover:text-red-700" data-index="${index}">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        `;
        checklistContainer.appendChild(itemEl);
        newChecklistItemInput.value = '';
        if (newChecklistAssignee) newChecklistAssignee.value = '';
        if (newChecklistDueDate) newChecklistDueDate.value = '';
    });

    // COMMENTI
    const renderComments = (comments = []) => {
        if (!commentsContainer) return;
        commentsContainer.innerHTML = '';
        if (comments.length === 0) {
            commentsContainer.innerHTML = '<p class="text-gray-400 text-sm">Nessun commento</p>';
            return;
        }
        comments.forEach(c => {
            const date = new Date(c.timestamp);
            const dateStr = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            const div = document.createElement('div');
            div.className = 'comment-item';
            div.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${c.author}</span>
                    <span class="comment-date">${dateStr}</span>
                </div>
                <p class="comment-text">${c.text}</p>
            `;
            commentsContainer.appendChild(div);
        });
        commentsContainer.scrollTop = commentsContainer.scrollHeight;
    };

    if (addCommentBtn) addCommentBtn.addEventListener('click', () => {
        const text = newCommentInput.value.trim();
        if (!text || !currentTaskId) return;
        const task = allTasks.find(t => t.id === currentTaskId);
        if (!task) return;
        if (!task.comments) task.comments = [];
        task.comments.push({
            text,
            author: currentUser.name || 'Anonimo',
            timestamp: new Date().toISOString()
        });
        saveData();
        renderComments(task.comments);
        newCommentInput.value = '';
    });

    if (newCommentInput) newCommentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addCommentBtn.click();
    });

    // TEMPLATE
    const populateTemplateSelect = () => {
        if (!templateSelect) return;
        templateSelect.innerHTML = '<option value="">-- Scegli un template --</option>';
        allTemplates.forEach(tpl => {
            const option = document.createElement('option');
            option.value = tpl.id;
            option.textContent = tpl.name;
            templateSelect.appendChild(option);
        });
    };

    if (applyTemplateBtn) applyTemplateBtn.addEventListener('click', () => {
        const tplId = templateSelect.value;
        if (!tplId) return;
        const template = allTemplates.find(t => t.id === tplId);
        if (!template) return;
        titleInput.value = template.title || '';
        descriptionInput.value = template.description || '';
        prioritySelect.value = template.priority || 'medium';
        renderChecklist((template.checklist || []).map(item => ({ ...item, done: false })));
    });

    const openModalForNew = () => {
        currentTaskId = null;
        modalTitle.textContent = 'Nuovo Task';
        titleInput.value = '';
        descriptionInput.value = '';
        dueDateInput.value = '';
        prioritySelect.value = 'low';
        if (ownerSelect) ownerSelect.value = '';
        membersCheckboxesContainer.querySelectorAll('input').forEach(cb => cb.checked = false);
        renderChecklist([]);
        deleteTaskBtn.classList.add('hidden');
        if (commentsSection) commentsSection.classList.add('hidden');
        if (templateSection) templateSection.classList.remove('hidden');
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
        if (ownerSelect) ownerSelect.value = task.owner || '';
        membersCheckboxesContainer.querySelectorAll('input').forEach(cb => {
            cb.checked = (task.assignedTo || []).includes(cb.value);
        });
        renderChecklist(task.checklist);
        renderComments(task.comments || []);
        deleteTaskBtn.classList.remove('hidden');
        if (commentsSection) commentsSection.classList.remove('hidden');
        if (templateSection) templateSection.classList.add('hidden');
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
            const assigneeSelect = itemEl.querySelector('.checklist-assignee-select');
            const dueDateEl = itemEl.querySelector('.checklist-duedate');
            if (label && label.textContent) {
                checklistItems.push({
                    text: label.textContent,
                    done: checkbox.checked,
                    assignee: assigneeSelect ? assigneeSelect.value : '',
                    dueDate: dueDateEl ? dueDateEl.value : ''
                });
            }
        });

        const taskData = {
            title: title,
            description: descriptionInput.value.trim(),
            priority: prioritySelect.value,
            dueDate: dueDateInput.value,
            owner: ownerSelect ? ownerSelect.value : '',
            assignedTo: Array.from(membersCheckboxesContainer.querySelectorAll('input:checked')).map(cb => cb.value),
            checklist: checklistItems
        };

        if (currentTaskId) {
            // Modifica task esistente - mantieni i commenti
            const taskIndex = allTasks.findIndex(t => t.id === currentTaskId);
            if (taskIndex !== -1) {
                taskData.comments = allTasks[taskIndex].comments || [];
                allTasks[taskIndex] = { ...allTasks[taskIndex], ...taskData };
            }
        } else {
            // Nuovo task con createdAt
            const now = Date.now();
            const newTask = {
                id: now.toString(),
                status: 'todo',
                createdAt: new Date(now).toISOString(),
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
    if (columns.todo) {
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

    // CARICAMENTO MEMBRI
    onValue(membersRef, (snapshot) => {
        const membersObject = snapshot.val() || {};
        const allMemberEntries = Object.entries(membersObject);

        // Salva membri per uso globale
        allMembers = allMemberEntries.map(([uid, member]) => ({
            uid,
            name: member.name,
            ...member
        }));

        // Popola checkboxes partecipanti
        if (membersCheckboxesContainer) {
            membersCheckboxesContainer.innerHTML = '';
            if (allMemberEntries.length > 0) {
                allMemberEntries.forEach(([uid, member]) => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center';
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

        // Popola select Owner
        populateOwnerSelect();

        // Popola select assegnatario checklist
        if (newChecklistAssignee) {
            newChecklistAssignee.innerHTML = '<option value="">Nessuno</option><option value="tutti">👥 Tutti</option>';
            allMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.name;
                option.textContent = member.name;
                newChecklistAssignee.appendChild(option);
            });
        }
    });

    // Event delegation per eliminare item checklist e gestire blocco sequenziale
    if (checklistContainer) {
        checklistContainer.addEventListener('click', (e) => {
            if (e.target.closest('.checklist-delete-btn')) {
                const btn = e.target.closest('.checklist-delete-btn');
                const itemEl = btn.closest('.checklist-item');
                if (itemEl) {
                    itemEl.remove();
                }
            }
        });

        // Re-render checklist quando si spunta un checkbox (sblocca il successivo)
        checklistContainer.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const currentChecklist = getCurrentChecklistState();
                renderChecklist(currentChecklist);
            }
        });
    }

    // Legge lo stato corrente della checklist dal DOM
    const getCurrentChecklistState = () => {
        const items = [];
        checklistContainer.querySelectorAll('.checklist-item').forEach(itemEl => {
            const checkbox = itemEl.querySelector('input[type="checkbox"]');
            const label = itemEl.querySelector('label');
            const assigneeSelect = itemEl.querySelector('.checklist-assignee-select');
            const dueDateEl = itemEl.querySelector('.checklist-duedate');
            if (label && label.textContent) {
                items.push({
                    text: label.textContent,
                    done: checkbox.checked,
                    assignee: assigneeSelect ? assigneeSelect.value : '',
                    dueDate: dueDateEl ? dueDateEl.value : ''
                });
            }
        });
        return items;
    };

    // Inizializza template predefiniti se non esistono
    const defaultTemplates = {
        evento_live: {
            name: 'Evento Live',
            title: 'Evento Live - ',
            description: 'Organizzazione evento live',
            priority: 'high',
            checklist: [
                { text: 'Confermare artista/ospite', assignee: '', dueDate: '' },
                { text: 'Preparare locandina/grafica', assignee: '', dueDate: '' },
                { text: 'Pubblicare evento sui social', assignee: '', dueDate: '' },
                { text: 'Controllare impianto audio', assignee: '', dueDate: '' },
                { text: 'Preparare scaletta', assignee: '', dueDate: '' },
                { text: 'Verificare scorte bar', assignee: '', dueDate: '' },
                { text: 'Organizzare staff serata', assignee: '', dueDate: '' }
            ]
        },
        serata: {
            name: 'Serata Standard',
            title: 'Serata - ',
            description: 'Preparazione serata standard',
            priority: 'medium',
            checklist: [
                { text: 'Verificare prenotazioni', assignee: '', dueDate: '' },
                { text: 'Controllare scorte bar', assignee: '', dueDate: '' },
                { text: 'Preparare playlist/musica', assignee: '', dueDate: '' },
                { text: 'Organizzare staff', assignee: '', dueDate: '' },
                { text: 'Pulizia locale', assignee: '', dueDate: '' }
            ]
        },
        manutenzione: {
            name: 'Manutenzione',
            title: 'Manutenzione - ',
            description: 'Attivita di manutenzione',
            priority: 'medium',
            checklist: [
                { text: 'Identificare problema', assignee: '', dueDate: '' },
                { text: 'Acquistare materiale necessario', assignee: '', dueDate: '' },
                { text: 'Eseguire intervento', assignee: '', dueDate: '' },
                { text: 'Verificare funzionamento', assignee: '', dueDate: '' }
            ]
        },
        riunione: {
            name: 'Riunione Staff',
            title: 'Riunione Staff - ',
            description: 'Riunione del team',
            priority: 'low',
            checklist: [
                { text: 'Definire ordine del giorno', assignee: '', dueDate: '' },
                { text: 'Convocare partecipanti', assignee: '', dueDate: '' },
                { text: 'Preparare documenti', assignee: '', dueDate: '' },
                { text: 'Scrivere verbale/note', assignee: '', dueDate: '' }
            ]
        }
    };

    // Caricamento template
    onValue(templatesRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            // Prima volta: salva template predefiniti
            set(templatesRef, defaultTemplates);
            return;
        }
        if (typeof data === 'object') {
            allTemplates = Object.entries(data).map(([id, tpl]) => ({ id, ...tpl }));
        } else {
            allTemplates = [];
        }
        populateTemplateSelect();
    });

    // Caricamento task
    onValue(tasksRef, (snapshot) => {
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
