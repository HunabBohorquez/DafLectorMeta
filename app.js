'use strict';

/* =====================================================================
   LectorMeta · app.js
   Rastreador de lectura, ritmo y metas bibliográficas.
   JavaScript ES6+ Vanilla — sin frameworks ni librerías externas.

   MÓDULOS LÓGICOS
     1. Constantes y configuración
     2. Utilidades (fechas, formato, DOM, escape)
     3. Estado y persistencia (localStorage)
     4. Cálculos (métricas por libro, agregados globales)
     5. Render (metas, estadísticas, tarjetas, leyenda)
     6. Gráfico nativo en <canvas>
     7. Formulario y modal (validación)
     8. CRUD y acciones (crear, editar, borrar, avance rápido)
     9. Exportación (JSON / CSV)
    10. Biblioteca demo
    11. Eventos e inicialización
   ===================================================================== */

/* =====================================================================
   1. CONSTANTES Y CONFIGURACIÓN
   ===================================================================== */

const STORAGE_KEY = 'lectormeta.v1';
const APP_VERSION = 1;

const STATUS = {
  'leyendo':   { label: 'Leyendo',   css: 'is-reading'  },
  'terminado': { label: 'Terminado', css: 'is-finished' },
  'pausado':   { label: 'Pausado',   css: 'is-paused'   },
  'por-leer':  { label: 'Por leer',  css: 'is-toread'   }
};

const STATUS_ORDER = { 'leyendo': 0, 'pausado': 1, 'por-leer': 2, 'terminado': 3 };

const DEFAULT_GOALS = { books: 12, pages: 4000 };

const CHART_COLORS = [
  '#a63f2b', '#2f5d50', '#c98a3c', '#5b6ea8',
  '#8a5a83', '#4a7a96', '#7a8b3c', '#8a6f4e'
];

const CHART_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/* =====================================================================
   2. UTILIDADES
   ===================================================================== */

const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Identificador único simple. */
function uid() {
  return 'bk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Restringe un número a un rango. */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Escapa texto para insertarlo como HTML. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Redondeo a 1 decimal evitando errores de coma flotante. */
function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

/** Entero con separador de miles es-ES (1607 -> "1.607"). */
function formatInt(n) {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));
}

/** Número con 1 decimal es-ES (21.8 -> "21,8"). */
function formatDec(n) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(round1(n));
}

/** Fecha ISO local (YYYY-MM-DD) a partir de un objeto Date. */
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fecha de hoy en formato ISO local. */
function todayISO() {
  return toISO(new Date());
}

/** Fecha ISO desplazada N días hacia atrás respecto a hoy. */
function offsetISO(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return toISO(d);
}

/** Convierte "YYYY-MM-DD" en Date local (o null si es inválida). */
function parseISO(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const parts = iso.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Diferencia en días entre dos fechas ISO (b - a). */
function daysBetween(startISO, endISO) {
  const a = parseISO(startISO);
  const b = parseISO(endISO);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

/** Fecha legible: "12 mar 2025". */
function formatDate(iso) {
  const date = parseISO(iso);
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric'
  }).format(date);
}

/** Recorta una cadena larga para el canvas. */
function truncate(text, max) {
  const s = String(text ?? '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Debounce sencillo. */
function debounce(fn, wait = 160) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* =====================================================================
   3. ESTADO Y PERSISTENCIA
   ===================================================================== */

const state = {
  books: [],
  goals: { ...DEFAULT_GOALS },
  filters: { search: '', status: 'all' }
};

/** Normaliza un libro crudo (de localStorage, del formulario o de la demo). */
function normalizeBook(raw) {
  const totalPages = Math.max(1, Math.round(Number(raw.totalPages) || 0));
  const pagesRead = clamp(Math.round(Number(raw.pagesRead) || 0), 0, totalPages);
  let status = STATUS[raw.status] ? raw.status : 'por-leer';
  if (pagesRead >= totalPages) status = 'terminado';

  return {
    id: String(raw.id || uid()),
    title: String(raw.title || '').trim() || 'Sin título',
    author: String(raw.author || '').trim() || 'Anónimo',
    genre: String(raw.genre || '').trim() || 'Sin género',
    totalPages,
    pagesRead,
    startDate: parseISO(raw.startDate) ? raw.startDate : '',
    status,
    rating: clamp(Math.round(Number(raw.rating) || 0), 0, 5),
    review: String(raw.review || '').trim(),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return {
        books: Array.isArray(data.books) ? data.books.map(normalizeBook) : [],
        goals: {
          books: Math.max(1, Math.round(Number(data?.goals?.books) || DEFAULT_GOALS.books)),
          pages: Math.max(1, Math.round(Number(data?.goals?.pages) || DEFAULT_GOALS.pages))
        }
      };
    } catch (error) {
      console.warn('[LectorMeta] No se pudo leer localStorage:', error);
      return null;
    }
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: APP_VERSION,
        savedAt: new Date().toISOString(),
        goals: state.goals,
        books: state.books
      }));
    } catch (error) {
      console.warn('[LectorMeta] No se pudo guardar en localStorage:', error);
      toast('No se pudo guardar: almacenamiento lleno o bloqueado.');
    }
  }
};

