import { database } from './firebase-config.js';
import { ref, set, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
// FIX: Aggiunto onAuthReady per risolvere il problema di timing
import { currentUser } from './auth-guard.js';


// --- Riferimenti ai nodi del tuo database ---
const membersRef = ref(database, 'members');
const varExpensesRef = ref(database, 'variableExpenses');
const fixedExpensesRef = ref(database, 'fixedExpenses');
const incomeRef = ref(database, 'incomeEntries');
const wishlistRef = ref(database, 'wishlist');
const futureMovementsRef = ref(database, 'futureMovements');
const pendingPaymentsRef = ref(database, 'pendingPayments');
const cassaComuneRef = ref(database, 'cassaComune');
const expenseRequestsRef = ref(database, 'expenseRequests');


// --- Data State (Firebase-synced) ---
let members = [];
let variableExpenses = [];
let fixedExpenses = [];
let incomeEntries = [];
let wishlist = [];
let futureMovements = [];
let pendingPayments = [];
let cassaComune = { balance: 0, movements: [] };
let expenseRequests = {}; 

// Variabili per i grafici
let membersContributionsChart, membersIncomeChart, categoriesChart, balancesChart;
let tempWishlistLinks = [];


// --- Funzioni Utility ---

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const displayDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
};

const getItemFromStore = (type, id) => {
    let store;
    switch (type) {
        case 'variableExpense': store = variableExpenses; break;
        case 'fixedExpense': store = fixedExpenses; break;
        case 'incomeEntry': store = incomeEntries; break;
        case 'wishlistItem': store = wishlist; break;
        case 'futureMovement': store = futureMovements; break;
        case 'pendingPayment': store = pendingPayments; break;
        case 'member': store = members; break;
        default: return null;
    }
    return store.find(item => item.id === id);
};

// --- Funzioni di Interazione con Firebase ---

function saveDataToFirebase() {
    set(membersRef, members);
    set(varExpensesRef, variableExpenses);
    set(fixedExpensesRef, fixedExpenses);
    set(incomeRef, incomeEntries);
    set(wishlistRef, wishlist);
    set(futureMovementsRef, futureMovements);
    set(pendingPaymentsRef, pendingPayments);
    set(cassaComuneRef, cassaComune);
    set(expenseRequestsRef, expenseRequests);
}

function loadDataFromFirebase() {
    onValue(membersRef, (snapshot) => {
        members = snapshot.val() || [];
        renderMembers();
        toggleSectionsVisibility();
        updateDashboardView();
    });

    onValue(varExpensesRef, (snapshot) => {
        variableExpenses = snapshot.val() || [];
        renderVariableExpenses();
        updateDashboardView();
        populateMonthFilter();
    });

    onValue(fixedExpensesRef, (snapshot) => {
        fixedExpenses = snapshot.val() || [];
        renderFixedExpenses();
        updateDashboardView();
    });

    onValue(incomeRef, (snapshot) => {
        incomeEntries = snapshot.val() || [];
        renderIncomeEntries();
        updateDashboardView();
        populateMonthFilter();
    });

    onValue(wishlistRef, (snapshot) => {
        wishlist = snapshot.val() || [];
        renderWishlist();
    });

    onValue(futureMovementsRef, (snapshot) => {
        futureMovements = snapshot.val() || [];
        renderFutureMovements();
    });

    onValue(pendingPaymentsRef, (snapshot) => {
        pendingPayments = snapshot.val() || [];
        renderPendingPayments();
    });

    onValue(cassaComuneRef, (snapshot) => {
        cassaComune = snapshot.val() || { balance: 0, movements: [] };
        renderCassaComune();
        updateDashboardView();
    });

    onValue(expenseRequestsRef, (snapshot) => {
        expenseRequests = snapshot.val() || {};
        renderExpenseRequestsForAdmin();
    });
}

// --- Funzioni di Rendering e Logica ---

// Riferimenti DOM cruciali
const monthFilter = document.getElementById('month-filter');
const memberCountEl = document.getElementById('member-count');
const membersListEl = document.getElementById('members-list');
const newMemberNameInput = document.getElementById('new-member-name');
const addMemberBtn = document.getElementById('add-member-btn');
const payerSelect = document.getElementById('payer');
const expenseDateInput = document.getElementById('expense-date');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const descriptionInput = document.getElementById('description');
const addExpenseBtn = document.getElementById('add-expense-btn');
const fixedDescInput = document.getElementById('fixed-desc');
const fixedAmountInput = document.getElementById('fixed-amount');
const addFixedExpenseBtn = document.getElementById('add-fixed-expense-btn');
const fixedExpensesListEl = document.getElementById('fixed-expenses-list');
const totalFixedEl = document.getElementById('total-fixed-expense');
const totalVariableEl = document.getElementById('total-variable-expense');
const totalIncomeEl = document.getElementById('total-income');
const perPersonShareEl = document.getElementById('per-person-share');
const expensesListContainer = document.getElementById('expenses-list-container');
const calculateBtn = document.getElementById('calculate-btn');
const settlementContainer = document.getElementById('settlement-container');
const settlementList = document.getElementById('settlement-list');
const exportExcelBtn = document.getElementById('export-excel-btn');
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importFileInput = document.getElementById('import-file-input');
const incomeDateInput = document.getElementById('income-date');
const incomeAmountInput = document.getElementById('income-amount');
const incomeDescriptionInput = document.getElementById('income-description');
const incomeMembersCheckboxes = document.getElementById('income-members-checkboxes');
const addIncomeBtn = document.getElementById('add-income-btn');
const incomeListContainer = document.getElementById('income-list-container');
const wishlistItemNameInput = document.getElementById('wishlist-item-name');
const wishlistItemCostInput = document.getElementById('wishlist-item-cost');
const wishlistItemPriorityInput = document.getElementById('wishlist-item-priority');
const addWishlistItemBtn = document.getElementById('add-wishlist-item-btn');
const wishlistContainer = document.getElementById('wishlist-container');
const wishlistNewLinkInput = document.getElementById('wishlist-new-link-input');
const addWishlistLinkBtn = document.getElementById('add-wishlist-link-btn');
const wishlistLinksContainer = document.getElementById('wishlist-links-container');
const futureMovementDescriptionInput = document.getElementById('future-movement-description');
const futureMovementCostInput = document.getElementById('future-movement-cost');
const futureMovementDueDateInput = document.getElementById('future-movement-due-date');
const addFutureMovementBtn = document.getElementById('add-future-movement-btn');
const futureMovementsContainer = document.getElementById('future-movements-container');
const pendingPaymentMemberSelect = document.getElementById('pending-payment-member');
const pendingPaymentAmountInput = document.getElementById('pending-payment-amount');
const pendingPaymentDescriptionInput = document.getElementById('pending-payment-description');
const addPendingPaymentBtn = document.getElementById('add-pending-payment-btn');
const pendingPaymentsContainer = document.getElementById('pending-payments-container');
const quickActionsContainer = document.getElementById('quick-actions-section');
const actionForms = document.querySelectorAll('.action-form');
const editModal = document.getElementById('edit-modal');
const editModalTitle = document.getElementById('edit-modal-title');
const editModalFormContainer = document.getElementById('edit-modal-form-container');
const editModalActions = document.getElementById('edit-modal-actions');
const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
const cashBalanceAmountEl = document.getElementById('cash-balance-amount');
const cashMovementTypeSelect = document.getElementById('cash-movement-type');
const cashMovementMemberSelect = document.getElementById('cash-movement-member');
const cashMovementAmountInput = document.getElementById('cash-movement-amount');
const cashMovementDateInput = document.getElementById('cash-movement-date');
const cashMovementDescriptionInput = document.getElementById('cash-movement-description');
const addCashMovementBtn = document.getElementById('add-cash-movement-btn');
const cashMovementsHistoryEl = document.getElementById('cash-movements-history');


