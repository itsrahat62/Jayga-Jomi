/* ==========================================================================
   cad-design.js — বাছাই করা দাগ নিয়ে ডিজাইন পর্দা
   --------------------------------------------------------------------------
   ডিজিটাইজ করার পর হাজারখানেক দাগ থাকে, কিন্তু কাজ হয় কয়েকটা নিয়ে।
   সেগুলো বেছে এখানে আনলে —
     · কেবল ঐ দাগগুলোই বড় করে দেখা যায়
     · এক এক করে ক্লিক করে **দাগ নম্বর** বসানো যায় (Enter চাপলেই পরেরটা)
     · একসাথে ক্রমিক নম্বরও বসানো যায়
     · কাজ শেষে সংরক্ষণ, শিট ছাপা বা গুগল আর্থে পাঠানো যায়

   ★ কেন আলাদা পর্দা
     মূল ক্যানভাসে ১৩০০ দাগের ভিড়ে একটা একটা করে নম্বর বসানো কষ্টকর —
     ভুল দাগে ক্লিক পড়ে। এখানে কেবল বাছাই করা দাগই থাকে, তাই ভুল হয় না।

   ★ নথি ভাগ করে নেওয়া
     এখানে আলাদা কপি বানানো হয় না — মূল নথির ফিচারেই সরাসরি কাজ হয়।
     তাই এখানে নম্বর বসালে মূল কাজেও সাথে সাথে বসে যায়, আলাদা "মেলানো"
     লাগে না।
   ========================================================================== */

