// js/login-points.js - Sistema punti login e classifica

import { ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { database } from './firebase-config.js';

export const MEDALS = [
    { min: 7, emoji: '🏆', label: 'God of the Studio' },
    { min: 6, emoji: '🥇', label: 'Il Maestro' },
    { min: 5, emoji: '🥈', label: 'Session Player' },
    { min: 4, emoji: '🥉', label: 'Il Turnista' },
    { min: 3, emoji: '🎵', label: 'Comparsa' },
    { min: 2, emoji: '🎸', label: 'Presenza Fantasma' },
    { min: 1, emoji: '😴', label: 'Chi mi ha invitato?' },
    { min: 0, emoji: '💀', label: 'Chi ti ha dato le chiavi?' },
];

export function getMedal(points) {
    return MEDALS.find(m => points >= m.min) || MEDALS[MEDALS.length - 1];
}

export function getNextMedal(points) {
    const idx = MEDALS.findIndex(m => points >= m.min);
    if (idx <= 0) return null;
    return MEDALS[idx - 1];
}

function getWednesdayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab
    const diff = (day - 3 + 7) % 7; // giorni dall'ultimo mercoledì
    d.setDate(d.getDate() - diff);
    // Usa data locale (non UTC) per evitare bug di timezone a mezzanotte
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
}

