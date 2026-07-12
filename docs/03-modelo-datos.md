# Fase 3 — Modelo de datos

**Proyecto:** AMS — Colegio de Especialistas en Valuación Profesional de Chiapas A.C.
**Fecha:** 2026-07-11
**Estado:** En revisión — pendiente aprobación de Victor.
**Fuente de datos real analizada:** `Miembros Colegio Valuadores Registrados2026.pdf` (38 miembros, cuota 2026 = $1,500.00).

---

## 1. Decisiones de negocio confirmadas (2026-07-11)

| Tema | Decisión |
|---|---|
| Organización | **Colegio de Especialistas en Valuación Profesional de Chiapas A.C.** (no "Colegio de Ingenieros de Tapachula") |
| Anualidades | Se permiten **pagos parciales** y se registran **adeudos de años anteriores** |
| Pagos en especie | Existen ("Apoyo Cursos", "Apoyo Instalaciones") → el modelo los contempla como tipo de pago |
| Número de miembro | **Lo asigna el sistema** (secuencial, formato configurable) |
| Recibos | **PDF con folio desde el MVP** |
| Versionado de documentos | Historial completo (a esta escala el costo es nulo; da trazabilidad total) |
| Datos mínimos por miembro (confirmado al cerrar Fase 4) | Celular, teléfono de casa y correo + 7 documentos requeridos: INE, Acta de nacimiento, CURP, Constancia de Situación Fiscal, Cédula profesional de Maestría, Registro catastral o Poder Judicial, Comprobante de domicilio (ver §4.3) |

## 2. Convenciones

- Identificadores de tablas/columnas **en inglés** (consistencia con el ecosistema de código, sin acentos/ñ en identificadores), conservando términos del dominio mexicano que no se traducen: `curp`, `rfc`, `perito`.
- Toda tabla: `id` (UUID v7), `created_at`, `updated_at`; las entidades que la usuaria puede borrar llevan `deleted_at` (papelera universal).
- Catálogos configurables desde la pantalla de configuración — nunca valores fijos en código. Los catálogos con semántica (estados) llevan un `code` estable que usa la lógica; el nombre visible es editable.
- `audit_log` es append-only: nunca se actualiza ni borra.

## 3. Diagrama de entidades

```
organization (1 fila)          users ──────────┐
                                               │ (created_by / uploaded_by)
membership_types ──┐                           │
member_statuses ───┤                           │
                   ▼                           │
              ┌─ members ─┐◄── member_status_history
              │           │
              ▼           ▼
   member_documents    payments ──► annual_fees (cuota por año)
        │                  │
        ▼                  ▼
  document_versions    files (almacén físico por hash)
        │                  ▲
        └──────────────────┘ (fotos, logos y comprobantes también)

document_types ──► member_documents
import_batches ──► members / payments (procedencia)
audit_log (escucha eventos, no tiene FKs duras)
backup_log · settings (clave-valor)
```

## 4. Tablas

### 4.1 Núcleo

**`organization`** — una sola fila
`name`, `short_name`, `logo_file_id`, `rfc`, `street`, `city`, `state`, `zip`, `country`, `phone`, `email`, `website`, `fiscal_notes`

**`users`**
`full_name`, `username` (único), `password_hash` (argon2id), `role` (`admin` | `secretary`), `is_active`, `last_login_at`

**`settings`** — clave-valor JSON
Semillas: formato de número de miembro (`M-{seq:3}` → M-001), folio de recibo siguiente, minutos de auto-bloqueo, configuración de respaldo, **primer año de control de adeudos** (`2026` — evita generar deudas ficticias de años previos al sistema).

