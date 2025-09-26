import { database } from './firebase-config.js';
import { ref, set, onValue, push } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

// Riferimenti ai nodi del tuo database
const membersRef = ref(database, 'members');
const varExpensesRef = ref(database, 'variableExpenses');
const fixedExpensesRef = ref(database, 'fixedExpenses');
const incomeRef = ref(database, 'incomeEntries');
const wishlistRef = ref(database, 'wishlist');
const futureMovementsRef = ref(database, 'futureMovements');
const pendingPaymentsRef = ref(database, 'pendingPayments');
const cassaComuneRef = ref(database, 'cassaComune');

// --- Data State (Firebase-synced) ---
let members = [];
let variableExpenses = [];
let fixedExpenses = [];
let incomeEntries = [];
let wishlist = [];
let futureMovements = [];
let pendingPayments = [];
let cassaComune = { balance: 0, movements: [] };

function saveDataToFirebase() {
    set(membersRef, members);
    set(varExpensesRef, variableExpenses);
    set(fixedExpensesRef, fixedExpenses);
    set(incomeRef, incomeEntries);
    set(wishlistRef, wishlist);
    set(futureMovementsRef, futureMovements);
    set(pendingPaymentsRef, pendingPayments);
    set(cassaComuneRef, cassaComune);
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
}

// --- App Logic (DOM Elements) ---
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

let tempWishlistLinks = [];
let membersContributionsChart, membersIncomeChart, categoriesChart, balancesChart;

const sections = {
    summary: document.getElementById('summary-section'),
    cashBalance: document.getElementById('cash-balance-section'),
    expensesList: document.getElementById('expenses-list-section'),
    incomeList: document.getElementById('income-list-section'),
    wishlist: document.getElementById('wishlist-section'),
    futureMovements: document.getElementById('future-movements-section'),
    pendingPayments: document.getElementById('pending-payments-section'),
    quickActions: document.getElementById('quick-actions-section'),
};

// --- Utility Functions ---
const populateMonthFilter = () => {
    const months = new Set();
    [...variableExpenses, ...incomeEntries, ...(cassaComune.movements || [])].forEach(item => {
        if (item.date) {
            const date = new Date(item.date);
            if (!isNaN(date)) {
                const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                months.add(month);
            }
        }
    });

    const currentSelection = monthFilter.value;
    monthFilter.innerHTML = '<option value="all">Globale</option>';
    const sortedMonths = Array.from(months).sort().reverse();
    
    sortedMonths.forEach(month => {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, monthNum - 1);
        const optionText = date.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        
        const option = document.createElement('option');
        option.value = month; 
        option.textContent = optionText.charAt(0).toUpperCase() + optionText.slice(1);
        monthFilter.appendChild(option);
    });

    if (Array.from(monthFilter.options).some(opt => opt.value === currentSelection)) {
        monthFilter.value = currentSelection;
    }
};

const toggleSectionsVisibility = () => {
    const hasMembers = members.length > 0;
    Object.values(sections).forEach(section => {
        if(section) section.classList.toggle('hidden', !hasMembers);
    });
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() + userTimezoneOffset).toISOString().split('T')[0];
    } catch (e) {
        return dateString;
    }
};

