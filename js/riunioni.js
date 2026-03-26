// js/riunioni.js

import { database } from './firebase-config.js';
import {
    ref as dbRef, push, set, remove, onValue
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";
import { GOOGLE_CONFIG } from './google-calendar-config.js';
import { currentUser } from './auth-guard.js';

// ── STATO ────────────────────────────────────────────────────────────────────
let tutteLeRiunioni = [];
let filtroAttivo = 'tutte';
let editingId = null;
let odgItems = [];
let allegatiEsistenti = [];

// Google Drive state
let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let driveAuthorized = false;

// ── DOM ──────────────────────────────────────────────────────────────────────
const loadingEl      = document.getElementById('loading-riunioni');
const noRiunioniEl   = document.getElementById('no-riunioni');
const listEl         = document.getElementById('riunioni-list');
const modal          = document.getElementById('riunione-modal');
const modalTitle     = document.getElementById('modal-title');
const nuovaBtnEl     = document.getElementById('nuova-riunione-btn');
const closeModalBtn  = document.getElementById('close-modal-btn');
const annullaBtn     = document.getElementById('annulla-modal-btn');
const salvaBtn       = document.getElementById('salva-riunione-btn');
const eliminaBtn     = document.getElementById('elimina-riunione-btn');
const aggiungiOdgBtn = document.getElementById('aggiungi-odg-btn');
const odgListEl      = document.getElementById('odg-list');
const odgEmptyEl     = document.getElementById('odg-empty');
const allegatiEl     = document.getElementById('allegati-esistenti');
const driveSection   = document.getElementById('drive-section');
const driveAuthBtn   = document.getElementById('drive-auth-btn');
const driveUploadBtn = document.getElementById('drive-upload-btn');
const fileInput      = document.getElementById('r-allegati');
const uploadStatus   = document.getElementById('upload-status-text');

// ── GOOGLE DRIVE INIT ─────────────────────────────────────────────────────────
function initGapi() {
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                discoveryDocs: [GOOGLE_CONFIG.DRIVE_DISCOVERY_DOC]
            });
            gapiInited = true;
            maybeEnableDrive();
        } catch (e) {
            console.error('Errore init GAPI:', e);
        }
    });
}

function initGis() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CONFIG.CLIENT_ID,
            scope: GOOGLE_CONFIG.DRIVE_SCOPES,
            callback: ''
        });
        gisInited = true;
        maybeEnableDrive();
    } catch (e) {
        console.error('Errore init GIS:', e);
    }
}

window.initGapi = initGapi;
window.initGis = initGis;

window.addEventListener('load', () => {
    const waitGapi = setInterval(() => {
        if (typeof gapi !== 'undefined') { clearInterval(waitGapi); initGapi(); }
    }, 100);
    const waitGis = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) { clearInterval(waitGis); initGis(); }
    }, 100);
});

function maybeEnableDrive() {
    if (!gapiInited || !gisInited) return;
    // Se abbiamo già un token valido, siamo già autorizzati
    if (gapi.client.getToken() !== null) {
        driveAuthorized = true;
        updateDriveUI();
    } else {
        updateDriveUI();
    }
}

function updateDriveUI() {
    if (!driveSection) return;
    if (driveAuthorized) {
        driveAuthBtn.classList.add('hidden');
        driveUploadBtn.classList.remove('hidden');
    } else {
        driveAuthBtn.classList.remove('hidden');
        driveUploadBtn.classList.add('hidden');
    }
}

// ── AUTORIZZA DRIVE ───────────────────────────────────────────────────────────
driveAuthBtn.addEventListener('click', () => {
    if (!tokenClient) {
        showToast('Google Drive non ancora pronto, riprova tra un secondo.');
        return;
    }
    tokenClient.callback = (resp) => {
        if (resp.error) {
            showToast('Errore autenticazione Google Drive.');
            return;
        }
        driveAuthorized = true;
        updateDriveUI();
        showToast('Google Drive collegato!');
    };
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        driveAuthorized = true;
        updateDriveUI();
    }
});

