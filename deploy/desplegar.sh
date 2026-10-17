#!/bin/bash
# Despliegue verificado de inmueblesAPI en el servidor (springfieldDev). Ejecutar como ubuntu:
#   bash ~/development/node/inmueblesAPI/deploy/desplegar.sh <rama-o-commit> [--aceptar-diferencias]
# La primera vez (el script aún no está en el servidor), tomarlo de GitHub:
#   cd ~/development/node/inmueblesAPI && git fetch -q origin && git show origin/dev-isra:deploy/desplegar.sh > /tmp/desplegar.sh && bash /tmp/desplegar.sh dev-isra
#
# 1. Respaldos: base de datos completa y compilado actual en ~/backups.
# 2. Regresión "antes": guarda las respuestas de los GET con la versión que está corriendo.
# 3. Código: git fetch + checkout del commit, npm ci y build.
# 4. Migraciones: ensayo (--dry-run) y, si sale bien, la real.
# 5. Reinicio del servicio (systemd lo levanta: Restart=always) y espera a que responda.
# 6. Verificación: pruebas de flujos (transacción revertida), HTTP y regresión "después".
#    Si algo falla (incluida cualquier diferencia de regresión) y no hubo migración, regresa solo al
#    compilado anterior. Para un cambio de respuestas intencional: --aceptar-diferencias (las muestra igual).
# 7. Si todo salió bien, conserva sólo los últimos CONSERVAR respaldos de despliegue (base y compilado).
#    No toca otros respaldos de ~/backups; si el despliegue falla, no borra nada.
set -euo pipefail

REF="${1:?Uso: desplegar.sh <rama-o-commit> [--aceptar-diferencias]}"
ACEPTAR_DIFERENCIAS=0
[ "${2:-}" = "--aceptar-diferencias" ] && ACEPTAR_DIFERENCIAS=1
APP=/home/ubuntu/development/node/inmueblesAPI
BACKUPS=/home/ubuntu/backups
CNF=/home/ubuntu/.respaldoMySQL.cnf
API=http://localhost:3002/api
FECHA=$(date +%Y%m%d-%H%M%S)
CONSERVAR=10
cd "$APP"

# Un despliegue a la vez: dos corridas simultáneas se pisan el compilado y el reinicio.
exec 9>/tmp/desplegar-inmueblesAPI.lock
flock -n 9 || { echo "Ya hay un despliegue de inmueblesAPI en curso; espere a que termine." >&2; exit 1; }

DB=$(grep '^DB_DATABASE=' .env | cut -d= -f2)
ANTES=$(git rev-parse --short HEAD)
echo "==> Desplegando $REF sobre $ANTES ($FECHA)"

reiniciar() {
  local pid
  pid=$(pgrep -f '^/usr/bin/node .*inmueblesAPI/dist/main.js' || true)
  [ -n "$pid" ] && kill "$pid"
  for _ in $(seq 1 40); do
    sleep 2
    local nuevo
    nuevo=$(pgrep -f '^/usr/bin/node .*inmueblesAPI/dist/main.js' || true)
    if [ -n "$nuevo" ] && [ "$nuevo" != "$pid" ] && curl -fs -o /dev/null "$API/docs-json"; then return 0; fi
  done
  echo "La API no respondió después del reinicio." >&2
  return 1
}

echo "==> 1. Respaldos"
mysqldump --defaults-extra-file="$CNF" --single-transaction --quick --routines --triggers --events \
  --no-tablespaces --set-gtid-purged=OFF "$DB" | gzip -6 > "$BACKUPS/$DB-antes-despliegue-$FECHA.sql.gz"
chmod 600 "$BACKUPS/$DB-antes-despliegue-$FECHA.sql.gz"
DIST_RESPALDO="$BACKUPS/inmueblesAPI-dist-$ANTES-antes-despliegue-$FECHA"
cp -a dist "$DIST_RESPALDO"
echo "    $BACKUPS/$DB-antes-despliegue-$FECHA.sql.gz y $DIST_RESPALDO"

