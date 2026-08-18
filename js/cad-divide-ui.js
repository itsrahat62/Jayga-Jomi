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
    ['sides', 'cad', 'draw'].forEach(k => {
      const p = document.getElementById('dv-src-' + k);
      if (p) p.style.display = k === kind ? '' : 'none';
      const b = document.getElementById('dv-tab-' + k);
      if (b) b.classList.toggle('active', k === kind);
    });
    if (kind === 'cad') this.renderCadList();
    if (kind !== 'draw' && this.drawing) this.drawStop(true);
    this.src = kind;
    this.draw();
  },

  /* ==================== নিজে এঁকে ভাগ ====================
     ★ কেন লাগে
       সব জমির বাহুর মাপ হাতে থাকে না, নকশাও ডিজিটাইজ করা থাকে না — কিন্তু
       দলিলে **মোট পরিমাণ** লেখা থাকে। তখন আকৃতিটা চোখের আন্দাজে এঁকে মোট
       জমির পরিমাণ লিখে দিলেই ভাগ করা যায়। আঁকা আকৃতিকে ঐ পরিমাণে মিলিয়ে
       নেওয়া হয় (ftPerPx = √(মোট বর্গফুট ÷ আঁকা ক্ষেত্রফল))।
     ★ সীমা — আন্দাজে আঁকা, তাই **আকৃতি** আন্দাজি; কিন্তু মোট পরিমাণ ও
       প্রতিটি অংশের পরিমাণ **হুবহু** ঠিক থাকে, কারণ ঐ পরিমাণ ধরেই মাপা হয়।
     ==================================================== */

  drawing: false,
  draft: [],
  src: 'sides',

  drawStart() {
    this.drawing = true;
    this.draft = [];
    this.poly = null; this.result = null;
    this.renderResult(); this.draw();
    this.status('ক্যানভাসে জমির কোণায় কোণায় ক্লিক করুন (অন্তত ৩টি)। '
      + 'শেষ কোণা দিয়ে <b>“আঁকা শেষ”</b> চাপুন — বা প্রথম কোণায় আবার ক্লিক করুন।');
    this._syncDrawBtns();
  },

  drawStop(silent) {
    this.drawing = false;
    this._syncDrawBtns();
    if (!silent) this.draw();
  },

  drawUndo() {
    if (!this.draft.length) return;
    this.draft.pop();
    this.draw();
  },

  drawClear() {
    this.draft = []; this.poly = null; this.result = null;
    this.renderResult(); this.draw();
    this.status('মুছে ফেলা হয়েছে — আবার আঁকুন।');
  },

  /** আঁকা শেষ — মোট পরিমাণ দিয়ে মাপে বসানো */
  drawFinish() {
    if (this.draft.length < 3) {
      this.status('অন্তত ৩টি কোণা দিন।', true); return;
    }
    const el = document.getElementById('dv-draw-area');
    const amt = CadCore.num(el ? el.value : '');
    if (!(amt > 0)) {
      this.status('জমির <b>মোট পরিমাণ</b> লিখুন — দলিলে যা লেখা আছে। '
        + 'ওটা দিয়েই আঁকা আকৃতিকে মাপে বসানো হবে।', true);
      if (el) el.focus();
      return;
    }
    const unitEl = document.getElementById('dv-draw-unit');
    const unit = unitEl ? unitEl.value : 'satak';
    const kSqft = CadCore.sqftPerKatha();           // ব্যবহারকারীর সেটিং মানে
    const sqft = unit === 'katha' ? amt * kSqft
               : unit === 'bigha' ? amt * kSqft * 20
               : unit === 'sqft'  ? amt
               : amt * 435.6;                       // শতাংশ
    const pxArea = Math.abs(CadCore.signedArea(this.draft));
    if (!(pxArea > 0)) { this.status('আঁকা আকৃতির ক্ষেত্রফল শূন্য — কোণাগুলো এক রেখায় পড়েছে।', true); return; }

    this.poly = this.draft.map(p => ({ x: p.x, y: p.y }));
    this.ftPerPx = Math.sqrt(sqft / pxArea);
    this.drawing = false;
    this.angleDeg = CadDivide.deg(CadDivide.suggestAngle(this.poly));
    this._syncDrawBtns();
    this.compute();
    this.status('আঁকা আকৃতি <b>' + CadCore.satakText(sqft) + '</b> ধরে বসানো হয়েছে — '
      + 'এখন কে কত পাবে সেটি দিন। আকৃতি আন্দাজি হলেও প্রতিটি অংশের পরিমাণ ঠিক থাকবে।');
  },

  _syncDrawBtns() {
    const s = document.getElementById('dv-draw-start');
    const f = document.getElementById('dv-draw-finish');
    if (s) s.style.display = this.drawing ? 'none' : '';
    if (f) f.style.display = this.drawing ? '' : 'none';
    const n = document.getElementById('dv-draw-count');
    if (n) n.textContent = this.draft.length
      ? CadCore.bn(this.draft.length) + 'টি কোণা বসেছে' : '';
  },

  /** চলতি আঁকা — কোণা, রেখা ও নির্দেশ */
  _drawDraft(g, W, H) {
    const pts = this.draft;
    g.save();
    if (!pts.length) {
      g.fillStyle = '#94a3b8';
      g.font = '600 14px "Noto Sans Bengali", sans-serif';
      g.textAlign = 'center';
      g.fillText(this.drawing ? 'জমির কোণায় কোণায় ক্লিক করুন'
                              : '“আঁকা শুরু” চেপে জমির আকৃতি আঁকুন', W / 2, H / 2);
      g.restore(); return;
    }
    g.beginPath();
    pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
    if (pts.length >= 3) {
      g.closePath();
      g.fillStyle = 'rgba(79,70,229,0.12)';
      g.fill();
    }
    g.strokeStyle = '#4f46e5'; g.lineWidth = 2;
    g.stroke();

    pts.forEach((p, i) => {
      g.beginPath(); g.arc(p.x, p.y, i === 0 ? 6 : 4.5, 0, Math.PI * 2);
      g.fillStyle = i === 0 ? '#f59e0b' : '#4f46e5';
      g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.stroke();
    });

    if (this.drawing && pts.length >= 3) {
      g.fillStyle = '#b45309';
      g.font = '600 12px "Noto Sans Bengali", sans-serif';
      g.textAlign = 'left';
      g.fillText('প্রথম কোণায় (হলুদ) আবার ক্লিক করলেই আঁকা শেষ', 12, H - 14);
    }
    g.restore();
  },

  /** ক্যানভাসে ক্লিক — কেবল আঁকার অবস্থায় */
  onCanvasClick(ev) {
    if (!this.drawing) return;
    const c = document.getElementById('dv-canvas');
    if (!c) return;
    const r = c.getBoundingClientRect();
    const p = { x: (ev.clientX - r.left) * (c.width / r.width),
                y: (ev.clientY - r.top) * (c.height / r.height) };
    // প্রথম কোণার কাছে আবার ক্লিক = আঁকা শেষ
    if (this.draft.length >= 3) {
      const a = this.draft[0];
      if (Math.hypot(p.x - a.x, p.y - a.y) < 12) { this.drawFinish(); return; }
    }
    this.draft.push(p);
    this._syncDrawBtns();
    this.draw();
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

  /** সব দাগ দেখাব, নাকি কেবল যেগুলো বাছা হয়েছে */
  cadShowAll: false,
  cadPick: null,          // অন্য পর্দা থেকে পাঠানো দাগের তালিকা

  setCadScope(all) { this.cadShowAll = !!all; this.renderCadList(); },

  /**
   * ডিজিটাল সার্ভে টুলে আঁকা দাগগুলোর তালিকা
   *
   * ★ কেন কেবল বাছাই করাগুলো
   *   একটি মৌজা নকশায় হাজারেরও বেশি দাগ থাকে। একটি দাগ নিয়ে ভাগ করতে এসে
   *   পুরো তালিকা নামলে পাতা ভেসে যায়, নিজের দাগটাই আর খুঁজে পাওয়া যায় না।
   *   তাই বাছাই থাকলে **কেবল সেগুলোই** দেখাই; দরকার হলে “সব দাগ” চেপে
   *   পুরো তালিকা খোলা যায়।
   */
  renderCadList() {
    const box = document.getElementById('dv-cad-list');
    if (!box) return;
    const doc = (typeof CadApp !== 'undefined') ? CadApp.doc : null;
    const all = doc ? doc.features.filter(f => f.closed && f.pts.length >= 3) : [];
    if (!all.length) {
      box.innerHTML = '<div class="cad-empty-mini">ডিজিটাল সার্ভে টুলে কোনো দাগ আঁকা নেই। '
        + 'আগে সেখানে নকশা ডিজিটাইজ করুন, তারপর এখানে এসে দাগ বেছে নিন।</div>';
      return;
    }
    if (!(doc.ftPerPx > 0)) {
      box.innerHTML = '<div class="cad-empty-mini">ঐ টুলে স্কেল বসানো নেই — '
        + 'তাই ক্ষেত্রফল বের হবে না। আগে স্কেল বসিয়ে নিন।</div>';
      return;
    }

    /* বাছাই — যে পর্দা থেকে পাঠানো হয়েছে সেটিই (`cadPick`), নইলে ক্যানভাসের
       চলতি নির্বাচন। টুলটি নতুন করে খুললে `cadPick` মুছে যায়, তাই পুরোনো
       বাছাই আটকে থাকে না। */
    let picked = (this.cadPick && this.cadPick.length)
      ? this.cadPick.slice()
      : ((typeof CadView !== 'undefined' && CadView.state)
          ? CadView.state.selection.slice() : []);
    const pickSet = new Set(picked);
    const hasPick = picked.length > 0 && all.some(f => pickSet.has(f.id));
    const list = (hasPick && !this.cadShowAll) ? all.filter(f => pickSet.has(f.id)) : all;

    const head = hasPick
      ? `<div class="dv-scope">
           <button type="button" class="cad-mini${this.cadShowAll ? '' : ' hot'}"
                   onclick="DivideApp.setCadScope(false)">বাছাই করা (${CadCore.bn(picked.length)})</button>
           <button type="button" class="cad-mini${this.cadShowAll ? ' hot' : ''}"
                   onclick="DivideApp.setCadScope(true)">সব দাগ (${CadCore.bn(all.length)})</button>
         </div>`
      : (all.length > 200
          ? `<p class="cad-hint-mini">${CadCore.bn(all.length)}টি দাগের মধ্যে প্রথম ২০০টি দেখানো হচ্ছে।
               ডিজিটাল সার্ভেতে দাগ বেছে এলে কেবল সেগুলোই দেখাবে।</p>` : '');

    const shown = list.slice(0, 200);
    box.innerHTML = head + shown.map(f => {
      const m = CadCore.measure(doc, f);
      return `<button type="button" class="cad-mini" style="width:100%;justify-content:space-between;margin-bottom:4px"
        onclick="DivideApp.takeFromCad('${f.id}')">
        <span>${f.dag ? 'দাগ ' + CadCore.bn(f.dag) : 'দাগ (নম্বর নেই)'}</span>
        <span style="color:var(--text-muted)">${CadCore.satakText(m.sqft)}</span></button>`;
    }).join('')
    + (list.length > shown.length
        ? `<p class="cad-hint-mini">আরও ${CadCore.bn(list.length - shown.length)}টি বাকি —
             ডিজিটাল সার্ভেতে দরকারি দাগগুলো বেছে নিয়ে আসুন।</p>` : '');
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
    if (!c) return;
    const r = c.parentElement.getBoundingClientRect();
    const W = Math.max(300, Math.round(r.width)), H = Math.max(280, Math.round(r.height));
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);

    // আঁকার অবস্থায় চলতি রেখাই দেখাই
    if (this.drawing || (!this.poly && this.draft.length)) { this._drawDraft(g, W, H); return; }
    if (!this.poly) return;

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
      // হোম থেকে সরাসরি খুললে আগের পর্দার বাছাই আর প্রযোজ্য নয়
      if (!DivideApp._incoming) { DivideApp.cadPick = null; DivideApp.cadShowAll = false; }
      DivideApp._incoming = false;
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
