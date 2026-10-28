// Sangbog – reads the songbook, navigation, wake lock and sharing.
'use strict';

const $ = (id) => document.getElementById(id);

// The whole songbook lives in this one Markdown file.
const SOURCE = 'gammel-sangbog.md';

const state = {
  songs: [],
  byNumber: new Map(),
  afterword: [],
  current: null,
  wakeLock: null,
};

// ---------- Data ----------

// The Markdown file is laid out like this:
//   ## Forord          shown at the bottom of the index, as "Efterskrift"
//   ## Indhold         table of contents; skipped, the index is built from the songs
//   ## <section>       a section of songs (Salmer, Hymner, …)
//   ### <nr>. <title>  a song; its verses are paragraphs separated by blank lines
// Lines end in "\" (a hard line break), *…* is a chorus and "> " a quote.
function parseSongbook(text) {
  const songs = [];
  const afterword = [];
  let section = null;
  let blocks = null; // where the paragraphs under the current heading go
  let block = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const [, level, name] = heading;
      const song = level === '###' && /^(\d+)\.\s+(.*)$/.exec(name);
      if (level === '##') section = name;
      if (song && section) {
        songs.push({ number: Number(song[1]), title: song[2], section, subtitle: null, blocks: [] });
        blocks = songs.at(-1).blocks;
      } else {
        blocks = level === '##' && name === 'Forord' ? afterword : null;
      }
      block = null;
      continue;
    }
    if (!line) {
      block = null;
      continue;
    }
    if (!blocks) continue;
    const quote = line.startsWith('>');
    if (!block) {
      block = { lines: [], quote };
      blocks.push(block);
    }
    block.lines.push(line.replace(/^>\s?/, '').replace(/\\$/, '').trim());
  }

  for (const song of songs) {
    // A bold line in brackets right under the title is a subtitle, as in "**(Lyset kommer tilbage)**".
    const first = song.blocks[0];
    const subtitle = first?.lines.length === 1 && /^\*\*\((.+)\)\*\*$/.exec(first.lines[0]);
    if (subtitle) {
      song.subtitle = subtitle[1];
      song.blocks.shift();
    }
    for (const b of song.blocks) b.chorus = isChorus(b.lines);
  }
  return { songs, afterword };
}

// A chorus is a paragraph written all in italics; repeat marks and "(2x)" may sit outside them.
function isChorus(lines) {
  return lines.every((line) => /^\*(?!\*).*\*$/.test(line.replace(/\|\|:|:\|\||\(\d+x\)/g, '').trim()));
}

async function loadSongbook() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Kunne ikke hente ${SOURCE}`);
  const { songs, afterword } = parseSongbook(await res.text());
  state.songs = songs;
  state.byNumber = new Map(songs.map((s) => [s.number, s]));
  state.afterword = afterword;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// **bold** and *italic* inside a line; everything else is plain text.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).flatMap((part, i) => {
    if (!part) return [];
    if (i % 2 === 0) return [part];
    return part.startsWith('**') ? [el('strong', '', part.slice(2, -2))] : [el('em', '', part.slice(1, -1))];
  });
}

// ---------- Index view ----------

function renderSongItem(song) {
  const item = el('li', 'song-item');
  const link = el('a', 'song-link');
  link.href = `#/sang/${song.number}`;
  link.append(el('span', 'num', String(song.number)), el('span', 'title', song.title));
  item.append(link);
  return item;
}

// The songs are grouped in sections (Salmer, Hymner, …), in the order they come in the songbook.
function renderList() {
  const sections = [];
  for (const song of state.songs) {
    let section = sections.at(-1);
    if (!section || section.name !== song.section) {
      section = { name: song.section, songs: [] };
      sections.push(section);
    }
    section.songs.push(song);
  }
  $('song-list').replaceChildren(
    ...sections.map(({ name, songs }) => {
      const group = el('section', 'song-section');
      group.append(el('h2', 'section-title', name));
      const list = el('ol', 'song-list-items');
      list.append(...songs.map(renderSongItem));
      group.append(list);
      return group;
    }),
  );
}

// The songbook's foreword, shown after the songs.
function renderAfterword() {
  if (!state.afterword.length) return;
  $('afterword').replaceChildren(
    ...state.afterword.map(({ lines, quote }) => {
      const node = el(quote ? 'blockquote' : 'p');
      lines.forEach((line, i) => {
        if (i) node.append(el('br'));
        node.append(...inline(line));
      });
      return node;
    }),
  );
  $('afterword-section').hidden = false;
}

// ---------- Song view ----------

