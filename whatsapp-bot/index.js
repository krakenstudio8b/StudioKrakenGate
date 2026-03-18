// index.js
require('dotenv').config();

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino    = require('pino');
const qrcode  = require('qrcode-terminal');
const firebaseService = require('./firebase-service');
const { initScheduler }        = require('./scheduler');
const { initRealtimeListeners } = require('./realtime-listener');
const formatter = require('./message-formatter');

const GROUP_ID = process.env.WHATSAPP_GROUP_ID;
let sock    = null;
let isReady = false;

async function sendToGroup(text) {
    if (!isReady || !sock) {
        console.warn('[WhatsApp] Non ancora connesso, messaggio saltato');
        return;
    }
    if (!GROUP_ID) {
        console.warn('[WhatsApp] WHATSAPP_GROUP_ID non configurato!\nMessaggio:\n', text);
        return;
    }
    try {
        await sock.sendMessage(GROUP_ID, { text });
        console.log('[WhatsApp] Messaggio inviato al gruppo');
    } catch (error) {
        console.error('[WhatsApp] Errore invio:', error.message);
    }
}

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    sock = makeWASocket({
        auth:    state,
        logger:  pino({ level: 'silent' }),
        browser: ['Gestionale Bot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Scansiona il QR code con WhatsApp!\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log('[WhatsApp] Sessione terminata. Elimina auth_info/ e riavvia.');
                process.exit(1);
            }
            console.log('[WhatsApp] Connessione persa, riconnessione...');
            isReady = false;
            await delay(5000);
            startWhatsApp();
        }

        if (connection === 'open') {
            isReady = true;
            console.log('[WhatsApp] Connesso e pronto!');
            if (!GROUP_ID) {
                console.log('\n⚠️  WHATSAPP_GROUP_ID non configurato.');
                console.log('Manda un messaggio nel gruppo e guarda i log per trovare l\'ID.\n');
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const from    = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const text    = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

            if (isGroup) console.log(`[MSG] ${from}: ${text.substring(0, 60)}`);
            if (!isGroup) continue;

            const cmd   = text.toLowerCase().trim();
            const reply = async (message) => {
                try {
                    await sock.sendMessage(from, { text: message });
                } catch (err) {
                    console.error('[Bot] Errore risposta:', err.message);
                }
            };

            // ── HELP ─────────────────────────────────────────────
            if (cmd === '!help' || cmd === '!test') {
                await reply(
                    '🤖 *BOT ATTIVO*\n\n' +
                    '*CONSULTAZIONE*\n' +
                    '!oggi · task in scadenza oggi\n' +
                    '!settimana · scadenze settimana\n' +
                    '!mese · task del mese\n' +
                    '!attivita · attività checklist\n' +
                    '!task nome · task di una persona\n' +
                    '!eventi · prossimi eventi\n' +
                    '!lista · tutti i task attivi\n' +
                    '!report · report settimanale\n\n' +
                    '*GESTIONE RAPIDA*\n' +
                    '!fatto nome · completa un task\n' +
                    '!inizia nome · avvia un task\n' +
                    '!fatto-a nome · completa attività checklist'
                );
            }

            // ── OGGI ─────────────────────────────────────────────
            if (cmd === '!oggi') {
                const today = new Date().toISOString().split('T')[0];
                const [todayTasks, overdue, checklistToday, eventsToday] = await Promise.all([
                    firebaseService.getTasksDueToday(),
                    firebaseService.getOverdueTasks(),
                    firebaseService.getChecklistItemsDueToday(),
                    firebaseService.getEventsForDate(today)
                ]);
                const [enrichedToday, enrichedOverdue] = await Promise.all([
                    firebaseService.enrichTasksWithEvents(todayTasks),
                    firebaseService.enrichTasksWithEvents(overdue)
                ]);
                await reply(formatter.formatDailyReminder(
                    firebaseService.groupTasksByMember(enrichedToday),
                    firebaseService.groupTasksByMember(enrichedOverdue),
                    today, checklistToday, eventsToday
                ));
            }

            // ── SETTIMANA ─────────────────────────────────────────
            if (cmd === '!settimana') {
                const [weekTasks, overdue, checklistWeek] = await Promise.all([
                    firebaseService.getTasksDueThisWeek(),
                    firebaseService.getOverdueTasks(),
                    firebaseService.getChecklistItemsDueThisWeek()
                ]);
                const [enrichedWeek, enrichedOverdue] = await Promise.all([
                    firebaseService.enrichTasksWithEvents(weekTasks),
                    firebaseService.enrichTasksWithEvents(overdue)
                ]);
                await reply(formatter.formatWeeklyOverview(enrichedWeek, enrichedOverdue, checklistWeek));
            }

            // ── MESE ─────────────────────────────────────────────
            if (cmd === '!mese') {
                const [monthTasks, overdue] = await Promise.all([
                    firebaseService.getTasksThisMonth(),
                    firebaseService.getOverdueTasks()
                ]);
                const [enrichedMonth, enrichedOverdue] = await Promise.all([
                    firebaseService.enrichTasksWithEvents(monthTasks),
                    firebaseService.enrichTasksWithEvents(overdue)
                ]);
                await reply(formatter.formatMonthlyOverview(enrichedMonth, enrichedOverdue));
            }

            // ── ATTIVITÀ CHECKLIST ────────────────────────────────
            if (cmd === '!attivita') {
                const [todayItems, weekItems] = await Promise.all([
                    firebaseService.getChecklistItemsDueToday(),
                    firebaseService.getChecklistItemsDueThisWeek()
                ]);
                await reply(formatter.formatChecklistDeadlines(todayItems, weekItems));
            }

            // ── EVENTI ───────────────────────────────────────────
            if (cmd === '!eventi') {
                const events = await firebaseService.getCalendarEvents();
                await reply(formatter.formatEventsList(events));
            }

            // ── LISTA ─────────────────────────────────────────────
            if (cmd === '!lista') {
                const tasks       = await firebaseService.getTasks();
                const activeTasks = tasks.filter(t => t.status !== 'done');
                const enriched    = await firebaseService.enrichTasksWithEvents(activeTasks);
                await reply(formatter.formatTaskList(enriched));
            }

            // ── REPORT ────────────────────────────────────────────
            if (cmd === '!report') {
                const [completedTasks, overdue, weekTasks] = await Promise.all([
                    firebaseService.getTasksCompletedLastWeek(),
                    firebaseService.getOverdueTasks(),
                    firebaseService.getTasksDueThisWeek()
                ]);
                await reply(formatter.formatWeeklyReport(completedTasks, overdue, weekTasks));
            }

            // ── TASK DI UNA PERSONA ───────────────────────────────
            if (cmd.startsWith('!task ')) {
                const name = text.trim().substring(6).trim();
                if (!name) { await reply('Scrivi il nome dopo !task\nEs: !task simone'); continue; }
                const tasks      = await firebaseService.getTasks();
                const nameLower  = name.toLowerCase();
                const today      = new Date().toISOString().split('T')[0];
                const personTasks = tasks.filter(t =>
                    t.status !== 'done' &&
                    ((t.assignedTo || []).some(a => a.toLowerCase() === nameLower || a.toLowerCase() === 'tutti') ||
                     (t.owner && t.owner.toLowerCase() === nameLower))
                );
                const active  = personTasks.filter(t => !t.dueDate || t.dueDate >= today);
                const overdue = personTasks.filter(t => t.dueDate && t.dueDate < today);
                const [enrichedActive, enrichedOverdue] = await Promise.all([
                    firebaseService.enrichTasksWithEvents(active),
                    firebaseService.enrichTasksWithEvents(overdue)
                ]);
                await reply(formatter.formatPersonTasks(name, enrichedActive, enrichedOverdue));
            }

            // ── FATTO ─────────────────────────────────────────────
            if (cmd.startsWith('!fatto ') && !cmd.startsWith('!fatto-a ')) {
                const searchText = text.trim().substring(7).trim();
                if (!searchText) { await reply('Es: !fatto logo'); continue; }
                const matches = await firebaseService.findTasksByName(searchText);
                if (matches.length === 0) {
                    await reply(`Nessun task trovato con "${searchText}"\nUsa !lista per vedere i task attivi`);
                } else if (matches.length === 1) {
                    await firebaseService.updateTaskStatus(matches[0].id, 'done');
                    await reply(`✅ *COMPLETATO*\n*${matches[0].title}*\n\nOttimo lavoro! 🎉`);
                } else {
                    let msg = `Trovati ${matches.length} task con "${searchText}":\n\n`;
                    matches.forEach((t, i) => { msg += `${i + 1}. *${t.title}*\n`; });
                    msg += '\nScrivi un nome più preciso';
                    await reply(msg);
                }
            }

            // ── INIZIA ────────────────────────────────────────────
            if (cmd.startsWith('!inizia ')) {
                const searchText = text.trim().substring(8).trim();
                if (!searchText) { await reply('Es: !inizia logo'); continue; }
                const matches = await firebaseService.findTasksByName(searchText);
                if (matches.length === 0) {
                    await reply(`Nessun task trovato con "${searchText}"\nUsa !lista per vedere i task attivi`);
                } else if (matches.length === 1) {
                    await firebaseService.updateTaskStatus(matches[0].id, 'inprogress');
                    await reply(`🔄 *IN CORSO*\n*${matches[0].title}*\n\nForza! 💪`);
                } else {
                    let msg = `Trovati ${matches.length} task con "${searchText}":\n\n`;
                    matches.forEach((t, i) => { msg += `${i + 1}. *${t.title}*\n`; });
                    msg += '\nScrivi un nome più preciso';
                    await reply(msg);
                }
            }

            // ── FATTO-A ───────────────────────────────────────────
            if (cmd.startsWith('!fatto-a ')) {
                const searchText = text.trim().substring(9).trim();
                if (!searchText) { await reply('Es: !fatto-a comprare cavi'); continue; }
                const matches = await firebaseService.findChecklistItemsByName(searchText);
                if (matches.length === 0) {
                    await reply(`Nessuna attività trovata con "${searchText}"\nUsa !attivita per vedere le scadenze`);
                } else if (matches.length === 1) {
                    const match  = matches[0];
                    const result = await firebaseService.completeChecklistItem(match.taskId, match.itemIndex);
                    if (result.success) {
                        const done  = match.checklist.filter(i => i.done).length + 1;
                        const total = match.checklist.length;
                        await reply(`✅ *ATTIVITÀ COMPLETATA*\n*${match.item.text}*\n_Task: ${match.taskTitle}_\nProgresso: ${done}/${total}`);
                    } else {
                        await reply(`🔒 ${result.error}`);
                    }
                } else {
                    let msg = `Trovate ${matches.length} attività con "${searchText}":\n\n`;
                    matches.forEach((m, i) => { msg += `${i + 1}. *${m.item.text}*\n    _${m.taskTitle}_\n`; });
                    msg += '\nScrivi un nome più preciso';
                    await reply(msg);
                }
            }
        }
    });
}

async function main() {
    console.log('🤖 Avvio Bot WhatsApp — Gestionale Studio Kraken Gate\n');

    try {
        firebaseService.initFirebase();
    } catch (error) {
        console.error('❌ Errore Firebase:', error.message);
        process.exit(1);
    }

    await startWhatsApp();

    const waitForReady = setInterval(() => {
        if (isReady) {
            clearInterval(waitForReady);
            initScheduler(sendToGroup);
            initRealtimeListeners(sendToGroup);
            console.log('\n✅ Bot completamente operativo!\n');
        }
    }, 1000);
}

process.on('SIGINT', () => { console.log('\n👋 Chiusura bot...'); process.exit(0); });

main().catch(console.error);
