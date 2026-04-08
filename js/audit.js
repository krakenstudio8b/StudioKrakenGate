// js/audit.js — Audit trail: registra chi ha fatto cosa e quando in Firebase

import { database } from './firebase-config.js';
import { ref, push, set } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { currentUser } from './auth-guard.js';

/**
 * Scrive una voce di audit log in Firebase (auditLog/{pushKey}).
 * Non blocca mai l'operazione principale in caso di errore.
 *
 * @param {string} action  - es. 'expense_approved', 'task_created', 'role_changed'
 * @param {Object} details - dettagli aggiuntivi dell'azione (amount, description, ecc.)
 */
export async function logAudit(action, details = {}) {
    try {
        const entry = {
            action,
            user: currentUser?.name || 'unknown',
            uid: currentUser?.uid || null,
            timestamp: new Date().toISOString(),
            ...details
        };
        const newRef = push(ref(database, 'auditLog'));
        await set(newRef, entry);
    } catch (err) {
        // L'audit non deve mai bloccare l'operazione principale
        console.warn('[Audit] Errore scrittura log:', err);
    }
}
