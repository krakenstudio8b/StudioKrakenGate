/**
 * Script per caricare i task macro di Febbraio 2026
 * Esegui questo script UNA SOLA VOLTA dalla console del browser:
 *
 * 1. Apri la pagina del gestionale (index.html)
 * 2. Apri la console del browser (F12 -> Console)
 * 3. Copia e incolla questo codice oppure importa il modulo
 */

import { database } from './firebase-config.js';
import { ref, get, set } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// Task macro Febbraio 2026
const februaryTasks = [
    {
        title: "Showcase Asse",
        description: "Evento showcase per Asse - Setup completo e produzione clip",
        dueDate: "2026-02-07",
        priority: "high",
        status: "todo",
        owner: "", // Da assegnare dall'interfaccia
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

/**
 * Funzione per caricare i task su Firebase
 */
export async function loadFebruaryTasks() {
    const tasksRef = ref(database, 'tasks');

    try {
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

        for (const task of februaryTasks) {
            if (existingTitles.includes(task.title)) {
                console.log(`⏭️ Task già esistente: ${task.title}`);
            } else {
                // Genera ID univoco basato su timestamp + offset
                const now = Date.now();
                const newTask = {
                    ...task,
                    id: (now + tasksToAdd.length).toString(),
                    createdAt: new Date(now).toISOString()
                };
                tasksToAdd.push(newTask);
                console.log(`✅ Task da aggiungere: ${task.title}`);
            }
        }

        if (tasksToAdd.length === 0) {
            console.log('ℹ️ Nessun nuovo task da aggiungere - tutti esistono già');
            return { added: 0, skipped: februaryTasks.length };
        }

        // Aggiungi nuovi task all'array esistente
        const allTasks = [...existingTasks, ...tasksToAdd];

        // Salva su Firebase
        await set(tasksRef, allTasks);

        console.log(`🎉 Caricati ${tasksToAdd.length} nuovi task!`);
        console.log(`📊 Totale task nel database: ${allTasks.length}`);

        return { added: tasksToAdd.length, skipped: februaryTasks.length - tasksToAdd.length };

    } catch (error) {
        console.error('❌ Errore durante il caricamento:', error);
        throw error;
    }
}

// Esporta anche i task per riferimento
export { februaryTasks };

// Auto-esegui se caricato direttamente
if (typeof window !== 'undefined') {
    window.loadFebruaryTasks = loadFebruaryTasks;
    console.log('📋 Script caricato! Esegui loadFebruaryTasks() per caricare i task di Febbraio 2026');
}