**`files`** — registro del almacén físico (deduplicado por contenido)
`sha256` (único), `size_bytes`, `mime_type`, `original_name`, `created_by`
Los archivos viven en `documents\` nombrados por hash; esta tabla es la única fuente de metadatos. Fotos de miembros, logo y comprobantes de pago también referencian aquí.

### 4.2 Miembros

**`membership_types`** — catálogo (semillas: *Titular*; previstos: *Vitalicio*, *Honorario*, *Estudiante*)
`name`, `description`, `is_fee_exempt` (vitalicios/honorarios no generan adeudo), `sort_order`, `is_active`

**`member_statuses`** — catálogo (semillas: `activo`, `suspendido`, `inactivo`, `fallecido`)
`code` (estable, usado por la lógica), `name` (editable), `sort_order`, `is_active`

**`members`**
| Campo | Notas |
|---|---|
| `member_number` | Único; asignado por el sistema según formato configurable |
| `title` | Ing., Arq., Lic. … (texto con sugerencias; el padrón real mezcla Ing y Arq) |
| `given_names`, `paternal_surname`, `maternal_surname` | Separados para ordenar y buscar bien |
| `full_name` | Columna generada (para mostrar y para el índice FTS) |
| `photo_file_id` | FK a `files` (acceso rápido; además "Fotografía" puede existir como documento del expediente) |
| `curp` (única), `rfc`, `email`, `phone` (celular), `phone_home` (casa) | Confirmados por Victor como datos base del miembro; todos opcionales en captura — el padrón real solo tiene nombre y celular, se completará con el tiempo |
| `street`, `city`, `state`, `zip` | |
| `university`, `degree`, `specialty`, `masters`, `doctorate` | `masters`/`doctorate` con texto = lo tiene (alimenta indicadores del dashboard) |
| `company`, `position` | |
| `is_perito`, `perito_number` | |
| `membership_type_id`, `status_id` | FKs a catálogos |
| `joined_at` | Fecha de ingreso |
| `observations` | |
| `import_batch_id` | Procedencia si vino del importador |

**`member_status_history`**
`member_id`, `status_id`, `changed_at`, `reason`, `changed_by` — se escribe automáticamente al cambiar el estado (vía evento `member.status_changed`).

### 4.3 Expediente documental

**`document_types`** — catálogo. **Semillas confirmadas por Victor (2026-07-11) — los 7 requeridos** que definen la barra de progreso: Acta de nacimiento · CURP · INE · Constancia de Situación Fiscal · **Cédula profesional de Maestría** · **Registro catastral o Poder Judicial** · Comprobante de domicilio. Semillas opcionales (no requeridas): Fotografía, Título Profesional, Cédula Profesional (Licenciatura), RFC, Certificaciones, Diplomas.
`name`, `description`, `is_required` (define la barra de progreso), `has_expiry` (p. ej. INE), `allows_multiple` (Diplomas/Certificaciones sí; CURP no), `sort_order`, `is_active`
→ *Agregar un tipo nuevo = un alta en configuración; cero código.*

**`member_documents`** — un documento del expediente
`member_id`, `document_type_id`, `status` (`pendiente` | `vigente` | `rechazado`), `expires_at`, `has_physical` (existe en papel en el archivero), `physical_location`, `notes`
El estado **`vencido` no se almacena: se deriva** (`expires_at < hoy`) — así nunca hay estados obsoletos ni se necesita un proceso nocturno.

**`document_versions`** — historial completo
`member_document_id`, `version_number`, `file_id`, `uploaded_by`, `uploaded_at`, `observations`
La versión vigente es la de mayor número; las anteriores quedan consultables.

### 4.4 Anualidades y pagos

**`annual_fees`** — cuota por año
`year`, `membership_type_id` (NULL = cuota general), `amount`, `notes`
Semilla: 2026 → $1,500.00 general. Permite en el futuro cuotas distintas por tipo de miembro sin tocar código.

**`payments`**
| Campo | Notas |
|---|---|
| `member_id`, `year` | Año de la anualidad que cubre (permite abonar a adeudos de años anteriores) |
| `kind` | `pago` \| `apoyo_en_especie` \| `condonacion` — refleja los "Apoyo Cursos/Instalaciones" reales |
| `amount` | 0 para apoyos/condonaciones |
| `paid_at`, `method` (`efectivo` \| `transferencia` \| `otro`), `reference` | |
| `receipt_folio` | Secuencial, asignado al emitir el recibo PDF |
| `receipt_file_id` | Comprobante adjunto opcional (FK a `files`) |
| `observations`, `created_by`, `import_batch_id` | |

**Estado de anualidad (calculado, nunca almacenado)** — por miembro y año:
- `exenta` — tipo de membresía exento
- `cubierta` — suma de pagos ≥ cuota del año, **o** existe apoyo en especie/condonación
- `parcial` — 0 < suma < cuota
- `pendiente` — sin pagos (solo desde el año de ingreso y desde el "primer año de control")

Implementado como vista SQL (`v_member_annuity`) — el dashboard y los filtros leen de ahí. Sin datos duplicados, sin estados desincronizados.

### 4.5 Sistema

**`audit_log`** (append-only): `user_id`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `created_at`, `device`
**`import_batches`**: `source_name`, `imported_at`, `user_id`, `stats_json` — cada alta importada conserva de qué archivo vino.
**`backup_log`**: `destination` (`r2` | `local` | `usb`), `started_at`, `finished_at`, `size_bytes`, `sha256`, `status`, `error`

## 5. Búsqueda y dashboard

- **`members_fts`** (FTS5, sincronizada por triggers): `full_name`, `member_number`, `curp`, `rfc`, `email`, `phone`, `company`, `university`, `specialty`, `degree` → búsqueda instantánea mientras se teclea, con prefijos ("val" encuentra "Valente").
- **Vistas SQL para el dashboard** (todas derivadas, nunca contadores almacenados): totales por estado, nuevos del año, peritos, maestrías/doctorados, expedientes completos/incompletos (tipos requeridos con documento vigente vs faltantes), documentos pendientes/vencidos, físicos/digitalizados, anualidades por estado.

## 6. Importador — mapeo del padrón real 2026

| Columna del listado | Destino | Regla |
|---|---|---|
| No. | — | Se ignora (es el orden del listado, no un número de miembro) |
| Nombre | `title` + nombres/apellidos | Se separa el prefijo (Ing/Arq, con o sin punto); la división nombre/apellidos se **propone** (últimos dos tokens = apellidos) y la secretaria la confirma en la pantalla de revisión |
| Celular | `phone` | Normalizado a 10 dígitos; vacío permitido |
| Anualidad 2026 | `payments.amount` | $1,500.00 → pago año 2026 |
| Observaciones "Pagado DD-MM-YYYY" | `payments.paid_at` | Tolerante a errores de dedo ("Pagadp"); **fechas fuera de 2026 (se detectaron "2025" y "2027") se marcan en amarillo para corrección manual** |
| Observaciones "Apoyo …" | `payments.kind = apoyo_en_especie` | El texto queda en `observations` |
| Sin observación | — | Anualidad queda `pendiente` (10 de los 38 miembros) |

El importador **siempre** muestra vista previa con advertencias antes de escribir nada, y todo queda ligado a su `import_batch`.

## 7. Pendientes (no bloquean esta fase)

- ¿Hay escáner en la oficina y qué formatos produce? → afecta el flujo de digitalización (Fase 4 — UX).
- Diseño visual del recibo PDF (logo, leyendas) → Fase 4.

## 8. Siguiente paso

Con la aprobación de este modelo → **Fase 4 — UX/UI**: mapa de navegación, wireframes de las pantallas del MVP (dashboard, lista de miembros, expediente, captura de pago, importador, configuración) y flujo de "menos clics" para las tareas diarias de la secretaria.
