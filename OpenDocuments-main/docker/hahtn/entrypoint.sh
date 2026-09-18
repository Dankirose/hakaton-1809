#!/bin/sh
set -eu

cd /app

# ── Ждём готовность хостового Ollama ─────────────────────────────────────
if [ "${OPENDOCUMENTS_MODEL_PROVIDER:-ollama}" = "ollama" ]; then
  ollama_url="${OPENDOCUMENTS_MODEL_BASE_URL:-http://host.docker.internal:11434}"
  echo "[hahtn] Ожидание Ollama на $ollama_url ..."
  until wget -qO- "$ollama_url/api/tags" >/dev/null 2>&1; do
    sleep 2
  done
  echo "[hahtn] Ollama готов."
fi

# ── Индексация документов при старте ─────────────────────────────────────
if [ "${OPENDOCUMENTS_AUTO_INDEX:-true}" = "true" ]; then
  if [ -d /demo-docs ] && [ "$(ls -A /demo-docs 2>/dev/null)" ]; then
    echo "[hahtn] Индексация документов из /demo-docs ..."
    node packages/cli/dist/index.js index /demo-docs || echo "[hahtn] Индексация не удалась, продолжаем."
  else
    echo "[hahtn] /demo-docs пуст — пропускаем индексацию."
  fi
fi

echo "[hahtn] Запуск OpenDocuments на http://localhost:${PORT:-3000}"
exec node packages/cli/dist/index.js start --port "${PORT:-3000}"