const sections = {
    summary: document.getElementById('summary-section'),
    cashBalance: document.getElementById('cash-balance-section'),
    expensesList: document.getElementById('expenses-list-section'),
    incomeList: document.getElementById('income-list-section'),
    wishlist: document.getElementById('wishlist-section'),
    futureMovements: document.getElementById('future-movements-section'),
    pendingPayments: document.getElementById('pending-payments-section'),
    quickActions: document.getElementById('quick-actions-section'),
    adminRequests: document.getElementById('admin-requests-section'),
};

const toggleSectionsVisibility = () => { 
    const hasMembers = members.length > 0;
    Object.values(sections).forEach(section => {
        if(section && section.id === 'admin-requests-section') {
             if(currentUser.role === 'admin' && hasMembers){
                 section.classList.remove('hidden');
             } else {
                 section.classList.add('hidden');
             }
        } else if(section) {
            section.classList.toggle('hidden', !hasMembers);
        }
    });
};

const populateMonthFilter = () => { 
    const monthFilter = document.getElementById('month-filter');
    if (!monthFilter) return;

    const allDates = [...variableExpenses, ...incomeEntries].map(item => new Date(item.date)).filter(d => !isNaN(d));
    const uniqueMonths = new Set(allDates.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`));
    
    // Rimuovi le vecchie opzioni
    monthFilter.innerHTML = '<option value="all">Tutti i mesi</option>';

    // Aggiungi le nuove opzioni
    Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a)).forEach(monthYear => {
        const [year, month] = monthYear.split('-');
        const date = new Date(year, parseInt(month) - 1);
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = monthName;
        monthFilter.appendChild(option);
    });
};

const renderMembers = () => {
    const memberCountEl = document.getElementById('member-count');
    const membersListEl = document.getElementById('members-list');
    const payerSelect = document.getElementById('payer');
    const fixedPayerSelect = document.getElementById('fixed-payer');
    const incomeMembersCheckboxes = document.getElementById('income-members-checkboxes');
    const pendingPaymentMemberSelect = document.getElementById('pending-payment-member');
    const cashMovementMemberSelect = document.getElementById('cash-movement-member');

    if (memberCountEl) memberCountEl.textContent = members.length;
    if (membersListEl) membersListEl.innerHTML = members.map(m => `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-sm">${m.name}<button data-id="${m.id}" data-type="member" class="open-edit-modal-btn text-indigo-500 hover:text-indigo-700">Modifica</button></li>`).join('');

    // Popola tutti i select dei membri
    const memberOptions = members.map(m => `<option value="${m.name}">${m.name}</option>`).join('');

    if (payerSelect) {
        payerSelect.innerHTML = `<option value="">Seleziona chi ha pagato</option>` + memberOptions;
    }
    if (fixedPayerSelect) {
        fixedPayerSelect.innerHTML = `<option value="">Seleziona chi paga (default: Tutti)</option>` + memberOptions;
    }
    if (pendingPaymentMemberSelect) {
        pendingPaymentMemberSelect.innerHTML = `<option value="">Seleziona membro</option>` + memberOptions;
    }
    if (cashMovementMemberSelect) {
        cashMovementMemberSelect.innerHTML = `<option value="">Nessuno</option>` + memberOptions;
    }

    if (incomeMembersCheckboxes) {
        incomeMembersCheckboxes.innerHTML = members.map(m => `
            <div class="flex items-center">
                <input type="checkbox" id="income-member-${m.id}" name="income-member" value="${m.name}" class="form-checkbox h-4 w-4 text-indigo-600">
                <label for="income-member-${m.id}" class="ml-2 text-sm">${m.name}</label>
            </div>
        `).join('');
    }
};


const renderCassaComune = () => {
    const cashBalanceAmountEl = document.getElementById('cash-balance-amount');
    const cashMovementsHistoryEl = document.getElementById('cash-movements-history');

    if (cashBalanceAmountEl) cashBalanceAmountEl.textContent = `€${cassaComune.balance.toFixed(2)}`;
    
    if (cashMovementsHistoryEl) {
        cashMovementsHistoryEl.innerHTML = cassaComune.movements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map(m => `
            <div class="flex justify-between items-center text-sm border-b pb-1 mb-1 ${m.type === 'deposit' ? 'text-green-700' : 'text-red-700'}">
                <span class="font-medium">${m.description} (${m.member || 'Cassa'})</span>
                <span class="font-bold">${m.type === 'deposit' ? '+' : '-'}€${m.amount.toFixed(2)}</span>
            </div>
        `).join('') || '<p class="text-gray-500">Nessun movimento recente.</p>';
    }
};

const renderPendingPayments = () => {
    const container = document.getElementById('pending-payments-container');
    if (!container) return;
    container.innerHTML = pendingPayments.map(p => `
        <div class="flex justify-between items-center bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-500">
            <span class="text-sm font-medium">${p.member} deve pagare ${p.description}</span>
            <span class="font-bold text-yellow-700">€${p.amount.toFixed(2)}</span>
            <button data-id="${p.id}" data-type="pendingPayment" class="complete-pending-btn text-sm bg-yellow-600 text-white py-1 px-3 rounded-lg hover:bg-yellow-700">Completa</button>
        </div>
    `).join('') || '<p class="text-gray-500">Nessun pagamento in sospeso.</p>';
};

const renderFutureMovements = () => {
    const container = document.getElementById('future-movements-container');
    if (!container) return;
    container.innerHTML = futureMovements.map(m => `
        <div class="flex justify-between items-center bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
            <span class="text-sm font-medium">${m.description} (Data prevista: ${displayDate(m.dueDate)})</span>
            <span class="font-bold text-blue-700">€${m.cost.toFixed(2)}</span>
            <button data-id="${m.id}" data-type="futureMovement" class="open-edit-modal-btn text-blue-600 hover:text-blue-800">Modifica</button>
        </div>
    `).join('') || '<p class="text-gray-500">Nessun movimento futuro pianificato.</p>';
};

const renderWishlist = () => {
    const container = document.getElementById('wishlist-container');
    const linksContainer = document.getElementById('wishlist-links-container');
    if (!container) return;

    container.innerHTML = wishlist.sort((a, b) => b.priority - a.priority).map(item => `
        <div class="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
            <span class="text-sm font-medium">${item.name} (Priorità: ${item.priority})</span>
            <span class="font-bold text-indigo-700">€${item.cost.toFixed(2)}</span>
            <button data-id="${item.id}" data-type="wishlistItem" class="open-edit-modal-btn text-indigo-600 hover:text-indigo-800">Modifica</button>
        </div>
    `).join('') || '<p class="text-gray-500">Nessun articolo nella lista desideri.</p>';
    
    // Render links
    if(linksContainer && wishlist.length > 0 && wishlist[0].links) {
        linksContainer.innerHTML = (wishlist[0].links || []).map(link => `
            <div class="flex justify-between items-center text-sm border-b pb-1 mb-1">
                <a href="${link}" target="_blank" class="text-indigo-500 hover:text-indigo-700 truncate">${link}</a>
                <button data-link="${link}" data-type="wishlistLink" class="remove-wishlist-link-btn text-red-500 hover:text-red-700">&times;</button>
            </div>
        `).join('') || '<p class="text-gray-500 text-xs">Nessun link associato.</p>';
    } else if (linksContainer) {
        linksContainer.innerHTML = '<p class="text-gray-500 text-xs">Nessun link associato.</p>';
    }
};

const renderIncomeEntries = () => {
    const container = document.getElementById('income-list-container');
    if (!container) return;
    container.innerHTML = incomeEntries.sort((a, b) => new Date(b.date) - new Date(a.date)).map(i => `
        <div class="flex justify-between items-center bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
            <div>
                <span class="font-medium">${i.description}</span>
                <span class="text-xs text-gray-500 block">Ricevuto da: ${i.members.join(', ')} il ${displayDate(i.date)}</span>
            </div>
            <span class="font-bold text-green-700">€${i.amount.toFixed(2)}</span>
            <button data-id="${i.id}" data-type="incomeEntry" class="open-edit-modal-btn text-green-600 hover:text-green-800">Modifica</button>
        </div>
    `).join('') || '<p class="text-gray-500">Nessuna entrata registrata.</p>';
};

const renderVariableExpenses = () => {
    const container = document.getElementById('expenses-list-container');
    if (!container) return;
    container.innerHTML = variableExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
        <div class="flex justify-between items-center bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
            <div>
                <span class="font-medium">${e.description} - ${e.category}</span>
                <span class="text-xs text-gray-500 block">Pagato da: ${e.payer} il ${displayDate(e.date)}</span>
            </div>
            <span class="font-bold text-red-700">€${e.amount.toFixed(2)}</span>
            <button data-id="${e.id}" data-type="variableExpense" class="open-edit-modal-btn text-red-600 hover:text-red-800">Modifica</button>
        </div>
    `).join('') || '<p class="text-gray-500">Nessuna spesa variabile registrata.</p>';
};

const renderFixedExpenses = () => {
    const container = document.getElementById('fixed-expenses-list');
    if (!container) return;
    container.innerHTML = fixedExpenses.map(f => `
        <div class="flex justify-between items-center bg-orange-50 p-3 rounded-lg border-l-4 border-orange-500">
            <div>
                <span class="font-medium">${f.description}</span>
                <span class="text-xs text-gray-500 block">Paga: ${f.payer}</span>
            </div>
            <span class="font-bold text-orange-700">€${f.amount.toFixed(2)}</span>
            <button data-id="${f.id}" data-type="fixedExpense" class="open-edit-modal-btn text-orange-600 hover:text-orange-800">Modifica</button>
        </div>
    `).join('') || '<p class="text-gray-500">Nessuna spesa fissa registrata.</p>';
};

const renderExpenseRequestsForAdmin = () => { 
    const container = document.getElementById('admin-requests-container');
    const section = document.getElementById('admin-requests-section');
    if (!container || !section || currentUser.role !== 'admin') {
        if(section) section.classList.add('hidden');
        return;
    }

    const pendingRequests = Object.entries(expenseRequests).filter(([key, req]) => req.status === 'pending');
    
    section.classList.toggle('hidden', pendingRequests.length === 0);
    container.innerHTML = '';

    if (pendingRequests.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Nessuna richiesta in sospeso.</p>';
        return;
    }

    pendingRequests.forEach(([key, req]) => {
        const requesterName = members.find(m => m.id === req.requesterUid)?.name || 'N/A';
        const reqEl = document.createElement('div');
        reqEl.className = 'bg-white p-3 rounded-lg border flex justify-between items-center mb-2';
        reqEl.innerHTML = `
            <div>
                <p class="font-semibold">${req.description} <span class="font-normal text-gray-600">- ${req.category}</span></p>
                <p class="text-sm text-gray-500">
                    Richiedente: <span class="font-medium">${requesterName}</span> | 
                    Pagante: <span class="font-medium">${req.payer}</span> |
                    Data: ${displayDate(req.date)}
                </p>
            </div>
            <div class="flex items-center gap-3">
                <p class="font-bold text-lg text-indigo-600">€${parseFloat(req.amount).toFixed(2)}</p>
                <div class="flex flex-col gap-1">
                    <button data-key="${key}" class="approve-request-btn text-xs bg-green-500 text-white font-semibold py-1 px-3 rounded-lg hover:bg-green-600">Approva</button>
                    <button data-key="${key}" class="reject-request-btn text-xs bg-red-500 text-white font-semibold py-1 px-3 rounded-lg hover:bg-red-600">Rifiuta</button>
                </div>
            </div>
        `;
        container.appendChild(reqEl);
    });
};

// Funzioni per i grafici
const createBarChart = (canvasId, label, data, labels, color) => {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const existingChart = Chart.getChart(canvasId);
    if (existingChart) existingChart.destroy();

    const chartData = {
        labels: labels,
        datasets: [{
            label: label,
            data: data,
            backgroundColor: color,
            borderColor: color.map(c => c.replace('0.2', '1')), // Versione più scura per il bordo
            borderWidth: 1
        }]
    };

    const chartConfig = {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    };

    return new Chart(ctx, chartConfig);
};

const initializeCharts = () => {
    const data = getCalculationData();
    const memberNames = members.map(m => m.name);
    const memberColors = ['rgba(79, 70, 239, 0.6)', 'rgba(249, 115, 22, 0.6)', 'rgba(16, 185, 129, 0.6)', 'rgba(239, 68, 68, 0.6)', 'rgba(99, 102, 241, 0.6)', 'rgba(251, 146, 60, 0.6)', 'rgba(52, 211, 153, 0.6)', 'rgba(248, 113, 113, 0.6)'];

    // 1. Contributi per membro (Spese variabili)
    const contributionsData = memberNames.map(name => data.expenses.filter(e => e.payer === name).reduce((sum, e) => sum + e.amount, 0));
    if(document.getElementById('membersContributionsChart')) {
        membersContributionsChart = createBarChart('membersContributionsChart', 'Contributi Spese Variabili', contributionsData, memberNames, memberColors);
    }
    
    // 2. Entrate per membro
    // La riga corretta, con il controllo di sicurezza "i.members &&"
    const incomeData = memberNames.map(name => data.income.filter(i => i.members && i.members.includes(name)).reduce((sum, i) => sum + i.amount / i.members.length, 0));
    if(document.getElementById('membersIncomeChart')) {
        membersIncomeChart = createBarChart('membersIncomeChart', 'Ripartizione Entrate', incomeData, memberNames, memberColors);
    }

    // 3. Spese per categoria
    const categoryMap = [...data.expenses, ...data.fixedExpenses].reduce((map, e) => {
        map.set(e.category, (map.get(e.category) || 0) + e.amount);
        return map;
    }, new Map());
    const categoryLabels = Array.from(categoryMap.keys());
    const categoryData = Array.from(categoryMap.values());
    const categoryColors = categoryLabels.map((_, i) => memberColors[i % memberColors.length].replace('1', '0.6'));
    if(document.getElementById('categoriesChart')) {
        categoriesChart = createBarChart('categoriesChart', 'Spese per Categoria', categoryData, categoryLabels, categoryColors);
    }
    
    // 4. Bilanci finali (Netto) - Logica Semplificata
    const balanceData = memberNames.map(name => {
        const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
        const individualExpensesPaid = data.expenses.filter(e => e.payer === name).reduce((sum, e) => sum + e.amount, 0);
        const shareOfTotalExpense = (totalExpenses + data.fixedExpenses.reduce((sum, f) => sum + f.amount, 0)) / members.length;
        
        return individualExpensesPaid - shareOfTotalExpense; 
    });
    const balanceColors = balanceData.map(b => b >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'); // Verde o Rosso
    if(document.getElementById('balancesChart')) {
        balancesChart = createBarChart('balancesChart', 'Bilanci (Netto)', balanceData, memberNames, balanceColors);
    }
};

const updateDashboardView = () => { 
    // Aggiorna i totali basati sullo stato corrente
    const totalVar = variableExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalFix = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalInc = incomeEntries.reduce((sum, i) => sum + i.amount, 0);
    
    // Aggiorna gli elementi del DOM
    const totalVariableEl = document.getElementById('total-variable-expense');
    const totalFixedEl = document.getElementById('total-fixed-expense');
    const totalIncomeEl = document.getElementById('total-income');
    const memberCountEl = document.getElementById('member-count');
    const perPersonShareEl = document.getElementById('per-person-share');
    const cashBalanceAmountEl = document.getElementById('cash-balance-amount');

    if (totalVariableEl) totalVariableEl.textContent = `€${totalVar.toFixed(2)}`;
    if (totalFixedEl) totalFixedEl.textContent = `€${totalFix.toFixed(2)}`;
    if (totalIncomeEl) totalIncomeEl.textContent = `€${totalInc.toFixed(2)}`;
    
    if (memberCountEl) memberCountEl.textContent = members.length;
    if (perPersonShareEl && members.length > 0) perPersonShareEl.textContent = `€${((totalVar + totalFix) / members.length).toFixed(2)}`;
    if (cashBalanceAmountEl) cashBalanceAmountEl.textContent = `€${cassaComune.balance.toFixed(2)}`;

    // Aggiorna i grafici e ricalcola il conguaglio
    initializeCharts(); 
    calculateAndRenderSettlement(true); 
};


const getCalculationData = (selectedMonth = 'all') => {
    // Questa funzione serve a filtrare i dati per il mese selezionato (o tutti)
    const filterData = (data) => {
        if (selectedMonth === 'all') return data;
        return data.filter(item => {
            const itemDate = new Date(item.date || item.dueDate);
            return `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
        });
    };

    // Filtra tutte le collezioni
    const filteredExpenses = filterData(variableExpenses);
    const filteredIncome = filterData(incomeEntries);
    
    return {
        members: members,
        expenses: filteredExpenses,
        fixedExpenses: fixedExpenses, // Le spese fisse non vengono filtrate per mese qui, ma vengono considerate in getCalculationData
        income: filteredIncome
    };
};

