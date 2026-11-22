/* VSTEP B2 Speaking – hệ thống tự học 30 phút/ngày */
(function () {
  'use strict';
  const D = window.VSTEP_DATA;
  const PLAN = window.VSTEP_PLAN;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');

  // Thời gian thi (giây)
  const TIME = { p1: 35, p2prep: 60, p2: 180, p3prep: 60, p3: 180, fu: 40 };
  const PART_NAME = { p1: 'Part 1', p2: 'Part 2', p3: 'Part 3', fu: 'Part 3 · câu hỏi phụ' };

  /* ---------- Ngày ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const fmtD = s => { const d = parseD(s); return `${WD[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };

  /* ---------- Lưu trữ ---------- */
  const KEY = 'vstep-b2-progress-v1';
  const defaults = () => ({ done: {}, items: {}, log: [], settings: { rate: 0.9, voice: '', showVi: false, fs: 1, minutes: 30, eleven: true, setup: false } });
  let S;
  try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = defaults(); }
  S.settings = Object.assign(defaults().settings, S.settings || {});
  const applyFs = () => document.documentElement.style.setProperty('--fs', S.settings.fs || 1);
  applyFs();
  // Chế độ thời lượng học mỗi ngày
  const MODES = {
    15: { review: 1, learn: false, shadow: false, attempts: 1, extraMock: false, info: 'Nghe 1 lần → nói & ghi âm → tự chấm. Bỏ bước học từ khóa (từ khóa hiện ngay ở bước Nói). Ôn 1 câu.' },
    20: { review: 2, learn: false, shadow: true, attempts: 1, extraMock: false, info: 'Nghe + nói nhại → nói & ghi âm → tự chấm. Từ khóa hiện ở bước Nói. Ôn 2 câu.' },
    30: { review: 3, learn: true, shadow: true, attempts: 1, extraMock: false, info: 'Đủ 4 bước: Nghe & nói nhại → Học từ khóa → Nói & ghi âm → Tự chấm. Ôn 3 câu.' },
    40: { review: 5, learn: true, shadow: true, attempts: 2, extraMock: false, info: 'Đủ 4 bước, mỗi câu nói 2 lần (lần 2 che gợi ý). Ôn 5 câu.' },
    60: { review: 8, learn: true, shadow: true, attempts: 2, extraMock: true, info: 'Đủ 4 bước, nói 2 lần, ôn 8 câu, cuối buổi thi thử thêm phần đang học.' },
  };
  const mode = () => MODES[S.settings.minutes] || MODES[30];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* bỏ qua */ } };

  // IndexedDB cho bản ghi âm
  const idb = (() => {
    let dbp;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open('vstep-b2-rec', 1);
      r.onupgradeneeded = () => { const s = r.result.createObjectStore('rec', { keyPath: 'id' }); s.createIndex('card', 'card'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction('rec', mode); const st = t.objectStore('rec'); const out = fn(st);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error);
    }));
    return {
      put: rec => tx('readwrite', st => st.put(rec)).catch(() => null),
      all: () => tx('readonly', st => st.getAll()).catch(() => []),
      del: id => tx('readwrite', st => st.delete(id)).catch(() => null),
      byCard: card => tx('readonly', st => st.index('card').getAll(card)).catch(() => []),
    };
  })();

  /* ---------- Chỉ mục thẻ học ---------- */
  const CARDS = {};
  D.sets.forEach(set => {
    set.p1.forEach((topic, ti) => topic.qs.forEach((q, qi) => {
      CARDS[q.id] = { id: q.id, kind: 'p1', set: set.id, topic, ti, qi, q };
    }));
    CARDS[set.p2.id] = { id: set.p2.id, kind: 'p2', set: set.id, p2: set.p2 };
    CARDS[set.p3.id] = { id: set.p3.id, kind: 'p3', set: set.id, p3: set.p3 };
    set.p3.fu.forEach((f, j) => { CARDS[f.id] = { id: f.id, kind: 'fu', set: set.id, p3: set.p3, f, j }; });
  });
  const cardTitle = c => {
    if (c.kind === 'p1') return c.q.q;
    if (c.kind === 'p2') return c.p2.situation;
    if (c.kind === 'p3') return c.p3.topic;
    return c.f.q;
  };
  const cardModel = c => { // các đoạn bài mẫu [{t, t_vi, h}]
    if (c.kind === 'p1') return [{ t: c.q.a, t_vi: c.q.a_vi }];
    if (c.kind === 'fu') return [{ t: c.f.a, t_vi: c.f.a_vi }];
    if (c.kind === 'p2') return c.p2.paras.map(p => ({ t: p.t, t_vi: p.t_vi, h: p.h }));
    return c.p3.speech.concat(c.p3.concl).map(p => ({ t: p.t, t_vi: p.t_vi }));
  };
  const speakTime = c => TIME[c.kind];
  const prepTime = c => (c.kind === 'p2' ? TIME.p2prep : c.kind === 'p3' ? TIME.p3prep : 0);

  /* ---------- Ôn tập giãn cách ---------- */
  const GAPS = [1, 3, 7, 14];
  function rate(id, r) { // r: 0 chưa được, 1 tạm, 2 tốt
    const it = S.items[id] || { box: 0, reps: 0 };
    it.reps++; it.last = today(); it.lastRate = r;
    if (r === 2) it.box = Math.min(it.box + 1, GAPS.length - 1);
    else if (r === 0) it.box = 0;
    it.due = addDays(today(), r === 1 ? 1 : GAPS[it.box]);
    if (r === 0) it.due = addDays(today(), 1);
    S.items[id] = it;
    S.log.push({ d: today(), id, r });
    if (S.log.length > 2000) S.log = S.log.slice(-2000);
    save();
  }
  const dueCards = (max, exclude = []) => Object.entries(S.items)
    .filter(([id, it]) => CARDS[id] && it.due <= today() && !exclude.includes(id))
    .sort((a, b) => (a[1].lastRate - b[1].lastRate) || a[1].due.localeCompare(b[1].due))
    .slice(0, max).map(([id]) => id);
  const weakCards = () => Object.entries(S.items).filter(([id, it]) => CARDS[id] && it.lastRate === 0).map(([id]) => id);

  /* ---------- Giọng đọc (TTS) ---------- */
  const synth = window.speechSynthesis;
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices().filter(v => /^en[-_]/i.test(v.lang)) : []; };
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  const pickVoice = () => voices.find(v => v.name === S.settings.voice) || voices.find(v => /en-US/i.test(v.lang) && /Samantha|Ava|Allison/i.test(v.name)) || voices.find(v => /en-US/i.test(v.lang)) || voices[0];
  // File âm thanh ElevenLabs tạo sẵn (audio/manifest.json), nếu có
  let AUDIO = {};
  const norm = t => String(t).replace(/\s+/g, ' ').trim();
  const fnv = t => { let h = 0x811c9dc5; for (const b of new TextEncoder().encode(norm(t))) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  fetch('audio/manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {})).then(m => { AUDIO = m || {}; }).catch(() => {});
  const audioCount = () => Object.keys(AUDIO).length;
  const player = new Audio(); player.preload = 'auto'; player.setAttribute('playsinline', '');
  let playerDone = null;
  function sayAudio(file, opts) {
    return new Promise(res => {
      if (playerDone) playerDone();
      let t0 = Date.now(), finished = false;
      const done = () => { if (finished) return; finished = true; playerDone = null; player.onended = player.onerror = player.onplaying = null; res(Date.now() - t0); };
      playerDone = done;
      player.src = file;
      player.playbackRate = opts.rate || S.settings.rate;
      if ('preservesPitch' in player) player.preservesPitch = true;
      player.onplaying = () => { t0 = Date.now(); };
      player.onended = done; player.onerror = done;
      const p = player.play(); if (p && p.catch) p.catch(done);
    });
  }
  function say(text, opts = {}) {
    const file = S.settings.eleven !== false && AUDIO[fnv(text)];
    if (file) { if (synth) synth.cancel(); return sayAudio(file, opts); }
    return new Promise(res => {
      if (!synth) return res(0);
      if (playerDone) { player.pause(); playerDone(); }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
      u.rate = opts.rate || S.settings.rate;
      let t0 = Date.now();
      u.onstart = () => { t0 = Date.now(); };
      u.onend = () => res(Date.now() - t0);
      u.onerror = () => res(Date.now() - t0);
      synth.speak(u);
    });
  }
  // Chọn tốc độ đọc: dùng ở màn Aa, bước Nghe và trang Tiến độ
  const SPEEDS = [0.7, 0.8, 0.9, 1, 1.15, 1.3];
  const speedSeg = () => `<div class="seg speed">${SPEEDS.map(v => `<button data-rate="${v}" class="${Math.abs(S.settings.rate - v) < 0.01 ? 'on' : ''}">${v}×</button>`).join('')}</div>`;
  function bindSpeed(root = document) {
    $$('.seg.speed button', root).forEach(b => b.onclick = () => {
      S.settings.rate = +b.dataset.rate; save();
      $$('.seg.speed button').forEach(x => x.classList.toggle('on', Math.abs(+x.dataset.rate - S.settings.rate) < 0.01));
      if (playerDone) player.playbackRate = S.settings.rate;
    });
  }
  const stopSay = () => { if (synth) synth.cancel(); if (playerDone) { player.pause(); playerDone(); } };
  const sentences = text => (text.match(/[^.!?]+[.!?]+["”’]?\s*|[^.!?]+$/g) || [text]).map(s => s.trim()).filter(Boolean);

  /* ---------- Âm báo ---------- */
  let actx;
  const unlockAudio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* */ } };
  function beep(freq = 880, ms = 180, times = 1) {
    if (!actx) return;
    for (let i = 0; i < times; i++) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + i * (ms / 1000 + 0.12);
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
      o.start(t); o.stop(t + ms / 1000 + 0.02);
    }
  }

  /* ---------- Ghi âm ---------- */
  const Rec = {
    stream: null, mr: null, chunks: [],
    supported: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
    async ensure() {
      if (this.stream && this.stream.active) return this.stream;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      return this.stream;
    },
    mime() {
      const c = ['audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm'];
      return c.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    },
    async start() {
      await this.ensure();
      const mime = this.mime();
      this.mr = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
      this.chunks = [];
      this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.t0 = Date.now();
      this.mr.start(1000);
    },
    stop() {
      return new Promise(res => {
        if (!this.mr || this.mr.state === 'inactive') return res(null);
        this.mr.onstop = () => {
          const type = this.mr.mimeType || this.mime() || 'audio/mp4';
          res({ blob: new Blob(this.chunks, { type }), dur: Math.round((Date.now() - this.t0) / 1000), mime: type });
        };
        this.mr.stop();
      });
    },
    release() { if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; } },
  };
  async function saveRec(cardId, r, label) {
    if (!r || !r.blob || !r.blob.size) return null;
    const rec = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, card: cardId, date: today(), ts: Date.now(), blob: r.blob, mime: r.mime, dur: r.dur, label: label || '' };
    await idb.put(rec);
    // giữ tối đa 150 bản ghi
    const all = await idb.all();
    if (all.length > 150) all.sort((a, b) => a.ts - b.ts).slice(0, all.length - 150).forEach(x => idb.del(x.id));
    return rec;
  }

  /* ---------- Giữ màn hình sáng ---------- */
  let wakeLock = null;
  const keepAwake = async on => {
    try {
      if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
      if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { /* không hỗ trợ */ }
  };

  /* ---------- Bộ đếm giờ ---------- */
  let ticker = null;
  const clearTicker = () => { if (ticker) { clearInterval(ticker); ticker = null; } };
  const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${pad(Math.max(0, s) % 60)}`;
  function countdown(sec, onTick, onEnd) {
    clearTicker();
    const end = Date.now() + sec * 1000;
    const tick = () => {
      const left = Math.ceil((end - Date.now()) / 1000);
      onTick(left);
      if (left <= 0) { clearTicker(); onEnd && onEnd(); }
    };
    tick(); ticker = setInterval(tick, 250);
  }

  /* ---------- Thanh điều hướng ---------- */
  const TABS = [['today', 'Hôm nay', 'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
    ['plan', 'Lịch', 'M7 2v3M17 2v3M3 8h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z'],
    ['sets', 'Đề', 'M4 4h11l5 5v11H4zM15 4v5h5M8 13h8M8 17h6'],
    ['mock', 'Thi thử', 'M12 8v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],
    ['stats', 'Tiến độ', 'M4 20V10M10 20V4M16 20v-7M22 20H2']];
  function nav(active) {
    return `<nav class="tabbar">${TABS.map(([k, l, d]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span>${l}</span></a>`).join('')}</nav>`;
  }
  function page(active, title, body, opts = {}) {
    stopAll();
    app.innerHTML = `<header class="top">${opts.back ? `<a class="back" href="${opts.back}" aria-label="Quay lại">‹</a>` : ''}<h1>${title}</h1>${opts.right || ''}</header><main class="main">${body}</main>${opts.noNav ? '' : nav(active)}`;
    window.scrollTo(0, 0);
  }
  function stopAll() { clearTicker(); stopSay(); if (Rec.mr && Rec.mr.state !== 'inactive') Rec.mr.stop(); }

  /* ---------- Lịch ---------- */
  const dayByDate = d => PLAN.days.find(x => x.date === d);
  const daysLeft = () => diffDays(today(), PLAN.exam);
  function streak() {
    let n = 0, d = today();
    if (!S.done[d]) d = addDays(d, -1);
    while (S.done[d]) { n++; d = addDays(d, -1); }
    return n;
  }
  function currentDay() {
    const t = today();
    const d = dayByDate(t);
    if (d) return d;
    if (t < PLAN.start) return PLAN.days[0];
    return null;
  }

  /* ---------- Màn hình: Hôm nay ---------- */
  function viewToday() {
    const t = today();
    const day = currentDay();
    const left = daysLeft();
    const missed = PLAN.days.filter(x => x.date < t && !S.done[x.date]);
    const due = dueCards(99).length;
    let main = `<section class="hero">
      <div class="big">${left > 0 ? left : left === 0 ? 'Hôm nay' : '✓'}</div>
      <div class="sub">${left > 0 ? `ngày nữa đến kỳ thi VSTEP (${fmtD(PLAN.exam)})` : left === 0 ? 'là ngày thi. Chúc bạn thi tốt!' : 'Kỳ thi đã qua'}</div>
      <div class="chips"><span class="chip">🔥 ${streak()} ngày liên tục</span><span class="chip">${Object.keys(S.done).length}/${PLAN.days.length} buổi</span>${due ? `<span class="chip warn">${due} câu cần ôn</span>` : ''}</div>
    </section>`;
    if (day) {
      const isFuture = day.date > t;
      main += `<section class="card today-card">
        <div class="eyebrow">${isFuture ? `Bắt đầu ${fmtD(day.date)}` : fmtD(day.date)} · ${PLAN.weeks[day.week].split('·')[0].trim()}</div>
        <h2>${esc(day.title)}</h2>
        ${dayOutline(day)}
        ${S.done[day.date] ? '<p class="ok">✓ Đã hoàn thành buổi hôm nay. Có thể học thêm hoặc ôn lại.</p>' : ''}
        <a class="btn primary block" href="#/session/${day.date}">${S.done[day.date] ? 'Học lại buổi này' : `Bắt đầu ${S.settings.minutes} phút`}</a>
        <a class="modeinfo" href="#/settings">⏱ Chế độ ${S.settings.minutes} phút/ngày · Đổi</a>
      </section>`;
    } else if (t > PLAN.exam) {
      main += `<section class="card"><h2>Lộ trình đã kết thúc</h2><p>Bạn vẫn có thể luyện từng đề ở mục <b>Đề</b> hoặc <b>Thi thử</b>.</p></section>`;
    } else {
      main += `<section class="card"><h2>Ôn tự do</h2><p>Hôm nay không có bài trong lịch.</p><a class="btn primary block" href="#/review">Ôn câu đến hạn</a></section>`;
    }
    if (missed.length) {
      main += `<section class="card"><h3>Buổi bị lỡ (${missed.length})</h3><p class="muted">Học bù khi có thời gian. Ưu tiên buổi học bài mới (tuần 1–3).</p>
        <div class="list">${missed.slice(0, 4).map(dayRow).join('')}</div>${missed.length > 4 ? '<a href="#/plan" class="link">Xem tất cả →</a>' : ''}</section>`;
    }
    main += `<section class="card tips"><h3>Một buổi 30 phút</h3>
      <ol class="steps"><li><b>Nghe & nói nhại</b> bài mẫu (5′)</li><li><b>Học</b> từ khóa + khung câu (8′)</li><li><b>Nói thật</b>: ghi âm, đếm giờ như phòng thi (12′)</li><li><b>Tự chấm</b>: nghe lại, tick checklist, ôn câu đến hạn (5′)</li></ol></section>`;
    page('today', 'VSTEP B2 Speaking', main, { right: `<a class="icon-btn" href="#/settings" aria-label="Cỡ chữ và thời lượng">Aa</a><a class="icon-btn" href="#/templates" aria-label="Khung câu">Khung</a>` });
  }
  function dayOutline(day) {
    const parts = [];
    if (day.template) parts.push(`Khung câu ${day.template === 'all' ? 'Part 1, 2, 3' : PART_NAME[day.template]}`);
    if (day.cards.length) {
      const n = { p1: 0, p2: 0, p3: 0, fu: 0 };
      day.cards.forEach(id => n[CARDS[id].kind]++);
      if (n.p1) parts.push(`${n.p1} câu Part 1`);
      if (n.p2) parts.push(`${n.p2} tình huống Part 2`);
      if (n.p3) parts.push(`${n.p3} chủ đề Part 3`);
      if (n.fu) parts.push(`${n.fu} câu hỏi phụ`);
    }
    if (day.mock) parts.push(`Thi thử ${day.mock.parts.map(p => PART_NAME[p]).join(' + ')}`);
    if (day.review) parts.push('Ôn câu đến hạn');
    return `<ul class="outline">${parts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;
  }
  function dayRow(d) {
    const t = today();
    const st = S.done[d.date] ? 'done' : d.date === t ? 'now' : d.date < t ? 'miss' : '';
    return `<a class="row ${st}" href="#/session/${d.date}"><span class="date">${fmtD(d.date)}</span><span class="ttl">${esc(d.title)}</span><span class="st">${st === 'done' ? '✓' : st === 'now' ? '●' : st === 'miss' ? '!' : ''}</span></a>`;
  }

  /* ---------- Cài đặt cỡ chữ + thời lượng ---------- */
  const FS = [[1, 'Vừa'], [1.15, 'Lớn'], [1.3, 'Rất lớn'], [1.5, 'Cực lớn']];
  function viewSettings() {
    const first = !S.settings.setup;
    const body = `${first ? '<section class="card"><h2>Chào bạn 👋</h2><p>Chọn cỡ chữ dễ đọc và thời gian học mỗi ngày. Bạn đổi lại được bất cứ lúc nào bằng nút <b>Aa</b> ở trang chính.</p></section>' : ''}
      <section class="card"><h3>Cỡ chữ</h3><div class="seg fs" id="fs">${FS.map(([v, l]) => `<button data-v="${v}" class="${+S.settings.fs === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="fsdemo"><b>Do you enjoy walking?</b><div class="vi">Bạn có thích đi bộ không?</div></div></section>
      <section class="card"><h3>Mỗi ngày học bao lâu?</h3><div class="seg" id="mins">${Object.keys(MODES).map(m => `<button data-v="${m}" class="${+S.settings.minutes === +m ? 'on' : ''}">${m === '60' ? '1 tiếng' : m + ' phút'}</button>`).join('')}</div>
        <p class="modeinfo" id="minfo">${esc(mode().info)}</p>
        <p class="muted">Bài mới mỗi ngày giữ nguyên để kịp học hết 6 đề trước 29/12. Thời lượng chỉ thay đổi cách học: số bước, số lần nói, số câu ôn.</p></section>
      <section class="card"><h3>Tốc độ đọc bài mẫu</h3>${speedSeg()}<button class="btn" id="spdtest">▶ Nghe thử</button>
        <p class="muted">1× là tốc độ nói bình thường. Mới học nên để 0.8× hoặc 0.9×, gần ngày thi tăng lên 1×.</p></section>
      <a class="btn primary block" href="#/today" id="ok">${first ? 'Bắt đầu' : 'Xong'}</a>`;
    page('today', first ? 'Thiết lập' : 'Cỡ chữ & thời lượng', body, { back: first ? null : '#/today', noNav: first });
    $$('#fs button').forEach(b => b.onclick = () => { S.settings.fs = +b.dataset.v; save(); applyFs(); $$('#fs button').forEach(x => x.classList.toggle('on', x === b)); });
    $$('#mins button').forEach(b => b.onclick = () => { S.settings.minutes = +b.dataset.v; save(); $$('#mins button').forEach(x => x.classList.toggle('on', x === b)); $('#minfo').textContent = mode().info; });
    bindSpeed(); $('#spdtest').onclick = () => { unlockAudio(); say(sentences(D.sets[0].p1[0].qs[0].a)[0]); };
    $('#ok').onclick = () => { S.settings.setup = true; save(); };
  }

  /* ---------- Màn hình: Lịch ---------- */
  function viewPlan() {
    const t = today();
    let body = '';
    [1, 2, 3, 4, 5].forEach(w => {
      const ds = PLAN.days.filter(d => d.week === w);
      body += `<section class="card"><h3>${PLAN.weeks[w]}</h3><div class="list">${ds.map(dayRow).join('')}</div></section>`;
    });
    body += `<section class="card"><div class="row exam"><span class="date">${fmtD(PLAN.exam)}</span><span class="ttl"><b>Thi VSTEP</b></span><span class="st">🎯</span></div></section>`;
    page('plan', 'Lịch học đến 29/12', body);
    const now = $('.row.now'); if (now && t >= PLAN.start) now.scrollIntoView({ block: 'center' });
  }

  /* ---------- Màn hình: Đề ---------- */
  function viewSets() {
    const body = D.sets.map(s => `<a class="card setcard" href="#/set/${s.id}">
      <div class="eyebrow">Đề ${s.id}</div>
      <div class="p"><b>P1</b> ${esc(s.p1.map(x => x.title).join(' · '))}</div>
      <div class="p"><b>P2</b> ${esc(s.p2.situation.split('.')[0])}</div>
      <div class="p"><b>P3</b> ${esc(s.p3.topic)}</div>
      ${setProgress(s)}</a>`).join('');
    page('sets', '6 bộ đề Speaking', `<p class="muted pad">Toàn bộ câu hỏi và bài mẫu trong file <i>${esc(D.source)}</i>.</p>${body}<a class="card setcard" href="#/templates"><div class="eyebrow">Khung câu</div><div class="p">Khung trả lời cho Part 1, 2, 3</div></a>`);
  }
  function setProgress(s) {
    const ids = Object.values(CARDS).filter(c => c.set === s.id).map(c => c.id);
    const learned = ids.filter(id => S.items[id]).length;
    return `<div class="bar"><i style="width:${Math.round(learned / ids.length * 100)}%"></i></div><div class="tiny">${learned}/${ids.length} thẻ đã luyện</div>`;
  }
  function viewSet(id) {
    const s = D.sets[id - 1]; if (!s) return go('#/sets');
    const row = c => { const it = S.items[c.id]; return `<a class="row" href="#/card/${c.id}"><span class="ttl">${esc(cardTitle(c))}</span><span class="st">${it ? ['✗', '~', '✓'][it.lastRate] : ''}</span></a>`; };
    let body = '';
    s.p1.forEach((tp, ti) => {
      body += `<section class="card"><div class="eyebrow">Part 1 · Chủ đề ${ti + 1}</div><h3>${esc(tp.title)} <span class="vi">${esc(tp.title_vi)}</span></h3><div class="list">${tp.qs.map(q => row(CARDS[q.id])).join('')}</div></section>`;
    });
    body += `<section class="card"><div class="eyebrow">Part 2 · Solution Discussion</div><div class="list">${row(CARDS[s.p2.id])}</div></section>`;
    body += `<section class="card"><div class="eyebrow">Part 3 · Topic Development</div><div class="list">${row(CARDS[s.p3.id])}${s.p3.fu.map(f => row(CARDS[f.id])).join('')}</div></section>`;
    body += `<a class="btn primary block" href="#/mockrun/${s.id}-${s.id}-${s.id}">Thi thử nguyên đề ${s.id} (12 phút)</a>`;
    page('sets', `Đề ${s.id}`, body, { back: '#/sets' });
  }

  /* ---------- Màn hình: Khung câu ---------- */
  function templateHtml(key) {
    const tp = D.templates[key];
    return `<section class="card tpl"><h3>${esc(tp.title)}</h3><p class="muted">${esc(tp.how)}</p>
      ${tp.lines.map(([en, vi]) => `<div class="tline"><button class="say" data-say="${esc(en.replace(/…/g, ''))}" aria-label="Nghe">▶</button><div><div class="en">${esc(en)}</div><div class="vi">${esc(vi)}</div></div></div>`).join('')}
    </section>`;
  }
  function viewTemplates() {
    page('sets', 'Khung câu trả lời', ['p1', 'p2', 'p3'].map(templateHtml).join('') + `<p class="muted pad">Bấm ▶ để nghe, rồi đọc to theo 3 lần. Thuộc khung là nói được cả câu hỏi lạ.</p>`, { back: '#/today' });
    bindSay();
  }
  function bindSay(root = document) {
    $$('[data-say]', root).forEach(b => b.onclick = () => { unlockAudio(); say(b.dataset.say); });
  }

  /* ---------- Buổi học (session) ---------- */
  let SES = null;
  function buildSession(date) {
    const day = dayByDate(date);
    if (!day) return null;
    const steps = [];
    if (day.template) (day.template === 'all' ? ['p1', 'p2', 'p3'] : [day.template]).forEach(k => steps.push({ type: 'template', key: k }));
    day.cards.forEach(id => steps.push({ type: 'card', id }));
    if (day.mock) steps.push({ type: 'mock', mock: day.mock });
    if (mode().extraMock && !day.mock && day.cards.length) {
      const part = CARDS[day.cards[0]].kind === 'fu' ? 'p3' : CARDS[day.cards[0]].kind;
      steps.push({ type: 'mock', mock: { parts: [part], random: true } });
    }
    if (day.review) {
      const md = mode();
      const max = day.reviewMax ? Math.min(day.reviewMax, md.review + 4) : (day.mock && S.settings.minutes <= 15 ? 0 : md.review);
      dueCards(max, day.cards).forEach(id => steps.push({ type: 'card', id, review: true }));
    }
    return { date, day, steps, i: 0, start: Date.now(), budget: (S.settings.minutes || 30) * 60 };
  }
  function viewSession(date) {
    if (!SES || SES.date !== date) SES = buildSession(date);
    if (!SES) return go('#/today');
    if (!SES.steps.length) return finishSession();
    keepAwake(true);
    renderStep();
  }
  function sesHeader() {
    const used = Math.floor((Date.now() - SES.start) / 1000);
    return `<div class="sesbar"><span>${SES.i + 1}/${SES.steps.length}</span><div class="bar"><i style="width:${Math.round(SES.i / SES.steps.length * 100)}%"></i></div><span id="sesclock">${mmss(Math.max(0, SES.budget - used))}</span></div>`;
  }
  let sesClock = null;
  function startSesClock() {
    if (sesClock) clearInterval(sesClock);
    sesClock = setInterval(() => {
      const el = $('#sesclock'); if (!el || !SES) { clearInterval(sesClock); sesClock = null; return; }
      el.textContent = mmss(Math.max(0, SES.budget - Math.floor((Date.now() - SES.start) / 1000)));
    }, 1000);
  }
  function renderStep() {
    const st = SES.steps[SES.i];
    if (!st) return finishSession();
    const next = () => { SES.i++; renderStep(); };
    if (st.type === 'template') {
      page('today', 'Khung câu', sesHeader() + templateHtml(st.key) + `<p class="muted pad">Nghe từng dòng và đọc to theo 2–3 lần.</p><button class="btn primary block" id="nx">Tiếp</button>`, { back: '#/today', noNav: true });
      bindSay(); $('#nx').onclick = next; startSesClock();
    } else if (st.type === 'card') {
      renderCard(CARDS[st.id], { session: true, review: st.review, onDone: next });
    } else if (st.type === 'mock') {
      startMock(resolveMock(st.mock), { session: true, onDone: next });
    }
  }
  function finishSession() {
    stopAll(); keepAwake(false);
    const mins = SES ? Math.round((Date.now() - SES.start) / 60000) : 0;
    if (SES) { S.done[SES.date] = { at: Date.now(), mins }; save(); }
    const d = SES && SES.date;
    SES = null;
    page('today', 'Hoàn thành', `<section class="hero"><div class="big">🎉</div><div class="sub">Xong buổi ${d ? fmtD(d) : ''} trong ${mins} phút</div><div class="chips"><span class="chip">🔥 ${streak()} ngày liên tục</span></div></section>
      <section class="card"><p>Ngày mai mở app lúc nào cũng được, bài mới và các câu đến hạn ôn sẽ có sẵn.</p><a class="btn primary block" href="#/today">Về trang chính</a></section>`);
  }

  /* ---------- Thẻ luyện tập: Nghe → Học → Nói → Chấm ---------- */
  function renderCard(c, opts = {}) {
    const full = !opts.session || mode().learn;
    const steps = full ? [['Nghe', stepListen, bindListen], ['Học', stepLearn, bindLearn], ['Nói', stepSpeak, bindSpeak], ['Chấm', stepCheck, bindCheck]]
      : [['Nghe', stepListen, bindListen], ['Nói', stepSpeak, bindSpeak], ['Chấm', stepCheck, bindCheck]];
    const ctx = { c, opts, steps, step: opts.review ? steps.length - 2 : 0, rec: null, attempt: 0 };
    drawCard(ctx);
  }
  function drawCard(ctx) {
    const { c, opts } = ctx;
    const head = opts.session ? sesHeader() : '';
    const stepper = `<div class="stepper">${ctx.steps.map(([s], i) => `<button data-step="${i}" class="${i === ctx.step ? 'on' : i < ctx.step ? 'past' : ''}">${i + 1}. ${s}</button>`).join('')}</div>`;
    const tag = `<div class="eyebrow">Đề ${c.set} · ${PART_NAME[c.kind]}${opts.review ? ' · <b>Ôn tập</b>' : ''}</div>`;
    const body = ctx.steps[ctx.step][1](ctx);
    page(opts.session ? 'today' : 'sets', PART_NAME[c.kind], head + stepper + `<section class="card qcard">${tag}${questionHtml(c)}</section>` + body,
      { back: opts.session ? '#/today' : `#/set/${c.set}`, noNav: !!opts.session });
    $$('.stepper button').forEach(b => b.onclick = () => { stopAll(); ctx.step = +b.dataset.step; drawCard(ctx); });
    bindSay();
    const vt = $('#vitoggle'); if (vt) vt.onchange = () => { S.settings.showVi = vt.checked; save(); $$('.vi-tr').forEach(e => e.hidden = !vt.checked); };
    ctx.steps[ctx.step][2](ctx);
    if (opts.session) startSesClock();
  }
  const toNext = ctx => { stopAll(); ctx.step++; drawCard(ctx); };
  function questionHtml(c) {
    if (c.kind === 'p1') return `<div class="topic">Let’s talk about ${esc(c.topic.title.toLowerCase())}.</div><h2 class="q">${esc(c.q.q)}</h2><div class="vi">${esc(c.q.q_vi)}</div><button class="say mini" data-say="${esc(c.q.q)}">▶ Nghe câu hỏi</button>`;
    if (c.kind === 'fu') return `<div class="topic">Topic: ${esc(c.p3.topic)}</div><h2 class="q">${esc(c.f.q)}</h2><div class="vi">${esc(c.f.q_vi)}</div><button class="say mini" data-say="${esc(c.f.q)}">▶ Nghe câu hỏi</button>`;
    if (c.kind === 'p2') return `<h2 class="q small">${esc(c.p2.situation)}</h2><div class="vi">${esc(c.p2.situation_vi)}</div><button class="say mini" data-say="${esc(c.p2.situation)}">▶ Nghe đề</button>`;
    return `<h2 class="q">${esc(c.p3.topic)}</h2><div class="vi">${esc(c.p3.topic_vi)}</div>${mindHtml(c.p3.mind, false)}`;
  }
  function mindHtml(m, notes) {
    const b = m.branches;
    const node = (x, cls = '') => `<div class="mnode ${cls}"><b>${esc(x.t)}</b>${notes ? `<span>${esc(x.n)}</span>` : ''}</div>`;
    return `<div class="mind">${node(b[0])}<div class="mrow">${node(b[1])}<div class="mcenter">${esc(m.center)}</div>${notes ? node(m.own, 'own') : '<div class="mnode own"><b>[Your own idea]</b></div>'}</div>${node(b[2])}</div>`;
  }

  // Bước 1: Nghe & nói nhại
  function stepListen(ctx) {
    const paras = cardModel(ctx.c);
    const showVi = S.settings.showVi;
    return `<section class="card">
      <div class="ctrl"><button class="btn" id="playall">▶ Nghe cả bài</button>${ctx.opts.session && !mode().shadow ? '' : '<button class="btn primary" id="shadow">🗣 Nói nhại từng câu</button>'}</div>
      <div class="tiny">Tốc độ đọc</div>${speedSeg()}
      <label class="sw"><input type="checkbox" id="vitoggle" ${showVi ? 'checked' : ''}> Hiện bản dịch</label>
      <div class="model">${paras.map((p, pi) => `${p.h ? `<div class="ph">${esc(p.h)}</div>` : ''}<p>${sentences(p.t).map((s, si) => `<span class="sent" data-p="${pi}" data-s="${si}">${esc(s)}</span> `).join('')}</p><p class="vi vi-tr" ${showVi ? '' : 'hidden'}>${esc(p.t_vi)}</p>`).join('')}</div>
      <p class="muted" id="shadowhint">Nói nhại: máy đọc 1 câu, bạn nói lại ngay câu đó trong khoảng lặng.</p>
    </section><button class="btn primary block" id="nx">Tiếp: ${ctx.steps[ctx.step + 1][0] === 'Học' ? 'Học từ khóa' : 'Nói & ghi âm'}</button>`;
  }
  function bindListen(ctx) {
    const sents = $$('.sent');
    let stop = false;
    const run = async (shadow) => {
      unlockAudio(); stopSay(); stop = false;
      for (const el of sents) {
        if (stop || !document.body.contains(el)) break;
        sents.forEach(x => x.classList.remove('hl', 'you')); el.classList.add('hl'); el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const ms = await say(el.textContent);
        if (shadow && !stop) { el.classList.remove('hl'); el.classList.add('you'); await new Promise(r => setTimeout(r, Math.max(1500, ms * 1.15))); }
      }
      sents.forEach(x => x.classList.remove('hl', 'you'));
    };
    bindSpeed();
    $('#playall').onclick = () => run(false);
    if ($('#shadow')) $('#shadow').onclick = () => run(true);
    sents.forEach(el => el.onclick = () => { stop = true; unlockAudio(); sents.forEach(x => x.classList.remove('hl')); el.classList.add('hl'); say(el.textContent); });
    $('#nx').onclick = () => { stop = true; toNext(ctx); };
  }

  // Bước 2: Học từ khóa / dàn ý
  function stepLearn(ctx) {
    const c = ctx.c;
    let html = '';
    if (c.kind === 'p1' || c.kind === 'fu') {
      const kw = c.kind === 'p1' ? c.q.kw : c.f.kw;
      const kwvi = c.kind === 'p1' ? c.q.kw_vi : [];
      html = `<h3>Từ khóa</h3><ul class="kw">${kw.map((k, i) => `<li><span>${esc(k)}</span>${kwvi[i] ? `<small>${esc(kwvi[i])}</small>` : ''}</li>`).join('')}</ul>
        <h3>Khung trả lời</h3><p class="frame">Trả lời thẳng → Lý do (<i>because…</i>) → Ý thêm (<i>Sometimes… / However…</i>)</p>`;
    } else if (c.kind === 'p2') {
      const o = c.p2.outline;
      html = `<h3>Dàn ý</h3><p>Lựa chọn tốt nhất: <b>${esc(o.best)}</b></p><div class="opts">${o.opts.map(x => `<div class="opt ${x.best ? 'best' : ''}"><b>${esc(x.o)}${x.best ? ' ★' : ''}</b><div class="pro">+ ${esc(x.pro)}</div>${x.con ? `<div class="con">− ${esc(x.con)}</div>` : ''}</div>`).join('')}</div>
        <h3>Thứ tự nói</h3><ol class="steps"><li>Mở bài: nêu 3 lựa chọn + chọn 1</li><li>2 lựa chọn còn lại: ưu điểm → <i>However</i> nhược điểm</li><li>Lựa chọn tốt nhất: 2–3 lý do (<i>First… Second… In addition…</i>)</li><li>Kết luận: <i>In conclusion, although…</i></li></ol>`;
    } else {
      html = `<h3>Sơ đồ ý</h3>${mindHtml(c.p3.mind, true)}<h3>Thứ tự nói</h3><ol class="steps"><li>Mở bài: <i>Today, I would like to talk about…</i></li><li><i>First of all</i> + ý 1 + ví dụ</li><li><i>Secondly</i> + ý 2</li><li><i>Another important…</i> + ý 3</li><li><i>In addition to these ideas, I believe…</i> + ý của bạn</li><li><i>For these reasons, I strongly believe…</i></li></ol>`;
    }
    const vocab = (D.sets[c.set - 1].vocab || []);
    const rel = vocab.filter(([en]) => cardModel(c).some(p => p.t.toLowerCase().includes(en.toLowerCase())));
    if (rel.length) html += `<h3>Từ vựng</h3><div class="vocab">${rel.map(([en, vi]) => `<span class="chip" data-say="${esc(en)}">${esc(en)} · <i>${esc(vi)}</i></span>`).join('')}</div>`;
    return `<section class="card">${html}<p class="muted">Che màn hình, nhìn từ khóa và tự nói lại 1 lần trước khi ghi âm.</p></section><button class="btn primary block" id="nx">Tiếp: Nói & ghi âm</button>`;
  }
  function bindLearn(ctx) { $('#nx').onclick = () => toNext(ctx); }

  // Bước 3: Nói thật có đếm giờ + ghi âm
  function stepSpeak(ctx) {
    const c = ctx.c;
    const prep = prepTime(c), talk = speakTime(c);
    const kw = c.kind === 'p1' ? c.q.kw : c.kind === 'fu' ? c.f.kw : null;
    let cue = '';
    if (kw) cue = `<ul class="kw small">${kw.map(k => `<li>${esc(k)}</li>`).join('')}</ul>`;
    else if (c.kind === 'p2') cue = `<p class="cue">★ ${esc(c.p2.outline.best)}</p><ul class="kw small">${c.p2.outline.opts.map(x => `<li>${esc(x.o)}: + ${esc(x.pro)}${x.con ? ` / − ${esc(x.con)}` : ''}</li>`).join('')}</ul>`;
    else if (c.kind === 'p3') cue = `<ul class="kw small">${c.p3.mind.branches.concat([c.p3.mind.own]).map(x => `<li>${esc(x.t)}</li>`).join('')}</ul>`;
    return `<section class="card speak">
      <div class="timer" id="timer"><div class="tl" id="tlabel">${prep ? `Chuẩn bị ${prep / 60} phút, rồi nói ${talk / 60} phút` : `Nói khoảng ${talk} giây`}</div><div class="tv" id="tval">${mmss(prep || talk)}</div></div>
      <details class="cuebox" ${ctx.opts.review ? '' : 'open'}><summary>Gợi ý (cố gắng không nhìn)</summary>${cue || '<p class="muted">Dùng sơ đồ ý ở trên.</p>'}</details>
      ${Rec.supported() ? '' : '<p class="warn">Trình duyệt này không ghi âm được. Hãy mở bằng Safari trên iPhone (iOS 14.3 trở lên).</p>'}
      <div class="ctrl center"><button class="btn rec" id="go">${prep ? '▶ Bắt đầu chuẩn bị' : '● Ghi âm & nói'}</button></div>
      <div class="ctrl center"><button class="btn" id="stop" hidden>■ Dừng</button></div>
      <div id="playback"></div>
    </section><button class="btn block" id="nx">${ctx.rec ? 'Tiếp: Tự chấm' : 'Bỏ qua ghi âm → Tự chấm'}</button>`;
  }
  function bindSpeak(ctx) {
    const c = ctx.c;
    const prep = prepTime(c), talk = speakTime(c);
    const tval = $('#tval'), tlabel = $('#tlabel'), go = $('#go'), stopB = $('#stop'), timerEl = $('#timer');
    let phase = 'idle';
    const showPlayback = r => { $('#playback').innerHTML = audioHtml(r.blob, `Bản ghi vừa rồi (${r.dur}s)`); };
    if (ctx.rec) showPlayback(ctx.rec);
    const startTalk = async () => {
      phase = 'talk';
      try { await Rec.start(); } catch (e) { tlabel.textContent = 'Không mở được micro. Kiểm tra Cài đặt › Safari › Micro.'; }
      beep(880, 160, 2);
      go.hidden = true; stopB.hidden = false; timerEl.classList.add('live'); tlabel.textContent = '● Đang ghi âm, hãy nói';
      countdown(talk, l => { tval.textContent = mmss(l); timerEl.classList.toggle('low', l <= 10); }, () => finish(true));
    };
    const finish = async (auto) => {
      if (phase !== 'talk') return;
      phase = 'done'; clearTicker(); if (auto) beep(440, 400, 1);
      timerEl.classList.remove('live', 'low'); stopB.hidden = true; go.hidden = false; go.textContent = '↻ Nói lại';
      ctx.attempt++;
      const need = ctx.opts.session ? mode().attempts : 1;
      if (ctx.attempt < need) { go.textContent = `↻ Lần ${ctx.attempt + 1}: nói lại, che gợi ý`; const cb = $('.cuebox'); if (cb) cb.open = false; }
      tlabel.textContent = (auto ? 'Hết giờ' : 'Đã dừng') + (ctx.attempt < (ctx.opts.session ? mode().attempts : 1) ? ' · nên nói thêm 1 lần' : '');
      const r = await Rec.stop();
      if (r) { ctx.rec = r; showPlayback(r); saveRec(c.id, r, PART_NAME[c.kind]); $('#nx').textContent = 'Tiếp: Tự chấm'; $('#nx').classList.add('primary'); }
    };
    go.onclick = async () => {
      unlockAudio();
      try { if (Rec.supported()) await Rec.ensure(); } catch (e) { /* xử lý khi start */ }
      if (c.kind !== 'p3') await say(c.kind === 'p1' ? c.q.q : c.kind === 'fu' ? c.f.q : c.p2.situation);
      if (prep) {
        phase = 'prep'; go.hidden = true; stopB.hidden = false; stopB.textContent = '⏭ Nói ngay'; tlabel.textContent = 'Chuẩn bị: nghĩ ý theo dàn bài';
        countdown(prep, l => { tval.textContent = mmss(l); }, () => { stopB.textContent = '■ Dừng'; startTalk(); });
      } else startTalk();
    };
    stopB.onclick = () => { if (phase === 'prep') { clearTicker(); stopB.textContent = '■ Dừng'; startTalk(); } else finish(false); };
    $('#nx').onclick = () => { if (phase === 'talk') finish(false).then(() => toNext(ctx)); else toNext(ctx); };
  }
  function audioHtml(blob, label) {
    const url = URL.createObjectURL(blob);
    return `<div class="audio"><div class="tiny">${esc(label)}</div><audio controls playsinline preload="metadata" src="${url}"></audio></div>`;
  }

  // Bước 4: Tự chấm
  const CHECK = [
    ['Nói đủ các ý trong từ khóa / dàn ý', 'Task'],
    ['Dùng từ nối: because, however, first of all, in addition…', 'Coherence'],
    ['Không im lặng quá 3 giây, không dừng trước khi hết giờ', 'Fluency'],
    ['Câu đúng thì, có chủ ngữ + động từ', 'Grammar'],
    ['Phát âm rõ đuôi -s, -ed và trọng âm từ chính', 'Pronunciation'],
  ];
  function stepCheck(ctx) {
    return `<section class="card">
      ${ctx.rec ? audioHtml(ctx.rec.blob, 'Nghe lại bản ghi của bạn') : '<p class="muted">Chưa có bản ghi. Bạn có thể quay lại bước Nói.</p>'}
      <h3>Checklist</h3><div class="checks">${CHECK.map(([t, k], i) => `<label class="chk"><input type="checkbox" data-i="${i}"><span>${esc(t)} <small>${k}</small></span></label>`).join('')}</div>
      <details><summary>So với bài mẫu</summary><div class="model small">${cardModel(ctx.c).map(p => `${p.h ? `<div class="ph">${esc(p.h)}</div>` : ''}<p>${esc(p.t)}</p>`).join('')}</div></details>
      <h3>Bạn tự đánh giá</h3>
      <div class="rate"><button class="btn bad" data-r="0">Chưa được<small>ôn lại ngày mai</small></button><button class="btn mid" data-r="1">Tạm<small>ôn lại ngày mai</small></button><button class="btn good" data-r="2">Tốt<small>ôn sau ${GAPS[Math.min(((S.items[ctx.c.id] || {}).box ?? -1) + 1, GAPS.length - 1)]} ngày</small></button></div>
    </section>`;
  }
  function bindCheck(ctx) {
    const boxes = $$('.chk input');
    const upd = () => { const n = boxes.filter(b => b.checked).length; $$('.rate button').forEach(b => b.classList.toggle('hint', +b.dataset.r === (n >= 4 ? 2 : n >= 2 ? 1 : 0))); };
    boxes.forEach(b => b.onchange = upd); upd();
    $$('.rate button').forEach(b => b.onclick = () => {
      rate(ctx.c.id, +b.dataset.r);
      if (ctx.opts.onDone) ctx.opts.onDone();
      else go(`#/set/${ctx.c.set}`);
    });
  }

  /* ---------- Thi thử ---------- */
  const rnd = n => 1 + Math.floor(Math.random() * n);
  function resolveMock(m) {
    const sets = m.sets ? Object.assign({}, m.sets) : {};
    m.parts.forEach(p => { if (!sets[p]) sets[p] = rnd(6); });
    return { parts: m.parts, sets, hideKeywords: !!m.hideKeywords };
  }
  function viewMock() {
    const body = `<section class="card"><h3>Thi thử ngẫu nhiên</h3><p class="muted">Máy đọc câu hỏi, đếm giờ đúng như phòng thi và ghi âm từng phần. Không có gợi ý.</p>
      <a class="btn primary block" href="#/mockrun/r">Đề trộn ngẫu nhiên (khoảng 13 phút)</a>
      <div class="ctrl"><a class="btn" href="#/mockrun/r-p1">Chỉ Part 1</a><a class="btn" href="#/mockrun/r-p2">Chỉ Part 2</a><a class="btn" href="#/mockrun/r-p3">Chỉ Part 3</a></div></section>
      <section class="card"><h3>Thi nguyên đề</h3><div class="list">${D.sets.map(s => `<a class="row" href="#/mockrun/${s.id}-${s.id}-${s.id}"><span class="date">Đề ${s.id}</span><span class="ttl">${esc(s.p3.topic)}</span></a>`).join('')}</div></section>
      <section class="card"><h3>Cấu trúc bài thi nói VSTEP</h3><ul class="outline"><li><b>Part 1</b> (3′): 2 chủ đề, 3 câu mỗi chủ đề</li><li><b>Part 2</b> (4′): 1′ chuẩn bị + 3′ chọn giải pháp</li><li><b>Part 3</b> (5′): 1′ chuẩn bị + phát triển chủ đề + câu hỏi phụ</li></ul></section>`;
    page('mock', 'Thi thử', body);
  }
  function viewMockRun(arg) {
    let m;
    if (arg === 'r') m = resolveMock({ parts: ['p1', 'p2', 'p3'] });
    else if (/^r-p\d$/.test(arg)) m = resolveMock({ parts: [arg.slice(2)] });
    else { const [a, b, c] = arg.split('-').map(Number); m = { parts: ['p1', 'p2', 'p3'], sets: { p1: a, p2: b, p3: c } }; }
    keepAwake(true);
    startMock(m, { onDone: () => { keepAwake(false); go('#/mock'); } });
  }
  function mockQueue(m) {
    const q = [];
    if (m.parts.includes('p1')) {
      const s = D.sets[m.sets.p1 - 1];
      s.p1.forEach(tp => { q.push({ kind: 'intro', text: `Let’s talk about ${tp.title.toLowerCase()}.`, label: 'Part 1 · Social Interaction' }); tp.qs.slice(0, 3).forEach(x => q.push({ kind: 'p1', card: x.id, text: x.q, time: TIME.p1 })); });
    }
    if (m.parts.includes('p2')) {
      const s = D.sets[m.sets.p2 - 1];
      q.push({ kind: 'p2', card: s.p2.id, text: s.p2.situation, prep: TIME.p2prep, time: TIME.p2 });
    }
    if (m.parts.includes('p3')) {
      const s = D.sets[m.sets.p3 - 1];
      q.push({ kind: 'p3', card: s.p3.id, text: s.p3.topic, mind: s.p3.mind, prep: TIME.p3prep, time: TIME.p3 });
      s.p3.fu.forEach(f => q.push({ kind: 'fu', card: f.id, text: f.q, time: TIME.fu }));
    }
    return q;
  }
  function startMock(m, opts) {
    const q = mockQueue(m);
    const results = [];
    let i = 0, aborted = false;
    const label = m.parts.map(p => `${p.toUpperCase()} đề ${m.sets[p]}`).join(' · ');
    const intro = () => {
      page('mock', 'Thi thử', (opts.session ? sesHeader() : '') + `<section class="card"><div class="eyebrow">${esc(label)}</div><h2>Sẵn sàng?</h2>
        <p>Máy sẽ đọc câu hỏi. Bạn trả lời ngay khi nghe tiếng bíp. Mọi phần đều được ghi âm, cuối bài bạn nghe lại.</p>
        <ul class="outline">${m.parts.map(p => `<li>${PART_NAME[p]}</li>`).join('')}</ul>
        <p class="muted">Đeo tai nghe sẽ dễ nghe hơn. Để iPhone ở chế độ không làm phiền.</p>
        <button class="btn primary block" id="begin">Bắt đầu</button></section>`, { back: opts.session ? '#/today' : '#/mock', noNav: true });
      $('#begin').onclick = async () => {
        unlockAudio();
        try { if (Rec.supported()) await Rec.ensure(); } catch (e) { /* tiếp tục không ghi âm */ }
        step();
      };
    };
    const screen = (it, inner) => {
      page('mock', it.kind === 'fu' ? 'Part 3 · Follow-up' : PART_NAME[it.kind] || 'Part 1', (opts.session ? sesHeader() : '') + `<div class="mockprog">Câu ${i + 1}/${q.length}</div>${inner}<button class="btn block ghost" id="quit">Dừng thi thử</button>`, { back: null, noNav: true });
      $('#quit').onclick = () => { aborted = true; stopAll(); Rec.stop(); review(); };
    };
    const step = async () => {
      if (aborted) return;
      if (i >= q.length) return review();
      const it = q[i];
      if (it.kind === 'intro') {
        screen(it, `<section class="card exam"><div class="eyebrow">${esc(it.label)}</div><h2 class="q">${esc(it.text)}</h2></section>`);
        await say(it.text); i++; return step();
      }
      const mindBlock = it.mind ? mindHtml(it.mind, false) : '';
      screen(it, `<section class="card exam"><h2 class="q ${it.kind === 'p2' ? 'small' : ''}">${esc(it.text)}</h2>${mindBlock}
        <div class="timer" id="timer"><div class="tl" id="tlabel">Nghe câu hỏi…</div><div class="tv" id="tval">${mmss(it.prep || it.time)}</div></div>
        <div class="ctrl center"><button class="btn" id="skip">⏭ Tiếp</button></div></section>`);
      const tval = $('#tval'), tlabel = $('#tlabel'), timerEl = $('#timer');
      let phase = 'q';
      const done = async () => {
        if (phase === 'end') return; phase = 'end'; clearTicker(); beep(440, 300);
        const r = await Rec.stop();
        if (r) { results.push({ it, r }); saveRec(it.card, r, 'Thi thử · ' + (PART_NAME[it.kind] || '')); } else results.push({ it, r: null });
        i++; setTimeout(step, 500);
      };
      const talk = async () => {
        phase = 'talk';
        try { await Rec.start(); } catch (e) { /* không có micro */ }
        beep(880, 160, 2); timerEl.classList.add('live'); tlabel.textContent = '● Đang ghi âm';
        countdown(it.time, l => { tval.textContent = mmss(l); timerEl.classList.toggle('low', l <= 10); }, done);
      };
      $('#skip').onclick = () => { if (phase === 'prep') { clearTicker(); talk(); } else if (phase === 'talk') done(); };
      if (it.kind !== 'p3') await say(it.text);
      if (aborted || phase !== 'q') return;
      if (it.prep) {
        phase = 'prep'; tlabel.textContent = 'Chuẩn bị 1 phút';
        countdown(it.prep, l => { tval.textContent = mmss(l); }, () => { if (phase === 'prep') talk(); });
      } else talk();
    };
    const review = () => {
      stopAll();
      const cards = Array.from(new Set(results.map(x => x.it.card)));
      page('mock', 'Kết quả thi thử', (opts.session ? sesHeader() : '') + `<section class="card"><div class="eyebrow">${esc(label)}</div><h2>Nghe lại bài nói</h2>
        <p class="muted">Nghe từng phần, so với bài mẫu, rồi đánh dấu câu nào còn yếu để hệ thống cho ôn lại.</p></section>
        ${results.map((x, k) => `<section class="card"><div class="eyebrow">${PART_NAME[x.it.kind]}</div><div class="q small">${esc(x.it.text)}</div>
          ${x.r ? audioHtml(x.r.blob, `${x.r.dur}s`) : '<p class="muted">Không có bản ghi</p>'}
          <details><summary>Bài mẫu</summary><div class="model small">${cardModel(CARDS[x.it.card]).map(p => `<p>${esc(p.t)}</p>`).join('')}</div></details>
          <div class="rate sm" data-card="${x.it.card}"><button class="btn bad" data-r="0">Chưa được</button><button class="btn mid" data-r="1">Tạm</button><button class="btn good" data-r="2">Tốt</button></div></section>`).join('')}
        <button class="btn primary block" id="fin">${opts.session ? 'Tiếp' : 'Xong'}</button>`, { noNav: true });
      $$('.rate.sm').forEach(g => $$('button', g).forEach(b => b.onclick = () => { $$('button', g).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); g.dataset.val = b.dataset.r; }));
      $('#fin').onclick = () => {
        $$('.rate.sm').forEach(g => { if (g.dataset.val != null) rate(g.dataset.card, +g.dataset.val); });
        if (!cards.length) { /* bỏ qua */ }
        opts.onDone && opts.onDone();
      };
    };
    intro();
  }

  /* ---------- Ôn câu đến hạn (ngoài lịch) ---------- */
  function viewReview() {
    const ids = dueCards(8);
    if (!ids.length) { page('today', 'Ôn tập', '<section class="card"><p>Không có câu nào đến hạn ôn. Tuyệt!</p><a class="btn block" href="#/today">Về trang chính</a></section>'); return; }
    let k = 0;
    const next = () => { if (k >= ids.length) return go('#/today'); renderCard(CARDS[ids[k++]], { review: true, onDone: next }); };
    next();
  }

  /* ---------- Tiến độ ---------- */
  async function viewStats() {
    const ids = Object.keys(CARDS);
    const learned = ids.filter(id => S.items[id]);
    const byPart = k => { const all = ids.filter(id => CARDS[id].kind === k); return `${all.filter(id => S.items[id]).length}/${all.length}`; };
    const weak = weakCards();
    const mins = Object.values(S.done).reduce((a, b) => a + (b.mins || 0), 0);
    let body = `<section class="card grid4"><div><b>${Object.keys(S.done).length}</b><span>buổi đã học</span></div><div><b>${streak()}</b><span>ngày liên tục</span></div><div><b>${learned.length}/${ids.length}</b><span>thẻ đã luyện</span></div><div><b>${mins}</b><span>phút</span></div></section>
      <section class="card"><h3>Theo phần thi</h3><ul class="outline"><li>Part 1: ${byPart('p1')} câu</li><li>Part 2: ${byPart('p2')} tình huống</li><li>Part 3: ${byPart('p3')} chủ đề · ${byPart('fu')} câu hỏi phụ</li></ul></section>`;
    body += `<section class="card"><h3>Câu còn yếu (${weak.length})</h3>${weak.length ? `<div class="list">${weak.map(id => `<a class="row" href="#/card/${id}"><span class="date">Đề ${CARDS[id].set}</span><span class="ttl">${esc(cardTitle(CARDS[id]))}</span></a>`).join('')}</div>` : '<p class="muted">Chưa có câu nào bị đánh giá “Chưa được”.</p>'}</section>`;
    body += `<section class="card"><h3>Bản ghi âm gần đây</h3><div id="recs"><p class="muted">Đang tải…</p></div></section>`;
    const vs = voices.map(v => `<option value="${esc(v.name)}" ${v.name === S.settings.voice ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    body += `<section class="card"><h3>Cài đặt</h3>
      <a class="btn block" href="#/settings">Cỡ chữ & thời lượng học (${S.settings.minutes} phút)</a>
      ${audioCount() ? `<label class="sw"><input type="checkbox" id="eleven" ${S.settings.eleven !== false ? 'checked' : ''}> Dùng giọng ElevenLabs (${audioCount()} câu có sẵn)</label>` : '<p class="muted">Chưa có file giọng ElevenLabs, đang dùng giọng của iPhone.</p>'}
      <div class="field">Tốc độ đọc${speedSeg()}</div>
      <label class="field">Giọng iPhone (dự phòng)<select id="voice"><option value="">Tự chọn</option>${vs}</select></label>
      <button class="btn" id="test">▶ Nghe thử</button>
      <p class="muted">Muốn giọng hay hơn: Cài đặt iPhone › Trợ năng › Nội dung được đọc › Giọng nói › English, tải giọng “Enhanced”.</p></section>
      <section class="card"><h3>Sao lưu tiến độ</h3><p class="muted">Tiến độ chỉ lưu trên iPhone này. Sao lưu nếu bạn đổi máy hoặc xoá dữ liệu Safari.</p>
      <div class="ctrl"><button class="btn" id="exp">Tải file sao lưu</button><label class="btn">Khôi phục<input type="file" id="imp" accept="application/json" hidden></label></div></section>`;
    page('stats', 'Tiến độ', body);
    bindSpeed();
    $('#voice').onchange = e => { S.settings.voice = e.target.value; save(); };
    $('#test').onclick = () => { unlockAudio(); say(sentences(D.sets[0].p1[0].qs[0].a)[0]); };
    if ($('#eleven')) $('#eleven').onchange = e => { S.settings.eleven = e.target.checked; save(); };
    $('#exp').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
      a.download = `vstep-b2-tien-do-${today()}.json`; a.click();
    };
    $('#imp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { const o = JSON.parse(t); if (o && o.done && o.items) { S = Object.assign(defaults(), o); save(); viewStats(); } }).catch(() => alert('File không hợp lệ'));
    };
    const recs = (await idb.all()).sort((a, b) => b.ts - a.ts).slice(0, 20);
    const box = $('#recs'); if (!box) return;
    box.innerHTML = recs.length ? recs.map(r => `<div class="recrow"><div class="tiny">${fmtD(r.date)} · ${esc(r.label)} · ${r.dur}s</div><div class="tiny ttl">${esc(CARDS[r.card] ? cardTitle(CARDS[r.card]) : r.card)}</div><audio controls playsinline preload="none" src="${URL.createObjectURL(r.blob)}"></audio><button class="link del" data-id="${r.id}">Xoá</button></div>`).join('') : '<p class="muted">Chưa có bản ghi nào.</p>';
    $$('.del', box).forEach(b => b.onclick = async () => { await idb.del(b.dataset.id); viewStats(); });
  }

  /* ---------- Router ---------- */
  const go = h => { if (location.hash === h) route(); else location.hash = h; };
  function route() {
    let h = location.hash.replace(/^#\/?/, '') || 'today';
    if (!S.settings.setup && h === 'today') h = 'settings';
    const [name, arg] = h.split('/');
    if (name !== 'session' && SES) { /* rời buổi học nhưng giữ tiến độ */ }
    if (name !== 'session' && name !== 'mockrun') keepAwake(false);
    switch (name) {
      case 'today': return viewToday();
      case 'plan': return viewPlan();
      case 'sets': return viewSets();
      case 'set': return viewSet(+arg);
      case 'card': return CARDS[arg] ? renderCard(CARDS[arg], {}) : go('#/sets');
      case 'templates': return viewTemplates();
      case 'session': return viewSession(arg);
      case 'mock': return viewMock();
      case 'mockrun': return viewMockRun(arg);
      case 'review': return viewReview();
      case 'stats': return viewStats();
      case 'settings': return viewSettings();
      default: return viewToday();
    }
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (SES || location.hash.startsWith('#/mockrun'))) keepAwake(true); });
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
