# LectorMeta

> **Enlaces del proyecto**

**Link:** ``

**Repositorio en GitHub:** `https://github.com/HunabBohorquez/LectorMeta`

> 📝 **Nota:** este proyecto tiene los **mismos archivos** que el repositorio de GitLab
> (`index.html`, `styles.css`, `app.js`, `README.md`). Solo cambia la plataforma de alojamiento.

---

**Rastreador de lectura, ritmo y metas bibliográficas** construido con HTML5, CSS3 y JavaScript ES6+ Vanilla. Sin frameworks, sin librerías externas, sin dependencias de red: se abre con doble clic y funciona offline.

---

## 1. Descripción

LectorMeta es una aplicación web de una sola página que permite gestionar una biblioteca personal y, sobre todo, **entender el ritmo real de lectura**: cuántas páginas lees al día, cuánto te falta y en cuántos días terminarás cada libro.

Estética editorial: papel cálido, tipografía serif, reglas finas y tarjetas tipo ficha bibliográfica — deliberadamente alejada del *dashboard* genérico de tarjetas de colores planos.

### Funcionalidades

| Bloque | Detalle |
|---|---|
| **CRUD de libros** | Título, autor, género, páginas totales, páginas leídas, fecha de inicio, estado (Leyendo / Terminado / Pausado / Por leer), calificación de 1 a 5 estrellas y reseña/notas. |
| **Avance rápido** | Campo numérico en cada tarjeta para actualizar la página actual sin abrir el formulario. Recalcula porcentaje, páginas restantes, ritmo y estimación de finalización. |
| **Auto-finalización** | Si `páginas leídas == páginas totales`, el estado pasa automáticamente a **Terminado**. |
| **Meta anual** | Meta configurable de **libros** y de **páginas**, con barra de progreso real y porcentaje de cumplimiento. |
| **Estadísticas** | Libros terminados, páginas leídas, ritmo promedio global y libros en curso. |
| **Gráfico nativo** | Barras horizontales dibujadas en `<canvas>` con las páginas leídas por género (sin librerías). |
| **Persistencia** | `localStorage` con guardado automático en cada cambio. |
| **Demo** | Botón «Cargar Biblioteca Demo» con 5 libros de fechas y avances verificables. |
| **Respaldos** | Exportación a **JSON** (respaldo completo) y a **CSV** (hoja de cálculo). |
| **Validaciones** | Páginas positivas, páginas leídas ≤ páginas totales, enteros, fecha válida. |
| **Extras** | Buscador por título/autor/género, filtro por estado, *toasts*, modal accesible (Escape / clic en fondo), diseño responsive. |

---

## 2. Arquitectura

### 2.1 Archivos

```
LectorMeta/
├── index.html   → estructura semántica: cabecera, meta, gráfico, estadísticas, biblioteca y modal
├── styles.css   → sistema de diseño (variables CSS, componentes, responsive, prefers-reduced-motion)
├── app.js       → toda la lógica de la aplicación (11 módulos lógicos)
└── README.md    → este documento
```

### 2.2 Módulos lógicos de `app.js`

| # | Módulo | Responsabilidad |
|---|---|---|
| 1 | **Constantes** | `STORAGE_KEY`, `STATUS`, `STATUS_ORDER`, `DEFAULT_GOALS`, paleta del gráfico. |
| 2 | **Utilidades** | `uid`, `clamp`, `escapeHtml`, `round1`, formateadores `es-ES`, helpers de fecha (`todayISO`, `offsetISO`, `parseISO`, `daysBetween`, `formatDate`), `truncate`, `debounce`. |
| 3 | **Estado y persistencia** | Objeto `state` (`books`, `goals`, `filters`), `normalizeBook()` y el módulo `Storage` (load/save). |
| 4 | **Cálculos** | `computeMetrics()` (por libro), `computeGlobalStats()`, `computeGenreData()`, `filteredBooks()`. |
| 5 | **Render** | `renderGoals`, `renderStats`, `renderChart`, `renderBooks`, `bookCardHTML`, `renderStars`. |
| 6 | **Gráfico** | Objeto `Chart`: inicialización, `ResizeObserver`, escalado a `devicePixelRatio` y dibujo de barras. |
| 7 | **Formulario y modal** | Objeto `Form` (fill/read/errores), objeto `Modal`, `validateBook()`. |
| 8 | **CRUD y acciones** | `handleBookSubmit`, `updateProgress`, `deleteBook`, `loadDemoLibrary`. |
| 9 | **Exportación** | `exportJSON`, `exportCSV`, `downloadFile`, `csvCell`, `stamp`. |
| 10 | **Datos demo** | `buildDemoBooks()` con fechas relativas al día de carga. |
| 11 | **Eventos e init** | `toast`, `bindEvents` (delegación de eventos), `init`. |

### 2.3 Modelo de datos

