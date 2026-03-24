// js/attivita.js
// Sistema Kanban con Owner e createdAt

import { database } from './firebase-config.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';
import { sendNotification } from './notifications.js';

document.addEventListener('authReady', () => {
    // Riferimenti Firebase
    const tasksRef = ref(database, 'tasks');
    const membersRef = ref(database, 'members');
    const templatesRef = ref(database, 'taskTemplates');

    // Stato locale
    let allTasks = [];
    let allMembers = [];
    let allTemplates = [];
    let currentTaskId = null;
    let originalFormState = null;

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
    const closeModalBtn = document.getElementById('close-modal-btn');
    const unsavedConfirmModal = document.getElementById('unsaved-confirm-modal');
    const unsavedYesBtn = document.getElementById('unsaved-yes-btn');
    const unsavedNoBtn = document.getElementById('unsaved-no-btn');

    const priorityMap = {
        low: { label: 'Bassa', color: 'bg-blue-500' },
        medium: { label: 'Media', color: 'bg-orange-500' },
        high: { label: 'Alta', color: 'bg-red-500' },
    };

    // DIRTY STATE - rileva modifiche non salvate nel modale
    const captureFormState = () => {
        const checklistLabels = [];
        checklistContainer.querySelectorAll('.checklist-item label').forEach(label => {
            checklistLabels.push(label.textContent.trim());
        });
        return {
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            dueDate: dueDateInput.value,
            priority: prioritySelect.value,
            owner: ownerSelect ? ownerSelect.value : '',
            assignedTo: Array.from(membersCheckboxesContainer.querySelectorAll('input:checked')).map(cb => cb.value).sort().join(','),
            checklistCount: checklistLabels.length,
            checklistText: checklistLabels.join('|')
        };
    };

    const isDirty = () => {
        if (!originalFormState) return false;
        return JSON.stringify(captureFormState()) !== JSON.stringify(originalFormState);
    };

    const showUnsavedConfirm = () => {
        if (unsavedConfirmModal) unsavedConfirmModal.classList.remove('hidden');
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
        // Verifica se ci sono attività effettivamente bloccate (locked + predecessore non completato)
        const blockedCount = checklist.filter((item, i) =>
            item.locked && i > 0 && !checklist[i - 1].done && !item.done
        ).length;
        const lockHtml = blockedCount > 0 && task.status !== 'done'
            ? `<div class="blocked-badge" title="${blockedCount} attività bloccate"><i class="fa-solid fa-lock"></i></div>`
            : '';
        const checklistProgressHtml = checklist.length > 0
            ? `<div class="checklist-progress">
                 <i class="fa-regular fa-square-check"></i>
                 <span>${completedItems}/${checklist.length}</span>
                 ${lockHtml}
               </div>`
            : '';

        const archiveBtnHtml = task.status === 'done'
            ? `<div class="mt-2 flex justify-end">
                 <button class="archive-task-btn text-xs text-gray-400 hover:text-green-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-green-50 transition-colors" title="Archivia task">
                   <i class="fa-solid fa-box-archive"></i> Archivia
                 </button>
               </div>`
            : '';

        card.innerHTML = `
            <div class="priority-bar ${priority.color}"></div>
            <div class="task-card-content">
                <div class="flex items-start justify-between gap-2 mb-1">
                    <p class="task-card-title flex-1">${task.title}</p>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        ${ownerHtml}
                        <div class="relative">
                            <button class="task-menu-btn text-gray-300 hover:text-gray-500 p-0.5 rounded hover:bg-gray-100 transition-colors" title="Sposta attività">
                                <i class="fa-solid fa-ellipsis-vertical text-sm"></i>
                            </button>
                            <div class="task-menu-dropdown hidden absolute right-0 top-7 bg-white shadow-lg rounded-lg border border-gray-200 z-30 w-36 py-1">
                                <button class="task-move-btn w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${task.status === 'todo' ? 'text-indigo-600 font-semibold' : 'text-gray-700'}" data-status="todo">
                                    <span>📝</span> Da Fare
                                </button>
                                <button class="task-move-btn w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${task.status === 'inprogress' ? 'text-indigo-600 font-semibold' : 'text-gray-700'}" data-status="inprogress">
                                    <span>⏳</span> In Corso
                                </button>
                                <button class="task-move-btn w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${task.status === 'done' ? 'text-indigo-600 font-semibold' : 'text-gray-700'}" data-status="done">
                                    <span>✅</span> Fatto
                                </button>
                            </div>
                        </div>
                    </div>
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
                ${archiveBtnHtml}
            </div>
        `;

        card.addEventListener('click', () => openModalForEdit(task.id));

        const archiveBtnEl = card.querySelector('.archive-task-btn');
        if (archiveBtnEl) {
            archiveBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                archiveTask(task.id);
            });
        }

        // Menu 3 puntini
        const menuBtn = card.querySelector('.task-menu-btn');
        const menuDropdown = card.querySelector('.task-menu-dropdown');
        if (menuBtn && menuDropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.task-menu-dropdown').forEach(d => {
                    if (d !== menuDropdown) d.classList.add('hidden');
                });
                menuDropdown.classList.toggle('hidden');
            });
            const statusLabels = { todo: '📝 Da Fare', inprogress: '⏳ In Corso', done: '✅ Fatto' };
            card.querySelectorAll('.task-move-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const newStatus = btn.dataset.status;
                    menuDropdown.classList.add('hidden');
                    if (task.status !== newStatus) {
                        task.status = newStatus;
                        saveData();
                        renderTasks();
                        if (window.showToast) window.showToast(`Spostato in ${statusLabels[newStatus]}`);
                        const involved = [...new Set([
                            ...(task.assignedTo || []),
                            ...(task.owner ? [task.owner] : [])
                        ])];
                        if (newStatus === 'inprogress' && involved.length > 0) {
                            sendNotification('task_inprogress', { taskTitle: task.title, targetUsers: involved });
                        } else if (newStatus === 'done' && involved.length > 0) {
                            sendNotification('task_done', { taskTitle: task.title, targetUsers: involved });
                        }
                    }
                });
            });
        }

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
            if (!task.dueDate || task.status === 'done' || task.calendarEventId) return false;
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
        const sorted = sortByDueDate(allTasks.filter(t => !t.archived && !t.calendarEventId));
        sorted.forEach(task => {
            const card = createTaskCard(task);
            columns[task.status]?.appendChild(card);
        });
        renderWeekAlert();
    };

    const saveData = () => set(tasksRef, allTasks);

    const archiveTask = (taskId) => {
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        task.archived = true;
        saveData();
        renderTasks();
    };

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

            // Blocco: l'item è bloccato solo se ha il lucchetto attivo E il precedente non è completato
            const hasLock = item.locked === true;
            const isBlocked = hasLock && index > 0 && !checklist[index - 1].done;

            // Select per cambiare assegnatario
            const assigneeOptions = allMembers.map(m =>
                `<option value="${m.name}" ${item.assignee === m.name ? 'selected' : ''}>${m.name}</option>`
            ).join('');

            if (isBlocked) itemEl.classList.add('checklist-blocked');

            const lockBtnClass = hasLock ? 'text-red-500' : 'text-gray-300 hover:text-red-400';
            const lockIcon = hasLock ? 'fa-lock' : 'fa-lock-open';
            const lockTitle = hasLock ? 'Lucchetto attivo: richiede completamento attività precedente' : 'Lucchetto disattivo: clicca per attivare';

            itemEl.innerHTML = `
                <button type="button" class="checklist-lock-btn mr-1 ${lockBtnClass}" data-index="${index}" title="${lockTitle}">
                    <i class="fa-solid ${lockIcon} text-xs"></i>
                </button>
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
            <button type="button" class="checklist-lock-btn mr-1 text-gray-300 hover:text-red-400" data-index="${index}" title="Lucchetto disattivo: clicca per attivare">
                <i class="fa-solid fa-lock-open text-xs"></i>
            </button>
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
        const author = currentUser.name || 'Anonimo';
        task.comments.push({
            text,
            author,
            timestamp: new Date().toISOString()
        });
        saveData();
        renderComments(task.comments);
        newCommentInput.value = '';

        // Notifica owner + assegnati (escludi chi ha scritto il commento)
        const toNotify = [...new Set([
            ...(task.assignedTo || []),
            ...(task.owner ? [task.owner] : [])
        ])].filter(u => u.toLowerCase() !== author.toLowerCase());
        if (toNotify.length > 0) {
            sendNotification('task_comment', {
                taskTitle: task.title,
                author,
                commentText: text.length > 60 ? text.slice(0, 60) + '…' : text,
                targetUsers: toNotify
            });
        }
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
        originalFormState = captureFormState();
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
        originalFormState = captureFormState();
    };

    const forceCloseModal = () => {
        originalFormState = null;
        modal.classList.add('hidden');
    };

    const closeModal = () => {
        if (isDirty()) {
            showUnsavedConfirm();
            return;
        }
        forceCloseModal();
    };

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
            const lockBtn = itemEl.querySelector('.checklist-lock-btn');
            if (label && label.textContent) {
                checklistItems.push({
                    text: label.textContent,
                    done: checkbox.checked,
                    assignee: assigneeSelect ? assigneeSelect.value : '',
                    dueDate: dueDateEl ? dueDateEl.value : '',
                    locked: lockBtn ? lockBtn.querySelector('.fa-lock:not(.fa-lock-open)') !== null : false
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
                const oldTask = allTasks[taskIndex];
                taskData.comments = oldTask.comments || [];
                allTasks[taskIndex] = { ...oldTask, ...taskData };

                // Notifica nuovi assegnatari
                const oldAssignees = oldTask.assignedTo || [];
                const newAssignees = (taskData.assignedTo || []).filter(a => !oldAssignees.includes(a));
                if (newAssignees.length > 0) {
                    sendNotification('task_assigned', {
                        taskTitle: taskData.title,
                        assignees: newAssignees,
                        dueDate: taskData.dueDate
                    });
                }

                // Destinatari generali (owner + assegnatari)
                const allRecipients = [...new Set([
                    ...(taskData.assignedTo || []),
                    ...(taskData.owner ? [taskData.owner] : [])
                ])];

                // Notifica se la descrizione è cambiata
                if ((taskData.description || '') !== (oldTask.description || '')) {
                    if (allRecipients.length > 0) {
                        sendNotification('task_updated', {
                            taskTitle: taskData.title,
                            changeDescription: 'descrizione modificata',
                            targetUsers: allRecipients
                        });
                    }
                }

                // Notifica checklist: item nuovo, testo modificato, assignee cambiato, item completato
                const oldChecklist = oldTask.checklist || [];
                checklistItems.forEach((item, i) => {
                    const oldItem = oldChecklist[i];
                    const isNew = !oldItem;
                    const assigneeChanged = oldItem && oldItem.assignee !== item.assignee;
                    const textChanged = oldItem && oldItem.text !== item.text;
                    const justCompleted = oldItem && !oldItem.done && item.done;

                    // Notifica assignee specifico se item nuovo o assignee cambiato
                    if ((isNew || assigneeChanged) && item.assignee && item.assignee !== 'tutti' && item.assignee !== '') {
                        sendNotification('checklist_assigned', {
                            taskTitle: taskData.title,
                            itemText: item.text,
                            assignee: item.assignee,
                            dueDate: item.dueDate
                        });
                    }

                    // Notifica tutti se item aggiunto o testo modificato
                    if ((isNew || textChanged) && allRecipients.length > 0) {
                        sendNotification('task_updated', {
                            taskTitle: taskData.title,
                            changeDescription: isNew ? `nuova attività: "${item.text}"` : `attività modificata: "${item.text}"`,
                            targetUsers: allRecipients
                        });
                    }

                    // Notifica owner + assegnatari se item appena completato
                    if (justCompleted) {
                        const completionRecipients = [...new Set([
                            ...(oldTask.owner ? [oldTask.owner] : []),
                            ...(oldTask.assignedTo || [])
                        ])];
                        if (completionRecipients.length > 0) {
                            sendNotification('checklist_done', {
                                taskTitle: taskData.title,
                                itemText: item.text,
                                targetUsers: completionRecipients
                            });
                        }
                    }
                });
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

            // Notifica tutti gli assegnatari + owner
            const toNotify = [...new Set([
                ...(taskData.assignedTo || []),
                ...(taskData.owner ? [taskData.owner] : [])
            ])];
            if (toNotify.length > 0) {
                sendNotification('task_assigned', {
                    taskTitle: taskData.title,
                    assignees: toNotify,
                    dueDate: taskData.dueDate
                });
            }
        }

        saveData();
        renderTasks();
        forceCloseModal();
    });

    if (deleteTaskBtn) deleteTaskBtn.addEventListener('click', () => {
        if (currentTaskId && confirm('Sei sicuro di voler eliminare questo task?')) {
            allTasks = allTasks.filter(t => t.id !== currentTaskId);
            saveData();
            renderTasks();
            forceCloseModal();
        }
    });

    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', closeModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (addTaskBtn) addTaskBtn.addEventListener('click', openModalForNew);

    // Popup modifiche non salvate
    if (unsavedYesBtn) unsavedYesBtn.addEventListener('click', () => {
        if (unsavedConfirmModal) unsavedConfirmModal.classList.add('hidden');
        if (saveTaskBtn) saveTaskBtn.click();
    });
    if (unsavedNoBtn) unsavedNoBtn.addEventListener('click', () => {
        if (unsavedConfirmModal) unsavedConfirmModal.classList.add('hidden');
        forceCloseModal();
    });

    // Chiudi dropdown 3 puntini cliccando fuori
    document.addEventListener('click', () => {
        document.querySelectorAll('.task-menu-dropdown').forEach(d => d.classList.add('hidden'));
    });

    // INIZIALIZZAZIONE DI SORTABLEJS (DRAG-AND-DROP) - disabilitato su mobile
    if (columns.todo) {
        Object.values(columns).forEach(columnEl => {
            new Sortable(columnEl, {
                group: 'shared',
                animation: 150,
                ghostClass: 'sortable-ghost',
                disabled: window.innerWidth < 768,
                onEnd: (evt) => {
                    const taskId = evt.item.dataset.taskId;
                    const newStatus = evt.to.dataset.status;
                    const task = allTasks.find(t => t.id === taskId);
                    if (task && task.status !== newStatus) {
                        task.status = newStatus;
                        saveData();

                        const involved = [...new Set([
                            ...(task.assignedTo || []),
                            ...(task.owner ? [task.owner] : [])
                        ])];

                        if (newStatus === 'inprogress' && involved.length > 0) {
                            sendNotification('task_inprogress', {
                                taskTitle: task.title,
                                targetUsers: involved
                            });
                        } else if (newStatus === 'done' && involved.length > 0) {
                            sendNotification('task_done', {
                                taskTitle: task.title,
                                targetUsers: involved
                            });
                        }
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

    // Event delegation per eliminare item checklist, toggle lucchetto e gestire blocco
    if (checklistContainer) {
        checklistContainer.addEventListener('click', (e) => {
            if (e.target.closest('.checklist-delete-btn')) {
                const btn = e.target.closest('.checklist-delete-btn');
                const itemEl = btn.closest('.checklist-item');
                if (itemEl) {
                    itemEl.remove();
                }
            }
            // Toggle lucchetto
            if (e.target.closest('.checklist-lock-btn')) {
                const currentChecklist = getCurrentChecklistState();
                const btn = e.target.closest('.checklist-lock-btn');
                const idx = parseInt(btn.dataset.index);
                if (currentChecklist[idx]) {
                    currentChecklist[idx].locked = !currentChecklist[idx].locked;
                    renderChecklist(currentChecklist);
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
            const lockBtn = itemEl.querySelector('.checklist-lock-btn');
            if (label && label.textContent) {
                items.push({
                    text: label.textContent,
                    done: checkbox.checked,
                    assignee: assigneeSelect ? assigneeSelect.value : '',
                    dueDate: dueDateEl ? dueDateEl.value : '',
                    locked: lockBtn ? lockBtn.querySelector('.fa-lock:not(.fa-lock-open)') !== null : false
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
