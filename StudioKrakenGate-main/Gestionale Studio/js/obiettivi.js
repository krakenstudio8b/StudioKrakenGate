import { database } from './firebase-config.js';
import { ref, onValue, update, get, set } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// ============================================
// VARIABILI GLOBALI
// ============================================
let allTasks = [];
let allMembers = [];
let allTargets = [];
let completionRateChart = null;
let trendChart = null;
let currentMonthFilter = 'current';
let currentOwnerFilter = 'all';
let currentEditingTaskId = null;

// ============================================
// PLACEHOLDER OBIETTIVI (da collegare a Firebase)
// ============================================
const placeholderTargets = [
    {
        id: 'target_001',
        title: 'Produzioni Audio',
        company: 'kraken',
        currentValue: 18,
        targetValue: 50,
        unit: 'produzioni',
        period: '2025',
        icon: 'fa-microphone'
    },
    {
        id: 'target_002',
        title: 'Nuovi Sponsor',
        company: 'gateradio',
        currentValue: 3,
        targetValue: 10,
        unit: 'sponsor',
        period: '2025',
        icon: 'fa-handshake'
    },
    {
        id: 'target_003',
        title: 'Fatturato Kraken',
        company: 'kraken',
        currentValue: 45000,
        targetValue: 120000,
        unit: '€',
        period: '2025',
        icon: 'fa-euro-sign'
    },
    {
        id: 'target_004',
        title: 'Fatturato Gateradio',
        company: 'gateradio',
        currentValue: 28000,
        targetValue: 80000,
        unit: '€',
        period: '2025',
        icon: 'fa-euro-sign'
    },
    {
        id: 'target_005',
        title: 'Podcast Pubblicati',
        company: 'gateradio',
        currentValue: 42,
        targetValue: 100,
        unit: 'episodi',
        period: '2025',
        icon: 'fa-podcast'
    },
    {
        id: 'target_006',
        title: 'Clienti Attivi',
        company: 'kraken',
        currentValue: 8,
        targetValue: 20,
        unit: 'clienti',
        period: '2025',
        icon: 'fa-users'
    }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Ottiene la data di creazione del task
 * Prima prova createdAt, poi fallback sull'ID come timestamp
 */
function getTaskCreationDate(task) {
    if (task.createdAt) {
        return new Date(task.createdAt);
    }
    const timestamp = parseInt(task.id, 10);
    if (isNaN(timestamp)) return null;
    return new Date(timestamp);
}

/**
 * Ottiene l'intervallo del mese selezionato
 */
function getMonthRange(filter) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();

    if (filter === 'previous') {
        month -= 1;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
    }

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);

    return { start, end, month, year };
}

/**
 * Formatta il nome del mese
 */
function formatMonthName(month, year) {
    const months = [
        'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    return `${months[month]} ${year}`;
}

/**
 * Filtra i task per il mese selezionato
 */
function filterTasksByMonth(tasks, filter) {
    const { start, end } = getMonthRange(filter);

    return tasks.filter(task => {
        const createdAt = getTaskCreationDate(task);
        if (!createdAt) return false;
        return createdAt >= start && createdAt <= end;
    });
}

/**
 * Filtra i task per owner
 */
function filterTasksByOwner(tasks, owner) {
    if (owner === 'all') return tasks;
    return tasks.filter(task => task.owner === owner);
}

/**
 * Formatta numeri grandi (es. 45000 -> 45K)
 */
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

/**
 * Ottiene lista unica degli owner dai task
 */
function getUniqueOwners(tasks) {
    const owners = new Set();
    tasks.forEach(task => {
        if (task.owner) {
            owners.add(task.owner);
        }
    });
    return Array.from(owners).sort();
}

// ============================================
// CALCOLO KPI
// ============================================

function calculateKPIs(tasks) {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'inprogress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    // Priorità
    const highPriority = tasks.filter(t => t.priority === 'high').length;
    const mediumPriority = tasks.filter(t => t.priority === 'medium').length;
    const lowPriority = tasks.filter(t => t.priority === 'low').length;

    // Task scaduti (dueDate nel passato e non completati)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = tasks.filter(t => {
        if (t.status === 'done' || !t.dueDate) return false;
        const dueDate = new Date(t.dueDate + 'T00:00:00');
        return dueDate < today;
    }).length;

    return {
        total,
        done,
        inProgress,
        todo,
        completionRate,
        highPriority,
        mediumPriority,
        lowPriority,
        overdue
    };
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderOwnerFilter() {
    const ownerFilterContainer = document.getElementById('owner-filter-container');
    if (!ownerFilterContainer) return;

    const owners = getUniqueOwners(allTasks);

    let html = `
        <label for="owner-filter" class="text-sm font-medium text-gray-600">Responsabile:</label>
        <select id="owner-filter" class="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">Tutti</option>
    `;

    owners.forEach(owner => {
        const selected = currentOwnerFilter === owner ? 'selected' : '';
        html += `<option value="${owner}" ${selected}>${owner}</option>`;
    });

    // Aggiungi anche membri che non hanno task assegnati
    allMembers.forEach(member => {
        if (!owners.includes(member.name)) {
            const selected = currentOwnerFilter === member.name ? 'selected' : '';
            html += `<option value="${member.name}" ${selected}>${member.name}</option>`;
        }
    });

    html += '</select>';
    ownerFilterContainer.innerHTML = html;

    // Event listener
    const ownerSelect = document.getElementById('owner-filter');
    if (ownerSelect) {
        ownerSelect.addEventListener('change', (e) => {
            currentOwnerFilter = e.target.value;
            updateDashboard();
        });
    }
}