/* =====================================================================
   4. CÁLCULOS
   ===================================================================== */

/**
 * Métricas derivadas de un libro.
 * - daysElapsed: días desde la fecha de inicio (mínimo 1 si empezó hoy).
 * - pace: páginas por día = páginas leídas / días transcurridos.
 * - daysToFinish: ceil(páginas restantes / ritmo). 0 si ya está terminado.
 */
function computeMetrics(book) {
  const total = book.totalPages;
  const read = book.pagesRead;
  const remaining = Math.max(0, total - read);
  const percent = total > 0 ? clamp((read / total) * 100, 0, 100) : 0;

  let daysElapsed = null;
  let pace = null;
  let daysToFinish = null;

  if (book.startDate) {
    const diff = daysBetween(book.startDate, todayISO());
    daysElapsed = Math.max(1, diff === null ? 1 : diff);
    pace = read / daysElapsed;

    if (remaining === 0) {
      daysToFinish = 0;
    } else if (pace > 0) {
      daysToFinish = Math.ceil(remaining / pace);
    } else {
      daysToFinish = null;
    }
  }

  return { total, read, remaining, percent, daysElapsed, pace, daysToFinish };
}

/** Agregados globales de la biblioteca. */
function computeGlobalStats() {
  const finished = state.books.filter(b => b.status === 'terminado');
  const reading = state.books.filter(b => b.status === 'leyendo');

  const pagesReadTotal = state.books.reduce((sum, b) => sum + b.pagesRead, 0);
  const pagesTotal = state.books.reduce((sum, b) => sum + b.totalPages, 0);

  const paces = reading
    .map(b => computeMetrics(b).pace)
    .filter(p => typeof p === 'number' && p > 0);

  const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : 0;

  return {
    finishedCount: finished.length,
    readingCount: reading.length,
    pagesReadTotal,
    pagesTotal,
    avgPace
  };
}

/** Páginas leídas agrupadas por género, ordenadas de mayor a menor. */
function computeGenreData() {
  const map = new Map();
  state.books.forEach(book => {
    if (book.pagesRead <= 0) return;
    const key = book.genre || 'Sin género';
    map.set(key, (map.get(key) || 0) + book.pagesRead);
  });
  return Array.from(map, ([genre, pages]) => ({ genre, pages }))
    .sort((a, b) => b.pages - a.pages);
}

