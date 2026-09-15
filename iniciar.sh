#!/bin/bash

echo ""
echo " ========================================"
echo "  Acougue SaaS - Iniciando o sistema..."
echo " ========================================"
echo ""

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Inicia Backend
echo "[1/3] Iniciando Backend (porta 3000)..."
osascript -e "tell app \"Terminal\" to do script \"cd '$ROOT_DIR/backend' && npm run dev\"" 2>/dev/null \
  || gnome-terminal -- bash -c "cd '$ROOT_DIR/backend' && npm run dev; exec bash" 2>/dev/null \
  || xterm -e "cd '$ROOT_DIR/backend' && npm run dev" &

sleep 3

# Inicia Simulador da Balanca
echo "[2/3] Iniciando Simulador da Balanca (porta 8765)..."
osascript -e "tell app \"Terminal\" to do script \"cd '$ROOT_DIR/agente_local' && python balanca_simulador.py\"" 2>/dev/null \
  || gnome-terminal -- bash -c "cd '$ROOT_DIR/agente_local' && python balanca_simulador.py; exec bash" 2>/dev/null \
  || xterm -e "cd '$ROOT_DIR/agente_local' && python balanca_simulador.py" &

sleep 2

# Inicia Frontend
echo "[3/3] Iniciando Frontend (porta 5173)..."
osascript -e "tell app \"Terminal\" to do script \"cd '$ROOT_DIR/frontend' && npm run dev\"" 2>/dev/null \
  || gnome-terminal -- bash -c "cd '$ROOT_DIR/frontend' && npm run dev; exec bash" 2>/dev/null \
  || xterm -e "cd '$ROOT_DIR/frontend' && npm run dev" &

sleep 4

# Abre o navegador
echo " Abrindo navegador..."
open http://localhost:5173 2>/dev/null \
  || xdg-open http://localhost:5173 2>/dev/null

echo ""
echo " Sistema iniciado!"
