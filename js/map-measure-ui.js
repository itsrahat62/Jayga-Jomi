/* ==========================================================================
   map-measure-ui.js — মৌজা নকশায় আঁকার ক্যানভাস
   --------------------------------------------------------------------------
   ছবির উপরে জুম/প্যান করে প্লট আঁকা, বাহুর মাপ ও ক্ষেত্রফল দেখানো।
   গণিত সবই `MapMeasure` এ — এখানে কেবল আঁকা ও ইনপুট।

   ★ স্থানাঙ্কের দুটি জগৎ
     - **ছবির পিক্সেল** — প্লটের বিন্দু এখানেই রাখা হয়, জুম বদলালেও অপরিবর্তিত
     - **ক্যানভাস পিক্সেল** — কেবল আঁকার জন্য
     সব হিসাব ছবির পিক্সেলে, তাই জুম করে আঁকলেও মাপ একই থাকে।
   ========================================================================== */

const MeasureCanvas = {

  state: null,

  /* কোন টুল সক্রিয়: pan · draw · point · select · calib */
  TOOLS: ['pan', 'draw', 'point', 'select', 'calib'],

  init(canvas, opts) {
    const o = opts || {};
    this.state = {
      canvas,
      ctx: canvas.getContext('2d'),
      img: null,
      scale: 1,
      off: { x: 0, y: 0 },
      tool: 'pan',
      ftPerPx: 0,
      plots: [],            // [{id, dag, name, points, closed}]
      draft: [],            // আঁকার মধ্যে থাকা বিন্দু
      selected: -1,         // নির্বাচিত প্লটের সূচক
      dragPt: null,         // {plot, index} — টেনে সরানো বিন্দু
      drag: null,
      start: null,          // যেখানে আঙুল নামল
      panning: false,       // সীমা পেরিয়ে সত্যিই টানা শুরু হয়েছে?
      gesture: false,       // ইশারাটা ক্যানভাসেই শুরু হয়েছিল তো?
      pinch: null,          // দুই আঙুলের ইশারা — {d0, c0, scale0}
      picked: null,         // পয়েন্ট টুলে বাছাই করা শীর্ষবিন্দু {plot, index}
      hi: null,                // জুম করলে PDF থেকে আঁকা পরিষ্কার অংশ
      lens: null,           // আতশকাচ — {x, y} ক্যানভাস স্থানাঙ্কে
      touch: false,         // এই ইশারাটা আঙুলে না মাউসে
      calib: null,            // {pts:[], cb}
      division: null,         // ভাগবণ্টনের ফল — আলাদা রঙে আঁকা হয়
      labelUnit: 'ftin',      // বাহুর লেবেল কোন এককে — MapMeasure.LABEL_UNITS
      viewW: canvas.width,    // ★ দেখার মাপ — CSS পিক্সেলে
      viewH: canvas.height,
      dpr: 1,                 // ★ পর্দার ঘনত্ব — বিটম্যাপ এর গুণ বেশি
      onChange: o.onChange || null,
      onSelect: o.onSelect || null,
      onView: o.onView || null,  // জুম/মাপ বদলালে — নির্ভুলতার বাতি হালনাগাদে
      onHistory: o.onHistory || null,
      onRestore: o.onRestore || null,
      history: [],
      historyIndex: -1
    };
    this.resetHistory('শুরু');
    this._bind();
    this.resize();
    return this.state;
  },

  /**
   * ★ ক্যানভাসের মাপ ঠিক করা — সব হিসাব CSS পিক্সেলে, বিটম্যাপ dpr গুণ বড়
   *
   * এই দুটো এক না হলে ক্লিক আর আঁকা আলাদা জায়গায় পড়ে। আগে বিটম্যাপ
   * বসানো হতো stage এর মাপে (বর্ডার সহ) আর CSS টানত canvas কে তার
   * ভেতরের মাপে — ২ পিক্সেলের ফারাক। জুম-আউটে ওটাই ছিল ২০+ ফুট ভুল।
   */
  resize(w, h) {
    const s = this.state;
    if (!s) return;
    const c = s.canvas;
    const r = c.getBoundingClientRect();
    const W = Math.max(1, Math.round(w || r.width || c.width));
    const H = Math.max(1, Math.round(h || r.height || c.height));
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    // মাপ বদলালে দেখার কেন্দ্রটা যেন এক জায়গাতেই থাকে
    s.off.x += (W - s.viewW) / 2;
    s.off.y += (H - s.viewH) / 2;
    s.viewW = W; s.viewH = H; s.dpr = dpr;
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    this.draw();
  },

  /* ---------------- ছবি ---------------- */

  setImage(img) {
    const s = this.state;
    s.img = img;
    s.hi = null;
    s.plots = []; s.draft = []; s.selected = -1;
    this.fit();
    this.resetHistory('নতুন ম্যাপ');
  },

  fit() {
    const s = this.state;
    if (!s.img) { this.draw(); return; }
    s.scale = Math.min(s.viewW / s.img.width, s.viewH / s.img.height) * 0.95;
    s.off = { x: (s.viewW - s.img.width * s.scale) / 2,
              y: (s.viewH - s.img.height * s.scale) / 2 };
    this.draw();
    if (s.onView) s.onView();
  },

  /** জুম করা অবস্থায় PDF থেকে আঁকা পরিষ্কার অংশ বসানো (null দিলে মুছে যায়) */
  setHiRes(hi) { this.state.hi = hi || null; this.draw(); },

  /** এখন ছবির কোন অংশটুকু পর্দায় দেখা যাচ্ছে — ছবির পিক্সেলে */
  visibleRect(pad) {
    const s = this.state;
    if (!s.img || !(s.scale > 0)) return null;
    const m = pad === undefined ? 0.12 : pad;
    const a = this.toImage(0, 0);
    const b = this.toImage(s.viewW, s.viewH);
    const mw = (b.x - a.x) * m, mh = (b.y - a.y) * m;
    const x = Math.max(0, Math.floor(a.x - mw));
    const y = Math.max(0, Math.floor(a.y - mh));
    const x2 = Math.min(s.img.width, Math.ceil(b.x + mw));
    const y2 = Math.min(s.img.height, Math.ceil(b.y + mh));
    if (x2 <= x || y2 <= y) return null;
    return { x, y, w: x2 - x, h: y2 - y };
  },

  setTool(t) {
    if (this.TOOLS.indexOf(t) < 0) return;
    this.state.tool = t;
    this.state.canvas.style.cursor = t === 'pan' ? 'grab' : 'crosshair';
    this.draw();
  },

  setScale(ftPerPx) { this.state.ftPerPx = Number(ftPerPx) || 0; this.draw(); },

  /* ---------------- স্থানাঙ্ক রূপান্তর ---------------- */

  toImage(cx, cy) {
    const s = this.state;
    return { x: (cx - s.off.x) / s.scale, y: (cy - s.off.y) / s.scale };
  },
  toCanvas(ix, iy) {
    const s = this.state;
    return { x: ix * s.scale + s.off.x, y: iy * s.scale + s.off.y };
  },

  zoomAt(anchor, factor) {
    const s = this.state;
    const before = this.toImage(anchor.x, anchor.y);
    s.scale = Math.max(0.02, Math.min(60, s.scale * factor));
    const after = this.toCanvas(before.x, before.y);
    s.off.x += anchor.x - after.x;
    s.off.y += anchor.y - after.y;
    this.draw();
    if (s.onView) s.onView();
  },

  zoom(d) {
    const s = this.state;
    this.zoomAt({ x: s.viewW / 2, y: s.viewH / 2 }, d > 0 ? 1.35 : 1 / 1.35);
  },

  /* ---------------- ইভেন্ট ---------------- */

  /**
   * ★ পর্দার ক্লিক → ক্যানভাসের স্থানাঙ্ক (CSS পিক্সেলে)
   * CSS ক্যানভাসকে টেনে-বড় করলেও যেন এক জায়গাই বোঝায়, তাই অনুপাত ধরা হয়।
   */
  _pos(ev) {
    const s = this.state;
    const r = s.canvas.getBoundingClientRect();
    const kx = r.width > 0 ? s.viewW / r.width : 1;
    const ky = r.height > 0 ? s.viewH / r.height : 1;
    return { x: (ev.clientX - r.left) * kx, y: (ev.clientY - r.top) * ky };
  },

  /** ক্যানভাস বিন্দুর কাছে কোনো শীর্ষবিন্দু আছে? (টেনে সরানোর জন্য) */
  hitVertex(cp, tol) {
    const s = this.state;
    const t = tol || 11;
    for (let pi = s.plots.length - 1; pi >= 0; pi--) {
      const pts = s.plots[pi].points;
      for (let i = 0; i < pts.length; i++) {
        const q = this.toCanvas(pts[i].x, pts[i].y);
        if (Math.hypot(q.x - cp.x, q.y - cp.y) <= t) return { plot: pi, index: i };
      }
    }
    return null;
  },

  /** ক্যানভাস বিন্দু কোন প্লটের ভেতরে? */
  hitPlot(cp) {
    const s = this.state;
    const ip = this.toImage(cp.x, cp.y);
    for (let i = s.plots.length - 1; i >= 0; i--) {
      if (MapMeasure.pointInPolygon(ip, s.plots[i].points)) return i;
    }
    return -1;
  },

  /**
   * ★ ট্যাপ বনাম টান — কত পিক্সেল সরলে "টানা" ধরব (CSS px)
   * আঙুল স্থির রাখলেও ২-৬ px কাঁপে। আগে পথের দৈর্ঘ্য যোগ হতো, তাই ধীরে
   * কাঁপলে যোগফল সীমা ছাড়িয়ে যেত — ট্যাপ হারিয়ে যেত আর ছবিও সরে যেত।
   * এখন শুরুর বিন্দু থেকে **সরল দূরত্ব** দেখা হয়।
   */
  TAP_SLOP: 9,

  /** বাহুর গায়ে কত কাছে ক্লিক করলে নতুন বিন্দু বসবে (CSS px) */
  EDGE_HIT: 9,

  /** আতশকাচ — ব্যাসার্ধ ও কত গুণ বড় */
  LENS_R: 62,
  LENS_ZOOM: 3.5,

  /**
   * ★ আঙুল দিয়ে আঁকার সময় এক আঙুলে ছবি সরে না
   *
   * পর্দায় আঙুলের ডগা ~৪৫px চওড়া, অথচ নকশা জুম-আউটে ১px = ১২ ফুট।
   * তাই "চেপে ধরো → আতশকাচে দেখে জায়গা ঠিক করো → ছাড়ো" — এই পথই
   * নির্ভুল। সরানো-জুম দুই আঙুলে। মাউসে পুরনো নিয়মই থাকে।
   */
  _touchDraws(s) {
    return s.touch && (s.calib || s.tool === 'draw');
  },

  _bind() {
    const s = this.state, c = s.canvas;
    if (c._mcBound) return;
    c._mcBound = true;

    const down = ev => {
      const p = this._pos(ev);
      s.start = p;
      s.panning = false;
      s.gesture = true;
      if (s.tool === 'point') {
        const hit = this.hitVertex(p);
        if (hit) {
          s.dragPt = hit; s.picked = hit; s.lens = p;
          this.draw();
          if (s.onSelect) s.onSelect(s.selected);   // মোছার বোতাম সচল হবে
          return;
        }
      }
      s.drag = p;
      if (this._touchDraws(s)) { s.lens = p; this.draw(); }
      if (s.tool === 'pan') { s.panning = true; c.style.cursor = 'grabbing'; }
    };

    const move = ev => {
      const p = this._pos(ev);
      if (s.dragPt) {                       // শীর্ষবিন্দু টানা
        const ip = this.toImage(p.x, p.y);
        s.plots[s.dragPt.plot].points[s.dragPt.index] = ip;
        s.lens = p;
        this.draw(); this._changed();
        if (ev.cancelable) ev.preventDefault();
        return;
      }
      if (!s.drag) return;
      // আঙুলে আঁকার সময় ছবি নড়বে না — কেবল আতশকাচ সরে
      if (this._touchDraws(s)) {
        s.lens = p; s.drag = p;
        this.draw();
        if (ev.cancelable) ev.preventDefault();
        return;
      }
      // আঁকা/নির্বাচনের টুলে সীমা পেরোনোর আগে ছবি নড়বে না
      if (!s.panning) {
        if (Math.hypot(p.x - s.start.x, p.y - s.start.y) <= this.TAP_SLOP) return;
        s.panning = true;
        s.drag = p;                         // এতক্ষণের কাঁপুনি বাদ
        return;
      }
      const dx = p.x - s.drag.x, dy = p.y - s.drag.y;
      s.off.x += dx; s.off.y += dy;
      s.drag = p;
      this.draw();
      if (ev.cancelable) ev.preventDefault();
    };

    const up = ev => {
      // ইশারা ক্যানভাসের বাইরে শুরু হলে (mouseup window এ বাঁধা) কিছুই করব না
      if (!s.gesture) {
        s.dragPt = null; s.drag = null; s.panning = false; s.lens = null;
        return;
      }
      const p0 = this._pos(ev);
      // আঙুলে আঁকার সময় সরানোটাই স্বাভাবিক — যেখানে ছাড়লেন সেখানেই বিন্দু
      const wasDrag = this._touchDraws(s) ? false
        : (!s.start || Math.hypot(p0.x - s.start.x, p0.y - s.start.y) > this.TAP_SLOP);
      const hadPt = !!s.dragPt;
      s.dragPt = null; s.drag = null; s.panning = false; s.gesture = false;
      s.lens = null;
      if (s.tool === 'pan') c.style.cursor = 'grab';
      // টান শেষ হলে নতুন এলাকা দেখা যাচ্ছে — hi-res আবার চাই
      if (wasDrag && s.onView) s.onView();
      if (wasDrag || hadPt) {
        this.draw();
        if (hadPt) this.commitHistory('কোণা সরানো');
        return;
      }

      const p = p0;

      if (s.calib) {                        // স্কেল ক্যালিব্রেশন চলছে
        s.calib.pts.push(this.toImage(p.x, p.y));
        this.draw();
        if (s.calib.pts.length >= 2) {
          const cb = s.calib.cb, pts = s.calib.pts;
          s.calib = null;
          this.setTool('pan');
          if (cb) cb(pts[0], pts[1]);
        } else if (s.calib && s.calib.onStep) {
          s.calib.onStep(s.calib.pts.length);
        }
        if (s.onChange) s.onChange();
        return;
      }

      if (s.tool === 'draw' && s.img) {
        const ip = this.toImage(p.x, p.y);
        // প্রথম বিন্দুর কাছে ক্লিক করলে প্লট বন্ধ
        if (s.draft.length >= 3) {
          const f = this.toCanvas(s.draft[0].x, s.draft[0].y);
          if (Math.hypot(f.x - p.x, f.y - p.y) <= 14) { this.closePlot(); return; }
        }
        s.draft.push(ip);
        this.draw(); this._changed(); this.commitHistory('পয়েন্ট বসানো');
      } else if (s.tool === 'select') {
        s.selected = this.hitPlot(p);
        this.draw();
        if (s.onSelect) s.onSelect(s.selected);
      } else if (s.tool === 'point') {
        // বাহুর মাঝে ক্লিক করলে নতুন বিন্দু যোগ
        const added = this._insertOnEdge(p);
        if (added) { this.draw(); this._changed(); this.commitHistory('কোণা যোগ'); }
      }
    };

    /* ---------- দুই আঙুলের ইশারা — চিমটিতে জুম, একসাথে সরানো ---------- */

    const twoPts = t => [this._pos(t[0]), this._pos(t[1])];
    const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const pinchStart = e => {
      const [a, b] = twoPts(e.touches);
      s.pinch = { d0: Math.max(1, gap(a, b)), c0: mid(a, b), scale0: s.scale };
      // চিমটি শুরু হলে এক আঙুলের হিসাব বাতিল — নইলে ছেড়ে দিলে বিন্দু পড়ত
      s.gesture = false; s.drag = null; s.dragPt = null; s.panning = false;
    };

    const pinchMove = e => {
      if (!s.pinch) return;
      const [a, b] = twoPts(e.touches);
      const cNow = mid(a, b);
      // ১. আঙুলের ফাঁক যত বেড়েছে তত জুম — মাঝবিন্দু ধরে
      const f = Math.max(1, gap(a, b)) / s.pinch.d0;
      const want = Math.max(0.02, Math.min(60, s.pinch.scale0 * f));
      const before = this.toImage(s.pinch.c0.x, s.pinch.c0.y);
      s.scale = want;
      const after = this.toCanvas(before.x, before.y);
      s.off.x += s.pinch.c0.x - after.x;
      s.off.y += s.pinch.c0.y - after.y;
      // ২. মাঝবিন্দু যতটা সরেছে ছবিও ততটা
      s.off.x += cNow.x - s.pinch.c0.x;
      s.off.y += cNow.y - s.pinch.c0.y;
      s.pinch.c0 = cNow;
      this.draw();
      if (s.onView) s.onView();
      if (e.cancelable) e.preventDefault();
    };

    c.addEventListener('mousedown', ev => { s.touch = false; down(ev); });
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);

    c.addEventListener('touchstart', e => {
      s.touch = true;
      if (e.touches.length >= 2) { pinchStart(e); return; }
      down(e.touches[0]);
    }, { passive: true });

    c.addEventListener('touchmove', e => {
      if (e.touches.length >= 2) { pinchMove(e); return; }
      if (s.pinch) { if (e.cancelable) e.preventDefault(); return; }  // আঙুল উঠছে
      move(e.touches[0]);
    }, { passive: false });

    c.addEventListener('touchend', e => {
      if (s.pinch) {
        // সব আঙুল না ওঠা পর্যন্ত চিমটির অবস্থাই থাকুক — বিন্দু পড়বে না
        if (e.touches.length === 0) { s.pinch = null; if (s.onView) s.onView(); }
        else if (e.touches.length >= 2) pinchStart(e);
        return;
      }
      up(e.changedTouches[0]);
    });
    c.addEventListener('touchcancel', () => {
      s.pinch = null; s.gesture = false; s.drag = null; s.dragPt = null;
      s.panning = false; s.lens = null; this.draw();
    });

    c.addEventListener('dblclick', ev => {
      if (s.tool === 'draw') { this.closePlot(); return; }
      // পয়েন্ট টুলে শীর্ষবিন্দুতে ডাবল-ক্লিক = মুছে ফেলা
      if (s.tool === 'point') {
        const h = this.hitVertex(this._pos(ev));
        if (h) this.deleteVertex(h.plot, h.index);
      }
    });
    c.addEventListener('wheel', ev => {
      ev.preventDefault();
      this.zoomAt(this._pos(ev), ev.deltaY < 0 ? 1.18 : 1 / 1.18);
    }, { passive: false });
  },

  /**
   * শীর্ষবিন্দু মুছে ফেলা — ৩ এর নিচে নামতে দেওয়া হয় না
   * @returns {boolean} মুছতে পারলে true
   */
  deleteVertex(plotIndex, index) {
    const s = this.state;
    const p = s.plots[plotIndex];
    if (!p || index < 0 || index >= p.points.length) return false;
    if (p.points.length <= 3) return false;      // ত্রিভুজই সবচেয়ে ছোট প্লট
    p.points.splice(index, 1);
    s.picked = null;
    this.draw(); this._changed(); this.commitHistory('কোণা মোছা');
    return true;
  },

  /**
   * বাহুর উপর ক্লিক করলে সেখানে নতুন শীর্ষবিন্দু বসায়
   *
   * ★ ক্রম গুরুত্বপূর্ণ — নির্বাচিত প্লট আগে, তারপর উপর থেকে নিচে।
   *   `hitVertex` উপর থেকে খোঁজে; এখানে নিচ থেকে খুঁজলে দুই প্লট এক
   *   জায়গায় থাকলে বিন্দু ভুল প্লটে বসত।
   */
  _insertOnEdge(cp) {
    const s = this.state;
    const order = [];
    if (s.selected >= 0 && s.selected < s.plots.length) order.push(s.selected);
    for (let i = s.plots.length - 1; i >= 0; i--) if (i !== s.selected) order.push(i);
    for (let oi = 0; oi < order.length; oi++) {
      const pi = order[oi];
      const pts = s.plots[pi].points;
      for (let i = 0; i < pts.length; i++) {
        const a = this.toCanvas(pts[i].x, pts[i].y);
        const b = this.toCanvas(pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y);
        const d = this._distToSeg(cp, a, b);
        if (d <= this.EDGE_HIT) {
          pts.splice(i + 1, 0, this.toImage(cp.x, cp.y));
          return true;
        }
      }
    }
    return false;
  },

  _distToSeg(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const L = vx * vx + vy * vy;
    if (L === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / L;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
  },

  _changed() { if (this.state.onChange) this.state.onChange(); },

  /* ---------------- ইতিহাস (Undo / Redo) ---------------- */

  _historySnapshot() {
    const s = this.state;
    return JSON.stringify({
      plots: s.plots.map(p => ({ id: p.id, dag: p.dag || '', name: p.name || '',
        points: p.points.map(q => ({ x: q.x, y: q.y })), closed: !!p.closed })),
      draft: s.draft.map(q => ({ x: q.x, y: q.y })),
      selected: s.selected,
      ftPerPx: s.ftPerPx,
      division: s.division || null
    });
  },

  _historyChanged() { if (this.state.onHistory) this.state.onHistory(this.historyInfo()); },

  resetHistory(label) {
    const s = this.state;
    if (!s) return;
    s.history = [{ label: label || 'শুরু', state: this._historySnapshot() }];
    s.historyIndex = 0;
    this._historyChanged();
  },

  commitHistory(label) {
    const s = this.state;
    if (!s) return;
    const snap = this._historySnapshot();
    const cur = s.history[s.historyIndex];
    if (cur && cur.state === snap) return;
    s.history = s.history.slice(0, s.historyIndex + 1);
    s.history.push({ label: label || 'পরিবর্তন', state: snap });
    if (s.history.length > 60) s.history.shift();
    s.historyIndex = s.history.length - 1;
    this._historyChanged();
  },

  historyInfo() {
    const s = this.state;
    if (!s) return { canUndo: false, canRedo: false, index: -1, items: [] };
    return {
      canUndo: s.historyIndex > 0,
      canRedo: s.historyIndex >= 0 && s.historyIndex < s.history.length - 1,
      index: s.historyIndex,
      items: s.history.map((h, i) => ({ label: h.label, current: i === s.historyIndex }))
    };
  },

  restoreHistory(index) {
    const s = this.state, h = s && s.history[index];
    if (!h) return false;
    const v = JSON.parse(h.state);
    s.plots = v.plots || []; s.draft = v.draft || [];
    s.selected = Math.min(Math.max(-1, Number(v.selected) || -1), s.plots.length - 1);
    s.ftPerPx = Number(v.ftPerPx) || 0; s.division = v.division || null;
    s.picked = null; s.historyIndex = index;
    this.draw();
    if (s.onRestore) s.onRestore({ ftPerPx: s.ftPerPx, division: s.division });
    this._changed();
    this._historyChanged();
    return true;
  },

  undoHistory() { return this.restoreHistory(this.state.historyIndex - 1); },
  redoHistory() { return this.restoreHistory(this.state.historyIndex + 1); },

  /* ---------------- প্লট ---------------- */

  /** চলতি আঁকা শেষ করে প্লট বানানো */
  closePlot() {
    const s = this.state;
    // ডবল-ট্যাপে একই জায়গায় দুবার বসা বিন্দু আগে ঝেড়ে ফেলি
    const pts = MapMeasure.cleanPoints(s.draft, 0.5 / Math.max(s.scale, 1e-6));
    if (pts.length < 3) return { ok: false, msg: 'একটি প্লটে কমপক্ষে ৩টি পয়েন্ট দরকার' };
    // ★ নিজেকে কেটে গেলে ক্ষেত্রফল নীরবে ভুল হয় — আগেই আটকাই
    const bad = MapMeasure.selfIntersects(pts);
    if (bad) {
      const bn = v => (typeof toBn === 'function' ? toBn(v) : String(v));
      return { ok: false, selfCross: bad,
        msg: 'প্লটের ' + bn(bad.i + 1) + ' নং আর ' + bn(bad.j + 1)
           + ' নং বাহু একে অপরকে কেটেছে। এমন হলে ক্ষেত্রফল ভুল আসে — '
           + 'কোণাগুলো একই দিকে ঘুরে (ঘড়ির কাঁটার দিকে বা উল্টো) বসান।' };
    }
    const id = s.plots.length + 1;
    s.plots.push({ id, dag: '', name: 'প্লট ' + (typeof toBn === 'function' ? toBn(id) : id),
                   points: pts, closed: true });
    s.draft = [];
    s.selected = s.plots.length - 1;
    this.draw(); this._changed(); this.commitHistory('প্লট সম্পন্ন');
    return { ok: true, index: s.selected };
  },

  cancelDraft() {
    if (!this.state.draft.length) return;
    this.state.draft = []; this.draw(); this._changed(); this.commitHistory('খসড়া বাতিল');
  },

  /** স্কেল ক্যালিব্রেশন শুরু — দুটি ক্লিক নিয়ে cb(p1, p2) ডাকে */
  startCalibrate(cb, onStep) {
    const s = this.state;
    s.calib = { pts: [], cb, onStep };
    s.tool = 'calib';
    s.canvas.style.cursor = 'crosshair';
    this.draw();
  },

  cancelCalibrate() {
    this.state.calib = null;
    this.setTool('pan');
  },

  /** ভাগবণ্টনের ফল বসানো (null দিলে মুছে যায়) */
  setDivision(res) { this.state.division = res; this.draw(); },

  DIV_COLORS: ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'],

  undoDraftPoint() {
    const s = this.state;
    if (s.draft.length) {
      s.draft.pop(); this.draw(); this._changed(); this.commitHistory('শেষ পয়েন্ট মোছা'); return true;
    }
    return false;
  },

  deletePlot(i) {
    const s = this.state;
    if (i < 0 || i >= s.plots.length) return;
    s.plots.splice(i, 1);
    if (s.selected >= s.plots.length) s.selected = s.plots.length - 1;
    this.draw(); this._changed(); this.commitHistory('প্লট মোছা');
  },

  clearAll() {
    const s = this.state;
    s.plots = []; s.draft = []; s.selected = -1;
    this.draw(); this._changed(); this.commitHistory('সব প্লট মোছা');
  },

  /* ---------------- আঁকা ---------------- */

  draw() {
    const s = this.state;
    if (!s) return;
    const ctx = s.ctx, W = s.viewW, H = s.viewH;

    // ★ বিটম্যাপ dpr গুণ বড়, তাই একবারই স্কেল বসিয়ে নিই —
    //   এর পরের সব আঁকা CSS পিক্সেলে, ক্লিকের হিসাবের সাথে হুবহু মিলবে
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // পটভূমি — গ্রাফ কাগজের মতো
    ctx.fillStyle = '#eef2f7';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(100,116,139,0.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 28) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 28) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }

    if (s.img) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(s.img, s.off.x, s.off.y,
                    s.img.width * s.scale, s.img.height * s.scale);
      // ★ জুম করলে PDF থেকে নতুন করে আঁকা পরিষ্কার অংশটুকু উপরে বসে
      if (s.hi) {
        const a = this.toCanvas(s.hi.x, s.hi.y);
        ctx.drawImage(s.hi.canvas, a.x, a.y,
                      s.hi.w * s.scale, s.hi.h * s.scale);
      }
    }

    s.plots.forEach((p, i) => this._drawPlot(p, i === s.selected, false));
    if (s.division) this._drawDivision();
    if (s.draft.length) this._drawDraft();
    if (s.calib) this._drawCalib();
    if (s.picked) this._drawPicked();
    if (s.lens) this._drawLens();
  },

  /**
   * ★ প্লটটি নিজেকে কেটেছে? — ফল ক্যাশে রাখা হয়
   *
   * প্রতি ফ্রেমে O(n²) চালানোর দরকার নেই; বিন্দু বদলালে তবেই আবার কষে।
   */
  plotBroken(plot) {
    if (!plot || !plot.points || plot.points.length < 4) return null;
    const key = plot.points.length + ':' +
      plot.points.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(';');
    if (plot._xKey !== key) {
      plot._xKey = key;
      plot._xBad = MapMeasure.selfIntersects(plot.points);
    }
    return plot._xBad;
  },

  /** পয়েন্ট টুলে বাছাই করা শীর্ষবিন্দু — মোছা যায় বোঝাতে */
  _drawPicked() {
    const s = this.state, ctx = s.ctx;
    const p = s.plots[s.picked.plot];
    if (!p || !p.points[s.picked.index]) { s.picked = null; return; }
    const q = this.toCanvas(p.points[s.picked.index].x, p.points[s.picked.index].y);
    ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, Math.PI * 2);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.stroke();
  },

  /**
   * ★ আতশকাচ — আঙুলের নিচে যা ঢাকা পড়ে তা কোণে বড় করে দেখায়
   *
   * কৌশল: `scale`/`off` সাময়িকভাবে বদলে দিই, তাই `toCanvas` ব্যবহার করা
   * সব আঁকার কোড কোনো বদল ছাড়াই বড় হয়ে বসে। শেষে আগেরটা ফিরিয়ে দিই।
   */
  _drawLens() {
    const s = this.state, ctx = s.ctx;
    const R = this.LENS_R;
    if (s.viewW < R * 2 + 40 || s.viewH < R * 2 + 40) return;
    // আঙুল যে পাশে, আতশকাচ তার উল্টো পাশে
    const cx = s.lens.x < s.viewW / 2 ? s.viewW - R - 14 : R + 14;
    const cy = s.lens.y < s.viewH / 2 ? s.viewH - R - 14 : R + 14;

    const ip = this.toImage(s.lens.x, s.lens.y);
    const sc0 = s.scale, off0 = { x: s.off.x, y: s.off.y };

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    s.scale = sc0 * this.LENS_ZOOM;
    s.off.x = cx - ip.x * s.scale;
    s.off.y = cy - ip.y * s.scale;
    if (s.img) {
      ctx.imageSmoothingEnabled = false;   // দাগ যেন গুলিয়ে না যায়
      ctx.drawImage(s.img, s.off.x, s.off.y,
                    s.img.width * s.scale, s.img.height * s.scale);
      ctx.imageSmoothingEnabled = true;
    }
    this._lensOutlines();
    s.scale = sc0; s.off = off0;
    ctx.restore();

    // বেড়া ও ঠিক মাঝখানে ক্রসহেয়ার
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(15,23,42,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy); ctx.lineTo(cx + 11, cy);
    ctx.moveTo(cx, cy - 11); ctx.lineTo(cx, cy + 11);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#ef4444'; ctx.stroke();
  },

  /** আতশকাচের ভেতরে কেবল রেখা — লেবেল দিলে ভিড় হয়ে যেত */
  _lensOutlines() {
    const s = this.state, ctx = s.ctx;
    const line = (pts, closed, color) => {
      if (!pts.length) return;
      ctx.beginPath();
      pts.forEach((q, i) => {
        const t = this.toCanvas(q.x, q.y);
        i ? ctx.lineTo(t.x, t.y) : ctx.moveTo(t.x, t.y);
      });
      if (closed) ctx.closePath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      pts.forEach(q => {
        const t = this.toCanvas(q.x, q.y);
        ctx.beginPath(); ctx.arc(t.x, t.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
      });
    };
    s.plots.forEach((p, i) => line(p.points, true,
      i === s.selected ? '#1d4ed8' : 'rgba(29,78,216,0.55)'));
    line(s.draft, false, '#059669');
    if (s.calib && s.calib.pts.length) line(s.calib.pts, false, '#7c3aed');
  },

  /** ভাগবণ্টনের অংশগুলো — প্রতিটি আলাদা রঙে, ভেতরে নাম ও শতক */
  _drawDivision() {
    const s = this.state, ctx = s.ctx;
    const all = s.division.parts.slice();
    if (s.division.leftover) all.push(s.division.leftover);

    all.forEach((part, i) => {
      const pts = part.polygon;
      if (!pts || pts.length < 3) return;
      const isLeft = part.name === 'অবশিষ্ট';
      const col = isLeft ? '#94a3b8' : this.DIV_COLORS[i % this.DIV_COLORS.length];
      const cps = pts.map(q => this.toCanvas(q.x, q.y));

      ctx.beginPath();
      cps.forEach((q, j) => j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
      ctx.closePath();
      ctx.fillStyle = col + (isLeft ? '44' : '66');
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      if (isLeft) ctx.setLineDash([7, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // লেবেল
      const cen = MapMeasure.centroid(pts);
      const q = this.toCanvas(cen.x, cen.y);
      const bn = v => (typeof toBn === 'function' ? toBn(v) : String(v));
      const lines = [part.name || '', bn(part.satak.toFixed(2)) + ' শতক'];
      ctx.font = '700 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = Math.max(...lines.map(t => ctx.measureText(t).width)) + 14;
      const h = lines.length * 16 + 6;
      ctx.fillStyle = 'rgba(255,255,255,0.93)';
      ctx.fillRect(q.x - w / 2, q.y - h / 2, w, h);
      ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.strokeRect(q.x - w / 2, q.y - h / 2, w, h);
      lines.forEach((t, j) => {
        ctx.fillStyle = j === 0 ? '#0f172a' : col;
        ctx.fillText(t, q.x, q.y - h / 2 + 11 + j * 16);
      });
    });
  },

  /** ক্যালিব্রেশনের দণ্ড — বেগুনি, ওদের বোতামের রঙের সাথে মিলিয়ে */
  _drawCalib() {
    const s = this.state, ctx = s.ctx;
    const cps = s.calib.pts.map(p => this.toCanvas(p.x, p.y));
    ctx.save();
    cps.forEach((q, i) => {
      ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#7c3aed'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), q.x, q.y + 0.5);
    });
    if (cps.length === 2) {
      ctx.beginPath(); ctx.moveTo(cps[0].x, cps[0].y); ctx.lineTo(cps[1].x, cps[1].y);
      ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  },

  _drawPlot(plot, isSel, isDraft) {
    const s = this.state, ctx = s.ctx;
    const pts = plot.points;
    if (pts.length < 2) return;
    const cps = pts.map(p => this.toCanvas(p.x, p.y));

    // ★ কোণা টেনে সরালেও প্লট নিজেকে কেটে ফেলতে পারে — তখন লাল
    const bad = this.plotBroken(plot);

    ctx.beginPath();
    cps.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
    ctx.closePath();
    ctx.fillStyle = bad ? 'rgba(239,68,68,0.22)'
      : (isSel ? 'rgba(59,130,246,0.30)' : 'rgba(59,130,246,0.18)');
    ctx.fill();
    ctx.strokeStyle = bad ? '#dc2626' : (isSel ? '#1d4ed8' : '#3b82f6');
    ctx.lineWidth = isSel ? 3 : 2;
    if (bad) ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // শীর্ষবিন্দু
    cps.forEach(q => {
      ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = bad ? '#dc2626' : '#1d4ed8'; ctx.lineWidth = 2; ctx.stroke();
    });

    if (bad) {
      const cen = MapMeasure.centroid(pts);
      const q = this.toCanvas(cen.x, cen.y);
      ctx.font = '700 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const t = '⚠ বাহু কাটাকাটি — মাপ ভুল';
      const w = ctx.measureText(t).width + 14;
      ctx.fillStyle = 'rgba(254,242,242,0.96)';
      ctx.fillRect(q.x - w / 2, q.y - 11, w, 22);
      ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 1.5;
      ctx.strokeRect(q.x - w / 2, q.y - 11, w, 22);
      ctx.fillStyle = '#b91c1c';
      ctx.fillText(t, q.x, q.y);
      return;                       // ভুল মাপ দেখানোর চেয়ে না দেখানো ভালো
    }

    if (s.ftPerPx > 0) {
      this._edgeLabels(pts, cps);
      this._areaLabel(plot, pts);
    }
  },

  _drawDraft() {
    const s = this.state, ctx = s.ctx;
    const cps = s.draft.map(p => this.toCanvas(p.x, p.y));
    ctx.beginPath();
    cps.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
    if (cps.length >= 3) {
      ctx.closePath();
      ctx.fillStyle = 'rgba(16,185,129,0.16)'; ctx.fill();
    }
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);

    cps.forEach((q, i) => {
      ctx.beginPath(); ctx.arc(q.x, q.y, i === 0 ? 6.5 : 4.5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#10b981' : '#fff'; ctx.fill();
      ctx.strokeStyle = '#059669'; ctx.lineWidth = 2; ctx.stroke();
    });

    if (s.ftPerPx > 0 && s.draft.length >= 2) {
      this._edgeLabels(s.draft, cps, false);
    }
  },

  /** বাহুর লেবেলের একক বদলানো — ftin · ft · link · chain · meter */
  setLabelUnit(u) {
    const ok = MapMeasure.LABEL_UNITS.some(x => x.id === u);
    this.state.labelUnit = ok ? u : 'ftin';
    this.draw();
    return this.state.labelUnit;
  },

  /** বাহুতে লেবেল বসানোর সবচেয়ে ছোট দৈর্ঘ্য (CSS px) */
  MIN_LABEL_PX: 18,

  /**
   * বাহুর মাপ — ডিফল্ট ৬০'১" ধাঁচে, একক বদলানো যায়
   *
   * ★ আগে ৩৪px এর ছোট বাহুতে কিছুই দেখাত না। ফিট-জুমে ৩৫০ ফুটের বাহুও
   *   ৩০px হয়, ফলে প্লট এঁকে ইউজার কোনো মাপই দেখতেন না। এখন জায়গা কম
   *   হলে লেখা ছোট হয়, তাতেও না ধরলে সংক্ষিপ্ত রূপ (ইঞ্চি বাদ) বসে।
   */
  _edgeLabels(pts, cps, closed) {
    const s = this.state, ctx = s.ctx;
    const n = closed === false ? pts.length - 1 : pts.length;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const a = cps[i], b = cps[(i + 1) % cps.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < this.MIN_LABEL_PX) continue;
      const ft = MapMeasure.dist(pts[i], pts[(i + 1) % pts.length]) * s.ftPerPx;

      // বড় লেখা → ছোট লেখা → সংক্ষিপ্ত রূপ, যেটা আগে বাহুতে ধরে
      let txt = '', fs = 11;
      const full = MapMeasure.formatLength(ft, s.labelUnit);
      const short = s.labelUnit === 'ftin'
        ? MapMeasure.formatLength(ft, 'ft') : full;
      const tries = [[full, 11], [full, 9.5], [short, 9.5]];
      for (let t = 0; t < tries.length; t++) {
        ctx.font = '600 ' + tries[t][1] + 'px sans-serif';
        if (ctx.measureText(tries[t][0]).width + 8 <= len || t === tries.length - 1) {
          txt = tries[t][0]; fs = tries[t][1];
          break;
        }
      }
      ctx.font = '600 ' + fs + 'px sans-serif';
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const w = ctx.measureText(txt).width + 8;
      const h = fs + 7;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(mx - w / 2, my - h / 2, w, h);
      ctx.strokeStyle = 'rgba(29,78,216,0.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(mx - w / 2, my - h / 2, w, h);
      ctx.fillStyle = '#1e293b';
      ctx.fillText(txt, mx, my);
    }
  },

  /** প্লটের ভেতরে লাল ক্ষেত্রফল — ওদের মতো */
  _areaLabel(plot, pts) {
    const s = this.state, ctx = s.ctx;
    if (pts.length < 3) return;
    const cen = MapMeasure.centroid(pts);
    const q = this.toCanvas(cen.x, cen.y);
    const sqft = MapMeasure.areaPx(pts) * s.ftPerPx * s.ftPerPx;
    const u = MapMeasure.units(sqft);
    const bn = v => (typeof toBn === 'function' ? toBn(v) : String(v));
    const lines = [bn(u.satak.toFixed(2)) + ' শতক'];
    if (plot.dag) lines.unshift('দাগ ' + plot.dag);

    ctx.font = '700 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.max(...lines.map(t => ctx.measureText(t).width)) + 12;
    const h = lines.length * 17 + 6;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(q.x - w / 2, q.y - h / 2, w, h);
    lines.forEach((t, i) => {
      ctx.fillStyle = i === lines.length - 1 ? '#dc2626' : '#1e293b';
      ctx.fillText(t, q.x, q.y - h / 2 + 11 + i * 17);
    });
  },

  /* ---------------- হিসাব ---------------- */

  /** চলতি (নির্বাচিত বা শেষ) প্লটের ক্ষেত্রফল ও মোট */
  stats() {
    const s = this.state;
    const cur = s.draft.length >= 3 ? { points: s.draft }
              : (s.selected >= 0 ? s.plots[s.selected] : s.plots[s.plots.length - 1]);
    // নিজেকে কাটা প্লটের মাপ মোটে বিশ্বাসযোগ্য নয় — মোট থেকেও বাদ
    const good = s.plots.filter(p => !this.plotBroken(p));
    return {
      current: cur ? MapMeasure.measure(cur, s.ftPerPx) : MapMeasure.units(0),
      totals: MapMeasure.totals(good, s.ftPerPx),
      drafting: s.draft.length,
      broken: s.plots.length - good.length
    };
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = MeasureCanvas;