const calculateAndRenderSettlement = (forExport = false) => {
    // 1. Preparazione dei dati e filtro
    const monthFilter = document.getElementById('month-filter');
    const selectedMonth = monthFilter ? monthFilter.value : 'all';
    const data = getCalculationData(selectedMonth);

    const memberNames = data.members.map(m => m.name);
    if (memberNames.length === 0) return;

    // 2. Calcolo dei debiti/crediti totali
    const balances = {};
    memberNames.forEach(name => balances[name] = 0);

    const allExpenses = [...data.expenses, ...data.fixedExpenses];
    const totalMembers = memberNames.length;

    // A. Distribuzione delle spese (Variabili + Fisse)
    allExpenses.forEach(e => {
        const costPerPerson = e.amount / totalMembers;
        memberNames.forEach(name => {
            if (e.payer === name) {
                // Se ha pagato, è a credito per l'importo pagato - la sua quota
                balances[name] += e.amount - costPerPerson;
            } else {
                // Se non ha pagato, è a debito per la sua quota
                balances[name] -= costPerPerson;
            }
        });
    });

    // B. Distribuzione delle entrate
    data.income.forEach(i => {
        const valuePerPerson = i.amount / i.members.length;
        i.members.forEach(name => {
            // Se ha ricevuto l'entrata, è a credito per la sua quota
            balances[name] += valuePerPerson;
        });
    });

    // 3. Algoritmo di conguaglio (Minimizzazione dei movimenti)
    const creditors = [];
    const debtors = [];

    for (const name in balances) {
        if (balances[name] > 0.01) { // A credito
            creditors.push({ name, amount: balances[name] });
        } else if (balances[name] < -0.01) { // A debito
            debtors.push({ name, amount: Math.abs(balances[name]) });
        }
    }

    const settlements = [];
    let i = 0; // creditor index
    let j = 0; // debtor index

    while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];

        const transferAmount = Math.min(creditor.amount, debtor.amount);
        
        settlements.push({
            payer: debtor.name,
            recipient: creditor.name,
            amount: transferAmount
        });

        creditor.amount -= transferAmount;
        debtor.amount -= transferAmount;

        if (creditor.amount < 0.01) {
            i++;
        }

        if (debtor.amount < 0.01) {
            j++;
        }
    }

    // 4. Rendering/Export
    if (forExport) return settlements;

    const settlementList = document.getElementById('settlement-list');
    const settlementContainer = document.getElementById('settlement-container');
    if (!settlementList || !settlementContainer) return;

    settlementList.innerHTML = '';

    if (settlements.length === 0) {
        settlementList.innerHTML = '<li class="text-green-500 font-semibold">Tutto in pari!</li>';
    } else {
        settlements.forEach(s => {
            const li = document.createElement('li');
            li.className = 'text-gray-700 font-medium';
            li.innerHTML = `<span class="text-red-500">${s.payer}</span> deve dare <span class="font-bold text-lg text-indigo-600">€${s.amount.toFixed(2)}</span> a <span class="text-green-500">${s.recipient}</span>`;
            settlementList.appendChild(li);
        });
    }

    settlementContainer.classList.remove('hidden');
    return settlements;
};