/** Libros visibles según búsqueda + filtro de estado, ordenados por estado. */
function filteredBooks() {
  const { search, status } = state.filters;
  return state.books
    .filter(book => {
      if (status !== 'all' && book.status !== status) return false;
      if (!search) return true;
      const haystack = `${book.title} ${book.author} ${book.genre}`.toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => {
      const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      return diff !== 0 ? diff : a.title.localeCompare(b.title, 'es');
    });
}

/* =====================================================================
   5. RENDER
   ===================================================================== */

function renderAll() {
  renderGoals();
  renderStats();
  renderChart();
  renderBooks();
}

/* ---------------------------- 5.1 Metas ----------------------------- */

function renderGoals() {
  const stats = computeGlobalStats();
  const booksGoal = state.goals.books;
  const pagesGoal = state.goals.pages;

  const booksPct = (stats.finishedCount / booksGoal) * 100;
  const pagesPct = (stats.pagesReadTotal / pagesGoal) * 100;

  $('#goal-year').textContent = String(new Date().getFullYear());

  $('#goal-books-current').textContent = formatInt(stats.finishedCount);
  $('#goal-books-target').textContent = formatInt(booksGoal);
  $('#goal-books-bar').style.width = clamp(booksPct, 0, 100).toFixed(1) + '%';
  $('#goal-books-hint').textContent = stats.finishedCount >= booksGoal
    ? `${formatDec(booksPct)}% · ¡meta alcanzada!`
    : `${formatDec(booksPct)}% · faltan ${formatInt(booksGoal - stats.finishedCount)} libros`;

  $('#goal-pages-current').textContent = formatInt(stats.pagesReadTotal);
  $('#goal-pages-target').textContent = formatInt(pagesGoal);
  $('#goal-pages-bar').style.width = clamp(pagesPct, 0, 100).toFixed(1) + '%';
  $('#goal-pages-hint').textContent = stats.pagesReadTotal >= pagesGoal
    ? `${formatDec(pagesPct)}% · ¡meta alcanzada!`
    : `${formatDec(pagesPct)}% · faltan ${formatInt(pagesGoal - stats.pagesReadTotal)} páginas`;
}

/* ------------------------ 5.2 Estadísticas -------------------------- */

function renderStats() {
  const stats = computeGlobalStats();

  $('#stat-finished').textContent = formatInt(stats.finishedCount);
  $('#stat-finished-hint').textContent = `de ${formatInt(state.books.length)} libros en biblioteca`;

  $('#stat-pages').textContent = formatInt(stats.pagesReadTotal);
  $('#stat-pages-hint').textContent = `de ${formatInt(stats.pagesTotal)} páginas registradas`;

  $('#stat-pace').textContent = formatDec(stats.avgPace);
  $('#stat-reading').textContent = formatInt(stats.readingCount);
}

/* --------------------------- 5.3 Gráfico ---------------------------- */

function renderChart() {
  const data = computeGenreData();
  Chart.update(data);

  const legend = $('#chart-legend');
  if (!data.length) {
    legend.innerHTML = '';
    return;
  }

  const total = data.reduce((sum, item) => sum + item.pages, 0);
  legend.innerHTML = data.map((item, index) => `
    <li class="legend__item">
      <span class="legend__dot" style="background:${CHART_COLORS[index % CHART_COLORS.length]}"></span>
      <span class="legend__label">${escapeHtml(item.genre)}</span>
      <span class="legend__value">${formatInt(item.pages)} págs · ${formatDec((item.pages / total) * 100)}%</span>
    </li>
  `).join('');
}

/* --------------------------- 5.4 Tarjetas --------------------------- */

function renderStars(rating) {
  const value = clamp(rating, 0, 5);
  const filled = '★'.repeat(value);
  const empty = '☆'.repeat(5 - value);
  const emptyClass = value === 0 ? ' class="rating--none"' : '';
  return `${filled}<span${emptyClass}>${empty}</span>`;
}

function bookCardHTML(book) {
  const m = computeMetrics(book);
  const status = STATUS[book.status] || STATUS['por-leer'];

  const paceText = m.pace === null
    ? 'Sin fecha de inicio'
    : `${formatDec(m.pace)} págs/día`;

  let etaText = '—';
  if (m.daysToFinish === 0) etaText = '¡Terminado!';
  else if (typeof m.daysToFinish === 'number') etaText = `≈ ${formatInt(m.daysToFinish)} días`;

  const safeTitle = escapeHtml(book.title);

  return `
  <article class="book ${book.status === 'terminado' ? 'book--finished' : ''}" data-id="${book.id}">
    <div class="book__top">
      <span class="badge ${status.css}">${status.label}</span>
      <div class="book__tools">
        <button class="icon-btn" type="button" data-action="edit"
                title="Editar libro" aria-label="Editar ${safeTitle}">✎</button>
        <button class="icon-btn" type="button" data-action="delete"
                title="Eliminar libro" aria-label="Eliminar ${safeTitle}">✕</button>
      </div>
    </div>

    <h3 class="book__title">${safeTitle}</h3>
    <p class="book__author">${escapeHtml(book.author)}</p>
    <p class="book__genre">${escapeHtml(book.genre)}</p>

    <div class="book__progress">
      <div class="bar"><span class="bar__fill" style="width:${m.percent.toFixed(1)}%"></span></div>
      <span class="book__pct">${formatDec(m.percent)}%</span>
    </div>

    <p class="book__numbers">
      <strong>${formatInt(m.read)}</strong> / ${formatInt(m.total)} págs ·
      ${formatInt(m.remaining)} restantes
    </p>

    <dl class="book__metrics">
      <div>
        <dt>Ritmo de lectura</dt>
        <dd>${paceText}</dd>
      </div>
      <div>
        <dt>Termina en</dt>
        <dd>${etaText}</dd>
      </div>
    </dl>

    <form class="quick" data-action="quick-form">
      <label class="quick__label" for="page-${book.id}">Página actual</label>
      <div class="quick__row">
        <input class="input quick__input" id="page-${book.id}" type="number"
               min="0" max="${m.total}" step="1" value="${m.read}"
               data-action="page-input" />
        <button class="btn btn--small" type="submit">Guardar</button>
      </div>
      <p class="quick__error" data-role="quick-error" role="alert" hidden></p>
    </form>

    <div class="book__rating" aria-label="Calificación: ${book.rating} de 5 estrellas">
      ${renderStars(book.rating)}
    </div>

    ${book.review ? `<p class="book__review">“${escapeHtml(book.review)}”</p>` : ''}
    ${book.startDate ? `<p class="book__date">Inicio: ${formatDate(book.startDate)}</p>` : ''}
  </article>`;
}

function renderBooks() {
  const grid = $('#books-grid');
  const empty = $('#empty-state');
  const list = filteredBooks();

  if (!list.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    empty.textContent = state.books.length === 0
      ? 'Tu biblioteca está vacía. Pulsa «Nuevo libro» o carga la Biblioteca Demo para empezar.'
      : 'Ningún libro coincide con el filtro actual.';
    return;
  }

  empty.hidden = true;
  grid.innerHTML = list.map(bookCardHTML).join('');
}

/* =====================================================================
   6. GRÁFICO NATIVO EN CANVAS
   ===================================================================== */

const Chart = {
  canvas: null,
  ctx: null,
  data: [],

  init() {
    this.canvas = $('#genre-chart');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => this.draw());
      observer.observe(this.canvas.parentElement);
    } else {
      window.addEventListener('resize', () => this.draw());
    }
  },

  update(data) {
    this.data = Array.isArray(data) ? data : [];
    this.draw();
  },

  draw() {
    const canvas = this.canvas;
    if (!canvas || !this.ctx) return;

    const ctx = this.ctx;
    const parent = canvas.parentElement;
    const cssWidth = Math.max(280, parent.clientWidth || 460);
    const rows = this.data.length;
    const rowH = 46;
    const cssHeight = rows ? Math.max(150, rows * rowH + 26) : 170;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (!rows) {
      ctx.fillStyle = '#8a8175';
      ctx.font = `14px ${CHART_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Aún no hay páginas leídas para graficar.', cssWidth / 2, cssHeight / 2);
      return;
    }

    const labelW = Math.min(150, Math.max(84, cssWidth * 0.26));
    const valueW = 96;
    const padTop = 13;
    const barH = 24;
    const plotW = Math.max(40, cssWidth - labelW - valueW - 12);
    const max = Math.max(...this.data.map(d => d.pages), 1);

    // Línea base
    ctx.strokeStyle = '#ece3d3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(labelW - 0.5, padTop - 6);
    ctx.lineTo(labelW - 0.5, padTop + rows * rowH - 10);
    ctx.stroke();

    this.data.forEach((item, index) => {
      const y = padTop + index * rowH;
      const barW = Math.max(3, (item.pages / max) * plotW);

      // Etiqueta del género
      ctx.fillStyle = '#3a342c';
      ctx.font = `13px ${CHART_FONT}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncate(item.genre, 18), labelW - 12, y + barH / 2);

      // Barra
      ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
      ctx.fillRect(labelW, y, barW, barH);

      // Valor
      ctx.fillStyle = '#5f574c';
      ctx.textAlign = 'left';
      ctx.fillText(`${formatInt(item.pages)} pág.`, labelW + barW + 10, y + barH / 2);
    });
  }
};

