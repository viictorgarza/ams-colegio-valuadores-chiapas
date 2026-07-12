# Fase 4 — UX/UI

**Proyecto:** AMS — Colegio de Especialistas en Valuación Profesional de Chiapas A.C.
**Fecha:** 2026-07-11
**Estado:** ✅ **Fase 4 cerrada (2026-07-11) — aprobada por Victor.** Al cerrar, Victor confirmó los datos mínimos del miembro (celular, casa, correo + 7 documentos requeridos — ver `03-modelo-datos.md` §4.3); las cifras "9 de 9" del mockup son ilustrativas, la lista real de requeridos es la del modelo. Continúa en `05-roadmap-backlog.md`.
**Mockup navegable:** `docs/mockups/04-mockup-mvp.html` — publicado en https://claude.ai/code/artifact/6b936f38-29cb-4b79-a2a7-2403ac21f3d6 (privado; verificado en modo claro y oscuro). Los nombres del mockup son **ficticios** — no se usan datos reales del padrón fuera de la laptop.

---

## 1. Principios de diseño (derivados de la usuaria)

1. **Las tareas diarias a dos clics o menos** desde cualquier pantalla: buscar un miembro, registrar un pago, subir un documento.
2. **Búsqueda global omnipresente** (`Ctrl+K` o clic): teclear parte del nombre, número, CURP o teléfono y llegar al expediente.
3. **Cero jerga técnica.** "Respaldo", no "sync"; "Papelera", no "soft delete". Todo el texto en español operativo de oficina.
4. **Nada da miedo.** No hay borrado definitivo desde la interfaz: todo va a la Papelera y se puede restaurar. Confirmaciones suaves, deshacer donde aplica.
5. **El sistema informa sin interrumpir.** Estado del respaldo siempre visible en la barra lateral; los avisos (documentos por vencer, adeudos) viven en Inicio, no en ventanas emergentes.

## 2. Mapa de navegación

```
Barra lateral (siempre visible)
├─ Inicio ······················ dashboard con indicadores y listas accionables
├─ Miembros ···················· lista + búsqueda + filtros
│    └─ Expediente ············· pestañas: Información · Documentos · Pagos · Historial
├─ Anualidades ················· vista por año: quién pagó, parciales, adeudos, apoyos
└─ Configuración ··············· Organización · Tipos de documento · Cuotas · Usuarios
                                 · Respaldos · Papelera

Siempre disponibles (barra superior)
├─ Búsqueda global (Ctrl+K)
├─ + Nuevo miembro
└─ $ Registrar pago

Modales (no cambian de pantalla)
├─ Registrar pago (desde cualquier lugar, precargado si hay miembro en contexto)
├─ Subir documento (o arrastrar el archivo directamente sobre el tipo)
├─ Nuevo miembro (3 campos mínimos; el resto se completa después)
└─ Importar padrón (3 pasos: elegir archivo → revisar avisos → confirmar)

Pie de la barra lateral
└─ ● Respaldo: hoy 8:15 p.m. · Usuario activo · Bloquear (Ctrl+L)
```

## 3. Flujos de mínimos clics (las 5 tareas que definen el día)

| Tarea | Flujo | Clics |
|---|---|---|
| Registrar un pago | `Ctrl+K` → teclear nombre → Enter abre expediente → "Registrar pago" (monto, año y fecha ya precargados) → Guardar e imprimir recibo | **3** |
| ¿Quién no ha pagado? | Inicio → tarjeta "Pendientes" → lista con **teléfono visible** (para llamar) y botón de pago en cada fila | **1** |
| Subir un documento | Expediente → arrastrar la foto/PDF **sobre el tipo de documento** → confirmar | **1 + arrastre** |
| Alta de miembro | "+ Nuevo miembro" → título, nombre y celular → Guardar (el expediente se completa con el tiempo) | **2** |
| Reporte para la mesa directiva | Cualquier lista filtrada → "Exportar a Excel" | **2** |

Reglas transversales: `Enter` guarda en cualquier modal, `Esc` cierra, los montos y fechas siempre llegan precargados con el valor más probable (cuota vigente, fecha de hoy).

## 4. Documentos sin escáner (dato confirmado: no hay escáner en la oficina)