function renderCompletionRateChart(rate) {
    const chartEl = document.getElementById('completion-rate-chart');

    const options = {
        series: [rate],
        chart: {
            height: 256,
            type: 'radialBar',
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            }
        },
        plotOptions: {
            radialBar: {
                startAngle: -135,
                endAngle: 135,
                hollow: {
                    margin: 0,
                    size: '70%',
                    background: '#fff',
                    dropShadow: {
                        enabled: true,
                        top: 3,
                        left: 0,
                        blur: 4,
                        opacity: 0.1
                    }
                },
                track: {
                    background: '#e7e7e7',
                    strokeWidth: '100%',
                    margin: 5
                },
                dataLabels: {
                    name: {
                        show: true,
                        fontSize: '14px',
                        color: '#6b7280',
                        offsetY: -10
                    },
                    value: {
                        offsetY: 5,
                        fontSize: '36px',
                        fontWeight: 'bold',
                        color: rate >= 70 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444',
                        formatter: function(val) {
                            return val + '%';
                        }
                    }
                }
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'horizontal',
                shadeIntensity: 0.5,
                gradientToColors: [rate >= 70 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444'],
                stops: [0, 100]
            }
        },
        stroke: {
            lineCap: 'round'
        },
        colors: [rate >= 70 ? '#4ade80' : rate >= 40 ? '#fbbf24' : '#f87171'],
        labels: ['Completion']
    };

    if (completionRateChart) {
        completionRateChart.updateOptions(options);
        completionRateChart.updateSeries([rate]);
    } else {
        completionRateChart = new ApexCharts(chartEl, options);
        completionRateChart.render();
    }
}

function renderKPIStats(kpis) {
    document.getElementById('tasks-done').textContent = kpis.done;
    document.getElementById('tasks-total').textContent = kpis.total;
    document.getElementById('tasks-inprogress').textContent = kpis.inProgress;
    document.getElementById('tasks-todo').textContent = kpis.todo;
    document.getElementById('high-priority-count').textContent = kpis.highPriority;
    document.getElementById('medium-priority-count').textContent = kpis.mediumPriority;
    document.getElementById('low-priority-count').textContent = kpis.lowPriority;
    document.getElementById('overdue-count').textContent = kpis.overdue;
}