/* =====================================================================
   7. FORMULARIO Y MODAL
   ===================================================================== */

const Form = {
  refs() {
    return {
      id:      $('#book-id'),
      title:   $('#f-title'),
      author:  $('#f-author'),
      genre:   $('#f-genre'),
      total:   $('#f-total'),
      read:    $('#f-read'),
      date:    $('#f-date'),
      status:  $('#f-status'),
      rating:  $('#f-rating'),
      review:  $('#f-review'),
      error:   $('#form-error')
    };
  },

  fill(book) {
    const f = this.refs();
    f.id.value      = book ? book.id : '';
    f.title.value   = book ? book.title : '';
    f.author.value  = book ? book.author : '';
    f.genre.value   = book ? book.genre : '';
    f.total.value   = book ? book.totalPages : '';
    f.read.value    = book ? book.pagesRead : 0;
    f.date.value    = book ? book.startDate : todayISO();
    f.status.value  = book ? book.status : 'por-leer';
    f.rating.value  = book ? String(book.rating) : '0';
    f.review.value  = book ? book.review : '';
    this.clearError();
  },

  reset() {
    const f = this.refs();
    f.id.value = '';
    f.title.value = '';
    f.author.value = '';
    f.genre.value = '';
    f.total.value = '';
    f.read.value = 0;
    f.date.value = '';
    f.status.value = 'por-leer';
    f.rating.value = '0';
    f.review.value = '';
    this.clearError();
  },

  read() {
    const f = this.refs();
    return {
      id: f.id.value || null,
      title: f.title.value.trim(),
      author: f.author.value.trim(),
      genre: f.genre.value.trim(),
      totalPages: Number(f.total.value),
      pagesRead: f.read.value === '' ? 0 : Number(f.read.value),
      startDate: f.date.value || '',
      status: f.status.value,
      rating: Number(f.rating.value) || 0,
      review: f.review.value.trim()
    };
  },

  showError(messages) {
    const f = this.refs();
    f.error.textContent = Array.isArray(messages) ? messages.join(' ') : String(messages);
    f.error.hidden = false;
  },

  clearError() {
    const f = this.refs();
    f.error.textContent = '';
    f.error.hidden = true;
  }
};

