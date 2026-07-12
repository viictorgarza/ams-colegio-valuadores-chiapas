# Fase 2 — Arquitectura

**Proyecto:** AMS — Colegio de Ingenieros de Tapachula
**Fecha:** 2026-07-11
**Estado:** ✅ **Fase 2 cerrada (2026-07-11).** D7 (Drizzle + better-sqlite3), D8 (capa IPC propia con zod) y D9 (kit de recuperación) aprobadas por Victor. Continúa en `03-modelo-datos.md`.
**Regla vigente:** documento de diseño; no se escribe código de aplicación hasta autorización explícita.

---

## 1. Contexto heredado de Fase 1 (aprobado)

- Aplicación de escritorio **solo Windows**, para **una organización**, **una usuaria** (secretaria) + cuenta admin (Victor).
- **100% local**: no hay internet en la oficina. La nube existe únicamente como destino de respaldos (**Cloudflare R2**).
- Laptop **personal** de la secretaria → cifrado de disco, auto-bloqueo y respaldos fuera del equipo son obligatorios.
- Datos actuales en mezcla de Excel y papel → el importador y el flujo de digitalización son ciudadanos de primera clase.

## 2. Vista de conjunto

```
┌────────────────────────── Laptop Windows ──────────────────────────┐
│                                                                    │
│  ELECTRON                                                          │
│  ┌──────────────────────────┐   IPC tipado    ┌──────────────────┐ │
│  │ RENDERER (sandboxed)     │◄───────────────►│ MAIN (Node)      │ │
│  │ React + TS + Tailwind    │   (contratos    │ Módulos de       │ │
│  │ + shadcn/ui              │    zod en       │ negocio          │ │
│  │ TanStack Query (caché UI)│    /shared)     │ + ORM            │ │
│  └──────────────────────────┘                 └────────┬─────────┘ │
│                                                        │           │
│                              ┌─────────────────────────┼─────────┐ │
│                              │ %LOCALAPPDATA%\AMS\     ▼         │ │
│                              │  ├─ ams.db      (SQLite, WAL)     │ │
│                              │  ├─ documents\  (archivos)        │ │
│                              │  ├─ backups\    (copias locales)  │ │
│                              │  └─ logs\                         │ │
│                              └───────────────────────────────────┘ │
│                                                                    │
│  Servicio de respaldo (en main):                                   │
│   al detectar internet → paquete cifrado → Cloudflare R2           │
│   al detectar USB designada → copia local cifrada                  │
└────────────────────────────────────────────────────────────────────┘
```

Tres procesos con responsabilidades estrictas:

| Capa | Responsabilidad | Prohibido |
|---|---|---|
| **Renderer** | UI, estado de pantalla, caché de lectura (TanStack Query) | Tocar disco, BD o red; contener reglas de negocio |
| **Preload** | Puente mínimo: expone el cliente IPC tipado vía `contextBridge` | Lógica de cualquier tipo |
| **Main** | Reglas de negocio, persistencia, archivos, respaldos, auditoría | Conocer detalles de la UI |