const displayDate = (dateString) => {
     if (!dateString) return 'N/A';
     const date = new Date(dateString);
     if (isNaN(date)) return 'Data non valida';
     const userTimezoneOffset = date.getTimezoneOffset() * 60000;
     return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- Rendering Functions ---
const renderMembers = () => {
    membersListEl.innerHTML = '';
    payerSelect.innerHTML = '';
    pendingPaymentMemberSelect.innerHTML = '';
    incomeMembersCheckboxes.innerHTML = '';
    cashMovementMemberSelect.innerHTML = '<option value="">Nessuno</option>';
    memberCountEl.textContent = members.length;

    const cassaOption = document.createElement('option');
    cassaOption.value = "Cassa Comune";
    cassaOption.textContent = "Cassa Comune";
    payerSelect.appendChild(cassaOption);

    members.forEach((member, index) => {
        const tag = document.createElement('div');
        tag.className = 'flex items-center bg-indigo-100 text-indigo-800 text-sm font-medium px-3 py-1 rounded-full';
        tag.innerHTML = `<span>${member}</span><button data-index="${index}" class="remove-member-btn ml-2 text-indigo-500 hover:text-indigo-800 font-bold">&times;</button>`;
        membersListEl.appendChild(tag);

        const option = document.createElement('option');
        option.value = member;
        option.textContent = member;
        payerSelect.appendChild(option.cloneNode(true));
        pendingPaymentMemberSelect.appendChild(option.cloneNode(true));
        cashMovementMemberSelect.appendChild(option.cloneNode(true));

        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'flex items-center';
        checkboxDiv.innerHTML = `<input id="income-member-${index}" type="checkbox" value="${member}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                               <label for="income-member-${index}" class="ml-2 block text-sm text-gray-900">${member}</label>`;
        incomeMembersCheckboxes.appendChild(checkboxDiv);
    });
};

const renderCassaComune = () => {
    cashBalanceAmountEl.textContent = `€${cassaComune.balance.toFixed(2)}`;
    cashMovementsHistoryEl.innerHTML = '';
    if(!cassaComune.movements || cassaComune.movements.length === 0){
        cashMovementsHistoryEl.innerHTML = '<p class="text-gray-500 text-sm">Nessun movimento registrato.</p>';
        return;
    }

    const sortedMovements = [...cassaComune.movements].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedMovements.forEach(mov => {
        const isDeposit = mov.type === 'deposit';
        const el = document.createElement('div');
        el.className = `text-sm p-2 rounded-lg flex justify-between items-center ${isDeposit ? 'bg-green-50' : 'bg-red-50'}`;
        el.innerHTML = `
            <div>
                <p class="font-medium">${mov.description}</p>
                <p class="text-xs text-gray-500">${displayDate(mov.date)} ${mov.member ? `(${mov.member})` : ''}</p>
            </div>
            <div class="flex items-center gap-2">
                 <p class="font-bold ${isDeposit ? 'text-green-600' : 'text-red-600'}">
                    ${isDeposit ? '+' : '-'}€${mov.amount.toFixed(2)}
                 </p>
                 <div>
                    <button data-id="${mov.id}" data-type="cashMovement" class="edit-btn text-blue-500 hover:text-blue-700 p-1">&#9998;</button>
                    <button data-id="${mov.id}" class="remove-cash-movement-btn text-red-500 hover:text-red-700 font-bold">&times;</button>
                 </div>
            </div>
        `;
        cashMovementsHistoryEl.appendChild(el);
    });
};

const renderPendingPayments = () => {
    pendingPaymentsContainer.innerHTML = '';
    if (!pendingPayments || pendingPayments.length === 0) {
        pendingPaymentsContainer.innerHTML = '<p class="text-gray-500">Nessuna quota da versare.</p>';
        return;
    }

    pendingPayments.sort((a,b) => b.dateAdded - a.dateAdded);

    pendingPayments.forEach(payment => {
        const paymentEl = document.createElement('div');
        paymentEl.className = 'fade-in flex justify-between items-center bg-yellow-50 p-3 rounded-lg border border-yellow-200';
        paymentEl.innerHTML = `
            <div>
                <p class="font-semibold text-yellow-800">${payment.description}</p>
                <p class="text-sm text-gray-600">
                    Da: <span class="font-medium">${payment.member}</span>
                    <span class="text-gray-400 mx-2">|</span>
                    Registrato il: ${displayDate(new Date(payment.dateAdded))}
                </p>
            </div>
            <div class="text-right flex items-center gap-3 ml-2">
                 <p class="font-bold text-lg text-red-600">€${parseFloat(payment.amount).toFixed(2)}</p>
                 <div class="flex flex-col gap-1">
                    <button data-id="${payment.id}" class="confirm-pending-payment-btn text-xs bg-green-500 text-white font-semibold py-1 px-3 rounded-lg hover:bg-green-600">Salda</button>
                    <div>
                        <button data-id="${payment.id}" data-type="pendingPayment" class="edit-btn text-blue-500 hover:text-blue-700 p-1">&#9998;</button>
                        <button data-id="${payment.id}" class="remove-pending-payment-btn text-red-500 hover:text-red-700 p-1 font-bold">&times;</button>
                    </div>
                 </div>
            </div>
        `;
        pendingPaymentsContainer.appendChild(paymentEl);
    });
};

const renderFutureMovements = () => {
    futureMovementsContainer.innerHTML = '';
     if (!futureMovements || futureMovements.length === 0) {
        futureMovementsContainer.innerHTML = '<p class="text-gray-500">Nessun movimento futuro pianificato.</p>';
        return;
    }

    futureMovements.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    futureMovements.forEach(mov => {
        const movEl = document.createElement('div');
        movEl.className = 'fade-in bg-cyan-50 p-4 rounded-lg border border-cyan-200';
        const isExpanded = mov.isExpanded || false;
        
        const currentSharesSum = (mov.shares || []).reduce((sum, s) => sum + s.amount, 0);
        const difference = mov.totalCost - currentSharesSum;
        const differenceColor = Math.abs(difference) < 0.01 ? 'text-green-600' : 'text-red-600';

        let sharesHtml = '';
        if (isExpanded) {
            sharesHtml = `<div class="mt-3 pt-3 border-t border-cyan-200 space-y-2">`;
            (mov.shares || []).forEach(share => {
                const isPaid = share.paid || false;
                sharesHtml += `
                    <div class="flex items-center justify-between text-sm gap-2">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="paid-${mov.id}-${share.member}" 
                                   class="paid-checkbox h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500" 
                                   data-movement-id="${mov.id}" data-member-name="${share.member}" ${isPaid ? 'checked' : ''}>
                            <label for="paid-${mov.id}-${share.member}" class="font-medium ${isPaid ? 'line-through text-gray-500' : ''}">${share.member}</label>
                        </div>
                        <div class="flex items-center gap-1">
                            <input type="number" step="0.01" id="share-${mov.id}-${share.member}" 
                                data-movement-id="${mov.id}" data-member-name="${share.member}"
                                class="share-input w-24 p-1 border rounded-md text-right" value="${share.amount.toFixed(2)}">
                            ${share.edited ? `<button class="reset-share-btn text-xs text-blue-500" data-movement-id="${mov.id}" data-member-name="${share.member}">&#x21BA;</button>` : `<span class="w-4"></span>`}
                        </div>
                    </div>
                `;
            });
            sharesHtml += `
                <div class="flex justify-between items-center mt-3 pt-2 border-t text-sm">
                    <div>
                        <span class="font-bold">Totale Quote:</span>
                        <span class="font-mono ${differenceColor}">€${currentSharesSum.toFixed(2)}</span>
                        <span class="text-xs ${differenceColor}"> (${difference >= 0 ? '+' : ''}${difference.toFixed(2)})</span>
                    </div>
                    <button data-id="${mov.id}" class="recalculate-shares-btn text-xs bg-blue-500 text-white font-semibold py-1 px-2 rounded-md hover:bg-blue-600">Pareggia Quote</button>
                </div>
            `;
            sharesHtml += `</div>`;
        }

        movEl.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="font-semibold text-cyan-800">${mov.description}</p>
                    <p class="text-sm text-gray-600">
                        Scadenza: <span class="font-medium">${displayDate(mov.dueDate)}</span>
                    </p>
                </div>
                <div class="text-right">
                    <p class="font-bold text-xl text-cyan-600">€${mov.totalCost.toFixed(2)}</p>
                    <p class="text-xs text-gray-500">€${(members.length > 0 ? mov.totalCost / members.length : 0).toFixed(2)} / persona</p>
                </div>
            </div>
            ${sharesHtml}
            <div class="flex items-center gap-2 mt-4">
                <button data-id="${mov.id}" class="confirm-payment-btn flex-1 text-sm bg-green-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-green-600">Conferma Pagamento</button>
                <button data-id="${mov.id}" class="manage-shares-btn flex-1 text-sm bg-gray-200 text-gray-800 font-semibold py-2 px-3 rounded-lg hover:bg-gray-300">${isExpanded ? 'Chiudi Quote' : 'Gestisci Quote'}</button>
                <div class="flex">
                    <button data-id="${mov.id}" data-type="futureMovement" class="edit-btn text-blue-500 hover:text-blue-700 p-1">&#9998;</button>
                    <button data-id="${mov.id}" class="remove-future-movement-btn text-red-500 hover:text-red-700 font-bold p-1">&times;</button>
                </div>
            </div>
        `;
        futureMovementsContainer.appendChild(movEl);
    });
};

const renderWishlist = () => {
    wishlistContainer.innerHTML = '';
    if (!wishlist || wishlist.length === 0) {
        wishlistContainer.innerHTML = '<p class="text-gray-500">Nessun articolo nella lista desideri.</p>';
        return;
    }

    const priorityMap = {
        '3-Alta': { text: 'Alta', color: 'bg-red-100 text-red-800' },
        '2-Media': { text: 'Media', color: 'bg-yellow-100 text-yellow-800' },
        '1-Bassa': { text: 'Bassa', color: 'bg-green-100 text-green-800' }
    };

    wishlist.sort((a, b) => b.priority.localeCompare(a.priority));

    wishlist.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'fade-in flex justify-between items-center bg-gray-50 p-3 rounded-lg border';
        const priorityInfo = priorityMap[item.priority];

        let linksHtml = (item.links || []).map((link, index) => {
             try {
                const url = new URL(link.startsWith('http') ? link : `https://${link}`);
                return `<a href="${url.href}" target="_blank" class="text-indigo-500 hover:underline">[Link ${index+1}]</a>`;
            } catch (e) {
                return `<span class="text-gray-400">[Link ${index+1} non valido]</span>`;
            }
        }).join('<span class="mx-1">,</span> ');

        itemEl.innerHTML = `
            <div class="flex-grow">
                <p class="font-semibold">${item.name}</p>
                 <p class="text-sm text-gray-600">
                    Costo: <span class="font-medium">€${parseFloat(item.cost).toFixed(2)}</span>
                    <span class="text-gray-400 mx-2">|</span>
                    Priorità: <span class="text-xs font-medium px-2 py-0.5 rounded-full ${priorityInfo.color}">${priorityInfo.text}</span>
                </p>
                <div class="text-xs mt-1">${linksHtml}</div>
            </div>
            <div class="flex items-center gap-2 ml-2">
                 <button data-id="${item.id}" class="mark-purchased-btn text-xs bg-green-500 text-white font-semibold py-1 px-3 rounded-lg hover:bg-green-600">Acquistato</button>
                 <div>
                     <button data-id="${item.id}" data-type="wishlistItem" class="edit-btn text-blue-500 hover:text-blue-700 p-1">&#9998;</button>
                     <button data-id="${item.id}" class="remove-wishlist-item-btn text-red-500 hover:text-red-700 p-1 font-bold">&times;</button>
                 </div>
            </div>
        `;
        wishlistContainer.appendChild(itemEl);
    });
};

const renderIncomeEntries = () => {
    incomeListContainer.innerHTML = '';
    if (!incomeEntries || incomeEntries.length === 0) {
        incomeListContainer.innerHTML = '<p class="text-gray-500">Nessuna entrata registrata.</p>';
        return;
    }
    incomeEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    incomeEntries.forEach(income => {
        const incomeEl = document.createElement('div');
        incomeEl.className = 'fade-in flex justify-between items-start bg-green-50 p-3 rounded-lg border border-green-200';
        incomeEl.innerHTML = `
            <div>
                <p class="font-semibold">${income.description}</p>
                <p class="text-sm text-gray-600">
                    Membri: <span class="font-medium text-teal-700">${(income.membersInvolved || []).join(', ')}</span>
                    <span class="text-gray-400 mx-2">|</span>
                    ${displayDate(income.date)}
                </p>
            </div>
            <div class="text-right flex-shrink-0 ml-4">
                 <p class="font-bold text-lg text-green-600">+€${parseFloat(income.amount).toFixed(2)}</p>
                 <div>
                    <button data-id="${income.id}" data-type="incomeEntry" class="edit-btn text-blue-500 hover:text-blue-700 p-1">&#9998;</button>
                    <button data-id="${income.id}" class="remove-income-btn text-red-500 hover:text-red-700 p-1 font-bold">&times;</button>
                 </div>
            </div>
        `;
        incomeListContainer.appendChild(incomeEl);
    });
};

const renderVariableExpenses = () => {
    expensesListContainer.innerHTML = '';
    if (!variableExpenses || variableExpenses.length === 0) {
        expensesListContainer.innerHTML = '<p class="text-gray-500">Nessuna spesa registrata.</p>';
        return;
    }
    variableExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    variableExpenses.forEach(expense => {
        const isFromCash = expense.payer === 'Cassa Comune';
        const expenseEl = document.createElement('div');
        expenseEl.className = `fade-in flex justify-between items-center p-3 rounded-lg border ${isFromCash ? 'bg-blue-50' : 'bg-gray-50'}`;
        expenseEl.innerHTML = `
            <div>
                <p class="font-semibold">${expense.description} <span class="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">${expense.category}</span></p>
                <p class="text-sm text-gray-600">
                    Pagato da: <span class="font-medium ${isFromCash ? 'text-blue-600' : 'text-indigo-600'}">${expense.payer}</span>
                    <span class="text-gray-400 mx-2">|</span>
                    ${displayDate(expense.date)}
                </p>
            </div>
            <div class="text-right">
                 <p class="font-bold text-lg">€${parseFloat(expense.amount).toFixed(2)}</p>
                 <div>
                     <button data-id="${expense.id}" data-type="variableExpense" class="edit-btn text-blue-500 hover:text-blue-700 p-1">&#9998;</button>
                     <button data-id="${expense.id}" class="remove-expense-btn text-red-500 hover:text-red-700 p-1 font-bold">&times;</button>
                </div>
            </div>
        `;
        expensesListContainer.appendChild(expenseEl);
    });
};

const renderFixedExpenses = () => {
    fixedExpensesListEl.innerHTML = '';
    if(!fixedExpenses || fixedExpenses.length === 0) {
        fixedExpensesListEl.innerHTML = '<p class="text-gray-500 text-sm">Nessuna spesa fissa aggiunta.</p>';
    }
    fixedExpenses.forEach(expense => {
        const el = document.createElement('div');
        el.className = 'flex justify-between items-center bg-orange-50 p-2 rounded-lg text-sm';
        el.innerHTML = `
            <span>${expense.description}</span>
            <div class="flex items-center gap-2">
                <span class="font-bold">€${parseFloat(expense.amount).toFixed(2)}</span>
                <button data-id="${expense.id}" data-type="fixedExpense" class="edit-btn text-blue-500 hover:text-blue-700 p-1">&#9998;</button>
                <button data-id="${expense.id}" class="remove-fixed-expense-btn text-red-500 hover:text-red-700 font-bold">&times;</button>
            </div>
        `;
        fixedExpensesListEl.appendChild(el);
    });
}

// --- Charting Functions ---
const createBarChart = (canvasId, label) => new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'bar', data: { labels: [], datasets: [{ label, data: [], backgroundColor: [] }] },
    options: { responsive: true, maintainAspectRatio: true, scales: { y: { beginAtZero: true } } }
});

