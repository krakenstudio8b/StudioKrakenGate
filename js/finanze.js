// js/finanze.js (VERSIONE CORRETTA - Filtra user_base)

import { database } from './firebase-config.js';
import { ref, set, onValue, push, update, remove, get } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';
import { logAudit } from './audit.js';


// --- Riferimenti ai nodi del tuo database ---
const membersRef = ref(database, 'members');
const usersRef = ref(database, 'users'); // <-- AGGIUNTO RIFERIMENTO AI RUOLI
const varExpensesRef = ref(database, 'variableExpenses');
const fixedExpensesRef = ref(database, 'fixedExpenses');
const incomeRef = ref(database, 'incomeEntries');
const wishlistRef = ref(database, 'wishlist');
const futureMovementsRef = ref(database, 'futureMovements');
const pendingPaymentsRef = ref(database, 'pendingPayments');
const cassaComuneRef = ref(database, 'cassaComune');
const expenseRequestsRef = ref(database, 'expenseRequests');


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
    const date = new Date(dateString + 'T12:00:00Z'); // Evita problemi timezone
    return date.toLocaleDateString('it-IT');
};

const getItemFromStore = (type, id) => {
    if (type === 'cashMovement') {
        const movements = cassaComune.movements ? Object.values(cassaComune.movements) : [];
        return movements.find(m => m.id === id) || null;
    }
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
    // Gli altri nodi sono aggiornati con 'update' 'push' ecc.
}

// ==========================================================
// --- FUNZIONE loadDataFromFirebase (MODIFICATA) ---
// ==========================================================
async function loadDataFromFirebase() {
    
    let allUsersData = {};
    try {
        // 1. Prima, carichiamo TUTTI i ruoli utente una sola volta
        const usersSnap = await get(usersRef);
        allUsersData = usersSnap.val() || {};
    } catch (error) {
        console.error("Errore critico: impossibile caricare i ruoli utente.", error);
        alert("Errore nel caricamento dei permessi utente. La pagina potrebbe non funzionare.");
        return; // Blocca il caricamento
    }

    // 2. Ora impostiamo il listener per i membri
    onValue(membersRef, (snapshot) => {
        const membersObject = snapshot.val() || {};
        
        // 3. Trasformiamo l'oggetto in array E FILTRIAMO via i user_base
        members = Object.entries(membersObject)
            .map(([uid, memberData]) => {
                // Troviamo il ruolo dell'utente, se non c'è, è 'user_base'
                const role = allUsersData[uid]?.role || 'user_base';
                return {
                    id: uid,
                    name: memberData.name,
                    cleaningCount: memberData.cleaningCount,
                    role: role // Aggiungiamo il ruolo all'oggetto
                };
            })
            .filter(member => member.role !== 'user_base'); // <-- LA CORREZIONE CHIAVE È QUI

        // 4. Ora tutto il resto funziona con la lista 'members' filtrata
        renderMembers();
        toggleSectionsVisibility();
        updateDashboardView();
    });
    
    // ==========================================================
    // --- IL RESTO DELLA FUNZIONE È IDENTICO ---
    // ==========================================================

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
// --- FINE FUNZIONE MODIFICATA ---
// ==========================================================


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
            // Mostra admin-requests solo se sei admin E ci sono membri
            if(currentUser.role === 'admin' && hasMembers){ 
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        } else if(section) {
            // Nasconde le altre sezioni se non ci sono membri (filtrati)
            section.classList.toggle('hidden', !hasMembers);
        }
    });
};

