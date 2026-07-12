# Fase 1 — Análisis de requerimientos (v2)

**Proyecto:** AMS — Colegio de Ingenieros de Tapachula, Chiapas
**Fecha:** 2026-07-11
**Estado:** ✅ **Fase 1 cerrada (2026-07-11).** Arquitectura local-first aprobada; respaldo en Cloudflare R2; supuestos S1–S3 confirmados. No se ha escrito código. Continúa en `02-arquitectura.md`.

> **Cambio de alcance (2026-07-11):** Victor descartó la visión SaaS multiempresa y el soporte multiplataforma. La v1 es **solo Windows** y **para una sola organización**. La v1 del documento (análisis con enfoque SaaS) queda superseded por esta versión.

---

## 1. Hechos clave del contexto (confirmados por Victor)

| Hecho | Implicación |
|---|---|
| Una sola PC (laptop de la secretaria) | No se necesita servidor ni base de datos compartida |
| **No hay internet en la oficina**; solo en casa de la secretaria | La app debe correr 100% local; la nube solo sirve para respaldos |
| Se consulta y captura también fuera de la oficina | Interpretación: la misma laptop viaja con ella (por confirmar) |
| Datos actuales: mezcla de Excel y papel | El importador de Excel y el flujo de digitalización son críticos |
| Requisito explícito: al detectar internet, **solo respaldar** | No hay sincronización multi-dispositivo; solo backup unidireccional |

## 2. Arquitectura propuesta: aplicación de escritorio autónoma (local-first)