const initializeCharts = () => {
    if (document.getElementById('membersContributionsChart')) {
        if (membersContributionsChart) membersContributionsChart.destroy();
        membersContributionsChart = createBarChart('membersContributionsChart', 'Contributi Versati (€)');
        membersContributionsChart.data.datasets[0].backgroundColor = 'rgba(79, 70, 229, 0.8)';
    }
    if (document.getElementById('membersIncomeChart')) {
        if (membersIncomeChart) membersIncomeChart.destroy();
        membersIncomeChart = createBarChart('membersIncomeChart', 'Entrate Generate (€)');
        membersIncomeChart.data.datasets[0].backgroundColor = 'rgba(13, 148, 136, 0.8)';
    }
    if (document.getElementById('categoriesChart')) {
        if (categoriesChart) categoriesChart.destroy();
        categoriesChart = new Chart(document.getElementById('categoriesChart').getContext('2d'), {
            type: 'doughnut', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#4f46e5', '#10b981', '#ef4444', '#f97316', '#3b82f6', '#eab308', '#8b5cf6'] }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
        });
    }
    if (document.getElementById('balancesChart')) {
        if (balancesChart) balancesChart.destroy();
        balancesChart = createBarChart('balancesChart', 'Saldo per Membro (€)');
    }
};

// --- Calculation Logic ---
const getCalculationData = (selectedMonth = 'all') => {
    let filteredVarExpenses = variableExpenses || [];
    let filteredIncome = incomeEntries || [];
    let filteredCashMovements = cassaComune.movements || [];
    let applicableFixedExpenses = fixedExpenses || [];

    if (selectedMonth !== 'all') {
        filteredVarExpenses = filteredVarExpenses.filter(exp => exp.date && exp.date.startsWith(selectedMonth));
        filteredIncome = filteredIncome.filter(inc => inc.date && inc.date.startsWith(selectedMonth));
        filteredCashMovements = filteredCashMovements.filter(mov => mov.date && mov.date.startsWith(selectedMonth));
    }
    
    const totalVar = filteredVarExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalFix = applicableFixedExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalExpenseForShare = totalVar + totalFix;
    const totalIncome = filteredIncome.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
    const perPersonShare = members.length > 0 ? totalExpenseForShare / members.length : 0;

    const memberContributions = members.map(member => {
        const paidExpenses = filteredVarExpenses
            .filter(exp => exp.payer === member)
            .reduce((sum, exp) => sum + exp.amount, 0);

        const deposits = filteredCashMovements
            .filter(mov => mov.type === 'deposit' && mov.member === member)
            .reduce((sum, mov) => sum + mov.amount, 0);

        return paidExpenses + deposits;
    });
    
    const memberIncomes = members.map(member => {
        return filteredIncome.reduce((sum, income) => {
            if ((income.membersInvolved || []).includes(member)) {
                return sum + (parseFloat(income.amount) / income.membersInvolved.length);
            }
            return sum;
        }, 0);
    });

    const expenseBalances = members.map((member, index) => ({
        name: member,
        balance: memberContributions[index] - perPersonShare
    }));
    
    const categoryTotals = filteredVarExpenses.reduce((acc, exp) => {
        const category = exp.category || 'Non categorizzato';
        acc[category] = (acc[category] || 0) + parseFloat(exp.amount);
        return acc;
    }, {});
    
    return { totalVar, totalFix, totalIncome, perPersonShare, memberContributions, memberIncomes, expenseBalances, categoryTotals };
};

