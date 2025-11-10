// js/finanze.js
// VERSIONE CORRETTA - 10 NOVEMBRE

import { database } from './firebase-config.js';
import { ref, set, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

// --- Data State (Firebase-synced) ---
let members = []; // Verrà popolato correttamente
let variableExpenses = [];
let fixedExpenses = [];
let incomeEntries = [];
let wishlist = [];
let futureMovements = [];
let pendingPayments = [];
let cassaComune = { balance: 0, movements: [] };
let expenseRequests = {}; 

// Variabili per i grafici (se usi Chart.js)
// let membersContributionsChart, membersIncomeChart, categoriesChart, balancesChart;
let tempWishlistLinks = [];


// --- Funzioni Utility ---
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const displayDate = (dateString) => {
    if (!dateString) return '';
    // Aggiungi orario fittizio per evitare problemi di timezone
    const date = new Date(dateString + 'T12:00:00Z'); 
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
    // Non salviamo più 'members' da qui, viene gestito altrove
    set(varExpensesRef, variableExpenses);
    set(fixedExpensesRef, fixedExpenses);
    set(incomeRef, incomeEntries);
    set(wishlistRef, wishlist);
    // Nota: futureMovements, pendingPayments, cassaComune, expenseRequests
    // vengono già aggiornati con 'update', 'push', 'remove'
}

// ==========================================================
// --- FUNZIONE loadDataFromFirebase (CORRETTA) ---
// ==========================================================
function loadDataFromFirebase() {
    onValue(membersRef, (snapshot) => {
        // 1. Prendiamo i dati come OGGETTO
        const membersObject = snapshot.val() || {};
        
        // 2. Trasformiamo l'oggetto in un array di { id: "uid", name: "..." }
        // che è la struttura che il resto di questo file si aspetta
        members = Object.entries(membersObject).map(([uid, memberData]) => ({
            id: uid, // <--- QUESTA È LA CORREZIONE CHIAVE
            name: memberData.name,
            cleaningCount: memberData.cleaningCount
        }));

        // 3. Ora tutto il resto funziona
        renderMembers();
        toggleSectionsVisibility();
        updateDashboardView();
    });

    onValue(varExpensesRef, (snapshot) => {
        const data = snapshot.val();
        variableExpenses = data ? Object.values(data) : [];
        renderVariableExpenses();
        updateDashboardView();
        populateMonthFilter();
    });

    onValue(fixedExpensesRef, (snapshot) => {
        const data = snapshot.val();
        fixedExpenses = data ? Object.values(data) : [];
        renderFixedExpenses();
        updateDashboardView();
    });

    onValue(incomeRef, (snapshot) => {
        const data = snapshot.val();
        incomeEntries = data ? Object.values(data) : [];
        renderIncomeEntries();
        updateDashboardView();
        populateMonthFilter();
    });

    onValue(wishlistRef, (snapshot) => {
        const data = snapshot.val();
        wishlist = data ? Object.values(data) : [];
        renderWishlist();
    });

    onValue(futureMovementsRef, (snapshot) => {
        const rawData = snapshot.val();
        futureMovements = rawData ? Object.keys(rawData).map(key => ({ id: key, ...rawData[key] })) : [];
        renderFutureMovements();
    });

    onValue(pendingPaymentsRef, (snapshot) => {
        const data = snapshot.val();
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
// ==========================================================
// --- FINE FUNZIONE CORRETTA ---
// ==========================================================


// --- Funzioni di Rendering e Logica ---
// (Il resto del tuo file js/finanze.js rimane identico a quello che mi hai mandato)
// ... (tutte le altre funzioni: renderMembers, renderCassaComune, initializeCharts, etc.) ...
// Copia e incolla tutto il resto del tuo file .js originale da qui in poi.

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
    
    // Salva l'opzione selezionata
    const selectedValue = monthFilter.value; 
    
    monthFilter.innerHTML = '<option value="all">Tutti i mesi</option>';

    Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a)).forEach(monthYear => {
        const [year, month] = monthYear.split('-');
        const date = new Date(year, parseInt(month) - 1);
        const monthName = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = monthName;
        monthFilter.appendChild(option);
    });
    
    // Ripristina l'opzione selezionata
    monthFilter.value = selectedValue; 
};

// QUESTA FUNZIONE ORA FUNZIONERÀ PERCHÉ 'members' è un array di {id, name}
const renderMembers = () => {
    if (memberCountEl) memberCountEl.textContent = members.length;
    const membersListEl = document.getElementById('members-list');
    if (membersListEl) {
        membersListEl.innerHTML = members.map(m => `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-sm">${m.name}</li>`).join('');
    }
    
    const memberOptions = members.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    const payerSelect = document.getElementById('payer');
    if (payerSelect) {
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

const renderCassaComune = () => {
    const cashBalanceAmountEl = document.getElementById('cash-balance-amount');
    const cashMovementsHistoryEl = document.getElementById('cash-movements-history');

    if (cashBalanceAmountEl) cashBalanceAmountEl.textContent = `€${(cassaComune.balance || 0).toFixed(2)}`;
    
    if (cashMovementsHistoryEl) {
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

const renderFutureMovements = () => {
    const container = document.getElementById('future-movements-container');
    if (container) {
        container.innerHTML = (futureMovements || []).map(m => {
            const sharesHtml = (m.shares && Array.isArray(m.shares))
                ? m.shares.map((share, shareIndex) => `
                    <div class="flex justify-between items-center text-xs py-1">
                        <label for="share-${m.id}-${shareIndex}" class="flex-grow cursor-pointer ${share.paid ? 'text-gray-400 line-through' : ''}">${share.member}</label>
                        <div class="flex items-center gap-2">
                            <span class="font-medium">€</span>
                            <input type="number" value="${(share.amount || 0).toFixed(2)}" 
                                   data-movement-id="${m.id}" 
                                   data-share-index="${shareIndex}" 
                                   class="w-16 p-1 text-right border rounded-md future-share-amount">
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
                <span class="text-xs text-gray-500 block">Paga: ${f.payer || 'Tutti'}</span>
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
        // Usa l'array 'members' globale (ora corretto) per trovare il nome
        const requesterName = members.find(m => m.id === req.requesterUid)?.name || req.requesterName || 'N/D';
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
            borderColor: Array.isArray(color) ? color.map(c => c.replace('0.6', '1')) : color.replace('0.6', '1'),
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
    if (!data.members || data.members.length === 0) return;

    const memberNames = data.members.map(m => m.name);
    
    const colorPalette = [
        'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(255, 206, 86, 0.6)', 
        'rgba(54, 162, 235, 0.6)', 'rgba(153, 102, 255, 0.6)', 'rgba(255, 159, 64, 0.6)',
        'rgba(199, 199, 199, 0.6)', 'rgba(83, 109, 254, 0.6)', 'rgba(0, 200, 83, 0.6)',
        'rgba(255, 69, 0, 0.6)', 'rgba(46, 204, 113, 0.6)', 'rgba(52, 152, 219, 0.6)'
    ];
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
    const incomeData = memberNames.map(name => data.income.reduce((sum, i) => sum + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / (i.membersInvolved.length || 1)) : 0), 0));
    createBarChart('membersIncomeChart', 'Ripartizione Entrate', incomeData, memberNames, memberColors);
    
    // Grafico 3: Spese per Categoria
    const categoryMap = [...data.expenses, ...data.fixedExpenses].reduce((map, e) => {
        const category = e.category || 'Non categorizzata';
        map.set(category, (map.get(category) || 0) + (e.amount || 0));
        return map;
    }, new Map());
    createBarChart('categoriesChart', 'Spese per Categoria', Array.from(categoryMap.values()), Array.from(categoryMap.keys()), colorPalette);
    
    // Grafico 4: Bilanci (Saldo Netto)
    const totalExpenses = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalFixed = data.fixedExpenses.reduce((sum, f) => sum + (f.amount || 0), 0);
    if (data.members.length > 0) {
        const shareOfTotalExpense = (totalExpenses + totalFixed) / data.members.length;

        const balanceData = memberNames.map(name => {
            const expensesPaid = data.expenses.filter(e => e.payer === name).reduce((sum, e) => sum + (e.amount || 0), 0);
            const cashDeposits = (cassaComune.movements ? Object.values(cassaComune.movements) : [])
                .filter(m => m.member === name && m.type === 'deposit')
                .reduce((sum, m) => sum + (m.amount || 0), 0);
            
            const totalContributed = expensesPaid + cashDeposits;

            // Totale RICEVUTO da un membro (la sua quota delle entrate)
            const incomeShare = data.income.reduce((sum, i) => sum + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / (i.membersInvolved.length || 1)) : 0), 0);
            
            // Saldo finale: (Versato + Ricevuto) - Quota Spese
            return (totalContributed + incomeShare) - shareOfTotalExpense;
        });
        createBarChart('balancesChart', 'Bilanci (Netto)', balanceData, memberNames, balanceData.map(b => b >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'));
    }
};

const updateDashboardView = () => { 
    // Aggiorna i totali basati sullo stato corrente
    const totalVar = variableExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalFix = fixedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalInc = incomeEntries.reduce((sum, i) => sum + (i.amount || 0), 0);
    
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
    if (cashBalanceAmountEl) cashBalanceAmountEl.textContent = `€${(cassaComune.balance || 0).toFixed(2)}`;

    if (typeof Chart !== 'undefined') {
        initializeCharts(); 
    }
    calculateAndRenderSettlement(false); 
};


const getCalculationData = (selectedMonth = 'all') => {
    const filterData = (data) => {
        if (selectedMonth === 'all') return data;
        return data.filter(item => {
            const itemDate = new Date(item.date || item.dueDate);
            return `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
        });
    };

    const filteredExpenses = filterData(variableExpenses);
    const filteredIncome = filterData(incomeEntries);
    
    return {
        members: members,
        expenses: filteredExpenses,
        fixedExpenses: fixedExpenses, // Le spese fisse si applicano sempre
        income: filteredIncome
    };
};

const calculateAndRenderSettlement = (forExport = false) => {
    const selectedMonth = document.getElementById('month-filter')?.value || 'all';
    const data = getCalculationData(selectedMonth);
    
    const settlementList = document.getElementById('settlement-list');
    if (!settlementList) return;

    if (!data.members || data.members.length === 0) {
        settlementList.innerHTML = '<li class="text-gray-500">Nessun membro registrato per calcolare i saldi.</li>';
        return;
    }

    const memberNames = data.members.map(m => m.name);
    const balances = Object.fromEntries(memberNames.map(name => [name, 0]));

    // 1. Calcola la quota di spesa
    const totalExpenses = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalFixed = data.fixedExpenses.reduce((sum, f) => sum + (f.amount || 0), 0);
    const shareOfTotalExpense = (totalExpenses + totalFixed) / memberNames.length;

    // 2. Calcola il saldo effettivo
    memberNames.forEach(name => {
        const expensesPaid = data.expenses.filter(e => e.payer === name).reduce((sum, e) => sum + (e.amount || 0), 0);
        const cashDeposits = (cassaComune.movements ? Object.values(cassaComune.movements) : [])
            .filter(m => m.member === name && m.type === 'deposit')
            .reduce((sum, m) => sum + (m.amount || 0), 0);
        const totalContributed = expensesPaid + cashDeposits;

        const incomeShare = data.income.reduce((sum, i) => sum + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / (i.membersInvolved.length || 1)) : 0), 0);

        balances[name] = (totalContributed + incomeShare) - shareOfTotalExpense;
    });

    const debtors = Object.entries(balances)
        .filter(([, amount]) => amount < -0.01)
        .map(([name, amount]) => ({ name, amountToPay: Math.abs(amount) }));

    const totalToPay = debtors.reduce((sum, debtor) => sum + debtor.amountToPay, 0);
    const totalInCredit = Object.values(balances).reduce((sum, amount) => sum + (amount > 0.01 ? amount : 0), 0);
    
    settlementList.innerHTML = ''; 

    if (debtors.length === 0) {
        settlementList.innerHTML = '<li class="text-green-500 font-semibold">Perfetto! Tutti i conti sono in pari.</li>';
    } else {
        debtors.forEach(debtor => {
            const li = document.createElement('li');
            li.className = 'text-gray-700';
            li.innerHTML = `<span class="font-semibold text-red-500">${debtor.name}</span> deve versare <span class="font-bold text-lg text-indigo-600">€${debtor.amountToPay.toFixed(2)}</span> per pareggiare i conti.`;
            settlementList.appendChild(li);
        });

        const summaryLi = document.createElement('li');
        summaryLi.className = 'text-sm text-gray-500 mt-4 pt-2 border-t';
        summaryLi.innerHTML = `Il totale da versare (€${totalToPay.toFixed(2)}) andrà a coprire il credito di chi ha speso di più (€${totalInCredit.toFixed(2)}).`;
        settlementList.appendChild(summaryLi);
    }
    
    // Logica di esportazione (semplificata)
    if (forExport) {
        return debtors.map(d => ({ payer: d.name, recipient: 'Cassa', amount: d.amountToPay }));
    }
};

// --- Funzioni CRUD e di gestione form ---
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
    } else if (type === 'futureMovement') { 
        formHtml += `
            <div>
                <label for="edit-description" class="block text-sm font-medium">Descrizione</label>
                <input type="text" id="edit-description" name="description" value="${item.description || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-totalCost" class="block text-sm font-medium">Costo Totale (€)</label>
                <input type="number" step="0.01" id="edit-totalCost" name="totalCost" value="${item.totalCost || 0}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-dueDate" class="block text-sm font-medium">Data Scadenza</label>
                <input type="date" id="edit-dueDate" name="dueDate" value="${item.dueDate || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
        `;
    } else {
        // Logica generica
        formHtml += Object.entries(item).map(([key, value]) => {
            if (key === 'id' || typeof value === 'object') return '';
            let inputType = 'text';
            if (typeof value === 'number') inputType = 'number';
            if (key.includes('date') || key.includes('dueDate')) inputType = 'date';
            
            if (key === 'payer' && type === 'variableExpense') {
                const memberOptions = members.map(m => `<option value="${m.name}" ${value === m.name ? 'selected' : ''}>${m.name}</option>`).join('');
                return `<div><label for="edit-${key}" class="block text-sm font-medium capitalize">${key}</label>
                        <select id="edit-${key}" name="${key}" class="w-full p-2 border rounded-lg mt-1 bg-white">
                            <option value="Cassa Comune" ${value === 'Cassa Comune' ? 'selected' : ''}>Cassa Comune</option>
                            ${memberOptions}
                        </select></div>`;
            }
            
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

    const linksContainer = document.getElementById('edit-links-container');
    if(linksContainer) {
        linksContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-edit-link-btn')) {
                e.target.parentElement.remove();
            }
        });
    }

    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(editForm);
            const updatedData = {}; // Non includere l'ID qui, usiamo la key
            
            for (const [key, value] of formData.entries()) {
                const originalValue = item[key];
                updatedData[key] = (typeof originalValue === 'number' && !isNaN(originalValue)) ? parseFloat(value) : value;
            }
            
            let dbRef;
            
            if (type === 'wishlistItem') {
                const linkInputs = document.querySelectorAll('.edit-link-input');
                updatedData.links = Array.from(linkInputs).map(input => input.value.trim()).filter(link => link);
                dbRef = ref(database, `wishlist/${item.id}`); // Assumendo che ID sia la chiave
            } else if (type === 'futureMovement') {
                dbRef = ref(database, `futureMovements/${item.id}`);
            } else if (type === 'variableExpense') {
                dbRef = ref(database, `variableExpenses/${item.id}`);
            } else if (type === 'fixedExpense') {
                dbRef = ref(database, `fixedExpenses/${item.id}`);
            } else if (type === 'incomeEntry') {
                dbRef = ref(database, `incomeEntries/${item.id}`);
            } else if (type === 'cashMovement') {
                dbRef = ref(database, `cassaComune/movements/${item.id}`);
            }
            
            if(dbRef) {
                update(dbRef, updatedData);
                alert('Modifiche salvate!');
                closeEditModal();
            } else {
                alert('Errore: tipo di elemento non riconosciuto per il salvataggio.');
            }
        });
    }

    const deleteBtn = document.getElementById('delete-edit-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
             if (confirm(`Sei sicuro di voler eliminare questo elemento?`)) {
                let dbRef;
                if (type === 'wishlistItem') dbRef = ref(database, `wishlist/${item.id}`);
                else if (type === 'futureMovement') dbRef = ref(database, `futureMovements/${item.id}`);
                else if (type === 'variableExpense') dbRef = ref(database, `variableExpenses/${item.id}`);
                else if (type === 'fixedExpense') dbRef = ref(database, `fixedExpenses/${item.id}`);
                else if (type === 'incomeEntry') dbRef = ref(database, `incomeEntries/${item.id}`);
                else if (type === 'cashMovement') dbRef = ref(database, `cassaComune/movements/${item.id}`);

                if(dbRef) {
                    remove(dbRef);
                    // Logica speciale per ricalcolare il saldo cassa se si elimina un movimento
                    if (type === 'cashMovement') {
                         const newBalance = cassaComune.balance + (item.type === 'deposit' ? -item.amount : item.amount);
                         update(cassaComuneRef, { balance: newBalance });
                    }
                    alert('Elemento eliminato.');
                    closeEditModal();
                }
             }
        });
    }
};