Seguridad Electron desde el día uno: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` en el renderer, y validación con zod de **todo** lo que cruza el IPC en ambas direcciones.

## 3. Estructura del proyecto

Un solo paquete (sin monorepo — se descartó junto con el multiplataforma), con el layout estándar de **electron-vite**:

```
ams/
├─ package.json
├─ electron.vite.config.ts
├─ drizzle/                       # migraciones SQL versionadas (ver D7)
├─ src/
│  ├─ shared/                     # lo ÚNICO importable por main y renderer
│  │  ├─ contracts/               # contratos IPC: schemas zod por módulo
│  │  │  ├─ members.contract.ts
│  │  │  ├─ documents.contract.ts
│  │  │  └─ ...
│  │  └─ types/                   # tipos de dominio derivados de los schemas
│  ├─ main/
│  │  ├─ core/                    # infraestructura (no negocio)
│  │  │  ├─ db/                   # conexión SQLite, migrador, convenciones
│  │  │  ├─ ipc/                  # registro tipado de handlers + validación
│  │  │  ├─ events/               # bus de eventos de dominio en memoria
│  │  │  ├─ files/                # almacén de documentos en disco
│  │  │  └─ config/               # rutas, ajustes de app
│  │  ├─ modules/                 # UN directorio = UN módulo de negocio
│  │  │  ├─ organization/
│  │  │  ├─ members/
│  │  │  ├─ documents/
│  │  │  ├─ payments/
│  │  │  ├─ users/                # autenticación local, roles
│  │  │  ├─ audit/
│  │  │  ├─ dashboard/
│  │  │  ├─ import/               # importador Excel
│  │  │  └─ backup/
│  │  └─ index.ts                 # arranque: migra BD, registra módulos
│  ├─ preload/
│  └─ renderer/
│     ├─ app/                     # shell, enrutamiento, layout, auth guard
│     ├─ features/                # espejo 1:1 de los módulos del main
│     └─ components/ui/           # shadcn/ui
└─ resources/                     # iconos, instalador
```

## 4. Sistema de módulos (cómo se cumple "agregar sin modificar")

Anatomía de un módulo en `main/modules/<nombre>/`:

```
members/
├─ members.repository.ts   # acceso a datos (única capa que toca el ORM)
├─ members.service.ts      # reglas de negocio
├─ members.handlers.ts     # implementa el contrato IPC del módulo
└─ index.ts                # register(ctx): wiring del módulo
```

Reglas de dependencia (se harán cumplir con lint):

1. Un módulo **nunca importa los internos de otro módulo**. Si necesita algo de otro dominio, lo consume por su interfaz pública o reacciona a sus eventos.
2. La comunicación entre módulos ocurre por el **bus de eventos de dominio** (`member.created`, `payment.registered`, `document.uploaded`…). Ejemplo: `audit` no es invocado por nadie — se suscribe a los eventos y registra. Agregar un módulo nuevo = crear su carpeta + suscribirse a eventos existentes; cero cambios en los demás.
3. `core/` no conoce ningún módulo; los módulos solo conocen `core/` y `shared/`.
4. El arranque (`main/index.ts`) registra los módulos desde una lista — el único archivo que se toca al agregar uno.

En el renderer, `features/<nombre>/` sigue la misma disciplina: una feature no importa de otra; lo compartido vive en `components/ui` y `app/`.

## 5. D8 — Contratos IPC tipados (requiere aprobación)

El IPC es la "API" interna de la app; merece el mismo rigor que una API REST.

| Opción | Ventajas | Desventajas |
|---|---|---|
| **A. Capa propia ligera: contratos zod + factoría tipada** ⭐ | ~150 líneas de infraestructura, sin dependencias, transparente y depurable; validación runtime en ambos lados; tipos TS inferidos de extremo a extremo | Algo de código propio que mantener |
| B. tRPC sobre IPC (electron-trpc) | Menos boilerplate, DX conocida | Dependencia de un adaptador mantenido por la comunidad; una capa de "magia" más para depurar; acopla la app a un framework |

**Recomendación: A.** Cada módulo define su contrato en `shared/contracts/` (canal, schema de entrada, schema de salida). Una factoría genera: (a) en main, el registro del handler con validación automática; (b) en renderer, un cliente tipado (`api.members.create(...)`) que se integra con TanStack Query. Priorizas mantenibilidad a años vista: menos dependencias en el corazón de la app.

## 6. D7 — ORM: propongo Drizzle + better-sqlite3 en lugar de Prisma (requiere aprobación)

Cambio a tu stack preferido, con justificación:

| Criterio | Prisma | **Drizzle + better-sqlite3** ⭐ |
|---|---|---|
| En Electron empaquetado | Requiere embarcar el query engine binario (asar unpack); pesado (~10–15 MB) y con fricción histórica en apps de escritorio | better-sqlite3 es el camino estándar en Electron; binarios precompilados |
| Migraciones en la máquina del usuario final | El flujo `prisma migrate deploy` está pensado para servidores/CI, no para ejecutarse dentro de una app instalada | Migraciones = archivos SQL versionados aplicados programáticamente al arrancar la app (API oficial `migrate()`) — exactamente nuestro caso |
| Rendimiento local | Cliente async sobre engine externo | Acceso síncrono en proceso: latencia mínima, ideal para UI "inmediata" |
| Type-safety | Excelente | Excelente (schema TS como fuente de verdad) |
| Peso | Pesado | ~1 MB |

**Recomendación: Drizzle.** Prisma es viable con esfuerzo extra, pero Drizzle es la herramienta correcta para una app de escritorio local-first. Si algún día migramos a PostgreSQL en la nube, Drizzle también lo soporta con el mismo schema declarativo.

## 7. Convenciones de datos (aplican a todo el modelo — Fase 3)

- **PK: UUID v7** (ordenable por tiempo — índices eficientes y listados cronológicos gratis).
- **`created_at` / `updated_at`** en toda tabla; **`deleted_at`** para borrado lógico → la "papelera" con restauración es universal y gratis. Nada se borra físicamente desde la UI.
- **`audit_log` append-only**: nunca se actualiza ni borra; registra usuario, acción, entidad, datos antes/después (JSON), fecha/hora y dispositivo.
- **`organization`**: tabla de un solo registro (nombre, logo, RFC, dirección, configuración). Cero maquinaria multi-tenant, pero el concepto existe.
- **Catálogos configurables por datos, no por código**: tipos de documento, requisitos de expediente, tipos de membresía, estados. Agregar un tipo de documento = un INSERT desde la pantalla de configuración.
- **SQLite en modo WAL** + `foreign_keys=ON`; transacciones explícitas en operaciones compuestas.
- **Búsqueda inmediata: FTS5** (índice full-text nativo de SQLite) sobre nombre, número, CURP, RFC, correo, teléfono, empresa, universidad, especialidad → resultados en milisegundos mientras se teclea, sin servicios externos.

## 8. Almacén de documentos

- Archivos bajo `%LOCALAPPDATA%\AMS\documents\`, nombrados por **hash de contenido** (deduplicación y detección de corrupción gratis); los metadatos (nombre original, tipo, versión, quién subió, estado, observaciones) viven en la BD.
- Versionado: cada nueva carga de un mismo documento crea una versión nueva; las anteriores quedan accesibles (pendiente confirmar en Fase 3 si se conserva historial completo).
- La carpeta es administrada por la app: la usuaria nunca navega el sistema de archivos; sube, ve y abre documentos desde el expediente.

## 9. Módulo de respaldo (el seguro de vida del sistema)

**Empaquetado**: snapshot consistente de la BD (`VACUUM INTO` — seguro con la app abierta) + documentos nuevos desde el último respaldo (incremental por hash) + manifiesto con versión de esquema → comprimido → **cifrado AES-256-GCM** → subido a R2 con verificación de integridad.

**Disparadores** (todo automático, cero clics):
- Al detectar internet (sondeo periódico + eventos del SO): si el último respaldo remoto tiene >12 h → respaldar a R2.
- Diario: copia local rotada en `backups\` (protege contra corrupción del archivo de BD).
- Al detectar la memoria USB designada: copia cifrada a la USB (cubre las horas de oficina sin internet).

**Retención en R2**: esquema abuelo-padre-hijo — últimos 7 diarios, 4 semanales, 12 mensuales. Costo estimado: centavos al mes.

**UI**: indicador permanente y no intrusivo — "Último respaldo: hoy 8:15 pm ✓" / advertencia visible si lleva >3 días sin respaldar. Asistente de restauración integrado (elegir respaldo → restaurar), pensado para usarse en una laptop nueva sin ayuda técnica.

### D9 — Llave de cifrado y kit de recuperación (requiere aprobación)

Punto crítico: si la llave de cifrado vive solo en la laptop, los respaldos son **irrecuperables** justo en el escenario para el que existen (laptop perdida/robada/muerta). Propuesta:

1. En la primera configuración, la app genera una **frase de recuperación** (estilo 12–24 palabras).
2. Se imprime el **kit de recuperación** (frase + instrucciones de restauración): una copia la guarda Victor, otra queda en el archivo físico del Colegio.
3. Los respaldos se cifran con una llave derivada de esa frase. Restaurar en cualquier máquina = instalador + frase + credenciales de R2 (que guarda Victor).

Esto implica una responsabilidad operativa tuya (custodiar el kit y las credenciales R2) — por eso requiere tu aprobación explícita.

## 10. Autenticación local y protección del equipo

- Usuarios locales con contraseña (**argon2id**); roles `admin` (Victor) y `secretaria` desde el día uno — la infraestructura de permisos nace ahora aunque solo haya dos cuentas.
- **Auto-bloqueo** de la app tras N minutos de inactividad (laptop personal que viaja) — vuelve a pedir contraseña, sin cerrar el trabajo en curso.
- Recomendación operativa (fuera del software): verificar que la laptop tenga **BitLocker o Cifrado de dispositivo** activo; si su edición de Windows no lo permite, lo evaluamos en Fase 10.
- Sugerencia de gobernanza: un acuerdo simple por escrito entre el Colegio y la secretaria sobre el uso del equipo personal para datos de miembros (LFPDPPP).

## 11. Empaquetado, actualizaciones y observabilidad

- **electron-builder** → instalador NSIS estándar de Windows.
- **Actualizaciones automáticas** con electron-updater contra GitHub Releases: la app busca actualizaciones cuando hay internet (en casa), descarga en segundo plano y aplica al reiniciar. La secretaria nunca instala nada a mano.
- **Firma de código**: sin certificado, Windows SmartScreen mostrará advertencia al instalar/actualizar. Opciones (decisión para Fase 10, no bloquea): certificado OV/EV (~100–400 USD/año) o instruir el "Ejecutar de todas formas" la primera vez. Lo dejo señalado desde ahora porque afecta la experiencia de actualización.
- **Logs locales rotados** en `logs\` + diálogo de error con reporte copiable. **Sin telemetría externa** (privacidad + no hay red).

## 12. Decisiones abiertas y siguiente paso

| # | Decisión | Recomendación |
|---|---|---|
| D7 | ORM: Drizzle + better-sqlite3 en lugar de Prisma | Drizzle ⭐ |
| D8 | IPC: capa propia ligera con zod vs electron-trpc | Capa propia ⭐ |
| D9 | Kit de recuperación impreso + custodia de Victor | Aprobar esquema propuesto ⭐ |

Con D7–D9 aprobadas se cierra Fase 2 y pasa a **Fase 3 — Modelo de datos**, para lo cual se necesita de Victor:

1. Una **muestra del Excel actual** (las columnas bastan) para diseñar el importador.
2. Respuestas de la sección 7 de `01-analisis-requerimientos.md`: reglas de anualidades, numeración de miembros, escáner/formatos, versionado de documentos, recibos PDF.