const DesignApp = {

  ids: [],           // যে দাগগুলো নিয়ে কাজ
  cur: -1,           // এখন কোনটিতে নম্বর বসছে
  view: { scale: 1, off: { x: 0, y: 0 }, drag: null },
  northPick: null,   // দিক দেখিয়ে দেওয়ার সময় প্রথম ক্লিকটি
  khZoomLevel: 1,

  /* ==================== খোলা ==================== */

  /** ডিজিটাল সার্ভে টুলের বাছাই থেকে ডিজাইন পর্দা খোলা */
  openFromSelection() {
    const s = (typeof CadView !== 'undefined') ? CadView.state : null;
    if (!s || !s.selection.length) {
      CadApp.status('আগে দাগ বাছুন — “বাছুন” টুলে ক্লিক করে বা ঘের টেনে।', true);
      return;
    }
    this.ids = s.selection.slice();
    this.cur = 0;
    AppController.openToolModal('design-plots');
  },

  init() {
    if (!this.ids.length && typeof CadView !== 'undefined' && CadView.state) {
      this.ids = CadView.state.selection.slice();
    }
    this.render();
    this.renderKhotian();
    const nEl = document.getElementById('dg-north');
    if (nEl) nEl.value = CadCore.bn(String(Math.round(this.northDeg())));
    setTimeout(() => { this.size(); this.fit(); this.draw(); }, 60);
  },

  doc() { return (typeof CadApp !== 'undefined') ? CadApp.doc : null; },

  feats() {
    const d = this.doc();
    if (!d) return [];
    return this.ids.map(id => CadCore.feature(d, id)).filter(Boolean);
  },

  status(msg, bad) {
    const el = document.getElementById('dg-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.className = 'cad-status' + (bad ? ' bad' : '');
    el.innerHTML = msg;
  },

  /* ==================== ছবি ==================== */

  size() {
    const c = document.getElementById('dg-canvas');
    if (!c || !c.parentElement) return;
    const r = c.parentElement.getBoundingClientRect();
    const w = Math.max(320, Math.round(r.width)), h = Math.max(300, Math.round(r.height));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  },

  fit() {
    const c = document.getElementById('dg-canvas');
    const f = this.feats();
    if (!c || !f.length) return;
    const bb = CadCore.bboxAll(f.map(x => x.pts));
    if (!(bb.w > 0) && !(bb.h > 0)) return;
    this.view.scale = Math.min(c.width / (bb.w || 1), c.height / (bb.h || 1)) * 0.82;
    this.view.off = {
      x: c.width / 2 - (bb.x + bb.w / 2) * this.view.scale,
      y: c.height / 2 - (bb.y + bb.h / 2) * this.view.scale
    };
  },

  toScreen(p) {
    return { x: p.x * this.view.scale + this.view.off.x,
             y: p.y * this.view.scale + this.view.off.y };
  },
  toWorld(p) {
    return { x: (p.x - this.view.off.x) / this.view.scale,
             y: (p.y - this.view.off.y) / this.view.scale };
  },

  draw() {
    const c = document.getElementById('dg-canvas');
    if (!c) return;
    const g = c.getContext('2d');
    const d = this.doc();
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);

    const f = this.feats();
    if (!f.length) {
      g.fillStyle = '#94a3b8'; g.font = '14px "Noto Sans Bengali", sans-serif';
      g.textAlign = 'center';
      g.fillText('কোনো দাগ বাছা হয়নি', c.width / 2, c.height / 2);
      return;
    }

    /* নকশার ছবি পটভূমিতে — কোন দাগ কোনটা মেলাতে সুবিধা */
    const s = CadView.state;
    if (s && s.rasters && s.rasters.length && document.getElementById('dg-bg')
        && document.getElementById('dg-bg').checked) {
      const r = s.rasters.find(x => x.visible) || s.rasters[0];
      if (r && r.img) {
        g.save();
        g.globalAlpha = 0.35;
        const o = this.toScreen({ x: 0, y: 0 });
        g.drawImage(r.img, o.x, o.y, r.img.width * this.view.scale, r.img.height * this.view.scale);
        g.restore();
      }
    }

    f.forEach((ft, i) => {
      const L = CadCore.layer(d, ft.layer) || CadCore.layerPreset(ft.layer);
      const isCur = i === this.cur;
      g.beginPath();
      ft.pts.forEach((p, j) => { const q = this.toScreen(p); j ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); });
      g.closePath();
      g.fillStyle = isCur ? 'rgba(37,99,235,0.20)'
        : (ft.dag ? 'rgba(16,185,129,0.13)' : 'rgba(148,163,184,0.13)');
      g.fill();
      g.strokeStyle = isCur ? '#2563eb' : (ft.dag ? '#10b981' : L.color);
      g.lineWidth = isCur ? 3 : 1.8;
      g.stroke();

      // দাগ নম্বর ও ক্ষেত্রফল
      const lp = this.toScreen(CadCore.labelPoint(ft.pts));
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (ft.dag) {
        g.font = '800 16px "Noto Sans Bengali", sans-serif';
        g.fillStyle = isCur ? '#1d4ed8' : '#065f46';
        g.fillText(CadCore.bn(ft.dag), lp.x, lp.y - 8);
      } else {
        g.font = '700 13px "Noto Sans Bengali", sans-serif';
        g.fillStyle = '#94a3b8';
        g.fillText('নম্বর নেই', lp.x, lp.y - 8);
      }
      if (d.ftPerPx > 0) {
        const m = CadCore.measure(d, ft);
        g.font = '600 11px "Noto Sans Bengali", sans-serif';
        g.fillStyle = '#475569';
        g.fillText(CadCore.satakText(m.sqft), lp.x, lp.y + 9);
      }
      // ক্রমিক সংখ্যা — কোনটি কত নম্বরে আছে
      g.font = '700 10px sans-serif';
      g.fillStyle = isCur ? '#2563eb' : '#cbd5e1';
      g.fillText(CadCore.bn(i + 1), lp.x, lp.y + 24);
    });

    this._drawCompass(g, c);
  },

  /* ==================== দিক (উত্তর-দক্ষিণ-পূর্ব-পশ্চিম) ==================== */

  /** doc.meta.northDeg — উত্তর কোন দিকে, পর্দার উপরের দিক থেকে ঘড়ির কাঁটার দিকে ডিগ্রিতে */
  northDeg() {
    const d = this.doc();
    const v = d && d.meta ? Number(d.meta.northDeg) : 0;
    return isFinite(v) ? ((v % 360) + 360) % 360 : 0;
  },

  setNorth(deg) {
    const d = this.doc();
    if (!d) return;
    let v = CadCore.num(deg);
    if (!isFinite(v)) v = 0;
    v = ((v % 360) + 360) % 360;
    d.meta.northDeg = v;
    const el = document.getElementById('dg-north');
    if (el) el.value = CadCore.bn(String(Math.round(v)));
    this.northPick = null;
    this.draw();
    this.status('উত্তর ' + CadCore.bn(String(Math.round(v))) + '° এ বসানো হয়েছে — '
      + 'ছবিতে ও শিটে এই দিকই দেখাবে।');
  },

  /** ছবিতে দুটি ক্লিক — প্রথমটি দক্ষিণ প্রান্ত, দ্বিতীয়টি উত্তর প্রান্ত */
  pickNorth() {
    this.northPick = { first: null };
    this.status('নকশার উপর <b>দক্ষিণ</b> দিকের একটি বিন্দুতে ক্লিক করুন, '
      + 'তারপর ঐ রেখার <b>উত্তর</b> প্রান্তে। (নকশায় উত্তর তীর থাকলে তার গোড়া ও মাথা)');
  },

  _drawCompass(g, c) {
    const chk = document.getElementById('dg-dir');
    if (chk && !chk.checked) return;
    const deg = this.northDeg();
    const rad = deg * Math.PI / 180;
    const cx = c.width - 62, cy = 62, R = 34;

    g.save();
    g.translate(cx, cy);
    g.beginPath(); g.arc(0, 0, R + 10, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.88)'; g.fill();
    g.strokeStyle = '#cbd5e1'; g.lineWidth = 1; g.stroke();

    g.rotate(rad);                                  // উত্তর দিকটিকে ঘুরিয়ে বসাই
    // উত্তরমুখী তীর
    g.beginPath();
    g.moveTo(0, -R); g.lineTo(7, 6); g.lineTo(0, 1); g.lineTo(-7, 6);
    g.closePath();
    g.fillStyle = '#dc2626'; g.fill();
    g.beginPath();
    g.moveTo(0, R); g.lineTo(5, -4); g.lineTo(0, 0); g.lineTo(-5, -4);
    g.closePath();
    g.fillStyle = '#475569'; g.fill();

    g.font = '800 12px "Noto Sans Bengali", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const put = (t, dx, dy, col) => {
      g.save(); g.translate(dx, dy); g.rotate(-rad);   // লেখা সোজা থাকুক
      g.fillStyle = col; g.fillText(t, 0, 0); g.restore();
    };
    put('উ', 0, -R - 1, '#dc2626');
    put('দ', 0, R + 1, '#475569');
    put('পূ', R + 1, 0, '#475569');
    put('প', -R - 1, 0, '#475569');
    g.restore();

    // দিক ঠিক করার সময় সাহায্যের রেখা
    if (this.northPick && this.northPick.first) {
      const a = this.toScreen(this.northPick.first);
      g.save();
      g.fillStyle = '#f59e0b';
      g.beginPath(); g.arc(a.x, a.y, 5, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  },

  /* ==================== ইন্টারঅ্যাকশন ==================== */

  onClick(ev) {
    const c = document.getElementById('dg-canvas');
    if (!c) return;
    const r = c.getBoundingClientRect();
    const p = this.toWorld({ x: (ev.clientX - r.left) * (c.width / r.width),
                             y: (ev.clientY - r.top) * (c.height / r.height) });

    /* দিক দেখিয়ে দেওয়ার অবস্থায় থাকলে ক্লিক দুটি ঐ কাজেই যাবে */
    if (this.northPick) {
      if (!this.northPick.first) {
        this.northPick.first = p;
        this.draw();
        this.status('এখন ঐ রেখার <b>উত্তর</b> প্রান্তে ক্লিক করুন।');
        return;
      }
      const a = this.northPick.first;
      const dx = p.x - a.x, dy = p.y - a.y;
      if (Math.hypot(dx, dy) < 1e-6) { this.status('দুটি বিন্দু আলাদা হতে হবে।', true); return; }
      // পর্দায় y নিচমুখী — উপরের দিক = −y। উত্তর দিকের কোণ ঘড়ির কাঁটার দিকে।
      const deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      this.setNorth(deg);
      return;
    }

    const f = this.feats();
    let hit = -1, best = Infinity;
    f.forEach((ft, i) => {
      if (CadCore.pointInPolygon(p, ft.pts)) {
        const a = CadCore.area(ft.pts);
        if (a < best) { best = a; hit = i; }
      }
    });
    if (hit >= 0) { this.cur = hit; this.render(); this.draw(); this.focusInput(); }
  },

  wheel(ev) {
    ev.preventDefault();
    const c = document.getElementById('dg-canvas');
    const r = c.getBoundingClientRect();
    const anchor = { x: (ev.clientX - r.left) * (c.width / r.width),
                     y: (ev.clientY - r.top) * (c.height / r.height) };
    const before = this.toWorld(anchor);
    this.view.scale = Math.max(0.02, Math.min(60, this.view.scale * (ev.deltaY < 0 ? 1.18 : 1/1.18)));
    const after = this.toScreen(before);
    this.view.off.x += anchor.x - after.x;
    this.view.off.y += anchor.y - after.y;
    this.draw();
  },

  focusInput() {
    const el = document.getElementById('dg-num-' + this.cur);
    if (el) { el.focus(); el.select(); }
  },

  /** নম্বর বসানো — Enter চাপলে পরেরটায় চলে যায় */
  setDag(i, val, next) {
    const f = this.feats()[i];
    if (!f) return;
    f.dag = String(val || '').trim();
    f._lp = null;
    if (typeof CadView !== 'undefined') CadView.draw();
    if (typeof CadApp !== 'undefined') { CadApp.renderFeatures(); CadApp.renderStats(); }
    if (next) {
      this.cur = Math.min(this.feats().length - 1, i + 1);
      this.render(); this.draw();
      setTimeout(() => this.focusInput(), 10);
    } else {
      this.render(); this.draw();
    }
  },

  pick(i) { this.cur = i; this.render(); this.draw(); this.focusInput(); },

  /** ক্রমিক নম্বর — শুরুর নম্বর থেকে এক এক করে */
  autoNumber() {
    const startEl = document.getElementById('dg-start');
    const stepEl = document.getElementById('dg-step');
    const onlyEmpty = document.getElementById('dg-only-empty');
    const start = CadCore.num(startEl ? startEl.value : '');
    const step = CadCore.num(stepEl ? stepEl.value : '') || 1;
    if (!isFinite(start)) { this.status('শুরুর নম্বর লিখুন।', true); return; }

    const f = this.feats();
    const skip = onlyEmpty && onlyEmpty.checked;
    let n = start, done = 0;
    for (const ft of f) {
      if (skip && ft.dag) continue;
      ft.dag = CadCore.bn(String(Math.round(n)));
      ft._lp = null;
      n += step; done++;
    }
    if (typeof CadView !== 'undefined') CadView.draw();
    if (typeof CadApp !== 'undefined') { CadApp.renderFeatures(); CadApp.renderStats(); }
    this.render(); this.draw();
    this.status(CadCore.bn(done) + 'টি দাগে ক্রমিক নম্বর বসানো হয়েছে ('
      + CadCore.bn(start) + ' থেকে শুরু, ধাপ ' + CadCore.bn(step) + ')। '
      + 'পছন্দ না হলে হাতে বদলে নিন।');
  },

  clearAll() {
    const f = this.feats();
    if (!f.length) return;
    if (!confirm('বাছাই করা ' + f.length + 'টি দাগের নম্বর মুছে ফেলবেন?')) return;
    f.forEach(ft => { ft.dag = ''; ft._lp = null; });
    if (typeof CadView !== 'undefined') CadView.draw();
    this.render(); this.draw();
    this.status('সব নম্বর মুছে ফেলা হয়েছে।');
  },

  /* ==================== তালিকা ==================== */

  render() {
    const box = document.getElementById('dg-list');
    if (!box) return;
    const d = this.doc();
    const f = this.feats();
    if (!f.length) {
      box.innerHTML = '<div class="cad-empty-mini">কোনো দাগ বাছা হয়নি। '
        + 'ডিজিটাল সার্ভে টুলে দাগ বেছে “ডিজাইনে খুলুন” চাপুন।</div>';
      return;
    }
    box.innerHTML = f.map((ft, i) => {
      const m = d.ftPerPx > 0 ? CadCore.measure(d, ft) : null;
      return `<div class="dg-row${i === this.cur ? ' cur' : ''}" onclick="DesignApp.pick(${i})">
        <span class="dg-n">${CadCore.bn(i + 1)}</span>
        <input id="dg-num-${i}" class="dg-num" placeholder="দাগ নং"
               value="${(ft.dag || '').replace(/"/g, '&quot;')}"
               onclick="event.stopPropagation()"
               onchange="DesignApp.setDag(${i}, this.value, false)"
               onkeydown="if(event.key==='Enter'){event.preventDefault();DesignApp.setDag(${i}, this.value, true);}">
        <span class="dg-area">${m ? CadCore.satakText(m.sqft) : CadCore.bn(ft.pts.length) + ' কোণা'}</span>
        <button type="button" class="dg-div" title="এই দাগটি ভাগ করুন"
                onclick="event.stopPropagation();DesignApp.divide(${i})"><i class="bi bi-pie-chart"></i></button>
      </div>`;
    }).join('');

    const head = document.getElementById('dg-head');
    if (head) {
      const withNo = f.filter(x => x.dag).length;
      const total = d.ftPerPx > 0
        ? f.reduce((s, x) => s + CadCore.measure(d, x).sqft, 0) : 0;
      head.innerHTML = `<b>${CadCore.bn(f.length)}</b>টি দাগ · নম্বর বসেছে
        <b>${CadCore.bn(withNo)}</b>টিতে`
        + (total ? ` · মোট <b>${CadCore.satakText(total)}</b>` : '');
    }
  },

  /* ==================== খতিয়ান / পর্চা ==================== */

  /**
   * খতিয়ানের ছবি বা PDF — পাশে খুলে রেখে দেখতে দেখতে দাগ নম্বর বসানোর জন্য।
   * ছবিটি ~১.৬ MP এ ছোট করে রাখা হয় — নইলে প্রকল্পের ফাইল অকারণে ভারী হয়,
   * অথচ খতিয়ানের লেখা পড়ার জন্য এতটুকুই যথেষ্ট।
   */
  async loadKhotian(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    input.value = '';
    const d = this.doc();
    if (!d) return;
    this.status('খতিয়ান পড়া হচ্ছে…');
    try {
      // PDF ও ছবি — দুটোই এক পথে, নকশা নেওয়ার মতোই
      const bytes = new Uint8Array(await f.arrayBuffer());
      const r = await KmzSource.toImage(bytes, f.type, {});
      const src = r.canvas || r.img;
      const canvas = document.createElement('canvas');
      canvas.width = src.width || src.naturalWidth;
      canvas.height = src.height || src.naturalHeight;
      canvas.getContext('2d').drawImage(src, 0, 0);

      const k = Math.min(1, Math.sqrt(1.6e6 / (canvas.width * canvas.height)));
      let out = canvas;
      if (k < 1) {
        out = document.createElement('canvas');
        out.width = Math.round(canvas.width * k);
        out.height = Math.round(canvas.height * k);
        const g = out.getContext('2d');
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(canvas, 0, 0, out.width, out.height);
      }
      d.khotian = { name: f.name, data: out.toDataURL('image/jpeg', 0.82) };
      this.renderKhotian();
      this.toggleKhotian(true);
      this.status('খতিয়ান যোগ হয়েছে — পাশে দেখতে দেখতে দাগ নম্বর বসান। '
        + '“কাজটি সংরক্ষণ করুন” চাপলে এটিও ফাইলের সাথে থাকবে।');
    } catch (e) {
      this.status('খতিয়ান নেওয়া গেল না: ' + e.message, true);
    }
  },

  renderKhotian() {
    const d = this.doc();
    const kh = d && d.khotian;
    const info = document.getElementById('dg-kh-info');
    const btn = document.getElementById('dg-kh-btn');
    const img = document.getElementById('dg-kh-img');
    const nm = document.getElementById('dg-kh-name');
    if (btn) btn.style.display = kh ? '' : 'none';
    if (info) {
      info.innerHTML = kh
        ? `<div class="dg-kh-chip"><i class="bi bi-file-earmark-text"></i>
             <span>${(kh.name || 'খতিয়ান').replace(/</g, '&lt;')}</span>
             <button type="button" class="cad-dag-x" title="বাদ দিন"
                     onclick="DesignApp.removeKhotian()">×</button></div>`
        : '';
    }
    if (img && kh) img.src = kh.data;
    if (nm && kh) nm.textContent = kh.name || 'খতিয়ান';
  },

  removeKhotian() {
    const d = this.doc();
    if (!d) return;
    d.khotian = null;
    this.toggleKhotian(false);
    this.renderKhotian();
    this.status('খতিয়ানটি বাদ দেওয়া হয়েছে।');
  },

  toggleKhotian(force) {
    const pane = document.getElementById('dg-kh-pane');
    const d = this.doc();
    if (!pane) return;
    if (!d || !d.khotian) { pane.style.display = 'none'; return; }
    const show = (force === undefined) ? pane.style.display === 'none' : !!force;
    pane.style.display = show ? '' : 'none';
    if (show) this.khFit();
    // পাত খুললে/বন্ধ হলে ক্যানভাসের প্রস্থ বদলায় — তাই আবার ফিট করি,
    // নইলে দাগগুলো পাতের নিচে চলে যেত
    setTimeout(() => { this.size(); this.fit(); this.draw(); }, 40);
  },

  khZoom(k) {
    const img = document.getElementById('dg-kh-img');
    if (!img) return;
    this.khZoomLevel = Math.max(0.2, Math.min(8, this.khZoomLevel * k));
    img.style.width = (this.khZoomLevel * 100) + '%';
    img.style.maxWidth = 'none';
  },

  khFit() {
    const img = document.getElementById('dg-kh-img');
    if (!img) return;
    this.khZoomLevel = 1;
    img.style.width = '100%';
    img.style.maxWidth = '100%';
  },

  /* ==================== ভাগ-বণ্টনে পাঠানো ==================== */

  /** এখন যে দাগটি সক্রিয়, সেটি নিয়ে ভাগ-বণ্টন টুলে যাওয়া */
  divideCurrent() { this.divide(this.cur); },

  divide(i) {
    const d = this.doc();
    const f = this.feats()[i];
    if (!f) { this.status('আগে তালিকা থেকে একটি দাগ বাছুন।', true); return; }
    if (!(d.ftPerPx > 0)) {
      this.status('স্কেল বসানো নেই — ভাগ করলে ক্ষেত্রফল বেরোবে না। '
        + 'আগে ডিজিটাল সার্ভেতে স্কেল বসিয়ে নিন।', true);
      return;
    }
    if (typeof DivideApp === 'undefined') return;
    AppController.openToolModal('land-divider');
    setTimeout(() => {
      DivideApp.setSource('cad');
      DivideApp.takeFromCad(f.id);
      DivideApp.status((f.dag ? 'দাগ ' + CadCore.bn(f.dag) : 'বাছাই করা দাগ')
        + ' ডিজাইন পর্দা থেকে এসেছে — <b>' + CadCore.satakText(CadCore.measure(d, f).sqft)
        + '</b>। এখন কে কত পাবে সেটি দিন।');
    }, 120);
  },

  /* ==================== সংরক্ষণ ও রপ্তানি ==================== */

  save() {
    if (typeof CadApp === 'undefined') return;
    CadApp.saveProject();
  },

  /**
   * কেবল এই দাগগুলো রেখে বাকি লুকিয়ে শিট/রপ্তানি
   * @param {'sheet'|'penta'|'kmz'} what
   *   sheet — ডিমার্কেশন শিট (বাহুর মাপ ও ক্ষেত্রফলসহ)
   *   penta — পেন্টাগ্রাফ (দুই জরিপের নকশা মিলিয়ে, CS↔BS টেবিলসহ)
   *   kmz   — গুগল আর্থ
   */
  isolateAndGo(what) {
    const d = this.doc();
    if (!d || !this.ids.length) { this.status('আগে দাগ বাছুন।', true); return; }

    /* পেন্টাগ্রাফে অন্তত দুটি জরিপের দাগ লাগে — নইলে মেলানোর কিছু নেই।
       আগেই বলে দিই, শিট ছাপার পর খালি টেবিল দেখে বিভ্রান্ত হওয়ার চেয়ে ভালো। */
    if (what === 'penta') {
      const layers = new Set(d.features.filter(f => !f.hidden).map(f => f.layer));
      const surveys = ['cs', 'sa', 'rs', 'bs'].filter(x => layers.has(x));
      if (surveys.length < 2) {
        this.status('পেন্টাগ্রাফ করতে <b>দুই জরিপের</b> নকশা লাগে — এখন আছে কেবল '
          + CadCore.bn(surveys.length) + 'টি। ডিজিটাল সার্ভেতে ফিরে উপরের '
          + '<b>“২য় নকশা”</b> বোতামে অন্য জরিপের নকশা যোগ করুন (যেমন সি.এস), '
          + 'তারপর আবার এখানে আসুন।', true);
        return;
      }
    }

    const keep = new Set(this.ids);
    for (const f of d.features) f.hidden = !keep.has(f.id);
    if (typeof CadView !== 'undefined') { CadView.state.selection = this.ids.slice(); CadView.draw(); }

    if (what === 'sheet' || what === 'penta') {
      d.meta.sheetType = (what === 'penta') ? 'pentagraph' : 'demarcation';
      AppController.openToolModal('survey-cad');
      setTimeout(() => {
        CadApp.renderMeta();                       // শিটের ধরন ঘরটিও মিলিয়ে দিই
        CadApp.setTab('export'); CadApp.renderExport();
        CadApp.status('কেবল বাছাই করা ' + CadCore.bn(this.ids.length)
          + 'টি দাগ দেখানো হচ্ছে · শিটের ধরন <b>'
          + (what === 'penta' ? 'পেন্টাগ্রাফ' : 'ডিমার্কেশন') + '</b> বসানো হয়েছে — '
          + 'এখন “A4 শিট” চাপুন। সব ফেরাতে “দাগ” ট্যাবে “সব দেখান”।');
      }, 90);
    } else if (what === 'kmz') {
      AppController.openToolModal('survey-cad');
      setTimeout(() => { CadApp.setTab('export'); CadApp.renderExport();
        CadApp.status('কেবল বাছাই করা দাগ দেখানো হচ্ছে — KMZ/KML নামান।'); }, 90);
    }
  },

  exportPng() {
    const c = document.getElementById('dg-canvas');
    if (!c) return;
    const out = document.createElement('canvas');
    out.width = c.width; out.height = c.height;
    const g = out.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(c, 0, 0);
    out.toBlob(b => {
      CadGeo.download(b, 'বাছাই-করা-দাগ.png', 'image/png');
      this.status('ছবি নামানো হয়েছে।');
    });
  },

  back() { AppController.openToolModal('survey-cad'); }
};

/* ==================== সংযোগ ==================== */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof AppController === 'undefined') return;
  const orig = AppController.openToolModal.bind(AppController);
  AppController.openToolModal = function (toolId) {
    orig(toolId);
    if (toolId === 'design-plots') {
      const t = document.getElementById('modal-title-text');
      const i = document.getElementById('modal-title-icon');
      if (t) t.innerText = 'বাছাই করা দাগ — ডিজাইন ও নম্বর';
      if (i) i.className = 'bi bi-bounding-box-circles text-primary';
      setTimeout(() => DesignApp.init(), 60);
    }
  };
  let rz = null;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const v = document.getElementById('view-design-plots');
      if (v && v.style.display !== 'none') { DesignApp.size(); DesignApp.draw(); }
    }, 180);
  });
});

if (typeof module !== 'undefined' && module.exports) module.exports = DesignApp;