const closeEditModal = () => {
    const editModal = document.getElementById('edit-modal');
    if (editModal) editModal.classList.add('hidden');
};


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

    const newMovementRef = push(ref(database, 'cassaComune/movements'));
    const newMovementId = newMovementRef.key;
    const newMovement = { id: newMovementId, type: movementType, amount, member, date, description };
    const newBalance = (movementType === 'deposit') ? (cassaComune.balance || 0) + amount : (cassaComune.balance || 0) - amount;

    const updates = {};
    updates[`cassaComune/movements/${newMovementId}`] = newMovement;
    updates[`cassaComune/balance`] = newBalance;

    update(ref(database), updates);

    alert(`Movimento di ${movementType} registrato. Nuovo saldo: €${newBalance.toFixed(2)}`);
    document.getElementById('cash-form-section').classList.add('hidden');
    document.getElementById('cash-movement-amount').value = '';
    document.getElementById('cash-movement-description').value = '';
}

function handleExportData() { 
    // Ricostruisce l'oggetto dati per l'esportazione
    const dataToExport = {
        members: members, // Questo ora è un array di oggetti {id, name, ...}
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
            
            // --- LOGICA DI IMPORTAZIONE MIGLIORATA ---
            // Ricostruisce gli oggetti da array, se necessario
            const formatAsObject = (arr) => arr.reduce((acc, item) => {
                if(item.id) acc[item.id] = item;
                return acc;
            }, {});

            // Prepara gli aggiornamenti
            const updates = {};
            updates['members'] = formatAsObject(importedData.members || []); // Salva 'members' come oggetto (la nuova struttura)
            updates['variableExpenses'] = formatAsObject(importedData.variableExpenses || []);
            updates['fixedExpenses'] = formatAsObject(importedData.fixedExpenses || []);
            updates['incomeEntries'] = formatAsObject(importedData.incomeEntries || []);
            updates['wishlist'] = formatAsObject(importedData.wishlist || []);
            updates['futureMovements'] = formatAsObject(importedData.futureMovements || []);
            updates['pendingPayments'] = formatAsObject(importedData.pendingPayments || []);
            updates['cassaComune'] = importedData.cassaComune || { balance: 0, movements: {} };
            updates['expenseRequests'] = importedData.expenseRequests || {};
            
            set(ref(database), updates); // Sovrascrive l'intero DB con i nuovi dati
            
            alert("Dati importati con successo e salvati su Firebase! La pagina verrà aggiornata.");
            location.reload(); // Ricarica per vedere i nuovi dati
        } catch (error) {
            console.error("Errore durante l'importazione del file JSON:", error);
            alert("Errore nell'importazione: file non valido o corrotto.");
        }
    };
    reader.readAsText(file);
}

