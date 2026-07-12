# AMS — Sistema de administración de miembros

Aplicación de escritorio local-first para el **Colegio de Especialistas en Valuación
Profesional de Chiapas A.C.** Diseño y decisiones en [`../docs/`](../docs/):
requerimientos (01), arquitectura (02), modelo de datos (03), UX/UI (04), roadmap (05).

## Stack

Electron + React 19 + TypeScript + Tailwind 4 · SQLite local vía Drizzle ORM +
better-sqlite3 · IPC tipado con contratos zod compartidos · sin servidor.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias y descarga el binario nativo de better-sqlite3 para Electron |
| `npm run dev` | Arranca la app en desarrollo (credenciales iniciales: `admin` / `admin`) |
| `npm run typecheck` | Verifica tipos de main y renderer |
| `npm run smoke` | Prueba de humo del núcleo: migraciones, semillas, auth, FTS, auditoría |
| `npm run build` | Compila los tres procesos a `out/` |
| `npm run db:generate` | Genera migración SQL tras cambiar `src/main/core/db/schema.ts` |

## Reglas del proyecto que el código debe respetar

- **Fronteras de módulos** (`src/main/modules/*`): un módulo nunca importa los internos
  de otro; la comunicación entre dominios va por el bus de eventos (`core/events/bus`).
  Auditoría es el ejemplo: nadie la llama, ella escucha.
- **Contratos IPC** en `src/shared/contracts/`: todo canal declara schema zod de entrada
  y salida; se valida en ambos procesos. El preload solo deja pasar canales declarados.
- **Convenciones de datos**: UUID v7, `created_at`/`updated_at`, borrado lógico con
  `deleted_at`, dinero en centavos (enteros), catálogos configurables por datos.
- **La base vive en la carpeta de datos del usuario** (`AMS_DATA_DIR` la sobreescribe
  para pruebas). Las tablas FTS5 y sus triggers se asemillan al arranque, no en migraciones.

## Restricción de esta máquina de desarrollo (importante)

Las rutas del proyecto contienen espacios (`/Volumes/Extreme Pro 2Tb/…`) y **node-gyp
no compila módulos nativos con ellas**. Por eso:

- No se usa `electron-rebuild`; `scripts/native-prebuilds.mjs` descarga el **binario
  precompilado** de better-sqlite3 para la versión de Electron instalada.
- **Electron solo se actualiza a majors con prebuild publicado** de better-sqlite3
  (hoy: Electron 42 / ABI 146). Verificar en
  <https://github.com/WiseLibs/better-sqlite3/releases> antes de subir.
- Por la misma razón se usa scrypt (`node:crypto`) y no argon2 para contraseñas:
  cero módulos nativos adicionales.
- `npm run smoke` corre bajo el Node de Electron (`ELECTRON_RUN_AS_NODE=1`) para usar
  el mismo binario nativo que la app.