```json
{
  "id": "bk_...",
  "title": "El nombre del viento",
  "author": "Patrick Rothfuss",
  "genre": "Fantasía",
  "totalPages": 872,
  "pagesRead": 436,
  "startDate": "2025-01-15",
  "status": "leyendo",
  "rating": 4,
  "review": "Texto libre",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

`status` ∈ `leyendo | terminado | pausado | por-leer`.

### 2.4 Fórmulas

```
porcentaje      = (paginasLeidas / paginasTotales) * 100
restantes       = max(0, paginasTotales - paginasLeidas)
diasTranscurridos = max(1, hoy - fechaInicio)        // mínimo 1 día si empezó hoy
ritmo           = paginasLeidas / diasTranscurridos   // págs/día
diasParaTerminar = ceil(restantes / ritmo)            // 0 si restantes == 0
```

**Criterios de agregación**

- **Meta de libros** → nº de libros con estado `terminado`.
- **Meta de páginas** → suma de `pagesRead` de **todos** los libros.
- **Ritmo promedio global** → media aritmética del ritmo de los libros en estado `leyendo` cuyo ritmo sea > 0 (si no hay ninguno, `0,0`).
- **Gráfico por género** → suma de `pagesRead` por género; los géneros con 0 páginas leídas no se dibujan.

> Los porcentajes se muestran con **coma decimal** (formato `es-ES`) y un decimal.

---

## 3. Instrucciones de ejecución

1. Crea una carpeta llamada `LectorMeta`.
2. Guarda dentro los cuatro archivos: `index.html`, `styles.css`, `app.js`, `README.md`.
3. Abre `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge, Safari).

No requiere servidor, ni instalación, ni conexión a internet.

**Opcional (servidor local):**

```bash
# Python 3
python -m http.server 8080
# y visita http://localhost:8080
```

**Primer uso:** pulsa **«Cargar Biblioteca Demo»** en la cabecera para poblar la app con 5 libros de ejemplo.

**Persistencia:** los datos viven en `localStorage` bajo la clave `lectormeta.v1`. Para reiniciar todo: `DevTools → Application → Local Storage → borrar la clave` (o exporta un JSON antes).

---

## 4. Casos de prueba verificables

> **Importante:** la biblioteca demo usa fechas **relativas al día de la carga**. Si llamamos **D** al día en que pulsas «Cargar Biblioteca Demo», las fechas son `D-40`, `D-20`, `D-10`, `D-60`. Los resultados siguientes son exactos **el mismo día de la carga** (al día siguiente, los ritmos bajan y la ETA sube, que es el comportamiento correcto).

### 4.1 Estado inicial tras cargar la demo

| # | Título | Págs. totales | Págs. leídas | Inicio | Estado |
|---|---|---|---|---|---|
| 1 | Cien años de soledad | 471 | 471 | D-40 | Terminado |
| 2 | El nombre del viento | 872 | 436 | D-20 | Leyendo |
| 3 | Sapiens: De animales a dioses | 496 | 124 | D-10 | Leyendo |
| 4 | La sombra del viento | 576 | 576 | D-60 | Terminado |
| 5 | Dune | 688 | 0 | *(sin fecha)* | Por leer |

### 4.2 Métricas por tarjeta (valores esperados exactos)

| Libro | % leído | Restantes | Días transcurridos | Ritmo | Termina en |
|---|---|---|---|---|---|
| Cien años de soledad | **100,0 %** | 0 | 40 | **11,8 págs/día** (471/40 = 11,775) | **¡Terminado!** (0 días) |
| El nombre del viento | **50,0 %** | 436 | 20 | **21,8 págs/día** (436/20) | **≈ 20 días** (ceil(436/21,8) = 20) |
| Sapiens | **25,0 %** | 372 | 10 | **12,4 págs/día** (124/10) | **≈ 30 días** (ceil(372/12,4) = 30) |
| La sombra del viento | **100,0 %** | 0 | 60 | **9,6 págs/día** (576/60) | **¡Terminado!** (0 días) |
| Dune | **0,0 %** | 688 | — | *Sin fecha de inicio* | **—** |

### 4.3 Meta anual (12 libros / 4.000 páginas)

| Indicador | Cálculo | Resultado mostrado |
|---|---|---|
| Libros terminados | 2 (Cien años, La sombra del viento) | **2 / 12** |
| % meta de libros | 2/12 = 16,666… % | **16,7 %** · faltan 10 libros |
| Páginas leídas | 471 + 436 + 124 + 576 + 0 | **1.607 / 4.000** |
| % meta de páginas | 1607/4000 = 40,175 % | **40,2 %** · faltan 2.393 páginas |

### 4.4 Estadísticas globales

| Indicador | Cálculo | Valor |
|---|---|---|
| Libros terminados | — | **2** (de 5 en biblioteca) |
| Páginas leídas | 471+436+124+576+0 | **1.607** (de 3.103 registradas) |
| Ritmo promedio global | (21,8 + 12,4) / 2 | **17,1 págs/día** |
| Leyendo ahora | — | **2** |

### 4.5 Gráfico «Páginas leídas por género»

Orden descendente esperado (Ciencia ficción **no** aparece porque tiene 0 páginas):

| Género | Páginas | % del total graficado (1.607) |
|---|---|---|
| Misterio | **576** | 35,8 % |
| Realismo mágico | **471** | 29,3 % |
| Fantasía | **436** | 27,1 % |
| Ensayo | **124** | 7,7 % |

