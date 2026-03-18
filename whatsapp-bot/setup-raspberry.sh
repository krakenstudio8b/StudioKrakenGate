#!/bin/bash
# ============================================================
#  Setup automatico Bot WhatsApp — Raspberry Pi
#  Esegui con: bash setup-raspberry.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=================================================="
echo "  Bot WhatsApp — Setup Raspberry Pi"
echo "=================================================="
echo ""

# ── 1. Node.js ───────────────────────────────────────────
if ! command -v node &> /dev/null; then
    echo "[ 1/5 ] Node.js non trovato. Installo via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    source "$NVM_DIR/nvm.sh"
    nvm install 18
    nvm use 18
    nvm alias default 18
    echo "        Node.js $(node -v) installato."
else
    echo "[ 1/5 ] Node.js già installato: $(node -v)"
    # Carica nvm se esiste (per avere npm nel PATH corretto)
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
fi

# ── 2. PM2 ───────────────────────────────────────────────
if ! command -v pm2 &> /dev/null; then
    echo "[ 2/5 ] Installo PM2..."
    npm install -g pm2
    echo "        PM2 installato."
else
    echo "[ 2/5 ] PM2 già installato: $(pm2 -v)"
fi

# ── 3. Dipendenze npm ────────────────────────────────────
echo "[ 3/5 ] Installo dipendenze npm..."
npm install --production
echo "        Dipendenze installate."

# ── 4. File di configurazione ────────────────────────────
echo "[ 4/5 ] Controllo file di configurazione..."

# .env
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo "  ⚠️  File .env creato da .env.example"
    echo "      Controlla che i valori siano corretti:"
    echo "      - WHATSAPP_GROUP_ID (già configurato nel file)"
    echo ""
else
    echo "        .env già presente."
fi

# service-account-key.json
if [ ! -f "service-account-key.json" ]; then
    echo ""
    echo "  ⚠️  MANCA service-account-key.json!"
    echo "      Copia il file nella cartella:"
    echo "      $SCRIPT_DIR/service-account-key.json"
    echo ""
    echo "      Poi riesegui: bash setup-raspberry.sh"
    echo ""
    exit 1
else
    echo "        service-account-key.json presente."
fi

# ── 5. PM2 avvio + auto-start al boot ────────────────────
echo "[ 5/5 ] Configuro PM2 e avvio automatico..."

# Ferma eventuali istanze precedenti dello stesso bot
pm2 delete whatsapp-bot 2>/dev/null || true

# Avvia il bot
pm2 start ecosystem.config.js

# Salva la lista dei processi
pm2 save

# Registra PM2 come servizio systemd (avvio automatico al boot)
echo ""
echo "  Configuro avvio automatico al boot (richiede sudo)..."
STARTUP_CMD=$(pm2 startup 2>&1 | grep "sudo env" | head -1)
if [ -n "$STARTUP_CMD" ]; then
    eval "$STARTUP_CMD"
    pm2 save
    echo "  ✅ Avvio automatico configurato!"
else
    echo "  ℹ️  Esegui manualmente il comando mostrato da: pm2 startup"
    pm2 startup
fi

echo ""
echo "=================================================="
echo "  ✅ Setup completato!"
echo ""
echo "  Comandi utili:"
echo "  pm2 status          — stato del bot"
echo "  pm2 logs            — log in tempo reale"
echo "  pm2 restart whatsapp-bot — riavvia il bot"
echo "  pm2 stop whatsapp-bot    — ferma il bot"
echo "=================================================="
echo ""
echo "  Il bot si avvierà AUTOMATICAMENTE ad ogni accensione."
echo "  Al primo avvio mostrerà un QR code nei log:"
echo "  pm2 logs --nostream"
echo ""
