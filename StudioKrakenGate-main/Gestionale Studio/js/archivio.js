// js/archivio.js
// Archivio task completati

import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    const tasksRef = ref(database, 'tasks');
    const membersRef = ref(database, 'members');

    let allTasks = [];
    let completedTasks = [];
    let allMembers = [];

    // Riferimenti DOM
    const archiveList = document.getElementById('archive-list');
    const filterSearch = document.getElementById('filter-search');
    const filterMonth = document.getElementById('filter-month');
    const filterOwner = document.getElementById('filter-owner');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const statTotal = document.getElementById('stat-total');
    const statMonth = document.getElementById('stat-month');
    const statHigh = document.getElementById('stat-high');
    const archiveModal = document.getElementById('archive-modal');
    const archiveModalTitle = document.getElementById('archive-modal-title');
    const archiveModalContent = document.getElementById('archive-modal-content');
    const closeArchiveModal = document.getElementById('close-archive-modal');

    const priorityMap = {
        low: { label: 'Bassa', color: 'bg-blue-500', text: 'text-blue-600' },
        medium: { label: 'Media', color: 'bg-orange-500', text: 'text-orange-600' },
        high: { label: 'Alta', color: 'bg-red-500', text: 'text-red-600' },
    };

    const applyFilters = () => {
        const search = (filterSearch.value || '').toLowerCase();
        const month = filterMonth.value || '';
        const owner = filterOwner.value || '';

        let filtered = completedTasks;

        if (search) {
            filtered = filtered.filter(t => t.title.toLowerCase().includes(search));
        }

        if (month) {
            filtered = filtered.filter(t => t.dueDate && t.dueDate.startsWith(month));
        }

        if (owner) {
            filtered = filtered.filter(t =>
                t.owner === owner ||
                (t.assignedTo || []).includes(owner)
            );
        }

        renderList(filtered);
    };

    const updateStats = () => {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

        statTotal.textContent = completedTasks.length;
        statMonth.textContent = completedTasks.filter(t => t.dueDate && t.dueDate.startsWith(currentMonth)).length;
        statHigh.textContent = completedTasks.filter(t => t.priority === 'high').length;
    };

    const renderList = (tasks) => {
        archiveList.innerHTML = '';

        if (tasks.length === 0) {
            archiveList.innerHTML = '<p class="text-gray-400 text-center py-8">Nessun task trovato</p>';
            return;
        }

        // Ordina per data scadenza decrescente (piu recenti prima)
        tasks.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));

        tasks.forEach(task => {
            const priority = priorityMap[task.priority] || priorityMap.low;
            const assignees = (task.assignedTo || []).join(', ');
            const checklist = task.checklist || [];
            const totalChecklist = checklist.length;
            const doneChecklist = checklist.filter(c => c.done).length;

            const card = document.createElement('div');
            card.className = 'card cursor-pointer hover:shadow-md transition-shadow flex items-center gap-4';
            card.innerHTML = `
                <div class="w-1 h-12 rounded-full ${priority.color} flex-shrink-0"></div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <p class="font-semibold text-gray-800 truncate">${task.title}</p>
                        <span class="text-xs ${priority.text} font-medium">${priority.label}</span>
                    </div>
                    <div class="flex flex-wrap gap-3 text-xs text-gray-500">
                        ${task.dueDate ? `<span><i class="fa-regular fa-calendar mr-1"></i>${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('it-IT')}</span>` : ''}
                        ${task.owner ? `<span><i class="fa-solid fa-user-tie mr-1"></i>${task.owner}</span>` : ''}
                        ${assignees ? `<span><i class="fa-solid fa-users mr-1"></i>${assignees}</span>` : ''}
                        ${totalChecklist > 0 ? `<span><i class="fa-regular fa-square-check mr-1"></i>${doneChecklist}/${totalChecklist}</span>` : ''}
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-gray-300 flex-shrink-0"></i>
            `;

            card.addEventListener('click', () => openDetail(task));
            archiveList.appendChild(card);
        });
    };

    const openDetail = (task) => {
        archiveModalTitle.textContent = task.title;
        const priority = priorityMap[task.priority] || priorityMap.low;
        const assignees = (task.assignedTo || []).join(', ');
        const checklist = task.checklist || [];
        const comments = task.comments || [];

        let html = '';

        // Info base
        html += `<div class="space-y-3">`;
        if (task.description) {
            html += `<p class="text-gray-600">${task.description}</p>`;
        }
        html += `<div class="flex flex-wrap gap-3 text-sm">`;
        html += `<span class="px-2 py-1 rounded-full ${priority.color} text-white text-xs">${priority.label}</span>`;
        if (task.dueDate) html += `<span class="text-gray-500"><i class="fa-regular fa-calendar mr-1"></i>${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>`;
        if (task.owner) html += `<span class="text-gray-500"><i class="fa-solid fa-user-tie mr-1"></i>${task.owner}</span>`;
        html += `</div>`;

        if (assignees) {
            html += `<p class="text-sm text-gray-500"><i class="fa-solid fa-users mr-1"></i>Partecipanti: ${assignees}</p>`;
        }

        // Checklist
        if (checklist.length > 0) {
            html += `<div class="mt-4"><p class="font-semibold text-sm mb-2">Checklist</p>`;
            html += `<div class="space-y-1">`;
            checklist.forEach(item => {
                const icon = item.done ? 'fa-square-check text-green-500' : 'fa-square text-gray-300';
                const textClass = item.done ? 'line-through text-gray-400' : 'text-gray-700';
                html += `<div class="flex items-center gap-2 text-sm">
                    <i class="fa-regular ${icon}"></i>
                    <span class="${textClass}">${item.text}</span>
                    ${item.assignee ? `<span class="text-xs text-gray-400">(${item.assignee})</span>` : ''}
                </div>`;
            });
            html += `</div></div>`;
        }

        // Commenti
        if (comments.length > 0) {
            html += `<div class="mt-4"><p class="font-semibold text-sm mb-2">Commenti (${comments.length})</p>`;
            html += `<div class="space-y-2">`;
            comments.forEach(c => {
                const date = new Date(c.timestamp);
                const dateStr = date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                html += `<div class="comment-item">
                    <div class="comment-header">
                        <span class="comment-author">${c.author}</span>
                        <span class="comment-date">${dateStr}</span>
                    </div>
                    <p class="comment-text">${c.text}</p>
                </div>`;
            });
            html += `</div></div>`;
        }

        html += `</div>`;
        archiveModalContent.innerHTML = html;
        archiveModal.classList.remove('hidden');
    };

    if (closeArchiveModal) closeArchiveModal.addEventListener('click', () => {
        archiveModal.classList.add('hidden');
    });

    if (archiveModal) archiveModal.addEventListener('click', (e) => {
        if (e.target === archiveModal) archiveModal.classList.add('hidden');
    });

    // Filtri
    if (filterSearch) filterSearch.addEventListener('input', applyFilters);
    if (filterMonth) filterMonth.addEventListener('change', applyFilters);
    if (filterOwner) filterOwner.addEventListener('change', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', () => {
        filterSearch.value = '';
        filterMonth.value = '';
        filterOwner.value = '';
        applyFilters();
    });

    // Caricamento membri
    onValue(membersRef, (snapshot) => {
        const membersObject = snapshot.val() || {};
        allMembers = Object.entries(membersObject).map(([uid, member]) => ({
            uid,
            name: member.name,
            ...member
        }));

        // Popola filtro owner
        if (filterOwner) {
            filterOwner.innerHTML = '<option value="">Tutti</option>';
            allMembers.forEach(m => {
                const option = document.createElement('option');
                option.value = m.name;
                option.textContent = m.name;
                filterOwner.appendChild(option);
            });
        }
    });

    // Caricamento task
    onValue(tasksRef, (snapshot) => {
        const tasksData = snapshot.val();
        if (Array.isArray(tasksData)) {
            allTasks = tasksData.filter(Boolean);
        } else if (typeof tasksData === 'object' && tasksData !== null) {
            allTasks = Object.values(tasksData);
        } else {
            allTasks = [];
        }

        completedTasks = allTasks.filter(t => t.status === 'done');
        updateStats();
        applyFilters();
    });
});