function exportToExcel() { 
    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Riepilogo
    const summarySheet = workbook.addWorksheet('Riepilogo');
    summarySheet.addRow(['Voce', 'Importo (€)']);
    summarySheet.addRow(['Totale Spese Fisse', fixedExpenses.reduce((s, e) => s + (e.amount || 0), 0)]);
    summarySheet.addRow(['Totale Spese Variabili', variableExpenses.reduce((s, e) => s + (e.amount || 0), 0)]);
    summarySheet.addRow(['Totale Entrate', incomeEntries.reduce((s, e) => s + (e.amount || 0), 0)]);
    summarySheet.addRow(['Saldo Cassa Comune', cassaComune.balance]);
    
    // Sheet 2: Conguaglio
    const settlements = calculateAndRenderSettlement(true);
    const settlementSheet = workbook.addWorksheet('Conguaglio');
    settlementSheet.addRow(['Chi paga', 'Chi riceve', 'Importo (€)']);
    settlements.forEach(s => settlementSheet.addRow([s.payer, s.recipient, s.amount.toFixed(2)]));

    // Sheet 3: Spese Variabili
    const varSheet = workbook.addWorksheet('Spese Variabili');
    varSheet.addRow(['Data', 'Pagante', 'Importo (€)', 'Categoria', 'Descrizione']);
    variableExpenses.forEach(e => varSheet.addRow([displayDate(e.date), e.payer, e.amount, e.category, e.description]));
    
    // ... (Aggiungi altri sheet se vuoi) ...

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


// --- Event Listeners ---
if (monthFilter) monthFilter.addEventListener('change', () => {
    // Quando il filtro cambia, aggiorna solo il conguaglio e i grafici
    calculateAndRenderSettlement(false);
    if (typeof Chart !== 'undefined') {
        initializeCharts();
    }
});

if (addMemberBtn) addMemberBtn.addEventListener('click', () => {
    const name = newMemberNameInput.value.trim();
    if (name && !members.some(m => m.name === name)) {
        // NON aggiungere più a 'members'. Gestisci l'aggiunta di membri
        // solo tramite l'autenticazione e il nodo /users e /members
        alert("Funzione deprecata. I membri vengono aggiunti tramite la gestione utenti (autenticazione).");
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
        return alert("Compila tutti i campi obbligatori.");
    }

    const newPaymentRef = push(pendingPaymentsRef);
    set(newPaymentRef, {
        id: newPaymentRef.key,
        member: member,
        amount: amount,
        description: description,
        date: new Date().toISOString().split('T')[0]
    });
    
    document.getElementById('pending-payment-form-section').classList.add('hidden');
    alert("Richiesta quota aggiunta.");
});


if (addFutureMovementBtn) addFutureMovementBtn.addEventListener('click', () => {
    const description = document.getElementById('future-movement-description').value.trim();
    const totalCost = parseFloat(document.getElementById('future-movement-cost').value);
    const dueDate = document.getElementById('future-movement-due-date').value;

    if (!description || isNaN(totalCost) || totalCost <= 0 || !dueDate) {
        return alert("Compila tutti i campi obbligatori (Descrizione, Costo, Data).");
    }
    if (!members || members.length === 0) {
         alert("Errore: Non ci sono membri registrati per calcolare le quote.");
         return;
    }

    const costPerPerson = totalCost / members.length;
    let shares = [];
    try {
        shares = members.map(member => {
            if (!member || typeof member.name !== 'string') throw new Error("Formato membro non valido.");
            return { member: member.name, amount: costPerPerson, paid: false };
        });
    } catch (error) {
        console.error("Errore durante la creazione delle quote:", error);
        alert("Si è verificato un errore nel calcolo delle quote.");
        return;
    }

    const newMovementRef = push(futureMovementsRef); 
    const newMovementData = {
        id: newMovementRef.key,
        description: description,
        totalCost: totalCost,
        dueDate: dueDate,
        shares: shares,
        isExpanded: false
    };

    set(newMovementRef, newMovementData)
        .then(() => {
            alert("Movimento futuro pianificato con quote iniziali.");
            document.getElementById('future-movement-description').value = '';
            document.getElementById('future-movement-cost').value = '';
            document.getElementById('future-movement-due-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('future-movement-form-section').classList.add('hidden');
        })
        .catch(error => {
            console.error("Errore aggiungendo movimento futuro:", error);
            alert("Errore durante l'aggiunta del movimento futuro.");
        });
});

if (wishlistNewLinkInput && addWishlistLinkBtn) addWishlistLinkBtn.addEventListener('click', () => {
    const input = wishlistNewLinkInput;
    if(input.value.trim()){
        const newLink = input.value.trim();
        // Cerca un item "Generico" o crea il primo item
        let genericItem = wishlist.find(item => item.name === "Articoli Generici");
        if (!genericItem) {
            const newWishRef = push(wishlistRef);
            genericItem = {id: newWishRef.key, name: "Articoli Generici", cost: 0, priority: "1-Bassa", links: [newLink]};
            set(newWishRef, genericItem);
        } else {
            const updatedLinks = [...(genericItem.links || []), newLink];
            update(ref(database, `wishlist/${genericItem.id}`), { links: updatedLinks });
        }
        input.value = '';
    }
});

if (wishlistLinksContainer) wishlistLinksContainer.addEventListener('click', (e) => {
    if(e.target.matches('.remove-wishlist-link-btn')){
        const linkToRemove = e.target.dataset.link;
        let genericItem = wishlist.find(item => item.name === "Articoli Generici");
        if(genericItem && genericItem.links) {
            const updatedLinks = genericItem.links.filter(link => link !== linkToRemove);
            update(ref(database, `wishlist/${genericItem.id}`), { links: updatedLinks });
        }
    }
});


if (addWishlistItemBtn) addWishlistItemBtn.addEventListener('click', () => {
    const name = document.getElementById('wishlist-item-name').value.trim();
    const cost = parseFloat(document.getElementById('wishlist-item-cost').value);
    const priority = document.getElementById('wishlist-item-priority').value;

    if (!name || isNaN(cost) || cost <= 0) {
        return alert("Compila nome e costo stimato.");
    }

    const newWishRef = push(wishlistRef);
    set(newWishRef, {
        id: newWishRef.key,
        name: name,
        cost: cost,
        priority: priority,
        links: []
    });
    
    document.getElementById('wishlist-form-section').classList.add('hidden');
    alert("Articolo aggiunto alla lista desideri.");
});

if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => {
    const date = document.getElementById('income-date').value;
    const amount = parseFloat(document.getElementById('income-amount').value);
    const description = document.getElementById('income-description').value.trim();
    const membersInvolved = Array.from(document.querySelectorAll('#income-members-checkboxes input:checked')).map(cb => cb.value);

    if (!date || isNaN(amount) || amount <= 0 || !description || membersInvolved.length === 0) {
        return alert("Compila tutti i campi e seleziona almeno un membro.");
    }
    
    const newIncomeRef = push(incomeRef);
    set(newIncomeRef, {
        id: newIncomeRef.key,
        date: date,
        amount: amount,
        description: description,
        membersInvolved: membersInvolved
    });

    document.getElementById('income-form-section').classList.add('hidden');
    alert("Entrata aggiunta.");
});


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
        
        // Trova l'ID del membro pagante (se non è Cassa Comune)
        const payerMember = members.find(m => m.name === payer);
        const payerId = (payer === 'Cassa Comune') ? 'Cassa Comune' : payerMember?.id;

        if (currentUser.role === 'admin') {
            if (payer === 'Cassa Comune') {
                if ((cassaComune.balance || 0) < amount) {
                    return alert("Errore: Fondi insufficienti nella cassa comune.");
                }

                const newExpenseRef = push(varExpensesRef);
                const newExpense = { id: newExpenseRef.key, date, payer, amount, category, description, payerId };

                const newMovementRef = push(ref(database, 'cassaComune/movements'));
                const newMovement = {
                    id: newMovementRef.key,
                    type: 'withdrawal',
                    amount: amount,
                    member: 'Cassa', 
                    date: date,
                    description: `Spesa: ${description}`
                };

                const newBalance = (cassaComune.balance || 0) - amount;
                const updates = {};
                updates[`variableExpenses/${newExpenseRef.key}`] = newExpense;
                updates[`cassaComune/balance`] = newBalance;
                updates[`cassaComune/movements/${newMovementRef.key}`] = newMovement;

                update(ref(database), updates);
                alert('Spesa pagata dalla Cassa Comune aggiunta.');

            } else {
                // Pagante è un membro, Admin lo aggiunge direttamente
                const newExpenseRef = push(varExpensesRef);
                set(newExpenseRef, { id: newExpenseRef.key, date, payer, amount, category, description, payerId });
                alert('Spesa aggiunta con successo.');
            }
        } else {
            // Utente non-admin invia richiesta
            const newRequestRef = push(expenseRequestsRef);
            set(newRequestRef, { 
                requesterUid: currentUser.uid, 
                requesterName: currentUser.name, // USA IL NOME DA AUTH-GUARD
                date, 
                payer, 
                payerId,
                amount, 
                category, 
                description, 
                status: 'pending' 
            });
            alert("Richiesta di spesa inviata.");
        }
        
        document.getElementById('expense-form-section').classList.add('hidden');
    });
}
if (addFixedExpenseBtn) addFixedExpenseBtn.addEventListener('click', () => {
    const description = document.getElementById('fixed-desc').value.trim();
    const amount = parseFloat(document.getElementById('fixed-amount').value);

    if (!description || isNaN(amount) || amount <= 0) {
        return alert("Compila descrizione e importo.");
    }

    const newFixedRef = push(fixedExpensesRef);
    set(newFixedRef, {
        id: newFixedRef.key,
        description: description,
        amount: amount,
        payer: 'Tutti' // Default
    });

    document.getElementById('fixed-expenses-section').classList.add('hidden');
    alert("Spesa fissa aggiunta.");
});

