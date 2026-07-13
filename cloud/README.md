# AMS Nube — PWA para iPad + backend Cloudflare

Cliente web instalable (PWA) del AMS y su backend en Cloudflare Workers + D1.
El iPad y cualquier navegador son clientes de la misma base en la nube.

- `server/` — Cloudflare Worker (Hono + D1). Sirve `/api/*` y los estáticos de la PWA.
- `pwa/` — React + Vite + Tailwind. `npm run build` publica a `server/public/`.
- `scripts/exportar-desde-escritorio.sh` — migración única de datos desde el `ams.db` del escritorio.

**Guía completa de despliegue y decisiones: [`docs/07-despliegue-nube.md`](../docs/07-despliegue-nube.md).**

## Arranque rápido en local

```bash
cd server && npm install && npm run db:migrate:local && npm run dev
# → http://localhost:8787  (admin / admin la primera vez)
```
