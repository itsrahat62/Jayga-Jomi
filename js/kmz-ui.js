/* ==========================================================================
   kmz-ui.js — KMZ টুলের ইন্টারঅ্যাকটিভ অংশ
   --------------------------------------------------------------------------
   দুটি প্যানেল পাশাপাশি:
     বাঁয়ে  — মৌজা ম্যাপের ছবি (জুম/প্যান, ক্লিক করে বিন্দু বসানো)
     ডানে  — স্যাটেলাইট টাইল (একই ভাবে)
   দুই পাশে জোড়া বিন্দু বসালে ক্যালিব্রেশন হয়।

   ★ কোনো ম্যাপ লাইব্রেরি ব্যবহার করা হয়নি
     স্লিপি-ম্যাপের গণিত সরল (Web Mercator), তাই নিজেরাই আঁকা হয়েছে।
     টাইল উৎস Esri World Imagery — API key লাগে না, CORS `*`।
     গণিত KmzExport এ, এখানে কেবল আঁকা ও ইনপুট।
   ========================================================================== */

const KmzMap = {

  /* টাইল উৎস — key ছাড়া, CORS `*` (৩০ জুলাই ২০২৬ এ যাচাই করা) */
  TILE: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  ATTRIB: 'Esri, Maxar, Earthstar Geographics',
  TILE_SIZE: 256,
  MIN_Z: 5,
  MAX_Z: 19,

  /* ---------------- Web Mercator রূপান্তর (বিশুদ্ধ ফাংশন) ---------------- */

  /** অক্ষাংশ/দ্রাঘিমাংশ → বিশ্ব-পিক্সেল (জুম z এ) */
  lngLatToWorld(lng, lat, z) {
    const n = this.TILE_SIZE * Math.pow(2, z);
    const x = (lng + 180) / 360 * n;
    const s = Math.sin(lat * Math.PI / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    return { x, y };
  },

  /** বিশ্ব-পিক্সেল → অক্ষাংশ/দ্রাঘিমাংশ */
  worldToLngLat(x, y, z) {
    const n = this.TILE_SIZE * Math.pow(2, z);
    const lng = x / n * 360 - 180;
    const k = Math.PI - 2 * Math.PI * y / n;
    const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(k) - Math.exp(-k)));
    return { lng, lat };
  },

  clampLat(lat) { return Math.max(-85.05112878, Math.min(85.05112878, lat)); },

  /* ---------------- অবস্থা ---------------- */

  state: null,

  /** টাইল ভিউয়ার চালু করা */
  init(canvas, opts) {
    const o = opts || {};
    this.state = {
      canvas,
      ctx: canvas.getContext('2d'),
      z: o.zoom || 16,
      center: { lat: o.lat || 23.7806, lng: o.lng || 90.4074 },   // ঢাকা
      tiles: new Map(),          // key → HTMLImageElement
      pending: new Set(),
      markers: [],               // [{lat, lng, n}]
      drag: null,
      onPick: o.onPick || null
    };
    this._bind();
    this.draw();
    return this.state;
  },

  _bind() {
    const s = this.state, c = s.canvas;
    if (c._kmzBound) return;
    c._kmzBound = true;

    let moved = 0;

    const down = ev => {
      const p = this._pos(ev);
      s.drag = { x: p.x, y: p.y };
      moved = 0;
      c.style.cursor = 'grabbing';
    };
    const move = ev => {
      if (!s.drag) return;
      const p = this._pos(ev);
      const dx = p.x - s.drag.x, dy = p.y - s.drag.y;
      moved += Math.abs(dx) + Math.abs(dy);
      s.drag = { x: p.x, y: p.y };
      const w = this.lngLatToWorld(s.center.lng, s.center.lat, s.z);
      const g = this.worldToLngLat(w.x - dx, w.y - dy, s.z);
      s.center = { lat: this.clampLat(g.lat), lng: g.lng };
      this.draw();
      if (ev.cancelable) ev.preventDefault();
    };
    const up = ev => {
      const wasDrag = moved > 6;
      s.drag = null;
      c.style.cursor = 'crosshair';
      if (!wasDrag && s.onPick) {
        const p = this._pos(ev);
        s.onPick(this.pixelToLngLat(p.x, p.y));
      }
    };

    c.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    c.addEventListener('touchstart', e => down(e.touches[0]), { passive: true });
    c.addEventListener('touchmove', e => { move(e.touches[0]); }, { passive: false });
    c.addEventListener('touchend', e => up(e.changedTouches[0]));

    c.addEventListener('wheel', ev => {
      ev.preventDefault();
      this.zoomBy(ev.deltaY < 0 ? 1 : -1, this._pos(ev));
    }, { passive: false });
  },

  _pos(ev) {
    const r = this.state.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  },

  /** ক্যানভাসের পিক্সেল → ভূ-স্থানাঙ্ক */
  pixelToLngLat(px, py) {
    const s = this.state, c = s.canvas;
    const w = this.lngLatToWorld(s.center.lng, s.center.lat, s.z);
    return this.worldToLngLat(w.x + (px - c.width / 2), w.y + (py - c.height / 2), s.z);
  },

  /** ভূ-স্থানাঙ্ক → ক্যানভাসের পিক্সেল */
  lngLatToPixel(lng, lat) {
    const s = this.state, c = s.canvas;
    const w = this.lngLatToWorld(s.center.lng, s.center.lat, s.z);
    const p = this.lngLatToWorld(lng, lat, s.z);
    return { x: p.x - w.x + c.width / 2, y: p.y - w.y + c.height / 2 };
  },

  /** জুম বদলানো — কার্সরের নিচের জায়গা স্থির রেখে */
  zoomBy(d, anchor) {
    const s = this.state;
    const nz = Math.max(this.MIN_Z, Math.min(this.MAX_Z, s.z + d));
    if (nz === s.z) return;
    const a = anchor ? this.pixelToLngLat(anchor.x, anchor.y) : s.center;
    s.z = nz;
    if (anchor) {
      // anchor একই পর্দা-বিন্দুতে রাখতে কেন্দ্র সরানো
      const c = s.canvas;
      const wa = this.lngLatToWorld(a.lng, a.lat, nz);
      const g = this.worldToLngLat(wa.x - (anchor.x - c.width / 2),
                                   wa.y - (anchor.y - c.height / 2), nz);
      s.center = { lat: this.clampLat(g.lat), lng: g.lng };
    }
    this.draw();
  },

  setCenter(lat, lng, z) {
    const s = this.state;
    s.center = { lat: this.clampLat(lat), lng };
    if (z) s.z = Math.max(this.MIN_Z, Math.min(this.MAX_Z, z));
    this.draw();
  },

  setMarkers(list) { this.state.markers = list || []; this.draw(); },

  /* ---------------- আঁকা ---------------- */

  tileUrl(z, x, y) {
    return this.TILE.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  },

  draw() {
    const s = this.state;
    if (!s) return;
    const { ctx, canvas: c } = s;
    const W = c.width, H = c.height;

    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, W, H);

    const n = Math.pow(2, s.z);
    const w = this.lngLatToWorld(s.center.lng, s.center.lat, s.z);
    const originX = w.x - W / 2, originY = w.y - H / 2;
    const t0x = Math.floor(originX / this.TILE_SIZE);
    const t0y = Math.floor(originY / this.TILE_SIZE);
    const t1x = Math.floor((originX + W) / this.TILE_SIZE);
    const t1y = Math.floor((originY + H) / this.TILE_SIZE);

    for (let ty = t0y; ty <= t1y; ty++) {
      if (ty < 0 || ty >= n) continue;
      for (let tx = t0x; tx <= t1x; tx++) {
        const wx = ((tx % n) + n) % n;                   // দ্রাঘিমাংশে মোড়ানো
        const key = s.z + '/' + wx + '/' + ty;
        const dx = tx * this.TILE_SIZE - originX;
        const dy = ty * this.TILE_SIZE - originY;
        const img = s.tiles.get(key);
        if (img && img.complete && img.naturalWidth) {
          ctx.drawImage(img, dx, dy, this.TILE_SIZE, this.TILE_SIZE);
        } else {
          ctx.fillStyle = '#111827';
          ctx.fillRect(dx, dy, this.TILE_SIZE, this.TILE_SIZE);
          this._load(key, s.z, wx, ty);
        }
      }
    }

    // চিহ্ন
    s.markers.forEach(m => {
      const p = this.lngLatToPixel(m.lng, m.lat);
      this._marker(ctx, p.x, p.y, m.n, m.current);
    });

    // কৃতজ্ঞতা (টাইল উৎসের শর্ত)
    ctx.font = '11px sans-serif';
    const txt = '© ' + this.ATTRIB;
    const tw = ctx.measureText(txt).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W - tw - 10, H - 18, tw + 10, 18);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(txt, W - tw - 5, H - 5);
  },

  /**
   * নিয়ন্ত্রণ বিন্দুর চিহ্ন
   * সর্বশেষ বসানোটি **লাল পিন**, আগেরগুলো **নীল বৃত্ত** — এতে বোঝা যায়
   * এইমাত্র কোনটি বসল, আর ক্রমও চোখে পড়ে।
   */
  _marker(ctx, x, y, n, current) {
    ctx.save();
    const col = current ? '#ef4444' : '#2563eb';

    if (current) {
      // পিনের ফলা
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y - 11);
      ctx.lineTo(x + 6, y - 11);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    }

    const cy = current ? y - 18 : y;
    ctx.beginPath(); ctx.arc(x, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();

    // ঠিক কোন পিক্সেলে বসেছে তা বোঝাতে ক্রসহেয়ার
    ctx.beginPath();
    ctx.moveTo(x - 13, y); ctx.lineTo(x + 13, y);
    ctx.moveTo(x, y - 13); ctx.lineTo(x, y + 13);
    ctx.strokeStyle = current ? 'rgba(239,68,68,0.9)' : 'rgba(37,99,235,0.75)';
    ctx.lineWidth = 1; ctx.stroke();

    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x, cy + 0.5);
    ctx.restore();
  },

  _load(key, z, x, y) {
    const s = this.state;
    if (s.pending.has(key)) return;
    s.pending.add(key);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { s.tiles.set(key, img); s.pending.delete(key); this.draw(); };
    img.onerror = () => { s.pending.delete(key); };
    img.src = this.tileUrl(z, x, y);
    // ক্যাশ বেশি বড় হতে দেব না
    if (s.tiles.size > 400) {
      const first = s.tiles.keys().next().value;
      s.tiles.delete(first);
    }
  }
};