// ── UPLOAD SU DRIVE ───────────────────────────────────────────────────────────
driveUploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files);
    if (files.length === 0) return;

    driveUploadBtn.disabled = true;
    driveUploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Caricamento...';
    uploadStatus.textContent = '';

    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            uploadStatus.textContent = `Caricamento ${i + 1}/${files.length}: ${file.name}`;
            const result = await uploadFileToDrive(file);
            allegatiEsistenti.push({
                nome: file.name,
                url: result.webViewLink,
                driveId: result.id
            });
            renderAllegati();
        }
        showToast(`${files.length === 1 ? 'File caricato' : files.length + ' file caricati'} su Drive!`);
    } catch (e) {
        console.error('Errore upload Drive:', e);
        showToast('Errore durante il caricamento su Drive.');
    } finally {
        driveUploadBtn.disabled = false;
        driveUploadBtn.innerHTML = '<i class="fas fa-paperclip mr-2"></i>Allega file da Drive';
        uploadStatus.textContent = '';
        fileInput.value = '';
    }
});

async function uploadFileToDrive(file) {
    const metadata = { name: file.name, mimeType: file.type };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + gapi.client.getToken().access_token },
        body: form
    });
    if (!resp.ok) throw new Error('Upload fallito');
    return await resp.json();
}

// ── FIREBASE LISTENER ─────────────────────────────────────────────────────────
document.addEventListener('authReady', () => {
    onValue(dbRef(database, 'riunioni'), (snapshot) => {
        tutteLeRiunioni = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                tutteLeRiunioni.push({ id: child.key, ...child.val() });
            });
            tutteLeRiunioni.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
        }
        renderList();
    });
});

// ── RENDER LISTA ──────────────────────────────────────────────────────────────
function renderList() {
    loadingEl.classList.add('hidden');
    listEl.innerHTML = '';

    const filtrate = tutteLeRiunioni.filter(r =>
        filtroAttivo === 'tutte' || r.stato === filtroAttivo
    );

    if (filtrate.length === 0) {
        noRiunioniEl.classList.remove('hidden');
        listEl.classList.add('hidden');
        return;
    }
    noRiunioniEl.classList.add('hidden');
    listEl.classList.remove('hidden');
    filtrate.forEach(r => listEl.appendChild(buildCard(r)));
}

