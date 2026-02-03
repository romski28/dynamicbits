/**
 * Gallery / Component Library
 * Handles component gallery rendering, filtering, searching, favorites, and drag-drop reordering
 */

/* =========================
   PERSISTENCE (localStorage)
   ========================= */
const LS_KEYS = {
  order: 'galleryOrder',
  favs: 'galleryFavs'
};

const persist = {
  getOrder() {
    const raw = localStorage.getItem(LS_KEYS.order);
    return raw ? JSON.parse(raw) : null;
  },
  setOrder(orderIds) {
    localStorage.setItem(LS_KEYS.order, JSON.stringify(orderIds));
  },
  clearOrder() {
    localStorage.removeItem(LS_KEYS.order);
  },
  getFavs() {
    const raw = localStorage.getItem(LS_KEYS.favs);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  },
  setFavs(set) {
    localStorage.setItem(LS_KEYS.favs, JSON.stringify(Array.from(set)));
  }
};

/* =========================
   STATE
   ========================= */
let masterData = [];
let order = [];
let favorites = persist.getFavs();
let filters = {
  category: 'All',
  favoritesOnly: false,
  query: ''
};
let visibleIds = [];

/* =========================
   UTILITIES
   ========================= */
function titleFromFilename(path) {
  const name = (path.split('/').pop() || '').replace(/\.[^.]+$/, '');
  const cleaned = name.replace(/[-_]+/g, ' ').trim();
  if (!cleaned) return 'Untitled';
  return cleaned.replace(/\b\w/g, c => c.toUpperCase());
}

function filenameFromUrl(url) {
  try { return new URL(url).pathname.split('/').pop(); }
  catch { return url.split('/').pop() || 'SketchUp file'; }
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* =========================
   INITIALIZATION
   ========================= */
function initGallery(data) {
  // Clone and ensure fields exist
  masterData = data.map(item => ({
    ...item,
    title: item.title || titleFromFilename(item.image),
    category: item.category || 'Uncategorized',
    tags: Array.isArray(item.tags) ? item.tags : []
  }));

  // Build initial order
  const savedOrder = persist.getOrder();
  const currentIds = masterData.map(x => x.id);
  if (savedOrder && Array.isArray(savedOrder)) {
    const merged = savedOrder.filter(id => currentIds.includes(id));
    currentIds.forEach(id => { if (!merged.includes(id)) merged.push(id); });
    order = merged;
  } else {
    order = currentIds;
  }

  renderCategoryBar();
  render();
  wireControls();
}

/* =========================
   RENDER
   ========================= */
function applyFilters() {
  const q = filters.query.trim().toLowerCase();
  const list = order
    .map(id => masterData.find(x => x.id === id))
    .filter(Boolean)
    .filter(item => (filters.category === 'All' ? true : item.category === filters.category))
    .filter(item => (filters.favoritesOnly ? favorites.has(item.id) : true))
    .filter(item => {
      if (!q) return true;
      const hay = [
        item.title,
        item.category,
        ...(item.tags || []),
        filenameFromUrl(item.skpUrl)
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });

  visibleIds = list.map(x => x.id);
  return list;
}

function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();

  const list = applyFilters();

  for (const item of list) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('draggable', 'true');
    card.dataset.id = item.id;

    // MEDIA (lightbox trigger)
    const media = document.createElement('div');
    media.className = 'card__media';
    media.dataset.img = item.image;

    const img = new Image();
    img.src = item.image;
    img.alt = item.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    media.appendChild(img);

    // Favorite button
    const favBtn = document.createElement('button');
    favBtn.className = 'fav-btn' + (favorites.has(item.id) ? ' active' : '');
    favBtn.type = 'button';
    favBtn.title = favorites.has(item.id) ? 'Unpin from favorites' : 'Pin to favorites';
    favBtn.setAttribute('aria-pressed', favorites.has(item.id) ? 'true' : 'false');
    favBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.1 8.64l-.1.1-.1-.1c-1.87-1.92-5.02-1.52-6.4.77-1.1 1.82-.6 4.2 1.18 5.45L12 18.5l5.32-3.64c1.78-1.25 2.28-3.63 1.18-5.45-1.38-2.29-4.53-2.69-6.4-.77z"/>
      </svg>
    `;
    favBtn.addEventListener('click', e => {
      e.stopPropagation();
      const id = item.id;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      persist.setFavs(favorites);
      favBtn.classList.toggle('active', favorites.has(id));
      favBtn.setAttribute('aria-pressed', favorites.has(id) ? 'true' : 'false');
      if (filters.favoritesOnly) render();
    });

    media.appendChild(favBtn);

    // BODY (title link -> SketchUp)
    const body = document.createElement('div');
    body.className = 'card__body';

    const link = document.createElement('a');
    link.className = 'card__title-link';
    link.href = item.skpUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Open SketchUp: ${item.title}`);

    const title = document.createElement('h2');
    title.className = 'card__title';
    title.textContent = item.title;

    const meta = document.createElement('div');
    meta.className = 'card__meta';
    meta.textContent = "Download";

    link.appendChild(title);
    body.appendChild(link);
    body.appendChild(meta);

    card.appendChild(media);
    card.appendChild(body);

    // Drag & Drop
    card.addEventListener('dragstart', dragStart);
    card.addEventListener('dragover', dragOver);
    card.addEventListener('dragleave', dragLeave);
    card.addEventListener('drop', dropped);
    card.addEventListener('dragend', dragEnd);

    frag.appendChild(card);
  }

  grid.appendChild(frag);
}