const calculateAndRenderSettlement = (forExport = false) => {
    if (members.length === 0) return [];
    
    const selectedMonth = monthFilter.value;
    const { expenseBalances, totalVar, totalFix } = getCalculationData(selectedMonth);
    const totalExpense = totalVar + totalFix;

    let debtors = expenseBalances.filter(p => p.balance < 0).map(p => ({ ...p, balance: -p.balance }));
    let creditors = expenseBalances.filter(p => p.balance > 0);
    const transactions = [];

    debtors.sort((a,b) => b.balance - a.balance);
    creditors.sort((a,b) => b.balance - a.balance);

    let d_ptr = 0;
    let c_ptr = 0;

    while (d_ptr < debtors.length && c_ptr < creditors.length) {
        const amount = Math.min(debtors[d_ptr].balance, creditors[c_ptr].balance);
        if (amount > 0.01) {
            transactions.push({ from: debtors[d_ptr].name, to: creditors[c_ptr].name, amount });
            debtors[d_ptr].balance -= amount;
            creditors[c_ptr].balance -= amount;
        }
        if (debtors[d_ptr].balance < 0.01) d_ptr++;
        if (creditors[c_ptr].balance < 0.01) c_ptr++;
    }
    
    if (forExport) {
        return transactions;
    }

    settlementList.innerHTML = '';
    if (transactions.length === 0 && totalExpense > 0) {
        settlementList.innerHTML = '<p class="text-center text-green-600 font-semibold p-3 bg-green-50 rounded-lg">Tutti i conti sono in pari!</p>';
    } else if (transactions.length > 0) {
        transactions.forEach(({ from, to, amount }) => {
            const li = document.createElement('div');
            li.className = 'bg-blue-50 p-3 rounded-lg flex items-center gap-3 flex-wrap';
            li.innerHTML = `
                <span class="font-bold text-red-600">${from}</span>
                <span class="text-gray-500">→</span>
                <span class="font-bold text-green-600">${to}</span>
                <span class="ml-auto font-bold text-xl text-blue-800">€${amount.toFixed(2)}</span>
            `;
            settlementList.appendChild(li);
        });
    } else {
         settlementList.innerHTML = '<p class="text-center text-gray-500">Nessuna transazione necessaria.</p>';
    }
    if(settlementContainer) settlementContainer.classList.remove('hidden');
};

// --- Data Import/Export ---
const handleExportData = () => {
    const dataToExport = { members, variableExpenses, fixedExpenses, incomeEntries, wishlist, futureMovements, pendingPayments, cassaComune };
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = 'gateradio_data.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
};

const handleImportData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm("Sei sicuro? Questa azione sovrascriverà i dati esistenti.")) {
                members = data.members || [];
                variableExpenses = data.variableExpenses || [];
                fixedExpenses = data.fixedExpenses || [];
                incomeEntries = data.incomeEntries || [];
                wishlist = (data.wishlist || []).map(item => {
                    if (item.link && !item.links) {
                        item.links = [item.link];
                        delete item.link;
                    }
                    return item;
                });
                futureMovements = data.futureMovements || [];
                pendingPayments = data.pendingPayments || [];
                cassaComune = data.cassaComune || { balance: 0, movements: [] };
                
                saveDataToFirebase();
                alert("Dati importati con successo!");
            }
        } catch (error) {
            alert("Errore durante la lettura del file. Assicurati che sia un file di backup valido.");
        } finally {
            if (importFileInput) importFileInput.value = '';
        }
    };
    reader.readAsText(file);
};

// --- Excel Export ---
const exportToExcel = async () => { /* Il codice completo per l'esportazione Excel va qui */ };

// --- Main View Update Function ---
const updateDashboardView = () => {
    if (!totalVariableEl) return; 
    
    const selectedMonth = monthFilter.value;
    const calculationData = getCalculationData(selectedMonth);

    totalVariableEl.textContent = `€${calculationData.totalVar.toFixed(2)}`;
    totalFixedEl.textContent = `€${calculationData.totalFix.toFixed(2)}`;
    totalIncomeEl.textContent = `€${calculationData.totalIncome.toFixed(2)}`;
    perPersonShareEl.textContent = `€${calculationData.perPersonShare.toFixed(2)}`;

    const { memberContributions, memberIncomes, expenseBalances, categoryTotals } = calculationData;
     const updateChartData = (chart, labels, data) => {
        if (!chart) return; 
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update();
    };

    updateChartData(membersContributionsChart, members, memberContributions);
    updateChartData(membersIncomeChart, members, memberIncomes);
    updateChartData(categoriesChart, Object.keys(categoryTotals), Object.values(categoryTotals));
    
    const balancesChartEl = document.getElementById('balancesChart');
    if (balancesChartEl && balancesChart) {
         balancesChartEl.parentElement.classList.remove('hidden');
         balancesChart.data.labels = members;
         balancesChart.data.datasets[0].data = expenseBalances.map(b => b.balance);
         balancesChart.data.datasets[0].backgroundColor = expenseBalances.map(b => b.balance < 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)');
         balancesChart.update();
    }
    
    if (settlementContainer) settlementContainer.classList.add('hidden');
};
    
 // --- Edit Modal Logic ---
const getItemFromStore = (type, id) => {
    let store;
    switch (type) {
        case 'variableExpense': store = variableExpenses; break;
        case 'fixedExpense': store = fixedExpenses; break;
        case 'incomeEntry': store = incomeEntries; break;
        case 'pendingPayment': store = pendingPayments; break;
        case 'wishlistItem': store = wishlist; break;
        case 'futureMovement': store = futureMovements; break;
        case 'cashMovement':
            return (cassaComune.movements || []).find(i => i.id === id);
        default: return null;
    }
    return store.find(i => i.id === id);
}

