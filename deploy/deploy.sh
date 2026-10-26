#!/usr/bin/env bash
# ============================================================
# Deploy do Gerenciamento de Empréstimos na VPS
# Execute este script na VPS, dentro da pasta do projeto.
# Uso:  ./deploy/deploy.sh
#       WEB_ROOT=/var/www/outro-caminho ./deploy/deploy.sh
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/emprestimo}"

echo "==> Projeto: $APP_DIR"

# 1. Atualiza o código a partir do GitHub
cd "$APP_DIR"
echo "==> git pull"
git pull --ff-only

# 2. Instala dependências e gera o build
if command -v bun >/dev/null 2>&1; then
  echo "==> bun install"
  bun install --frozen-lockfile
  echo "==> bun run build"
  bun run build
else
  echo "==> npm ci"
  npm ci
  echo "==> npm run build"
  npm run build
fi

# 3. Publica o build no diretório do nginx
echo "==> Publicando build em $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$APP_DIR/dist/" "$WEB_ROOT/"

echo "==> Pronto! Site atualizado em $WEB_ROOT"