if (quickActionsContainer) quickActionsContainer.addEventListener('click', (e) => {
    if (e.target.matches('.action-btn')) {
        const targetId = e.target.dataset.formId;
        const targetForm = document.getElementById(targetId);
        
        document.querySelectorAll('.action-form').forEach(form => form.classList.add('hidden'));

        if (targetForm) {
            targetForm.classList.remove('hidden');
        }
    }
});

document.addEventListener('click', (e) => {
    const target = e.target;
    const movementCardHeader = target.closest('[data-movement-id]');
    const movementCard = target.closest('.bg-blue-50'); 

    if (movementCardHeader && movementCard) {
        if (movementCardHeader === target || movementCardHeader.contains(target)) {
            if (!target.matches('button, input, a, .open-edit-modal-btn, .delete-future-movement-btn, .future-share-amount, .future-share-checkbox')) {
                const movementId = movementCardHeader.dataset.movementId;
                const sharesContainer = document.getElementById(`shares-${movementId}`);
                if (sharesContainer) {
                    sharesContainer.classList.toggle('hidden');
                    const movement = futureMovements.find(m => m && m.id === movementId);
                    if (movement) {
                        const isExpanded = !sharesContainer.classList.contains('hidden');
                        update(ref(database, `futureMovements/${movementId}`), { isExpanded: isExpanded })
                            .catch(error => console.error("Errore aggiornando isExpanded:", error));
                    }
                }
                e.stopPropagation(); 
                return;
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
            set(newExpenseRef, { 
                id: newExpenseRef.key, 
                payer: req.payer, 
                payerId: req.payerId,
                date: req.date, 
                amount: req.amount, 
                category: req.category, 
                description: `[RICHIESTA] ${req.description}` 
            });
            update(ref(database, `expenseRequests/${key}`), { status: 'approved' });
        }
    } 
    else if (target.matches('.reject-request-btn')) {
        const key = target.dataset.key;
        if (expenseRequests[key]) update(ref(database, `expenseRequests/${key}`), { status: 'rejected' });
    } 
    else if (target.matches('.delete-future-movement-btn')) {
        const idToDelete = target.dataset.id;
        if (idToDelete && confirm(`Sei sicuro di voler eliminare questo movimento futuro?`)) {
            remove(ref(database, `futureMovements/${idToDelete}`))
                .then(() => alert('Movimento futuro eliminato.'))
                .catch((error) => console.error("Errore eliminazione movimento futuro:", error));
        }
    }
    else if (target.matches('.delete-item-btn')) { // Gestione eliminazione altri tipi (es. Cassa)
        const id = target.dataset.id;
        const type = target.dataset.type;
        if (id && type && confirm(`Sei sicuro di voler eliminare questo elemento?`)) {
            if (type === 'cashMovement') {
                const movements = cassaComune.movements ? { ...cassaComune.movements } : {};
                const movementToDelete = movements[id];
                if (movementToDelete) {
                    const newBalance = cassaComune.balance + (movementToDelete.type === 'deposit' ? -movementToDelete.amount : movementToDelete.amount);
                    delete movements[id];
                    set(cassaComuneRef, { balance: newBalance, movements: movements });
                    alert('Movimento cassa eliminato e bilancio ricalcolato.');
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
    else if (target.id === 'close-settlement-btn') {
        const settlementContainer = document.getElementById('settlement-container');
        if (settlementContainer) {
            settlementContainer.classList.add('hidden');
        }
    }
}); 

if (calculateBtn) {
    calculateBtn.addEventListener('click', () => {
        const settlementContainer = document.getElementById('settlement-container');
        if (settlementContainer) {
            if (settlementContainer.classList.contains('hidden')) {
                calculateAndRenderSettlement(false);
                settlementContainer.classList.remove('hidden');
            } else {
                settlementContainer.classList.add('hidden');
            }
        }
    });
}
if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);
if (exportDataBtn) exportDataBtn.addEventListener('click', handleExportData);
if (importDataBtn) importDataBtn.addEventListener('click', () => importFileInput.click());
if (importFileInput) importFileInput.addEventListener('change', handleImportData);

document.addEventListener('change', (e) => {
    const target = e.target;
    
    if (target.matches('.future-share-checkbox')) {
        const movementId = target.dataset.movementId;
        const shareIndex = parseInt(target.dataset.shareIndex, 10);
        const isChecked = target.checked;

        if (movementId && !isNaN(shareIndex)) {
            update(ref(database, `futureMovements/${movementId}/shares/${shareIndex}`), { paid: isChecked })
                .catch(error => console.error("Errore aggiornando stato quota:", error));
        }
    }
    else if (target.matches('.future-share-amount')) {
        const movementId = target.dataset.movementId;
        const shareIndex = parseInt(target.dataset.shareIndex, 10);
        const newAmount = parseFloat(target.value);

        if (movementId && !isNaN(shareIndex) && !isNaN(newAmount)) {
            const movement = futureMovements.find(m => m.id === movementId);
            if (movement && movement.shares && movement.shares[shareIndex]) {
                 movement.shares[shareIndex].amount = newAmount;
                 const newTotalCost = movement.shares.reduce((sum, s) => sum + (s.amount || 0), 0);
                 const updates = {};
                 updates[`futureMovements/${movementId}/shares/${shareIndex}/amount`] = newAmount;
                 updates[`futureMovements/${movementId}/totalCost`] = newTotalCost; 
                 update(ref(database), updates)
                    .catch(error => console.error("Errore aggiornando importo quota:", error));
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
