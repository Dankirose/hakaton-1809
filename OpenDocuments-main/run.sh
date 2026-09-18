#!/usr/bin/env bash
#
# Запуск OpenDocuments-демо (хакатон) через Docker Compose.
# Скрипт работает из директории hahaton/OpenDocuments-main (где лежит docker-compose.yml).
#
# Использование:
#   ./run.sh            — собрать и запустить стек (аналог `up -d --build`)
#   ./run.sh up         — то же, что без аргументов
#   ./run.sh down       — остановить (сохранить данные)
#   ./run.sh reset      — остановить и СБРОСИТЬ данные (down -v), затем поднять заново
#   ./run.sh logs       — следить за логами
#   ./run.sh reindex    — переиндексировать документы из /demo-docs
#   ./run.sh ask "..."  — задать вопрос
#   ./run.sh list       — список документов
#   ./run.sh compare <leftId> <rightId> — сравнить два документа
#   ./run.sh exec ...   — выполнить произвольную команду в контейнере
#
set -euo pipefail

# Корень проекта = каталог, в котором лежит этот скрипт.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

COMPOSE_PROJECT="smk-opendocuments"
SERVICE="opendocuments"

compose() {
  docker compose -p "$COMPOSE_PROJECT" "$@"
}

# Проверка, что Ollama доступен с хоста (необязательная, но помогает понять проблему).
check_ollama() {
  local url="${OPENDOCUMENTS_MODEL_BASE_URL:-http://localhost:11434}"
  if curl -sf "$url/api/tags" >/dev/null 2>&1; then
    echo "[run.sh] Ollama доступен: $url"
  else
    echo "[run.sh] ВНИМАНИЕ: Ollama недоступен на $url — убедитесь, что он запущен." >&2
  fi
}

case "${1:-up}" in
  up)
    check_ollama
    compose up -d --build --remove-orphans
    echo "[run.sh] Web UI: http://localhost:${OPENDOCUMENTS_PORT:-3333}"
    echo "[run.sh] Health: http://localhost:${OPENDOCUMENTS_PORT:-3333}/healthz"
    ;;
  down)
    compose down
    ;;
  reset)
    compose down -v --remove-orphans
    check_ollama
    compose up -d --build --remove-orphans
    echo "[run.sh] Данные сброшены, стек пересобран и запущен."
    echo "[run.sh] Web UI: http://localhost:${OPENDOCUMENTS_PORT:-3333}"
    ;;
  logs)
    compose logs -f "$SERVICE"
    ;;
  reindex)
    compose exec "$SERVICE" node packages/cli/dist/index.js index /demo-docs --reindex
    ;;
  list)
    compose exec "$SERVICE" node packages/cli/dist/index.js document list
    ;;
  ask)
    if [ "$#" -lt 2 ]; then
      echo "Использование: $0 ask \"вопрос\"" >&2
      exit 1
    fi
    compose exec "$SERVICE" node packages/cli/dist/index.js ask "$2"
    ;;
  compare)
    if [ "$#" -lt 3 ]; then
      echo "Использование: $0 compare <leftId> <rightId>" >&2
      exit 1
    fi
    compose exec "$SERVICE" node packages/cli/dist/index.js document compare "$2" "$3"
    ;;
  search)
    if [ "$#" -lt 2 ]; then
      echo "Использование: $0 search \"запрос\"" >&2
      exit 1
    fi
    compose exec "$SERVICE" node packages/cli/dist/index.js search "$2"
    ;;
  exec)
    shift
    compose exec "$SERVICE" "$@"
    ;;
  status)
    compose ps
    ;;
  help|-h|--help)
    awk 'NR > 1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "$0"
    ;;
  *)
    echo "Неизвестная команда: $1" >&2
    echo "Запустите '$0 help' для справки." >&2
    exit 1
    ;;
esac
