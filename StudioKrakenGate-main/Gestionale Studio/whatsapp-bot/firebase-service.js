// firebase-service.js
// Connessione a Firebase e lettura dati del gestionale

const admin = require('firebase-admin');
const path = require('path');

let db = null;

/**
 * Inizializza Firebase Admin SDK
 */
function initFirebase() {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account-key.json';

    const serviceAccount = require(path.resolve(serviceAccountPath));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });

    db = admin.database();
    console.log('[Firebase] Connesso al database');
    return db;
}

/**
 * Restituisce il riferimento al database
 */
function getDb() {
    if (!db) throw new Error('Firebase non inizializzato. Chiama initFirebase() prima.');
    return db;
}

/**
 * Legge tutti i task dal database
 */
async function getTasks() {
    const snapshot = await getDb().ref('tasks').once('value');
    const data = snapshot.val();
    if (Array.isArray(data)) return data.filter(Boolean);
    if (data && typeof data === 'object') return Object.values(data);
    return [];
}

/**
 * Legge tutti i membri
 */
async function getMembers() {
    const snapshot = await getDb().ref('members').once('value');
    const data = snapshot.val() || {};
    return Object.entries(data).map(([uid, member]) => ({
        uid,
        name: member.name,
        ...member
    }));
}

/**
 * Legge le pulizie di oggi
 */
async function getCleaningSchedule(dateStr) {
    const snapshot = await getDb().ref(`cleaningSchedule/${dateStr}`).once('value');
    return snapshot.val();
}

/**
 * Restituisce i task in scadenza oggi
 */
async function getTasksDueToday() {
    const tasks = await getTasks();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return tasks.filter(t =>
        t.dueDate === today &&
        t.status !== 'done'
    );
}

/**
 * Restituisce i task scaduti (non completati con dueDate passata)
 */
async function getOverdueTasks() {
    const tasks = await getTasks();
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t =>
        t.dueDate &&
        t.dueDate < today &&
        t.status !== 'done'
    );
}

/**
 * Restituisce i task in scadenza domani (per alert pre-scadenza)
 */
async function getTasksDueTomorrow() {
    const tasks = await getTasks();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return tasks.filter(t =>
        t.dueDate === tomorrowStr &&
        t.status !== 'done'
    );
}

/**
 * Raggruppa task per membro assegnato
 * Un task appare sotto ogni membro a cui è assegnato
 */
function groupTasksByMember(tasks) {
    const grouped = {};
    tasks.forEach(task => {
        const assignees = task.assignedTo || [];
        // Se ha un owner, aggiungi anche lui
        if (task.owner && !assignees.includes(task.owner)) {
            assignees.push(task.owner);
        }
        assignees.forEach(member => {
            if (!grouped[member]) grouped[member] = [];
            grouped[member].push(task);
        });
    });
    return grouped;
}

/**
 * Listener real-time su una path Firebase
 */
function onValueChange(path, callback) {
    getDb().ref(path).on('value', (snapshot) => {
        callback(snapshot.val());
    });
}

/**
 * Restituisce i task in scadenza questa settimana (non completati)
 */
async function getTasksDueThisWeek() {
    const tasks = await getTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);

    const todayStr = today.toISOString().split('T')[0];

    return tasks.filter(t =>
        t.dueDate &&
        t.dueDate >= todayStr &&
        new Date(t.dueDate + 'T00:00:00') <= endOfWeek &&
        t.status !== 'done'
    );
}

/**
 * Restituisce i task del mese corrente (non completati)
 */
async function getTasksThisMonth() {
    const tasks = await getTasks();
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const monthPrefix = `${year}-${month}`;

    return tasks.filter(t =>
        t.dueDate &&
        t.dueDate.startsWith(monthPrefix) &&
        t.status !== 'done'
    );
}

/**
 * Restituisce gli item checklist con scadenza oggi (non completati)
 */
async function getChecklistItemsDueToday() {
    const tasks = await getTasks();
    const today = new Date().toISOString().split('T')[0];
    const items = [];

    tasks.forEach(task => {
        if (task.status === 'done' || !task.checklist) return;
        task.checklist.forEach(item => {
            if (item.dueDate === today && !item.done) {
                items.push({
                    taskTitle: task.title,
                    text: item.text,
                    assignee: item.assignee || '',
                    dueDate: item.dueDate
                });
            }
        });
    });

    return items;
}

/**
 * Restituisce gli item checklist con scadenza questa settimana (non completati)
 */
async function getChecklistItemsDueThisWeek() {
    const tasks = await getTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    endOfWeek.setHours(23, 59, 59, 999);
    const todayStr = today.toISOString().split('T')[0];
    const items = [];

    tasks.forEach(task => {
        if (task.status === 'done' || !task.checklist) return;
        task.checklist.forEach(item => {
            if (!item.dueDate || item.done) return;
            const due = new Date(item.dueDate + 'T00:00:00');
            if (item.dueDate >= todayStr && due <= endOfWeek) {
                items.push({
                    taskTitle: task.title,
                    text: item.text,
                    assignee: item.assignee || '',
                    dueDate: item.dueDate
                });
            }
        });
    });

    items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return items;
}

module.exports = {
    initFirebase,
    getDb,
    getTasks,
    getMembers,
    getCleaningSchedule,
    getTasksDueToday,
    getOverdueTasks,
    getTasksDueTomorrow,
    getTasksDueThisWeek,
    getTasksThisMonth,
    getChecklistItemsDueToday,
    getChecklistItemsDueThisWeek,
    groupTasksByMember,
    onValueChange
};