/* =========================
   CATEGORY BAR
   ========================= */
function renderCategoryBar() {
  const bar = document.getElementById('categoryBar');
  bar.innerHTML = '';

  const cats = Array.from(new Set(masterData.map(x => x.category))).sort();
  const pills = [
    { key: 'All', label: 'All' },
    ...cats.map(c => ({ key: c, label: c })),
    { key: 'Favorites', label: '★ Favorites', favoritesOnly: true }
  ];

  for (const p of pills) {
    const btn = document.createElement('button');
    btn.className = 'filter-pill';
    btn.type = 'button';

    if (p.key === 'Favorites') {
      btn.dataset.fav = '1';
      btn.setAttribute('aria-pressed', filters.favoritesOnly ? 'true' : 'false');
    } else {
      btn.dataset.cat = p.key;
      const active = (!filters.favoritesOnly && filters.category === p.key) || (p.key === 'All' && filters.category === 'All' && !filters.favoritesOnly);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    btn.textContent = p.label;

    btn.addEventListener('click', () => {
      if (p.favoritesOnly) {
        filters.favoritesOnly = !filters.favoritesOnly;
        if (filters.favoritesOnly) filters.category = 'All';
        Array.from(bar.children).forEach(el => {
          if (el.dataset.fav === '1') el.setAttribute('aria-pressed', filters.favoritesOnly ? 'true' : 'false');
          if (el.dataset.cat) el.setAttribute('aria-pressed', (!filters.favoritesOnly && filters.category === el.dataset.cat) ? 'true' : 'false');
        });
      } else {
        filters.category = p.key;
        filters.favoritesOnly = false;
        Array.from(bar.children).forEach(el => {
          if (el.dataset.cat) el.setAttribute('aria-pressed', (filters.category === el.dataset.cat) ? 'true' : 'false');
          if (el.dataset.fav === '1') el.setAttribute('aria-pressed', 'false');
        });
      }
      render();
    });

    bar.appendChild(btn);
  }
}

/* =========================
   CONTROLS
   ========================= */
function wireControls() {
  const searchInput = document.getElementById('search');
  const onSearch = debounce(e => {
    filters.query = e.target.value || '';
    render();
  }, 150);
  searchInput.addEventListener('input', onSearch);

  setupLightbox();
}

/* =========================
   LIGHTBOX
   ========================= */
function setupLightbox() {
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbClose = document.getElementById('lightbox-close');
  const lbPrev = document.getElementById('lb-prev');
  const lbNext = document.getElementById('lb-next');

  function openById(id) {
    applyFilters();
    const idx = visibleIds.indexOf(id);
    if (idx === -1) return;
    showIndex(idx);
    lb.classList.add('active');
    lbClose.focus({ preventScroll: true });
  }

  function showIndex(i) {
    if (visibleIds.length === 0) return;
    if (i < 0) i = 0;
    if (i > visibleIds.length - 1) i = visibleIds.length - 1;
    lb.dataset.index = String(i);
    const id = visibleIds[i];
    const item = masterData.find(x => x.id === id);
    lbImg.src = item.image;
    lbImg.alt = item.title;
    // Preload neighbors
    [i - 1, i + 1].forEach(j => {
      if (j >= 0 && j < visibleIds.length) {
        const preId = visibleIds[j];
        const preItem = masterData.find(x => x.id === preId);
        const im = new Image();
        im.src = preItem.image;
      }
    });
  }

  function close() {
    lb.classList.remove('active');
    lbImg.src = '';
    lbImg.alt = '';
  }

  // Open when clicking any .card__media
  document.addEventListener('click', e => {
    const media = e.target.closest && e.target.closest('.card__media');
    if (!media) return;
    const card = media.closest('.card');
    if (!card) return;
    openById(card.dataset.id);
  });

  lbClose.addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  lbPrev.addEventListener('click', () => {
    const i = parseInt(lb.dataset.index || '0', 10);
    showIndex(i - 1);
  });
  lbNext.addEventListener('click', () => {
    const i = parseInt(lb.dataset.index || '0', 10);
    showIndex(i + 1);
  });

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('active')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const i = parseInt(lb.dataset.index || '0', 10);
      showIndex(i - 1);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const i = parseInt(lb.dataset.index || '0', 10);
      showIndex(i + 1);
    }
  });
}

/* =========================
   DRAG & DROP ORDERING
   ========================= */
let dragId = null;

function dragStart(e) {
  const card = e.currentTarget;
  dragId = card.dataset.id;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', dragId); } catch { }
}

function dragOver(e) {
  e.preventDefault();
  const card = e.currentTarget;
  if (card.dataset.id !== dragId) {
    card.classList.add('drop-target');
  }
  e.dataTransfer.dropEffect = 'move';
}

function dragLeave(e) {
  e.currentTarget.classList.remove('drop-target');
}

function dropped(e) {
  e.preventDefault();
  const targetCard = e.currentTarget;
  targetCard.classList.remove('drop-target');
  const targetId = targetCard.dataset.id;
  if (!dragId || dragId === targetId) return;

  const vis = visibleIds.slice();
  const fromIdx = vis.indexOf(dragId);
  const toIdx = vis.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return;

  vis.splice(toIdx, 0, vis.splice(fromIdx, 1)[0]);

  const remaining = order.filter(id => !vis.includes(id));
  order = [];
  const visSet = new Set(vis);
  order.push(...vis);
  order.push(...remaining.filter(id => !visSet.has(id)));

  persist.setOrder(order);
  render();
}

function dragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  dragId = null;
}

/* =========================
   EXPORT
   ========================= */
function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