function renderVerses(song) {
  // Verses are numbered, choruses are not. A song of one verse needs no number.
  const numbered = song.blocks.filter((b) => !b.chorus).length > 1;
  let number = 0;
  const nodes = song.blocks.map((block) => {
    const section = el('section', block.chorus ? 'verse chorus' : 'verse');
    if (block.chorus) {
      section.setAttribute('aria-label', 'Omkvæd');
    } else {
      number += 1;
      section.setAttribute('aria-label', `Vers ${number}`);
      if (numbered) section.append(el('span', 'verse-number', String(number)));
    }
    for (const line of block.lines) {
      const p = el('p', 'line');
      p.append(...inline(line));
      section.append(p);
    }
    return section;
  });
  $('verses').replaceChildren(...nodes);
}

function renderSong(song, direction) {
  const article = $('song');
  $('song-number').textContent = `Nr. ${song.number}`;
  $('song-title').textContent = song.title;
  $('song-subtitle').textContent = song.subtitle ?? '';
  $('song-subtitle').hidden = !song.subtitle;
  document.title = `${song.number}. ${song.title} – Sangbog`;

  renderVerses(song);

  article.classList.remove('slide-left', 'slide-right');
  if (direction) {
    void article.offsetWidth; // restart the animation
    article.classList.add(direction > 0 ? 'slide-left' : 'slide-right');
  }
}

function showSong(number, direction = 0) {
  const song = state.byNumber.get(number);
  if (!song) {
    location.replace('#/');
    return;
  }
  state.current = number;
  $('index-view').hidden = true;
  $('song-view').hidden = false;
  renderSong(song, direction);
  if (!direction) window.scrollTo(0, 0);
  requestWakeLock();
}

function go(delta) {
  if (!state.current) return;
  const numbers = state.songs.map((s) => s.number);
  const next = numbers[numbers.indexOf(state.current) + delta];
  if (next === undefined) return;
  // Replace rather than push, so the back button returns to the index.
  history.replaceState(null, '', `#/sang/${next}`);
  window.scrollTo(0, 0);
  showSong(next, delta);
}

function showIndex() {
  state.current = null;
  releaseWakeLock();
  document.title = 'Sangbog – Kristi Kirke København';
  $('song-view').hidden = true;
  $('index-view').hidden = false;
}

function route() {
  const song = /^#\/sang\/(\d+)$/.exec(location.hash);
  if (song) showSong(Number(song[1]));
  else showIndex();
}

// ---------- Gestures ----------

function isZoomed() {
  return window.visualViewport ? window.visualViewport.scale > 1.01 : false;
}

function setupGestures() {
  const area = $('song');
  let start = null;

  area.addEventListener(
    'touchstart',
    (e) => {
      start = e.touches.length === 1 && !isZoomed() ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    },
    { passive: true },
  );
  area.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) start = null;
  }, { passive: true });
  area.addEventListener(
    'touchend',
    (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );

  // A tap on the outer edges of the text moves to the previous/next song.
  area.addEventListener('click', (e) => {
    if (e.target.closest('a, button') || isZoomed()) return;
    if (String(window.getSelection()).length) return;
    const edge = Math.min(64, window.innerWidth * 0.14);
    if (e.clientX < edge) go(-1);
    else if (e.clientX > window.innerWidth - edge) go(1);
  });

  document.addEventListener('keydown', (e) => {
    if ($('song-view').hidden) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Escape') location.hash = '#/';
  });
}

// ---------- Wake lock ----------

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || state.wakeLock || document.visibilityState !== 'visible') return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => {
      state.wakeLock = null;
    });
  } catch {
    state.wakeLock = null;
  }
}

function releaseWakeLock() {
  state.wakeLock?.release().catch(() => {});
  state.wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.current) requestWakeLock();
});

// ---------- Sharing ----------

function qrSvg(text) {
  if (typeof qrcode !== 'function') return document.createTextNode('');
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR-kode til sangbogen');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', '#000');
  svg.append(path);
  return svg;
}

// ---------- Start ----------

async function start() {
  setupGestures();

  $('back-button').addEventListener('click', () => {
    location.hash = '#/';
  });

  // QR code for the app's own address, so others can scan it from this phone.
  $('qr').replaceChildren(qrSvg(location.href.split('#')[0]));

  try {
    await loadSongbook();
  } catch {
    $('index-view').hidden = false;
    $('list-empty').hidden = false;
    $('list-empty').textContent = 'Sangbogen kunne ikke hentes. Prøv igen, når der er forbindelse.';
    return;
  }
  renderList();
  renderAfterword();
  window.addEventListener('hashchange', route);
  route();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

start();
