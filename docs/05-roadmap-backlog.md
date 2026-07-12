# Roadmap del producto y backlog inicial priorizado

**Proyecto:** AMS — Colegio de Especialistas en Valuación Profesional de Chiapas A.C.
**Fecha:** 2026-07-12
**Estado:** ✅ Aprobado. **Fase 5 autorizada por Victor el 2026-07-11** — el código vive en `app/`. Avance: **M0 ✔ · M1 ✔ · M2 (cobranza) ✔ · M3 (expedientes) ✔** — construidos y verificados (typecheck + smoke + build). M1: CRUD de miembros con número automático, validación CURP/RFC, estados con historial, búsqueda FTS instantánea, filtros, papelera, exportación a Excel. **Importador (E-03) cancelado 2026-07-11 — alta manual.** M2: cuotas por año, pagos (pago/apoyo en especie/condonación), estado de anualidad calculado (exenta/cubierta/parcial/pendiente), recibo PDF con folio (pdfkit), vista Anualidades con edición de cuota. **M3 (2026-07-12):** módulo de expedientes por miembro (requeridos + opcionales), subida por diálogo nativo con almacén por hash (deduplicado), versionado, estado (pendiente/vigente/rechazado + vencido derivado, nunca almacenado), marca de físico + ubicación, barra de progreso; **visor de credencial** (anverso/reverso) — Victor diseña la credencial en Illustrator, el sistema solo la carga y previsualiza/descarga por miembro; **buscador persistente** (FTS de miembros) visible en todas las vistas vía barra superior; botones **"+ Nuevo Miembro" / "+ Nuevo Pago"** accesibles desde cualquier vista; tarjeta de **documentos por vencer (30 días)** en el dashboard, diseñada para lectura fácil (persona mayor); **modo oscuro** con toggle persistido. Auditoría cubre todo lo anterior por eventos. Logo del Colegio: pendiente.

**Adelanto de alcance sobre v1.1 (decidido con Victor el 2026-07-12):** el recordatorio de vencimientos, el visor de credencial y el modo oscuro estaban previstos para v1.1/v2 y se adelantaron dentro de M3 por ser costuras baratas con lo recién construido. **Control de asistencias sigue en cola, después de M4** (blindaje/respaldos) — se construirá como asambleas/reuniones con lista de asistentes tomada de `members`, quórum en vivo y auditoría por evento; no se ha diseñado su modelo de datos todavía.

**M3 CERRADA (2026-07-12).** Al comparar contra `docs/04-ux-ui.md` §3 se detectaron 5 brechas frente a lo aprobado; Victor autorizó resolver todas menos la prueba manual (que ya se viene haciendo en paralelo):
- **Arrastrar y soltar** (prometido en 04-ux-ui.md §3 como el flujo principal) — construido: `webUtils.getPathForFile` + `documents:upload-from-path`, zona de arrastre en el expediente y en la credencial.
- **Notas por documento** — construido: campo antes solo de lectura, ahora editable (`documents:set-notes`).
- **Indicadores accionables del dashboard** (E-06) — construido parcialmente: la tarjeta "Miembros" navega a la lista; las demás (Usuarios/Tablas/Versión) quedan informativas.
- **Catálogo de tipos de documento editable** (E-09) — construido: vista Configuración habilitada, con alta/edición/archivado (`documents:list-types/create-type/update-type/set-type-active`).
- Prueba manual en la app real: en curso por Victor y la secretaria, no bloquea el cierre.

Con esto, M3 queda completo según el diseño aprobado.

---

## 1. Roadmap

### v1.0 — MVP (lo diseñado en las fases 1–4)
Meta: la secretaria administra padrón, expedientes y anualidades sin papel ni Excel, con respaldos automáticos. Es el contenido de los hitos M0–M5 de abajo.

### v1.1 — Pulido posterior a la adopción
Se prioriza con lo aprendido del uso real (Fase 8 en adelante): carpeta vigilada de documentos, credencial de miembro en PDF, diseño formal del recibo (pendiente de Victor), recordatorios visuales de vencimientos, reportes adicionales, modo oscuro.

### v2 — Según demanda del Colegio
Asistencias, eventos, certificaciones y constancias, votaciones, comités, encuestas, directorio.
⚠ **Advertencia registrada:** varios módulos de la visión original (portal del miembro, app móvil, correos automáticos, facturación CFDI, firma electrónica) **requieren internet permanente o un servidor en la nube**. Con la infraestructura actual (oficina sin internet) no tienen sustento; se reevaluarán solo si cambia esa condición. La arquitectura los permite (UUIDs, Drizzle→PostgreSQL, borrado lógico), pero no se diseñan ahora.

## 2. Hitos del MVP — orden de construcción