const openEditModal = (id, type) => {
    const item = getItemFromStore(type, id);
    if (!item) {
        console.error(`Item with id ${id} and type ${type} not found.`);
        return;
    }

    let formHtml = '';
    let title = 'Modifica Elemento';
    
    const createInput = (label, id, type, value, placeholder = '') => `<div><label for="${id}" class="block text-sm font-medium">${label}</label><input type="${type}" id="${id}" value="${value}" placeholder="${placeholder}" class="w-full p-2 border rounded-lg mt-1"></div>`;
    const createSelect = (label, id, options, selectedValue) => {
        let optionsHtml = options.map(opt => `<option value="${opt}" ${opt === selectedValue ? 'selected' : ''}>${opt}</option>`).join('');
        return `<div><label for="${id}" class="block text-sm font-medium">${label}</label><select id="${id}" class="w-full p-2 border rounded-lg mt-1">${optionsHtml}</select></div>`;
    }

    switch (type) {
        case 'cashMovement':
            title = 'Modifica Movimento Cassa';
            let memberOptions = [''].concat(members);
            formHtml = 
                createSelect('Tipo Movimento', 'edit-cash-type', ['deposit', 'withdrawal'], item.type) +
                createSelect('Membro (opzionale)', 'edit-cash-member', memberOptions, item.member) +
                createInput('Data', 'edit-cash-date', 'date', formatDate(item.date)) +
                createInput('Importo (€)', 'edit-cash-amount', 'number', item.amount) +
                createInput('Descrizione', 'edit-cash-description', 'text', item.description);
            break;
        case 'variableExpense':
            title = 'Modifica Spesa';
            formHtml = 
                createSelect('Pagato da', 'edit-payer', ['Cassa Comune', ...members], item.payer) +
                createInput('Data Spesa', 'edit-expense-date', 'date', formatDate(item.date)) +
                createInput('Importo (€)', 'edit-amount', 'number', item.amount) +
                createInput('Categoria', 'edit-category', 'text', item.category, 'Es. Bollette') +
                createInput('Descrizione', 'edit-description', 'text', item.description);
            break;
        case 'fixedExpense':
            title = 'Modifica Spesa Fissa';
            formHtml = 
                createInput('Descrizione', 'edit-fixed-desc', 'text', item.description) +
                createInput('Importo (€)', 'edit-fixed-amount', 'number', item.amount);
            break;
        case 'incomeEntry':
            title = 'Modifica Entrata';
            let membersCheckboxes = members.map((m, i) => `
                <div class="flex items-center">
                    <input id="edit-income-member-${i}" type="checkbox" value="${m}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" ${(item.membersInvolved || []).includes(m) ? 'checked' : ''}>
                    <label for="edit-income-member-${i}" class="ml-2 block text-sm text-gray-900">${m}</label>
                </div>`).join('');
            formHtml = 
                createInput('Data Entrata', 'edit-income-date', 'date', formatDate(item.date)) +
                createInput('Importo (€)', 'edit-income-amount', 'number', item.amount) +
                createInput('Descrizione', 'edit-income-description', 'text', item.description) +
                `<div><label class="block text-sm font-medium text-gray-700 mb-1">Membri Coinvolti</label><div id="edit-income-members-checkboxes" class="p-3 border rounded-lg max-h-32 overflow-y-auto space-y-2">${membersCheckboxes}</div></div>`;
            break;
        case 'pendingPayment':
             title = 'Modifica Quota da Versare';
             formHtml =
                 createSelect('Membro', 'edit-pending-member', members, item.member) +
                 createInput('Importo (€)', 'edit-pending-amount', 'number', item.amount) +
                 createInput('Descrizione', 'edit-pending-description', 'text', item.description);
             break;
        case 'wishlistItem':
            title = 'Modifica Desiderio';
            let linksHtml = (item.links || []).map((link, i) => `<div class="flex items-center gap-2" data-link-index="${i}"><input type="text" class="w-full p-1 border rounded-md" value="${link}"><button type="button" class="remove-edit-link-btn text-red-500">&times;</button></div>`).join('');
            formHtml = 
                createInput('Oggetto/Descrizione', 'edit-wishlist-name', 'text', item.name) +
                createInput('Costo Stimato (€)', 'edit-wishlist-cost', 'number', item.cost) +
                 createSelect('Priorità', 'edit-wishlist-priority', ['3-Alta', '2-Media', '1-Bassa'], item.priority) +
                `<div><label class="block text-sm font-medium">Link</label><div id="edit-wishlist-links-container" class="space-y-2 mt-1">${linksHtml}</div><div class="flex gap-2 mt-2"><input type="text" id="add-edit-link-input" class="w-full p-1 border rounded-md" placeholder="Aggiungi nuovo link..."><button id="add-edit-link-btn" type="button" class="text-sm bg-blue-500 text-white px-2 rounded-md hover:bg-blue-600">+</button></div></div>`;
            break;
        case 'futureMovement':
            title = 'Modifica Movimento Futuro';
            formHtml =
                createInput('Descrizione', 'edit-future-desc', 'text', item.description) +
                createInput('Costo Totale (€)', 'edit-future-cost', 'number', item.totalCost) +
                createInput('Data Scadenza', 'edit-future-due-date', 'date', formatDate(item.dueDate));
            break;
    }

    editModalTitle.textContent = title;
    editModalFormContainer.innerHTML = formHtml;
    editModalActions.innerHTML = `<button id="cancel-edit-btn" class="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">Annulla</button>
                              <button id="save-changes-btn" data-id="${id}" data-type="${type}" class="bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600">Salva Modifiche</button>`;

    editModal.classList.remove('hidden');
};

const closeEditModal = () => {
    editModal.classList.add('hidden');
    editModalFormContainer.innerHTML = '';
    editModalActions.innerHTML = '';
};

// --- Event Listeners ---
if (monthFilter) monthFilter.addEventListener('change', updateDashboardView);

if (addMemberBtn) addMemberBtn.addEventListener('click', () => {
    const name = newMemberNameInput.value.trim();
    if (name && !members.includes(name)) {
        members.push(name);
        newMemberNameInput.value = '';
        saveDataToFirebase();
    }
});

if (addCashMovementBtn) addCashMovementBtn.addEventListener('click', () => {
    const type = cashMovementTypeSelect.value;
    const amount = parseFloat(cashMovementAmountInput.value);
    const date = cashMovementDateInput.value;
    const description = cashMovementDescriptionInput.value.trim();
    const member = cashMovementMemberSelect.value;

    if(isNaN(amount) || amount <= 0 || !description || !date){
        alert("Per favore, inserisci data, importo e descrizione validi.");
        return;
    }

    const newMovement = {
        date, type, amount, description, member,
        createdBy: currentUser.uid,
        requesterEmail: currentUser.email
    };

    if (currentUser.role === 'admin') {
        if(type === 'withdrawal' && amount > cassaComune.balance) {
            alert("Fondi insufficienti nella cassa comune per questo prelievo.");
            return;
        }
        if (type === 'deposit') cassaComune.balance += amount;
        else cassaComune.balance -= amount;
        
        if (!cassaComune.movements) cassaComune.movements = [];
        cassaComune.movements.push(newMovement);
        saveDataToFirebase();
        alert('Movimento di cassa aggiunto con successo.');
    } else {
        const pendingRef = ref(database, 'pendingCashMovements');
        const newPendingRef = push(pendingRef);
        set(newPendingRef, newMovement);
        alert('Richiesta di movimento cassa inviata per approvazione!');
    }

    cashMovementAmountInput.value = '';
    cashMovementDateInput.value = '';
    cashMovementDescriptionInput.value = '';
    cashMovementMemberSelect.value = '';
});