function buildCard(r) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow';

    const odgCount = (r.odg || []).length;
    const allegatiCount = (r.allegati || []).length;
    const dataFmt = r.data
        ? new Date(r.data + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—';

    card.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div class="flex-1">
                <div class="flex flex-wrap items-center gap-2 mb-2">
                    <span class="text-xs font-semibold px-2 py-1 rounded-full badge-${r.tipo || 'altro'}">${capitalize(r.tipo || 'altro')}</span>
                    <span class="text-xs font-semibold px-2 py-1 rounded-full badge-${r.stato || 'pianificata'}">${r.stato === 'svolta' ? 'Svolta' : 'Pianificata'}</span>
                    <span class="text-sm text-gray-400"><i class="fas fa-calendar mr-1"></i>${dataFmt}</span>
                </div>
                <h3 class="text-lg font-bold text-gray-800">${escHtml(r.titolo || 'Riunione senza titolo')}</h3>
                <div class="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                    <span><i class="fas fa-list-ol mr-1 text-indigo-400"></i>${odgCount} punt${odgCount === 1 ? 'o' : 'i'} ODG</span>
                    ${allegatiCount > 0 ? `<span><i class="fas fa-paperclip mr-1 text-indigo-400"></i>${allegatiCount} allegat${allegatiCount === 1 ? 'o' : 'i'}</span>` : ''}
                    ${r.riassunto ? '<span><i class="fas fa-file-alt mr-1 text-green-400"></i>Verbale presente</span>' : ''}
                </div>
            </div>
            <button class="edit-btn shrink-0 text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1 border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-50 transition-colors" data-id="${r.id}">
                <i class="fas fa-pen-to-square"></i> Modifica
            </button>
        </div>
        ${odgCount > 0 ? `
        <div class="mt-4 border-t pt-3">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ordine del Giorno</p>
            <ol class="space-y-1 list-decimal list-inside">
                ${(r.odg || []).map(p => `<li class="text-sm text-gray-700">${escHtml(p.testo)}</li>`).join('')}
            </ol>
        </div>` : ''}
        ${r.riassunto ? `
        <div class="mt-4 border-t pt-3">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Riassunto</p>
            <p class="text-sm text-gray-700 whitespace-pre-line">${escHtml(r.riassunto)}</p>
        </div>` : ''}
        ${allegatiCount > 0 ? `
        <div class="mt-4 border-t pt-3">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Allegati</p>
            <div class="flex flex-wrap gap-2">
                ${(r.allegati || []).map(a => `
                    <a href="${a.url}" target="_blank" rel="noopener"
                       class="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                        <i class="fas fa-file"></i> ${escHtml(a.nome)}
                    </a>
                `).join('')}
            </div>
        </div>` : ''}
    `;

    card.querySelector('.edit-btn').addEventListener('click', () => openModal(r.id));
    return card;
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal(id = null) {
    editingId = id;
    odgItems = [];
    allegatiEsistenti = [];

    if (id) {
        const r = tutteLeRiunioni.find(x => x.id === id);
        if (!r) return;
        modalTitle.textContent = 'Modifica Riunione';
        document.getElementById('r-titolo').value = r.titolo || '';
        document.getElementById('r-tipo').value = r.tipo || 'riunione';
        document.getElementById('r-data').value = r.data || '';
        document.getElementById('r-stato').value = r.stato || 'pianificata';
        document.getElementById('r-riassunto').value = r.riassunto || '';
        odgItems = (r.odg || []).map(p => ({ ...p }));
        allegatiEsistenti = (r.allegati || []).map(a => ({ ...a }));
        eliminaBtn.classList.remove('hidden');
    } else {
        modalTitle.textContent = 'Nuova Riunione';
        document.getElementById('r-titolo').value = '';
        document.getElementById('r-tipo').value = 'riunione';
        document.getElementById('r-data').value = new Date().toISOString().split('T')[0];
        document.getElementById('r-stato').value = 'pianificata';
        document.getElementById('r-riassunto').value = '';
        eliminaBtn.classList.add('hidden');
    }

    renderOdg();
    renderAllegati();
    updateDriveUI();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    fileInput.value = '';
    uploadStatus.textContent = '';
}

// ── ODG ───────────────────────────────────────────────────────────────────────
function renderOdg() {
    odgListEl.innerHTML = '';
    if (odgItems.length === 0) {
        odgEmptyEl.classList.remove('hidden');
        return;
    }
    odgEmptyEl.classList.add('hidden');
    odgItems.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.innerHTML = `
            <span class="text-sm font-semibold text-gray-400 w-5 text-right shrink-0">${i + 1}.</span>
            <input type="text" value="${escHtml(item.testo)}" placeholder="Punto ODG..."
                   class="odg-input flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
            <button type="button" class="rimuovi-odg text-red-400 hover:text-red-600 shrink-0">
                <i class="fas fa-times"></i>
            </button>
        `;
        row.querySelector('.odg-input').addEventListener('input', (e) => {
            odgItems[i].testo = e.target.value;
        });
        row.querySelector('.rimuovi-odg').addEventListener('click', () => {
            odgItems.splice(i, 1);
            renderOdg();
        });
        odgListEl.appendChild(row);
    });
}

aggiungiOdgBtn.addEventListener('click', () => {
    odgItems.push({ id: Date.now().toString(), testo: '' });
    renderOdg();
    const inputs = odgListEl.querySelectorAll('.odg-input');
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
});

// ── ALLEGATI ──────────────────────────────────────────────────────────────────
function renderAllegati() {
    allegatiEl.innerHTML = '';
    if (allegatiEsistenti.length === 0) return;
    allegatiEsistenti.forEach((a, i) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2';
        row.innerHTML = `
            <a href="${a.url}" target="_blank" rel="noopener"
               class="flex items-center gap-2 text-sm text-indigo-600 hover:underline truncate">
                <i class="fas fa-file text-gray-400"></i> ${escHtml(a.nome)}
            </a>
            <button type="button" class="rimuovi-allegato text-red-400 hover:text-red-600 ml-3 shrink-0" title="Rimuovi">
                <i class="fas fa-times"></i>
            </button>
        `;
        row.querySelector('.rimuovi-allegato').addEventListener('click', () => {
            allegatiEsistenti.splice(i, 1);
            renderAllegati();
        });
        allegatiEl.appendChild(row);
    });
}

// ── SALVA ─────────────────────────────────────────────────────────────────────
salvaBtn.addEventListener('click', async () => {
    const titolo    = document.getElementById('r-titolo').value.trim();
    const tipo      = document.getElementById('r-tipo').value;
    const data      = document.getElementById('r-data').value;
    const stato     = document.getElementById('r-stato').value;
    const riassunto = document.getElementById('r-riassunto').value.trim();

    if (!titolo) { showToast('Inserisci un titolo.'); document.getElementById('r-titolo').focus(); return; }
    if (!data)   { showToast('Inserisci la data.'); return; }

    const odgPuliti = odgItems.filter(p => p.testo.trim() !== '');

    salvaBtn.disabled = true;
    salvaBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Salvataggio...';

    try {
        const dati = {
            titolo, tipo, data, stato, riassunto,
            odg: odgPuliti,
            allegati: allegatiEsistenti,
            aggiornatoIl: Date.now(),
            aggiornatoDa: currentUser.name || currentUser.email || 'Sconosciuto',
        };

        if (editingId) {
            const rOld = tutteLeRiunioni.find(r => r.id === editingId);
            await set(dbRef(database, `riunioni/${editingId}`), {
                ...dati,
                creadaIl:  rOld?.creadaIl  || Date.now(),
                creadaDa:  rOld?.creadaDa  || currentUser.name || '',
            });
            showToast('Riunione aggiornata!');
        } else {
            const nuovaRef = push(dbRef(database, 'riunioni'));
            await set(nuovaRef, {
                ...dati,
                creadaIl: Date.now(),
                creadaDa: currentUser.name || currentUser.email || 'Sconosciuto',
            });
            showToast('Riunione creata!');
        }
        closeModal();
    } catch (err) {
        console.error('Errore salvataggio:', err);
        showToast('Errore durante il salvataggio. Riprova.');
    } finally {
        salvaBtn.disabled = false;
        salvaBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Salva';
    }
});

// ── ELIMINA ───────────────────────────────────────────────────────────────────
eliminaBtn.addEventListener('click', async () => {
    if (!editingId) return;
    if (!confirm('Eliminare questa riunione? I file allegati su Drive NON verranno eliminati.')) return;
    try {
        await remove(dbRef(database, `riunioni/${editingId}`));
        showToast('Riunione eliminata.');
        closeModal();
    } catch (err) {
        console.error('Errore eliminazione:', err);
        showToast('Errore durante l\'eliminazione.');
    }
});

// ── FILTRI ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
        btn.classList.add('active-filter');
        filtroAttivo = btn.dataset.filter;
        renderList();
    });
});

// ── EVENTI MODAL ──────────────────────────────────────────────────────────────
nuovaBtnEl.addEventListener('click', () => openModal(null));
closeModalBtn.addEventListener('click', closeModal);
annullaBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// ── UTILITY ───────────────────────────────────────────────────────────────────
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
