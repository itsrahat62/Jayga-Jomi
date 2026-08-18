/* ==========================================================================
   land-extra-ui.js — বাকি চারটি টুলের পর্দা
     ১. ConvertApp — Map Converter + Cleaner (PDF/ছবি → পরিষ্কার ছবি)
     ২. AreaApp    — ক্ষেত্রফল ও অজানা বাহু
     ৩. JointApp   — ম্যাপ জয়েন্ট (সিট জোড়া)
     ৪. SketchApp  — হাত নকশা → ডিজিটাল রিপোর্ট
   গণিত AreaSolver / MapJoint এ; এখানে কেবল সংযোগ।
   ========================================================================== */

/* ==========================================================================
   ১. Map Converter + Cleaner
   মৌজা নকশার PDF ভারী ও হলদে — ছাপার আগে পরিষ্কার ছবি দরকার হয়।
   ========================================================================== */

const ConvertApp = {
  src: null,           // { canvas, name, width, height }
  out: null,           // পরিষ্কার করা ক্যানভাস
  color: '#111827',
  transparent: false,

  init() {
    this.render();
    this.status(null);
  },

  status(msg, bad) {
    const el = document.getElementById('cv-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.className = 'cad-status' + (bad ? ' bad' : '');
    el.innerHTML = msg;
  },

  prog(p, m) {
    const box = document.getElementById('cv-prog');
    const fill = document.getElementById('cv-prog-fill');
    const txt = document.getElementById('cv-prog-txt');
    if (!box) return;
    if (p == null) { box.style.display = 'none'; return; }
    box.style.display = '';
    if (fill) fill.style.width = Math.max(0, Math.min(100, p)) + '%';
    if (txt) txt.textContent = m || '';
  },

  pick() {
    const i = document.getElementById('cv-file');
    if (i) { i.value = ''; i.click(); }
  },

  load(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onerror = () => this.status('ফাইলটি পড়া গেল না।', true);
    rd.onload = async () => {
      this.prog(5, 'ফাইল পড়া হচ্ছে…');
      try {
        const bytes = new Uint8Array(rd.result);
        const r = await KmzSource.toImage(bytes, f.type, {
          onStage: (p, m) => this.prog(p, m), needBytes: false
        });
        this.prog(null);
        this.src = {
          canvas: r.canvas || r.img,
          name: f.name, width: r.width, height: r.height
        };
        this.out = null;
        this.render();
        this.status('নকশা এসেছে — <b>' + CadCore.bn(r.width) + '×' + CadCore.bn(r.height)
          + '</b> পিক্সেল (' + CadCore.bn((r.width * r.height / 1e6).toFixed(1)) + ' মেগাপিক্সেল)। '
          + 'এবার পরিষ্কার করুন বা সরাসরি নামান।');
      } catch (e) {
        this.prog(null);
        this.status(e.message, true);
      }
    };
    rd.readAsArrayBuffer(f);
  },

  async clean() {
    if (!this.src) { this.status('আগে নকশা দিন।', true); return; }
    this.prog(10, 'পরিষ্কার করা হচ্ছে…');
    try {
      const c = document.createElement('canvas');
      c.width = this.src.width; c.height = this.src.height;
      c.getContext('2d').drawImage(this.src.canvas, 0, 0);
      this.out = await KmzCC.process(c, {
        color: this.color,
        onProgress: (p, m) => this.prog(p, m)
      });
      this.prog(null);
      this.render();
      this.status('পরিষ্কার হয়েছে — কাগজের হলদে ভাব ও দাগছোপ বাদ, রেখা ও দাগ নম্বর স্পষ্ট। '
        + (this.transparent ? 'ব্যাকগ্রাউন্ড স্বচ্ছ (PNG নামান)।' : 'সাদা ব্যাকগ্রাউন্ডে।'));
    } catch (e) {
      this.prog(null);
      this.status('পরিষ্কার করা গেল না: ' + e.message, true);
    }
  },

  setColor(hex) { this.color = hex; if (this.out) this.clean(); },
  setTransparent(on) { this.transparent = !!on; this.render(); },

  render() {
    const box = document.getElementById('cv-preview');
    if (!box) return;
    if (!this.src) {
      box.innerHTML = '<div class="cad-empty-mini">নকশা দিলে এখানে দেখাবে</div>';
      return;
    }
    const show = this.out || this.src.canvas;
    const W = 640;
    const k = Math.min(1, W / show.width);
    const c = document.createElement('canvas');
    c.width = Math.round(show.width * k);
    c.height = Math.round(show.height * k);
    const g = c.getContext('2d');
    if (!this.transparent || !this.out) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
    g.imageSmoothingQuality = 'high';
    g.drawImage(show, 0, 0, c.width, c.height);
    c.className = 'cv-img' + (this.transparent && this.out ? ' checker' : '');
    box.innerHTML = '';
    box.appendChild(c);
  },

  download(fmt) {
    const src = this.out || (this.src && this.src.canvas);
    if (!src) { this.status('আগে নকশা দিন।', true); return; }
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    // JPG স্বচ্ছতা বোঝে না — সাদা ঢেলে দিই, নইলে কালো হয়ে যাবে
    if (fmt === 'jpg' || !this.transparent) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(src, 0, 0);
    const base = (this.src.name || 'map').replace(/\.[^.]+$/, '');
    const mime = fmt === 'jpg' ? 'image/jpeg' : 'image/png';
    c.toBlob(b => {
      CadGeo.download(b, base + (this.out ? '-পরিষ্কার' : '') + '.' + fmt, mime);
      this.status(fmt.toUpperCase() + ' নামানো হয়েছে।');
    }, mime, fmt === 'jpg' ? 0.92 : undefined);
  },

  toCad() {
    if (!this.src) { this.status('আগে নকশা দিন।', true); return; }
    const img = this.out || this.src.canvas;
    AppController.openToolModal('survey-cad');
    setTimeout(() => {
      CadApp.useImage({ canvas: img, img, width: img.width, height: img.height },
                      this.src.name || 'পরিষ্কার নকশা');
    }, 80);
  }
};

/* ==========================================================================
   ২. ক্ষেত্রফল ও অজানা বাহু
   ========================================================================== */

const AreaApp = {
  shape: 'tri',

  init() { this.setShape(this.shape); },

  setShape(s) {
    this.shape = s;
    ['tri', 'quad', 'rect'].forEach(k => {
      const p = document.getElementById('ar-p-' + k);
      if (p) p.style.display = k === s ? '' : 'none';
      const b = document.getElementById('ar-t-' + k);
      if (b) b.classList.toggle('active', k === s);
    });
    this.calc();
  },

  _v(id) { return CadCore.num((document.getElementById(id) || {}).value); },

  calc() {
    const out = document.getElementById('ar-out');
    if (!out) return;
    let html = '';

    if (this.shape === 'tri') {
      const a = this._v('ar-tri-a'), b = this._v('ar-tri-b'), c = this._v('ar-tri-c');
      const ar = this._v('ar-tri-area');
      if (a > 0 && b > 0 && c > 0) {
        const A = AreaSolver.triangle(a, b, c);
        html = A == null
          ? this._err('এই তিন বাহুতে ত্রিভুজ হয় না — যেকোনো দুই বাহুর যোগফল তৃতীয়টির চেয়ে বড় হতে হবে।')
          : this._area(A, 'তিন বাহু থেকে ক্ষেত্রফল (হেরনের সূত্র)');
      } else if (a > 0 && b > 0 && ar > 0) {
        const r = AreaSolver.triangleUnknownSide(a, b, ar);
        if (!r) {
          html = this._err('এই দুই বাহুতে সর্বোচ্চ ক্ষেত্রফল '
            + this._satak(a * b / 2) + ' — তার বেশি সম্ভব নয়।');
        } else {
          html = '<div class="ar-res"><b>অজানা বাহু</b>'
            + r.sides.map((s, i) => `<div class="ar-big">${CadCore.bn(CadCore.ftIn(s))}
                 <span>(${CadCore.bn(s.toFixed(2))} ফুট · কোণ ${CadCore.bn(r.angles[i].toFixed(1))}°)</span></div>`).join('')
            + (r.sides.length > 1
              ? '<p class="ar-note">দুটি উত্তরই গণিতে ঠিক — জমির আকৃতি চেপা না ছড়ানো, তা দেখে বেছে নিন।</p>'
              : '<p class="ar-note">সমকোণ — এটাই সর্বোচ্চ ক্ষেত্রফলের অবস্থা।</p>')
            + '</div>';
        }
      } else {
        html = this._hint('তিন বাহু দিন → ক্ষেত্রফল পাবেন। অথবা দুই বাহু ও ক্ষেত্রফল দিন → তৃতীয় বাহু।');
      }

    } else if (this.shape === 'quad') {
      const a = this._v('ar-q-a'), b = this._v('ar-q-b'), c = this._v('ar-q-c'),
            d = this._v('ar-q-d'), dg = this._v('ar-q-diag'), ar = this._v('ar-q-area');
      if (a > 0 && b > 0 && c > 0 && d > 0 && dg > 0) {
        const A = AreaSolver.quadWithDiagonal(a, b, c, d, dg);
        html = A == null
          ? this._err('এই মাপে চতুর্ভুজ হয় না — কর্ণটি দেখে নিন।')
          : this._area(A, 'চার বাহু ও কর্ণ থেকে ক্ষেত্রফল');
      } else if (a > 0 && b > 0 && c > 0 && d > 0) {
        const A = AreaSolver.quadMax(a, b, c, d);
        html = A == null
          ? this._err('এই চার বাহুতে চতুর্ভুজ হয় না।')
          : this._area(A, 'সর্বোচ্চ সম্ভাব্য ক্ষেত্রফল')
            + this._warn('কর্ণ ছাড়া চতুর্ভুজ নির্দিষ্ট নয় — একই চার বাহুতে জমি চেপে গেলে ক্ষেত্রফল '
              + 'কমে যায়। এটি <b>ঊর্ধ্বসীমা</b>; নিখুঁত মান পেতে কর্ণ মেপে দিন।');
      } else if (a > 0 && b > 0 && dg > 0 && c > 0 && ar > 0) {
        const r = AreaSolver.quadUnknownSide(a, b, dg, c, ar);
        html = !r
          ? this._err('এই মাপে চতুর্ভুজ হয় না — ক্ষেত্রফল বা কর্ণ দেখে নিন।')
          : '<div class="ar-res"><b>চতুর্থ বাহু</b>'
            + r.sides.map(s => `<div class="ar-big">${CadCore.bn(CadCore.ftIn(s))}
                 <span>(${CadCore.bn(s.toFixed(2))} ফুট)</span></div>`).join('')
            + '</div>';
      } else {
        html = this._hint('চার বাহু ও কর্ণ দিন → ক্ষেত্রফল। অথবা তিন বাহু, কর্ণ ও ক্ষেত্রফল দিন → চতুর্থ বাহু।');
      }

    } else {
      const L = this._v('ar-r-len'), W = this._v('ar-r-wid'), A = this._v('ar-r-area');
      const r = AreaSolver.rect(L, W, A);
      html = !r
        ? this._hint('দৈর্ঘ্য · প্রস্থ · ক্ষেত্রফল — যেকোনো দুটি দিন, তৃতীয়টি বেরিয়ে আসবে।')
        : (r.solved === 'area'
            ? this._area(r.area, 'দৈর্ঘ্য × প্রস্থ')
            : '<div class="ar-res"><b>' + (r.solved === 'len' ? 'দৈর্ঘ্য' : 'প্রস্থ') + '</b>'
              + `<div class="ar-big">${CadCore.bn(CadCore.ftIn(r.solved === 'len' ? r.len : r.wid))}
                   <span>(${CadCore.bn((r.solved === 'len' ? r.len : r.wid).toFixed(2))} ফুট)</span></div></div>`
              + this._area(r.area, 'ক্ষেত্রফল', true));
    }
    out.innerHTML = html;
  },

  _satak(sqft) { return CadCore.bn((sqft / 435.6).toFixed(3)) + ' শতাংশ'; },

  _area(sqft, label, small) {
    const u = AreaSolver.units(sqft);
    return `<div class="ar-res${small ? ' sm' : ''}"><b>${label}</b>
      <div class="ar-big">${CadCore.bn(u.satak.toFixed(3))} <span>শতাংশ</span></div>
      <div class="ar-units">
        <div><b>${CadCore.bn(u.katha.toFixed(3))}</b><span>কাঠা</span></div>
        <div><b>${CadCore.bn(u.bigha.toFixed(4))}</b><span>বিঘা</span></div>
        <div><b>${CadCore.bn(u.acre.toFixed(4))}</b><span>একর</span></div>
        <div><b>${CadCore.bn(u.sqft.toFixed(1))}</b><span>বর্গফুট</span></div>
        <div><b>${CadCore.bn(u.sqm.toFixed(2))}</b><span>বর্গমিটার</span></div>
      </div></div>`;
  },

  _hint(t) { return '<div class="cad-empty-mini">' + t + '</div>'; },
  _err(t) { return '<div class="ar-msg bad">' + t + '</div>'; },
  _warn(t) { return '<div class="ar-msg warn">' + t + '</div>'; }
};

/* ==========================================================================
   ৩. ম্যাপ জয়েন্ট — সিট জোড়া
   ========================================================================== */

const JointApp = {
  sheets: [],          // { canvas, name, t }  t = রূপান্তর (প্রথমটির জন্য null)
  picking: null,       // { sheet: 0|1 }
  pairs: [],           // [{ a:{x,y}, b:{x,y} }]  a = ১ম সিটে, b = ২য় সিটে
  view: { scale: 1, off: { x: 0, y: 0 }, drag: null },

  init() {
    this.render();
    setTimeout(() => { this.size(); this.draw(); }, 60);
  },

  status(msg, bad) {
    const el = document.getElementById('jt-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.className = 'cad-status' + (bad ? ' bad' : '');
    el.innerHTML = msg;
  },

  pick(i) {
    this._slot = i;
    const inp = document.getElementById('jt-file');
    if (inp) { inp.value = ''; inp.click(); }
  },

  load(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const r = await KmzSource.toImage(new Uint8Array(rd.result), f.type, { needBytes: false });
        const c = r.canvas || r.img;
        this.sheets.push({ canvas: c, name: f.name, t: null });
        if (this.sheets.length === 1) this.fit();
        this.render(); this.draw();
        this.status(CadCore.bn(this.sheets.length) + 'টি সিট এসেছে। '
          + (this.sheets.length < 2
            ? 'আরেকটি সিট যোগ করুন।'
            : 'এবার <b>দুই সিটে একই জায়গার</b> বিন্দু জোড়ায় জোড়ায় দেখান — অন্তত ২ জোড়া।'));
      } catch (e) { this.status(e.message, true); }
    };
    rd.readAsArrayBuffer(f);
  },

  removeSheet(i) {
    this.sheets.splice(i, 1);
    this.pairs = [];
    this.render(); this.draw();
  },

  /** বিন্দু বসানোর অবস্থা চালু */
  startPair() {
    if (this.sheets.length < 2) { this.status('আগে দুটি সিট দিন।', true); return; }
    this.picking = { step: 0, tmp: null };
    this.status('প্রথম সিটে চেনা জায়গায় ক্লিক করুন (যেমন সিটের কিনারার মিল-চিহ্ন, '
      + 'বা দুই সিটে ভাগ হওয়া দাগের কোণা)।');
    this.draw();
  },

  size() {
    const c = document.getElementById('jt-canvas');
    if (!c || !c.parentElement) return;
    const r = c.parentElement.getBoundingClientRect();
    const w = Math.max(320, Math.round(r.width)), h = Math.max(300, Math.round(r.height));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  },

  fit() {
    const c = document.getElementById('jt-canvas');
    if (!c || !this.sheets.length) return;
    const boxes = this.sheets.map((s, i) =>
      s.t ? MapJoint.corners(s.t, s.canvas.width, s.canvas.height)
          : [{ x: 0, y: 0 }, { x: s.canvas.width, y: 0 },
             { x: s.canvas.width, y: s.canvas.height }, { x: 0, y: s.canvas.height }]);
    const bb = MapJoint.bounds(boxes);
    if (!bb) return;
    this.view.scale = Math.min(c.width / bb.w, c.height / bb.h) * 0.92;
    this.view.off = {
      x: (c.width - bb.w * this.view.scale) / 2 - bb.x * this.view.scale,
      y: (c.height - bb.h * this.view.scale) / 2 - bb.y * this.view.scale
    };
  },

  toScreen(p) { return { x: p.x * this.view.scale + this.view.off.x, y: p.y * this.view.scale + this.view.off.y }; },
  toWorld(p) { return { x: (p.x - this.view.off.x) / this.view.scale, y: (p.y - this.view.off.y) / this.view.scale }; },

  draw() {
    const c = document.getElementById('jt-canvas');
    if (!c) return;
    const g = c.getContext('2d');
    g.fillStyle = '#f8fafc'; g.fillRect(0, 0, c.width, c.height);
    if (!this.sheets.length) {
      g.fillStyle = '#94a3b8'; g.font = '14px "Noto Sans Bengali", sans-serif';
      g.textAlign = 'center';
      g.fillText('সিটের ছবি দিন', c.width / 2, c.height / 2);
      return;
    }
    const s = this.view.scale, o = this.view.off;
    this.sheets.forEach((sh, i) => {
      g.save();
      g.globalAlpha = i === 0 ? 1 : 0.72;
      g.translate(o.x, o.y); g.scale(s, s);
      if (sh.t) {
        const { scale, rotation, tx, ty } = sh.t;
        g.translate(tx, ty); g.rotate(rotation); g.scale(scale, scale);
      }
      g.drawImage(sh.canvas, 0, 0);
      g.restore();
      // সিটের ঘের
      const box = sh.t ? MapJoint.corners(sh.t, sh.canvas.width, sh.canvas.height)
        : [{ x: 0, y: 0 }, { x: sh.canvas.width, y: 0 },
           { x: sh.canvas.width, y: sh.canvas.height }, { x: 0, y: sh.canvas.height }];
      g.beginPath();
      box.forEach((p, j) => { const q = this.toScreen(p); j ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); });
      g.closePath();
      g.strokeStyle = i === 0 ? '#2563eb' : '#f97316';
      g.lineWidth = 2; g.setLineDash([6, 4]); g.stroke(); g.setLineDash([]);
    });

    // জোড়া বিন্দু
    this.pairs.forEach((pr, i) => {
      [['a', '#2563eb'], ['b', '#f97316']].forEach(([k, col]) => {
        if (!pr[k]) return;
        const q = this.toScreen(k === 'a' ? pr.a : this._sheetToWorld(1, pr.b));
        g.beginPath(); g.arc(q.x, q.y, 7, 0, Math.PI * 2);
        g.fillStyle = col; g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(CadCore.bn(i + 1), q.x, q.y);
      });
    });
  },

  _sheetToWorld(i, p) {
    const sh = this.sheets[i];
    return sh && sh.t ? sh.t.apply(p) : p;
  },

  onClick(ev) {
    const c = document.getElementById('jt-canvas');
    if (!c || !this.picking) return;
    const r = c.getBoundingClientRect();
    const p = this.toWorld({ x: (ev.clientX - r.left) * (c.width / r.width),
                             y: (ev.clientY - r.top) * (c.height / r.height) });
    if (this.picking.step === 0) {
      this.picking.tmp = p;
      this.picking.step = 1;
      this.status('এবার <b>দ্বিতীয় সিটে</b> ঠিক ঐ একই জায়গায় ক্লিক করুন।');
    } else {
      // দ্বিতীয় সিটের নিজস্ব স্থানাঙ্কে ফেরাই
      const sh = this.sheets[1];
      let bp = p;
      if (sh.t) {
        const { scale, rotation, tx, ty } = sh.t;
        const dx = p.x - tx, dy = p.y - ty;
        const cos = Math.cos(-rotation), sin = Math.sin(-rotation);
        bp = { x: (cos * dx - sin * dy) / scale, y: (sin * dx + cos * dy) / scale };
      }
      this.pairs.push({ a: this.picking.tmp, b: bp });
      this.picking = null;
      this.solve();
    }
    this.draw();
  },

  solve() {
    if (this.pairs.length < 2) {
      this.status(CadCore.bn(this.pairs.length) + ' জোড়া হয়েছে — জোড়ার জন্য অন্তত ২ জোড়া লাগবে। '
        + '<button type="button" class="cad-mini" onclick="JointApp.startPair()">আরেক জোড়া দিন</button>');
      return;
    }
    const t = MapJoint.solve(this.pairs.map(p => p.b), this.pairs.map(p => p.a));
    if (!t) { this.status('বিন্দুগুলো একই জায়গায় পড়েছে — আলাদা জায়গায় বসান।', true); return; }
    this.sheets[1].t = t;
    this.fit(); this.draw();
    const q = MapJoint.quality(t.rmse);
    this.status('সিট জোড়া লেগেছে — মিল <b>' + q.label + '</b> (গড় হেরফের '
      + CadCore.bn(t.rmse.toFixed(1)) + ' পিক্সেল) · স্কেল ' + CadCore.bn(t.scale.toFixed(3))
      + ' · ঘূর্ণন ' + CadCore.bn(t.rotationDeg.toFixed(2)) + '° · '
      + CadCore.bn(t.pairs) + ' জোড়া। '
      + '<button type="button" class="cad-mini" onclick="JointApp.startPair()">আরেক জোড়া দিলে আরও নিখুঁত হবে</button>');
  },

  reset() {
    this.pairs = [];
    if (this.sheets[1]) this.sheets[1].t = null;
    this.picking = null;
    this.fit(); this.draw();
    this.status('বিন্দু মুছে ফেলা হয়েছে।');
  },

  render() {
    const box = document.getElementById('jt-sheets');
    if (!box) return;
    box.innerHTML = this.sheets.length
      ? this.sheets.map((s, i) => `<div class="cad-raster">
          <span class="cad-raster-name">${i === 0 ? '১ম' : (i + 1) + 'য়'} — ${s.name}</span>
          <button type="button" class="cad-lyr-eye" onclick="JointApp.removeSheet(${i})">
            <i class="bi bi-x-lg"></i></button></div>`).join('')
      : '<div class="cad-empty-mini">কোনো সিট যোগ করা হয়নি</div>';
  },

  /** জোড়া লাগানো সিট এক ছবিতে */
  merge() {
    if (this.sheets.length < 2 || !this.sheets[1].t) {
      this.status('আগে দুই সিট জোড়া লাগান।', true); return null;
    }
    const boxes = this.sheets.map(s => s.t
      ? MapJoint.corners(s.t, s.canvas.width, s.canvas.height)
      : [{ x: 0, y: 0 }, { x: s.canvas.width, y: 0 },
         { x: s.canvas.width, y: s.canvas.height }, { x: 0, y: s.canvas.height }]);
    const bb = MapJoint.bounds(boxes);
    const cap = 40e6;                                  // স্মৃতির সীমা
    let k = 1;
    if (bb.w * bb.h > cap) k = Math.sqrt(cap / (bb.w * bb.h));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(bb.w * k));
    out.height = Math.max(1, Math.round(bb.h * k));
    const g = out.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, out.width, out.height);
    this.sheets.forEach(s => {
      g.save();
      g.scale(k, k); g.translate(-bb.x, -bb.y);
      if (s.t) {
        const { scale, rotation, tx, ty } = s.t;
        g.translate(tx, ty); g.rotate(rotation); g.scale(scale, scale);
      }
      g.drawImage(s.canvas, 0, 0);
      g.restore();
    });
    return out;
  },

  download() {
    const c = this.merge();
    if (!c) return;
    c.toBlob(b => {
      CadGeo.download(b, 'জোড়া-নকশা.jpg', 'image/jpeg');
      this.status('জোড়া লাগানো নকশা নামানো হয়েছে — '
        + CadCore.bn(c.width) + '×' + CadCore.bn(c.height) + ' পিক্সেল।');
    }, 'image/jpeg', 0.92);
  },

  toCad() {
    const c = this.merge();
    if (!c) return;
    AppController.openToolModal('survey-cad');
    setTimeout(() => {
      CadApp.useImage({ canvas: c, img: c, width: c.width, height: c.height }, 'জোড়া নকশা');
    }, 80);
  }
};