if (addPendingPaymentBtn) addPendingPaymentBtn.addEventListener('click', () => {
    const member = pendingPaymentMemberSelect.value;
    const amount = parseFloat(pendingPaymentAmountInput.value);
    const description = pendingPaymentDescriptionInput.value.trim();
    if (!member || isNaN(amount) || amount <= 0 || !description) {
        alert("Per favore, compila tutti i campi.");
        return;
    }
    pendingPayments.push({
        id: Date.now().toString(),
        member,
        amount,
        description,
        dateAdded: Date.now()
    });
    [pendingPaymentAmountInput, pendingPaymentDescriptionInput].forEach(i => i.value = '');
    saveDataToFirebase();
});

if (addFutureMovementBtn) addFutureMovementBtn.addEventListener('click', () => {
    const description = futureMovementDescriptionInput.value.trim();
    const totalCost = parseFloat(futureMovementCostInput.value);
    const dueDate = futureMovementDueDateInput.value;
    if (!description || isNaN(totalCost) || totalCost <= 0 || !dueDate) {
        alert('Per favore, compila tutti i campi del movimento futuro.');
        return;
    }
    const share = members.length > 0 ? totalCost / members.length : 0;
    const shares = members.map(member => ({ member, amount: share, edited: false, paid: false }));
    futureMovements.push({
        id: Date.now().toString(),
        description, totalCost, dueDate, shares
    });
    [futureMovementDescriptionInput, futureMovementCostInput, futureMovementDueDateInput].forEach(i => i.value = '');
    saveDataToFirebase();
});

if (addWishlistLinkBtn) addWishlistLinkBtn.addEventListener('click', () => {
    const link = wishlistNewLinkInput.value.trim();
    if (link) {
        tempWishlistLinks.push(link);
        wishlistNewLinkInput.value = '';
        renderTempWishlistLinks();
    }
});

if (wishlistLinksContainer) wishlistLinksContainer.addEventListener('click', (e) => {
    if (e.target.matches('.remove-temp-link-btn')) {
        const index = parseInt(e.target.dataset.index);
        tempWishlistLinks.splice(index, 1);
        renderTempWishlistLinks();
    }
});

const renderTempWishlistLinks = () => {
     if (!wishlistLinksContainer) return;
     wishlistLinksContainer.innerHTML = tempWishlistLinks.map((link, index) => `
        <div class="flex items-center justify-between bg-gray-100 p-1 rounded-md">
            <a href="${link.startsWith('http') ? link : 'https://' + link}" target="_blank" class="truncate hover:underline">${link}</a>
            <button data-index="${index}" class="remove-temp-link-btn text-red-500 font-bold ml-2">&times;</button>
        </div>
    `).join('');
}

if (addWishlistItemBtn) addWishlistItemBtn.addEventListener('click', () => {
    const name = wishlistItemNameInput.value.trim();
    const cost = parseFloat(wishlistItemCostInput.value);
    const priority = wishlistItemPriorityInput.value;
    if (!name || isNaN(cost) || cost <= 0) {
        alert('Per favor, inserisci un nome e un costo validi per l\'articolo.');
        return;
    }
    wishlist.push({ id: Date.now().toString(), name, cost, links: tempWishlistLinks, priority });
    [wishlistItemNameInput, wishlistItemCostInput].forEach(i => i.value = '');
    wishlistItemPriorityInput.value = '2-Media';
    tempWishlistLinks = [];
    renderTempWishlistLinks();
    saveDataToFirebase();
});

if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => {
    const date = incomeDateInput.value;
    const amount = parseFloat(incomeAmountInput.value);
    const description = incomeDescriptionInput.value.trim();
    const membersInvolved = Array.from(incomeMembersCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);
    if (isNaN(amount) || amount <= 0 || !description || membersInvolved.length === 0) {
        alert('Per favore, compila tutti i campi dell\'entrata e seleziona almeno un membro.');
        return;
    }
    
    const newIncome = {
        date: date || new Date().toISOString().split('T')[0],
        amount, description, membersInvolved,
        createdBy: currentUser.uid,
        requesterEmail: currentUser.email
    };

    if (currentUser.role === 'admin') {
        incomeEntries.push(newIncome);
        saveDataToFirebase();
        alert('Entrata aggiunta con successo.');
    } else {
        const pendingRef = ref(database, 'pendingIncomeEntries');
        const newPendingRef = push(pendingRef);
        set(newPendingRef, newIncome);
        alert('Richiesta di entrata inviata per approvazione!');
    }
    
    [incomeDateInput, incomeAmountInput, incomeDescriptionInput].forEach(i => i.value = '');
    incomeMembersCheckboxes.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
});

if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => {
    const payer = payerSelect.value;
    const date = expenseDateInput.value;
    const amount = parseFloat(amountInput.value);
    const description = descriptionInput.value.trim();
    const category = categoryInput.value.trim();
    if (!payer || !date || isNaN(amount) || amount <= 0 || !description || !category) {
        alert('Per favore, compila tutti i campi della spesa.');
        return;
    }

    const newExpense = {
        date, payer, amount, description, category,
        createdBy: currentUser.uid,
        requesterEmail: currentUser.email
    };

    if (currentUser.role === 'admin') {
        if (payer === 'Cassa Comune' && amount > cassaComune.balance) {
            alert('Fondi insufficienti nella cassa comune per questa spesa.');
            return;
        }
        variableExpenses.push(newExpense);
        if (payer === 'Cassa Comune') {
            cassaComune.balance -= amount;
             if (!cassaComune.movements) cassaComune.movements = [];
            cassaComune.movements.push({
                id: Date.now().toString(),
                date: date,
                type: 'withdrawal', amount, description: `Spesa: ${description}`, member: ''
            });
        }
        saveDataToFirebase();
        alert('Spesa aggiunta con successo.');
    } else {
        const pendingRef = ref(database, 'pendingVariableExpenses');
        const newPendingRef = push(pendingRef);
        set(newPendingRef, newExpense);
        alert('Richiesta di spesa inviata per approvazione!');
    }

    [expenseDateInput, amountInput, descriptionInput, categoryInput].forEach(i => i.value = '');
});

if (addFixedExpenseBtn) addFixedExpenseBtn.addEventListener('click', () => {
    const description = fixedDescInput.value.trim();
    const amount = parseFloat(fixedAmountInput.value);
    if (!description || isNaN(amount) || amount <= 0) {
        alert('Inserisci una descrizione e un importo validi per la spesa fissa.');
        return;
    }
    fixedExpenses.push({ id: Date.now().toString(), description, amount });
    fixedDescInput.value = '';
    fixedAmountInput.value = '';
    saveDataToFirebase();
});

if (quickActionsContainer) quickActionsContainer.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('.action-btn');
    if (!actionBtn) return;
    const formId = actionBtn.dataset.formId;
    const targetPanel = document.getElementById(formId);
    if (actionBtn.classList.contains('active')) {
        actionBtn.classList.remove('active');
        if (targetPanel) targetPanel.classList.add('hidden');
        return;
    }
    quickActionsContainer.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
    actionForms.forEach(panel => panel.classList.add('hidden'));
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
        actionBtn.classList.add('active');
        targetPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