function renderMacroTasks(tasks) {
    const container = document.getElementById('macro-tasks-container');
    const noTasksMsg = document.getElementById('no-macro-tasks');

    // Filtra task con checklist non vuota
    const macroTasks = tasks.filter(t => t.checklist && t.checklist.length > 0);

    if (macroTasks.length === 0) {
        noTasksMsg.classList.remove('hidden');
        const cards = container.querySelectorAll('.macro-task-card');
        cards.forEach(card => card.remove());
        return;
    }

    noTasksMsg.classList.add('hidden');

    // Ordina per numero di checklist items (decrescente)
    macroTasks.sort((a, b) => b.checklist.length - a.checklist.length);

    // Rimuovi le card precedenti
    const existingCards = container.querySelectorAll('.macro-task-card');
    existingCards.forEach(card => card.remove());

    macroTasks.forEach(task => {
        const totalItems = task.checklist.length;
        const completedItems = task.checklist.filter(item => item.done).length;
        const progress = Math.round((completedItems / totalItems) * 100);

        const statusColor = {
            'todo': 'bg-blue-100 text-blue-700',
            'inprogress': 'bg-yellow-100 text-yellow-700',
            'done': 'bg-green-100 text-green-700'
        }[task.status] || 'bg-gray-100 text-gray-700';

        const statusLabel = {
            'todo': 'Da Fare',
            'inprogress': 'In Corso',
            'done': 'Completato'
        }[task.status] || task.status;

        const progressColor = progress >= 80 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-blue-500';

        // Genera opzioni per il select owner
        let ownerOptions = '<option value="">-- Nessuno --</option>';
        allMembers.forEach(member => {
            const selected = task.owner === member.name ? 'selected' : '';
            ownerOptions += `<option value="${member.name}" ${selected}>${member.name}</option>`;
        });

        const card = document.createElement('div');
        card.className = 'macro-task-card flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4';
        card.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 class="font-semibold text-gray-800">${task.title}</h4>
                    <span class="text-xs px-2 py-0.5 rounded-full ${statusColor}">${statusLabel}</span>
                </div>
                <p class="text-sm text-gray-500">${completedItems} di ${totalItems} sotto-attività completate</p>
                <div class="flex items-center gap-2 mt-2">
                    <span class="text-xs text-gray-500">Responsabile:</span>
                    <select class="owner-dropdown text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500" data-task-id="${task.id}">
                        ${ownerOptions}
                    </select>
                </div>
            </div>
            <div class="flex items-center gap-4 md:w-64">
                <div class="flex-1 bg-gray-200 rounded-full h-3">
                    <div class="${progressColor} h-3 rounded-full transition-all duration-500" style="width: ${progress}%"></div>
                </div>
                <span class="text-sm font-bold text-gray-700 w-12 text-right">${progress}%</span>
            </div>
        `;

        // Event listener per cambio owner (stopPropagation per evitare apertura modale)
        const ownerDropdown = card.querySelector('.owner-dropdown');
        ownerDropdown.addEventListener('click', (e) => e.stopPropagation());
        ownerDropdown.addEventListener('change', async (e) => {
            e.stopPropagation();
            const taskId = e.target.dataset.taskId;
            const newOwner = e.target.value;
            await updateTaskOwner(taskId, newOwner);
        });

        // Click sulla card per aprire modale modifica
        card.addEventListener('click', () => {
            openEditModal(task.id);
        });

        container.appendChild(card);
    });
}

// ============================================
// MODALE MODIFICA TASK
// ============================================

function openEditModal(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    currentEditingTaskId = taskId;

    const modal = document.getElementById('edit-task-modal');
    const titleInput = document.getElementById('edit-title');
    const descriptionInput = document.getElementById('edit-description');
    const ownerSelect = document.getElementById('edit-owner');
    const statusSelect = document.getElementById('edit-status');
    const dueDateInput = document.getElementById('edit-dueDate');
    const prioritySelect = document.getElementById('edit-priority');
    const checklistContainer = document.getElementById('edit-checklist');

    // Popola i campi
    titleInput.value = task.title || '';
    descriptionInput.value = task.description || '';
    statusSelect.value = task.status || 'todo';
    dueDateInput.value = task.dueDate || '';
    prioritySelect.value = task.priority || 'low';

    // Popola select owner
    ownerSelect.innerHTML = '<option value="">-- Nessuno --</option>';
    allMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.name;
        option.textContent = member.name;
        if (task.owner === member.name) option.selected = true;
        ownerSelect.appendChild(option);
    });

    // Popola checklist
    const checklist = task.checklist || [];
    checklistContainer.innerHTML = checklist.length > 0
        ? checklist.map((item, index) => `
            <div class="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <input type="checkbox" id="edit-check-${index}" ${item.done ? 'checked' : ''}
                    class="w-5 h-5 accent-indigo-600">
                <label for="edit-check-${index}" class="flex-1 text-sm ${item.done ? 'line-through text-gray-400' : ''}">${item.text}</label>
            </div>
        `).join('')
        : '<p class="text-gray-400 text-sm text-center py-4">Nessuna sotto-attività</p>';

    modal.classList.remove('hidden');
}

function closeEditModal() {
    const modal = document.getElementById('edit-task-modal');
    modal.classList.add('hidden');
    currentEditingTaskId = null;
}

async function saveEditedTask() {
    if (!currentEditingTaskId) return;

    const taskIndex = allTasks.findIndex(t => t.id === currentEditingTaskId);
    if (taskIndex === -1) return;

    const task = allTasks[taskIndex];

    // Raccogli i valori dai campi
    const updatedData = {
        title: document.getElementById('edit-title').value.trim(),
        description: document.getElementById('edit-description').value.trim(),
        owner: document.getElementById('edit-owner').value,
        status: document.getElementById('edit-status').value,
        dueDate: document.getElementById('edit-dueDate').value,
        priority: document.getElementById('edit-priority').value
    };

    // Aggiorna checklist
    const checklistContainer = document.getElementById('edit-checklist');
    const checkboxes = checklistContainer.querySelectorAll('input[type="checkbox"]');
    if (task.checklist && task.checklist.length > 0) {
        checkboxes.forEach((checkbox, index) => {
            if (task.checklist[index]) {
                task.checklist[index].done = checkbox.checked;
            }
        });
        updatedData.checklist = task.checklist;
    }

    // Aggiorna task locale
    allTasks[taskIndex] = { ...task, ...updatedData };

    // Salva su Firebase
    try {
        const tasksRef = ref(database, 'tasks');
        await set(tasksRef, allTasks);
        console.log('Task aggiornato:', currentEditingTaskId);
        closeEditModal();
    } catch (error) {
        console.error('Errore salvataggio:', error);
        alert('Errore durante il salvataggio');
    }
}

function initEditModal() {
    const closeBtn = document.getElementById('close-edit-modal');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const saveBtn = document.getElementById('save-edit-btn');
    const modal = document.getElementById('edit-task-modal');

    if (closeBtn) closeBtn.addEventListener('click', closeEditModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditModal);
    if (saveBtn) saveBtn.addEventListener('click', saveEditedTask);

    // Chiudi cliccando fuori
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeEditModal();
        });
    }
}

async function updateTaskOwner(taskId, newOwner) {
    // Trova l'indice del task nell'array
    const taskIndex = allTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    // Aggiorna localmente
    allTasks[taskIndex].owner = newOwner;

    // Aggiorna su Firebase
    try {
        const taskRef = ref(database, `tasks/${taskIndex}`);
        await update(taskRef, { owner: newOwner });
        console.log(`Owner aggiornato per task ${taskId}: ${newOwner}`);
    } catch (error) {
        console.error('Errore aggiornamento owner:', error);
        alert('Errore durante l\'aggiornamento del responsabile');
    }
}

function renderTargets(targets) {
    const container = document.getElementById('targets-container');
    const noTargetsMsg = document.getElementById('no-targets');

    if (targets.length === 0) {
        noTargetsMsg.classList.remove('hidden');
        container.innerHTML = '';
        return;
    }

    noTargetsMsg.classList.add('hidden');

    container.innerHTML = targets.map(target => {
        const progress = Math.round((target.currentValue / target.targetValue) * 100);
        const clampedProgress = Math.min(progress, 100);

        const companyColor = target.company === 'kraken'
            ? 'from-purple-500 to-indigo-600'
            : 'from-orange-400 to-red-500';

        const companyLabel = target.company === 'kraken' ? 'Kraken Studio' : 'Gateradio';

        const progressColor = progress >= 80 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-indigo-500';

        const displayCurrent = target.unit === '€'
            ? formatNumber(target.currentValue) + '€'
            : target.currentValue + ' ' + target.unit;

        const displayTarget = target.unit === '€'
            ? formatNumber(target.targetValue) + '€'
            : target.targetValue + ' ' + target.unit;

        return `
            <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                <div class="flex items-start justify-between mb-4">
                    <div class="w-12 h-12 rounded-lg bg-gradient-to-br ${companyColor} flex items-center justify-center">
                        <i class="fa-solid ${target.icon} text-white text-lg"></i>
                    </div>
                    <span class="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">${companyLabel}</span>
                </div>
                <h3 class="font-semibold text-gray-800 mb-1">${target.title}</h3>
                <p class="text-sm text-gray-500 mb-4">${target.period}</p>
                <div class="flex items-end justify-between mb-2">
                    <span class="text-2xl font-bold text-gray-900">${displayCurrent}</span>
                    <span class="text-sm text-gray-400">/ ${displayTarget}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="${progressColor} h-2 rounded-full transition-all duration-500" style="width: ${clampedProgress}%"></div>
                </div>
                <p class="text-right text-xs text-gray-500 mt-1">${progress}% completato</p>
            </div>
        `;
    }).join('');
}

function renderTrendChart(currentTasks, previousTasks) {
    const chartEl = document.getElementById('trend-chart');

    const currentKPIs = calculateKPIs(currentTasks);
    const previousKPIs = calculateKPIs(previousTasks);

    const { month: currentMonth, year: currentYear } = getMonthRange('current');
    const { month: previousMonth, year: previousYear } = getMonthRange('previous');

    const options = {
        series: [{
            name: 'Completati',
            data: [previousKPIs.done, currentKPIs.done]
        }, {
            name: 'In Corso',
            data: [previousKPIs.inProgress, currentKPIs.inProgress]
        }, {
            name: 'Da Fare',
            data: [previousKPIs.todo, currentKPIs.todo]
        }],
        chart: {
            type: 'bar',
            height: 256,
            toolbar: {
                show: false
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            }
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 4
            }
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            show: true,
            width: 2,
            colors: ['transparent']
        },
        xaxis: {
            categories: [
                formatMonthName(previousMonth, previousYear),
                formatMonthName(currentMonth, currentYear)
            ]
        },
        yaxis: {
            title: {
                text: 'Numero Task'
            }
        },
        fill: {
            opacity: 1
        },
        colors: ['#22c55e', '#f59e0b', '#3b82f6'],
        legend: {
            position: 'top'
        },
        tooltip: {
            y: {
                formatter: function(val) {
                    return val + ' task';
                }
            }
        }
    };

    if (trendChart) {
        trendChart.updateOptions(options);
    } else {
        trendChart = new ApexCharts(chartEl, options);
        trendChart.render();
    }
}

// ============================================
// UPDATE DASHBOARD
// ============================================

function updateDashboard() {
    const filter = currentMonthFilter;
    const { month, year } = getMonthRange(filter);

    // Aggiorna label periodo selezionato
    document.getElementById('selected-period').textContent = formatMonthName(month, year);

    // Filtra task per il mese selezionato
    let filteredTasks = filterTasksByMonth(allTasks, filter);

    // Filtra anche per owner se selezionato
    filteredTasks = filterTasksByOwner(filteredTasks, currentOwnerFilter);

    // Calcola KPIs
    const kpis = calculateKPIs(filteredTasks);

    // Render charts e statistiche
    renderCompletionRateChart(kpis.completionRate);
    renderKPIStats(kpis);
    renderMacroTasks(filteredTasks);

    // Trend chart (sempre mostra confronto tra i due mesi con stesso filtro owner)
    let currentMonthTasks = filterTasksByMonth(allTasks, 'current');
    let previousMonthTasks = filterTasksByMonth(allTasks, 'previous');

    if (currentOwnerFilter !== 'all') {
        currentMonthTasks = filterTasksByOwner(currentMonthTasks, currentOwnerFilter);
        previousMonthTasks = filterTasksByOwner(previousMonthTasks, currentOwnerFilter);
    }

    renderTrendChart(currentMonthTasks, previousMonthTasks);
}

// ============================================
// FIREBASE LISTENERS
// ============================================

function initFirebaseListeners() {
    const tasksRef = ref(database, 'tasks');
    const membersRef = ref(database, 'members');

    // Carica membri
    onValue(membersRef, (snapshot) => {
        const membersObject = snapshot.val() || {};
        allMembers = Object.entries(membersObject).map(([uid, member]) => ({
            uid,
            name: member.name,
            ...member
        }));

        // Aggiorna filtro owner
        renderOwnerFilter();
    });

    onValue(tasksRef, (snapshot) => {
        const tasksData = snapshot.val();
        if (Array.isArray(tasksData)) {
            allTasks = tasksData;
        } else if (typeof tasksData === 'object' && tasksData !== null) {
            allTasks = Object.values(tasksData);
        } else {
            allTasks = [];
        }

        // Aggiorna filtro owner con nuovi dati
        renderOwnerFilter();
        updateDashboard();
    });

    // Listener per collezione targets (quando sarà creata)
    const targetsRef = ref(database, 'targets');

    onValue(targetsRef, (snapshot) => {
        const targetsData = snapshot.val();
        if (targetsData) {
            if (Array.isArray(targetsData)) {
                allTargets = targetsData;
            } else if (typeof targetsData === 'object') {
                allTargets = Object.values(targetsData);
            }
        } else {
            allTargets = placeholderTargets;
        }
        renderTargets(allTargets);
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
    const monthFilter = document.getElementById('month-filter');
    if (monthFilter) {
        monthFilter.addEventListener('change', (e) => {
            currentMonthFilter = e.target.value;
            updateDashboard();
        });
    }
}

// ============================================
// INIT
// ============================================

document.addEventListener('authReady', () => {
    console.log('Obiettivi: Utente autenticato');
    initFirebaseListeners();
    initEventListeners();
    renderTargets(placeholderTargets);
});

// Fallback se authReady non viene dispatchato
setTimeout(() => {
    if (allTasks.length === 0) {
        initFirebaseListeners();
        initEventListeners();
        renderTargets(placeholderTargets);
    }
}, 2000);

// ============================================
// CARICAMENTO TASK FEBBRAIO 2026
// ============================================

const februaryTasks = [
    {
        title: "Showcase Asse",
        description: "Evento showcase per Asse - Setup completo e produzione clip",
        dueDate: "2026-02-07",
        priority: "high",
        status: "todo",
        owner: "",
        assignedTo: [],
        checklist: [
            { text: "Post Instagram", done: false },
            { text: "Setup Attrezzatura", done: false },
            { text: "Setup Telecamere", done: false },
            { text: "Setup Studio", done: false },
            { text: "Clip Video (Scadenza: 14/02)", done: false }
        ]
    },
    {
        title: "Riprese Scomodo",
        description: "Riprese esterne per Scomodo - Attrezzatura mobile",
        dueDate: "2026-02-08",
        priority: "high",
        status: "todo",
        owner: "",
        assignedTo: [],
        checklist: [
            { text: "Setup Attrezzatura mobile", done: false },
            { text: "Setup Telecamere", done: false },
            { text: "Clip Video (Scadenza: 15/02)", done: false }
        ]
    },
    {
        title: "Live DEDO",
        description: "Live session con DEDO - Produzione completa",
        dueDate: "2026-02-13",
        priority: "high",
        status: "todo",
        owner: "",
        assignedTo: [],
        checklist: [
            { text: "Post Instagram", done: false },
            { text: "Setup Attrezzatura", done: false },
            { text: "Setup Telecamere", done: false },
            { text: "Setup Studio", done: false },
            { text: "Clip Video (Scadenza: 20/02)", done: false }
        ]
    },
    {
        title: "Live Ladymaru & 5QM",
        description: "Live session doppia con Ladymaru e 5QM",
        dueDate: "2026-02-20",
        priority: "high",
        status: "todo",
        owner: "",
        assignedTo: [],
        checklist: [
            { text: "Post Instagram", done: false },
            { text: "Setup Attrezzatura", done: false },
            { text: "Setup Telecamere", done: false },
            { text: "Setup Studio", done: false },
            { text: "Clip Video (Scadenza: 27/02)", done: false }
        ]
    },
    {
        title: "Live GIANNA",
        description: "Live session con GIANNA - Produzione completa",
        dueDate: "2026-02-21",
        priority: "high",
        status: "todo",
        owner: "",
        assignedTo: [],
        checklist: [
            { text: "Post Instagram", done: false },
            { text: "Setup Attrezzatura", done: false },
            { text: "Setup Telecamere", done: false },
            { text: "Setup Studio", done: false },
            { text: "Clip Video (Scadenza: 28/02)", done: false }
        ]
    },
    {
        title: "Serata Gateradio (Serena De Marchi + BLEACH)",
        description: "Evento serale Gateradio con Serena De Marchi e BLEACH",
        dueDate: "2026-02-27",
        priority: "high",
        status: "todo",
        owner: "",
        assignedTo: [],
        checklist: [
            { text: "Post Instagram", done: false },
            { text: "Setup Attrezzatura", done: false },
            { text: "Setup Telecamere", done: false },
            { text: "Setup Studio", done: false },
            { text: "Clip Video (Scadenza: 06/03)", done: false }
        ]
    },
    {
        title: "Showcase Resistance",
        description: "Evento showcase per Resistance - Produzione completa",
        dueDate: "2026-02-28",
        priority: "high",
        status: "todo",
        owner: "",
        assignedTo: [],
        checklist: [
            { text: "Post Instagram", done: false },
            { text: "Setup Attrezzatura", done: false },
            { text: "Setup Telecamere", done: false },
            { text: "Setup Studio", done: false },
            { text: "Clip Video (Scadenza: 07/03)", done: false }
        ]
    }
];

async function loadFebruaryTasks() {
    const tasksRef = ref(database, 'tasks');

    // Ottieni task esistenti
    const snapshot = await get(tasksRef);
    let existingTasks = [];

    if (snapshot.exists()) {
        const data = snapshot.val();
        if (Array.isArray(data)) {
            existingTasks = data;
        } else if (typeof data === 'object') {
            existingTasks = Object.values(data);
        }
    }

    // Verifica se i task esistono già (per titolo)
    const existingTitles = existingTasks.map(t => t.title);
    const tasksToAdd = [];

    for (let i = 0; i < februaryTasks.length; i++) {
        const task = februaryTasks[i];
        if (!existingTitles.includes(task.title)) {
            const now = Date.now();
            const newTask = {
                ...task,
                id: (now + i).toString(),
                createdAt: new Date(now + i).toISOString()
            };
            tasksToAdd.push(newTask);
        }
    }

    if (tasksToAdd.length === 0) {
        return { added: 0, skipped: februaryTasks.length, message: 'Tutti i task esistono già' };
    }

    // Aggiungi nuovi task
    const allTasksNew = [...existingTasks, ...tasksToAdd];
    await set(tasksRef, allTasksNew);

    return { added: tasksToAdd.length, skipped: februaryTasks.length - tasksToAdd.length };
}

function initLoadButton() {
    const loadBtn = document.getElementById('load-february-btn');
    const btnText = document.getElementById('load-btn-text');
    const loadIcon = document.getElementById('load-icon');

    if (!loadBtn) return;

    loadBtn.addEventListener('click', async () => {
        // Disabilita pulsante
        loadBtn.disabled = true;
        loadIcon.className = 'fa-solid fa-spinner fa-spin';
        btnText.textContent = 'Caricamento...';

        try {
            const result = await loadFebruaryTasks();

            if (result.added > 0) {
                loadIcon.className = 'fa-solid fa-check';
                btnText.textContent = `${result.added} task caricati!`;
                loadBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                loadBtn.classList.add('bg-green-500');
                alert(`Caricati ${result.added} nuovi task di Febbraio 2026!\n\nVai alla pagina Attività per assegnare i responsabili.`);
            } else {
                loadIcon.className = 'fa-solid fa-info-circle';
                btnText.textContent = 'Task già presenti';
                loadBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                loadBtn.classList.add('bg-yellow-500');
                alert('Tutti i task di Febbraio 2026 sono già presenti nel database.');
            }

            // Reset dopo 3 secondi
            setTimeout(() => {
                loadBtn.disabled = false;
                loadIcon.className = 'fa-solid fa-calendar-plus';
                btnText.textContent = 'Carica Task Febbraio';
                loadBtn.classList.remove('bg-green-500', 'bg-yellow-500');
                loadBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            }, 3000);

        } catch (error) {
            console.error('Errore:', error);
            loadIcon.className = 'fa-solid fa-exclamation-triangle';
            btnText.textContent = 'Errore!';
            loadBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            loadBtn.classList.add('bg-red-500');
            alert('Errore durante il caricamento: ' + error.message);

            setTimeout(() => {
                loadBtn.disabled = false;
                loadIcon.className = 'fa-solid fa-calendar-plus';
                btnText.textContent = 'Carica Task Febbraio';
                loadBtn.classList.remove('bg-red-500');
                loadBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            }, 3000);
        }
    });
}

// Inizializza pulsante e modale al DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initLoadButton();
    initEditModal();
});