### 4.6 Casos de actualización de avance

**Caso A — Avance parcial.** En «El nombre del viento», escribe `500` en *Página actual* y pulsa **Guardar**.

- % leído: 500/872 = 57,344 % → **57,3 %**
- Restantes: 872 − 500 = **372**
- Días transcurridos: **20** → Ritmo: 500/20 = **25,0 págs/día**
- Termina en: ceil(372/25) = ceil(14,88) = **≈ 15 días**
- Estado: sigue **Leyendo**

**Caso B — Finalización automática.** En «El nombre del viento», escribe `872` y pulsa **Guardar**.

- % leído: **100,0 %** · Restantes: **0**
- Ritmo: 872/20 = **43,6 págs/día** · Termina en: **¡Terminado!**
- Estado: cambia **automáticamente a Terminado** (con aviso «¡Has terminado…!»)
- Nuevas estadísticas: terminados **3**, páginas leídas **2.043** (1607 − 436 + 872)
- Meta de libros: 3/12 = 25,0 % → **25,0 %** · faltan 9 libros
- Meta de páginas: 2043/4000 = 51,075 % → **51,1 %** · faltan 1.957 páginas
- Ritmo promedio global: solo queda «Sapiens» en curso → **12,4 págs/día**

**Caso C — Libro sin fecha de inicio.** En «Dune», escribe `688` y pulsa **Guardar**.

- % leído: **100,0 %** · Restantes: **0** · Estado: **Terminado** (automático)
- Ritmo y ETA: **«Sin fecha de inicio»** / **—** (no hay fecha desde la que calcular)
- Páginas leídas totales: 1607 + 688 = **2.295**

**Caso D — Validación de página fuera de rango.** En «El nombre del viento», escribe `900` y pulsa **Guardar**.

- Mensaje mostrado bajo el campo: **«Este libro tiene 872 páginas.»**
- El libro **no** se modifica y la tarjeta permanece igual.

**Caso E — Validación de valor negativo.** Escribe `-5` y pulsa **Guardar**.

- Mensaje mostrado: **«La página no puede ser negativa.»** · Sin cambios.

**Caso F — Inicio hoy (mínimo 1 día).** Crea un libro con 100 páginas totales, 10 leídas y fecha de inicio = **hoy**.

- Días transcurridos: max(1, 0) = **1**
- Ritmo: 10/1 = **10,0 págs/día**
- Restantes: **90** → Termina en: ceil(90/10) = **≈ 9 días**

**Caso G — Persistencia.** Tras cualquier cambio, recarga la página (F5): todos los libros, avances y metas se conservan (leídos desde `localStorage`).

**Caso H — Respaldo.** Pulsa **Exportar JSON**: se descarga `lectormeta-respaldo-AAAAMMDD-HHMM.json` con `{ app, version, exportedAt, goals, books }`. Pulsa **Exportar CSV**: se descarga `lectormeta-biblioteca-AAAAMMDD-HHMM.csv` con 13 columnas (título, autor, género, páginas totales, páginas leídas, % leído, restantes, fecha de inicio, estado, calificación, ritmo, días estimados, reseña) y BOM UTF-8 para Excel.

---

## 5. Validaciones implementadas

- **Título y autor** obligatorios.
- **Páginas totales**: entero > 0.
- **Páginas leídas**: entero ≥ 0 y **≤ páginas totales** (en formulario y en avance rápido).
- **Fecha de inicio**: si se informa, debe ser una fecha real (`YYYY-MM-DD`).
- **Coherencia**: si hay páginas leídas > 0, se exige fecha de inicio para poder calcular el ritmo.
- **Metas**: enteros positivos.
- **Normalización defensiva**: al cargar desde `localStorage`, cualquier libro corrupto se sanea (`pagesRead` se recorta al rango `[0, totalPages]`, estados inválidos se convierten en `por-leer`, y `pagesRead === totalPages` fuerza `terminado`).

---

## 6. Accesibilidad y responsive

- HTML semántico (`header`, `main`, `section`, `article`, `nav`, `dl/dt/dd`).
- `skip-link`, `aria-label` en botones icónicos, `role="dialog"` + `aria-modal` en el modal.
- Cierre del modal con **Escape**, clic en el fondo o botón ×.
- `role="alert"` en errores de formulario y `role="status" aria-live="polite"` en el *toast*.
- `:focus-visible` con contorno visible en todos los controles.
- Respeto a `prefers-reduced-motion`.
- Rejillas fluidas (`auto-fill` / `minmax`) y *breakpoints* a 940 px y 640 px.
- El `<canvas>` se redimensiona con `ResizeObserver` y se escala por `devicePixelRatio` para verse nítido en pantallas HiDPI.

---

## 7. Posibles extensiones

- Historial de sesiones de lectura (para un ritmo más preciso que el promedio acumulado).
- Filtrado de metas por año natural (requiere campo `finishedAt`).
- Importación de respaldos JSON.
- Modo oscuro con `prefers-color-scheme`.
