// index.js
// Entry point del bot WhatsApp per Gestionale Studio Kraken Gate

require('dotenv').config();

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const firebaseService = require('./firebase-service');
const { initScheduler, sendDailyReminder, sendWeeklyOverview } = require('./scheduler');
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

            // Comando !test per verificare che il bot funziona
            if (isGroup && text.toLowerCase() === '!test') {
                await sock.sendMessage(from, {
                    text: '✅ Bot attivo e funzionante!\n\nComandi disponibili:\n!test - Verifica stato bot\n!oggi - Riepilogo task di oggi\n!settimana - Riepilogo task della settimana'
                });
            }

            // Comando !oggi per il riepilogo giornaliero on-demand
            if (isGroup && text.toLowerCase() === '!oggi') {
                await sendDailyReminder();
            }

            // Comando !settimana per il riepilogo settimanale on-demand
            if (isGroup && text.toLowerCase() === '!settimana') {
                await sendWeeklyOverview();
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