/* ==========================================================================
   ৪. হাত নকশা → ডিজিটাল রিপোর্ট
   হাতে আঁকা স্কেচ পটভূমিতে বসিয়ে তার উপর দাগ এঁকে মাপ ও শিট বানানো —
   কাজটা ডিজিটাল সার্ভে টুলেই হয়, এখানে কেবল ধাপে ধাপে নিয়ে যাওয়া হয়।
   ========================================================================== */

const SketchApp = {
  pick() {
    const i = document.getElementById('sk-file');
    if (i) { i.value = ''; i.click(); }
  },

  load(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const r = await KmzSource.toImage(new Uint8Array(rd.result), f.type, { needBytes: false });
        const c = r.canvas || r.img;
        AppController.openToolModal('survey-cad');
        setTimeout(() => {
          CadApp.setSurvey('dag');
          CadApp.useImage({ canvas: c, img: c, width: r.width, height: r.height },
                          f.name || 'হাত নকশা');
          setTimeout(() => {
            CadApp.tool('scale');
            CadApp.status('হাত নকশা বসানো হয়েছে। <b>ধাপ ১:</b> স্কেল টুল দিয়ে স্কেচে লেখা '
              + 'কোনো চেনা বাহুর দুই প্রান্তে ক্লিক করে তার মাপ লিখুন। '
              + '<b>ধাপ ২:</b> কলম টুলে জমির কোণায় কোণায় ক্লিক করে দাগ আঁকুন। '
              + '<b>ধাপ ৩:</b> শিট ট্যাবে তথ্য দিয়ে A4 রিপোর্ট ছাপুন।');
          }, 250);
        }, 80);
      } catch (e) {
        const el = document.getElementById('sk-status');
        if (el) { el.style.display = ''; el.className = 'cad-status bad'; el.textContent = e.message; }
      }
    };
    rd.readAsArrayBuffer(f);
  }
};

/* ==================== টুল খোলার সংযোগ ==================== */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof AppController === 'undefined') return;
  const orig = AppController.openToolModal.bind(AppController);
  const TITLES = {
    'map-convert': ['Map Converter + Cleaner', 'bi-magic text-primary', () => ConvertApp.init()],
    'area-unknown': ['ক্ষেত্রফল ও অজানা বাহু', 'bi-bounding-box text-success', () => AreaApp.init()],
    'map-joint': ['ম্যাপ জয়েন্ট (সিট জোড়া)', 'bi-union text-warning', () => JointApp.init()]
  };
  AppController.openToolModal = function (toolId) {
    orig(toolId);
    const cfg = TITLES[toolId];
    if (!cfg) return;
    const t = document.getElementById('modal-title-text');
    const i = document.getElementById('modal-title-icon');
    if (t) t.innerText = cfg[0];
    if (i) i.className = 'bi ' + cfg[1];
    setTimeout(cfg[2], 60);
  };

  let rz = null;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const v = document.getElementById('view-map-joint');
      if (v && v.style.display !== 'none') { JointApp.size(); JointApp.draw(); }
    }, 180);
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConvertApp, AreaApp, JointApp, SketchApp };
}