/* ==========================================================================
   KmzImage — মৌজা ম্যাপের ছবির ভিউয়ার (জুম · প্যান · বিন্দু বসানো)
   ক্লিক করলে ছবির **আসল পিক্সেল স্থানাঙ্ক** ফেরত দেয় (পর্দার নয়) —
   কারণ ক্যালিব্রেশন আসল পিক্সেলের উপর হয়, জুমের উপর নয়।
   ========================================================================== */

const KmzImage = {

  state: null,

  init(canvas, opts) {
    const o = opts || {};
    this.state = {
      canvas,
      ctx: canvas.getContext('2d'),
      img: null,
      scale: 1,
      off: { x: 0, y: 0 },       // ছবির কোন বিন্দু ক্যানভাসের (০,০) এ
      markers: [],
      drag: null,
      onPick: o.onPick || null
    };
    this._bind();
    this.draw();
    return this.state;
  },

  /** ছবি বসানো ও পুরোটা দেখা যায় এমন জুমে ফিট করা */
  setImage(img) {
    const s = this.state;
    s.img = img;
    s.markers = [];
    this.fit();
  },

  fit() {
    const s = this.state;
    if (!s.img) { this.draw(); return; }
    const c = s.canvas;
    s.scale = Math.min(c.width / s.img.width, c.height / s.img.height) * 0.96;
    s.off = {
      x: (c.width - s.img.width * s.scale) / 2,
      y: (c.height - s.img.height * s.scale) / 2
    };
    this.draw();
  },

  _bind() {
    const s = this.state, c = s.canvas;
    if (c._kmzImgBound) return;
    c._kmzImgBound = true;
    let moved = 0;

    const down = ev => { const p = this._pos(ev); s.drag = p; moved = 0; c.style.cursor = 'grabbing'; };
    const move = ev => {
      if (!s.drag) return;
      const p = this._pos(ev);
      const dx = p.x - s.drag.x, dy = p.y - s.drag.y;
      moved += Math.abs(dx) + Math.abs(dy);
      s.off.x += dx; s.off.y += dy;
      s.drag = p;
      this.draw();
      if (ev.cancelable) ev.preventDefault();
    };
    const up = ev => {
      const wasDrag = moved > 6;
      s.drag = null;
      c.style.cursor = 'crosshair';
      if (!wasDrag && s.onPick && s.img) {
        const p = this._pos(ev);
        const ip = this.canvasToImage(p.x, p.y);
        // ছবির বাইরে ক্লিক করলে বিন্দু বসবে না
        if (ip.x >= 0 && ip.y >= 0 && ip.x <= s.img.width && ip.y <= s.img.height) {
          s.onPick(ip);
        }
      }
    };

    c.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    c.addEventListener('touchstart', e => down(e.touches[0]), { passive: true });
    c.addEventListener('touchmove', e => move(e.touches[0]), { passive: false });
    c.addEventListener('touchend', e => up(e.changedTouches[0]));
    c.addEventListener('wheel', ev => {
      ev.preventDefault();
      this.zoomAt(this._pos(ev), ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
  },

  _pos(ev) {
    const r = this.state.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  },

  /** ক্যানভাস পিক্সেল → ছবির আসল পিক্সেল */
  canvasToImage(cx, cy) {
    const s = this.state;
    return { x: (cx - s.off.x) / s.scale, y: (cy - s.off.y) / s.scale };
  },

  /** ছবির আসল পিক্সেল → ক্যানভাস পিক্সেল */
  imageToCanvas(ix, iy) {
    const s = this.state;
    return { x: ix * s.scale + s.off.x, y: iy * s.scale + s.off.y };
  },

  zoomAt(anchor, factor) {
    const s = this.state;
    const before = this.canvasToImage(anchor.x, anchor.y);
    s.scale = Math.max(0.02, Math.min(40, s.scale * factor));
    const after = this.imageToCanvas(before.x, before.y);
    s.off.x += anchor.x - after.x;
    s.off.y += anchor.y - after.y;
    this.draw();
  },

  setMarkers(list) { this.state.markers = list || []; this.draw(); },

  draw() {
    const s = this.state;
    if (!s) return;
    const { ctx, canvas: c } = s;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, c.width, c.height);

    if (!s.img) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ম্যাপের ছবি দিন', c.width / 2, c.height / 2);
      ctx.textAlign = 'left';
      return;
    }

    ctx.imageSmoothingEnabled = s.scale < 3;      // বেশি জুমে পিক্সেল স্পষ্ট থাক
    ctx.drawImage(s.img, s.off.x, s.off.y, s.img.width * s.scale, s.img.height * s.scale);

    s.markers.forEach(m => {
      const p = this.imageToCanvas(m.x, m.y);
      KmzMap._marker(ctx, p.x, p.y, m.n, m.current);
    });
  }
};

/* Node এ টেস্টের জন্য — KmzMap ই মূল রপ্তানি, KmzImage সাথে যুক্ত */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KmzMap;
  module.exports.KmzMap = KmzMap;
  module.exports.KmzImage = KmzImage;
}
