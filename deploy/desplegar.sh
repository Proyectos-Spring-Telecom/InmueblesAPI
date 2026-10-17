#!/bin/bash
# Despliegue verificado de inmueblesAPI en el servidor (springfieldDev). Ejecutar como ubuntu:
#   bash ~/development/node/inmueblesAPI/deploy/desplegar.sh <rama-o-commit>
#
# 1. Respaldos: base de datos completa y compilado actual en ~/backups.
# 2. Regresión "antes": guarda las respuestas de los GET con la versión que está corriendo.
# 3. Código: git fetch + checkout del commit, npm ci y build.
# 4. Migraciones: ensayo (--dry-run) y, si sale bien, la real.
# 5. Reinicio del servicio (systemd lo levanta: Restart=always) y espera a que responda.
# 6. Verificación: pruebas de flujos (transacción revertida), HTTP y regresión "después".
#    Si flujos o HTTP fallan y no hubo migración, regresa solo al compilado anterior.
#    Las diferencias de regresión se muestran para revisarlas (pueden ser esperadas).
set -euo pipefail

REF="${1:?Uso: desplegar.sh <rama-o-commit>}"
APP=/home/ubuntu/development/node/inmueblesAPI
BACKUPS=/home/ubuntu/backups
CNF=/home/ubuntu/.respaldoMySQL.cnf
API=http://localhost:3002/api
FECHA=$(date +%Y%m%d-%H%M)
cd "$APP"

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
REGRESION=$(mktemp /tmp/regresion-antes-XXXX.json)
npm run -s test:regresion -- guardar "$REGRESION"

echo "==> 3. Código"
git fetch --quiet origin
git checkout --quiet "$REF"
git pull --quiet --ff-only 2>/dev/null || true
DESPUES=$(git rev-parse --short HEAD)
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
npm run -s test:regresion -- comparar "$REGRESION" || echo "    (revisar las diferencias de regresión: pueden ser esperadas)"
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
echo "==> Listo: $ANTES → $DESPUES"
