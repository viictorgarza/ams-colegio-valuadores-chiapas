# Despliegue de la nube (PWA para iPad + backend Cloudflare)

**Estado: construido y verificado en local (2026-07-13). Falta solo el despliegue a la cuenta de Cloudflare de Victor** — requiere autenticar wrangler, cosa que solo él puede hacer.

## Qué es

- `cloud/server/` — API en **Cloudflare Workers** con base de datos **D1** (SQLite en la nube). Un solo Worker sirve la API (`/api/*`) **y** la PWA (estáticos). Sin CORS, una sola URL.
- `cloud/pwa/` — **PWA en React** (mismos tokens visuales que el escritorio). Se instala desde Safari en el iPad con "Agregar a pantalla de inicio" — **sin licencia de Apple, sin App Store**.
- Alcance MVP nube: miembros, anualidades/pagos, calendario, asambleas/asistencia, auditoría (device='pwa'). **Fase 2**: documentos/expedientes (requieren R2 binding), recibos PDF, gestión de usuarios.

## Costo

El plan gratuito de Cloudflare Workers cubre de sobra este uso (100,000 requests/día, D1 5GB). Costo esperado: **$0**.

## Pasos de despliegue (Victor, ~15 min, una sola vez)

```bash
cd cloud/server
npx wrangler login                 # abre el navegador, autoriza con la cuenta de Cloudflare
npx wrangler d1 create ams         # crea la base D1; copia el database_id que imprime
```

1. Pega el `database_id` real en `wrangler.jsonc` (reemplaza los ceros).
2. Aplica el esquema y publica:

```bash
npm run db:migrate:remote          # crea tablas + semillas en la D1 real
cd ../pwa && npm install && npm run build   # compila la PWA a ../server/public
cd ../server && npm run deploy     # publica; imprime la URL https://ams-nube.<subdominio>.workers.dev
```

3. Entra a esa URL: usuario `admin`, contraseña `admin` — te obliga a cambiarla al primer uso.

## Importar los datos del escritorio (opcional, una sola vez)

```bash
cloud/scripts/exportar-desde-escritorio.sh /ruta/a/ams.db import.sql
cd cloud/server && npx wrangler d1 execute ams --remote --file=import.sql
```

- Reemplaza catálogos/organización/cuotas/contadores de la nube por los del escritorio y trae miembros, pagos, eventos, asambleas y asistencias completos (UUIDs intactos).
- Los usuarios del escritorio viajan solo para integridad de auditoría: quedan **desactivados** (sus contraseñas scrypt no sirven en la nube). El acceso a la nube es con el admin de la nube.
- Probado el 2026-07-13 con el respaldo real pre-reset (40 miembros): anualidades idénticas al escritorio.

## Instalación en el iPad de Angélica

1. Abrir Safari → ir a la URL del Worker.
2. Botón Compartir → **"Agregar a pantalla de inicio"**.
3. Queda como ícono con el logo del Colegio, pantalla completa, sin barra de Safari.
4. No importa de quién sea el Apple ID del iPad — es una página web instalada, no una app de App Store. **Cero costo, cero licencias.**

## Desarrollo local

```bash
cd cloud/server && npm install && npm run db:migrate:local && npm run dev   # API+PWA en http://localhost:8787
cd cloud/pwa && npm install && npm run dev                                  # (opcional) Vite con hot-reload en :5183, proxy /api→8787
```

Tras cambiar la PWA: `npm run build` en `cloud/pwa` regenera `cloud/server/public`.

## Decisiones de arquitectura (tomadas en la sesión nocturna 2026-07-13, revisables)

- **Un Worker para todo** (API + estáticos) en vez de Pages+Worker separados: una URL, un deploy, sin CORS.
- **Auth**: token Bearer en localStorage + tabla `sessions` (hash SHA-256 del token, expira a 30 días). PBKDF2-SHA256 100k iteraciones (Workers no tienen scrypt; formato autodescriptivo por si se migra).
- **Esquema espejo** del SQLite local (mismas convenciones: UUID v7, borrado lógico, centavos, estados derivados nunca almacenados). Los contratos zod se duplicaron a propósito en `cloud/server/src/schemas.ts` — paquetes independientes.
- **Búsqueda** por LIKE/normalización en memoria (no FTS5): con ~40 miembros sobra.
- **Sin sincronización bidireccional automática** escritorio↔nube: son dos bases separadas. El escritorio sigue siendo el sistema de la oficina (sin internet) y la nube es para consulta/captura desde el iPad con internet. La importación es manual y de una sola vez. Unificarlos de verdad (¿el escritorio consulta la nube cuando hay internet? ¿la nube baja al escritorio?) es una decisión de producto pendiente que merece su propia conversación.

## Pendientes conocidos (fase 2)

- Expedientes/documentos en la nube (R2 binding + subida desde el iPad con la cámara).
- Recibos PDF desde la nube (hoy solo el escritorio los genera; el folio sí se asigna en la nube).
- Gestión de usuarios en la nube (hoy solo existe el admin sembrado).
- Papelera con restauración en la PWA (el borrado lógico ya existe; falta la UI).
- Candado de seguridad adicional si se desea: limitar acceso por Cloudflare Access/Zero Trust (correo autorizado) además del login propio.