echo "==> 2. Regresión antes"
# Con el script de la versión que se va a desplegar (la que corre puede no tenerlo todavía).
git fetch --quiet origin
REGRESION=$(mktemp /tmp/regresion-antes-XXXX.json)
REGRESION_JS=$(mktemp /tmp/regresion-XXXX.js)
git show "origin/$REF:test/integracion/regresion.js" > "$REGRESION_JS" 2>/dev/null \
  || git show "$REF:test/integracion/regresion.js" > "$REGRESION_JS"
node "$REGRESION_JS" guardar "$REGRESION"
rm -f "$REGRESION_JS"

echo "==> 3. Código"
git checkout --quiet "$REF"
# Si es una rama, se adelanta a la de GitHub (sin depender de que tenga upstream configurado).
if git show-ref --verify --quiet "refs/remotes/origin/$REF"; then
  git merge --quiet --ff-only "origin/$REF"
fi
DESPUES=$(git rev-parse --short HEAD)
[ "$DESPUES" != "$ANTES" ] || echo "    Aviso: $REF ya estaba en $ANTES; se recompila y verifica igual."
npm ci --no-audit --no-fund --loglevel=error
npm run -s build

echo "==> 4. Migraciones"
MIGRO=0
SALIDA=$(node dist/database/migrar.js --dry-run)
echo "$SALIDA"
if ! echo "$SALIDA" | grep -q "Sin migraciones pendientes"; then
  node dist/database/migrar.js
  MIGRO=1
fi

echo "==> 5. Reinicio"
reiniciar

echo "==> 6. Verificación"
FALLAS=0
npm run -s test:flujos || FALLAS=1
npm run -s test:http || FALLAS=1
if ! npm run -s test:regresion -- comparar "$REGRESION"; then
  if [ "$ACEPTAR_DIFERENCIAS" -eq 1 ]; then
    echo "    Diferencias de regresión aceptadas (--aceptar-diferencias)."
  else
    echo "    Las respuestas cambiaron respecto a la versión anterior." >&2
    FALLAS=1
  fi
fi
rm -f "$REGRESION"

if [ "$FALLAS" -ne 0 ]; then
  if [ "$MIGRO" -eq 0 ]; then
    echo "==> Falló la verificación: regreso al compilado $ANTES" >&2
    rm -rf dist && cp -a "$DIST_RESPALDO" dist
    git checkout --quiet "$ANTES"
    reiniciar
  else
    echo "==> Falló la verificación y SÍ hubo migración: no se regresa solo." >&2
    echo "    Revisar; para regresar: restaurar $BACKUPS/$DB-antes-despliegue-$FECHA.sql.gz y $DIST_RESPALDO." >&2
  fi
  exit 1
fi
echo "==> 7. Respaldos de despliegue: se conservan los últimos $CONSERVAR"
# Sólo nombres generados por este script: <Base>-antes-despliegue-AAAAMMDD-HHMM[SS].sql.gz e
# inmueblesAPI-dist-<commit>-antes-despliegue-AAAAMMDD-HHMM[SS], dentro de $BACKUPS. Del más nuevo al más viejo.
viejos() { # regex del nombre
  find "$BACKUPS" -mindepth 1 -maxdepth 1 -regextype posix-extended -regex "$BACKUPS/$1" -printf '%T@ %p\n' \
    | sort -rn | tail -n +$((CONSERVAR + 1)) | cut -d' ' -f2-
}
[ -d "$BACKUPS" ] && [ "$BACKUPS" = /home/ubuntu/backups ] || { echo "BACKUPS inesperado; no se poda." >&2; exit 1; }
viejos "${DB}-antes-despliegue-[0-9]{8}-[0-9]{4}([0-9]{2})?\.sql\.gz" | while read -r f; do rm -f -- "$f" && echo "    borrado $(basename "$f")"; done
viejos "inmueblesAPI-dist-[0-9a-f]{7,40}-antes-despliegue-[0-9]{8}-[0-9]{4}([0-9]{2})?" | while read -r d; do rm -r -- "$d" && echo "    borrado $(basename "$d")"; done

echo "==> Listo: $ANTES → $DESPUES"