const Modal = {
  el: null,

  init() {
    this.el = $('#modal');
  },

  open(book) {
    Form.fill(book || null);
    $('#modal-title').textContent = book ? 'Editar libro' : 'Nuevo libro';
    this.el.hidden = false;
    document.body.classList.add('no-scroll');
    setTimeout(() => $('#f-title').focus(), 40);
  },

  close() {
    this.el.hidden = true;
    document.body.classList.remove('no-scroll');
    Form.reset();
  }
};

/** Validación del formulario. Devuelve un array de mensajes de error. */
function validateBook(data) {
  const errors = [];

  if (!data.title) errors.push('El título es obligatorio.');
  if (!data.author) errors.push('El autor es obligatorio.');

  if (!Number.isInteger(data.totalPages) || data.totalPages <= 0) {
    errors.push('Las páginas totales deben ser un número entero mayor que 0.');
  }

  if (!Number.isInteger(data.pagesRead) || data.pagesRead < 0) {
    errors.push('Las páginas leídas deben ser un número entero igual o mayor que 0.');
  } else if (Number.isInteger(data.totalPages) && data.pagesRead > data.totalPages) {
    errors.push(`Las páginas leídas no pueden superar las páginas totales (${data.totalPages}).`);
  }

  if (data.startDate && !parseISO(data.startDate)) {
    errors.push('La fecha de inicio no es válida.');
  }

  if (data.pagesRead > 0 && !data.startDate) {
    errors.push('Indica la fecha de inicio para poder calcular tu ritmo de lectura.');
  }

  return errors;
}

/* =====================================================================
   8. CRUD Y ACCIONES
   ===================================================================== */

function handleBookSubmit(event) {
  event.preventDefault();
  const data = Form.read();
  const errors = validateBook(data);

  if (errors.length) {
    Form.showError(errors);
    return;
  }

  Form.clearError();

  const existingIndex = data.id ? state.books.findIndex(b => b.id === data.id) : -1;

  if (existingIndex >= 0) {
    const previous = state.books[existingIndex];
    const updated = normalizeBook({
      ...previous,
      ...data,
      startDate: data.startDate,
      updatedAt: new Date().toISOString()
    });
    state.books[existingIndex] = updated;
    toast(`«${updated.title}» actualizado.`);
  } else {
    const created = normalizeBook({ ...data, createdAt: new Date().toISOString() });
    state.books.unshift(created);
    toast(`«${created.title}» añadido a la biblioteca.`);
  }

  Storage.save();
  Modal.close();
  renderAll();
}

