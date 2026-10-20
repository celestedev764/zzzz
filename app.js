(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const LS = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set(k, v) { localStorage.setItem(k, JSON.stringify(v)); } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); const m = Math.floor(s / 60), r = String(s % 60).padStart(2, '0'); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${r}` : `${m}:${r}`; };
const secs = d => String(d || '').split(':').reduce((a, n) => a * 60 + (+n || 0), 0);
const thumb = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ID = /^[\w-]{11}$/;
const clean = t => t && ID.test(t.id) ? { id: t.id, title: String(t.title || '').slice(0, 200), artist: String(t.artist || '').slice(0, 120), duration: String(t.duration || '').slice(0, 10) } : null;
const PREFIX = 'wave-player-tv-v1-';
const isTV = location.hash === '#tv';
const TR = new Map(); const register = l => (l || []).forEach(t => t && TR.set(t.id, t));

const I = {
  wave: '<path d="M3 12h1M7 8v8M11 4v16M15 7v10M19 10v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  queue: '<path d="M3 6h13M3 12h13M3 18h8M19 14v7M15.5 17.5h7"/>',
  library: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  cast: '<path d="M2 16a5 5 0 0 1 5 5M2 12a9 9 0 0 1 9 9M2 8V7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><path d="M2 20h.01"/>',
  tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/>',
  play: '<path class="f" d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>',
  pause: '<rect class="f" x="6" y="4" width="4" height="16" rx="1"/><rect class="f" x="14" y="4" width="4" height="16" rx="1"/>',
  prev: '<path class="f" d="M19 5v14L9 12z"/><path d="M5 5v14"/>',
  next: '<path class="f" d="M5 5v14l10-7z"/><path d="M19 5v14"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  vol: '<path class="f" d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  listAdd: '<path d="M3 6h12M3 12h12M3 18h7M18 13v8M14 17h8"/>',
  playNext: '<path d="M3 6h10M3 12h10M3 18h6"/><path class="f" d="M15 13v8l6-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
};
for (const k in I) I[k] = `<svg viewBox="0 0 24 24">${I[k]}</svg>`;
$$('i[data-icon]').forEach(el => el.innerHTML = I[el.dataset.icon] || '');

let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------------- Player engine (toca neste aparelho) ---------------- */
const engine = {
  yt: null, ready: false, playing: false, errs: 0,
  queue: (LS.get('wave.queue', [])).map(clean).filter(Boolean), index: LS.get('wave.index', -1),
  volume: LS.get('wave.vol', 80), shuffle: LS.get('wave.shuffle', false), repeat: LS.get('wave.repeat', 'off'),
  fns: [], on(f) { this.fns.push(f); }, emit(k = 'change') { this.fns.forEach(f => f(k)); },
  init() {
    if (this.index >= this.queue.length) this.index = this.queue.length - 1;
    window.onYouTubeIframeAPIReady = () => {
      this.yt = new YT.Player('yt', {
        width: '100%', height: '100%',
        playerVars: { playsinline: 1, controls: 0, rel: 0, iv_load_policy: 3, modestbranding: 1, disablekb: 1, fs: 0, origin: location.origin },
        events: {
          onReady: () => { this.ready = true; this.yt.setVolume(this.volume); const t = this.cur(); if (t) this.yt.cueVideoById(t.id); this.emit(); },
          onStateChange: e => {
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) { this.playing = true; this.errs = 0; }
            else if (e.data === S.PAUSED || e.data === S.CUED) this.playing = false;
            else if (e.data === S.ENDED) { this.playing = false; this.ended(); }
            this.emit();
          },
          onError: () => { toast('Essa música não permite tocar fora do YouTube — pulando'); if (++this.errs < 5) setTimeout(() => this.next(true), 700); },
        },
      });
    };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.append(s);
    setInterval(() => { if (this.playing) this.emit('tick'); }, 500);
  },
  cur() { return this.queue[this.index] || null; },
  time() { try { return this.yt?.getCurrentTime?.() || 0; } catch { return 0; } },
  dur() { try { return this.yt?.getDuration?.() || 0; } catch { return 0; } },
  snap() { return { queue: this.queue, index: this.index, playing: this.playing, time: this.time(), duration: this.dur() || secs(this.cur()?.duration), volume: this.volume, shuffle: this.shuffle, repeat: this.repeat }; },
  save() { LS.set('wave.queue', this.queue.slice(0, 500)); LS.set('wave.index', this.index); },
  start() {
    const t = this.cur(); if (!t) return;
    const rec = LS.get('wave.recent', []).filter(x => x.id !== t.id); rec.unshift(t); LS.set('wave.recent', rec.slice(0, 24));
    if (this.ready) this.yt.loadVideoById(t.id);
    this.save(); this.emit();
  },
  ended() { if (this.repeat === 'one') { this.yt.seekTo(0); this.yt.playVideo(); } else this.next(true); },
  next(auto) {
    const n = this.queue.length; if (!n) return;
    if (this.shuffle && n > 1) { let i; do i = Math.floor(Math.random() * n); while (i === this.index); this.index = i; }
    else if (this.index < n - 1) this.index++;
    else if (this.repeat === 'all' || !auto) this.index = 0;
    else { this.playing = false; this.emit(); return; }
    this.start();
  },
  prev() { if (this.time() > 4) { this.yt.seekTo(0, true); return; } if (this.index > 0) this.index--; this.start(); },
  cmd(a, p = {}) {
    const tracks = (p.tracks || (p.track ? [p.track] : [])).map(clean).filter(Boolean);
    switch (a) {
      case 'playList': if (!tracks.length) return; this.queue = tracks; this.index = Math.min(Math.max(0, p.index | 0), tracks.length - 1); this.start(); break;
      case 'playTrack': if (!tracks[0]) return; this.index++; this.queue.splice(this.index, 0, tracks[0]); this.start(); break;
      case 'add': this.queue.push(...tracks); if (this.index < 0 && this.queue.length) { this.index = 0; this.start(); } else { this.save(); this.emit(); } break;
      case 'playNext': this.queue.splice(this.index + 1, 0, ...tracks); if (this.index < 0) { this.index = 0; this.start(); } else { this.save(); this.emit(); } break;
      case 'jump': if (this.queue[p.i]) { this.index = p.i; this.start(); } break;
      case 'remove': {
        const i = p.i | 0; if (!this.queue[i]) return; this.queue.splice(i, 1);
        if (i < this.index) this.index--;
        else if (i === this.index) { if (this.index >= this.queue.length) this.index = this.queue.length - 1; if (this.index >= 0) this.start(); else { this.yt?.stopVideo(); this.playing = false; } }
        this.save(); this.emit(); break;
      }
      case 'clear': this.queue = []; this.index = -1; this.yt?.stopVideo?.(); this.playing = false; this.save(); this.emit(); break;
      case 'toggle': if (!this.ready || !this.cur()) return; this.playing ? this.yt.pauseVideo() : this.yt.playVideo(); break;
      case 'next': this.next(); break;
      case 'prev': this.prev(); break;
      case 'seek': this.yt?.seekTo(+p.t || 0, true); setTimeout(() => this.emit(), 300); break;
      case 'vol': this.volume = Math.max(0, Math.min(100, +p.v || 0)); this.yt?.setVolume(this.volume); if (this.volume) this.yt?.unMute?.(); LS.set('wave.vol', this.volume); this.emit(); break;
      case 'shuffle': this.shuffle = !this.shuffle; LS.set('wave.shuffle', this.shuffle); this.emit(); break;
      case 'repeat': this.repeat = { off: 'all', all: 'one', one: 'off' }[this.repeat] || 'off'; LS.set('wave.repeat', this.repeat); this.emit(); break;
    }
  },
};

/* ---------------- Controle remoto (celular → TV) ---------------- */
let remote = null, manualStop = false;
function view() {
  if (remote) {
    const s = { queue: [], index: -1, playing: false, time: 0, duration: 0, volume: 80, ...(remote.state || {}) };
    if (s.playing) s.time = Math.min(s.duration || 1e9, s.time + (performance.now() - remote.at) / 1000);
    return s;
  }
  return engine.snap();
}
function act(a, p = {}) {
  if (remote) { if (remote.conn.open) remote.conn.send({ t: 'cmd', a, p }); else toast('TV desconectada'); return; }
  engine.cmd(a, p);
}
function disconnect(manual) {
  const r = remote; remote = null;
  if (r) { try { r.conn.close(); } catch {} try { r.peer.destroy(); } catch {} }
  if (manual) { manualStop = true; LS.set('wave.autoCode', null); toast('Desconectado da TV'); }
  connUI(); sig = ''; render();
}
function connect(code, { silent = false, attempt = 0 } = {}) {
  if (!attempt) manualStop = false;
  return new Promise(res => {
    if (!window.Peer) { toast('Não carregou o módulo de conexão'); return res(false); }
    if (remote) disconnect(false);
    const peer = new Peer(); let done = false;
    const fail = msg => {
      if (done) return; done = true; clearTimeout(timer); try { peer.destroy(); } catch {}
      if (!silent) toast(msg);
      if (attempt > 0 && attempt < 6 && !manualStop) setTimeout(() => connect(code, { silent: true, attempt: attempt + 1 }), 3000);
      else if (attempt >= 6) toast('Não consegui reconectar à TV');
      res(false);
    };
    const timer = setTimeout(() => fail(`Não achei a TV ${code}. O site está aberto nela?`), 12000);
    peer.on('error', e => fail(e.type === 'peer-unavailable' ? `TV ${code} não encontrada. Confira o código.` : 'Erro de conexão: ' + e.type));
    peer.on('open', () => {
      const conn = peer.connect(PREFIX + code, { reliable: true });
      conn.on('open', () => {
        done = true; clearTimeout(timer);
        remote = { peer, conn, code, state: null, at: 0 };
        LS.set('wave.lastCode', code); LS.set('wave.autoCode', code);
        try { engine.ready && engine.yt.pauseVideo(); } catch {}
        if (!silent || attempt) toast('📺 Conectado à TV ' + code);
        connUI(); sig = ''; render(); res(true);
      });
      conn.on('data', m => { if (m?.t === 'state' && remote?.conn === conn) { remote.state = m.s; remote.at = performance.now(); render(); } });
      conn.on('close', () => {
        if (remote?.conn !== conn) return;
        disconnect(false);
        if (!manualStop) { toast('Conexão com a TV caiu — reconectando…'); setTimeout(() => connect(code, { silent: true, attempt: 1 }), 1500); }
      });
    });
  });
}
function connUI() {
  $('#connPill').hidden = !remote; if (remote) $('#connTxt').textContent = 'TV ' + remote.code;
  $('#bCast').classList.toggle('cast-on', !!remote);
  $('#castLbl').textContent = remote ? 'Conectado: TV ' + remote.code : 'Transmitir pra TV';
  $('#videoBtn').hidden = !!remote;
}

/* ---------------- Modo TV (host) ---------------- */
const tvConns = new Set(); let tvTries = 0, lastBc = 0;
function genCode() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; return Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); }
function broadcast() { lastBc = performance.now(); if (!tvConns.size) return; const s = engine.snap(); tvConns.forEach(c => { try { c.open && c.send({ t: 'state', s }); } catch {} }); }
function showCode(code, status) {
  const url = `${location.origin}/#connect=${code}`;
  $('#tvCode').hidden = false;
  $('#tvCode').innerHTML = `<img alt="QR code" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=${encodeURIComponent(url)}"><div><div class="lbl">Código da TV ${status ? '· ' + esc(status) : ''}</div><div class="code">${code}</div><div class="hint">No celular abra <b>${esc(location.host)}</b> → <b>Transmitir pra TV</b><br>ou aponte a câmera pro QR code</div></div>`;
}
function startTV() {
  if (!window.Peer) { $('#tvCode').hidden = false; $('#tvCode').innerHTML = '<p class="sub">Não carregou o módulo de conexão. Recarregue a página.</p>'; return; }
  let code = LS.get('wave.tvCode', null);
  if (!code || tvTries >= 4) { code = genCode(); tvTries = 0; }
  showCode(code, 'conectando…');
  const peer = new Peer(PREFIX + code);
  peer.on('open', () => { tvTries = 0; LS.set('wave.tvCode', code); showCode(code); });
  peer.on('connection', conn => {
    conn.on('open', () => { tvConns.add(conn); toast('📱 Controle conectado'); conn.send({ t: 'state', s: engine.snap() }); });
    conn.on('data', m => { if (m?.t === 'cmd' && typeof m.a === 'string') engine.cmd(m.a, m.p || {}); });
    conn.on('close', () => tvConns.delete(conn)); conn.on('error', () => tvConns.delete(conn));
  });
  peer.on('disconnected', () => setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 2000));
  peer.on('error', e => {
    if (e.type === 'unavailable-id') { tvTries++; peer.destroy(); setTimeout(startTV, 2500); }
    else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) { showCode(code, 'reconectando…'); setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect(); }, 3000); }
  });
}