const populateMonthFilter = () => { 
    const monthFilter = document.getElementById('month-filter');
    if (!monthFilter) return;

    const allDates = [...variableExpenses, ...incomeEntries].map(item => new Date(item.date)).filter(d => !isNaN(d));
    const uniqueMonths = new Set(allDates.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`));
    
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
    
    monthFilter.value = selectedValue;
};


const renderMembers = () => {
    // Questa funzione ora usa la lista 'members' GIA FILTRATA
    if (memberCountEl) memberCountEl.textContent = members.length;
    const membersListEl = document.getElementById('members-list');
    if (membersListEl) {
        membersListEl.innerHTML = members.map(m => `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-sm">${m.name}</li>`).join('');
    }

    // Sostituisce il form "Aggiungi membro" deprecato con link al pannello admin (solo per admin)
    const addMemberContainer = document.getElementById('new-member-name')?.closest('div.flex');
    if (addMemberContainer) {
        if (currentUser.role === 'admin') {
            addMemberContainer.innerHTML = `<a href="admin.html" class="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm"><span>→</span> Gestisci i membri dal Pannello Admin</a>`;
        } else {
            addMemberContainer.classList.add('hidden');
        }
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
        incomeMembersCheckboxes.innerHTML = members.map(m => `<div class="flex items-center"><input type="checkbox" id="income-member-${m.id}" name="income-member" value="${m.name}" class="form-checkbox h-4 w-4 text-indigo-600"><label for="income-member-${m.id}" class="ml-2 text-sm">${m.name}</label></div>`).join('') + `<div class="flex items-center border-t pt-2 mt-1"><input type="checkbox" id="income-member-evento-esterno" name="income-member" value="EVENTO ESTERNO" class="form-checkbox h-4 w-4 text-teal-600"><label for="income-member-evento-esterno" class="ml-2 text-sm font-medium text-teal-700">EVENTO ESTERNO</label></div>`;
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
                        <span class="text-xs text-gray-400">${displayDate(m.date)}</span>
                        <span class="font-bold block">${m.type === 'deposit' ? '+' : '-'}€${(m.amount || 0).toFixed(2)}</span>
                    </div>
                    ${(currentUser.role === 'admin' || currentUser.role === 'admin_base') ? adminButtons : ''}
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
            <div>
                <span class="text-sm font-medium">${p.member} deve pagare ${p.description}</span>
                ${p.date ? `<span class="text-xs text-gray-400 block">Registrato il ${displayDate(p.date)}</span>` : ''}
            </div>
            <span class="font-bold text-yellow-700">€${(parseFloat(p.amount) || 0).toFixed(2)}</span>
            <button data-id="${p.id}" data-type="pendingPayment" class="complete-pending-btn text-sm bg-yellow-600 text-white py-1 px-3 rounded-lg hover:bg-yellow-700">Completa</button>
        </div>
    `).join('') || '<p class="text-gray-500">Nessun pagamento in sospeso.</p>';
};

const renderFutureMovements = () => {
    const container = document.getElementById('future-movements-container');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sorted = [...(futureMovements || [])].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    container.innerHTML = sorted.map(m => {
        const sharesEntries = m.shares ? Object.entries(m.shares) : [];
        const allPaid = sharesEntries.length > 0 && sharesEntries.every(([, s]) => s.paid);
        const dueDate = m.dueDate ? new Date(m.dueDate + 'T12:00:00Z') : null;
        const daysUntilDue = dueDate ? Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)) : null;

        let borderColor = 'border-blue-500';
        let bgColor = 'bg-blue-50';
        let textColor = 'text-blue-700';
        let urgencyBadge = '';

        if (allPaid) {
            borderColor = 'border-green-500'; bgColor = 'bg-green-50'; textColor = 'text-green-700';
            urgencyBadge = '<span class="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full ml-2">✓ Completo</span>';
        } else if (daysUntilDue !== null && daysUntilDue < 0) {
            borderColor = 'border-red-500'; bgColor = 'bg-red-50'; textColor = 'text-red-700';
            urgencyBadge = '<span class="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full ml-2">Scaduto</span>';
        } else if (daysUntilDue !== null && daysUntilDue <= 7) {
            borderColor = 'border-amber-500'; bgColor = 'bg-amber-50'; textColor = 'text-amber-700';
            urgencyBadge = `<span class="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full ml-2">Tra ${daysUntilDue} giorni</span>`;
        }

        const sharesHtml = sharesEntries.length > 0
            ? sharesEntries.map(([shareKey, share]) => `
                <div class="flex justify-between items-center text-xs py-1">
                    <label for="share-${m.id}-${shareKey}" class="flex-grow cursor-pointer ${share.paid ? 'text-gray-400 line-through' : ''}">${share.member}</label>
                    <div class="flex items-center gap-2">
                        <span class="font-medium">€</span>
                        <input type="number" value="${(share.amount || 0).toFixed(2)}"
                               data-movement-id="${m.id}"
                               data-share-index="${shareKey}"
                               class="w-16 p-1 text-right border rounded-md future-share-amount">
                        <input type="checkbox" id="share-${m.id}-${shareKey}"
                               data-movement-id="${m.id}"
                               data-share-index="${shareKey}"
                               class="form-checkbox h-4 w-4 text-indigo-600 rounded cursor-pointer future-share-checkbox" ${share.paid ? 'checked' : ''}>
                    </div>
                </div>`).join('')
            : '<p class="text-xs text-gray-500">Nessuna suddivisione specificata.</p>';

        const sharesContainerHtml = `<div id="shares-${m.id}" class="mt-2 pt-2 border-t border-gray-200 space-y-1 ${m.isExpanded ? '' : 'hidden'}">${sharesHtml}</div>`;

        const adminButtonsHtml = (currentUser.role === 'admin' || currentUser.role === 'admin_base') ? `
            <div class="flex gap-2 mt-2 justify-end flex-wrap">
                <button data-id="${m.id}" class="convert-future-btn text-xs bg-indigo-500 text-white py-1 px-3 rounded-lg hover:bg-indigo-600">Converti in Spesa</button>
                <button data-id="${m.id}" data-type="futureMovement" class="open-edit-modal-btn text-xs text-indigo-600 hover:text-indigo-800">Modifica</button>
                <button data-id="${m.id}" data-type="futureMovement" class="delete-future-movement-btn text-xs text-red-600 hover:text-red-800">Elimina</button>
            </div>
        ` : '';

        return `
            <div class="${bgColor} p-3 rounded-lg border-l-4 ${borderColor} future-movement-card">
                <div class="flex justify-between items-center cursor-pointer" data-movement-id="${m.id}">
                    <div class="flex items-center flex-wrap">
                        <span class="text-sm font-medium">${m.description} (Scadenza: ${displayDate(m.dueDate)})</span>
                        ${urgencyBadge}
                    </div>
                    <span class="font-bold ${textColor}">€${(m.totalCost || 0).toFixed(2)}</span>
                </div>
                ${sharesContainerHtml}
                ${adminButtonsHtml}
            </div>`;
    }).join('') || '<p class="text-gray-500">Nessun movimento futuro pianificato.</p>';
};
const renderWishlist = () => {
    const container = document.getElementById('wishlist-container');
    if (!container) return;

    const sorted = [...(wishlist || [])].sort((a, b) => {
        if (a.purchased && !b.purchased) return 1;
        if (!a.purchased && b.purchased) return -1;
        return (b.priority || '').localeCompare(a.priority || '');
    });

    container.innerHTML = sorted.map(item => {
        const isPurchased = !!item.purchased;
        const borderColor = isPurchased ? 'border-gray-400' : 'border-indigo-500';
        const bgColor = isPurchased ? 'bg-gray-50' : 'bg-indigo-50';
        const nameClass = isPurchased ? 'text-sm font-medium line-through text-gray-400' : 'text-sm font-medium';
        const amountColor = isPurchased ? 'text-gray-400' : 'text-indigo-700';

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

        const purchasedBadge = isPurchased
            ? `<span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">✓ Acquistato${item.purchasedDate ? ' il ' + displayDate(item.purchasedDate) : ''}${item.purchasedPrice ? ' a €' + parseFloat(item.purchasedPrice).toFixed(2) : ''}</span>`
            : `<button data-id="${item.id}" class="mark-purchased-btn text-xs bg-green-500 text-white px-2 py-0.5 rounded-lg hover:bg-green-600">Segna Acquistato</button>`;

        return `
            <div class="${bgColor} p-3 rounded-lg border-l-4 ${borderColor}">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="${nameClass}">${item.name}</p>
                        <p class="text-xs text-gray-600">Priorità: ${item.priority || 'Non definita'}</p>
                        <div class="mt-1">${purchasedBadge}</div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-4">
                        <p class="font-bold ${amountColor}">€${(item.cost || 0).toFixed(2)}</p>
                        <button data-id="${item.id}" data-type="wishlistItem" class="open-edit-modal-btn text-xs text-indigo-600 hover:text-indigo-800 mt-1">Modifica</button>
                    </div>
                </div>
                ${linksHtml}
            </div>
        `;
    }).join('') || '<p class="text-gray-500">Nessun articolo nella lista desideri.</p>';
};

const renderIncomeEntries = () => {
    const container = document.getElementById('income-list-container');
    if (!container) return;
    container.innerHTML = [...incomeEntries].sort((a, b) => new Date(b.date) - new Date(a.date)).map(i => `
        <div class="flex justify-between items-center bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
            <div>
                <span class="font-medium">${i.description || ''}</span>
                <span class="text-xs text-gray-500 block">Ricevuto da: ${(i.membersInvolved || []).join(', ')} il ${displayDate(i.date)}</span>
            </div>
            <span class="font-bold text-green-700">€${(parseFloat(i.amount) || 0).toFixed(2)}</span>
            <button data-id="${i.id}" data-type="incomeEntry" class="open-edit-modal-btn text-green-600 hover:text-green-800">Modifica</button>
        </div>
    `).join('') || '<p class="text-gray-500">Nessuna entrata registrata.</p>';
};

