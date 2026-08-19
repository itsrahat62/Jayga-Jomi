/* ==========================================================================
   cad-view.js — ডিজিটাল সার্ভে ক্যানভাস (আঁকা · সম্পাদনা · মাপ)
   --------------------------------------------------------------------------
   একটি ক্যানভাসেই সব: নিচে স্ক্যান করা নকশা (আন্ডারলে), তার উপর ভেক্টর
   দাগ, বাহুর মাপ, দাগ নম্বর ও ক্ষেত্রফল।

   ★ লেখা কেন পর্দার মাপে আঁকা হয়
     জুম করলে দাগ বড় হয়, কিন্তু লেখা বড় হওয়া উচিত নয় — নইলে জুম-আউটে
     লেখা মিলিয়ে যায়, জুম-ইনে পর্দা ঢেকে ফেলে। AutoCAD এর annotative
     text ও এভাবেই কাজ করে। তাই বহুভুজ আঁকা হয় রূপান্তরিত স্থানাঙ্কে,
     আর লেখা আঁকা হয় পর্দার স্থানাঙ্কে।

   ★ টুল
     pan · pen (দাগ আঁকা) · wand (এক ক্লিকে দাগ) · edit (কোণা সরানো)
     select · scale (স্কেল বসানো) · gcp (ভূ-বিন্দু) · split (দাগ ভাগ)
   ========================================================================== */

