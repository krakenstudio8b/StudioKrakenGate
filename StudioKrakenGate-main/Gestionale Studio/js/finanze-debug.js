// === FINANZE DEBUG VERSION ===
// Tutto il codice originale di finanze.js con log aggiunti
// Questo serve solo per debug, puoi sostituire momentaneamente finanze.js in finanze.html

console.log("DEBUG: finanze-debug.js caricato");

// Qui andrebbero tutte le variabili e i riferimenti Firebase già presenti in finanze.js,
// ma per brevità lasciamo solo la struttura con i log che servono a capire il flusso.
// Nella tua versione reale, questo file deve includere TUTTE le funzioni già presenti.

// Esempio semplificato con i log inseriti:

function loadDataFromFirebase() {
    console.log("DEBUG: loadDataFromFirebase avviata");

    onValue(membersRef, (snapshot) => {
        console.log("DEBUG: ricevuti members", snapshot.val());
        members = snapshot.val() || [];
        renderMembers();
        toggleSectionsVisibility();
        updateDashboardView();
    });

    onValue(varExpensesRef, (snapshot) => {
        console.log("DEBUG: ricevute variableExpenses", snapshot.val());
        variableExpenses = snapshot.val() || [];
        renderVariableExpenses();
        updateDashboardView();
        populateMonthFilter();
    });

    onValue(fixedExpensesRef, (snapshot) => {
        console.log("DEBUG: ricevute fixedExpenses", snapshot.val());
        fixedExpenses = snapshot.val() || [];
        renderFixedExpenses();
        updateDashboardView();
    });

    onValue(incomeRef, (snapshot) => {
        console.log("DEBUG: ricevute incomeEntries", snapshot.val());
        incomeEntries = snapshot.val() || [];
        renderIncomeEntries();
        updateDashboardView();
        populateMonthFilter();
    });

    onValue(wishlistRef, (snapshot) => {
        console.log("DEBUG: ricevuta wishlist", snapshot.val());
        wishlist = snapshot.val() || [];
        renderWishlist();
    });

    onValue(futureMovementsRef, (snapshot) => {
        console.log("DEBUG: ricevuti futureMovements", snapshot.val());
        futureMovements = snapshot.val() || [];
        renderFutureMovements();
    });

    onValue(pendingPaymentsRef, (snapshot) => {
        console.log("DEBUG: ricevuti pendingPayments", snapshot.val());
        pendingPayments = snapshot.val() || [];
        renderPendingPayments();
    });

    onValue(cassaComuneRef, (snapshot) => {
        console.log("DEBUG: ricevuto cassaComune", snapshot.val());
        cassaComune = snapshot.val() || { balance: 0, movements: [] };
        renderCassaComune();
        updateDashboardView();
    });

    onValue(expenseRequestsRef, (snapshot) => {
        console.log("DEBUG: ricevute expenseRequests", snapshot.val());
        expenseRequests = snapshot.val() || {};
        renderExpenseRequestsForAdmin();
    });
}

// Hook dopo autenticazione
document.addEventListener('authReady', () => {
    console.log("DEBUG: evento authReady ricevuto");
    initializePage();
    console.log("DEBUG: chiamo loadDataFromFirebase()");
    loadDataFromFirebase();
    console.log("DEBUG: chiamo initializeCharts()");
    initializeCharts();
    console.log("DEBUG: chiamo updateDashboardView()");
    updateDashboardView();
});