/** Actualización rápida del número de página actual desde la tarjeta. */
function updateProgress(bookId, rawValue, formEl) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;

  const errorEl = formEl ? formEl.querySelector('[data-role="quick-error"]') : null;
  const showError = message => {
    if (!errorEl) { toast(message); return; }
    errorEl.textContent = message;
    errorEl.hidden = false;
  };

  const value = Number(rawValue);

  if (rawValue === '' || !Number.isFinite(value)) {
    showError('Introduce un número de página.');
    return;
  }
  if (!Number.isInteger(value)) {
    showError('La página debe ser un número entero.');
    return;
  }
  if (value < 0) {
    showError('La página no puede ser negativa.');
    return;
  }
  if (value > book.totalPages) {
    showError(`Este libro tiene ${book.totalPages} páginas.`);
    return;
  }

  const previousStatus = book.status;
  book.pagesRead = value;

  if (value === book.totalPages) {
    book.status = 'terminado';
  } else if (book.status === 'terminado') {
    book.status = 'leyendo';
  } else if (value > 0 && book.status === 'por-leer') {
    book.status = 'leyendo';
  }

  book.updatedAt = new Date().toISOString();
  Storage.save();
  renderAll();

  if (book.status === 'terminado' && previousStatus !== 'terminado') {
    toast(`¡Has terminado «${book.title}»! 🎉`);
  } else {
    const m = computeMetrics(book);
    toast(`«${book.title}»: ${formatDec(m.percent)}% leído (${formatInt(m.read)}/${formatInt(m.total)}).`);
  }
}

function deleteBook(bookId) {
  const book = state.books.find(b => b.id === bookId);
  if (!book) return;
  if (!window.confirm(`¿Eliminar «${book.title}» de la biblioteca? Esta acción no se puede deshacer.`)) {
    return;
  }
  state.books = state.books.filter(b => b.id !== bookId);
  Storage.save();
  renderAll();
  toast(`«${book.title}» eliminado.`);
}

function loadDemoLibrary() {
  if (state.books.length > 0) {
    const ok = window.confirm(
      'Se reemplazará tu biblioteca actual por la Biblioteca Demo (5 libros). ¿Continuar?'
    );
    if (!ok) return;
  }

  state.books = buildDemoBooks();
  state.goals = { books: 12, pages: 4000 };
  Storage.save();
  renderAll();
  toast('Biblioteca Demo cargada: 5 libros de ejemplo.');
}

