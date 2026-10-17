#!/usr/bin/env bash
# Pone inmueblesAPI en NODE_ENV=production (servicio systemd y .env). Ejecutar una vez como root
# en springfieldDev:
#   sudo bash /home/ubuntu/development/node/inmueblesAPI/deploy/nodeEnvProduccion.sh
# Respalda la unidad y el .env en ~/backups; si la API no responde tras el cambio, los restaura.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "Ejecuta con sudo o como root." >&2; exit 1; }

UNIDAD=/etc/systemd/system/inmueblesAPI.service
APP=/home/ubuntu/development/node/inmueblesAPI
BACKUPS=/home/ubuntu/backups
FECHA=$(date +%Y%m%d-%H%M)

cp -a "$UNIDAD" "$BACKUPS/inmueblesAPI.service-antes-produccion-$FECHA"
cp -a "$APP/.env" "$BACKUPS/inmueblesAPI.env-antes-produccion-$FECHA"
chown ubuntu:ubuntu "$BACKUPS"/inmueblesAPI.*-antes-produccion-"$FECHA"
chmod 600 "$BACKUPS/inmueblesAPI.env-antes-produccion-$FECHA"

sed -i 's/^Environment=NODE_ENV=.*/Environment=NODE_ENV=production/' "$UNIDAD"
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$APP/.env"
grep -n 'NODE_ENV' "$UNIDAD" "$APP/.env"

systemctl daemon-reload
systemctl restart inmueblesAPI.service
for _ in $(seq 1 30); do
  sleep 2
  if curl -fs -o /dev/null http://localhost:3002/api/docs-json; then
    echo "inmueblesAPI responde con NODE_ENV=production. Listo."
    exit 0
  fi
done

echo "La API no respondió: restaurando la configuración anterior." >&2
cp -a "$BACKUPS/inmueblesAPI.service-antes-produccion-$FECHA" "$UNIDAD"
cp -a "$BACKUPS/inmueblesAPI.env-antes-produccion-$FECHA" "$APP/.env"
chown ubuntu:ubuntu "$APP/.env"
systemctl daemon-reload
systemctl restart inmueblesAPI.service
exit 1