const CadView = {

  state: null,

  /* ==================== চালু করা ==================== */

  init(canvas, opts) {
    const o = opts || {};
    this.state = {
      canvas,
      ctx: canvas.getContext('2d'),
      doc: o.doc || CadCore.newDoc(),

      /* আন্ডারলে — একাধিক নকশা (পেন্টাগ্রাফে দুটি) */
      rasters: [],                 // { img, opacity, visible, name, tint }

      scale: 1,
      off: { x: 0, y: 0 },

      tool: 'pan',
      activeLayer: 'dag',
      multiSelect: false,          // চালু থাকলে সাধারণ ক্লিকেই একাধিক জমা হয়

      draft: [],                   // pen দিয়ে আঁকা চলতি বহুভুজ
      selection: [],               // নির্বাচিত ফিচারের id
      hoverFeature: null,
      dragVertex: null,            // { group:[{f,i}], moved }
      dragEdge: null,              // { groupA, groupB, start, ip0, hit, moved }
      vertexSel: null,             // নির্বাচিত কোণা — Delete চাপলে মুছবে
      dragFeature: null,
      rubber: null,                // ঘের টেনে একসাথে নির্বাচন
      panning: null,
      snapHint: null,
      scalePts: [],                // স্কেল বসানোর দুই বিন্দু
      splitPts: [],

      show: {
        dims: true, dagNo: true, area: true, angles: false,
        vertices: true, raster: true, fill: true, grid: false, notes: true
      },

      shiftKey: false,
      traceCache: {},

      onChange: o.onChange || null,
      onStatus: o.onStatus || null,
      onScaleAsk: o.onScaleAsk || null,
      onGcp: o.onGcp || null
    };
    this._bind();
    this.draw();
    return this.state;
  },

  doc() { return this.state.doc; },

  setDoc(doc) {
    this.state.doc = doc;
    this.state.selection = [];
    this.state.draft = [];
    // নতুন নকশা এলে পুরোনো নকশার ধাপগুলো আর প্রযোজ্য নয়
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._syncHistoryBtns();
    this.draw();
    this._changed();
  },

  _changed() {
    const s = this.state;
    if (s.onChange) s.onChange(s.doc);
  },

  _status(msg) {
    const s = this.state;
    if (s.onStatus) s.onStatus(msg);
  },

  /* ==================== আন্ডারলে ==================== */

  addRaster(img, name, opt) {
    const o = opt || {};
    this.state.rasters.push({
      img, name: name || ('নকশা ' + (this.state.rasters.length + 1)),
      opacity: o.opacity == null ? 0.55 : o.opacity,
      visible: true,
      offset: { x: 0, y: 0 },
      scale: 1,
      rotation: 0
    });
    if (this.state.rasters.length === 1) this.fit();
    this.draw();
  },

  removeRaster(i) {
    this.state.rasters.splice(i, 1);
    this.draw();
  },

  /* ==================== জুম ও প্যান ==================== */

  fit() {
    const s = this.state, c = s.canvas;
    let w = 0, h = 0;
    for (const r of s.rasters) { w = Math.max(w, r.img.width); h = Math.max(h, r.img.height); }
    if (!w || !h) {
      const bb = CadCore.bboxAll(s.doc.features.map(f => f.pts));
      if (bb.w > 0) {
        s.scale = Math.min(c.width / bb.w, c.height / bb.h) * 0.85;
        s.off = { x: c.width / 2 - (bb.x + bb.w / 2) * s.scale,
                  y: c.height / 2 - (bb.y + bb.h / 2) * s.scale };
        this.draw();
      }
      return;
    }
    s.scale = Math.min(c.width / w, c.height / h) * 0.94;
    s.off = { x: (c.width - w * s.scale) / 2, y: (c.height - h * s.scale) / 2 };
    this.draw();
  },

  /** নির্বাচিত দাগ পর্দায় ভরে দেখানো */
  zoomTo(pts, pad) {
    const s = this.state, c = s.canvas;
    const bb = CadCore.bbox(pts);
    if (!(bb.w > 0) && !(bb.h > 0)) return;
    const p = pad == null ? 0.6 : pad;
    s.scale = Math.min(c.width / (bb.w || 1), c.height / (bb.h || 1)) * p;
    s.off = { x: c.width / 2 - (bb.x + bb.w / 2) * s.scale,
              y: c.height / 2 - (bb.y + bb.h / 2) * s.scale };
    this.draw();
  },

  toScreen(p) {
    const s = this.state;
    return { x: p.x * s.scale + s.off.x, y: p.y * s.scale + s.off.y };
  },

  toImage(p) {
    const s = this.state;
    return { x: (p.x - s.off.x) / s.scale, y: (p.y - s.off.y) / s.scale };
  },

  zoomAt(anchor, factor) {
    const s = this.state;
    const before = this.toImage(anchor);
    s.scale = Math.max(0.01, Math.min(80, s.scale * factor));
    const after = this.toScreen(before);
    s.off.x += anchor.x - after.x;
    s.off.y += anchor.y - after.y;
    this.draw();
  },

  /* ==================== টুল ==================== */

  setTool(t) {
    const s = this.state;
    if (s.tool === 'pen' && t !== 'pen') this.cancelDraft();
    s.tool = t;
    s.scalePts = []; s.splitPts = [];
    s.canvas.style.cursor = (t === 'pan') ? 'grab'
      : (t === 'select' || t === 'edit') ? 'default' : 'crosshair';
    this._status(this.TOOL_HINT[t] || '');
    this.draw();
  },

  TOOL_HINT: {
    pan:    'ড্র্যাগ করে সরান · চাকা ঘুরিয়ে জুম',
    pen:    'দাগের কোণায় ক্লিক করুন · শেষ করতে প্রথম কোণায় ক্লিক বা Enter · Shift ধরলে কোণ আটকাবে',
    wand:   'দাগের ভেতরে ক্লিক করুন — নিজে থেকেই বহুভুজ হবে',
    edit:   'কোণা ধরে টানুন — পাশের দাগের সীমানাও সাথে সরবে · রেখা ধরে টানলে পুরো রেখা সরবে · রেখায় ক্লিক করলে নতুন কোণা · Delete দিলে বাছা কোণা মুছবে',
    select: 'দাগে ক্লিক করে নির্বাচন · ফাঁকা জায়গা থেকে ঘের টেনে একসাথে অনেকগুলো · Shift ধরে যোগ · Delete দিয়ে মুছুন',
    scale:  'চেনা দূরত্বের দুই প্রান্তে ক্লিক করুন, তারপর মাপ লিখুন',
    gcp:    'নকশায় চেনা জায়গায় ক্লিক করুন — পরে স্যাটেলাইটে একই জায়গা দেখাবেন',
    split:  'দাগ ভাগ করতে দুই প্রান্তে ক্লিক করে রেখা টানুন',
    addpt:  'দাগের রেখার উপর চাপ দিন — সেখানেই নতুন কোণা বসবে · ভাগ করা সীমানা হলে পাশের দাগেও বসবে',
    erase:  'রাবার — কোণায় চাপ দিলে কোণা মুছবে · রেখায় চাপ দিলে গোটা দাগটি · চেপে ধরে টানলে একটার পর একটা কোণা',
    note:   'যেখানে লিখতে চান সেখানে ক্লিক করুন · আগের লেখায় ক্লিক করলে বদলাবে, টানলে সরবে, Delete দিলে মুছবে',
    pin:    'চিহ্ন বসাতে ক্লিক করুন (টিউবওয়েল, খুঁটি, গাছ…) · নাম লিখে Enter',
    circle: 'বৃত্তের মাঝে ক্লিক করুন · গায়ে ধরে টানলে মাপ বদলাবে, মাঝে ধরে টানলে সরবে'
  },

  setLayer(id) { this.state.activeLayer = id; this._status('চলতি লেয়ার: ' + (CadCore.layerPreset(id).name)); },

  /* ==================== ইভেন্ট ==================== */

  _bind() {
    const s = this.state, c = s.canvas;
    if (c._cadBound) return;
    c._cadBound = true;

    let moved = 0, downPt = null, lastTap = 0;

    const pos = ev => {
      const r = c.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (c.width / r.width),
               y: (ev.clientY - r.top) * (c.height / r.height) };
    };

    const down = ev => {
      const p = pos(ev);
      downPt = p; moved = 0;
      const ip = this.toImage(p);

      if (s.tool === 'pan' || ev.button === 1) { s.panning = p; c.style.cursor = 'grabbing'; return; }

      /* রাবার — চেপে ধরে কোণার উপর দিয়ে টানলেই একটার পর একটা মুছবে */
      if (s.tool === 'erase') {
        this._erasing = { pushed: false, count: 0 };
        this.eraseVertexAt(p);
        return;
      }

      if (s.tool === 'edit') {
        const hv = this._hitVertex(p);
        if (hv) {
          const f = CadCore.feature(s.doc, hv.fid);
          const group = this._nodeGroup(f.pts[hv.index]);
          this._pushUndo();
          s.dragVertex = { group, moved: false };
          s.vertexSel = group;
          this.draw();
          return;
        }
        const he = this._hitEdge(ip);
        if (he) {
          // ধরে রাখি — নড়ালে পুরো রেখা সরবে, শুধু ক্লিক করলে নতুন কোণা বসবে
          this._pushUndo();
          s.vertexSel = null;
          s.dragEdge = {
            hit: he, start: ip, moved: false,
            groupA: this._nodeGroup(he.f.pts[he.i]),
            groupB: this._nodeGroup(he.f.pts[he.j])
          };
          return;
        }
        s.vertexSel = null;
      }
      /* নোটের টুলে ধরা নোট টেনে সরানো যায় — নইলে বসানোর পর আর নড়াতেই পারতেন না */
      if (s.tool === 'note' || s.tool === 'pin' || s.tool === 'circle') {
        const n = CadNotes.hit(s.doc, ip, 9 / s.scale);
        if (n) {
          /* বৃত্তের গায়ে ধরলে মাপ বদলায়, মাঝখানে ধরলে সরে —
             আলাদা বোতাম বা Alt চাপার দরকার পড়ে না */
          const onRim = n.kind === 'circle' &&
            Math.abs(Math.hypot(ip.x - n.x, ip.y - n.y) - n.r) <= 9 / s.scale;
          this._pushUndoNotes();
          s.dragNote = { note: n, start: ip, moved: false, mode: onRim ? 'resize' : 'move' };
          s.noteSel = n.id;
          this.draw();
          return;
        }
      }
      if (s.tool === 'select') {
        const add = !!ev.shiftKey || s.multiSelect;
        const f = this._hitFeature(ip);
        /* ★ যোগ-করার অবস্থায় বাছা দাগে ক্লিক = বাদ দেওয়া, সরানো নয়
           নইলে Shift+ক্লিক করে কোনো দাগ তালিকা থেকে বাদ দেওয়াই যেত না —
           ক্লিকটা "সরানো" ধরে নিত। */
        if (!add && f && s.selection.includes(f.id)) {
          s.dragFeature = { start: ip, moved: false };
          return;
        }
        // ফাঁকা জায়গা থেকে টানলে ঘের — ভেতরের সব দাগ একসাথে নির্বাচিত হয়
        s.rubber = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: add };
        return;
      }
      // অন্য সব টুলে ড্র্যাগ = প্যান
      s.panning = p;
    };

    const move = ev => {
      const p = pos(ev);
      if (downPt) moved += Math.abs(p.x - downPt.x) + Math.abs(p.y - downPt.y);
      const ip = this.toImage(p);

      if (s.dragVertex) {
        const g = s.dragVertex.group;
        const sn = CadCore.snap(ip, s.doc.features, {
          tol: 12 / s.scale,
          skipPts: g.map(m => m.f.pts[m.i])
        });
        // দলের সবাইকে একসাথে সরাই — ভাগ করা সীমানা অটুট থাকে
        for (const m of g) m.f.pts[m.i] = { x: sn.x, y: sn.y };
        s.dragVertex.moved = true;
        s.snapHint = sn.kind ? sn : null;
        this.draw();
        return;
      }
      if (s.dragEdge) {
        const d = s.dragEdge;
        const dx = ip.x - d.start.x, dy = ip.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * s.scale < 4) return;   // এখনো ক্লিক
        d.moved = true;
        for (const m of d.groupA) m.f.pts[m.i] = { x: m.f.pts[m.i].x + dx, y: m.f.pts[m.i].y + dy };
        for (const m of d.groupB) m.f.pts[m.i] = { x: m.f.pts[m.i].x + dx, y: m.f.pts[m.i].y + dy };
        d.start = ip;
        this.draw();
        if (ev.cancelable) ev.preventDefault();
        return;
      }
      if (this._erasing) {                       // রাবার ধরে টানা হচ্ছে
        this.eraseVertexAt(p);
        if (ev.cancelable) ev.preventDefault();
        return;
      }
      if (s.dragNote) {
        const d = s.dragNote;
        const dx = ip.x - d.start.x, dy = ip.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * s.scale < 4) return;   // এখনো ক্লিক
        d.moved = true;
        if (d.mode === 'resize') {
          d.note.r = Math.max(1, Math.hypot(ip.x - d.note.x, ip.y - d.note.y));
        } else {
          CadNotes.move(d.note, dx, dy);
        }
        d.start = ip;
        this.draw();
        if (ev.cancelable) ev.preventDefault();
        return;
      }
      if (s.rubber) {
        s.rubber.x1 = p.x; s.rubber.y1 = p.y;
        this.draw();
        if (ev.cancelable) ev.preventDefault();
        return;
      }
      if (s.dragFeature) {
        const dx = ip.x - s.dragFeature.start.x, dy = ip.y - s.dragFeature.start.y;
        for (const id of s.selection) {
          const f = CadCore.feature(s.doc, id);
          if (f) f.pts = f.pts.map(q => ({ x: q.x + dx, y: q.y + dy }));
        }
        s.dragFeature.start = ip;
        s.dragFeature.moved = true;
        this.draw();
        return;
      }
      if (s.panning) {
        s.off.x += p.x - s.panning.x;
        s.off.y += p.y - s.panning.y;
        s.panning = p;
        this.draw();
        if (ev.cancelable) ev.preventDefault();
        return;
      }

      // হোভার — স্ন্যাপ ইঙ্গিত ও দাগ হাইলাইট
      if (s.tool === 'pen') {
        s.snapHint = this._snap(ip);
        s.cursorImg = ip;
        this.draw();
      } else if (s.tool === 'select' || s.tool === 'wand') {
        const f = this._hitFeature(ip);
        const id = f ? f.id : null;
        if (id !== s.hoverFeature) { s.hoverFeature = id; this.draw(); }
      }
    };

    const up = ev => {
      const p = pos(ev);
      const wasDrag = moved > 6;
      const ip = this.toImage(p);

      if (this._erasing) {
        const n = this._erasing.count;
        this._erasing = null;
        if (n) {
          this._status(CadCore.bn(n) + 'টি কোণা মোছা হয়েছে — ভুল হলে ↺ (Ctrl+Z)');
        } else if (!wasDrag && this.eraseLineAt(ip)) {
          // কোণায় পড়েনি, কিন্তু রেখায় পড়েছে — গোটা দাগটিই যাবে
        } else {
          this._status('কোণায় চাপ দিলে কোণা মুছবে · রেখায় চাপ দিলে গোটা দাগটি');
        }
        downPt = null; return;
      }

      if (s.rubber) {
        const r = s.rubber;
        s.rubber = null;
        if (Math.abs(r.x1 - r.x0) < 6 && Math.abs(r.y1 - r.y0) < 6) {
          this._selectClick(ip, r.additive);          // ছোট নড়াচড়া = সাধারণ ক্লিক
        } else {
          this._rubberSelect(r);
        }
        this.draw();
        downPt = null; return;
      }
      if (s.dragVertex) {
        const moved = s.dragVertex.moved;
        const n = s.dragVertex.group.length;
        s.dragVertex = null; s.snapHint = null;
        if (moved) {
          this._changed();
          this._status(n > 1
            ? 'কোণা সরানো হয়েছে — পাশের ' + CadCore.bn(n - 1) + 'টি দাগের সীমানাও সাথে সরেছে'
            : 'কোণা সরানো হয়েছে · Delete চাপলে এই কোণা মুছে যাবে');
        } else {
          this._status('কোণা বাছা হয়েছে — টেনে সরান, বা Delete চেপে মুছুন');
        }
        this.draw();
        downPt = null; return;
      }
      if (s.dragEdge) {
        const d = s.dragEdge;
        s.dragEdge = null;
        if (d.moved) {
          this._changed();
          this._status('রেখাটি সরানো হয়েছে — দুই প্রান্তের সব দাগ সাথে সরেছে');
        } else {
          // নড়ানো হয়নি → কিনারায় নতুন কোণা বসাই
          this._pushUndo();
          this._insertVertex(d.hit);
        }
        this.draw();
        downPt = null; return;
      }
      if (s.dragFeature) {
        const m = s.dragFeature.moved;
        s.dragFeature = null;
        if (m) this._changed();
        downPt = null; return;
      }
      if (s.dragNote) {
        const d = s.dragNote;
        s.dragNote = null;
        if (d.moved) {
          this._changed(); this.draw();
          this._status(d.mode === 'resize'
            ? 'বৃত্তের মাপ বদলানো হয়েছে — ' + CadNotes.describe(s.doc, d.note)
            : 'সরানো হয়েছে — ' + CadNotes.describe(s.doc, d.note));
        } else {
          this._undoStack.pop();          // নড়েনি, তাই ইতিহাসে ধাপ রাখার দরকার নেই
          this._syncHistoryBtns();
          this.editNote(d.note);          // ক্লিক = লেখা বদলানো
        }
        downPt = null; return;
      }
      if (s.panning) {
        s.panning = null;
        c.style.cursor = s.tool === 'pan' ? 'grab' : 'crosshair';
        if (wasDrag) { downPt = null; return; }
      }
      downPt = null;
      if (wasDrag) return;

      // ── ক্লিক ──
      const now = Date.now();
      const isDouble = (now - lastTap) < 320;
      lastTap = now;

      switch (s.tool) {
        case 'pen':    this._penClick(ip, isDouble); break;
        case 'wand':   this._wandClick(ip); break;
        case 'select': this._selectClick(ip, ev.shiftKey); break;
        case 'edit':   this._editClick(p, ip); break;
        case 'scale':  this._scaleClick(ip); break;
        case 'gcp':    if (s.onGcp) s.onGcp(ip); this.draw(); break;
        case 'split':  this._splitClick(ip); break;
        case 'addpt':  this._addPointClick(ip); break;
        case 'note':   this._noteClick(ip, 'text'); break;
        case 'pin':    this._noteClick(ip, 'pin'); break;
        case 'circle': this._noteClick(ip, 'circle'); break;
      }
    };

    c.addEventListener('mousedown', down);
    window.addEventListener('mousemove', ev => { if (c.offsetWidth > 0) move(ev); });
    window.addEventListener('mouseup', ev => {
      if (c.offsetWidth > 0 &&
          (downPt || s.panning || s.dragVertex || s.dragEdge || s.dragFeature || s.rubber)) up(ev);
    });

    c.addEventListener('touchstart', e => { if (e.touches.length === 1) down(e.touches[0]); }, { passive: true });
    c.addEventListener('touchmove', e => {
      if (e.touches.length === 1) { move(e.touches[0]); if (e.cancelable) e.preventDefault(); }
    }, { passive: false });
    c.addEventListener('touchend', e => { if (e.changedTouches.length) up(e.changedTouches[0]); });

    c.addEventListener('wheel', ev => {
      ev.preventDefault();
      this.zoomAt(pos(ev), ev.deltaY < 0 ? 1.18 : 1 / 1.18);
    }, { passive: false });

    c.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      if (s.tool === 'pen' && s.draft.length >= 3) this.finishDraft();
      else if (s.tool === 'pen') this.cancelDraft();
    });

    window.addEventListener('keydown', ev => {
      if (!c.offsetWidth) return;
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      s.shiftKey = ev.shiftKey;

      if (ev.key === 'Enter' && s.tool === 'pen') { this.finishDraft(); ev.preventDefault(); }
      else if (ev.key === 'Escape') { this.cancelDraft(); s.selection = []; this.draw(); }
      else if (ev.key === 'Backspace' && s.tool === 'pen' && s.draft.length) {
        s.draft.pop(); this.draw(); ev.preventDefault();
      }
      else if (ev.key === 'Delete') {
        // কোণা সম্পাদনায় থাকলে আগে কোণা, নোট বাছা থাকলে নোট, নইলে পুরো দাগ
        if (s.tool === 'edit' && s.vertexSel && s.vertexSel.length) this.deleteVertex();
        else if (s.noteSel && CadNotes.find(s.doc, s.noteSel)) this.deleteNote();
        else this.deleteSelected();
      }
      else if (ev.key === 'z' && (ev.ctrlKey || ev.metaKey) && ev.shiftKey) { this.redo(); ev.preventDefault(); }
      else if (ev.key === 'z' && (ev.ctrlKey || ev.metaKey)) { this.undo(); ev.preventDefault(); }
      else if (ev.key === 'y' && (ev.ctrlKey || ev.metaKey)) { this.redo(); ev.preventDefault(); }
      else if (ev.key === 'f' || ev.key === 'F') this.fit();
    });
    window.addEventListener('keyup', ev => { s.shiftKey = ev.shiftKey; });
  },

  /* ---------------- টুলের ক্লিক ---------------- */

  _snap(ip, skipId) {
    const s = this.state;
    const tol = 12 / s.scale;
    return CadCore.snap(ip, s.doc.features, { tol, skipId });
  },

  _penClick(ip, isDouble) {
    const s = this.state;
    let p = this._snap(ip);

    if (s.shiftKey && s.draft.length) {
      p = CadCore.angleLock(s.draft[s.draft.length - 1], p, 15);
    }
    // প্রথম কোণায় ক্লিক = বন্ধ করা
    if (s.draft.length >= 3) {
      const d = CadCore.dist(s.draft[0], p) * s.scale;
      if (d < 14 || isDouble) { this.finishDraft(); return; }
    }
    s.draft.push({ x: p.x, y: p.y });
    this._status('কোণা ' + CadCore.bn(s.draft.length) + ' বসল — শেষ করতে প্রথম কোণায় ক্লিক করুন বা Enter দিন');
    this.draw();
  },

  finishDraft() {
    const s = this.state;
    if (s.draft.length < 3) { this._status('অন্তত ৩টি কোণা লাগবে'); return null; }
    this._pushUndo();
    const f = CadCore.newFeature(s.doc, s.activeLayer, CadCore.dedupe(s.draft, 0.5), {});
    CadCore.addFeature(s.doc, f);
    s.draft = [];
    s.selection = [f.id];
    this._changed();
    this.draw();
    const m = CadCore.measure(s.doc, f);
    this._status(s.doc.ftPerPx > 0
      ? 'দাগ যোগ হয়েছে — ' + CadCore.satakText(m.sqft)
      : 'দাগ যোগ হয়েছে — ক্ষেত্রফল পেতে আগে স্কেল বসান');
    return f;
  },

  cancelDraft() {
    const s = this.state;
    if (!s.draft.length) return;
    s.draft = [];
    this.draw();
    this._status('আঁকা বাতিল হয়েছে');
  },

  async _wandClick(ip) {
    const s = this.state;
    const r = s.rasters.find(x => x.visible) || s.rasters[0];
    if (!r) { this._status('আগে নকশার ছবি দিন'); return; }
    this._status('দাগ খোঁজা হচ্ছে…');
    try {
      const src = r.img.getContext ? r.img : this._toCanvas(r.img);
      const poly = CadTrace.traceAt(src, ip.x, ip.y, { cache: s.traceCache });
      if (!poly) { this._status('এখানে বন্ধ দাগ পাওয়া গেল না — হাতে আঁকুন বা অন্য জায়গায় ক্লিক করুন'); return; }
      this._pushUndo();
      const f = CadCore.newFeature(s.doc, s.activeLayer, poly, {});
      CadCore.addFeature(s.doc, f);
      s.selection = [f.id];
      this._changed();
      this.draw();
      const m = CadCore.measure(s.doc, f);
      this._status('দাগ পাওয়া গেছে — ' + CadCore.bn(poly.length) + 'টি কোণা'
        + (s.doc.ftPerPx > 0 ? ' · ' + CadCore.satakText(m.sqft) : ''));
    } catch (e) {
      this._status('স্বয়ংক্রিয় দাগ বের করা গেল না: ' + e.message);
    }
  },

  _toCanvas(img) {
    if (img._cadCanvas) return img._cadCanvas;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    img._cadCanvas = c;
    return c;
  },

  _selectClick(ip, additive) {
    const s = this.state;
    const add = additive || s.multiSelect;
    const f = this._hitFeature(ip);
    if (!f) {
      // যোগ-করার অবস্থায় ফাঁকা জায়গায় ক্লিক করলে তালিকা মুছে যাবে না
      if (!add) s.selection = [];
      this.draw(); this._changed(); return;
    }
    if (add) {
      const i = s.selection.indexOf(f.id);
      if (i >= 0) s.selection.splice(i, 1); else s.selection.push(f.id);
    } else {
      s.selection = [f.id];
    }
    this.draw();
    this._changed();

    const n = s.selection.length;
    if (n === 1) {
      const one = CadCore.feature(s.doc, s.selection[0]);
      const m = one ? CadCore.measure(s.doc, one) : null;
      this._status((one && one.dag ? 'দাগ ' + CadCore.bn(one.dag) + ' — ' : '') +
        (s.doc.ftPerPx > 0 && m ? CadCore.satakText(m.sqft)
          : CadCore.bn(one ? one.pts.length : 0) + 'টি কোণা'));
    } else if (n > 1) {
      this._status(CadCore.bn(n) + 'টি দাগ বাছা হয়েছে' + (s.doc.ftPerPx > 0
        ? ' — মোট ' + CadCore.satakText(this.selectionArea()) : ''));
    } else {
      this._status('তালিকা খালি');
    }
  },

  /** বাছা দাগগুলোর মোট ক্ষেত্রফল (বর্গফুট) */
  selectionArea() {
    const s = this.state;
    let sum = 0;
    for (const id of s.selection) {
      const f = CadCore.feature(s.doc, id);
      if (f && f.closed) sum += CadCore.measure(s.doc, f).sqft;
    }
    return sum;
  },

  /** একাধিক বাছাইয়ের অবস্থা চালু/বন্ধ */
  setMultiSelect(on) {
    const s = this.state;
    s.multiSelect = !!on;
    if (s.multiSelect && s.tool !== 'select') this.setTool('select');
    this._status(s.multiSelect
      ? 'একাধিক বাছাই চালু — এখন যত দাগে ক্লিক করবেন সব জমা হবে (আবার ক্লিক করলে বাদ যাবে)'
      : 'একাধিক বাছাই বন্ধ — এক ক্লিকে একটি। Shift ধরে ক্লিক করলেও যোগ হয়।');
    return s.multiSelect;
  },

  /**
   * কোণা টুলে ফাঁকা জায়গায় ক্লিক — কোণা ও কিনারা mousedown এ ধরা পড়ে,
   * তাই এখানে এলে মানে কিছুই ছোঁয়া যায়নি; দাগটি বেছে দিই।
   */
  _editClick(sp, ip) {
    this.state.vertexSel = null;
    this._selectClick(ip, false);
  },

  _scaleClick(ip) {
    const s = this.state;
    s.scalePts.push(this._snap(ip));
    this.draw();
    if (s.scalePts.length === 2) {
      const px = CadCore.dist(s.scalePts[0], s.scalePts[1]);
      if (s.onScaleAsk) s.onScaleAsk(px, s.scalePts.slice());
      s.scalePts = [];
      this.draw();
    } else {
      this._status('এবার দূরত্বের অন্য প্রান্তে ক্লিক করুন');
    }
  },

  _splitClick(ip) {
    const s = this.state;
    s.splitPts.push(ip);
    this.draw();
    if (s.splitPts.length < 2) { this._status('এবার রেখার অন্য প্রান্তে ক্লিক করুন'); return; }
    const [a, b] = s.splitPts;
    s.splitPts = [];
    const targets = s.selection.length
      ? s.selection.map(id => CadCore.feature(s.doc, id)).filter(Boolean)
      : s.doc.features.filter(f => f.closed);
    let done = 0;
    this._pushUndo();
    for (const f of targets) {
      const cut = CadOverlay.splitByLine(f.pts, a, b);
      if (!cut) continue;
      f.pts = cut.left;
      const g = CadCore.newFeature(s.doc, f.layer, cut.right, { dag: f.dag ? f.dag + '/খ' : '' });
      if (f.dag) f.dag = f.dag + '/ক';
      CadCore.addFeature(s.doc, g);
      done++;
    }
    this._changed(); this.draw();
    this._status(done ? CadCore.bn(done) + 'টি দাগ ভাগ হয়েছে' : 'রেখাটি কোনো দাগ কাটেনি');
  },

  /* ---------------- কেবল কিছু দাগ নিয়ে কাজ ---------------- */

  /**
   * "কেবল এগুলো দেখান" — বাকি সব লুকিয়ে দেওয়া
   *
   * ★ কেন দরকার
   *   ক্লায়েন্ট খতিয়ান নিয়ে আসেন, তাতে হয়তো তিনটি দাগ — ২৪১, ২৪২, ২৪৩।
   *   গোটা মৌজার ১২০০ দাগ নিয়ে নয়, শুধু ঐ তিনটি নিয়েই ডিমার্কেশন শিট
   *   বানাতে হয়। লুকানো দাগ ক্যানভাস, শিট ও রপ্তানি — সবখানেই বাদ পড়ে,
   *   তাই নিয়মটি সহজ: **যা দেখছেন, তাই যাবে**।
   */
  isolate(ids) {
    const s = this.state;
    const keep = new Set(ids && ids.length ? ids : s.selection);
    if (!keep.size) return 0;
    for (const f of s.doc.features) f.hidden = !keep.has(f.id);
    s.selection = s.doc.features.filter(f => !f.hidden).map(f => f.id);
    this._changed();
    this.zoomTo(CadCore.bboxAll(
      s.doc.features.filter(f => !f.hidden).map(f => f.pts)
    ).w ? [].concat(...s.doc.features.filter(f => !f.hidden).map(f => f.pts)) : [], 0.75);
    this.draw();
    return keep.size;
  },

  /** সব দাগ আবার দেখানো */
  showAllFeatures() {
    const s = this.state;
    let n = 0;
    for (const f of s.doc.features) if (f.hidden) { f.hidden = false; n++; }
    this._changed();
    this.draw();
    return n;
  },

  /**
   * সন্দেহজনক সরু দাগ বেছে দেওয়া — যাচাই করে মোছার জন্য
   *
   * ★ কেন স্বয়ংক্রিয়ভাবে মুছি না
   *   স্ক্যানের ফাঁক থেকে আসা ফালি আর **সত্যিকারের সরু দাগ** (আইল, নালা,
   *   রাস্তার ফালি) — দুটোরই আকার সরু। নিজে থেকে মুছে দিলে আসল দাগ
   *   হারানোর ঝুঁকি। তাই সন্দেহভাজনগুলো বেছে দেখানো হয়, মোছার সিদ্ধান্ত
   *   ব্যবহারকারীর।
   *
   * @param {number} limit বৃত্তাকারতার সীমা (বর্গ ~০.৭৯; কম মানে সরু)
   */
  selectThin(limit) {
    const s = this.state;
    const lim = limit > 0 ? limit : 0.2;
    s.selection = s.doc.features
      .filter(f => {
        const L = CadCore.layer(s.doc, f.layer);
        if (L && !L.visible) return false;
        return f.closed && f.pts.length >= 3 && CadCore.isSliver(f.pts, lim);
      })
      .map(f => f.id);
    this._changed();
    this.draw();
    return s.selection.length;
  },

  /**
   * ঘেরের ভেতরে **পুরোপুরি** থাকা দাগগুলো নির্বাচন
   * (AutoCAD এর window-select এর মতো — আধা-ঢোকা দাগ বাদ, যাতে ভুল করে
   *  পাশের দাগ ধরা না পড়ে)
   */
  _rubberSelect(r) {
    const s = this.state;
    const a = this.toImage({ x: Math.min(r.x0, r.x1), y: Math.min(r.y0, r.y1) });
    const b = this.toImage({ x: Math.max(r.x0, r.x1), y: Math.max(r.y0, r.y1) });
    const hit = [];
    for (const f of s.doc.features) {
      if (f.hidden) continue;
      const L = CadCore.layer(s.doc, f.layer);
      if (L && (!L.visible || L.locked)) continue;
      const bb = CadCore.bbox(f.pts);
      if (bb.x >= a.x && bb.y >= a.y && bb.x + bb.w <= b.x && bb.y + bb.h <= b.y) hit.push(f.id);
    }
    if (r.additive || s.multiSelect) {
      for (const id of hit) if (!s.selection.includes(id)) s.selection.push(id);
    } else {
      s.selection = hit;
    }
    this._changed();
    this._status(hit.length
      ? CadCore.bn(s.selection.length) + 'টি দাগ বাছা হয়েছে'
        + (s.doc.ftPerPx > 0 ? ' — মোট ' + CadCore.satakText(this.selectionArea()) : '')
      : 'ঘেরের ভেতরে পুরোপুরি কোনো দাগ পড়েনি — ঘেরটা আরেকটু বড় করে টানুন');
  },

  /* ---------------- টপোলজি সম্পাদনা ---------------- */

  /**
   * একই জায়গায় বসা সব কোণা এক "গিঁট" (node) হিসেবে ধরা
   *
   * ★ কেন জরুরি
   *   পাশাপাশি দুই দাগ সীমানার কোণা ভাগ করে। একটার কোণা টেনে সরালে
   *   অন্যটার কোণা জায়গায় থেকে গেলে মাঝে ফাঁক বা ওভারল্যাপ তৈরি হয় —
   *   তখন ক্ষেত্রফলের যোগফল আর মেলে না। তাই টানার সময় ঐ জায়গার
   *   **সব দাগের কোণা একসাথে** সরে। AutoCAD এ যাকে topological editing বলে।
   */
  _nodeGroup(pt, tol) {
    const s = this.state;
    const t = tol != null ? tol : Math.max(0.5, 4 / s.scale);
    const group = [];
    for (const f of s.doc.features) {
      if (f.hidden) continue;
      const L = CadCore.layer(s.doc, f.layer);
      if (L && (!L.visible || L.locked)) continue;
      for (let i = 0; i < f.pts.length; i++) {
        if (CadCore.dist(pt, f.pts[i]) <= t) group.push({ f, i });
      }
    }
    return group;
  },

  /** কার্সরের নিচে কোন কিনারা */
  _hitEdge(ip) {
    const s = this.state;
    const tol = 8 / s.scale;
    let best = null, bestD = tol;
    for (const f of s.doc.features) {
      if (f.hidden) continue;
      const L = CadCore.layer(s.doc, f.layer);
      if (L && (!L.visible || L.locked)) continue;
      const n = f.pts.length;
      if (n < 2) continue;
      const lim = f.closed ? n : n - 1;
      for (let i = 0; i < lim; i++) {
        const j = (i + 1) % n;
        const q = CadCore.closestOnSegment(ip, f.pts[i], f.pts[j]);
        const d = Math.hypot(ip.x - q.x, ip.y - q.y);
        if (d < bestD) { bestD = d; best = { f, i, j, q }; }
      }
    }
    return best;
  },

  /**
   * কিনারায় নতুন কোণা — ভাগ করা সীমানা হলে **দুই দাগেই** বসে,
   * নইলে পরে টানলে দুই দাগ আলাদা হয়ে যেত।
   */
  _insertVertex(hit) {
    const s = this.state;
    const a = hit.f.pts[hit.i], b = hit.f.pts[hit.j];
    const key = CadCore.sideKey(a, b, Math.max(0.5, 2 / s.scale));
    const np = { x: hit.q.x, y: hit.q.y };
    let n = 0;

    for (const f of s.doc.features) {
      if (f.hidden) continue;
      const L = CadCore.layer(s.doc, f.layer);
      if (L && (!L.visible || L.locked)) continue;
      const len = f.pts.length;
      const lim = f.closed ? len : len - 1;
      for (let i = 0; i < lim; i++) {
        const j = (i + 1) % len;
        if (CadCore.sideKey(f.pts[i], f.pts[j], Math.max(0.5, 2 / s.scale)) !== key) continue;
        f.pts.splice(i + 1, 0, { x: np.x, y: np.y });
        n++;
        break;                              // একটি কিনারায় একবারই
      }
    }
    this._changed();
    this._status(n > 1
      ? 'নতুন কোণা বসেছে — ভাগ করা সীমানা, তাই ' + CadCore.bn(n) + 'টি দাগেই বসল'
      : 'নতুন কোণা বসেছে — এবার টেনে সরান');
    return n;
  },

  /* ==================== বিন্দু যোগ ====================
     ★ কেন আলাদা টুল
       নতুন কোণা বসানো যেত “কোণা” টুলে রেখায় ক্লিক করে — কিন্তু ঐ টুলে
       ক্লিক আর টান দুটোই কাজ করায় অনেকে ভুল করে কোণা সরিয়ে ফেলতেন,
       আর “নতুন বিন্দু কোথায় যোগ করব” সেটাই খুঁজে পেতেন না। এখানে
       ক্লিক মানে **শুধুই নতুন বিন্দু**।
     ==================================================== */

  _addPointClick(ip) {
    const he = this._hitEdge(ip);
    if (!he) {
      this._status('দাগের **রেখার উপরে** চাপ দিন — সেখানেই নতুন কোণা বসবে। '
        + 'রেখা থেকে দূরে চাপ দিলে কিছু হবে না।', true);
      return;
    }
    this._pushUndo();
    const n = this._insertVertex(he);
    this._status(n > 1
      ? 'নতুন কোণা বসেছে — ভাগ করা সীমানা বলে পাশের ' + CadCore.bn(n - 1)
        + 'টি দাগেও একই জায়গায় বসেছে, ফাঁক হবে না'
      : 'নতুন কোণা বসেছে — এবার “কোণা” টুলে ধরে টেনে জায়গামতো নিন');
  },

  /* ==================== রাবার — কোণা মোছা ==================== */

  /**
   * ★ কেন আলাদা টুল
   *   কোণা মুছতে আগে সেটিকে বাছতে হতো, তারপর Delete চাপতে হতো — ফোনে
   *   Delete কী-ই নেই, আর একটার পর একটা মুছতে গেলে খুব ধীর। রাবার টুলে
   *   কোণার উপর দিয়ে ছুঁয়ে গেলেই মুছে যায়।
   *
   * ★ ভাগ করা সীমানা
   *   একটি কোণায় পাশের দাগেরও কোণা মিলে থাকে। `_nodeGroup` দিয়ে ঐ দলটাই
   *   একসাথে মোছা হয় — নইলে এক দাগে কোণা যেত, পাশেরটায় থেকে যেত, মাঝে
   *   ফাঁক তৈরি হতো।
   */
  /**
   * রাবার দিয়ে রেখায় চাপ — গোটা দাগটিই মুছে যায়
   * ★ কেন গোটা দাগ
   *   বন্ধ দাগ থেকে একটিমাত্র বাহু মুছে ফেলা যায় না — তাতে বলয়টা খুলে যায়,
   *   ক্ষেত্রফলও বেরোয় না। ভুল করে বসা একটা দাগ/রেখা তুলে ফেলাই আসল দরকার,
   *   তাই রেখায় চাপ দিলে সেই দাগটিই যায়।
   */
  eraseLineAt(ip) {
    const s = this.state;
    const he = this._hitEdge(ip);
    if (!he) return false;
    const f = he.f;
    this._pushUndo();
    CadCore.removeFeature(s.doc, f.id);
    s.selection = s.selection.filter(id => id !== f.id);
    this._changed(); this.draw();
    this._status((f.dag ? 'দাগ ' + CadCore.bn(f.dag) : 'রেখাটি')
      + ' মুছে ফেলা হয়েছে — ভুল হলে ↺ (Ctrl+Z)');
    return true;
  },

  eraseVertexAt(sp) {
    const s = this.state;
    const hv = this._hitVertex(sp);
    if (!hv) return false;
    const f = CadCore.feature(s.doc, hv.fid);
    if (!f) return false;
    const group = this._nodeGroup(f.pts[hv.index]);
    if (group.some(m => m.f.pts.length <= 3)) {
      this._status('এই দাগে মোটে ৩টি কোণা — আর মোছা যাবে না (ত্রিভুজই সবচেয়ে ছোট)', true);
      return false;
    }
    if (!this._erasing || !this._erasing.pushed) {
      this._pushUndo();
      if (this._erasing) this._erasing.pushed = true;
    }
    const byFeature = new Map();
    for (const m of group) {
      if (!byFeature.has(m.f)) byFeature.set(m.f, []);
      byFeature.get(m.f).push(m.i);
    }
    for (const [ft, idxs] of byFeature) {
      idxs.sort((x, y) => y - x);
      for (const i of idxs) if (ft.pts.length > 3) ft.pts.splice(i, 1);
    }
    s.vertexSel = null;
    if (this._erasing) this._erasing.count += 1;
    this._changed(); this.draw();
    return true;
  },

  /** নির্বাচিত কোণা মুছে ফেলা (দলের সবার থেকেই) */
  deleteVertex() {
    const s = this.state;
    const g = s.vertexSel;
    if (!g || !g.length) return false;
    // ৩ কোণার নিচে নামানো যাবে না
    if (g.some(m => m.f.pts.length <= 3)) {
      this._status('একটি দাগে অন্তত ৩টি কোণা থাকতে হবে — এটি মোছা যাবে না', true);
      return false;
    }
    this._pushUndo();
    // পিছন থেকে মুছি, নইলে সূচক সরে যায়
    const byFeature = new Map();
    for (const m of g) {
      if (!byFeature.has(m.f)) byFeature.set(m.f, []);
      byFeature.get(m.f).push(m.i);
    }
    for (const [f, idxs] of byFeature) {
      idxs.sort((x, y) => y - x);
      for (const i of idxs) if (f.pts.length > 3) f.pts.splice(i, 1);
    }
    s.vertexSel = null;
    this._changed(); this.draw();
    this._status('কোণা মুছে ফেলা হয়েছে');
    return true;
  },

  /**
   * নির্বাচিত (বা সব) দাগ থেকে কাঁটা ও অতিরিক্ত কোণা পরিষ্কার
   * স্বয়ংক্রিয় ডিজিটাইজের পর একবার চালালে নকশা অনেক পরিষ্কার হয়।
   */
  cleanupGeometry(opt) {
    const o = opt || {};
    const s = this.state;
    const list = s.selection.length
      ? s.selection.map(id => CadCore.feature(s.doc, id)).filter(Boolean)
      : s.doc.features;
    if (!list.length) return { changed: 0, removed: 0 };

    this._pushUndo();
    let changed = 0, removed = 0;
    const minEdge = (o.minEdge != null ? o.minEdge : 3) / Math.max(0.0001, s.doc.ftPerPx || 1);
    const kill = [];

    for (const f of list) {
      if (!f.closed || f.pts.length < 4) continue;
      const before = f.pts.length;
      let pts = CadCore.unpinch(f.pts, o.pinch != null ? o.pinch : minEdge * 0.7, true);
      pts = CadCore.despike(pts, o.despike == null ? 18 : o.despike, true);
      pts = CadCore.collapseShortEdges(pts, minEdge, true);
      pts = CadCore.straighten(pts, o.straighten == null ? 5 : o.straighten, true);
      pts = CadCore.dedupe(pts, 0.4);
      if (pts.length < 3) { kill.push(f.id); continue; }
      if (o.dropSlivers && CadCore.isSliver(pts, o.sliver)) { kill.push(f.id); continue; }
      if (pts.length !== before) changed++;
      f.pts = pts;
      f._lp = null;
    }
    for (const id of kill) { CadCore.removeFeature(s.doc, id); removed++; }

    // পরিষ্কারের পর কোণাগুলো আবার ঝালাই — সীমানা যেন মিলে থাকে
    CadTrace.weld(list.filter(f => !kill.includes(f.id)).map(f => f.pts),
                  Math.max(0.4, 1.5 / s.scale));

    s.selection = s.selection.filter(id => !kill.includes(id));
    this._changed(); this.draw();
    return { changed, removed };
  },

  /* ---------------- হিট টেস্ট ---------------- */

  _hitVertex(sp) {
    const s = this.state;
    for (let i = s.doc.features.length - 1; i >= 0; i--) {
      const f = s.doc.features[i];
      if (f.hidden) continue;
      const L = CadCore.layer(s.doc, f.layer);
      if (L && (!L.visible || L.locked)) continue;
      for (let j = 0; j < f.pts.length; j++) {
        const q = this.toScreen(f.pts[j]);
        if (Math.hypot(q.x - sp.x, q.y - sp.y) < 9) return { fid: f.id, index: j };
      }
    }
    return null;
  },

  _hitFeature(ip) {
    const s = this.state;
    let best = null, bestArea = Infinity;
    for (const f of s.doc.features) {
      if (f.hidden) continue;
      const L = CadCore.layer(s.doc, f.layer);
      if (L && !L.visible) continue;
      if (f.closed && f.pts.length >= 3 && CadCore.pointInPolygon(ip, f.pts)) {
        const a = CadCore.area(f.pts);
        if (a < bestArea) { bestArea = a; best = f; }        // ছোটটিই উপরে
      } else if (!f.closed) {
        for (let i = 0; i < f.pts.length - 1; i++) {
          const q = CadCore.closestOnSegment(ip, f.pts[i], f.pts[i + 1]);
          if (Math.hypot(ip.x - q.x, ip.y - q.y) * s.scale < 7) return f;
        }
      }
    }
    return best;
  },

  /* ==================== সম্পাদনা ==================== */

  /* ==================== লেখা, চিহ্ন ও বৃত্ত ==================== */

  /** নোটের জন্য আলাদা ইতিহাস নয় — একই স্ট্যাক, তাই Ctrl+Z সবখানে এক রকম */
  _pushUndoNotes() { this._pushUndo(); },

  _noteClick(ip, kind) {
    const s = this.state;
    CadNotes.ensure(s.doc);
    this._pushUndo();
    const n = kind === 'circle'
      ? CadNotes.add(s.doc, 'circle', ip.x, ip.y, { r: Math.max(8, 34 / s.scale) })
      : CadNotes.add(s.doc, kind, ip.x, ip.y, {});
    s.noteSel = n.id;
    this._changed(); this.draw();
    this.editNote(n);
  },

  /**
   * ঠিক ঐ জায়গাতেই ছোট একটি ঘর খুলে লেখা নেওয়া
   * prompt() ব্যবহার করিনি — ওতে নকশা ঢাকা পড়ে, আর কোথায় বসছে দেখা যায় না।
   * Enter = হলো, Esc = বাতিল, ফাঁকা রেখে Enter = নোটটি মুছে যায়।
   */
  editNote(note) {
    const s = this.state;
    if (!note || typeof document === 'undefined') return;
    const old = document.getElementById('cad-note-input');
    if (old) old.remove();

    const wrap = s.canvas && s.canvas.parentElement;
    if (!wrap) return;
    const q = this.toScreen(note);
    const r = s.canvas.getBoundingClientRect();
    const kx = r.width / s.canvas.width, ky = r.height / s.canvas.height;

    const inp = document.createElement('input');
    inp.id = 'cad-note-input';
    inp.className = 'cad-note-input';
    inp.value = note.text || '';
    inp.placeholder = note.kind === 'circle' ? 'কী বোঝাচ্ছে? (যেমন কুয়া)'
                    : note.kind === 'pin'    ? 'চিহ্নের নাম (যেমন টিউবওয়েল)'
                                             : 'লেখা (যেমন রাস্তা)';
    inp.style.left = Math.round(q.x * kx) + 'px';
    inp.style.top  = Math.round(q.y * ky + 10) + 'px';
    wrap.appendChild(inp);
    inp.focus(); inp.select();

    const done = (ok) => {
      if (inp._gone) return;
      inp._gone = true;
      const txt = inp.value.trim();
      inp.remove();
      if (!ok) { this.draw(); return; }
      if (!txt && note.kind !== 'circle') {
        CadNotes.remove(s.doc, note.id);   // ফাঁকা লেখা রেখে লাভ নেই
        s.noteSel = null;
        this._status('খালি নোটটি বাদ দেওয়া হলো');
      } else {
        note.text = txt;
        this._status(CadNotes.describe(s.doc, note)
          + ' · টেনে সরান, আবার ক্লিক করলে লেখা বদলাবে, Delete চাপলে মুছবে');
      }
      this._changed(); this.draw();
    };
    inp.addEventListener('keydown', ev => {
      ev.stopPropagation();                       // ক্যানভাসের শর্টকাট যেন না চলে
      if (ev.key === 'Enter') { ev.preventDefault(); done(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); done(false); }
    });
    inp.addEventListener('blur', () => done(true));
  },

  deleteNote(id) {
    const s = this.state;
    const nid = id || s.noteSel;
    if (!nid) return false;
    this._pushUndo();
    const ok = CadNotes.remove(s.doc, nid);
    if (ok) { s.noteSel = null; this._changed(); this.draw(); this._status('নোটটি মুছে ফেলা হয়েছে'); }
    return ok;
  },

  clearNotes() {
    const s = this.state;
    CadNotes.ensure(s.doc);
    if (!s.doc.notes.length) { this._status('মোছার মতো নোট নেই'); return; }
    this._pushUndo();
    const n = s.doc.notes.length;
    s.doc.notes = [];
    s.noteSel = null;
    this._changed(); this.draw();
    this._status(CadCore.bn(n) + 'টি নোট মুছে ফেলা হয়েছে — ভুল হলে Ctrl+Z');
  },

  /** নোট আঁকা — লেখা পর্দার মাপে, তাই জুম করলেও পড়া যায় */
  _drawNotes(ctx) {
    const s = this.state;
    CadNotes.ensure(s.doc);
    if (s.show.notes === false || !s.doc.notes.length) return;

    for (const n of s.doc.notes) {
      if (n.hidden) continue;
      const q = this.toScreen(n);
      const sel = s.noteSel === n.id;
      ctx.save();

      if (n.kind === 'circle') {
        const rr = n.r * s.scale;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180,83,9,0.10)';
        ctx.fill();
        ctx.strokeStyle = n.color; ctx.lineWidth = sel ? 2.4 : 1.6;
        if (sel) ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        // মাঝের ছোট ক্রস — কোথায় ধরলে সরবে সেটি বোঝাতে
        ctx.beginPath();
        ctx.moveTo(q.x - 4, q.y); ctx.lineTo(q.x + 4, q.y);
        ctx.moveTo(q.x, q.y - 4); ctx.lineTo(q.x, q.y + 4);
        ctx.stroke();
      } else if (n.kind === 'pin') {
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x - 5, q.y - 12);
        ctx.arc(q.x, q.y - 16, 5.6, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.closePath();
        ctx.fillStyle = n.color; ctx.fill();
        ctx.strokeStyle = sel ? '#111827' : 'rgba(255,255,255,0.9)';
        ctx.lineWidth = sel ? 2 : 1.2;
        ctx.stroke();
      }

      if (n.text) {
        const fs = n.size || 14;
        ctx.font = '600 ' + fs + 'px "Noto Sans Bengali", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = n.kind === 'pin' ? 'bottom' : 'middle';
        const ty = n.kind === 'pin' ? q.y - 24 : q.y;
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeText(n.text, q.x, ty);        // সাদা রেখা — নকশার উপরে পড়া যায়
        ctx.fillStyle = n.color;
        ctx.fillText(n.text, q.x, ty);
      } else if (n.kind === 'text') {
        // লেখা নেই — তবু জায়গাটি দেখা যাক
        ctx.strokeStyle = n.color; ctx.lineWidth = 1.4;
        ctx.strokeRect(q.x - 9, q.y - 7, 18, 14);
      }

      if (sel) {
        ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(q.x - 11, q.y - 11, 22, 22);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
  },

  /* ==================== সম্পাদনা ==================== */

  _undoStack: [],
  _redoStack: [],

  /* দাগ ও নোট — দুটোই একসাথে ছবি তুলে রাখি, নইলে ফেরত নিলে দাগ
     আগের অবস্থায় যেত আর নোট থেকে যেত, দুটো আর মিলত না */
  _snapshot() {
    const d = this.state.doc;
    return JSON.stringify({ f: d.features, n: d.notes || [] });
  },

  _restore(json) {
    const d = this.state.doc;
    const o = JSON.parse(json);
    d.features = o.f || [];
    d.notes = o.n || [];
  },

  _pushUndo() {
    this._undoStack.push(this._snapshot());
    if (this._undoStack.length > 40) this._undoStack.shift();
    this._redoStack.length = 0;          // নতুন কাজ করলে সামনের ধাপগুলো বাতিল
    this._syncHistoryBtns();
  },

  undo() {
    const s = this.state;
    const prev = this._undoStack.pop();
    if (!prev) { this._status('আর ফেরত নেওয়ার কিছু নেই'); return; }
    this._redoStack.push(this._snapshot());
    this._restore(prev);
    s.selection = []; s.noteSel = null;
    this._changed(); this.draw(); this._syncHistoryBtns();
    this._status('আগের অবস্থায় ফেরত — চাইলে “আবার করুন” চাপুন');
  },

  redo() {
    const s = this.state;
    const next = this._redoStack.pop();
    if (!next) { this._status('সামনে আর কিছু নেই'); return; }
    this._undoStack.push(this._snapshot());
    this._restore(next);
    s.selection = []; s.noteSel = null;
    this._changed(); this.draw(); this._syncHistoryBtns();
    this._status('আবার করা হলো');
  },

  /** বোতাম দুটিকে বলে দিই কয় ধাপ পিছনে/সামনে যাওয়া যায় */
  _syncHistoryBtns() {
    if (typeof document === 'undefined') return;
    const set = (id, n, word) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.disabled = !n;
      b.title = n ? word + ' (' + CadCore.bn(n) + ' ধাপ)' : word + ' — কিছু নেই';
    };
    set('cad-undo-btn', this._undoStack.length, 'আগের অবস্থায় ফেরত (Ctrl+Z)');
    set('cad-redo-btn', this._redoStack.length, 'আবার করুন (Ctrl+Y)');
  },

  deleteSelected() {
    const s = this.state;
    if (!s.selection.length) return;
    this._pushUndo();
    for (const id of s.selection) CadCore.removeFeature(s.doc, id);
    const n = s.selection.length;
    s.selection = [];
    this._changed(); this.draw();
    this._status(CadCore.bn(n) + 'টি দাগ মুছে ফেলা হয়েছে');
  },

  selectAll(layerId) {
    const s = this.state;
    s.selection = s.doc.features
      .filter(f => !layerId || f.layer === layerId)
      .map(f => f.id);
    this.draw(); this._changed();
  },

  /** নির্বাচিত দাগগুলো অন্য লেয়ারে সরানো */
  moveToLayer(layerId) {
    const s = this.state;
    if (!s.selection.length) return 0;
    this._pushUndo();
    let n = 0;
    for (const id of s.selection) {
      const f = CadCore.feature(s.doc, id);
      if (f) { f.layer = layerId; n++; }
    }
    const L = CadCore.layer(s.doc, layerId);
    if (L) L.used = true;
    this._changed(); this.draw();
    return n;
  },

  /* ==================== আঁকা ==================== */

  draw() {
    const s = this.state;
    if (!s) return;
    const { ctx, canvas: c } = s;
    const W = c.width, H = c.height;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    /* ── ১. আন্ডারলে ── */
    if (s.show.raster) {
      for (const r of s.rasters) {
        if (!r.visible || !r.img) continue;
        ctx.save();
        ctx.globalAlpha = r.opacity;
        ctx.imageSmoothingEnabled = s.scale < 1;
        if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';
        const o = this.toScreen({ x: r.offset.x, y: r.offset.y });
        ctx.drawImage(r.img, o.x, o.y, r.img.width * s.scale * r.scale, r.img.height * s.scale * r.scale);
        ctx.restore();
      }
    }

    /* ── ২. ভেক্টর দাগ ── */
    const doc = s.doc;
    const ordered = doc.layers.slice().reverse();     // তালিকার নিচেরটা আগে
    for (const L of ordered) {
      if (!L.visible) continue;
      for (const f of doc.features) {
        if (f.layer !== L.id || f.hidden) continue;
        this._drawFeature(ctx, f, L);
      }
    }

    /* ── ৩. চলতি আঁকা ── */
    if (s.draft.length) this._drawDraft(ctx);

    /* ── ৪. লেখা (পর্দার মাপে) ──
     *
     * ★ ভিড় সামলানো
     *   একটি মৌজা নকশায় হাজারেরও বেশি দাগ থাকে। সবগুলোর বাহুর মাপ একসাথে
     *   লিখলে পর্দা লেখায় ঢেকে যায়, কিছুই পড়া যায় না। তাই:
     *     ১. দাগ নম্বর ও ক্ষেত্রফল আগে বসে (এগুলোই বেশি দরকারি)
     *     ২. তারপর বাহুর মাপ — লম্বা বাহু আগে
     *     ৩. আগের কোনো লেখার সাথে ঠেকে গেলে সেটি বাদ পড়ে
     *     ৪. কোনো দাগ নির্বাচিত থাকলে কেবল তারই মাপ দেখানো হয়
     *   জুম করলে জায়গা বাড়ে, তখন আপনাআপনি আরও লেখা ফুটে ওঠে।
     */
    const placed = [];
    for (const L of ordered) {
      if (!L.visible) continue;
      for (const f of doc.features) {
        if (f.layer !== L.id || !f.closed || f.hidden) continue;
        this._drawLabel(ctx, f, L, placed);
      }
    }

    if (s.show.dims && doc.ftPerPx > 0) {
      const onlySel = s.selection.length > 0;
      const seenDims = new Set();
      const jobs = [];
      for (const L of ordered) {
        if (!L.visible) continue;
        for (const f of doc.features) {
          if (f.layer !== L.id || !f.showDims || f.hidden) continue;
          if (onlySel && !s.selection.includes(f.id)) continue;
          const c = CadCore.centroid(f.pts);
          for (const sd of CadCore.sides(doc, f)) {
            const key = CadCore.sideKey(sd.a, sd.b, Math.max(1, 1.5 / s.scale));
            if (seenDims.has(key)) continue;
            seenDims.add(key);
            jobs.push({ sd, c, color: '#1d4ed8' });
          }
        }
      }
      jobs.sort((a, b) => b.sd.px - a.sd.px);            // লম্বা বাহু আগে
      for (const j of jobs) this._drawOneDim(ctx, j.sd, j.c, placed);
    }

    /* কোণার ডিগ্রি — মাঠে ফিতা ধরে মেলাতে লাগে।
       নির্বাচিত থাকলে কেবল সেগুলোর, নইলে সব দেখা দাগের। */
    if (s.show.angles) {
      const onlySel = s.selection.length > 0;
      for (const L of ordered) {
        if (!L.visible) continue;
        for (const f of doc.features) {
          if (f.layer !== L.id || !f.closed || f.hidden) continue;
          if (onlySel && !s.selection.includes(f.id)) continue;
          this._drawAngles(ctx, f, placed);
        }
      }
    }

    /* ── ৪খ. লেখা, চিহ্ন ও বৃত্ত ── */
    this._drawNotes(ctx);

    /* ── ৫. নির্বাচন ও কোণা ── */
    this._drawHandles(ctx);

    /* ── ৬. স্কেল / ভাগ করার রেখা ── */
    this._drawTemp(ctx);

    /* ── ৭. স্ন্যাপ ইঙ্গিত ── */
    if (s.snapHint && s.snapHint.kind) {
      const q = this.toScreen(s.snapHint);
      ctx.save();
      ctx.strokeStyle = s.snapHint.kind === 'vertex' ? '#f59e0b' : '#22c55e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (s.snapHint.kind === 'vertex') ctx.rect(q.x - 6, q.y - 6, 12, 12);
      else ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
    this._drawScaleBar(ctx, W, H);
  },

  _drawFeature(ctx, f, L) {
    const s = this.state;
    const pts = f.pts;
    if (!pts || pts.length < 2) return;
    const sel = s.selection.includes(f.id);
    const hov = s.hoverFeature === f.id;

    ctx.save();
    ctx.beginPath();
    const p0 = this.toScreen(pts[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < pts.length; i++) {
      const q = this.toScreen(pts[i]);
      ctx.lineTo(q.x, q.y);
    }
    if (f.closed) ctx.closePath();

    if (f.closed && s.show.fill && (L.fill || sel || hov)) {
      ctx.fillStyle = sel ? 'rgba(59,130,246,0.22)'
        : hov ? 'rgba(99,102,241,0.12)'
        : L.fill;
      ctx.fill();
    }
    ctx.strokeStyle = sel ? '#2563eb' : L.color;
    ctx.lineWidth = Math.max(1, (L.width || 1.5)) * (sel ? 1.8 : 1);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  },

  _drawDraft(ctx) {
    const s = this.state;
    const d = s.draft;
    const L = CadCore.layer(s.doc, s.activeLayer) || CadCore.layerPreset(s.activeLayer);
    ctx.save();
    ctx.strokeStyle = L.color;
    ctx.lineWidth = Math.max(1.6, L.width || 1.6);
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const p0 = this.toScreen(d[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < d.length; i++) {
      const q = this.toScreen(d[i]);
      ctx.lineTo(q.x, q.y);
    }
    // কার্সর পর্যন্ত টানা রেখা (রাবার-ব্যান্ড)
    if (s.cursorImg) {
      const q = this.toScreen(s.snapHint && s.snapHint.kind ? s.snapHint : s.cursorImg);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // চলতি বাহুর মাপ
    if (s.doc.ftPerPx > 0 && d.length && s.cursorImg) {
      const a = d[d.length - 1];
      const b = (s.snapHint && s.snapHint.kind) ? s.snapHint : s.cursorImg;
      const ft = CadCore.dist(a, b) * s.doc.ftPerPx;
      const m = this.toScreen({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      this._chip(ctx, CadCore.ftIn(ft), m.x, m.y - 14, '#1d4ed8');
    }

    d.forEach((p, i) => {
      const q = this.toScreen(p);
      ctx.beginPath();
      ctx.arc(q.x, q.y, i === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#f59e0b' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = L.color; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.restore();
  },

  /**
   * বাহুর মাপ — নমুনা শিটের মতো নীল ফুট-ইঞ্চি, বাহুর সমান্তরালে
   * কিনারার **বাইরের** দিকে সরিয়ে লেখা হয়, যাতে দাগের নম্বরের সাথে না মেশে।
   */
  /** লেখার জায়গা কি খালি? খালি হলে দখল করে true ফেরত দেয় */
  _claim(placed, x, y, w, h) {
    const r = { x: x - w / 2, y: y - h / 2, w, h };
    for (const q of placed) {
      if (r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h) return false;
    }
    placed.push(r);
    return true;
  },

  /**
   * কোণার ডিগ্রি
   *
   * বাহুর মাপ ঠিক থাকলেও কোণ ভুল হলে জমির আকৃতি বদলে যায় — তাই সার্ভেয়ার
   * মাঠে কোণও মেলান। লেখাটি কোণার **ভেতরের দিকে** বসে (দ্বিখণ্ডক বরাবর),
   * যাতে কোন কোণার ডিগ্রি তা নিয়ে সন্দেহ না থাকে।
   */
  _drawAngles(ctx, f, placed) {
    const s = this.state;
    if (!f.pts || f.pts.length < 3) return;
    const bb = CadCore.bbox(f.pts);
    if (bb.w * s.scale < 46 || bb.h * s.scale < 36) return;   // খুব ছোট দাগে জায়গা নেই

    ctx.save();
    ctx.font = '700 10px "Noto Sans Bengali", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const a of CadCore.angles(f.pts)) {
      const q = this.toScreen(a.at);
      const cx = q.x + a.bisector.x * 17, cy = q.y + a.bisector.y * 17;
      const txt = CadCore.bn(Math.round(a.deg)) + '°';
      const w = ctx.measureText(txt).width;
      if (placed && !this._claim(placed, cx, cy, w + 6, 13)) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillRect(cx - w / 2 - 3, cy - 7, w + 6, 14);
      // সমকোণের কাছাকাছি হলে সবুজ — মাঠে দ্রুত চোখে পড়ে
      const sq = Math.abs(a.deg - 90) < 1.5;
      ctx.fillStyle = sq ? '#15803d' : (a.deg > 180 ? '#b45309' : '#7c3aed');
      ctx.fillText(txt, cx, cy);
    }
    ctx.restore();
  },

  /** একটি বাহুর মাপ — জায়গা থাকলে */
  _drawOneDim(ctx, sd, c, placed) {
    const s = this.state;
    const lenPx = sd.px * s.scale;
    if (lenPx < 34) return;                          // খুব ছোট বাহুতে লেখা বসে না

    const m = this.toScreen(sd.mid);
    // কিনারার বাইরের দিকে সরানো — দাগ নম্বরের সাথে যাতে না মেশে
    let nx = sd.mid.x - c.x, ny = sd.mid.y - c.y;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;

    let ang = sd.angle;
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;

    ctx.save();
    ctx.font = '600 11px "Noto Sans Bengali", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const txt = CadCore.ftIn(sd.feet);
    const tw = ctx.measureText(txt).width, th = 13;
    const cx = m.x + nx * 11, cy = m.y + ny * 11;
    // ঘোরানো লেখার ঘের
    const ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
    const bw = tw * ca + th * sa, bh = tw * sa + th * ca;

    if (!this._claim(placed, cx, cy, bw + 3, bh + 3)) { ctx.restore(); return; }

    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-tw / 2 - 2, -7, tw + 4, 14);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  },

  /** দাগ নম্বর ও ক্ষেত্রফল */
  _drawLabel(ctx, f, L, placed) {
    const s = this.state;
    if (!f.showLabel) return;
    if (f.pts.length < 3) return;
    const bbPx = CadCore.bbox(f.pts);
    if (bbPx.w * s.scale < 26 || bbPx.h * s.scale < 18) return;

    const lp = f._lp && f._lpKey === this._lpKey(f) ? f._lp : (() => {
      const p = CadCore.labelPoint(f.pts);
      f._lp = p; f._lpKey = this._lpKey(f);
      return p;
    })();
    const q = this.toScreen(lp);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let dy = 0;
    if (s.show.dagNo && f.dag) {
      ctx.font = '800 15px "Noto Sans Bengali", sans-serif';
      const t = CadCore.bn(f.dag);
      const w = ctx.measureText(t).width;
      if (!placed || this._claim(placed, q.x, q.y, w + 7, 20)) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(q.x - w / 2 - 3, q.y - 10, w + 6, 19);
        ctx.fillStyle = L.color;
        ctx.fillText(t, q.x, q.y);
        dy = 17;
      }
    }
    if (s.show.area && s.doc.ftPerPx > 0) {
      const m = CadCore.measure(s.doc, f);
      if (m.sqft > 0) {
        ctx.font = '600 11px "Noto Sans Bengali", sans-serif';
        const t = CadCore.satakText(m.sqft);
        const w = ctx.measureText(t).width;
        if (!placed || this._claim(placed, q.x, q.y + dy, w + 7, 15)) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillRect(q.x - w / 2 - 3, q.y + dy - 7, w + 6, 14);
          ctx.fillStyle = m.isManual ? '#b45309' : '#111827';
          ctx.fillText(t, q.x, q.y + dy);
        }
      }
    }
    ctx.restore();
  },

  _lpKey(f) {
    return f.pts.length + ':' + (f.pts[0] ? f.pts[0].x.toFixed(1) + ',' + f.pts[0].y.toFixed(1) : '');
  },

  _drawHandles(ctx) {
    const s = this.state;
    if (!s.show.vertices && !s.selection.length) return;
    // রাবার ও বিন্দু-যোগেও সব কোণা দেখা দরকার — কোথায় আছে দেখেই চাপ দেবেন
    const showAll = s.tool === 'edit' || s.tool === 'erase' || s.tool === 'addpt';
    // নির্বাচিত কোণার জায়গা — আলাদা রঙে দেখাব
    const selPt = (s.vertexSel && s.vertexSel.length)
      ? s.vertexSel[0].f.pts[s.vertexSel[0].i] : null;

    ctx.save();
    for (const f of s.doc.features) {
      if (f.hidden) continue;
      const L = CadCore.layer(s.doc, f.layer);
      if (L && !L.visible) continue;
      const sel = s.selection.includes(f.id);
      if (!sel && !showAll) continue;
      for (const p of f.pts) {
        const q = this.toScreen(p);
        const isSelPt = selPt && Math.abs(p.x - selPt.x) < 1e-6 && Math.abs(p.y - selPt.y) < 1e-6;
        ctx.beginPath();
        if (isSelPt) {
          ctx.rect(q.x - 5.5, q.y - 5.5, 11, 11);
          ctx.fillStyle = '#f97316';
        } else {
          ctx.rect(q.x - 3.5, q.y - 3.5, 7, 7);
          ctx.fillStyle = sel ? '#2563eb' : '#ffffff';
        }
        ctx.fill();
        ctx.strokeStyle = isSelPt ? '#ffffff' : (sel ? '#ffffff' : '#64748b');
        ctx.lineWidth = isSelPt ? 2 : 1.4;
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  _drawTemp(ctx) {
    const s = this.state;

    // নির্বাচনের ঘের
    if (s.rubber) {
      const r = s.rubber;
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.fillStyle = 'rgba(37,99,235,0.10)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([5, 4]);
      const x = Math.min(r.x0, r.x1), y = Math.min(r.y0, r.y1);
      const w = Math.abs(r.x1 - r.x0), h = Math.abs(r.y1 - r.y0);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    const pts = s.scalePts.length ? s.scalePts : s.splitPts;
    if (!pts.length) return;
    const col = s.scalePts.length ? '#f97316' : '#7c3aed';
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const q = this.toScreen(p);
      if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    pts.forEach(p => {
      const q = this.toScreen(p);
      ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.restore();
  },

  _chip(ctx, text, x, y, color) {
    ctx.save();
    ctx.font = '700 11px "Noto Sans Bengali", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(x - w / 2 - 4, y - 8, w + 8, 16);
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2 - 4, y - 8, w + 8, 16);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  },

  /** নিচের কোণায় স্কেল-দণ্ড — কতটুকু দূরত্ব কত পিক্সেল, চোখে দেখা যায় */
  _drawScaleBar(ctx, W, H) {
    const s = this.state;
    const k = s.doc.ftPerPx;
    if (!(k > 0)) return;

    const targetPx = 130;
    const feet = targetPx / s.scale * k;
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    let step = nice[nice.length - 1];
    for (const n of nice) if (n >= feet) { step = n; break; }
    const barPx = step / k * s.scale;
    if (!isFinite(barPx) || barPx < 20 || barPx > W * 0.6) return;

    const x = 14, y = H - 22;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(x - 6, y - 16, barPx + 70, 30);
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + barPx, y);
    ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5);
    ctx.moveTo(x + barPx, y - 5); ctx.lineTo(x + barPx, y + 5);
    ctx.moveTo(x + barPx / 2, y - 3); ctx.lineTo(x + barPx / 2, y + 3);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 11px "Noto Sans Bengali", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(CadCore.bn(step) + ' ফুট', x + barPx + 8, y);
    ctx.restore();
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CadView;