/* ---------------- Render ---------------- */
let sig = '', curImg = null, curView = 'home', seekPrev = null, volDrag = false, msId = '';
const eqH = '<span class="eq" style="opacity:1;height:14px"><span></span><span></span><span></span></span>';
function row(t, i, o) {
  return `<div class="row${o.cur ? ' cur' : ''}" data-id="${esc(t.id)}" data-i="${i}"><button class="row-main" data-act="${o.act}"><span class="row-n">${o.cur ? eqH : i + 1}</span><span class="row-th" style="background-image:url('${thumb(t.id)}')"></span><span class="row-txt"><span class="row-t">${esc(t.title)}</span><span class="row-a">${esc(t.artist)}</span></span></button><span class="row-d">${esc(t.duration)}</span>${o.rm ? `<button class="mini" data-act="${o.rm}" title="Remover">${I.x}</button>` : ''}</div>`;
}
function card(t) {
  return `<div class="card" data-id="${esc(t.id)}"><button class="card-art" data-act="play" style="background-image:url('${thumb(t.id)}')" aria-label="Tocar">${t.duration ? `<span class="dur">${esc(t.duration)}</span>` : ''}<span class="card-play">${I.play}</span></button><div class="card-body"><div class="card-title" title="${esc(t.title)}">${esc(t.title)}</div><div class="card-sub">${esc(t.artist)}${t.views ? ' · ' + esc(t.views) : ''}</div><div class="card-acts"><button class="mini" data-act="add" title="Adicionar à fila">${I.plus}</button><button class="mini" data-act="next" title="Tocar a seguir">${I.playNext}</button><button class="mini" data-act="pl" title="Salvar em playlist">${I.listAdd}</button></div></div></div>`;
}
const empty = (a, b) => `<div class="empty">${I.music}<b>${a}</b>${b}</div>`;
const skel = '<div class="card sk"><div class="card-art"></div><div class="sk-line"></div><div class="sk-line s"></div></div>';
function setFill(el, f) { el.style.setProperty('--v', (Math.max(0, Math.min(1, f || 0)) * 100) + '%'); }
function keepFocus(fn) {
  const a = document.activeElement, r = a?.closest?.('[data-i]'), key = r && [r.parentElement?.id || r.closest('.view')?.id, r.dataset.i, a.dataset.act];
  fn();
  if (key) { const el = document.querySelector(`#${key[0]} [data-i="${key[1]}"] [data-act="${key[2]}"]`) || document.querySelector(`#${key[0]} [data-act="${key[2]}"]`); el?.focus(); }
}
function render() {
  const s = view(), t = s.queue[s.index] || null;
  document.body.classList.toggle('is-playing', !!s.playing);
  $('#bPlay').innerHTML = s.playing ? I.pause : I.play;
  $('#barTitle').textContent = $('#npTitle').textContent = t?.title || 'Nada tocando';
  $('#barArtist').textContent = t?.artist || (remote ? 'Controlando a TV ' + remote.code : '');
  $('#npArtist').textContent = t?.artist || (remote ? 'Controlando a TV ' + remote.code : 'Busque algo pra começar');
  const img = t ? `url('${thumb(t.id)}')` : '';
  if (img !== curImg) {
    curImg = img;
    $('#barThumb').style.backgroundImage = $('#npArt').style.backgroundImage = $('.bg-img').style.backgroundImage = img;
    $('#npArt').classList.toggle('empty', !t); $('#npArt').innerHTML = t ? '' : I.music;
  }
  $('#bShuffle').classList.toggle('on', !!s.shuffle);
  $('#bRepeat').classList.toggle('on', s.repeat && s.repeat !== 'off'); $('#bRepeat').dataset.one = s.repeat === 'one' ? '1' : '';
  if (!volDrag) setFill($('#vol'), (s.volume ?? 80) / 100);
  const ns = s.index + '|' + s.queue.map(x => x.id).join(',') + '|' + !!remote;
  if (ns !== sig) {
    sig = ns; register(s.queue);
    keepFocus(() => {
      const nx = s.queue.slice(s.index + 1, s.index + 13);
      $('#npNext').innerHTML = nx.length ? nx.map((x, k) => row(x, s.index + 1 + k, { act: 'jump' })).join('') : '<p class="sub">Fila vazia. Adicione músicas com <b>+</b>.</p>';
      if (curView === 'queue') renderQueue();
    });
    $$('.card').forEach(c => c.classList.toggle('playing', c.dataset.id === t?.id));
  }
  progress(s);
  document.title = t ? `${t.title} · Wave` : 'Wave — Player';
  if ('mediaSession' in navigator && !remote) {
    if (t && t.id !== msId) { msId = t.id; navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, artwork: [{ src: thumb(t.id), sizes: '480x360', type: 'image/jpeg' }] }); }
    navigator.mediaSession.playbackState = s.playing ? 'playing' : 'paused';
  }
}
function progress(s = view()) {
  const d = s.duration || 0, f = seekPrev ?? (d ? s.time / d : 0);
  setFill($('#seek'), f); $('#tCur').textContent = fmt(seekPrev != null ? seekPrev * d : s.time); $('#tDur').textContent = fmt(d);
}
function renderQueue() {
  const s = view(); register(s.queue);
  $('#view-queue').innerHTML = `<div class="head"><h2 class="title">Fila${remote ? ' <span class="sub">· na TV ' + remote.code + '</span>' : ''}</h2>${s.queue.length ? `<div class="btns" style="margin:0"><button class="btn" data-act="qsave">${I.listAdd} Salvar como playlist</button><button class="btn" data-act="qclear">${I.trash} Limpar</button></div>` : ''}</div>`
    + (s.queue.length ? `<div class="rows" id="qrows">${s.queue.map((t, i) => row(t, i, { cur: i === s.index, act: 'jump', rm: 'qrm' })).join('')}</div>` : empty('Sua fila está vazia', 'Busque uma música e toque em + para adicionar.'));
}