El flujo real será: **foto con el teléfono → pasar a la laptop → arrastrar al expediente.**

- La app acepta **JPG, PNG, HEIC y PDF** — una foto de teléfono es un documento válido de primera clase.
- Transferencia recomendada a la usuaria: cable USB o la app "Enlace móvil" de Windows (funciona sin internet, por Bluetooth/red directa); en casa también sirve WhatsApp Web.
- La zona de arrastre existe en todo el expediente: soltar el archivo sobre el tipo de documento correcto lo clasifica en un paso.
- Idea evaluada y pospuesta: carpeta vigilada de "entrada" que auto-detecte archivos nuevos — se decidirá tras probar con la usuaria (Fase 8).

## 5. Primera ejecución (asistente de configuración)

1. Datos de la organización (nombre, logo, RFC).
2. Cuenta administrador (Victor) y cuenta de la secretaria.
3. **Frase de recuperación** → imprimir el kit (D9); no se puede continuar sin confirmar que se guardó.
4. Importar el padrón desde Excel/CSV (opcional, se puede hacer después).
5. Listo — aterriza en Inicio.

## 6. Estados vacíos, errores y bloqueo

- Toda lista vacía explica qué es y ofrece la acción ("Aún no hay pagos en 2026 — Registrar el primero").
- Errores en lenguaje llano y con salida: qué pasó + qué hacer. Nunca códigos ni jerga.
- **Auto-bloqueo** tras N minutos (configurable): la pantalla se cubre y pide contraseña; el trabajo en curso no se pierde.

## 7. Sistema visual

- **Tipografía: Segoe UI** (la del sistema en Windows) — decisión deliberada: la app debe sentirse nativa y render instantáneo, no una página web. Jerarquía por peso y tamaño; números tabulares en tablas y montos.
- **Color:** el **azul institucional del Colegio** (`#163EAB`, confirmado por Victor el 2026-07-11; sustituye al verde petróleo provisional) como acento, sobre neutros fríos con el mismo sesgo azul. En modo oscuro el acento usa un paso más claro del mismo azul (`#7E9BE8`) para mantener contraste legible. Los colores de estado (verde=cubierto/vigente, ámbar=parcial/por vencer/avisos, rojo=vencido/adeudo) son **independientes del acento** y siempre acompañan a un texto o ícono, nunca color solo.
- **Densidad:** cómoda, mucho blanco, rejilla de 4 px; bordes suaves, sombras mínimas. Modo claro por defecto; la estructura de tokens deja el modo oscuro listo para después.
- Chips de estado con punto/ícono + palabra; barras de progreso de un solo tono (acento); nada de gráficas decorativas en el MVP — los indicadores del dashboard son números grandes accionables (clic = lista filtrada).

## 8. Qué muestra el mockup (6 pantallas)

1. **Inicio** — indicadores accionables + lista de anualidades pendientes con teléfono y pago en línea + documentos por vencer + estado de respaldo.
2. **Miembros** — búsqueda inmediata, chips de filtro, tabla con estado de anualidad y progreso de expediente por fila.
3. **Expediente** — encabezado con foto/estado/acciones, barra de progreso documental, pestaña Documentos con checklist, marca de "físico" y zona de arrastre.
4. **Registrar pago** — modal precargado: año con indicador de adeudo, cuota completa sugerida, tipo pago/apoyo/condonación, folio de recibo visible.
5. **Importar** — paso "Revisar": avisos en ámbar con sugerencia de corrección (fechas imposibles del padrón real, apoyos en especie detectados).
6. **Configuración** — Tipos de documento: requerido/vence/múltiple editables y "Agregar tipo" (cero código para tipos nuevos).

## 9. Pendientes

- Diseño visual del recibo PDF — Victor lo definirá después (no bloquea).
- Prueba de 5 tareas con la secretaria sobre la app real (Fase 8 — Pruebas).
- Modo oscuro: fuera del MVP; los tokens ya lo permiten.

## 10. Siguiente paso

Con la aprobación del UX → entrego **roadmap del producto y backlog inicial priorizado** (puntos 9 y 10 de la forma de trabajo acordada) y, con tu autorización explícita, arranca la **Fase 5 — Backend** (primer código del proyecto).