if (document.body) {
    document.body.addEventListener('change', (e) => {
        if (e.target.matches('.share-input')) {
            const movementId = e.target.dataset.movementId;
            const memberName = e.target.dataset.memberName;
            const newAmount = parseFloat(e.target.value);
            const movement = futureMovements.find(m => m.id === movementId);
            if (!movement || isNaN(newAmount)) return;
            const editedMemberShare = (movement.shares || []).find(s => s.member === memberName);
            if(editedMemberShare) {
                editedMemberShare.amount = newAmount;
                editedMemberShare.edited = true;
            }
            renderFutureMovements();
        }
        if (e.target.matches('.paid-checkbox')) {
            const movementId = e.target.dataset.movementId;
            const memberName = e.target.dataset.memberName;
            const isChecked = e.target.checked;
            const movement = futureMovements.find(m => m.id === movementId);
            if (movement) {
                const share = (movement.shares || []).find(s => s.member === memberName);
                if (share) {
                    share.paid = isChecked;
                    saveDataToFirebase();
                    renderFutureMovements();
                }
            }
        }
    });

    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.matches('.close-form-btn')) {
            const formPanel = target.closest('.action-form');
            if(formPanel) {
                formPanel.classList.add('hidden');
                quickActionsContainer.querySelectorAll('.action-btn').forEach(btn => btn.classList.remove('active'));
            }
        }
        
        if (target.matches('.edit-btn')) {
            openEditModal(target.dataset.id, target.dataset.type);
        }

        if (target.matches('.recalculate-shares-btn')) {
            const movementId = target.dataset.id;
            const movement = futureMovements.find(m => m.id === movementId);
            if (!movement) return;
            const editedShares = (movement.shares || []).filter(s => s.edited);
            const uneditedShares = (movement.shares || []).filter(s => !s.edited);
            const sumOfEdited = editedShares.reduce((sum, s) => sum + s.amount, 0);
            const remainingAmount = movement.totalCost - sumOfEdited;
            if (uneditedShares.length > 0) {
                const newShareAmount = remainingAmount / uneditedShares.length;
                uneditedShares.forEach(s => s.amount = newShareAmount);
            } else if (Math.abs(movement.totalCost - sumOfEdited) > 0.01) {
                alert('Tutte le quote sono state modificate manualmente, ma la somma non corrisponde al totale. Per favore, correggi i valori.');
            }
            saveDataToFirebase();
        }

        if (target.matches('.reset-share-btn')) {
            const movementId = target.dataset.movementId;
            const memberName = target.dataset.memberName;
            const movement = futureMovements.find(m => m.id === movementId);
            if (movement) {
                const shareToReset = (movement.shares || []).find(s => s.member === memberName);
                if(shareToReset) shareToReset.edited = false;
                target.closest('.fade-in').querySelector('.recalculate-shares-btn').click();
            }
        }

        if (target.matches('.remove-member-btn')) {
            const index = parseInt(target.dataset.index);
            const memberName = members[index];
            if (confirm(`Sei sicuro di voler rimuovere ${memberName}? Verranno rimosse anche tutte le sue spese, entrate e pagamenti in sospeso.`)) {
                members.splice(index, 1);
                variableExpenses = variableExpenses.filter(exp => exp.payer !== memberName);
                incomeEntries.forEach(inc => {
                    inc.membersInvolved = (inc.membersInvolved || []).filter(m => m !== memberName);
                });
                incomeEntries = incomeEntries.filter(inc => (inc.membersInvolved || []).length > 0);
                pendingPayments = pendingPayments.filter(p => p.member !== memberName);
                cassaComune.movements = (cassaComune.movements || []).filter(m => m.member !== memberName);
                saveDataToFirebase();
            }
        }

        if (target.matches('.remove-expense-btn')) {
             const expenseId = target.dataset.id;
            const expenseToRemove = variableExpenses.find(exp => exp.id === expenseId);
            if (expenseToRemove && expenseToRemove.payer === 'Cassa Comune') {
                if(confirm("Questa spesa è stata pagata dalla cassa comune. Vuoi rimborsare la cassa?")) {
                    cassaComune.balance += expenseToRemove.amount;
                }
            }
            variableExpenses = variableExpenses.filter(exp => exp.id !== expenseId);
            saveDataToFirebase();
        }

        if (target.matches('.remove-income-btn')) {
            incomeEntries = incomeEntries.filter(inc => inc.id !== target.dataset.id);
            saveDataToFirebase();
        }

        if (target.matches('.remove-fixed-expense-btn')) {
            fixedExpenses = fixedExpenses.filter(exp => exp.id !== target.dataset.id);
            saveDataToFirebase();
        }

        if (target.matches('.remove-wishlist-item-btn')) {
            wishlist = wishlist.filter(item => item.id !== target.dataset.id);
            saveDataToFirebase();
        }

        if (target.matches('.remove-pending-payment-btn')) {
            if(confirm("Sei sicuro di voler rimuovere questa richiesta di quota?")) {
               pendingPayments = pendingPayments.filter(p => p.id !== target.dataset.id);
               saveDataToFirebase();
            }
        }

        if (target.matches('.remove-cash-movement-btn')) {
            const movementId = target.dataset.id;
            const movementIndex = (cassaComune.movements || []).findIndex(m => m.id === movementId);
            if (movementIndex > -1) {
                if (confirm("Sei sicuro di voler annullare questo movimento? L'azione è irreversibile e modificherà il saldo della cassa.")) {
                    const movement = cassaComune.movements[movementIndex];
                    if (movement.type === 'deposit') {
                        cassaComune.balance -= movement.amount;
                    } else {
                        cassaComune.balance += movement.amount;
                    }
                    cassaComune.movements.splice(movementIndex, 1);
                    saveDataToFirebase();
                }
            }
        }

        if (target.matches('.confirm-pending-payment-btn')) {
            const paymentId = target.dataset.id;
            const payment = pendingPayments.find(p => p.id === paymentId);
            if (payment) {
                const isForCash = confirm(`Il pagamento di ${payment.member} per €${payment.amount} è un versamento nella Cassa Comune?`);
                if (isForCash) {
                     cassaComune.balance += payment.amount;
                     if (!cassaComune.movements) cassaComune.movements = [];
                     cassaComune.movements.push({
                        id: Date.now().toString(),
                        date: new Date().toISOString().split('T')[0],
                        type: 'deposit', 
                        amount: payment.amount, 
                        description: `Versamento quota: ${payment.description}`, 
                        member: payment.member
                    });
                } else {
                    variableExpenses.push({
                        id: Date.now().toString(),
                        date: new Date().toISOString().split('T')[0],
                        payer: payment.member,
                        amount: payment.amount,
                        description: `[Pagamento Salato] ${payment.description}`,
                        category: "Saldo Personale"
                    });
                }
                pendingPayments = pendingPayments.filter(p => p.id !== paymentId);
                saveDataToFirebase();
                alert(`Pagamento di ${payment.member} per €${payment.amount} registrato!`);
            }
        }

        if (target.matches('.mark-purchased-btn')) {
            const itemId = target.dataset.id;
            const item = wishlist.find(i => i.id === itemId);
            if (item) {
                descriptionInput.value = item.name;
                amountInput.value = item.cost;
                categoryInput.value = "Attrezzatura";
                wishlist = wishlist.filter(i => i.id !== itemId);
                saveDataToFirebase();
                
                const expenseFormBtn = quickActionsContainer.querySelector('[data-form-id="expense-form-section"]');
                if (expenseFormBtn) expenseFormBtn.click();
                
                alert(`"${item.name}" spostato nelle spese. Seleziona chi ha pagato e conferma.`);
            }
        }

        if (target.matches('.manage-shares-btn')) {
            const movementId = target.dataset.id;
            const movement = futureMovements.find(m => m.id === movementId);
            if (movement) {
                movement.isExpanded = !movement.isExpanded;
                renderFutureMovements();
            }
        }

        if (target.matches('.remove-future-movement-btn')) {
            futureMovements = futureMovements.filter(m => m.id !== target.dataset.id);
            saveDataToFirebase();
        }

        if (target.matches('.confirm-payment-btn')) {
            const movementId = target.dataset.id;
            const movement = futureMovements.find(m => m.id === movementId);
            if (movement) {
                 if (movement.totalCost > cassaComune.balance) {
                    alert("Fondi insufficienti nella cassa comune per confermare questa spesa futura.");
                    return;
                }
                
                variableExpenses.push({
                    id: Date.now().toString(),
                    date: movement.dueDate,
                    payer: 'Cassa Comune',
                    amount: movement.totalCost,
                    description: movement.description,
                    category: "Spesa Pianificata"
                });
                
                cassaComune.balance -= movement.totalCost;
                if (!cassaComune.movements) cassaComune.movements = [];
                cassaComune.movements.push({
                    id: Date.now().toString(),
                    date: movement.dueDate,
                    type: 'withdrawal', 
                    amount: movement.totalCost, 
                    description: `Spesa pianificata: ${movement.description}`, 
                    member: ''
                });
                
                futureMovements = futureMovements.filter(m => m.id !== movementId);
                saveDataToFirebase();
                alert("Pagamento confermato e spesa registrata a carico della cassa comune!");
            }
        }
    });
}