// --- Funzioni CRUD e di gestione form ---

const openEditModal = (id, type) => { 
    const item = getItemFromStore(type, id);
    if (!item) return;

    const editModal = document.getElementById('edit-modal');
    const editModalTitle = document.getElementById('edit-modal-title');
    const editModalFormContainer = document.getElementById('edit-modal-form-container');
    const editModalActions = document.getElementById('edit-modal-actions');
    const isMember = type === 'member';

    editModalTitle.textContent = `Modifica ${type}`;
    editModalFormContainer.innerHTML = '';
    editModalActions.innerHTML = '';

    let formHtml = `<form id="edit-form" data-id="${id}" data-type="${type}" class="space-y-4">`;
    let deleteBtnHtml = '';

    // Aggiungi campi del form in base al tipo
    for (const key in item) {
        if (key === 'id' || (isMember && key === 'contributions')) continue;

        const value = item[key];
        const label = key.replace(/([A-Z])/g, ' $1').replace('_', ' ').toLowerCase();

        if (key === 'payer' || key === 'member') {
            formHtml += `
                <div>
                    <label for="edit-${key}" class="block text-sm font-medium capitalize">${label}</label>
                    <select id="edit-${key}" name="${key}" class="w-full p-3 border rounded-lg">
                        ${members.map(m => `<option value="${m.name}" ${m.name === value ? 'selected' : ''}>${m.name}</option>`).join('')}
                    </select>
                </div>`;
        } else if (key === 'links' && type === 'wishlistItem') {
            // Gestione dei link
            formHtml += `
                <div class="border p-3 rounded-lg">
                    <label class="block text-sm font-medium">Link Associati</label>
                    <div id="edit-links-container" class="space-y-2 mt-2">
                        ${(value || []).map(link => `
                            <div class="flex items-center space-x-2">
                                <input type="text" class="w-full p-1 border rounded-md" value="${link}">
                                <button type="button" class="remove-edit-link-btn text-red-500">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="flex mt-3">
                        <input type="url" id="new-edit-link" placeholder="Aggiungi nuovo link" class="w-full p-2 border rounded-l-lg">
                        <button type="button" id="add-edit-link-btn" class="bg-indigo-500 text-white p-2 rounded-r-lg">+</button>
                    </div>
                </div>`;
        } else if (key === 'members' && type === 'incomeEntry') {
            formHtml += `
                <div class="border p-3 rounded-lg">
                    <label class="block text-sm font-medium">Membri che hanno ricevuto</label>
                    <div id="edit-income-members-checkboxes" class="grid grid-cols-2 gap-2 mt-2">
                        ${members.map(m => `
                            <div class="flex items-center">
                                <input type="checkbox" id="edit-income-member-${m.id}" name="members" value="${m.name}" class="form-checkbox h-4 w-4 text-indigo-600" ${value.includes(m.name) ? 'checked' : ''}>
                                <label for="edit-income-member-${m.id}" class="ml-2 text-sm">${m.name}</label>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        } else if (typeof value === 'boolean') {
            formHtml += `
                <div class="flex items-center">
                    <input type="checkbox" id="edit-${key}" name="${key}" class="form-checkbox h-5 w-5 text-indigo-600" ${value ? 'checked' : ''}>
                    <label for="edit-${key}" class="ml-2 text-sm capitalize">${label}</label>
                </div>`;
        } else if (key.includes('date') || key.includes('dueDate')) {
            formHtml += `
                <div>
                    <label for="edit-${key}" class="block text-sm font-medium capitalize">${label}</label>
                    <input type="date" id="edit-${key}" name="${key}" value="${value}" class="w-full p-3 border rounded-lg">
                </div>`;
        } else if (typeof value === 'number') {
            formHtml += `
                <div>
                    <label for="edit-${key}" class="block text-sm font-medium capitalize">${label}</label>
                    <input type="number" id="edit-${key}" name="${key}" value="${value}" class="w-full p-3 border rounded-lg">
                </div>`;
        } else {
            formHtml += `
                <div>
                    <label for="edit-${key}" class="block text-sm font-medium capitalize">${label}</label>
                    <input type="text" id="edit-${key}" name="${key}" value="${value}" class="w-full p-3 border rounded-lg">
                </div>`;
        }
    }
    formHtml += `</form>`;

    deleteBtnHtml = `<button type="button" id="delete-edit-btn" class="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600">Elimina</button>`;
    
    editModalFormContainer.innerHTML = formHtml;
    editModalActions.innerHTML = `
        <div class="flex justify-end gap-3 mt-4">
            ${deleteBtnHtml}
            <button type="button" id="cancel-edit-btn" class="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">Annulla</button>
            <button type="submit" form="edit-form" class="bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600">Salva Modifiche</button>
        </div>`;

    editModal.classList.remove('hidden');

    // Aggiungi listener per i link (interno alla modale)
    const addLinkBtn = document.getElementById('add-edit-link-btn');
    if (addLinkBtn) {
        addLinkBtn.addEventListener('click', () => {
            const input = document.getElementById('new-edit-link');
            const container = document.getElementById('edit-links-container');
            if (input.value.trim() && container) {
                const div = document.createElement('div');
                div.className = 'flex items-center space-x-2';
                div.innerHTML = `<input type="text" class="w-full p-1 border rounded-md" value="${input.value.trim()}"><button type="button" class="remove-edit-link-btn text-red-500 hover:text-red-700">&times;</button>`;
                container.appendChild(div);
                input.value = '';
            }
        });
    }

    document.getElementById('delete-edit-btn').addEventListener('click', () => {
        if (confirm(`Sei sicuro di voler eliminare questo elemento (${type})?`)) {
            let store;
            switch (type) {
                case 'variableExpense': store = variableExpenses; break;
                case 'fixedExpense': store = fixedExpenses; break;
                case 'incomeEntry': store = incomeEntries; break;
                case 'wishlistItem': store = wishlist; break;
                case 'futureMovement': store = futureMovements; break;
                case 'pendingPayment': store = pendingPayments; break;
                case 'member': store = members; break;
            }
            const index = store.findIndex(i => i.id === id);
            if (index !== -1) {
                store.splice(index, 1);
                saveDataToFirebase();
                updateDashboardView();
                closeEditModal();
            }
        }
    });

    document.getElementById('edit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const updatedItem = {};
        
        // Estrai tutti i valori del form
        for (const [key, value] of formData.entries()) {
            if (key === 'members') {
                // Gestione checkbox multiple
                if (!updatedItem.members) updatedItem.members = [];
                updatedItem.members.push(value);
            } else if (!isMember && (key.includes('amount') || key.includes('cost'))) {
                updatedItem[key] = parseFloat(value);
            } else {
                updatedItem[key] = value;
            }
        }
        
        // Gestione dei link custom per wishlist (prendi i valori dai campi di input dinamici)
        if (type === 'wishlistItem') {
            const linkInputs = document.querySelectorAll('#edit-links-container input[type="text"]');
            updatedItem.links = Array.from(linkInputs).map(input => input.value.trim()).filter(val => val);
        }
        
        // Applica le modifiche allo store corretto
        let store;
        switch (type) {
            case 'variableExpense': store = variableExpenses; break;
            case 'fixedExpense': store = fixedExpenses; break;
            case 'incomeEntry': store = incomeEntries; break;
            case 'wishlistItem': store = wishlist; break;
            case 'futureMovement': store = futureMovements; break;
            case 'pendingPayment': store = pendingPayments; break;
            case 'member': store = members; break;
        }

        const index = store.findIndex(i => i.id === id);
        if (index !== -1) {
            // Aggiorna solo le proprietà modificate, mantenendo l'ID e altre proprietà non modificate
            store[index] = { ...store[index], ...updatedItem, id: id };
            saveDataToFirebase();
            updateDashboardView();
            closeEditModal();
        }
    });
};


const closeEditModal = () => {
    const editModal = document.getElementById('edit-modal');
    if (editModal) editModal.classList.add('hidden');
};

function handleAddMovement() {
    const movementType = document.getElementById('cash-movement-type').value;
    const member = document.getElementById('cash-movement-member').value || 'Cassa';
    const amount = parseFloat(document.getElementById('cash-movement-amount').value);
    const date = document.getElementById('cash-movement-date').value || today;
    const description = document.getElementById('cash-movement-description').value.trim();

    if (isNaN(amount) || amount <= 0 || !description) {
        alert("Inserisci un importo e una descrizione validi.");
        return;
    }

    if (movementType === 'withdrawal' && cassaComune.balance < amount) {
        alert("Errore: Prelievo superiore al saldo disponibile in cassa.");
        return;
    }

    const newBalance = movementType === 'deposit' ? cassaComune.balance + amount : cassaComune.balance - amount;

    cassaComune.balance = newBalance;
    cassaComune.movements.push({
        id: Date.now().toString(),
        type: movementType,
        amount: amount,
        member: member,
        date: date,
        description: description
    });

    saveDataToFirebase();
    alert(`Movimento di ${movementType} registrato. Nuovo saldo: €${newBalance.toFixed(2)}`);
    // Chiudi il form
    document.getElementById('cash-form-section').classList.add('hidden');
};

function addExpenseAsAdmin(expenseData = null) {
    const isRequest = !!expenseData;
    let newExpense;

    if (isRequest) {
        newExpense = {
            id: Date.now().toString(),
            date: expenseData.date,
            payer: expenseData.payer,
            amount: expenseData.amount,
            category: expenseData.category,
            description: expenseData.description
        };
    } else {
        const payer = document.getElementById('payer').value;
        const date = document.getElementById('expense-date').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value;

        if (!payer || !date || isNaN(amount) || amount <= 0 || !category || !description) {
            alert("Compila tutti i campi obbligatori per la spesa.");
            return;
        }

        newExpense = {
            id: Date.now().toString(),
            date: date,
            payer: payer,
            amount: amount,
            category: category,
            description: description
        };
    }

    variableExpenses.push(newExpense);
    saveDataToFirebase();
    alert(`Spesa ${isRequest ? 'approvata e ' : ''}aggiunta con successo.`);
    if (!isRequest) document.getElementById('expense-form-section').classList.add('hidden');
};

function submitExpenseRequest() {
    const payer = document.getElementById('payer').value;
    const date = document.getElementById('expense-date').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const description = document.getElementById('description').value;

    if (!payer || !date || isNaN(amount) || amount <= 0 || !category || !description) {
        alert("Compila tutti i campi obbligatori per la richiesta di spesa.");
        return;
    }

    const newRequest = {
        id: Date.now().toString(),
        requesterUid: currentUser.uid,
        requesterName: currentUser.email.split('@')[0], // Nome utente semplificato
        date: date,
        payer: payer,
        amount: amount,
        category: category,
        description: description,
        status: 'pending'
    };

    const newKey = push(expenseRequestsRef).key;
    expenseRequests[newKey] = newRequest;

    saveDataToFirebase();
    alert("Richiesta di spesa inviata all'amministratore per approvazione.");
    document.getElementById('expense-form-section').classList.add('hidden');
};

function createLinkedExpense(payer, date, amount, description, category) {
    const newExpense = {
        id: Date.now().toString(),
        date: date,
        payer: payer,
        amount: amount,
        category: category,
        description: description
    };
    variableExpenses.push(newExpense);
    saveDataToFirebase();
};

function handleExportData() { 
    const dataToExport = {
        members: members,
        variableExpenses: variableExpenses,
        fixedExpenses: fixedExpenses,
        incomeEntries: incomeEntries,
        wishlist: wishlist,
        futureMovements: futureMovements,
        pendingPayments: pendingPayments,
        cassaComune: cassaComune,
        expenseRequests: expenseRequests
    };
    const dataStr = JSON.stringify(dataToExport, null, 4);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gateradio_finanze_backup_${formatDate(new Date().toISOString())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("Dati esportati con successo!");
}

function handleImportData(event) { 
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!confirm("Sei sicuro di voler SOVRASCRIVERE i dati attuali con questo backup? Questa azione è irreversibile!")) return;
            
            // Sovrascrivi tutti gli store globali con i dati importati
            members = importedData.members || [];
            variableExpenses = importedData.variableExpenses || [];
            fixedExpenses = importedData.fixedExpenses || [];
            incomeEntries = importedData.incomeEntries || [];
            wishlist = importedData.wishlist || [];
            futureMovements = importedData.futureMovements || [];
            pendingPayments = importedData.pendingPayments || [];
            cassaComune = importedData.cassaComune || { balance: 0, movements: [] };
            expenseRequests = importedData.expenseRequests || {};

            saveDataToFirebase();
            alert("Dati importati con successo e salvati su Firebase! La pagina verrà aggiornata.");
        } catch (error) {
            console.error("Errore durante l'importazione del file JSON:", error);
            alert("Errore nell'importazione: file non valido o corrotto.");
        }
    };
    reader.readAsText(file);
}

function exportToExcel() { 
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Riepilogo Finanze');
    
    // Aggiungi logica di esportazione...
    alert("Esportazione Excel avviata. Controlla il download del file.");

    const settlements = calculateAndRenderSettlement(true);
    const settlementSheet = workbook.addWorksheet('Conguaglio');
    settlementSheet.addRow(['Chi paga', 'Chi riceve', 'Importo (€)']);
    settlements.forEach(s => settlementSheet.addRow([s.payer, s.recipient, s.amount.toFixed(2)]));

    workbook.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gateradio_conguaglio_${formatDate(new Date().toISOString())}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}


// --- Riferimenti DOM (Per gli Event Listeners) ---



// Imposta le date di default
const today = new Date().toISOString().split('T')[0];
if (expenseDateInput) expenseDateInput.value = today;
if (incomeDateInput) incomeDateInput.value = today;
if (futureMovementDueDateInput) futureMovementDueDateInput.value = today;


// --- Event Listeners ---

if (monthFilter) monthFilter.addEventListener('change', updateDashboardView);

if (addMemberBtn) addMemberBtn.addEventListener('click', () => {
    const name = newMemberNameInput.value.trim();
    if (name && !members.some(m => m.name === name)) {
        members.push({ id: Date.now().toString(), name: name });
        saveDataToFirebase();
        newMemberNameInput.value = '';
    } else if (name) {
        alert("Membro già esistente.");
    }
});
if (addCashMovementBtn) addCashMovementBtn.addEventListener('click', handleAddMovement);
if (addPendingPaymentBtn) addPendingPaymentBtn.addEventListener('click', () => {
    const member = document.getElementById('pending-payment-member').value;
    const amount = parseFloat(document.getElementById('pending-payment-amount').value);
    const description = document.getElementById('pending-payment-description').value.trim();

    if (!member || isNaN(amount) || amount <= 0 || !description) {
        alert("Compila tutti i campi obbligatori.");
        return;
    }

    pendingPayments.push({
        id: Date.now().toString(),
        member: member,
        amount: amount,
        description: description,
        date: today
    });
    saveDataToFirebase();
    document.getElementById('pending-payment-form-section').classList.add('hidden');
    alert("Richiesta quota aggiunta.");
});

if (addFutureMovementBtn) addFutureMovementBtn.addEventListener('click', () => {
    const description = document.getElementById('future-movement-description').value.trim();
    const cost = parseFloat(document.getElementById('future-movement-cost').value);
    const dueDate = document.getElementById('future-movement-due-date').value;

    if (!description || isNaN(cost) || cost <= 0 || !dueDate) {
        alert("Compila tutti i campi obbligatori.");
        return;
    }

    futureMovements.push({
        id: Date.now().toString(),
        description: description,
        cost: cost,
        dueDate: dueDate
    });
    saveDataToFirebase();
    document.getElementById('future-movement-form-section').classList.add('hidden');
    alert("Movimento futuro pianificato.");
});

if (wishlistNewLinkInput && addWishlistLinkBtn) addWishlistLinkBtn.addEventListener('click', () => {
    const input = wishlistNewLinkInput;
    if(input.value.trim()){
        if(wishlist.length === 0) wishlist.push({id: '1', name: "Articoli Generici", cost: 0, priority: "2-Media", links: []});
        wishlist[0].links.push(input.value.trim());
        input.value = '';
        saveDataToFirebase();
    }
});
if (wishlistLinksContainer) wishlistLinksContainer.addEventListener('click', (e) => {
    if(e.target.matches('.remove-wishlist-link-btn')){
        const linkToRemove = e.target.dataset.link;
        if(wishlist.length > 0 && wishlist[0].links) {
            wishlist[0].links = wishlist[0].links.filter(link => link !== linkToRemove);
            saveDataToFirebase();
        }
    }
});


if (addWishlistItemBtn) addWishlistItemBtn.addEventListener('click', () => {
    const name = document.getElementById('wishlist-item-name').value.trim();
    const cost = parseFloat(document.getElementById('wishlist-item-cost').value);
    const priority = document.getElementById('wishlist-item-priority').value;

    if (!name || isNaN(cost) || cost <= 0) {
        alert("Compila nome e costo stimato.");
        return;
    }

    wishlist.push({
        id: Date.now().toString(),
        name: name,
        cost: cost,
        priority: priority,
        links: []
    });
    saveDataToFirebase();
    document.getElementById('wishlist-form-section').classList.add('hidden');
    alert("Articolo aggiunto alla lista desideri.");
});
if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => {
    const date = document.getElementById('income-date').value;
    const amount = parseFloat(document.getElementById('income-amount').value);
    const description = document.getElementById('income-description').value.trim();
    const membersInvolved = Array.from(document.querySelectorAll('#income-members-checkboxes input:checked')).map(cb => cb.value);

    if (!date || isNaN(amount) || amount <= 0 || !description || membersInvolved.length === 0) {
        alert("Compila tutti i campi e seleziona almeno un membro.");
        return;
    }

    incomeEntries.push({
        id: Date.now().toString(),
        date: date,
        amount: amount,
        description: description,
        members: membersInvolved
    });
    saveDataToFirebase();
    document.getElementById('income-form-section').classList.add('hidden');
    alert("Entrata aggiunta.");
});


if (addExpenseBtn) {
    if(currentUser.role !== 'admin'){
        addExpenseBtn.textContent = 'Invia Richiesta Spesa';
    }
    addExpenseBtn.addEventListener('click', () => {
        if (currentUser.role === 'admin') {
            addExpenseAsAdmin();
        } else {
            submitExpenseRequest();
        }
    });
}

if (addFixedExpenseBtn) addFixedExpenseBtn.addEventListener('click', () => {
    const description = document.getElementById('fixed-desc').value.trim();
    const amount = parseFloat(document.getElementById('fixed-amount').value);
    // const payer = document.getElementById('fixed-payer').value; // Implementazione omessa nel form HTML, usa solo descrizione e importo

    if (!description || isNaN(amount) || amount <= 0) {
        alert("Compila descrizione e importo per la spesa fissa.");
        return;
    }

    fixedExpenses.push({
        id: Date.now().toString(),
        description: description,
        amount: amount,
        payer: 'Tutti' // Default
    });
    saveDataToFirebase();
    document.getElementById('fixed-expenses-section').classList.add('hidden');
    alert("Spesa fissa aggiunta.");
});

if (quickActionsContainer) quickActionsContainer.addEventListener('click', (e) => {
    if (e.target.matches('.action-btn')) {
        const targetId = e.target.dataset.formId;
        const targetForm = document.getElementById(targetId);
        
        // Chiudi tutti i form
        document.querySelectorAll('.action-form').forEach(form => form.classList.add('hidden'));

        // Apri il form selezionato
        if (targetForm) {
            targetForm.classList.remove('hidden');
        }
    }
});

document.addEventListener('click', (e) => {
    if (e.target.matches('.open-edit-modal-btn')) {
        const id = e.target.dataset.id;
        const type = e.target.dataset.type;
        openEditModal(id, type);
    }
    
    // Logica per approvare/rifiutare richieste (Admin)
    if (e.target.matches('.approve-request-btn')) {
        const key = e.target.dataset.key;
        if(key && expenseRequests[key]){
            const req = expenseRequests[key];
            addExpenseAsAdmin({
                payer: req.payer,
                date: req.date,
                amount: req.amount,
                category: req.category,
                description: `[RICHIESTA APPROVATA] ${req.description}`,
            });
            expenseRequests[key].status = 'approved';
            saveDataToFirebase();
            renderExpenseRequestsForAdmin();
        }
    }
    if (e.target.matches('.reject-request-btn')) {
        const key = e.target.dataset.key;
        if(key && expenseRequests[key]){
            expenseRequests[key].status = 'rejected';
            saveDataToFirebase();
            renderExpenseRequestsForAdmin();
        }
    }
    
    // Logica per chiudere i form
    if (e.target.matches('.close-form-btn')) {
        e.target.closest('.action-form').classList.add('hidden');
    }

    if (e.target.matches('.remove-edit-link-btn')) {
        e.target.parentElement.remove();
    }
    
    // Chiusura modale
    if (e.target === editModal || e.target.matches('#close-edit-modal-btn') || e.target.matches('#cancel-edit-btn')) {
        closeEditModal();
    }
    
    if (e.target.matches('.complete-pending-btn')) {
        const id = e.target.dataset.id;
        if(confirm("Sei sicuro di voler contrassegnare questo pagamento come completato?")){
            pendingPayments = pendingPayments.filter(p => p.id !== id);
            saveDataToFirebase();
        }
    }
});

// Gestione Modale (Edit, Save) - Logica dettagliata nell'openEditModal

if (calculateBtn) calculateBtn.addEventListener('click', () => calculateAndRenderSettlement(false));
if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);
if (exportDataBtn) exportDataBtn.addEventListener('click', handleExportData);
if (importDataBtn) importDataBtn.addEventListener('click', () => importFileInput.click());
if (importFileInput) importFileInput.addEventListener('change', handleImportData);


// --- App Initialization (PUNTO DI INNESTO DEL FIX) ---
document.addEventListener('authReady', () => {
    // Controlla di essere effettivamente nella pagina delle finanze prima di eseguire il codice
    if (document.getElementById('member-count')) {
        console.log("Auth pronto, avvio la pagina finanze...");
        initializeCharts();
        loadDataFromFirebase(); 
    }
});