/* ---------------- Playlists (localStorage) ---------------- */
const PL = {
  all() { return LS.get('wave.playlists', []); }, save(l) { LS.set('wave.playlists', l); },
  get(id) { return this.all().find(p => p.id === id); },
  create(name, tracks = []) { const l = this.all(), p = { id: uid(), name, tracks, created: Date.now() }; l.unshift(p); this.save(l); return p; },
  update(id, fn) { const l = this.all(), p = l.find(x => x.id === id); if (p) { fn(p); this.save(l); } return p; },
  remove(id) { this.save(this.all().filter(p => p.id !== id)); },
};
let openPl = null;
function mosaic(p) {
  const ts = p.tracks.slice(0, 4), bg = t => `<div style="background-image:url('${thumb(t.id)}')"></div>`;
  if (!ts.length) return `<div class="mosaic none">${I.music}</div>`;
  return ts.length < 4 ? `<div class="mosaic one">${bg(ts[0])}</div>` : `<div class="mosaic">${ts.map(bg).join('')}</div>`;
}
function renderPlaylists() {
  const el = $('#view-playlists'), p = openPl && PL.get(openPl);
  if (p) {
    register(p.tracks);
    const tot = p.tracks.reduce((a, t) => a + secs(t.duration), 0);
    el.innerHTML = `<button class="chip" data-act="plback" style="margin-top:8px">← Playlists</button><div class="pl-head">${mosaic(p)}<div><div class="lbl">Playlist</div><h1>${esc(p.name)}</h1><div class="sub">${p.tracks.length} músicas · ${fmt(tot)}</div><div class="btns">${p.tracks.length ? `<button class="btn pri" data-act="plall">${I.play} Tocar${remote ? ' na TV' : ''}</button><button class="btn" data-act="plshuf">${I.shuffle} Aleatório</button><button class="btn" data-act="plqueue">${I.plus} Fila</button>` : ''}<button class="btn" data-act="plren">Renomear</button><button class="btn" data-act="pldel" title="Excluir">${I.trash}</button></div></div></div>`
      + (p.tracks.length ? `<div class="rows" id="plrows">${p.tracks.map((t, i) => row(t, i, { act: 'plplay', rm: 'plrm' })).join('')}</div>` : empty('Playlist vazia', 'Busque músicas e toque no ícone de lista pra salvar aqui.'));
    return;
  }
  openPl = null; const l = PL.all();
  el.innerHTML = `<div class="head"><h2 class="title">Suas playlists</h2><div class="btns" style="margin:0"><button class="btn pri" data-act="plnew">${I.plus} Nova</button><button class="btn" data-act="plimport">Importar</button>${l.length ? '<button class="btn" data-act="plexport">Exportar</button>' : ''}</div></div><p class="sub" style="margin:-6px 0 18px">Salvas localmente neste navegador. Use Exportar pra fazer backup.</p>`
    + (l.length ? `<div class="grid">${l.map(p => `<button class="pl-card" data-act="plopen" data-pl="${p.id}">${mosaic(p)}<div class="card-title">${esc(p.name)}</div><div class="card-sub">${p.tracks.length} músicas</div></button>`).join('')}</div>` : empty('Nenhuma playlist ainda', 'Crie uma e comece a salvar suas músicas.'));
}
function addToPl(id, tracks) {
  let n = 0; const p = PL.update(id, p => { for (const t of tracks.map(clean).filter(Boolean)) if (!p.tracks.some(x => x.id === t.id)) { p.tracks.push(t); n++; } });
  toast(n ? `Salvo em “${p.name}”` : 'Já estava na playlist'); if (curView === 'playlists') renderPlaylists();
}

