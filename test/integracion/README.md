# Pruebas de integración (pagos parciales y seguridad)

Se corren desde la raíz del proyecto, con el `.env` de la base que se quiere probar y después de `npm run build`
(los scripts usan el compilado de `dist/`).

| Comando | Qué prueba | ¿Escribe datos? |
|---|---|---|
| `npm run test:flujos` | Fase 1 (12): pago parcial, complemento, excedente y saldo a favor, aplicación posterior, validaciones, cancelación, liquidar, consistencia. Fase 2 (21): servicio de la API de cobranza, aislamiento por cliente, estado de cuenta. | No: todo corre en una transacción que se **revierte**, y al final compara conteos y saldos antes y después. |
| `npm run test:http` | 28 peticiones contra la API en ejecución: lecturas, aislamiento 404 entre clientes, 401, validaciones 400 y multipart. | No: sólo lecturas y peticiones que se rechazan antes de guardar; al final verifica que los datos no cambiaron. |
| `npm run test:regresion -- guardar regresion-antes.json` y luego `-- comparar regresion-antes.json` | Respuestas de los `GET` que consume el front (rentas, histórico, pagos de servicios, notificaciones, dashboards, arrendatarios, inmuebles) como súper admin y como usuario de cliente. Se guarda antes de desplegar y se compara después. | No: sólo `GET`. |

`test:http` y `test:regresion` firman tokens de prueba de 10 minutos con el `JWT_SECRET` del `.env`. La API debe
estar corriendo (`API_URL`, por defecto `http://localhost:3002/api`). Variables opcionales de la regresión:
`REGRESION_CLIENTE` (2) y `REGRESION_USUARIO` (46).

Las unitarias (`npm test`) no necesitan base de datos.