/* =====================================================================
   9. EXPORTACIÓN
   ===================================================================== */

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function stamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function exportJSON() {
  const payload = {
    app: 'LectorMeta',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    goals: state.goals,
    books: state.books
  };
  downloadFile(
    `lectormeta-respaldo-${stamp()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8'
  );
  toast('Respaldo JSON descargado.');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCSV() {
  const header = [
    'Titulo', 'Autor', 'Genero', 'Paginas totales', 'Paginas leidas',
    'Porcentaje leido', 'Paginas restantes', 'Fecha de inicio', 'Estado',
    'Calificacion', 'Ritmo (pag/dia)', 'Dias estimados para terminar', 'Resena'
  ];

  const rows = state.books.map(book => {
    const m = computeMetrics(book);
    return [
      book.title,
      book.author,
      book.genre,
      book.totalPages,
      book.pagesRead,
      round1(m.percent).toFixed(1),
      m.remaining,
      book.startDate || '',
      STATUS[book.status] ? STATUS[book.status].label : book.status,
      book.rating,
      m.pace === null ? '' : round1(m.pace).toFixed(1),
      m.daysToFinish === null ? '' : m.daysToFinish,
      book.review
    ].map(csvCell).join(',');
  });

  const csv = '\uFEFF' + [header.join(','), ...rows].join('\r\n');
  downloadFile(`lectormeta-biblioteca-${stamp()}.csv`, csv, 'text/csv;charset=utf-8');
  toast('Biblioteca exportada a CSV.');
}

/* =====================================================================
   10. BIBLIOTECA DEMO
   Las fechas de inicio se generan relativas al día de carga para que
   los cálculos de ritmo sean verificables en cualquier momento.
   ===================================================================== */

function buildDemoBooks() {
  const now = new Date().toISOString();

  const seed = [
    {
      title: 'Cien años de soledad',
      author: 'Gabriel García Márquez',
      genre: 'Realismo mágico',
      totalPages: 471,
      pagesRead: 471,
      startDate: offsetISO(40),
      status: 'terminado',
      rating: 5,
      review: 'La estirpe Buendía y Macondo: una lectura que reescribe la memoria.'
    },
    {
      title: 'El nombre del viento',
      author: 'Patrick Rothfuss',
      genre: 'Fantasía',
      totalPages: 872,
      pagesRead: 436,
      startDate: offsetISO(20),
      status: 'leyendo',
      rating: 4,
      review: 'Kvothe narra su historia: ritmo constante, mitad exacta del libro.'
    },
    {
      title: 'Sapiens: De animales a dioses',
      author: 'Yuval Noah Harari',
      genre: 'Ensayo',
      totalPages: 496,
      pagesRead: 124,
      startDate: offsetISO(10),
      status: 'leyendo',
      rating: 5,
      review: 'Un cuarto del recorrido; denso pero fascinante.'
    },
    {
      title: 'La sombra del viento',
      author: 'Carlos Ruiz Zafón',
      genre: 'Misterio',
      totalPages: 576,
      pagesRead: 576,
      startDate: offsetISO(60),
      status: 'terminado',
      rating: 5,
      review: 'El Cementerio de los Libros Olvidados, leído de un tirón.'
    },
    {
      title: 'Dune',
      author: 'Frank Herbert',
      genre: 'Ciencia ficción',
      totalPages: 688,
      pagesRead: 0,
      startDate: '',
      status: 'por-leer',
      rating: 0,
      review: ''
    }
  ];

  return seed.map(item => normalizeBook({
    ...item,
    id: uid(),
    createdAt: now,
    updatedAt: now
  }));
}

/* =====================================================================
   11. TOAST, EVENTOS E INICIALIZACIÓN
   ===================================================================== */

let toastTimer = null;

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  // Fuerza el reflow para reiniciar la transición.
  void el.offsetWidth;
  el.classList.add('toast--visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => { el.hidden = true; }, 240);
  }, 2800);
}

function bindEvents() {
  /* ---- Acciones de cabecera ---- */
  $('#btn-new').addEventListener('click', () => Modal.open(null));
  $('#btn-demo').addEventListener('click', loadDemoLibrary);
  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-export-csv').addEventListener('click', exportCSV);

  /* ---- Modal ---- */
  $('#modal').addEventListener('click', event => {
    if (event.target.closest('[data-close="true"]')) Modal.close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#modal').hidden) Modal.close();
  });
  $('#book-form').addEventListener('submit', handleBookSubmit);
  $('#book-form').addEventListener('input', () => Form.clearError());

  /* ---- Metas ---- */
  $('#btn-goal-edit').addEventListener('click', () => {
    $('#goal-form').hidden = false;
    $('#goal-books-input').value = state.goals.books;
    $('#goal-pages-input').value = state.goals.pages;
    $('#goal-books-input').focus();
  });

  $('#btn-goal-cancel').addEventListener('click', () => {
    $('#goal-form').hidden = true;
  });

  $('#goal-form').addEventListener('submit', event => {
    event.preventDefault();
    const booksGoal = Number($('#goal-books-input').value);
    const pagesGoal = Number($('#goal-pages-input').value);

    if (!Number.isInteger(booksGoal) || booksGoal <= 0 ||
        !Number.isInteger(pagesGoal) || pagesGoal <= 0) {
      toast('Las metas deben ser números enteros mayores que 0.');
      return;
    }

    state.goals = { books: booksGoal, pages: pagesGoal };
    Storage.save();
    $('#goal-form').hidden = true;
    renderAll();
    toast('Meta anual actualizada.');
  });

  /* ---- Biblioteca: delegación de eventos ---- */
  const grid = $('#books-grid');

  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('.book');
    if (!card) return;
    const id = card.dataset.id;

    if (button.dataset.action === 'edit') {
      const book = state.books.find(b => b.id === id);
      if (book) Modal.open(book);
    }

    if (button.dataset.action === 'delete') {
      deleteBook(id);
    }
  });

  grid.addEventListener('submit', event => {
    const form = event.target.closest('[data-action="quick-form"]');
    if (!form) return;
    event.preventDefault();
    const card = form.closest('.book');
    const input = form.querySelector('[data-action="page-input"]');
    if (!card || !input) return;
    updateProgress(card.dataset.id, input.value, form);
  });

  /* ---- Filtros ---- */
  $('#search-input').addEventListener('input', debounce(event => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderBooks();
  }, 140));

  $('#status-filter').addEventListener('change', event => {
    state.filters.status = event.target.value;
    renderBooks();
  });
}

function init() {
  const saved = Storage.load();
  if (saved) {
    state.books = saved.books;
    state.goals = saved.goals;
  }

  Modal.init();
  Chart.init();
  bindEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
