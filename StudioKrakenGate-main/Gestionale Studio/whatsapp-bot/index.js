// index.js
// Entry point del bot WhatsApp per Gestionale Studio Kraken Gate

require('dotenv').config();

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const firebaseService = require('./firebase-service');
const { initScheduler, sendDailyReminder, sendWeeklyOverview, sendMonthlyOverview, sendPersonTasks } = require('./scheduler');
const { initRealtimeListeners } = require('./realtime-listener');

const GROUP_ID = process.env.WHATSAPP_GROUP_ID;
let sock = null;
let isReady = false;

/**
 * Invia un messaggio al gruppo staff
 */
async function sendToGroup(text) {
    if (!isReady || !sock) {
        console.warn('[WhatsApp] Non ancora connesso, messaggio in coda...');
        return;
    }

    if (!GROUP_ID) {
        console.warn('[WhatsApp] WHATSAPP_GROUP_ID non configurato! Controlla il file .env');
        console.log('[WhatsApp] Messaggio che avrei inviato:\n', text);
        return;
    }

    try {
        await sock.sendMessage(GROUP_ID, { text });
        console.log('[WhatsApp] Messaggio inviato al gruppo');
    } catch (error) {
        console.error('[WhatsApp] Errore invio messaggio:', error.message);
    }
}

/**
 * Avvia la connessione WhatsApp con Baileys
 */
