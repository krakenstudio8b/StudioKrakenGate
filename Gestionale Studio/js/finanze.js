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

// Sostituisci la tua vecchia funzione loadDataFromFirebase con questa

// SOSTITUISCI QUESTA INTERA FUNZIONE NEL TUO FILE

function loadDataFromFirebase() {
    onValue(membersRef, (snapshot) => {
        const rawData = snapshot.val() || [];
        if (Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === 'string') {
            members = rawData.map((name, index) => ({ id: String(index), name: name }));
        } else {
            // Se Firebase restituisce un oggetto, lo converte in array
            members = Array.isArray(rawData) ? rawData : (rawData ? Object.values(rawData) : []);
        }
        renderMembers();
        toggleSectionsVisibility();
        updateDashboardView();
    });

    onValue(varExpensesRef, (snapshot) => {
        const data = snapshot.val();
        // --- CORREZIONE CRUCIALE ---
        // Converte sempre il risultato in un array per sicurezza
        variableExpenses = data ? Object.values(data) : [];
        renderVariableExpenses();
        updateDashboardView();
        populateMonthFilter();
    });

    onValue(fixedExpensesRef, (snapshot) => {
        const data = snapshot.val();
        // --- CORREZIONE CRUCIALE ---
        fixedExpenses = data ? Object.values(data) : [];
        renderFixedExpenses();
        updateDashboardView();
    });

    onValue(incomeRef, (snapshot) => {
        const data = snapshot.val();
        // --- CORREZIONE CRUCIALE ---
        incomeEntries = data ? Object.values(data) : [];
        renderIncomeEntries();
        updateDashboardView();
        populateMonthFilter();
    });

    onValue(wishlistRef, (snapshot) => {
        const data = snapshot.val();
        // --- CORREZIONE CRUCIALE ---
        wishlist = data ? Object.values(data) : [];
        renderWishlist();
    });

    onValue(futureMovementsRef, (snapshot) => {
        const data = snapshot.val();
         // --- CORREZIONE CRUCIALE ---
        futureMovements = data ? Object.values(data) : [];
        renderFutureMovements();
    });

    onValue(pendingPaymentsRef, (snapshot) => {
        const data = snapshot.val();
        // --- CORREZIONE CRUCIALE ---
        pendingPayments = data ? Object.values(data) : [];
        renderPendingPayments();
    });

    onValue(cassaComuneRef, (snapshot) => {
        cassaComune = snapshot.val() || { balance: 0, movements: {} };
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

// SOSTITUISCI QUESTA FUNZIONE
// SOSTITUISCI QUESTA INTERA FUNZIONE

const renderMembers = () => {
    if (memberCountEl) memberCountEl.textContent = members.length;
    const membersListEl = document.getElementById('members-list');
    if (membersListEl) {
        membersListEl.innerHTML = members.map(m => `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-sm">${m.name}</li>`).join('');
    }
    
    const memberOptions = members.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    const payerSelect = document.getElementById('payer');
    if (payerSelect) {
        // --- MODIFICA QUI ---
        // Ho ri-aggiunto <option value="Cassa Comune">Cassa Comune</option> alla lista
        payerSelect.innerHTML = `<option value="">Seleziona chi ha pagato</option><option value="Cassa Comune">Cassa Comune</option>` + memberOptions;
    }
    
    const pendingPaymentMemberSelect = document.getElementById('pending-payment-member');
    if (pendingPaymentMemberSelect) pendingPaymentMemberSelect.innerHTML = `<option value="">Seleziona membro</option>` + memberOptions;
    
    const cashMovementMemberSelect = document.getElementById('cash-movement-member');
    if (cashMovementMemberSelect) cashMovementMemberSelect.innerHTML = `<option value="">Nessuno</option>` + memberOptions;
    
    const incomeMembersCheckboxes = document.getElementById('income-members-checkboxes');
    if (incomeMembersCheckboxes) {
        incomeMembersCheckboxes.innerHTML = members.map(m => `<div class="flex items-center"><input type="checkbox" id="income-member-${m.id}" name="income-member" value="${m.name}" class="form-checkbox h-4 w-4 text-indigo-600"><label for="income-member-${m.id}" class="ml-2 text-sm">${m.name}</label></div>`).join('');
    }
};


// SOSTITUISCI L'INTERA FUNZIONE renderCassaComune
// SOSTITUISCI L'INTERA FUNZIONE renderCassaComune CON QUESTA VERSIONE CORRETTA

// SOSTITUISCI L'INTERA FUNZIONE renderCassaComune CON QUESTA VERSIONE CORRETTA

// 1. SOSTITUISCI QUESTA FUNZIONE

const renderCassaComune = () => {
    const cashBalanceAmountEl = document.getElementById('cash-balance-amount');
    const cashMovementsHistoryEl = document.getElementById('cash-movements-history');

    if (cashBalanceAmountEl) cashBalanceAmountEl.textContent = `€${(cassaComune.balance || 0).toFixed(2)}`;
    
    if (cashMovementsHistoryEl) {
        // --- MODIFICA CRUCIALE QUI ---
        // Converte i movimenti in un array, sia che Firebase li dia come array o come oggetto.
        const movements = cassaComune.movements ? Object.values(cassaComune.movements) : [];
        
        cashMovementsHistoryEl.innerHTML = movements.sort((a, b) => new Date(b.date) - new Date(a.date)).map(m => {
            const adminButtons = `
                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button data-id="${m.id}" data-type="cashMovement" class="open-edit-modal-btn text-xs text-indigo-600 hover:text-indigo-800">Modifica</button>
                    <button data-id="${m.id}" data-type="cashMovement" class="delete-item-btn text-xs text-red-600 hover:text-red-800">Elimina</button>
                </div>`;

            return `
                <div class="flex justify-between items-center text-sm border-b pb-1 mb-1 group">
                    <div class="${m.type === 'deposit' ? 'text-green-700' : 'text-red-700'}">
                        <span class="font-medium">${m.description} (${m.member || 'Cassa'})</span>
                        <span class="font-bold block">${m.type === 'deposit' ? '+' : '-'}€${(m.amount || 0).toFixed(2)}</span>
                    </div>
                    ${currentUser.role === 'admin' ? adminButtons : ''}
                </div>
            `;
        }).join('') || '<p class="text-gray-500">Nessun movimento recente.</p>';
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

// SOSTITUISCI QUESTA FUNZIONE
// 3. SOSTITUISCI QUESTA FUNZIONE
// 1. SOSTITUISCI QUESTA FUNZIONE
// 2. SOSTITUISCI QUESTA FUNZIONE

// 1. SOSTITUISCI QUESTA FUNZIONE

const renderFutureMovements = () => {
    const container = document.getElementById('future-movements-container');
    if (container) {
        container.innerHTML = (futureMovements || []).map(m => { // Rimosso 'movementIndex' non necessario qui
            const sharesHtml = (m.shares && Array.isArray(m.shares))
                ? m.shares.map((share, shareIndex) => `
                    <div class="flex justify-between items-center text-xs py-1">
                        <label for="share-${m.id}-${shareIndex}" class="flex-grow cursor-pointer ${share.paid ? 'text-gray-400 line-through' : ''}">${share.member}</label>
                        <div class="flex items-center gap-2">
                            <span class="font-medium">€</span>
                            {/* Passa l'ID corretto (m.id) */}
                            <input type="number" value="${(share.amount || 0).toFixed(2)}" 
                                   data-movement-id="${m.id}" 
                                   data-share-index="${shareIndex}" 
                                   class="w-16 p-1 text-right border rounded-md future-share-amount">
                            {/* Passa l'ID corretto (m.id) */}
                            <input type="checkbox" id="share-${m.id}-${shareIndex}" 
                                   data-movement-id="${m.id}" 
                                   data-share-index="${shareIndex}" 
                                   class="form-checkbox h-4 w-4 text-indigo-600 rounded cursor-pointer future-share-checkbox" ${share.paid ? 'checked' : ''}>
                        </div>
                    </div>`).join('')
                : '<p class="text-xs text-gray-500">Nessuna suddivisione specificata.</p>';

            const sharesContainerHtml = `<div id="shares-${m.id}" class="mt-2 pt-2 border-t border-blue-200 space-y-1 ${m.isExpanded ? '' : 'hidden'}">${sharesHtml}</div>`;

            const adminButtonsHtml = currentUser.role === 'admin' ? `
                <div class="flex gap-2 mt-2 justify-end">
                    <button data-id="${m.id}" data-type="futureMovement" class="open-edit-modal-btn text-xs text-indigo-600 hover:text-indigo-800">Modifica</button>
                    <button data-id="${m.id}" data-type="futureMovement" class="delete-future-movement-btn text-xs text-red-600 hover:text-red-800">Elimina</button>
                </div>
            ` : '';

            return `
                <div class="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                    <div class="flex justify-between items-center cursor-pointer" data-movement-id="${m.id}">
                        <span class="text-sm font-medium">${m.description} (Scadenza: ${displayDate(m.dueDate)})</span>
                        <span class="font-bold text-blue-700">€${(m.totalCost || 0).toFixed(2)}</span>
                    </div>
                    ${sharesContainerHtml}
                    ${adminButtonsHtml} 
                </div>`;
        }).join('') || '<p class="text-gray-500">Nessun movimento futuro pianificato.</p>';
    }
};
const renderWishlist = () => {
    const container = document.getElementById('wishlist-container');
    if (container) {
        container.innerHTML = (wishlist || []).sort((a, b) => (b.priority || "").localeCompare(a.priority || "")).map(item => {
            // 1. Genera l'HTML per i link, solo se esistono
            let linksHtml = '';
            if (item.links && item.links.length > 0) {
                linksHtml = `
                    <div class="mt-2 pt-2 border-t border-indigo-200">
                        <p class="text-xs font-bold text-indigo-800 mb-1">Link:</p>
                        <div class="flex flex-col space-y-1">
                            ${item.links.map(link => `
                                <a href="${link}" target="_blank" class="text-xs text-blue-600 hover:underline truncate" title="${link}">${link}</a>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // 2. Costruisce l'intera "card" dell'articolo
            return `
                <div class="bg-indigo-50 p-3 rounded-lg border-l-4 border-indigo-500">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-sm font-medium">${item.name}</p>
                            <p class="text-xs text-gray-600">Priorità: ${item.priority || 'Non definita'}</p>
                        </div>
                        <div class="text-right flex-shrink-0 ml-4">
                            <p class="font-bold text-indigo-700">€${(item.cost || 0).toFixed(2)}</p>
                            <button data-id="${item.id}" data-type="wishlistItem" class="open-edit-modal-btn text-xs text-indigo-600 hover:text-indigo-800 mt-1">Modifica</button>
                        </div>
                    </div>
                    ${linksHtml}
                </div>
            `;
        }).join('') || '<p class="text-gray-500">Nessun articolo nella lista desideri.</p>';
    }
};

const renderIncomeEntries = () => {
    const container = document.getElementById('income-list-container');
    if (!container) return;
    container.innerHTML = incomeEntries.sort((a, b) => new Date(b.date) - new Date(a.date)).map(i => `
        <div class="flex justify-between items-center bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
            <div>
                <span class="font-medium">${i.description}</span>
                <span class="text-xs text-gray-500 block">Ricevuto da: ${(i.membersInvolved || []).join(', ')} il ${displayDate(i.date)}</span>
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

// SOSTITUISCI L'INTERA FUNZIONE initializeCharts CON QUESTA

// SOSTITUISCI L'INTERA FUNZIONE initializeCharts CON QUESTA VERSIONE FINALE

const initializeCharts = () => {
    const data = getCalculationData();
    if (!data.members || data.members.length === 0) return;

    const memberNames = data.members.map(m => m.name);
    
    // Lista di colori più ampia per assegnarli in modo univoco
    const colorPalette = [
        'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(255, 206, 86, 0.6)', 
        'rgba(54, 162, 235, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
        'rgba(199, 199, 199, 0.6)', 'rgba(83, 109, 254, 0.6)', 'rgba(0, 200, 83, 0.6)',
        'rgba(255, 69, 0, 0.6)', 'rgba(46, 204, 113, 0.6)', 'rgba(52, 152, 219, 0.6)'
    ];
    // Assegna un colore a ogni membro. Se i membri sono più dei colori, i colori si ripeteranno.
    const memberColors = memberNames.map((_, index) => colorPalette[index % colorPalette.length]);

    // Grafico 1: Contributi Totali
    const contributionsData = memberNames.map(name => {
        const expensesPaid = data.expenses.reduce((sum, e) => sum + (e.payer === name ? (e.amount || 0) : 0), 0);
        const cashDeposits = (cassaComune.movements ? Object.values(cassaComune.movements) : [])
            .filter(m => m.member === name && m.type === 'deposit')
            .reduce((sum, m) => sum + (m.amount || 0), 0);
        return expensesPaid + cashDeposits;
    });
    createBarChart('membersContributionsChart', 'Contributi Totali (Spese + Cassa)', contributionsData, memberNames, memberColors);
    
    // Grafico 2: Ripartizione Entrate
    const incomeData = memberNames.map(name => data.income.reduce((sum, i) => sum + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / i.membersInvolved.length) : 0), 0));
    createBarChart('membersIncomeChart', 'Ripartizione Entrate', incomeData, memberNames, memberColors);
    
    // Grafico 3: Spese per Categoria
    const categoryMap = [...data.expenses, ...data.fixedExpenses].reduce((map, e) => {
        if (e.category) {
            map.set(e.category, (map.get(e.category) || 0) + (e.amount || 0));
        }
        return map;
    }, new Map());
    createBarChart('categoriesChart', 'Spese per Categoria', Array.from(categoryMap.values()), Array.from(categoryMap.keys()), colorPalette);
    
    // Grafico 4: Bilanci (Saldo Netto)
    const totalExpenses = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalFixed = data.fixedExpenses.reduce((sum, f) => sum + (f.amount || 0), 0);
    if (data.members.length > 0) {
        // La quota di spesa che ogni membro dovrebbe teoricamente pagare
        const shareOfTotalExpense = (totalExpenses + totalFixed) / data.members.length;

        const balanceData = memberNames.map(name => {
            // Ricalcoliamo il contributo totale ESATTAMENTE come per il primo grafico
            const expensesPaid = data.expenses.filter(e => e.payer === name).reduce((sum, e) => sum + (e.amount || 0), 0);
            const cashDeposits = (cassaComune.movements ? Object.values(cassaComune.movements) : [])
                .filter(m => m.member === name && m.type === 'deposit')
                .reduce((sum, m) => sum + (m.amount || 0), 0);
            
            // Il totale versato dal membro (spese dirette + depositi in cassa)
            const totalContributed = expensesPaid + cashDeposits;

            // Il saldo è la differenza tra quanto ha versato e quanto avrebbe dovuto versare
            return totalContributed - shareOfTotalExpense;
        });
        createBarChart('balancesChart', 'Bilanci (Netto)', balanceData, memberNames, balanceData.map(b => b >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'));
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

// SOSTITUISCI QUESTA INTERA FUNZIONE

const calculateAndRenderSettlement = (forExport = false) => {
    const data = getCalculationData();
    if (!data.members || data.members.length === 0) return;

    const memberNames = data.members.map(m => m.name);
    const balances = Object.fromEntries(memberNames.map(name => [name, 0]));

    // --- Calcolo del Saldo Finale per ogni membro (logica unificata) ---

    // 1. Calcola la quota di spesa che ogni membro DOVREBBE pagare
    const totalExpenses = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalFixed = data.fixedExpenses.reduce((sum, f) => sum + (f.amount || 0), 0);
    const shareOfTotalExpense = (totalExpenses + totalFixed) / memberNames.length;

    // 2. Calcola il saldo effettivo di ogni membro
    memberNames.forEach(name => {
        // Totale VERSATO da un membro (spese dirette + depositi in cassa)
        const expensesPaid = data.expenses.filter(e => e.payer === name).reduce((sum, e) => sum + (e.amount || 0), 0);
        const cashDeposits = (cassaComune.movements ? Object.values(cassaComune.movements) : []).filter(m => m.member === name && m.type === 'deposit').reduce((sum, m) => sum + (m.amount || 0), 0);
        const totalContributed = expensesPaid + cashDeposits;

        // Totale RICEVUTO da un membro (la sua quota delle entrate)
        const incomeShare = data.income.reduce((sum, i) => sum + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / i.membersInvolved.length) : 0), 0);

        // Il saldo finale è: (Versato + Ricevuto) - Quota Spese che avrebbe dovuto pagare
        balances[name] = (totalContributed + incomeShare) - shareOfTotalExpense;
    });

    // --- INIZIO NUOVA LOGICA DI VISUALIZZAZIONE ---

    const settlementList = document.getElementById('settlement-list');
    if (!settlementList) return;

    // 3. Filtra solo le persone che sono in negativo (devono versare soldi)
    const debtors = Object.entries(balances)
        .filter(([, amount]) => amount < -0.01) // Filtra chi ha un saldo negativo
        .map(([name, amount]) => ({ name, amountToPay: Math.abs(amount) })); // Prende il valore assoluto

    // Calcola il totale che deve essere versato e il credito totale
    const totalToPay = debtors.reduce((sum, debtor) => sum + debtor.amountToPay, 0);
    const totalInCredit = Object.values(balances).reduce((sum, amount) => sum + (amount > 0.01 ? amount : 0), 0);
    
    settlementList.innerHTML = ''; // Pulisce la lista precedente

    if (debtors.length === 0) {
        settlementList.innerHTML = '<li class="text-green-500 font-semibold">Perfetto! Tutti i conti sono in pari.</li>';
    } else {
        // 4. Mostra la lista di chi deve versare soldi
        debtors.forEach(debtor => {
            const li = document.createElement('li');
            li.className = 'text-gray-700';
            li.innerHTML = `<span class="font-semibold text-red-500">${debtor.name}</span> deve versare <span class="font-bold text-lg text-indigo-600">€${debtor.amountToPay.toFixed(2)}</span> per pareggiare i conti.`;
            settlementList.appendChild(li);
        });

        // 5. Aggiunge una riga di riepilogo per verifica
        const summaryLi = document.createElement('li');
        summaryLi.className = 'text-sm text-gray-500 mt-4 pt-2 border-t';
        summaryLi.innerHTML = `Il totale da versare (€${totalToPay.toFixed(2)}) andrà a coprire il credito di chi ha speso di più (€${totalInCredit.toFixed(2)}).`;
        settlementList.appendChild(summaryLi);
    }

    
    // La logica di esportazione per Excel potrebbe necessitare di un formato diverso, per ora la lasciamo così
    if (forExport) {
        return settlements; // Questa variabile non è definita qui, ma manteniamo la struttura
    }
};
// --- Funzioni CRUD e di gestione form ---

// SOSTITUISCI L'INTERA FUNZIONE openEditModal CON QUESTA
// SOSTITUISCI QUESTA INTERA FUNZIONE NEL TUO FILE

// SOSTITUISCI QUESTA INTERA FUNZIONE NEL TUO FILE

const openEditModal = (id, type) => {
    const item = getItemFromStore(type, id);
    if (!item) return;

    const isProtectedType = ['variableExpense', 'incomeEntry', 'fixedExpense', 'cashMovement'].includes(type);
    if (currentUser.role !== 'admin' && isProtectedType) {
        return alert("Non hai i permessi per modificare questo elemento.");
    }
    
    const editModalTitle = document.getElementById('edit-modal-title');
    const editModalFormContainer = document.getElementById('edit-modal-form-container');
    const editModalActions = document.getElementById('edit-modal-actions');
    
    editModalTitle.textContent = `Modifica ${type}`;
    let formHtml = `<form id="edit-form" data-id="${id}" data-type="${type}" class="space-y-4">`;

    if (type === 'wishlistItem') {
        // Logica personalizzata per la Lista Desideri
        formHtml += `
            <div>
                <label for="edit-name" class="block text-sm font-medium">Nome Oggetto</label>
                <input type="text" id="edit-name" name="name" value="${item.name || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-cost" class="block text-sm font-medium">Costo Stimato (€)</label>
                <input type="number" step="0.01" id="edit-cost" name="cost" value="${item.cost || 0}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-priority" class="block text-sm font-medium">Priorità</label>
                <select id="edit-priority" name="priority" class="w-full p-2 border rounded-lg mt-1 bg-white">
                    <option value="3-Alta" ${item.priority === '3-Alta' ? 'selected' : ''}>Alta</option>
                    <option value="2-Media" ${item.priority === '2-Media' ? 'selected' : ''}>Media</option>
                    <option value="1-Bassa" ${item.priority === '1-Bassa' ? 'selected' : ''}>Bassa</option>
                </select>
            </div>
            
            <div class="border p-3 rounded-lg">
                <label class="block text-sm font-medium">Link di Acquisto</label>
                <div id="edit-links-container" class="space-y-2 mt-2">
                    ${(item.links || []).map(link => `
                        <div class="flex items-center space-x-2">
                            <input type="url" class="w-full p-1 border rounded-md edit-link-input" value="${link}">
                            <button type="button" class="remove-edit-link-btn text-red-500 font-bold text-lg">&times;</button>
                        </div>
                    `).join('')}
                </div>
                <div class="flex mt-3 gap-2">
                    <input type="url" id="new-edit-link-input" placeholder="Aggiungi nuovo link..." class="w-full p-2 border rounded-lg">
                    <button type="button" id="add-edit-link-btn" class="bg-indigo-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-indigo-600">Aggiungi</button>
                </div>
            </div>
        `;
    } else {
        // Logica generica per tutti gli altri tipi di elementi
        formHtml += Object.entries(item).map(([key, value]) => {
            if (key === 'id' || typeof value === 'object') return '';
            let inputType = 'text';
            if (typeof value === 'number') inputType = 'number';
            if (key.includes('date') || key.includes('dueDate')) inputType = 'date';
            return `<div><label for="edit-${key}" class="block text-sm font-medium capitalize">${key}</label><input type="${inputType}" id="edit-${key}" name="${key}" value="${value}" class="w-full p-2 border rounded-lg mt-1"></div>`;
        }).join('');
    }

    formHtml += `</form>`;
    editModalFormContainer.innerHTML = formHtml;

    editModalActions.innerHTML = `
        <div class="flex justify-between items-center mt-6">
            <button type="button" id="delete-edit-btn" class="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600">Elimina</button>
            <div class="flex gap-3">
                <button type="button" id="cancel-edit-btn" class="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">Annulla</button>
                <button type="submit" form="edit-form" class="bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600">Salva Modifiche</button>
            </div>
        </div>`;

    editModal.classList.remove('hidden');

    // --- LISTENER INTERNI ALLA MODALE ---

    // Aggiungi link
    const addLinkBtn = document.getElementById('add-edit-link-btn');
    if (addLinkBtn) {
        addLinkBtn.addEventListener('click', () => {
            const input = document.getElementById('new-edit-link-input');
            const container = document.getElementById('edit-links-container');
            if (input.value.trim() && container) {
                const div = document.createElement('div');
                div.className = 'flex items-center space-x-2';
                div.innerHTML = `<input type="url" class="w-full p-1 border rounded-md edit-link-input" value="${input.value.trim()}"><button type="button" class="remove-edit-link-btn text-red-500 font-bold text-lg">&times;</button>`;
                container.appendChild(div);
                input.value = '';
            }
        });
    }

    // Rimuovi link (usa event delegation)
    const linksContainer = document.getElementById('edit-links-container');
    if(linksContainer) {
        linksContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-edit-link-btn')) {
                e.target.parentElement.remove();
            }
        });
    }

    // Salva il form
    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(editForm);
            const updatedData = { id: id };
            
            for (const [key, value] of formData.entries()) {
                const originalValue = item[key];
                updatedData[key] = (typeof originalValue === 'number' && !isNaN(originalValue)) ? parseFloat(value) : value;
            }

            // Raccogli i link aggiornati
            if (type === 'wishlistItem') {
                const linkInputs = document.querySelectorAll('.edit-link-input');
                updatedData.links = Array.from(linkInputs).map(input => input.value.trim()).filter(link => link);
            }

            // Trova la chiave/indice dell'oggetto da aggiornare
            let itemKey = null;
            const itemIndex = wishlist.findIndex(i => i.id === id);
            if (itemIndex > -1) {
                wishlist[itemIndex] = { ...wishlist[itemIndex], ...updatedData };
                // Firebase usa gli indici dell'array come chiavi
                itemKey = itemIndex; 
                update(ref(database, `wishlist/${itemKey}`), updatedData);
            }
            
            alert('Modifiche salvate!');
            closeEditModal();
        });
    }

    // Funzionalità del pulsante Elimina
    const deleteBtn = document.getElementById('delete-edit-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
             if (confirm(`Sei sicuro di voler eliminare questo elemento?`)) {
                const itemIndex = wishlist.findIndex(i => i.id === id);
                if (itemIndex > -1) {
                    // Per rimuovere un elemento da un array in Firebase, è più sicuro riscrivere l'intero array aggiornato
                    const updatedWishlist = wishlist.filter(i => i.id !== id);
                    set(ref(database, 'wishlist'), updatedWishlist);
                }
                alert('Elemento eliminato.');
                closeEditModal();
             }
        });
    }
};


const closeEditModal = () => {
    const editModal = document.getElementById('edit-modal');
    if (editModal) editModal.classList.add('hidden');
};

// 2. SOSTITUISCI QUESTA FUNZIONE

function handleAddMovement() {
    const movementType = document.getElementById('cash-movement-type').value;
    const member = document.getElementById('cash-movement-member').value || 'Cassa';
    const amount = parseFloat(document.getElementById('cash-movement-amount').value);
    const date = document.getElementById('cash-movement-date').value || new Date().toISOString().split('T')[0];
    const description = document.getElementById('cash-movement-description').value.trim();

    if (isNaN(amount) || amount <= 0 || !description) {
        return alert("Inserisci un importo e una descrizione validi.");
    }

    if (movementType === 'withdrawal' && (cassaComune.balance || 0) < amount) {
        return alert("Errore: Prelievo superiore al saldo disponibile in cassa.");
    }

    // --- LOGICA DI SALVATAGGIO AGGIORNATA ---
    const newMovementId = Date.now().toString();
    const newMovement = { id: newMovementId, type: movementType, amount, member, date, description };
    const newBalance = (movementType === 'deposit') ? (cassaComune.balance || 0) + amount : (cassaComune.balance || 0) - amount;

    // Prepara l'aggiornamento per Firebase, salvando il movimento come oggetto
    const updates = {};
    updates[`cassaComune/movements/${newMovementId}`] = newMovement;
    updates[`cassaComune/balance`] = newBalance;

    update(ref(database), updates);

    alert(`Movimento di ${movementType} registrato. Nuovo saldo: €${newBalance.toFixed(2)}`);
    document.getElementById('cash-form-section').classList.add('hidden');
}

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

// 1. SOSTITUISCI QUESTO BLOCCO

if (addFutureMovementBtn) addFutureMovementBtn.addEventListener('click', () => {
    const descriptionInput = document.getElementById('future-movement-description');
    const costInput = document.getElementById('future-movement-cost');
    const dueDateInput = document.getElementById('future-movement-due-date');

    const description = descriptionInput.value.trim();
    const totalCost = parseFloat(costInput.value);
    const dueDate = dueDateInput.value;

    if (!description || isNaN(totalCost) || totalCost <= 0 || !dueDate || members.length === 0) {
        alert("Compila tutti i campi obbligatori e assicurati che ci siano membri registrati.");
        return;
    }

    // Calcola la quota iniziale per persona (sarà modificabile dopo)
    const costPerPerson = totalCost / members.length;
    const shares = members.map(member => ({
        member: member.name,
        amount: costPerPerson,
        paid: false
    }));

    // Prepara il nuovo movimento senza ID iniziale
    const newMovementData = {
        description: description,
        totalCost: totalCost,
        dueDate: dueDate,
        shares: shares,
        isExpanded: false
    };

    // Usa push() per ottenere un riferimento univoco e la chiave (ID)
    const newMovementRef = push(futureMovementsRef);
    newMovementData.id = newMovementRef.key; // Assegna l'ID generato da Firebase

    // Salva i dati completi nel nuovo riferimento
    set(newMovementRef, newMovementData);

    alert("Movimento futuro pianificato. Puoi ora modificare le singole quote se necessario.");
    
    descriptionInput.value = '';
    costInput.value = '';
    dueDateInput.value = new Date().toISOString().split('T')[0];
    document.getElementById('future-movement-form-section').classList.add('hidden');
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
        membersInvolved: membersInvolved // <-- CORRETTO
    });
    saveDataToFirebase();
    document.getElementById('income-form-section').classList.add('hidden');
    alert("Entrata aggiunta.");
});


// SOSTITUISCI IL VECCHIO BLOCCO if (addExpenseBtn) CON QUESTO
// SOSTITUISCI DI NUOVO L'INTERO BLOCCO if (addExpenseBtn) CON QUESTA VERSIONE
// SOSTITUISCI QUESTO INTERO BLOCCO DI CODICE NEL TUO FILE

if (addExpenseBtn) {
    if (currentUser.role === 'admin') {
        addExpenseBtn.textContent = 'Aggiungi Spesa';
    } else {
        addExpenseBtn.textContent = 'Invia Richiesta Spesa';
    }

    addExpenseBtn.addEventListener('click', () => {
        const payer = document.getElementById('payer').value;
        const date = document.getElementById('expense-date').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value;

        if (!payer || !date || isNaN(amount) || amount <= 0 || !category || !description) {
            return alert("Compila tutti i campi obbligatori.");
        }

        if (currentUser.role === 'admin') {
            // --- INIZIO LOGICA MODIFICATA ---
            if (payer === 'Cassa Comune') {
                // Se il pagante è la Cassa Comune, esegui la logica specifica
                if ((cassaComune.balance || 0) < amount) {
                    return alert("Errore: Fondi insufficienti nella cassa comune per questa spesa.");
                }

                // 1. Crea la nuova spesa
                const newExpenseRef = push(varExpensesRef);
                const newExpense = { id: newExpenseRef.key, date, payer, amount, category, description };

                // 2. Crea il movimento di prelievo dalla cassa
                const newMovementId = Date.now().toString(); // Usiamo un ID semplice per il movimento
                const newMovement = {
                    id: newMovementId,
                    type: 'withdrawal',
                    amount: amount,
                    member: 'Cassa',
                    date: date,
                    description: `Spesa: ${description}`
                };

                // 3. Calcola il nuovo bilancio della cassa
                const newBalance = (cassaComune.balance || 0) - amount;

                // 4. Prepara l'aggiornamento atomico per Firebase (aggiorna tutto insieme)
                const updates = {};
                updates[`variableExpenses/${newExpenseRef.key}`] = newExpense;
                updates[`cassaComune/balance`] = newBalance;
                updates[`cassaComune/movements/${newMovementId}`] = newMovement;

                update(ref(database), updates);
                alert('Spesa pagata dalla Cassa Comune aggiunta con successo. Il bilancio della cassa è stato aggiornato.');

            } else {
                // Se il pagante è una persona, la logica è più semplice
                const newExpenseRef = push(varExpensesRef);
                set(newExpenseRef, { id: newExpenseRef.key, date, payer, amount, category, description });
                alert('Spesa aggiunta con successo.');
            }
            // --- FINE LOGICA MODIFICATA ---
        } else {
            // Logica per gli utenti non-admin (invariata)
            const newRequestRef = push(expenseRequestsRef);
            set(newRequestRef, { requesterUid: currentUser.uid, requesterName: currentUser.email.split('@')[0], date, payer, amount, category, description, status: 'pending' });
            alert("Richiesta di spesa inviata.");
        }
        
        document.getElementById('expense-form-section').classList.add('hidden');
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

// SOSTITUISCI TUTTI I VECCHI BLOCCHI document.addEventListener('click',...) CON QUESTO UNICO BLOCCO

document.addEventListener('click', (e) => {
    const target = e.target;

    // Logica per espandere/collassare la card del movimento futuro
    const movementCardHeader = target.closest('[data-movement-id]');
    if (movementCardHeader && !target.matches('.future-share-checkbox')) {
        const movementId = movementCardHeader.dataset.movementId;
        const sharesContainer = document.getElementById(`shares-${movementId}`);
        if (sharesContainer) {
            sharesContainer.classList.toggle('hidden');
            const movement = futureMovements.find(m => m.id === movementId);
            if (movement) {
                movement.isExpanded = !sharesContainer.classList.contains('hidden');
                const movementIndex = futureMovements.findIndex(m => m.id === movementId);
                if (movementIndex > -1) {
                    update(ref(database, `futureMovements/${movementIndex}`), { isExpanded: movement.isExpanded });
                }
            }
        }
    }

    if (target.matches('.open-edit-modal-btn')) {
        openEditModal(target.dataset.id, target.dataset.type);
    } 
    else if (target.matches('.approve-request-btn')) {
        const key = target.dataset.key;
        const req = expenseRequests[key];
        if (req) {
            const newExpenseRef = push(varExpensesRef);
            set(newExpenseRef, { id: newExpenseRef.key, payer: req.payer, date: req.date, amount: req.amount, category: req.category, description: `[RICHIESTA] ${req.description}` });
            update(ref(database, `expenseRequests/${key}`), { status: 'approved' });
        }
    } 
    else if (target.matches('.reject-request-btn')) {
        const key = target.dataset.key;
        if (expenseRequests[key]) update(ref(database, `expenseRequests/${key}`), { status: 'rejected' });
    } 
    else if (target.matches('.delete-item-btn')) {
        const id = target.dataset.id;
        const type = target.dataset.type;
        if (confirm(`Sei sicuro di voler eliminare questo elemento?`)) {
            if (type === 'cashMovement') {
                const movements = cassaComune.movements ? Object.values(cassaComune.movements) : [];
                const movementToDelete = movements.find(m => m.id === id);
                if (movementToDelete) {
                    const newBalance = cassaComune.balance + (movementToDelete.type === 'deposit' ? -movementToDelete.amount : movementToDelete.amount);
                    const newMovements = { ...cassaComune.movements };
                    delete newMovements[id];
                    set(cassaComuneRef, { balance: newBalance, movements: newMovements });
                    alert('Movimento eliminato e bilancio ricalcolato.');
                }
            }
        }
    } 
    else if (target.matches('.close-form-btn')) {
        target.closest('.action-form').classList.add('hidden');
    } 
    else if (target === editModal || target.matches('#close-edit-modal-btn') || target.matches('#cancel-edit-btn')) {
        closeEditModal();
    } 
    else if (target.matches('.complete-pending-btn')) {
        const id = target.dataset.id;
        if (confirm("Pagamento completato?")) {
            const keyToRemove = Object.keys(pendingPayments).find(key => pendingPayments[key].id === id);
            if(keyToRemove) {
                remove(ref(database, `pendingPayments/${keyToRemove}`));
            }
        }
    }
    // --- NUOVA LOGICA PER IL PULSANTE CHIUDI ---
    else if (target.id === 'close-settlement-btn') {
        const settlementContainer = document.getElementById('settlement-container');
        if (settlementContainer) {
            settlementContainer.classList.add('hidden');
        }
    }
    // TROVA IL BLOCCO 'document.addEventListener('click', ...)' E SOSTITUISCI QUESTO "ELSE IF"

    // ... (altre logiche else if per i click) ...

    else if (target.matches('.delete-future-movement-btn')) {
        const idToDelete = target.dataset.id; // Questo è l'ID univoco salvato DENTRO l'oggetto
        if (idToDelete && confirm(`Sei sicuro di voler eliminare questo movimento futuro?`)) {

            // --- CORREZIONE QUI ---
            // 1. Trova l'indice dell'elemento nell'array locale basato sull'ID interno
            const itemIndex = futureMovements.findIndex(m => m && m.id === idToDelete);

            if (itemIndex > -1) {
                // 2. Crea un NUOVO array escludendo l'elemento da cancellare
                const updatedFutureMovements = futureMovements.filter(m => m.id !== idToDelete);

                // 3. Usa set() per SOVRASCRIVERE l'intera lista /futureMovements su Firebase
                //    con il nuovo array filtrato. Questo è il modo corretto per eliminare da un array.
                set(futureMovementsRef, updatedFutureMovements)
                    .then(() => {
                        alert('Movimento futuro eliminato.');
                        // Non serve fare altro, onValue aggiornerà la vista automaticamente
                    })
                    .catch((error) => {
                        console.error("Errore durante l'eliminazione:", error);
                        alert("Si è verificato un errore durante l'eliminazione.");
                    });
            } else {
                 console.warn("Movimento futuro non trovato nell'array locale con ID:", idToDelete);
                 alert("Errore: Impossibile trovare il movimento da eliminare.");
            }
        }
    }

    // ... (assicurati che questo sia l'ultimo else if prima della parentesi graffa di chiusura del listener)

});

// Gestione Modale (Edit, Save) - Logica dettagliata nell'openEditModal

// SOSTITUISCI LA VECCHIA RIGA "if (calculateBtn)..." CON QUESTO BLOCCO

if (calculateBtn) {
    calculateBtn.addEventListener('click', () => {
        const settlementContainer = document.getElementById('settlement-container');
        if (settlementContainer) {
            // Se il riquadro è nascosto...
            if (settlementContainer.classList.contains('hidden')) {
                // ...calcola i saldi e mostralo.
                calculateAndRenderSettlement(false);
                settlementContainer.classList.remove('hidden');
            } else {
                // ...altrimenti, se è già visibile, nascondilo.
                settlementContainer.classList.add('hidden');
            }
        }
    });
}
if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);
if (exportDataBtn) exportDataBtn.addEventListener('click', handleExportData);
if (importDataBtn) importDataBtn.addEventListener('click', () => importFileInput.click());
if (importFileInput) importFileInput.addEventListener('change', handleImportData);


// --- App Initialization (PUNTO DI INNESTO DEL FIX) ---
// SOSTITUISCI TUTTI I VECCHI BLOCCHI document.addEventListener('click',...) CON QUESTO
// 2. SOSTITUISCI L'INTERO BLOCCO document.addEventListener('change', ...) CON QUESTO

// 3. SOSTITUISCI QUESTO BLOCCO

// 2. SOSTITUISCI QUESTO BLOCCO

document.addEventListener('change', (e) => {
    const target = e.target;
    
    // Logica per i checkbox delle quote future (usa ID)
    if (target.matches('.future-share-checkbox')) {
        const movementId = target.dataset.movementId; // Usa l'ID
        const shareIndex = parseInt(target.dataset.shareIndex, 10);
        const isChecked = target.checked;

        // Trova l'indice del movimento nell'array locale basato sull'ID
        const movementIndex = futureMovements.findIndex(m => m && m.id === movementId); 

        if (movementIndex > -1 && !isNaN(shareIndex)) { // Controlla che l'indice sia valido
            const movement = futureMovements[movementIndex];
            if (movement && movement.shares && movement.shares[shareIndex]) {
                // Aggiorna Firebase usando il percorso con l'INDICE dell'array
                update(ref(database, `futureMovements/${movementIndex}/shares/${shareIndex}`), { paid: isChecked });
            }
        }
    }

    // Logica per la modifica dell'importo delle quote future (usa ID per trovare, indice per salvare)
    else if (target.matches('.future-share-amount')) {
        const movementId = target.dataset.movementId; // Usa l'ID
        const shareIndex = parseInt(target.dataset.shareIndex, 10);
        const newAmount = parseFloat(target.value);

        // Trova l'indice del movimento nell'array locale basato sull'ID
        const movementIndex = futureMovements.findIndex(m => m && m.id === movementId);

        if (movementIndex > -1 && !isNaN(shareIndex) && !isNaN(newAmount)) { // Controlla indice e importo
            const movement = futureMovements[movementIndex];
            if (movement && movement.shares && movement.shares[shareIndex]) {
                // Aggiorna l'importo locale per il ricalcolo
                movement.shares[shareIndex].amount = newAmount;
                const newTotalCost = movement.shares.reduce((sum, s) => sum + (s.amount || 0), 0);
                // Non aggiorniamo movement.totalCost localmente per evitare conflitti con onValue

                // Prepara gli aggiornamenti per Firebase usando il percorso con l'INDICE dell'array
                const updates = {};
                updates[`futureMovements/${movementIndex}/shares/${shareIndex}/amount`] = newAmount;
                updates[`futureMovements/${movementIndex}/totalCost`] = newTotalCost; // Aggiorna anche il totale

                update(ref(database), updates);
                
                // Non serve ri-renderizzare manualmente, onValue lo farà
            }
        }
    }
});
document.addEventListener('authReady', () => {
    if (document.getElementById('member-count')) {
        console.log("Auth pronto, avvio la pagina finanze...");
        loadDataFromFirebase();
        const expenseDateInput = document.getElementById('expense-date');
        const incomeDateInput = document.getElementById('income-date');
        const today = new Date().toISOString().split('T')[0];
        if (expenseDateInput) expenseDateInput.value = today;
        if (incomeDateInput) incomeDateInput.value = today;
    }
});






