/* ---------------- Modais ---------------- */
function modal(html) { $('#modalCard').innerHTML = html; $('#modal').classList.add('open'); setTimeout(() => $('#modalCard').querySelector('input,button.pri,button')?.focus(), 50); }
function closeModal() { $('#modal').classList.remove('open'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
function promptModal(title, val, cb) {
  modal(`<h3>${title}</h3><input class="field" id="mIn" maxlength="80" value="${esc(val || '')}" placeholder="Nome da playlist"><div class="mrow"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" id="mOk">Salvar</button></div>`);
  const i = $('#mIn'), ok = () => { const v = i.value.trim(); if (!v) return i.focus(); closeModal(); cb(v); };
  $('#mOk').onclick = ok; i.onkeydown = e => { if (e.key === 'Enter') ok(); };
}
function confirmModal(title, text, cb) {
  modal(`<h3>${title}</h3><p>${text}</p><div class="mrow"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" id="mOk">Confirmar</button></div>`);
  $('#mOk').onclick = () => { closeModal(); cb(); };
}
function pickPlaylist(tracks) {
  const l = PL.all();
  modal(`<h3>Salvar em playlist</h3><p>${tracks.length === 1 ? esc(tracks[0].title) : tracks.length + ' músicas'}</p><div class="pl-pick">${l.map(p => `<button data-pid="${p.id}">${mosaic(p)}<span><b>${esc(p.name)}</b><br><small>${p.tracks.length} músicas</small></span></button>`).join('')}</div><input class="field" id="mNew" placeholder="Ou crie uma nova playlist…" maxlength="80"><div class="mrow"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" id="mCreate">Criar e salvar</button></div>`);
  $$('#modal [data-pid]').forEach(b => b.onclick = () => { addToPl(b.dataset.pid, tracks); closeModal(); });
  const c = () => { const n = $('#mNew').value.trim(); if (!n) return $('#mNew').focus(); addToPl(PL.create(n).id, tracks); closeModal(); };
  $('#mCreate').onclick = c; $('#mNew').onkeydown = e => { if (e.key === 'Enter') c(); };
  if (l.length) setTimeout(() => $('#modal [data-pid]').focus(), 60);
}
function castModal() {
  if (isTV) return;
  if (remote) {
    modal(`<div class="m-ic">${I.cast}</div><h3>Conectado à TV ${remote.code}</h3><p>Tudo que você tocar, buscar ou mandar pra fila vai pra TV. As playlists continuam salvas neste aparelho.</p><div class="mrow"><button class="btn" data-act="close">Fechar</button><button class="btn pri" id="mDisc">Desconectar</button></div>`);
    $('#mDisc').onclick = () => { closeModal(); disconnect(true); }; return;
  }
  modal(`<div class="m-ic">${I.cast}</div><h3>Transmitir pra TV</h3><p>1. No navegador da TV, abra <b>${esc(location.host)}/#tv</b><br>2. Digite aqui o código que aparece na tela (ou escaneie o QR code).</p><input class="field code-in" id="mCode" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="•••••"><div class="mrow"><button class="btn" data-act="close">Cancelar</button><button class="btn pri" id="mGo">Conectar</button></div>`);
  const inp = $('#mCode'); inp.value = LS.get('wave.lastCode', '') || '';
  const go = async () => { const c = inp.value.trim().toUpperCase(); if (c.length !== 5) return toast('O código tem 5 caracteres'); $('#mGo').textContent = 'Conectando…'; if (await connect(c)) closeModal(); else if ($('#mGo')) $('#mGo').textContent = 'Conectar'; };
  $('#mGo').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
}

/* ---------------- Busca ---------------- */
const CHIPS = ['Top hits Brasil', 'Lo-fi pra estudar', 'MPB clássica', 'Sertanejo', 'Funk', 'Rock anos 80', 'Pagode', 'Jazz relaxante', 'Eletrônica', 'Rap nacional', 'Indie', 'Bossa nova'];
let sq = { q: '', next: null, loading: false };
function renderHome() {
  const h = new Date().getHours(), rec = LS.get('wave.recent', []); register(rec);
  $('#homeContent').innerHTML = `<h2 class="title">${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'} ✨</h2><div class="chips">${CHIPS.map(c => `<button class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>${rec.length ? '<h3 class="sect">Tocadas recentemente</h3>' : ''}`;
  $('#results').innerHTML = rec.length ? rec.map(card).join('') : empty('Comece buscando algo', 'Digite um artista, música ou álbum lá em cima.');
  $('#more').hidden = true;
}
async function doSearch(q, more = false) {
  q = (q || '').trim();
  if (!more) {
    if (!q) { sq = { q: '', next: null }; renderHome(); return; }
    sq = { q, next: null, loading: true }; go('home');
    $('#homeContent').innerHTML = `<div class="head"><h2 class="title">Resultados para “${esc(q)}”</h2><button class="chip" data-act="home">Limpar</button></div>`;
    $('#results').innerHTML = skel.repeat(8); $('#more').hidden = true;
  } else { if (sq.loading || !sq.next) return; sq.loading = true; $('#more').textContent = 'Carregando…'; }
  try {
    const r = await fetch('/api/search?' + new URLSearchParams(more ? { c: sq.next } : { q }));
    let d; try { d = await r.json(); } catch { throw new Error(r.status === 404 ? 'A função /api/search não foi encontrada no deploy. Confira se a pasta api/ está na raiz do projeto na Vercel.' : 'Resposta inválida do servidor (' + r.status + ').'); }
    if (!r.ok) throw new Error(d.error || 'Erro na busca');
    if (sq.q !== q) return;
    register(d.items); const html = d.items.map(card).join('');
    if (more) $('#results').insertAdjacentHTML('beforeend', html); else $('#results').innerHTML = html || empty('Nada encontrado', 'Tente outros termos.');
    sq.next = d.next || null; $('#more').hidden = !sq.next;
    const t = view().queue[view().index]; $$('.card').forEach(c => c.classList.toggle('playing', c.dataset.id === t?.id));
  } catch (e) {
    if (!more) $('#results').innerHTML = empty('Não deu pra buscar', esc(e.message)); else toast('Erro ao carregar mais');
  } finally { sq.loading = false; $('#more').textContent = 'Carregar mais'; }
}
$('#searchForm').addEventListener('submit', e => { e.preventDefault(); $('#q').blur(); doSearch($('#q').value); });
$('#more').addEventListener('click', () => doSearch(sq.q, true));
new IntersectionObserver(es => { if (es[0].isIntersecting && !isTV) doSearch(sq.q, true); }, { rootMargin: '300px' }).observe($('#more'));

/* ---------------- Navegação & ações ---------------- */
function go(v) {
  curView = v;
  $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
  $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  if (v === 'queue') renderQueue();
  if (v === 'playlists') renderPlaylists();
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-q],[data-view]'); if (!el) return;
  if (el.dataset.view) return go(el.dataset.view);
  if (el.dataset.q != null && !el.dataset.act) { $('#q').value = el.dataset.q; return doSearch(el.dataset.q); }
  const a = el.dataset.act, host = el.closest('[data-id]'), t = host && TR.get(host.dataset.id), i = host ? +host.dataset.i : -1, p = openPl && PL.get(openPl);
  switch (a) {
    case 'play': if (t) act('playTrack', { track: t }); break;
    case 'add': if (t) { act('add', { track: t }); toast('Adicionada à fila'); } break;
    case 'next': if (host && t) { act('playNext', { track: t }); toast('Vai tocar a seguir'); } else if (!host) act('next'); break;
    case 'pl': if (t) pickPlaylist([t]); break;
    case 'jump': act('jump', { i }); break;
    case 'qrm': act('remove', { i }); break;
    case 'qclear': confirmModal('Limpar fila?', 'Todas as músicas da fila serão removidas.', () => act('clear')); break;
    case 'qsave': { const q = view().queue; if (q.length) promptModal('Salvar fila como playlist', 'Minha fila', n => { PL.create(n, q.map(clean)); toast('Playlist criada'); }); break; }
    case 'toggle': case 'prev': case 'shuffle': case 'repeat': act(a); break;
    case 'cast': castModal(); break;
    case 'close': closeModal(); break;
    case 'home': $('#q').value = ''; doSearch(''); break;
    case 'npopen': if (document.body.classList.contains('mobile')) $('#np').classList.add('open'); break;
    case 'npclose': $('#np').classList.remove('open'); break;
    case 'video': { const on = $('#np').classList.toggle('video'); LS.set('wave.video.' + (isTV ? 'tv' : 'n'), on); $('#videoBtn').textContent = on ? 'Mostrar capa' : 'Mostrar vídeo'; break; }
    case 'npsave': { const s = view(), c = s.queue[s.index]; if (c) pickPlaylist([c]); else toast('Nada tocando'); break; }
    case 'plopen': openPl = el.dataset.pl; renderPlaylists(); $('#view-playlists').scrollTop = 0; break;
    case 'plback': openPl = null; renderPlaylists(); break;
    case 'plnew': promptModal('Nova playlist', '', n => { openPl = PL.create(n).id; renderPlaylists(); }); break;
    case 'plplay': if (p) act('playList', { tracks: p.tracks, index: i }); break;
    case 'plall': if (p) act('playList', { tracks: p.tracks, index: 0 }); break;
    case 'plshuf': if (p) act('playList', { tracks: [...p.tracks].sort(() => Math.random() - .5), index: 0 }); break;
    case 'plqueue': if (p) { act('add', { tracks: p.tracks }); toast('Playlist adicionada à fila'); } break;
    case 'plrm': if (p) { keepFocus(() => { PL.update(p.id, x => x.tracks.splice(i, 1)); renderPlaylists(); }); } break;
    case 'plren': if (p) promptModal('Renomear playlist', p.name, n => { PL.update(p.id, x => x.name = n); renderPlaylists(); }); break;
    case 'pldel': if (p) confirmModal('Excluir playlist?', `“${esc(p.name)}” será apagada deste navegador.`, () => { PL.remove(p.id); openPl = null; renderPlaylists(); }); break;
    case 'plexport': {
      const b = new Blob([JSON.stringify({ app: 'wave', v: 1, playlists: PL.all() }, null, 2)], { type: 'application/json' });
      const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'wave-playlists.json'; l.click(); setTimeout(() => URL.revokeObjectURL(l.href), 1000); break;
    }
    case 'plimport': {
      const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json';
      f.onchange = async () => {
        try {
          const d = JSON.parse(await f.files[0].text()), arr = Array.isArray(d) ? d : d.playlists; if (!Array.isArray(arr)) throw 0;
          const l = PL.all(); let n = 0;
          for (const x of arr) if (x && Array.isArray(x.tracks)) { l.push({ id: uid(), name: String(x.name || 'Importada').slice(0, 80), tracks: x.tracks.map(clean).filter(Boolean), created: Date.now() }); n++; }
          PL.save(l); toast(n + ' playlist(s) importada(s)'); renderPlaylists();
        } catch { toast('Arquivo inválido'); }
      };
      f.click(); break;
    }
  }
});

/* sliders */
function slider(el, { input, commit, get, step = .05 }) {
  let drag = false; el.tabIndex = 0;
  const pos = e => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); };
  el.addEventListener('pointerdown', e => { drag = true; el.setPointerCapture(e.pointerId); el.dataset.drag = 1; input(pos(e)); });
  el.addEventListener('pointermove', e => { if (drag) input(pos(e)); });
  el.addEventListener('pointerup', e => { if (!drag) return; drag = false; delete el.dataset.drag; commit(pos(e)); });
  el.addEventListener('pointercancel', () => { drag = false; delete el.dataset.drag; commit(null); });
  el.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); commit(Math.min(1, Math.max(0, get() + (e.key === 'ArrowRight' ? step : -step)))); } });
}
slider($('#seek'), {
  input: f => { seekPrev = f; progress(); },
  commit: f => { seekPrev = null; const s = view(); if (f != null && s.duration) { act('seek', { t: f * s.duration }); if (remote?.state) { remote.state.time = f * s.duration; remote.at = performance.now(); } } progress(); },
  get: () => { const s = view(); return s.duration ? s.time / s.duration : 0; }, step: .03,
});
let volT = 0;
slider($('#vol'), {
  input: f => { volDrag = true; setFill($('#vol'), f); if (performance.now() - volT > 120) { volT = performance.now(); act('vol', { v: Math.round(f * 100) }); } },
  commit: f => { volDrag = false; if (f != null) { setFill($('#vol'), f); act('vol', { v: Math.round(f * 100) }); } },
  get: () => (view().volume ?? 80) / 100, step: .1,
});

/* teclado + navegação por controle remoto da TV (setas) */
function focusables() {
  const inModal = $('#modal').classList.contains('open'), start = $('.tv-start');
  return $$('button, a[href], input, [tabindex="0"]').filter(el => {
    if (el.disabled || el.closest('[hidden]')) return false;
    if (start) return start.contains(el);
    if (inModal !== !!el.closest('#modal')) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
}
function spatial(dx, dy) {
  const els = focusables(), cur = document.activeElement;
  if (!els.includes(cur)) return els[0]?.focus();
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect(), vx = b.left + b.width / 2 - cx, vy = b.top + b.height / 2 - cy;
    const along = vx * dx + vy * dy; if (along <= 2) continue;
    const score = along + Math.abs(dx ? vy : vx) * 2.5;
    if (score < bs) { bs = score; best = el; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }
}
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName, typing = tag === 'INPUT';
  const back = e.key === 'Escape' || e.key === 'GoBack' || e.keyCode === 461 || e.keyCode === 10009 || (e.key === 'Backspace' && !typing);
  if (back) { if ($('#modal').classList.contains('open')) closeModal(); else if ($('#np').classList.contains('open')) $('#np').classList.remove('open'); else if (isTV) { if (openPl) { openPl = null; renderPlaylists(); } else go('home'); } if (isTV || e.key === 'Escape') e.preventDefault(); return; }
  if (e.key === 'MediaPlayPause' || (e.key === ' ' && !typing && tag !== 'BUTTON')) { e.preventDefault(); return act('toggle'); }
  if (e.key === 'MediaTrackNext') return act('next');
  if (e.key === 'MediaTrackPrevious') return act('prev');
  if (!isTV) return;
  const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (!d || (typing && d[0])) return;
  e.preventDefault(); spatial(...d);
});

if ('mediaSession' in navigator) {
  const h = { play: () => act('toggle'), pause: () => act('toggle'), nexttrack: () => act('next'), previoustrack: () => act('prev') };
  for (const k in h) try { navigator.mediaSession.setActionHandler(k, h[k]); } catch {}
}

const mq = () => document.body.classList.toggle('mobile', !isTV && innerWidth < 900);
addEventListener('resize', mq); mq();
addEventListener('hashchange', () => { const h = location.hash; if ((h === '#tv') !== isTV || h.startsWith('#connect=')) location.reload(); });

/* ---------------- Boot ---------------- */
engine.on(k => {
  if (k === 'tick') { if (!remote) progress(); if (isTV && performance.now() - lastBc > 1000) broadcast(); return; }
  if (!remote) render();
  if (isTV) broadcast();
});
setInterval(() => { if (remote?.state?.playing) progress(); }, 300);
engine.init();
if (LS.get('wave.video.' + (isTV ? 'tv' : 'n'), isTV)) { $('#np').classList.add('video'); $('#videoBtn').textContent = 'Mostrar capa'; }
renderHome(); render();

if (isTV) {
  document.body.classList.add('tv');
  const o = document.createElement('div'); o.className = 'tv-start';
  o.innerHTML = `<div><div class="logo-mark">${I.wave}</div><h1>Wave TV</h1><p>Aperte OK no controle pra ativar o som</p><button class="btn pri" id="tvGo">${I.play} Começar</button></div>`;
  document.body.append(o); setTimeout(() => $('#tvGo').focus(), 100);
  $('#tvGo').onclick = () => { o.remove(); if (engine.ready && engine.cur()) engine.yt.playVideo(); $('#q').focus(); };
  startTV();
} else {
  const m = location.hash.match(/^#connect=([A-Za-z0-9]{5})$/);
  if (m) { history.replaceState(null, '', location.pathname); connect(m[1].toUpperCase()); }
  else { const c = LS.get('wave.autoCode', null); if (c) connect(c, { silent: true }); }
}
})();