async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Gestionale Bot', 'Chrome', '1.0.0']
    });

    // Salva credenziali quando aggiornate
    sock.ev.on('creds.update', saveCreds);

    // Gestisci eventi di connessione
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Scansiona il QR code con WhatsApp per collegare il bot!\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;

            if (reason === DisconnectReason.loggedOut) {
                console.log('[WhatsApp] Disconnesso - sessione terminata. Elimina la cartella auth_info/ e riavvia.');
                process.exit(1);
            }

            // Riconnetti automaticamente
            console.log('[WhatsApp] Connessione persa, riconnessione in corso...');
            isReady = false;
            await delay(5000);
            startWhatsApp();
        }

        if (connection === 'open') {
            isReady = true;
            console.log('[WhatsApp] Connesso e pronto!');

            // Log dei gruppi per trovare l'ID giusto
            if (!GROUP_ID) {
                console.log('\n⚠️  WHATSAPP_GROUP_ID non configurato!');
                console.log('Manda un messaggio nel gruppo staff e guarda i log per trovare l\'ID.\n');
            }
        }
    });

    // Ascolta messaggi in arrivo (per debug e per trovare l'ID del gruppo)
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const text = msg.message.conversation ||
                msg.message.extendedTextMessage?.text || '';

            // Log utile per trovare l'ID del gruppo
            if (isGroup) {
                const groupName = msg.key.participant ? 'Gruppo' : 'Sconosciuto';
                console.log(`[MSG] Gruppo ${from}: ${text.substring(0, 50)}`);
            }

            // Comandi del bot (solo nei gruppi)
            if (!isGroup) continue;
            const cmd = text.toLowerCase().trim();

            // Funzione helper per rispondere nello stesso gruppo
            const reply = async (message) => {
                try {
                    await sock.sendMessage(from, { text: message });
                    console.log('[Bot] Risposta inviata');
                } catch (err) {
                    console.error('[Bot] Errore invio:', err.message);
                }
            };

            if (cmd === '!test' || cmd === '!help') {
                await reply('Bot attivo!\n\nComandi:\n\n*CONSULTAZIONE:*\n!oggi - Task in scadenza oggi\n!settimana - Scadenze settimana\n!mese - Task del mese\n!attivita - Attivita da fare questa settimana\n!task nome - Task di una persona\n!lista - Tutti i task attivi\n!report - Report settimanale\n\n*GESTIONE RAPIDA:*\n!fatto nome - Completa un task\n!inizia nome - Segna task come in corso\n!fatto-a nome - Completa un\'attivita checklist\n\n!test - Verifica bot');
            }

            if (cmd === '!oggi') {
                const firebaseService = require('./firebase-service');
                const formatter = require('./message-formatter');
                const today = new Date().toISOString().split('T')[0];
                const [todayTasks, overdue, checklistToday] = await Promise.all([
                    firebaseService.getTasksDueToday(),
                    firebaseService.getOverdueTasks(),
                    firebaseService.getChecklistItemsDueToday()
                ]);
                const msg = formatter.formatDailyReminder(
                    firebaseService.groupTasksByMember(todayTasks),
                    firebaseService.groupTasksByMember(overdue),
                    today,
                    checklistToday
                );
                await reply(msg);
            }

            if (cmd === '!settimana') {
                const firebaseService = require('./firebase-service');
                const formatter = require('./message-formatter');
                const [weekTasks, overdue, checklistWeek] = await Promise.all([
                    firebaseService.getTasksDueThisWeek(),
                    firebaseService.getOverdueTasks(),
                    firebaseService.getChecklistItemsDueThisWeek()
                ]);
                await reply(formatter.formatWeeklyOverview(weekTasks, overdue, checklistWeek));
            }

            if (cmd === '!mese') {
                const firebaseService = require('./firebase-service');
                const formatter = require('./message-formatter');
                const [monthTasks, overdue] = await Promise.all([
                    firebaseService.getTasksThisMonth(),
                    firebaseService.getOverdueTasks()
                ]);
                await reply(formatter.formatMonthlyOverview(monthTasks, overdue));
            }

            if (cmd === '!attivita') {
                const firebaseService = require('./firebase-service');
                const formatter = require('./message-formatter');
                const [todayItems, weekItems] = await Promise.all([
                    firebaseService.getChecklistItemsDueToday(),
                    firebaseService.getChecklistItemsDueThisWeek()
                ]);
                await reply(formatter.formatChecklistDeadlines(todayItems, weekItems));
            }

            if (cmd === '!report') {
                const firebaseService = require('./firebase-service');
                const formatter = require('./message-formatter');
                const [completedTasks, overdue, weekTasks] = await Promise.all([
                    firebaseService.getTasksCompletedLastWeek(),
                    firebaseService.getOverdueTasks(),
                    firebaseService.getTasksDueThisWeek()
                ]);
                await reply(formatter.formatWeeklyReport(completedTasks, overdue, weekTasks));
            }

            if (cmd.startsWith('!task ')) {
                const firebaseService = require('./firebase-service');
                const formatter = require('./message-formatter');
                const name = text.trim().substring(6).trim();
                if (name) {
                    const tasks = await firebaseService.getTasks();
                    const nameLower = name.toLowerCase();
                    const personTasks = tasks.filter(t =>
                        t.status !== 'done' &&
                        ((t.assignedTo || []).some(a => a.toLowerCase() === nameLower || a.toLowerCase() === 'tutti') ||
                         (t.owner && t.owner.toLowerCase() === nameLower))
                    );
                    const today = new Date().toISOString().split('T')[0];
                    const active = personTasks.filter(t => !t.dueDate || t.dueDate >= today);
                    const overdue = personTasks.filter(t => t.dueDate && t.dueDate < today);
                    await reply(formatter.formatPersonTasks(name, active, overdue));
                } else {
                    await reply('Scrivi il nome dopo !task\nEsempio: !task simone');
                }
            }

            // !lista - Mostra tutti i task attivi con numeri per riferimento
            if (cmd === '!lista') {
                const firebaseService = require('./firebase-service');
                const tasks = await firebaseService.getTasks();
                const activeTasks = tasks.filter(t => t.status !== 'done');
                if (activeTasks.length === 0) {
                    await reply('Nessun task attivo!');
                } else {
                    let msg = '*TASK ATTIVI:*\n\n';
                    activeTasks.forEach((t, i) => {
                        const status = t.status === 'inprogress' ? '🔄' : '⬜';
                        const assignees = (t.assignedTo || []).join(', ');
                        msg += `${status} *${i + 1}.* ${t.title}`;
                        if (assignees) msg += ` (${assignees})`;
                        msg += '\n';
                    });
                    msg += '\nUsa *!fatto nome* o *!inizia nome* per aggiornare';
                    await reply(msg);
                }
            }

            // !fatto nome-task - Segna un task come completato
            if (cmd.startsWith('!fatto ')) {
                const firebaseService = require('./firebase-service');
                const searchText = text.trim().substring(7).trim();
                if (!searchText) {
                    await reply('Scrivi il nome del task dopo !fatto\nEsempio: !fatto logo');
                } else {
                    const matches = await firebaseService.findTasksByName(searchText);
                    if (matches.length === 0) {
                        await reply(`Nessun task trovato con "${searchText}"\n\nUsa !lista per vedere tutti i task attivi`);
                    } else if (matches.length === 1) {
                        const task = matches[0];
                        await firebaseService.updateTaskStatus(task.id, 'done');
                        await reply(`✅ *TASK COMPLETATO!*\n\n*${task.title}*\n\nOttimo lavoro! 🎉`);
                    } else {
                        let msg = `Ho trovato ${matches.length} task con "${searchText}":\n\n`;
                        matches.forEach((t, i) => {
                            msg += `${i + 1}. *${t.title}*\n`;
                        });
                        msg += '\nScrivi il nome piu preciso per selezionare quello giusto';
                        await reply(msg);
                    }
                }
            }

            // !inizia nome-task - Segna un task come in corso
            if (cmd.startsWith('!inizia ')) {
                const firebaseService = require('./firebase-service');
                const searchText = text.trim().substring(8).trim();
                if (!searchText) {
                    await reply('Scrivi il nome del task dopo !inizia\nEsempio: !inizia logo');
                } else {
                    const matches = await firebaseService.findTasksByName(searchText);
                    if (matches.length === 0) {
                        await reply(`Nessun task trovato con "${searchText}"\n\nUsa !lista per vedere tutti i task attivi`);
                    } else if (matches.length === 1) {
                        const task = matches[0];
                        await firebaseService.updateTaskStatus(task.id, 'inprogress');
                        await reply(`🔄 *TASK IN CORSO*\n\n*${task.title}*\n\nForza! 💪`);
                    } else {
                        let msg = `Ho trovato ${matches.length} task con "${searchText}":\n\n`;
                        matches.forEach((t, i) => {
                            msg += `${i + 1}. *${t.title}*\n`;
                        });
                        msg += '\nScrivi il nome piu preciso per selezionare quello giusto';
                        await reply(msg);
                    }
                }
            }

            // !fatto-a nome-attivita - Completa un'attività checklist
            if (cmd.startsWith('!fatto-a ')) {
                const firebaseService = require('./firebase-service');
                const searchText = text.trim().substring(9).trim();
                if (!searchText) {
                    await reply('Scrivi il nome dell\'attivita dopo !fatto-a\nEsempio: !fatto-a comprare cavi');
                } else {
                    const matches = await firebaseService.findChecklistItemsByName(searchText);
                    if (matches.length === 0) {
                        await reply(`Nessuna attivita trovata con "${searchText}"\n\nUsa !scadenze per vedere le attivita da fare`);
                    } else if (matches.length === 1) {
                        const match = matches[0];
                        const result = await firebaseService.completeChecklistItem(match.taskId, match.itemIndex);
                        if (result.success) {
                            const done = match.checklist.filter(i => i.done).length + 1;
                            const total = match.checklist.length;
                            await reply(`✅ *ATTIVITA COMPLETATA!*\n\n*${match.item.text}*\nTask: ${match.taskTitle}\nProgresso: ${done}/${total}\n\nBravo! 🎉`);
                        } else {
                            await reply(`🔒 ${result.error}`);
                        }
                    } else {
                        let msg = `Ho trovato ${matches.length} attivita con "${searchText}":\n\n`;
                        matches.forEach((m, i) => {
                            msg += `${i + 1}. *${m.item.text}*\n    Task: ${m.taskTitle}\n`;
                        });
                        msg += '\nScrivi il nome piu preciso per selezionare quella giusta';
                        await reply(msg);
                    }
                }
            }
        }
    });
}

/**
 * Funzione principale
 */
async function main() {
    console.log('🤖 Avvio Bot WhatsApp - Gestionale Studio Kraken Gate\n');

    // 1. Connetti a Firebase
    try {
        firebaseService.initFirebase();
    } catch (error) {
        console.error('❌ Errore connessione Firebase:', error.message);
        console.error('Verifica che service-account-key.json esista e che FIREBASE_DATABASE_URL sia corretto nel .env');
        process.exit(1);
    }

    // 2. Avvia WhatsApp
    await startWhatsApp();

    // 3. Attendi che WhatsApp sia pronto, poi avvia scheduler e listener
    const waitForReady = setInterval(() => {
        if (isReady) {
            clearInterval(waitForReady);

            // Avvia scheduler (reminder giornaliero + check scadenze)
            initScheduler(sendToGroup);

            // Avvia listener real-time (nuovi task, cambi stato, ecc.)
            initRealtimeListeners(sendToGroup);

            console.log('\n✅ Bot completamente operativo!\n');
        }
    }, 1000);
}

// Gestione chiusura pulita
process.on('SIGINT', () => {
    console.log('\n👋 Chiusura bot...');
    process.exit(0);
});

// Avvia
main().catch(console.error);