Cada hito termina en algo demostrable que Victor puede ver funcionando. Sin fechas: dependen de la cadencia de trabajo; el orden sí es compromiso.

| Hito | Contenido | Al terminarlo, el sistema sirve para… |
|---|---|---|
| **M0 · Cimientos** | Esqueleto electron-vite + TypeScript; SQLite + Drizzle + migraciones al arranque; capa IPC tipada con zod; autenticación local; bus de eventos; semillas de catálogos | Nada visible aún — es la base técnica de todo |
| **M1 · Padrón** ✅ | Módulo de miembros completo (alta en 3 campos, expediente-ficha, estados con historial, búsqueda FTS5, filtros, exportar a Excel). Sin importador — alta manual por decisión de Victor (2026-07-11) | Consultar y mantener el padrón manualmente |
| **M2 · Cobranza** ✅ | Cuotas por año, pagos (parciales, apoyos en especie, condonaciones, adeudos), vista Anualidades, estado calculado, **recibo PDF con folio** | Registrar pagos y saber al instante quién debe |
| **M3 · Expedientes** | Tipos de documento configurables, subir/arrastrar con versionado, marca de físico, vencimientos, barra de progreso, dashboard completo | Control documental de los 7 requeridos |
| **M4 · Blindaje** | Respaldos automáticos (local + USB + Cloudflare R2), kit de recuperación, restauración integrada, papelera universal, auditoría, auto-bloqueo | **Uso en producción.** Regla dura: no se captura información real antes de M4 |
| **M5 · Entrega** | Instalador NSIS, actualizaciones automáticas, asistente de primera ejecución, prueba de 5 tareas con la secretaria, ajustes de microcopy | Instalar en la laptop y arrancar en serio |

## 3. Backlog priorizado (épicas y historias clave)

Tamaños: S (días), M (≈1 semana), L (>1 semana), como referencia relativa.

| # | Épica | Historias clave | Hito | Tamaño |
|---|---|---|---|---|
| E-01 | Cimientos técnicos | Scaffold electron-vite; Drizzle + better-sqlite3 + migrador; contratos IPC zod + cliente tipado; argon2id + sesión; bus de eventos; reglas de lint de fronteras entre módulos | M0 | L |
| E-02 | Miembros | CRUD con validación de CURP/RFC; número automático configurable; estados + historial + motivo; FTS5 con triggers; filtros combinables; exportar Excel | M1 | L |
| ~~E-03~~ | ~~Importador~~ | **Cancelada 2026-07-11** — alta manual por decisión de Victor | — | — |
| E-04 | Anualidades y pagos | Catálogo de cuotas por año; registro de pagos (3 tipos); estado calculado en vista SQL; pantalla Anualidades por año; recibo PDF con folio secuencial | M2 | L |
| E-05 | Expediente documental | Almacén por hash; arrastrar y clasificar; versiones con historial; físico + ubicación; vencimientos derivados; barra de progreso por los 7 requeridos | M3 | L |
| E-06 | Dashboard | Vistas SQL agregadas; indicadores accionables (clic = lista filtrada); listas de pendientes con teléfono y pago en línea | M3 | M |
| E-07 | Respaldos | Snapshot consistente (VACUUM INTO); paquete cifrado AES-256-GCM; subida a R2 con verificación; rotación GFS; copia local diaria; USB designada; restauración guiada; kit de recuperación imprimible | M4 | L |
| E-08 | Seguridad transversal | Papelera con restauración en todas las entidades; auditoría append-only por eventos; auto-bloqueo configurable | M4 | M |
| E-09 | Configuración | Organización (datos y logo); catálogos editables (tipos de documento, cuotas, estados, tipos de membresía); usuarios y contraseñas; ajustes de respaldo | M3–M4 | M |
| E-10 | Distribución | electron-builder NSIS; electron-updater vía GitHub Releases; asistente de primera ejecución (organización → usuarios → kit → importar) | M5 | M |

## 4. Criterio de terminado del MVP

- La secretaria completa las 5 tareas de `04-ux-ui.md` §3 sin ayuda.
- El padrón 2026 real importado sin pérdida (38 miembros, pagos y apoyos correctos).
- Restauración completa verificada en una máquina distinta usando solo el instalador + kit de recuperación + respaldo de R2.
- Auditoría registra alta/edición/borrado/pago/subida/inicio de sesión.
- Sin datos reales en repositorios, artifacts ni servicios externos: solo el respaldo cifrado en R2.

## 5. Siguiente paso

Este documento cierra los 10 puntos de la forma de trabajo acordada (análisis, arquitectura, base de datos, navegación, roadmap y backlog — todos aprobados o entregados). **Falta únicamente la autorización explícita de Victor para escribir código** → arranca Fase 5 con la épica E-01 (hito M0).