if (editModal) editModal.addEventListener('click', (e) => {
    if (e.target.matches('#save-changes-btn')) {
        const id = e.target.dataset.id;
        const type = e.target.dataset.type;
        const item = getItemFromStore(type, id);
        if (!item) return;

        switch (type) {
            case 'cashMovement':
                const originalAmount = item.amount;
                const originalType = item.type;
                const newAmount = parseFloat(document.getElementById('edit-cash-amount').value);
                const newType = document.getElementById('edit-cash-type').value;

                if (originalType === 'deposit') { cassaComune.balance -= originalAmount; } 
                else { cassaComune.balance += originalAmount; }
                
                if (newType === 'deposit') { cassaComune.balance += newAmount; } 
                else { cassaComune.balance -= newAmount; }

                item.type = newType;
                item.member = document.getElementById('edit-cash-member').value;
                item.date = document.getElementById('edit-cash-date').value;
                item.amount = newAmount;
                item.description = document.getElementById('edit-cash-description').value;
                break;
            case 'variableExpense':
                const oldPayer = item.payer;
                const oldAmount = item.amount;
                item.payer = document.getElementById('edit-payer').value;
                item.date = document.getElementById('edit-expense-date').value;
                item.amount = parseFloat(document.getElementById('edit-amount').value);
                item.category = document.getElementById('edit-category').value;
                item.description = document.getElementById('edit-description').value;
                if (oldPayer === 'Cassa Comune' && item.payer !== 'Cassa Comune') {
                    cassaComune.balance += oldAmount;
                } else if (oldPayer !== 'Cassa Comune' && item.payer === 'Cassa Comune') {
                    cassaComune.balance -= item.amount;
                } else if (oldPayer === 'Cassa Comune' && item.payer === 'Cassa Comune') {
                    cassaComune.balance += (oldAmount - item.amount);
                }
                break;
            case 'fixedExpense':
                item.description = document.getElementById('edit-fixed-desc').value;
                item.amount = parseFloat(document.getElementById('edit-fixed-amount').value);
                break;
            case 'incomeEntry':
                item.date = document.getElementById('edit-income-date').value;
                item.amount = parseFloat(document.getElementById('edit-income-amount').value);
                item.description = document.getElementById('edit-income-description').value;
                item.membersInvolved = Array.from(document.querySelectorAll('#edit-income-members-checkboxes input:checked')).map(cb => cb.value);
                break;
            case 'pendingPayment':
                item.member = document.getElementById('edit-pending-member').value;
                item.amount = parseFloat(document.getElementById('edit-pending-amount').value);
                item.description = document.getElementById('edit-pending-description').value;
                break;
            case 'wishlistItem':
                item.name = document.getElementById('edit-wishlist-name').value;
                item.cost = parseFloat(document.getElementById('edit-wishlist-cost').value);
                item.priority = document.getElementById('edit-wishlist-priority').value;
                item.links = Array.from(document.querySelectorAll('#edit-wishlist-links-container input')).map(input => input.value.trim()).filter(link => link);
                break;
            case 'futureMovement':
                const oldTotalCost = item.totalCost;
                item.description = document.getElementById('edit-future-desc').value;
                item.totalCost = parseFloat(document.getElementById('edit-future-cost').value);
                item.dueDate = document.getElementById('edit-future-due-date').value;
                if (item.totalCost !== oldTotalCost && confirm("Il costo totale è cambiato. Vuoi resettare le quote individuali per distribuirle equamente?")) {
                    const share = members.length > 0 ? item.totalCost / members.length : 0;
                    item.shares = members.map(member => ({ member, amount: share, edited: false, paid: false }));
                }
                break;
        }
        closeEditModal();
        saveDataToFirebase();
    }
    
    if (e.target.matches('#add-edit-link-btn')) {
        const container = document.getElementById('edit-wishlist-links-container');
        const input = document.getElementById('add-edit-link-input');
        if (input.value.trim()) {
             const div = document.createElement('div');
             div.className = 'flex items-center gap-2';
             div.innerHTML = `<input type="text" class="w-full p-1 border rounded-md" value="${input.value.trim()}"><button type="button" class="remove-edit-link-btn text-red-500">&times;</button>`;
             container.appendChild(div);
             input.value = '';
        }
    }

    if (e.target.matches('.remove-edit-link-btn')) {
        e.target.parentElement.remove();
    }

    if (e.target === editModal || e.target.matches('#close-edit-modal-btn') || e.target.matches('#cancel-edit-btn')) {
        closeEditModal();
    }
});

if (calculateBtn) calculateBtn.addEventListener('click', () => calculateAndRenderSettlement(false));
if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);
if (exportDataBtn) exportDataBtn.addEventListener('click', handleExportData);
if (importDataBtn) importDataBtn.addEventListener('click', () => importFileInput.click());
if (importFileInput) importFileInput.addEventListener('change', handleImportData);

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Controlla su quale pagina ci si trova per inizializzare solo il codice necessario
    if (document.getElementById('calendar-container')) {
        // La logica per il calendario è in js/calendario.js
    } else if (document.getElementById('kanban-board')) {
        // La logica per le attività è in js/attivita.js
    } else if (document.getElementById('member-count')) {
        // Siamo nella dashboard finanziaria
        initializeCharts();
        loadDataFromFirebase();
    }
});