```
┌─────────────────────────── Laptop Windows ───────────────────────────┐
│  Electron                                                            │
│  ├─ Renderer: React + TypeScript + Tailwind + shadcn/ui (la UI)      │
│  ├─ Main process: lógica de negocio por módulos + Prisma             │
│  │   (comunicación renderer ↔ main por IPC tipado)                   │
│  ├─ SQLite (archivo local): toda la base de datos                    │
│  └─ Carpeta administrada de documentos (PDFs, imágenes)              │
│                                                                      │
│  Servicio de respaldo: al detectar internet → respaldo automático    │
│  comprimido, cifrado y versionado hacia la nube (+ copia local/USB)  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Sin servidor, sin NestJS, sin PostgreSQL/Supabase en el MVP.** Con una sola máquina y sin internet en la oficina, un backend en la nube no puede ser parte del camino crítico de la operación.
- La "app siempre funciona sin internet" deja de ser un problema de sincronización: es la condición natural del sistema. El requisito offline queda cumplido por diseño.
- Costo de infraestructura: ~$0/mes (solo el almacenamiento de respaldos, centavos).

### Stack revisado y justificación

| Componente | Antes (preferencia) | Ahora | Justificación |
|---|---|---|---|
| UI | React + TS + Tailwind + shadcn/ui | **Igual** | Sin cambios |
| Escritorio | Electron | **Igual** | Sin cambios |
| Backend | NestJS | **Módulos de negocio en el main process de Electron** | No hay red disponible en la oficina; un servidor no aporta nada y agrega fallas |
| Base de datos | PostgreSQL en la nube | **SQLite local** | Único motor viable sin internet; robusto, cero administración |
| ORM | Prisma | **Prisma (con SQLite)** | Se conserva; además deja abierta una migración futura a PostgreSQL |
| Archivos | Supabase Storage / S3 | **Carpeta local administrada** | Los documentos deben abrirse sin internet |
| Nube | — | **Solo destino de respaldos** | Requisito explícito de Victor |

### Principios que se conservan aunque el alcance se redujo

- **Modularidad estricta**: módulos independientes (miembros, documentos, pagos, auditoría, configuración) con fronteras limpias; agregar un módulo no toca los existentes.
- **UUIDs, borrado lógico (papelera), `updated_at` en todo**: costo cero hoy; si algún día se quiere nube o web, la migración es viable sin rediseño.
- **Tabla `organization` con un solo registro**: guarda nombre, logo, RFC, configuración — lo que ya pedía el requerimiento — sin maquinaria multi-tenant.
- **Tipos de documento y requisitos de expediente configurables por datos**, no por código.
- **Auditoría local** de toda acción importante (usuario, fecha/hora, dispositivo).

## 3. Estrategia de respaldo (el punto más delicado del nuevo diseño)

Una sola laptop = **punto único de falla**. Si el disco muere o la laptop se pierde/roba, se pierde todo lo capturado desde el último respaldo. Como el internet solo está en casa, el respaldo a nube ocurrirá a lo sumo una vez al día → **en el peor caso se pierde un día de trabajo**.

Diseño propuesto:
1. **Respaldo a nube automático**: al detectar internet, si el último respaldo tiene más de N horas, se genera un paquete (base de datos + documentos nuevos), comprimido y **cifrado**, y se sube. Indicador visible en la app: "Último respaldo: hoy 8:15 pm ✓". Cero clics.
2. **Respaldo local diario adicional** (en la propia máquina, rotando N copias): protege contra corrupción del archivo de base de datos.
3. **Respaldo a USB en la oficina (recomendado)**: copia automática al detectar una memoria USB designada. Mitiga el hueco de "sin internet durante el día".
4. **Restauración integrada en la app**: recuperar desde cualquier respaldo sin asistencia técnica.

**Decisión tomada (2026-07-11): Cloudflare R2.** Victor propuso Cloudflare Pages (donde aloja lummen.art) o su Google Drive personal. Pages no es almacenamiento escribible (solo publica sitios estáticos), pero la misma cuenta de Cloudflare da acceso a R2, que resultó la mejor opción. Comparativa evaluada:

| Opción | Ventajas | Desventajas |
|---|---|---|
| A. Backblaze B2 / S3 ⭐ | Muy barato (~centavos/mes), diseñado para esto, versionado nativo | Requiere crear una cuenta |
| B. Google Drive de la organización | Familiar, 15 GB gratis | Integración OAuth más frágil a largo plazo |

## 4. Seguridad revisada

- **Cifrado de respaldos: siempre** (el paquete que sube a la nube va cifrado con llave propia).
- **Cifrado del disco local**: recomendar activar BitLocker/cifrado de dispositivo de Windows en la laptop (protege CURP, RFC, INE ante robo del equipo). Alternativa más fuerte: base de datos cifrada con SQLCipher, pero implicaría sustituir Prisma por otro acceso a datos — no lo recomiendo para el MVP salvo que Victor lo pida.
- Autenticación local con usuario y contraseña; roles y permisos se mantienen en el diseño (aunque al inicio solo haya un usuario).
- LFPDPPP: sigue aplicando (datos personales de miembros); aviso de privacidad y control de acceso.

## 5. Vigente del análisis anterior

- **Importador de Excel/CSV con vista previa y validación** — crítico ("mezcla de todo" lo confirma).
- **Flujo de digitalización eficiente** (escanear → clasificar → adjuntar al expediente en mínimos pasos) será el corazón del uso diario.
- Campos y estados: agregar "Vitalicio"/"Honorario" como posibles estados/categorías; historial de cambios de estado.
- Requisitos de expediente configurables → alimentan la barra de progreso.
- Tipos de membresía con cuota propia; PDFs (credencial, constancia, recibo); alertas en dashboard; exportar a Excel; búsqueda global tipo Cmd+K.
- El modelo de pagos nace con campos fiscales pensando en CFDI futuro, sin construir timbrado.

## 6. Supuestos — confirmados (2026-07-11)

- S1. ✅ Confirmado, con un dato adicional importante: la laptop es **personal de la secretaria**, viaja siempre con ella y **ella es la única usuaria del sistema**. Implicación de gobernanza: datos confidenciales del Colegio (CURP, RFC, INE) en un equipo que no es de la organización → mitigar con cifrado de disco (BitLocker/cifrado de dispositivo), auto-bloqueo de la app con contraseña, y respaldos bajo control de Victor (cuenta R2 propia) con kit de recuperación fuera de la laptop.
- S2. ✅ Interfaz solo en español.
- S3. ✅ Usuaria única (secretaria) + cuenta administrador (Victor).

## 7. Preguntas pendientes — ✅ resueltas (2026-07-11)

Resueltas al iniciar Fase 3 con el padrón real (`Miembros Colegio Valuadores Registrados2026.pdf`) y decisiones de Victor; el detalle vive en `03-modelo-datos.md` §1. Resumen: cuota general $1,500 (2026) con apoyos en especie; pagos parciales y adeudos sí; numeración la asigna el sistema; historial completo de versiones; recibos PDF desde el MVP. **Además se corrigió el nombre de la organización: Colegio de Especialistas en Valuación Profesional de Chiapas A.C.** Sigue abierto (para Fase 4): ¿hay escáner en la oficina?

## 8. Cierre

Aprobados: (a) arquitectura local-first, (b) Cloudflare R2 como destino de respaldo, (c) supuestos S1–S3. **Fase 1 cerrada el 2026-07-11.** La Fase 2 (Arquitectura) vive en `02-arquitectura.md`. Las preguntas de la sección 7 se resolverán al iniciar Fase 3 (Modelo de datos).
