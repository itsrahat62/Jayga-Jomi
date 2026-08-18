/* ==========================================================================
   cad-divide-ui.js — জমি ভাগ-বণ্টন টুলের পর্দা
   গণিত CadDivide এ; এখানে কেবল ইনপুট, ছবি আঁকা ও ফল দেখানো।
   ========================================================================== */

const DivideApp = {

  poly: null,            // ভাগ করার দাগ (পিক্সেল স্থানাঙ্ক)
  ftPerPx: 1,            // ১ পিক্সেল = কত ফুট
  mode: 'ratio',
  angleDeg: 0,
  result: null,
  shares: [{ name: '', value: '' }, { name: '', value: '' }],

  /* ==================== চালু ==================== */

  init() {
    this._fillModes();
    if (!this.poly) this.useSides(true);          // প্রথমবার নমুনা আকৃতি
    this.renderShares();
    this.draw();
  },

  _fillModes() {
    const sel = document.getElementById('dv-mode');
    if (!sel || sel._filled) return;
    sel._filled = true;
    sel.innerHTML = CadDivide.SHARE_MODES
      .map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    sel.value = this.mode;
  },

  status(msg, bad) {
    const el = document.getElementById('dv-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.className = 'cad-status' + (bad ? ' bad' : '');
    el.innerHTML = msg;
  },

  /* ==================== আকৃতি নেওয়া ==================== */

  setSource(kind) {
    ['sides', 'cad'].forEach(k => {
      const p = document.getElementById('dv-src-' + k);
      if (p) p.style.display = k === kind ? '' : 'none';
      const b = document.getElementById('dv-tab-' + k);
      if (b) b.classList.toggle('active', k === kind);
    });
    if (kind === 'cad') this.renderCadList();
  },

  /** বাহুর মাপ থেকে আকৃতি */
  useSides(quiet) {
    const raw = (document.getElementById('dv-sides') || {}).value || '';
    const diag = (document.getElementById('dv-diag') || {}).value || '';
    const list = raw.split(/[,\s;·]+/).map(v => CadCore.num(v)).filter(v => isFinite(v) && v > 0);

    if (list.length < 3) {
      if (!quiet) this.status('অন্তত ৩টি বাহুর মাপ দিন — কমা দিয়ে আলাদা করুন।', true);
      if (!this.poly) {
        // নমুনা: ১০০ × ৮০ ফুট আয়তক্ষেত্র
        this.ftPerPx = 0.5;
        this.poly = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 160 }, { x: 0, y: 160 }];
        this.angleDeg = CadDivide.deg(CadDivide.suggestAngle(this.poly));
        this.compute();
      }
      return;
    }

    // দাগ পর্দায় ভালোভাবে বসাতে ftPerPx বেছে নিই
    const maxSide = Math.max(...list);
    this.ftPerPx = maxSide / 260;
    const poly = CadDivide.fromSides(list, diag, this.ftPerPx);
    if (!poly || CadCore.area(poly) <= 0) {
      this.status('এই মাপে আকৃতি হয় না — বাহুর মাপ বা কর্ণ দেখে নিন। '
        + '(চতুর্ভুজে কর্ণ না দিলে সমকোণী ধরা হয়।)', true);
      return;
    }
    this.poly = poly;
    this.angleDeg = CadDivide.deg(CadDivide.suggestAngle(poly));
    const a = CadCore.area(poly) * this.ftPerPx * this.ftPerPx;
    this.status('আকৃতি তৈরি — ক্ষেত্রফল <b>' + CadCore.satakText(a) + '</b> ('
      + CadCore.bn(a.toFixed(0)) + ' বর্গফুট)');
    this.compute();
  },

  /** ডিজিটাল সার্ভে টুলে আঁকা দাগগুলোর তালিকা */
  renderCadList() {
    const box = document.getElementById('dv-cad-list');
    if (!box) return;
    const doc = (typeof CadApp !== 'undefined') ? CadApp.doc : null;
    const feats = doc ? doc.features.filter(f => f.closed && f.pts.length >= 3) : [];
    if (!feats.length) {
      box.innerHTML = '<div class="cad-empty-mini">ডিজিটাল সার্ভে টুলে কোনো দাগ আঁকা নেই। '
        + 'আগে সেখানে নকশা ডিজিটাইজ করুন, তারপর এখানে এসে দাগ বেছে নিন।</div>';
      return;
    }
    if (!(doc.ftPerPx > 0)) {
      box.innerHTML = '<div class="cad-empty-mini">ঐ টুলে স্কেল বসানো নেই — '
        + 'তাই ক্ষেত্রফল বের হবে না। আগে স্কেল বসিয়ে নিন।</div>';
      return;
    }
    box.innerHTML = feats.slice(0, 200).map(f => {
      const m = CadCore.measure(doc, f);
      return `<button type="button" class="cad-mini" style="width:100%;justify-content:space-between;margin-bottom:4px"
        onclick="DivideApp.takeFromCad('${f.id}')">
        <span>${f.dag ? 'দাগ ' + CadCore.bn(f.dag) : 'দাগ (নম্বর নেই)'}</span>
        <span style="color:var(--text-muted)">${CadCore.satakText(m.sqft)}</span></button>`;
    }).join('');
  },

  takeFromCad(id) {
    const doc = CadApp.doc;
    const f = CadCore.feature(doc, id);
    if (!f) return;
    // দাগটিকে (০,০) এ এনে পর্দার মাপে বসাই
    const bb = CadCore.bbox(f.pts);
    const k = 300 / Math.max(bb.w, bb.h);
    this.poly = f.pts.map(p => ({ x: (p.x - bb.x) * k, y: (p.y - bb.y) * k }));
    this.ftPerPx = doc.ftPerPx / k;
    this.angleDeg = CadDivide.deg(CadDivide.suggestAngle(this.poly));
    const m = CadCore.measure(doc, f);
    this.status((f.dag ? 'দাগ ' + CadCore.bn(f.dag) : 'দাগ') + ' নেওয়া হয়েছে — '
      + '<b>' + CadCore.satakText(m.sqft) + '</b>');
    this.compute();
  },

  /* ==================== অংশীদার ==================== */

  renderShares() {
    const box = document.getElementById('dv-shares');
    if (!box) return;
    const m = CadDivide.SHARE_MODES.find(x => x.id === this.mode);
    box.innerHTML = this.shares.map((s, i) => `
      <div class="dv-share">
        <span class="dv-share-n">${CadCore.bn(i + 1)}</span>
        <input placeholder="নাম (ঐচ্ছিক)" value="${(s.name || '').replace(/"/g, '&quot;')}"
               onchange="DivideApp.setShare(${i},'name',this.value)">
        <input placeholder="${m ? m.hint : ''}" inputmode="decimal" class="dv-share-v"
               value="${(s.value || '').toString().replace(/"/g, '&quot;')}"
               onchange="DivideApp.setShare(${i},'value',this.value)">
        <button type="button" class="cad-dag-x" title="বাদ দিন"
                onclick="DivideApp.delShare(${i})"><i class="bi bi-x-lg"></i></button>
      </div>`).join('');
    const hint = document.getElementById('dv-mode-hint');
    if (hint) hint.textContent = m ? m.hint : '';
  },

  setShare(i, key, val) {
    if (!this.shares[i]) return;
    this.shares[i][key] = val;
    this.compute();
  },

  addShare() {
    this.shares.push({ name: '', value: '' });
    this.renderShares();
  },

  delShare(i) {
    if (this.shares.length <= 2) { this.status('অন্তত দুইজন অংশীদার লাগবে।', true); return; }
    this.shares.splice(i, 1);
    this.renderShares();
    this.compute();
  },

  setMode(v) {
    this.mode = v;
    const sel = document.getElementById('dv-mode');
    if (sel && sel.value !== v) sel.value = v;      // বাইরে থেকে বদলালেও ড্রপডাউন মিলবে
    this.renderShares();
    this.compute();
  },

  setAngle(v) {
    this.angleDeg = CadCore.num(v) || 0;
    const lbl = document.getElementById('dv-angle-val');
    if (lbl) lbl.textContent = CadCore.bn(Math.round(this.angleDeg)) + '°';
    this.compute();
  },

  autoAngle() {
    if (!this.poly) return;
    this.angleDeg = CadDivide.deg(CadDivide.suggestAngle(this.poly));
    const sl = document.getElementById('dv-angle');
    if (sl) sl.value = String(Math.round(this.angleDeg));
    this.setAngle(this.angleDeg);
  },

  /* ==================== হিসাব ও আঁকা ==================== */

  compute() {
    if (!this.poly) return;
    const doc = { ftPerPx: this.ftPerPx };
    this.result = CadDivide.divide(doc, this.poly, this.shares, {
      mode: this.mode, angle: CadDivide.rad(this.angleDeg)
    });
    this.draw();
    this.renderResult();
  },

  COLORS: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9',
           '#a855f7', '#14b8a6', '#f97316', '#84cc16', '#ec4899'],

  draw() {
    const c = document.getElementById('dv-canvas');
    if (!c || !this.poly) return;
    const r = c.parentElement.getBoundingClientRect();
    const W = Math.max(300, Math.round(r.width)), H = Math.max(280, Math.round(r.height));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);

    const bb = CadCore.bbox(this.poly);
    const pad = 54;
    const k = Math.min((W - pad * 2) / (bb.w || 1), (H - pad * 2) / (bb.h || 1));
    const ox = (W - bb.w * k) / 2 - bb.x * k;
    const oy = (H - bb.h * k) / 2 - bb.y * k;
    const T = p => ({ x: p.x * k + ox, y: p.y * k + oy });

    const parts = (this.result && this.result.ok) ? this.result.parts : [];

    // প্রতিটি অংশ
    parts.forEach((part, i) => {
      const col = this.COLORS[i % this.COLORS.length];
      g.beginPath();
      part.pts.forEach((p, j) => { const q = T(p); j ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); });
      g.closePath();
      g.fillStyle = col + '2e';
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.stroke();

      // নাম ও ক্ষেত্রফল
      const lp = T(CadCore.labelPoint(part.pts));
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 13px "Noto Sans Bengali", sans-serif';
      g.fillStyle = col;
      g.fillText(part.name, lp.x, lp.y - 8);
      g.font = '600 11px "Noto Sans Bengali", sans-serif';
      g.fillStyle = '#374151';
      g.fillText(CadCore.satakText(part.sqft), lp.x, lp.y + 8);
    });

    // মূল দাগের বাইরের রেখা
    g.beginPath();
    this.poly.forEach((p, j) => { const q = T(p); j ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); });
    g.closePath();
    g.strokeStyle = '#111827'; g.lineWidth = 2.4; g.stroke();

    // বাহুর মাপ
    g.font = '600 11px "Noto Sans Bengali", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const cen = CadCore.centroid(this.poly);
    for (let i = 0; i < this.poly.length; i++) {
      const a = this.poly[i], b = this.poly[(i + 1) % this.poly.length];
      const ft = CadCore.dist(a, b) * this.ftPerPx;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let nx = mid.x - cen.x, ny = mid.y - cen.y;
      const nl = Math.hypot(nx, ny) || 1;
      const q = T({ x: mid.x + nx / nl * (16 / k), y: mid.y + ny / nl * (16 / k) });
      const txt = CadCore.ftIn(ft);
      const w = g.measureText(txt).width;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(q.x - w / 2 - 3, q.y - 8, w + 6, 16);
      g.fillStyle = '#1d4ed8';
      g.fillText(txt, q.x, q.y);
    }
  },

  renderResult() {
    const box = document.getElementById('dv-result');
    if (!box) return;
    const r = this.result;
    if (!r || !r.ok) {
      box.innerHTML = '<div class="cad-empty-mini">' + ((r && r.error) || 'হিস্যা দিন') + '</div>';
      return;
    }
    const rows = r.parts.map((p, i) => `
      <tr>
        <td><span class="dv-dot" style="background:${this.COLORS[i % this.COLORS.length]}"></span>${p.name}</td>
        <td>${CadCore.bn(p.share || '—')}</td>
        <td><b>${CadCore.bn(p.satak.toFixed(3))}</b></td>
        <td>${CadCore.bn((p.sqft / CadCore.sqftPerKatha()).toFixed(3))}</td>
        <td>${CadCore.bn(p.sqft.toFixed(0))}</td>
      </tr>`).join('');

    box.innerHTML = `
      <table class="dv-table">
        <tr><th>অংশীদার</th><th>হিস্যা</th><th>শতাংশ</th><th>কাঠা</th><th>বর্গফুট</th></tr>
        ${rows}
        <tr class="tot"><td>মোট</td><td></td>
          <td><b>${CadCore.bn((r.sumSqft / CadCore.SQFT_PER_SATAK).toFixed(3))}</b></td>
          <td>${CadCore.bn((r.sumSqft / CadCore.sqftPerKatha()).toFixed(3))}</td>
          <td>${CadCore.bn(r.sumSqft.toFixed(0))}</td></tr>
      </table>
      <p class="dv-note">ভাগের নিখুঁততা — সবচেয়ে বেশি হেরফের
        <b>${CadCore.bn(r.maxErrorPct.toFixed(3))}%</b>${
        Math.abs(r.lossSqft) > 1
          ? ' · যোগফলে পার্থক্য ' + CadCore.bn(Math.abs(r.lossSqft).toFixed(1)) + ' বর্গফুট'
          : ' · যোগফল হুবহু মিলেছে'}</p>
      ${r.warn ? '<p class="dv-note warn">' + r.warn + '</p>' : ''}`;
  },

  /* ==================== রপ্তানি ==================== */

  exportCsv() {
    if (!this.result || !this.result.ok) { this.status('আগে ভাগ করুন।', true); return; }
    CadGeo.download(CadDivide.toCsv(this.result, { ftPerPx: this.ftPerPx }),
                    'জমি-ভাগ-বণ্টন.csv', 'text/csv;charset=utf-8');
    this.status('তালিকা CSV নামানো হয়েছে — Excel এ খুলবে।');
  },

  exportPng() {
    const c = document.getElementById('dv-canvas');
    if (!c) return;
    const out = document.createElement('canvas');
    out.width = c.width; out.height = c.height;
    const g = out.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(c, 0, 0);
    out.toBlob(b => CadGeo.download(b, 'জমি-ভাগ-বণ্টন.png', 'image/png'));
    this.status('ছবি নামানো হয়েছে।');
  },

  /** ভাগগুলো ডিজিটাল সার্ভে টুলে পাঠানো — শিট ছাপা ও KMZ এর জন্য */
  sendToCad() {
    if (!this.result || !this.result.ok) { this.status('আগে ভাগ করুন।', true); return; }
    if (typeof CadApp === 'undefined') return;
    const doc = CadApp.doc;
    if (!doc) return;
    CadApp.started = true;
    if (!(doc.ftPerPx > 0)) doc.ftPerPx = this.ftPerPx;
    const k = this.ftPerPx / doc.ftPerPx;          // এই টুলের পিক্সেল → CAD এর পিক্সেল
    let n = 0;
    for (const p of this.result.parts) {
      const pts = p.pts.map(q => ({ x: q.x * k, y: q.y * k }));
      CadCore.addFeature(doc, CadCore.newFeature(doc, 'prop', pts, { dag: p.name }));
      n++;
    }
    AppController.openToolModal('survey-cad');
    setTimeout(() => {
      CadApp.sizeCanvas(); CadApp._initView();
      CadView.fit(); CadView.draw();
      CadApp.renderFeatures(); CadApp.renderStats();
      CadApp.status(CadCore.bn(n) + 'টি ভাগ ডিজিটাল সার্ভে টুলে আনা হয়েছে — '
        + 'এবার শিট ছাপুন বা গুগল আর্থে বসান।');
    }, 80);
  }
};

/* টুল খোলার সময় চালু */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof AppController === 'undefined') return;
  const orig = AppController.openToolModal.bind(AppController);
  AppController.openToolModal = function (toolId) {
    orig(toolId);
    if (toolId === 'land-divider') {
      const t = document.getElementById('modal-title-text');
      const i = document.getElementById('modal-title-icon');
      if (t) t.innerText = 'জমি ভাগ-বণ্টন (যেকোনো আকৃতি)';
      if (i) i.className = 'bi bi-diagram-3 text-primary';
      setTimeout(() => DivideApp.init(), 60);
    }
  };
  let rz = null;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const v = document.getElementById('view-land-divider');
      if (v && v.style.display !== 'none') DivideApp.draw();
    }, 180);
  });
});

if (typeof module !== 'undefined' && module.exports) module.exports = DivideApp;