function getTodayStr() {
    const now = new Date();
    // Usa data locale (non UTC) per evitare bug di timezone a mezzanotte
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function saveWeekHistory(uid, name, points, weekStart) {
    const histRef = ref(database, `loginPointsHistory/${weekStart}/${uid}`);
    await set(histRef, { uid, name, points });
}

export async function trackLoginPoint(uid, name) {
    const today = getTodayStr();
    const currentWeekStart = getWednesdayOfWeek(new Date());
    const pointsRef = ref(database, `loginPoints/${uid}`);

    const snapshot = await get(pointsRef);
    let data = snapshot.val() || {
        totalPoints: 0,
        weeklyPoints: 0,
        weekStart: currentWeekStart,
        lastLoginDate: ''
    };

    let { totalPoints, weeklyPoints, weekStart, lastLoginDate } = data;

    // Se già registrato oggi nella settimana corretta, restituisci i dati senza scrivere
    // (previene race condition e inconsistenze tra pagine diverse aperte contemporaneamente)
    if (lastLoginDate === today && weekStart === currentWeekStart) {
        return { totalPoints, weeklyPoints, weekStart, lastLoginDate, pointAwarded: false };
    }

    // Gestione cambio settimana
    if (weekStart !== currentWeekStart) {
        const storedDate = new Date(weekStart + 'T12:00:00');
        const currentDate = new Date(currentWeekStart + 'T12:00:00');
        const daysDiff = Math.round((storedDate - currentDate) / (1000 * 60 * 60 * 24));

        if (daysDiff > -2 && daysDiff < 7) {
            // weekStart è dentro la settimana corrente (cambio ancora o bug timezone)
            // Aggiorna solo weekStart senza resettare i punti
            weekStart = currentWeekStart;
        } else {
            // Vera nuova settimana: salva storico e azzera
            if (weeklyPoints > 0) {
                await saveWeekHistory(uid, name, weeklyPoints, weekStart);
            }
            weeklyPoints = 0;
            weekStart = currentWeekStart;
        }
    }

    // Nuovo giorno: assegna punto
    let pointAwarded = false;
    if (lastLoginDate !== today) {
        totalPoints += 1;
        weeklyPoints += 1;
        lastLoginDate = today;
        pointAwarded = true;
    }

    await set(pointsRef, { totalPoints, weeklyPoints, weekStart, lastLoginDate });

    return { totalPoints, weeklyPoints, weekStart, lastLoginDate, pointAwarded };
}

export function injectLoginBanner(stats, name, uid, setupPushFn) {
    if (document.getElementById('login-points-banner')) return;

    const { weeklyPoints, pointAwarded } = stats;
    const medal = getMedal(weeklyPoints);
    const next = getNextMedal(weeklyPoints);
    const progressPct = Math.round((weeklyPoints / 7) * 100);
    const nextText = next
        ? `+${next.min - weeklyPoints} per <span class="font-semibold">${next.label}</span>`
        : '<span class="font-semibold text-indigo-600">Livello massimo! 🎉</span>';

    const notifGranted = ('Notification' in window) && Notification.permission === 'granted';
    const notifSupported = ('Notification' in window) && ('PushManager' in window);
    const bellHtml = notifSupported
        ? `<button id="enable-notif-btn" title="${notifGranted ? 'Notifiche attive — tocca per riattivare' : 'Attiva notifiche'}" class="transition-colors text-base ${notifGranted ? 'text-indigo-500' : 'text-gray-400 hover:text-indigo-600'}">🔔${notifGranted ? '✅' : ''}</button>`
        : '';

    const banner = document.createElement('div');
    banner.id = 'login-points-banner';
    banner.className = 'w-full bg-indigo-50 border-b border-indigo-100';
    banner.innerHTML = `
        <div class="container mx-auto px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2 text-sm">
            <div class="flex items-center gap-2 flex-shrink-0">
                <span class="text-lg">${medal.emoji}</span>
                <span class="font-bold text-indigo-700">${medal.label}</span>
                <span class="text-gray-300">|</span>
                <span class="text-gray-500">${name}</span>
                ${bellHtml}
            </div>
            <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <div class="w-28 sm:w-36 bg-gray-200 rounded-full h-1.5">
                    <div class="bg-indigo-500 h-1.5 rounded-full transition-all duration-700" style="width: ${progressPct}%"></div>
                </div>
                <span class="text-gray-600 whitespace-nowrap text-xs"><strong>${weeklyPoints}/7</strong> giorni</span>
                <span class="text-gray-500 text-xs">→ ${nextText}</span>
            </div>
        </div>
    `;

    const nav = document.querySelector('nav');
    if (nav) {
        nav.insertAdjacentElement('afterend', banner);
    }

    // Listener pulsante notifiche
    const bellBtn = document.getElementById('enable-notif-btn');
    if (bellBtn && setupPushFn) {
        bellBtn.addEventListener('click', async () => {
            bellBtn.textContent = '⏳';
            bellBtn.disabled = true;
            await setupPushFn(uid, name);
            bellBtn.textContent = Notification.permission === 'granted' ? '🔔✅' : '🔕';
        });
    }

    // Toast solo se guadagna punto oggi
    if (pointAwarded) {
        const toast = document.createElement('div');
        toast.id = 'login-point-toast';
        toast.className = 'fixed top-20 right-4 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-semibold z-50 transition-opacity duration-500';
        toast.textContent = '+1 punto oggi! 🎯';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }
}

// --- LEADERBOARD PER ADMIN ---

export function renderLeaderboard(containerEl) {
    const loginPointsRef = ref(database, 'loginPoints');
    const membersRef = ref(database, 'members');

    onValue(loginPointsRef, async (snapshot) => {
        const currentWeekStart = getWednesdayOfWeek(new Date());
        const membersSnap = await get(membersRef);
        const membersData = membersSnap.val() || {};

        const pointsData = snapshot.val() || {};
        const rankings = [];

        for (const uid in pointsData) {
            const entry = pointsData[uid];
            const name = membersData[uid]?.name || uid;
            const weeklyPoints = entry.weekStart === currentWeekStart ? (entry.weeklyPoints || 0) : 0;
            const totalPoints = entry.totalPoints || 0;
            rankings.push({ uid, name, weeklyPoints, totalPoints });
        }

        rankings.sort((a, b) => b.weeklyPoints - a.weeklyPoints || b.totalPoints - a.totalPoints);

        containerEl.innerHTML = '';

        if (rankings.length === 0) {
            containerEl.innerHTML = '<p class="text-gray-500">Nessun dato disponibile.</p>';
            return;
        }

        rankings.forEach((entry, idx) => {
            const medal = getMedal(entry.weeklyPoints);
            const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            const progressPct = Math.round((entry.weeklyPoints / 7) * 100);

            const row = document.createElement('div');
            row.className = `flex items-center gap-4 p-3 rounded-lg ${idx === 0 ? 'bg-indigo-50 border border-indigo-200' : 'bg-gray-50'}`;
            row.innerHTML = `
                <span class="text-2xl w-8 text-center">${rankLabel}</span>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-gray-800 capitalize">${entry.name}</span>
                        <span class="text-sm">${medal.emoji}</span>
                        <span class="text-xs text-indigo-600 font-semibold">${medal.label}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1">
                        <div class="w-28 bg-gray-200 rounded-full h-1.5">
                            <div class="bg-indigo-500 h-1.5 rounded-full" style="width: ${progressPct}%"></div>
                        </div>
                        <span class="text-xs text-gray-500">${entry.weeklyPoints}/7 giorni</span>
                    </div>
                </div>
                <div class="text-right flex-shrink-0">
                    <div class="text-xs text-gray-400">Totale</div>
                    <div class="font-bold text-gray-700">${entry.totalPoints} pt</div>
                </div>
            `;
            containerEl.appendChild(row);
        });
    });
}

export function renderLeaderboardHistory(containerEl) {
    const historyRef = ref(database, 'loginPointsHistory');

    onValue(historyRef, (snapshot) => {
        containerEl.innerHTML = '';
        const historyData = snapshot.val();

        if (!historyData) {
            containerEl.innerHTML = '<p class="text-gray-500">Nessuno storico disponibile.</p>';
            return;
        }

        const weeks = Object.keys(historyData).sort((a, b) => b.localeCompare(a));

        weeks.forEach(weekStart => {
            const weekData = historyData[weekStart];
            if (!weekData || typeof weekData !== 'object') return;
            const rankings = Object.values(weekData).sort((a, b) => b.points - a.points);
            const winner = rankings[0];

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const weekLabel = `${formatDateIT(weekStart)} – ${formatDateIT(weekEnd.toISOString().split('T')[0])}`;

            const section = document.createElement('div');
            section.className = 'border rounded-lg overflow-hidden';
            section.innerHTML = `
                <div class="bg-gray-100 px-4 py-2 flex justify-between items-center cursor-pointer history-toggle" data-week="${weekStart}">
                    <div class="flex items-center gap-2">
                        <span class="font-semibold text-gray-700 text-sm">${weekLabel}</span>
                        <span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            🏆 ${winner?.name ? capitalizeFirst(winner.name) : 'N/D'} (${winner?.points || 0} pt)
                        </span>
                    </div>
                    <span class="text-gray-400 text-xs">▼</span>
                </div>
                <div class="history-body px-4 py-3 space-y-2 hidden">
                    ${rankings.map((r, i) => {
                        const m = getMedal(r.points);
                        const pos = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
                        return `
                            <div class="flex items-center justify-between text-sm">
                                <div class="flex items-center gap-2">
                                    <span>${pos}</span>
                                    <span class="capitalize font-medium">${r.name || 'N/D'}</span>
                                    <span>${m.emoji} <span class="text-xs text-gray-500">${m.label}</span></span>
                                </div>
                                <span class="font-bold text-gray-700">${r.points}/7</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            containerEl.appendChild(section);
        });

        // Toggle accordion
        containerEl.querySelectorAll('.history-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const body = btn.nextElementSibling;
                body.classList.toggle('hidden');
            });
        });
    });
}