const renderVariableExpenses = () => {
    const container = document.getElementById('expenses-list-container');
    if (!container) return;
    container.innerHTML = [...variableExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => `
        <div class="flex justify-between items-center bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
            <div>
                <span class="font-medium">${e.description || ''} - ${e.category || ''}</span>
                <span class="text-xs text-gray-500 block">Pagato da: ${e.payer || ''} il ${displayDate(e.date)}</span>
            </div>
            <span class="font-bold text-red-700">€${(parseFloat(e.amount) || 0).toFixed(2)}</span>
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
            <span class="font-bold text-orange-700">€${(parseFloat(f.amount) || 0).toFixed(2)}</span>
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
        // La lista 'members' globale è già filtrata, ma per questo ci serve
        // il nome dell'utente anche se è 'user_base'. 
        // Lo prendiamo da 'req.requesterName' che 'auth-guard' ha salvato.
        const requesterName = req.requesterName || 'N/D';
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
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null; // Esce se il canvas non esiste
    
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
    // Sicurezza: non fare nulla se Chart.js non è caricato
    if (typeof Chart === 'undefined') return; 
    
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
    
    // Grafico 2: Ripartizione Entrate (membri + Evento Esterno)
    const incomeLabelsAll = [...memberNames, 'EVENTO ESTERNO'];
    const incomeColorsAll = [...memberColors, 'rgba(20, 184, 166, 0.6)'];
    const incomeData = incomeLabelsAll.map(name => data.income.reduce((sum, i) => sum + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / (i.membersInvolved.length || 1)) : 0), 0));
    createBarChart('membersIncomeChart', 'Ripartizione Entrate', incomeData, incomeLabelsAll, incomeColorsAll);
    
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

            const incomeShare = data.income.reduce((sum, i) => sum + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / (i.membersInvolved.length || 1)) : 0), 0);
            
            return (totalContributed + incomeShare) - shareOfTotalExpense;
        });
        createBarChart('balancesChart', 'Bilanci (Netto)', balanceData, memberNames, balanceData.map(b => b >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'));
    }
};

const updateDashboardView = () => {
    const selectedMonth = document.getElementById('month-filter')?.value || 'all';
    const filterByMonth = (data) => {
        if (selectedMonth === 'all') return data;
        return data.filter(item => {
            const d = new Date(item.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
        });
    };

    const filteredVar = filterByMonth(variableExpenses);
    const filteredInc = filterByMonth(incomeEntries);
    const totalVar = filteredVar.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalFix = fixedExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalInc = filteredInc.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

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

    const totalExpenses = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalFixed = data.fixedExpenses.reduce((sum, f) => sum + (f.amount || 0), 0);
    const shareOfTotalExpense = (totalExpenses + totalFixed) / memberNames.length;

    memberNames.forEach(name => {
        const expensesPaid = data.expenses.filter(e => e.payer === name).reduce((sum, e) => sum + (e.amount || 0), 0);
        const cashDeposits = (cassaComune.movements ? Object.values(cassaComune.movements) : [])
            .filter(m => {
                if (m.member !== name || m.type !== 'deposit') return false;
                if (selectedMonth === 'all') return true;
                const mDate = new Date(m.date);
                return `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}` === selectedMonth;
            })
            .reduce((sum, m) => sum + (m.amount || 0), 0);
        const totalContributed = expensesPaid + cashDeposits;

        const incomeShare = data.income.reduce((sum, i) => sum + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / (i.membersInvolved.length || 1)) : 0), 0);

        balances[name] = (totalContributed + incomeShare) - shareOfTotalExpense;
    });

    const debtors = Object.entries(balances)
        .filter(([, amount]) => amount < -0.01)
        .map(([name, amount]) => ({ name, amountToPay: Math.abs(amount) }));

    const creditors = Object.entries(balances)
        .filter(([, amount]) => amount > 0.01)
        .map(([name, amount]) => ({ name, credit: amount }))
        .sort((a, b) => b.credit - a.credit);

    const totalToPay = debtors.reduce((sum, d) => sum + d.amountToPay, 0);
    const totalInCredit = creditors.reduce((sum, c) => sum + c.credit, 0);

    settlementList.innerHTML = '';

    if (debtors.length === 0 && creditors.length === 0) {
        settlementList.innerHTML = '<li class="text-green-500 font-semibold">Perfetto! Tutti i conti sono in pari.</li>';
    } else {
        if (creditors.length > 0) {
            const creditTitle = document.createElement('li');
            creditTitle.className = 'text-xs font-bold text-gray-500 uppercase tracking-wide mb-1';
            creditTitle.textContent = 'In credito:';
            settlementList.appendChild(creditTitle);
            creditors.forEach(creditor => {
                const li = document.createElement('li');
                li.className = 'text-gray-700 mb-1';
                li.innerHTML = `<span class="font-semibold text-green-600">${creditor.name}</span> ha un credito di <span class="font-bold text-lg text-green-600">€${creditor.credit.toFixed(2)}</span>`;
                settlementList.appendChild(li);
            });
        }

        if (debtors.length > 0) {
            const debitTitle = document.createElement('li');
            debitTitle.className = 'text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 mt-3';
            debitTitle.textContent = 'Da versare:';
            settlementList.appendChild(debitTitle);
            debtors.forEach(debtor => {
                const li = document.createElement('li');
                li.className = 'text-gray-700 mb-1';
                li.innerHTML = `<span class="font-semibold text-red-500">${debtor.name}</span> deve versare <span class="font-bold text-lg text-indigo-600">€${debtor.amountToPay.toFixed(2)}</span>`;
                settlementList.appendChild(li);
            });
        }

        if (debtors.length > 0) {
            const summaryLi = document.createElement('li');
            summaryLi.className = 'text-sm text-gray-500 mt-4 pt-2 border-t';
            summaryLi.innerHTML = `Totale da versare: €${totalToPay.toFixed(2)} → copre credito di €${totalInCredit.toFixed(2)}.`;
            settlementList.appendChild(summaryLi);
        }
    }
    
    if (forExport) {
        return debtors.map(d => ({ payer: d.name, recipient: 'Cassa', amount: d.amountToPay }));
    }
};

// --- Funzioni CRUD e di gestione form ---
const openEditModal = (id, type) => {
    const item = getItemFromStore(type, id);
    if (!item) return;

    const isProtectedType = ['variableExpense', 'incomeEntry', 'fixedExpense', 'cashMovement'].includes(type);
    if (currentUser.role !== 'admin' && currentUser.role !== 'admin_base' && isProtectedType) {
        return alert("Non hai i permessi per modificare questo elemento.");
    }
    
    const editModalTitle = document.getElementById('edit-modal-title');
    const editModalFormContainer = document.getElementById('edit-modal-form-container');
    const editModalActions = document.getElementById('edit-modal-actions');
    
    const typeTitles = {
        variableExpense: `Modifica Spesa: ${item.description || ''}`,
        fixedExpense: `Modifica Spesa Fissa: ${item.description || ''}`,
        incomeEntry: `Modifica Entrata: ${item.description || ''}`,
        cashMovement: `Modifica Movimento Cassa: ${item.description || ''}`,
        wishlistItem: `Modifica Wishlist: ${item.name || ''}`,
        futureMovement: `Modifica Movimento Futuro: ${item.description || ''}`,
        pendingPayment: `Modifica Pagamento: ${item.description || ''}`,
        member: `Modifica Membro: ${item.name || ''}`,
    };
    editModalTitle.textContent = typeTitles[type] || `Modifica: ${item.description || item.name || ''}`;
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
            
            <div>
                <label class="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" name="purchased" id="edit-purchased" class="form-checkbox h-4 w-4" ${item.purchased ? 'checked' : ''}>
                    Segnato come acquistato
                </label>
                <div id="purchased-fields" class="${item.purchased ? '' : 'hidden'} mt-2 space-y-2">
                    <div>
                        <label class="block text-xs text-gray-600">Data acquisto</label>
                        <input type="date" id="edit-purchasedDate" name="purchasedDate" value="${item.purchasedDate || ''}" class="w-full p-2 border rounded-lg mt-1">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600">Prezzo pagato (€)</label>
                        <input type="number" step="0.01" id="edit-purchasedPrice" name="purchasedPrice" value="${item.purchasedPrice || ''}" class="w-full p-2 border rounded-lg mt-1">
                    </div>
                </div>
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
    } else if (type === 'cashMovement') {
        formHtml += `
            <div>
                <label for="edit-type" class="block text-sm font-medium">Tipo Movimento</label>
                <select id="edit-type" name="type" class="w-full p-2 border rounded-lg mt-1 bg-white">
                    <option value="deposit" ${item.type === 'deposit' ? 'selected' : ''}>Deposito (+)</option>
                    <option value="withdrawal" ${item.type === 'withdrawal' ? 'selected' : ''}>Prelievo (-)</option>
                </select>
            </div>
            <div>
                <label for="edit-amount" class="block text-sm font-medium">Importo (€)</label>
                <input type="number" step="0.01" id="edit-amount" name="amount" value="${item.amount || 0}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-description" class="block text-sm font-medium">Descrizione</label>
                <input type="text" id="edit-description" name="description" value="${item.description || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-date" class="block text-sm font-medium">Data</label>
                <input type="date" id="edit-date" name="date" value="${item.date || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-member" class="block text-sm font-medium">Membro (opzionale)</label>
                <input type="text" id="edit-member" name="member" value="${item.member || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
        `;
    } else if (type === 'incomeEntry') {
        const memberCheckboxes = [...members.map(m => `
            <div class="flex items-center">
                <input type="checkbox" id="edit-income-member-${m.id}" name="income-member" value="${m.name}" class="form-checkbox h-4 w-4 text-indigo-600" ${(item.membersInvolved || []).includes(m.name) ? 'checked' : ''}>
                <label for="edit-income-member-${m.id}" class="ml-2 text-sm">${m.name}</label>
            </div>`),
            `<div class="flex items-center border-t pt-2 mt-1">
                <input type="checkbox" id="edit-income-member-evento-esterno" name="income-member" value="EVENTO ESTERNO" class="form-checkbox h-4 w-4 text-teal-600" ${(item.membersInvolved || []).includes('EVENTO ESTERNO') ? 'checked' : ''}>
                <label for="edit-income-member-evento-esterno" class="ml-2 text-sm font-medium text-teal-700">EVENTO ESTERNO</label>
            </div>`
        ].join('');
        formHtml += `
            <div>
                <label for="edit-description" class="block text-sm font-medium">Descrizione</label>
                <input type="text" id="edit-description" name="description" value="${item.description || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-amount" class="block text-sm font-medium">Importo (€)</label>
                <input type="number" step="0.01" id="edit-amount" name="amount" value="${item.amount || 0}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-date" class="block text-sm font-medium">Data</label>
                <input type="date" id="edit-date" name="date" value="${item.date || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Membri Coinvolti</label>
                <div id="edit-income-members" class="p-3 border rounded-lg space-y-2">${memberCheckboxes}</div>
            </div>
        `;
    } else if (type === 'variableExpense') {
        const memberOptions = members.map(m => `<option value="${m.name}" ${item.payer === m.name ? 'selected' : ''}>${m.name}</option>`).join('');
        const categoryOptions = ['Affitto','Bollette','Attrezzatura','Materiali','Manutenzione','Cibo e Bevande','Altro'].map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('');
        formHtml += `
            <div>
                <label for="edit-description" class="block text-sm font-medium">Descrizione</label>
                <input type="text" id="edit-description" name="description" value="${item.description || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-amount" class="block text-sm font-medium">Importo (€)</label>
                <input type="number" step="0.01" id="edit-amount" name="amount" value="${item.amount || 0}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-date" class="block text-sm font-medium">Data</label>
                <input type="date" id="edit-date" name="date" value="${item.date || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-payer" class="block text-sm font-medium">Pagato da</label>
                <select id="edit-payer" name="payer" class="w-full p-2 border rounded-lg mt-1 bg-white">
                    <option value="Cassa Comune" ${item.payer === 'Cassa Comune' ? 'selected' : ''}>Cassa Comune</option>
                    ${memberOptions}
                </select>
            </div>
            <div>
                <label for="edit-category" class="block text-sm font-medium">Categoria</label>
                <input type="text" id="edit-category" name="category" list="edit-category-list" value="${item.category || ''}" class="w-full p-2 border rounded-lg mt-1">
                <datalist id="edit-category-list">${categoryOptions}</datalist>
            </div>
        `;
    } else if (type === 'fixedExpense') {
        const categoryOptions = ['Affitto','Bollette','Attrezzatura','Materiali','Manutenzione','Cibo e Bevande','Altro'].map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('');
        formHtml += `
            <div>
                <label for="edit-description" class="block text-sm font-medium">Descrizione</label>
                <input type="text" id="edit-description" name="description" value="${item.description || ''}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-amount" class="block text-sm font-medium">Importo (€)</label>
                <input type="number" step="0.01" id="edit-amount" name="amount" value="${item.amount || 0}" class="w-full p-2 border rounded-lg mt-1">
            </div>
            <div>
                <label for="edit-category" class="block text-sm font-medium">Categoria</label>
                <input type="text" id="edit-category" name="category" list="edit-category-list-fixed" value="${item.category || ''}" class="w-full p-2 border rounded-lg mt-1">
                <datalist id="edit-category-list-fixed">${categoryOptions}</datalist>
            </div>
        `;
    } else {
        // Logica generica per gli altri tipi (member, pendingPayment, ecc.)
        const hiddenKeys = ['id', 'payerId', 'sourceExpenseId', 'sourceIncomeId'];
        const keyLabels = { name: 'Nome', amount: 'Importo (€)', date: 'Data', description: 'Descrizione', member: 'Membro', type: 'Tipo', dueDate: 'Data Scadenza', category: 'Categoria', payer: 'Pagato da' };
        formHtml += Object.entries(item).map(([key, value]) => {
            if (hiddenKeys.includes(key) || typeof value === 'object') return '';
            let inputType = 'text';
            if (typeof value === 'number') inputType = 'number';
            if (key.includes('date') || key.includes('dueDate')) inputType = 'date';
            const label = keyLabels[key] || key;
            return `<div><label for="edit-${key}" class="block text-sm font-medium">${label}</label><input type="${inputType}" id="edit-${key}" name="${key}" value="${value}" class="w-full p-2 border rounded-lg mt-1"></div>`;
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
    const purchasedCheckbox = document.getElementById('edit-purchased');
    if (purchasedCheckbox) {
        purchasedCheckbox.addEventListener('change', () => {
            const fields = document.getElementById('purchased-fields');
            if (fields) fields.classList.toggle('hidden', !purchasedCheckbox.checked);
        });
    }

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
            const updatedData = {};

            for (const [key, value] of formData.entries()) {
                const originalValue = item[key];
                updatedData[key] = (typeof originalValue === 'number' && !isNaN(originalValue)) ? parseFloat(value) : value;
            }

            if (type === 'incomeEntry') {
                updatedData.membersInvolved = Array.from(document.querySelectorAll('#edit-income-members input[name="income-member"]:checked')).map(cb => cb.value);
                if (updatedData.membersInvolved.length === 0) {
                    return alert("Seleziona almeno un membro coinvolto.");
                }
            }

            if (type === 'wishlistItem') {
                const linkInputs = document.querySelectorAll('.edit-link-input');
                updatedData.links = Array.from(linkInputs).map(input => input.value.trim()).filter(link => link);
                const purchasedEl = document.getElementById('edit-purchased');
                updatedData.purchased = purchasedEl ? purchasedEl.checked : (item.purchased || false);
                if (!updatedData.purchased) {
                    updatedData.purchasedDate = null;
                    updatedData.purchasedPrice = null;
                } else {
                    const pdEl = document.getElementById('edit-purchasedDate');
                    const ppEl = document.getElementById('edit-purchasedPrice');
                    updatedData.purchasedDate = pdEl ? pdEl.value : (item.purchasedDate || null);
                    updatedData.purchasedPrice = ppEl && ppEl.value ? parseFloat(ppEl.value) : (item.purchasedPrice || null);
                }
            }

            // --- VALIDAZIONE FONDI PRIMA DI SCRIVERE ---
            if (type === 'variableExpense') {
                const newPayer = updatedData.payer !== undefined ? updatedData.payer : item.payer;
                const newAmount = updatedData.amount !== undefined ? parseFloat(updatedData.amount) : (item.amount || 0);
                const oldWasCassa = item.payer === 'Cassa Comune';
                const newIsCassa = newPayer === 'Cassa Comune';
                if (newIsCassa) {
                    const balanceAfter = oldWasCassa
                        ? (cassaComune.balance || 0) - (newAmount - (item.amount || 0))
                        : (cassaComune.balance || 0) - newAmount;
                    if (balanceAfter < 0) {
                        return alert("Errore: Fondi insufficienti nella cassa comune per questa modifica.");
                    }
                }
            }

            // --- COSTRUZIONE AGGIORNAMENTI ATOMICI ---
            const allUpdates = {};
            let hasDirectDbRef = false;

            if (type === 'wishlistItem') {
                allUpdates[`wishlist/${item.id}`] = { ...item, ...updatedData };
                hasDirectDbRef = true;
            } else if (type === 'futureMovement') {
                allUpdates[`futureMovements/${item.id}`] = Object.assign({}, item, updatedData);
                hasDirectDbRef = true;
            } else if (type === 'fixedExpense') {
                allUpdates[`fixedExpenses/${item.id}`] = Object.assign({}, item, updatedData);
                hasDirectDbRef = true;
            } else if (type === 'incomeEntry') {
                allUpdates[`incomeEntries/${item.id}`] = Object.assign({}, item, updatedData);
                if (updatedData.amount !== undefined && updatedData.amount !== item.amount) {
                    const diff = (updatedData.amount || 0) - (item.amount || 0);
                    allUpdates[`cassaComune/balance`] = (cassaComune.balance || 0) + diff;
                    const movements = cassaComune.movements ? Object.entries(cassaComune.movements) : [];
                    const linked = movements.find(([, m]) => m.sourceIncomeId === item.id);
                    if (linked) allUpdates[`cassaComune/movements/${linked[0]}/amount`] = updatedData.amount;
                }
                hasDirectDbRef = true;
            } else if (type === 'cashMovement') {
                const newType = updatedData.type !== undefined ? updatedData.type : item.type;
                const newAmount = updatedData.amount !== undefined ? parseFloat(updatedData.amount) : (item.amount || 0);
                const oldImpact = item.type === 'deposit' ? (item.amount || 0) : -(item.amount || 0);
                const newImpact = newType === 'deposit' ? newAmount : -newAmount;
                const diff = newImpact - oldImpact;
                allUpdates[`cassaComune/movements/${item.id}`] = Object.assign({}, item, updatedData);
                if (Math.abs(diff) > 0.001) {
                    allUpdates[`cassaComune/balance`] = (cassaComune.balance || 0) + diff;
                }
                hasDirectDbRef = true;
            } else if (type === 'variableExpense') {
                const newPayer = updatedData.payer !== undefined ? updatedData.payer : item.payer;
                const newAmount = updatedData.amount !== undefined ? parseFloat(updatedData.amount) : (item.amount || 0);
                const oldWasCassa = item.payer === 'Cassa Comune';
                const newIsCassa = newPayer === 'Cassa Comune';
                const cassaMovements = cassaComune.movements ? Object.entries(cassaComune.movements) : [];
                const linkedMovement = cassaMovements.find(([, m]) => m.sourceExpenseId === item.id);

                if (oldWasCassa && newIsCassa) {
                    const diff = newAmount - (item.amount || 0);
                    if (Math.abs(diff) > 0.001) {
                        allUpdates[`cassaComune/balance`] = (cassaComune.balance || 0) - diff;
                        if (linkedMovement) allUpdates[`cassaComune/movements/${linkedMovement[0]}/amount`] = newAmount;
                    }
                    allUpdates[`variableExpenses/${item.id}`] = Object.assign({}, item, updatedData, { payerId: 'Cassa Comune' });
                } else if (oldWasCassa && !newIsCassa) {
                    allUpdates[`cassaComune/balance`] = (cassaComune.balance || 0) + (item.amount || 0);
                    if (linkedMovement) allUpdates[`cassaComune/movements/${linkedMovement[0]}`] = null;
                    const payerMember = members.find(m => m.name === newPayer);
                    allUpdates[`variableExpenses/${item.id}`] = Object.assign({}, item, updatedData, { payerId: payerMember?.id || newPayer });
                } else if (!oldWasCassa && newIsCassa) {
                    const newMovRef = push(ref(database, 'cassaComune/movements'));
                    allUpdates[`cassaComune/balance`] = (cassaComune.balance || 0) - newAmount;
                    allUpdates[`cassaComune/movements/${newMovRef.key}`] = {
                        id: newMovRef.key, type: 'withdrawal', amount: newAmount, member: 'Cassa',
                        date: updatedData.date || item.date,
                        description: `Spesa: ${updatedData.description || item.description}`,
                        sourceExpenseId: item.id
                    };
                    allUpdates[`variableExpenses/${item.id}`] = Object.assign({}, item, updatedData, { payerId: 'Cassa Comune' });
                } else {
                    const payerMember = members.find(m => m.name === newPayer);
                    allUpdates[`variableExpenses/${item.id}`] = Object.assign({}, item, updatedData, { payerId: payerMember?.id || newPayer });
                }
                hasDirectDbRef = true;
            }

            if (hasDirectDbRef) {
                update(ref(database), allUpdates);
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
                    const movements = cassaComune.movements ? Object.entries(cassaComune.movements) : [];
                    if (type === 'cashMovement') {
                        const newBalance = cassaComune.balance + (item.type === 'deposit' ? -item.amount : item.amount);
                        update(cassaComuneRef, { balance: newBalance });
                    } else if (type === 'incomeEntry') {
                        update(cassaComuneRef, { balance: (cassaComune.balance || 0) - (item.amount || 0) });
                        const linked = movements.find(([, m]) => m.sourceIncomeId === item.id);
                        if (linked) remove(ref(database, `cassaComune/movements/${linked[0]}`));
                    } else if (type === 'variableExpense' && item.payer === 'Cassa Comune') {
                        update(cassaComuneRef, { balance: (cassaComune.balance || 0) + (item.amount || 0) });
                        const linked = movements.find(([, m]) => m.sourceExpenseId === item.id);
                        if (linked) remove(ref(database, `cassaComune/movements/${linked[0]}`));
                    }
                    logAudit('item_deleted', {
                        type,
                        description: item.description || item.name || 'N/D',
                        amount: item.amount
                    });
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
    logAudit('cash_movement_added', { type: movementType, amount, description, member });

    alert(`Movimento di ${movementType} registrato. Nuovo saldo: €${newBalance.toFixed(2)}`);
    document.getElementById('cash-form-section').classList.add('hidden');
    document.getElementById('cash-movement-amount').value = '';
    document.getElementById('cash-movement-description').value = '';
    document.getElementById('cash-movement-date').value = '';
}

function handleExportData() { 
    // Ricostruisce l'oggetto dati per l'esportazione
    const dataToExport = {
        // Salva i membri come OGGETTO (la nuova struttura)
        members: members.reduce((acc, member) => {
            acc[member.id] = { name: member.name, cleaningCount: member.cleaningCount };
            return acc;
        }, {}),
        variableExpenses: variableExpenses.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}),
        fixedExpenses: fixedExpenses.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}),
        incomeEntries: incomeEntries.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}),
        wishlist: wishlist.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}),
        futureMovements: futureMovements.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}),
        pendingPayments: pendingPayments.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}),
        cassaComune: cassaComune,
        expenseRequests: expenseRequests
    };
    const dataStr = JSON.stringify(dataToExport, null, 4);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gateradio_finanze_backup_${new Date().toISOString().slice(0, 10)}.json`;
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
            
            // Prepara gli aggiornamenti
            const updates = {};
            // Assicura che i dati importati siano OGGETTI, non array
            updates['members'] = (Array.isArray(importedData.members) ? importedData.members.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}) : importedData.members) || {};
            updates['variableExpenses'] = (Array.isArray(importedData.variableExpenses) ? importedData.variableExpenses.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}) : importedData.variableExpenses) || {};
            updates['fixedExpenses'] = (Array.isArray(importedData.fixedExpenses) ? importedData.fixedExpenses.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}) : importedData.fixedExpenses) || {};
            updates['incomeEntries'] = (Array.isArray(importedData.incomeEntries) ? importedData.incomeEntries.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}) : importedData.incomeEntries) || {};
            updates['wishlist'] = (Array.isArray(importedData.wishlist) ? importedData.wishlist.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}) : importedData.wishlist) || {};
            updates['futureMovements'] = (Array.isArray(importedData.futureMovements) ? importedData.futureMovements.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}) : importedData.futureMovements) || {};
            updates['pendingPayments'] = (Array.isArray(importedData.pendingPayments) ? importedData.pendingPayments.reduce((acc, item) => { acc[item.id] = item; return acc; }, {}) : importedData.pendingPayments) || {};
            updates['cassaComune'] = importedData.cassaComune || { balance: 0, movements: {} };
            updates['expenseRequests'] = importedData.expenseRequests || {};
            
            // Usa update (non set) per non sovrascrivere nodi non inclusi (es. users, loginStats, pushSubscriptions)
            update(ref(database), updates);
            
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
    if (typeof ExcelJS === 'undefined') {
        alert("Libreria di esportazione Excel non caricata.");
        return;
    }

    // --- Calcolo saldi GLOBALI (tutti i mesi, indipendente dal filtro UI) ---
    const allExpenses = variableExpenses;
    const allIncome = incomeEntries;
    const allFixed = fixedExpenses;
    const memberNames = members.map(m => m.name);

    const totalVar = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalFix = allFixed.reduce((s, e) => s + (e.amount || 0), 0);
    const totalInc = allIncome.reduce((s, e) => s + (e.amount || 0), 0);
    const cassaBalance = cassaComune.balance || 0;

    // Saldi per membro (logica identica a calculateAndRenderSettlement ma su tutti i dati)
    const memberBalances = {};
    const shareOfTotal = memberNames.length > 0 ? (totalVar + totalFix) / memberNames.length : 0;
    memberNames.forEach(name => {
        const expensesPaid = allExpenses.filter(e => e.payer === name).reduce((s, e) => s + (e.amount || 0), 0);
        const cashDeposits = (cassaComune.movements ? Object.values(cassaComune.movements) : [])
            .filter(m => m.member === name && m.type === 'deposit')
            .reduce((s, m) => s + (m.amount || 0), 0);
        const incomeShare = allIncome.reduce((s, i) => s + (i.membersInvolved && i.membersInvolved.includes(name) ? ((i.amount || 0) / (i.membersInvolved.length || 1)) : 0), 0);
        memberBalances[name] = {
            expensesPaid,
            cashDeposits,
            incomeShare,
            shareOfTotal,
            net: (expensesPaid + cashDeposits + incomeShare) - shareOfTotal
        };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gateradio Gestionale';
    workbook.created = new Date();

    const styleHeader = (row) => {
        row.eachCell(cell => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
        });
    };

    // --- FOGLIO 1: Riepilogo Generale ---
    const summarySheet = workbook.addWorksheet('Riepilogo');
    summarySheet.columns = [{ width: 30 }, { width: 18 }];
    styleHeader(summarySheet.addRow(['Voce', 'Importo (€)']));
    summarySheet.addRow(['Totale Spese Fisse Mensili', totalFix]);
    summarySheet.addRow(['Totale Spese Variabili', totalVar]);
    summarySheet.addRow(['Totale Spese (Fisse + Variabili)', totalFix + totalVar]);
    summarySheet.addRow(['Totale Entrate', totalInc]);
    summarySheet.addRow(['Saldo Cassa Comune', cassaBalance]);
    summarySheet.addRow(['Saldo Netto (Entrate - Spese)', totalInc - (totalFix + totalVar)]);
    summarySheet.addRow(['Numero Membri', memberNames.length]);
    if (memberNames.length > 0) {
        summarySheet.addRow(['Quota Spese per Membro', (totalFix + totalVar) / memberNames.length]);
    }
    summarySheet.getColumn(2).numFmt = '€#,##0.00';

    // --- FOGLIO 2: Saldi per Membro ---
    const balanceSheet = workbook.addWorksheet('Saldi per Membro');
    balanceSheet.columns = [{ width: 20 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
    styleHeader(balanceSheet.addRow(['Membro', 'Spese Pagate', 'Depositi Cassa', 'Quota Entrate', 'Quota Spese Totali', 'Saldo Netto']));
    memberNames.forEach(name => {
        const b = memberBalances[name];
        const netRow = balanceSheet.addRow([name, b.expensesPaid, b.cashDeposits, b.incomeShare, b.shareOfTotal, b.net]);
        netRow.getCell(6).font = { bold: true, color: { argb: b.net >= 0 ? 'FF16A34A' : 'FFDC2626' } };
    });
    [2, 3, 4, 5, 6].forEach(col => balanceSheet.getColumn(col).numFmt = '€#,##0.00');

    // --- FOGLIO 3: Conguaglio ---
    const settlementSheet = workbook.addWorksheet('Conguaglio');
    settlementSheet.columns = [{ width: 20 }, { width: 20 }, { width: 18 }];
    styleHeader(settlementSheet.addRow(['Chi deve pagare', 'A chi', 'Importo (€)']));
    const creditors = memberNames
        .filter(name => memberBalances[name].net > 0.01)
        .map(name => ({ name, credit: memberBalances[name].net }))
        .sort((a, b) => b.credit - a.credit);
    const debtors = memberNames
        .filter(name => memberBalances[name].net < -0.01)
        .map(name => ({ name, debt: Math.abs(memberBalances[name].net) }))
        .sort((a, b) => b.debt - a.debt);
    if (debtors.length === 0) {
        settlementSheet.addRow(['✓ Tutti i conti sono in pari', '', 0]);
    } else {
        // Distribuisce i debiti ai creditori in modo preciso
        const creditorsQueue = creditors.map(c => ({ ...c }));
        debtors.forEach(debtor => {
            let remaining = debtor.debt;
            for (const creditor of creditorsQueue) {
                if (remaining < 0.01) break;
                if (creditor.credit < 0.01) continue;
                const payment = Math.min(remaining, creditor.credit);
                settlementSheet.addRow([debtor.name, creditor.name, parseFloat(payment.toFixed(2))]);
                remaining -= payment;
                creditor.credit -= payment;
            }
        });
    }
    settlementSheet.getColumn(3).numFmt = '€#,##0.00';

    // --- FOGLIO 4: Spese Variabili (ordinate per data) ---
    const varSheet = workbook.addWorksheet('Spese Variabili');
    varSheet.columns = [{ width: 14 }, { width: 20 }, { width: 14 }, { width: 20 }, { width: 35 }];
    styleHeader(varSheet.addRow(['Data', 'Pagante', 'Importo (€)', 'Categoria', 'Descrizione']));
    [...allExpenses]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(e => varSheet.addRow([
            displayDate(e.date),
            e.payer || '',
            e.amount || 0,
            e.category || '',
            e.description || ''
        ]));
    varSheet.getColumn(3).numFmt = '€#,##0.00';

    // --- FOGLIO 5: Entrate (ordinate per data) ---
    const incomeSheet = workbook.addWorksheet('Entrate');
    incomeSheet.columns = [{ width: 14 }, { width: 14 }, { width: 35 }, { width: 40 }];
    styleHeader(incomeSheet.addRow(['Data', 'Importo (€)', 'Descrizione', 'Membri Coinvolti']));
    [...allIncome]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(i => incomeSheet.addRow([
            displayDate(i.date),
            i.amount || 0,
            i.description || '',
            (i.membersInvolved || []).join(', ')
        ]));
    incomeSheet.getColumn(2).numFmt = '€#,##0.00';

    // --- FOGLIO 6: Spese Fisse ---
    const fixedSheet = workbook.addWorksheet('Spese Fisse');
    fixedSheet.columns = [{ width: 35 }, { width: 18 }];
    styleHeader(fixedSheet.addRow(['Descrizione', 'Importo Mensile (€)']));
    allFixed.forEach(f => fixedSheet.addRow([f.description || '', f.amount || 0]));
    const fixedTotalRow = fixedSheet.addRow(['TOTALE', totalFix]);
    fixedTotalRow.font = { bold: true };
    fixedSheet.getColumn(2).numFmt = '€#,##0.00';

    // --- FOGLIO 7: Storico Cassa (ordinato per data) ---
    const cassaSheet = workbook.addWorksheet('Storico Cassa');
    cassaSheet.columns = [{ width: 14 }, { width: 12 }, { width: 14 }, { width: 20 }, { width: 40 }];
    styleHeader(cassaSheet.addRow(['Data', 'Tipo', 'Importo (€)', 'Membro', 'Descrizione']));
    const allMovements = cassaComune.movements ? Object.values(cassaComune.movements) : [];
    [...allMovements]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(m => cassaSheet.addRow([
            displayDate(m.date),
            m.type === 'deposit' ? 'Deposito' : 'Prelievo',
            m.type === 'deposit' ? (m.amount || 0) : -(m.amount || 0),
            m.member || 'Cassa',
            m.description || ''
        ]));
    const cassaTotalRow = cassaSheet.addRow(['', 'Saldo Finale', cassaBalance, '', '']);
    cassaTotalRow.font = { bold: true };
    cassaSheet.getColumn(3).numFmt = '€#,##0.00;[Red]-€#,##0.00';

    workbook.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gateradio_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}


// --- Event Listeners ---
if (monthFilter) monthFilter.addEventListener('change', () => {
    updateDashboardView();
    calculateAndRenderSettlement(false);
    if (typeof Chart !== 'undefined') {
        initializeCharts();
    }
});

if (addMemberBtn) addMemberBtn.addEventListener('click', () => {
    const name = newMemberNameInput.value.trim();
    if (name && !members.some(m => m.name === name)) {
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
    
    document.getElementById('pending-payment-member').selectedIndex = 0;
    document.getElementById('pending-payment-amount').value = '';
    document.getElementById('pending-payment-description').value = '';
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
        console.error("Errore during la creazione delle quote:", error);
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
            document.getElementById('future-movement-due-date').value = '';
            document.getElementById('future-movement-form-section').classList.add('hidden');
        })
        .catch(error => {
            console.error("Errore aggiungendo movimento futuro:", error);
            alert("Errore during l'aggiunta del movimento futuro.");
        });
});

if (wishlistNewLinkInput && addWishlistLinkBtn) addWishlistLinkBtn.addEventListener('click', () => {
    const input = wishlistNewLinkInput;
    if(input.value.trim()){
        const newLink = input.value.trim();
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
    
    document.getElementById('wishlist-item-name').value = '';
    document.getElementById('wishlist-item-cost').value = '';
    document.getElementById('wishlist-form-section').classList.add('hidden');
    alert("Articolo aggiunto alla lista desideri.");
});

if (addIncomeBtn) addIncomeBtn.addEventListener('click', () => {
    const date = document.getElementById('income-date').value;
    const amount = parseFloat(document.getElementById('income-amount').value);
    const description = document.getElementById('income-description').value.trim();
    const company = document.getElementById('income-company')?.value || 'kraken';
    const membersInvolved = Array.from(document.querySelectorAll('#income-members-checkboxes input:checked')).map(cb => cb.value);

    if (!date || isNaN(amount) || amount <= 0 || !description || membersInvolved.length === 0) {
        return alert("Compila tutti i campi e seleziona almeno un membro.");
    }

    const newIncomeRef = push(incomeRef);
    const newIncomeId = newIncomeRef.key;
    const newCassaMovRef = push(ref(database, 'cassaComune/movements'));
    const newCassaBalance = (cassaComune.balance || 0) + amount;

    const incomeUpdates = {};
    incomeUpdates[`incomeEntries/${newIncomeId}`] = { id: newIncomeId, date, amount, description, company, membersInvolved };
    incomeUpdates[`cassaComune/balance`] = newCassaBalance;
    incomeUpdates[`cassaComune/movements/${newCassaMovRef.key}`] = {
        id: newCassaMovRef.key,
        date,
        amount,
        description: `Entrata: ${description}`,
        type: 'deposit',
        member: membersInvolved.join(', '),
        sourceIncomeId: newIncomeId
    };
    update(ref(database), incomeUpdates);
    logAudit('income_added', { amount, description, members: membersInvolved.join(', ') });

    document.getElementById('income-amount').value = '';
    document.getElementById('income-description').value = '';
    document.querySelectorAll('#income-members-checkboxes input:checked').forEach(cb => cb.checked = false);
    document.getElementById('income-form-section').classList.add('hidden');
    alert("Entrata aggiunta.");
});


if (addExpenseBtn) {
    // Questo si aggiorna dopo 'authReady', quindi 'currentUser' è disponibile
    if (currentUser.role === 'admin' || currentUser.role === 'admin_base') {
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

        if (currentUser.role === 'admin' || currentUser.role === 'admin_base') {
            // Admin/Admin Base inserisce spese direttamente
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
                    description: `Spesa: ${description}`,
                    sourceExpenseId: newExpenseRef.key
                };

                const newBalance = (cassaComune.balance || 0) - amount;
                const updates = {};
                updates[`variableExpenses/${newExpenseRef.key}`] = newExpense;
                updates[`cassaComune/balance`] = newBalance;
                updates[`cassaComune/movements/${newMovementRef.key}`] = newMovement;

                update(ref(database), updates);
                logAudit('expense_added', { amount, description, payer: 'Cassa Comune', category });
                alert('Spesa pagata dalla Cassa Comune aggiunta.');

            } else {
                // Pagante è un membro, Admin lo aggiunge direttamente
                const newExpenseRef = push(varExpensesRef);
                set(newExpenseRef, { id: newExpenseRef.key, date, payer, amount, category, description, payerId });
                logAudit('expense_added', { amount, description, payer, category });
                alert('Spesa aggiunta con successo.');
            }
        } else if (currentUser.role === 'user') {
            // user invia richieste
            const newRequestRef = push(expenseRequestsRef);
            set(newRequestRef, {
                requesterUid: currentUser.uid,
                requesterName: currentUser.name,
                date,
                payer,
                payerId,
                amount,
                category,
                description,
                status: 'pending'
            });
            logAudit('expense_request_submitted', { amount, description, payer, category });
            alert("Richiesta di spesa inviata.");
        } else {
            // user_base non può inserire spese
            alert("Non hai i permessi per inserire spese. Contatta un amministratore.");
            return;
        }
        
        const payerEl = document.getElementById('payer');
        const amountEl = document.getElementById('amount');
        const categoryEl = document.getElementById('category');
        const descEl = document.getElementById('description');
        if (payerEl) payerEl.selectedIndex = 0;
        if (amountEl) amountEl.value = '';
        if (categoryEl) categoryEl.value = '';
        if (descEl) descEl.value = '';
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
    logAudit('fixed_expense_added', { description, amount });

    document.getElementById('fixed-desc').value = '';
    document.getElementById('fixed-amount').value = '';
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
    const movementCard = target.closest('.future-movement-card');

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
            const amount = parseFloat(req.amount);
            if (req.payer === 'Cassa Comune' && (cassaComune.balance || 0) < amount) {
                return alert("Errore: Fondi insufficienti nella cassa comune per approvare questa spesa.");
            }
            const newExpenseRef = push(varExpensesRef);
            const updates = {};
            updates[`variableExpenses/${newExpenseRef.key}`] = {
                id: newExpenseRef.key,
                payer: req.payer,
                payerId: req.payerId,
                date: req.date,
                amount: amount,
                category: req.category,
                description: `[RICHIESTA] ${req.description}`
            };
            updates[`expenseRequests/${key}/status`] = 'approved';
            if (req.payer === 'Cassa Comune') {
                const newMovRef = push(ref(database, 'cassaComune/movements'));
                updates[`cassaComune/balance`] = (cassaComune.balance || 0) - amount;
                updates[`cassaComune/movements/${newMovRef.key}`] = {
                    id: newMovRef.key,
                    type: 'withdrawal',
                    amount: amount,
                    member: 'Cassa',
                    date: req.date,
                    description: `Spesa (approvata): ${req.description}`,
                    sourceExpenseId: newExpenseRef.key
                };
            }
            update(ref(database), updates);
        }
    } 
    else if (target.matches('.reject-request-btn')) {
        const key = target.dataset.key;
        if (expenseRequests[key]) update(ref(database, `expenseRequests/${key}`), { status: 'rejected' });
    } 
    else if (target.matches('.delete-future-movement-btn')) {
        const idToDelete = target.dataset.id;
        if (idToDelete && confirm(`Sei sicuro di voler eliminare questo movimento futuro?`)) {
            const movToDelete = futureMovements.find(m => m.id === idToDelete);
            remove(ref(database, `futureMovements/${idToDelete}`))
                .then(() => {
                    logAudit('future_movement_deleted', {
                        description: movToDelete?.description || 'N/D',
                        amount: movToDelete?.totalCost
                    });
                    alert('Movimento futuro eliminato.');
                })
                .catch((error) => console.error("Errore eliminazione movimento futuro:", error));
        }
    }
    else if (target.matches('.convert-future-btn')) {
        const id = target.dataset.id;
        const movement = futureMovements.find(m => m.id === id);
        if (movement) {
            const amount = parseFloat(movement.totalCost) || 0;
            if ((cassaComune.balance || 0) < amount) {
                return alert(`Errore: Fondi insufficienti in cassa (€${(cassaComune.balance || 0).toFixed(2)}) per coprire €${amount.toFixed(2)}.`);
            }
            if (confirm(`Converti "${movement.description}" in spesa reale di €${amount.toFixed(2)} dalla Cassa Comune?`)) {
                const newExpenseRef = push(varExpensesRef);
                const newMovRef = push(ref(database, 'cassaComune/movements'));
                const today = new Date().toISOString().split('T')[0];
                const updates = {};
                updates[`variableExpenses/${newExpenseRef.key}`] = {
                    id: newExpenseRef.key, date: today, payer: 'Cassa Comune',
                    payerId: 'Cassa Comune', amount, category: 'Pianificato',
                    description: movement.description
                };
                updates[`cassaComune/balance`] = (cassaComune.balance || 0) - amount;
                updates[`cassaComune/movements/${newMovRef.key}`] = {
                    id: newMovRef.key, type: 'withdrawal', amount, member: 'Cassa',
                    date: today, description: `Spesa pianificata: ${movement.description}`,
                    sourceExpenseId: newExpenseRef.key
                };
                updates[`futureMovements/${id}`] = null;
                update(ref(database), updates);
                alert('Movimento convertito in spesa reale dalla Cassa Comune.');
            }
        }
    }
    else if (target.matches('.mark-purchased-btn')) {
        const id = target.dataset.id;
        const item = wishlist.find(w => w.id === id);
        if (item) {
            const priceStr = prompt(`Prezzo finale pagato per "${item.name}" (€):`, (item.cost || 0).toFixed(2));
            if (priceStr === null) return;
            const purchasedPrice = parseFloat(priceStr);
            if (isNaN(purchasedPrice) || purchasedPrice < 0) return alert("Prezzo non valido.");
            const today = new Date().toISOString().split('T')[0];
            update(ref(database, `wishlist/${id}`), { purchased: true, purchasedDate: today, purchasedPrice });
        }
    }
    else if (target.matches('.delete-item-btn')) { // Gestione eliminazione altri tipi (es. Cassa)
        const id = target.dataset.id;
        const type = target.dataset.type;
        if (id && type && confirm(`Sei sicuro di voler eliminare questo elemento?`)) {
            if (type === 'cashMovement') {
                const movementToDelete = cassaComune.movements ? cassaComune.movements[id] : null;
                if (movementToDelete) {
                    if (movementToDelete.sourceIncomeId) {
                        return alert("Questo movimento è collegato a un'entrata. Per eliminarlo correttamente usa il tasto Elimina nell'elenco Entrate.");
                    }
                    if (movementToDelete.sourceExpenseId) {
                        return alert("Questo movimento è collegato a una spesa. Per eliminarlo correttamente usa il tasto Elimina nell'elenco Spese Variabili.");
                    }
                    const newBalance = (cassaComune.balance || 0) + (movementToDelete.type === 'deposit' ? -movementToDelete.amount : movementToDelete.amount);
                    const updates = {};
                    updates[`cassaComune/balance`] = newBalance;
                    updates[`cassaComune/movements/${id}`] = null;
                    update(ref(database), updates);
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
        const payment = pendingPayments.find(p => p.id === id);
        if (payment && confirm(`Confermi che ${payment.member} ha versato €${(parseFloat(payment.amount) || 0).toFixed(2)} per "${payment.description}"?`)) {
            const newMovRef = push(ref(database, 'cassaComune/movements'));
            const today = new Date().toISOString().split('T')[0];
            const updates = {};
            updates[`pendingPayments/${payment.id}`] = null;
            updates[`cassaComune/balance`] = (cassaComune.balance || 0) + payment.amount;
            updates[`cassaComune/movements/${newMovRef.key}`] = {
                id: newMovRef.key,
                type: 'deposit',
                amount: payment.amount,
                member: payment.member,
                date: today,
                description: `Versamento quota: ${payment.description}`
            };
            update(ref(database), updates);
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

        if (movementId && !isNaN(newAmount)) {
            const movement = futureMovements.find(m => m.id === movementId);
            if (movement && movement.shares && movement.shares[shareIndex] !== undefined) {
                 movement.shares[shareIndex].amount = newAmount;
                 const allShares = Array.isArray(movement.shares) ? movement.shares : Object.values(movement.shares);
                 const newTotalCost = allShares.reduce((sum, s) => sum + (s.amount || 0), 0);
                 const updates = {};
                 updates[`futureMovements/${movementId}/shares/${shareIndex}/amount`] = newAmount;
                 updates[`futureMovements/${movementId}/totalCost`] = newTotalCost; 
                 update(ref(database), updates)
                    .catch(error => console.error("Errore aggiornando importo quota:", error));
            }
        }
    }
});

// --- App Initialization ---
document.addEventListener('authReady', () => {
    // Controlla se siamo sulla pagina finanze prima di eseguire tutto
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