function formatDateIT(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function capitalizeFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// --- OVERRIDE ADMIN: imposta manualmente i punti settimanali di un utente ---
export async function adminSetWeeklyPoints(uid, weeklyPoints) {
    const pointsRef = ref(database, `loginPoints/${uid}`);
    const snapshot = await get(pointsRef);
    if (!snapshot.exists()) return;
    const data = snapshot.val();
    await set(pointsRef, { ...data, weeklyPoints: Math.min(Math.max(0, weeklyPoints), 7) });
}

// --- RIPRISTINO BULK: recupera punti salvati erroneamente nello storico ---
// Cerca nella history le entry della settimana corrente (date entro ±1 giorno dal mercoledì)
// e le rimette come weeklyPoints degli utenti, poi cancella quelle entry dalla history.
export async function adminRestoreFromHistory() {
    const currentWeekStart = getWednesdayOfWeek(new Date());
    const currentWeekDate = new Date(currentWeekStart + 'T12:00:00');

    const histSnap = await get(ref(database, 'loginPointsHistory'));
    if (!histSnap.exists()) return { restored: 0, details: {} };

    const historyData = histSnap.val();
    const toRestore = {}; // uid -> max points trovati
    const toDelete = []; // path da eliminare

    for (const dateKey of Object.keys(historyData)) {
        const entryDate = new Date(dateKey + 'T12:00:00');
        const daysDiff = Math.round((currentWeekDate - entryDate) / (1000 * 60 * 60 * 24));

        // Entro la finestra della settimana corrente (-1 … +6 giorni dal mercoledì)
        if (daysDiff >= -1 && daysDiff <= 6) {
            for (const uid of Object.keys(historyData[dateKey])) {
                const pts = historyData[dateKey][uid].points || 0;
                if (toRestore[uid] === undefined || pts > toRestore[uid]) {
                    toRestore[uid] = pts;
                }
                toDelete.push(`loginPointsHistory/${dateKey}/${uid}`);
            }
        }
    }

    let restored = 0;
    for (const uid of Object.keys(toRestore)) {
        const pointsRef = ref(database, `loginPoints/${uid}`);
        const snap = await get(pointsRef);
        if (!snap.exists()) continue;
        const data = snap.val();
        await set(pointsRef, { ...data, weeklyPoints: toRestore[uid], weekStart: currentWeekStart });
        restored++;
    }

    for (const path of toDelete) {
        await set(ref(database, path), null);
    }

    return { restored, details: toRestore };
}
