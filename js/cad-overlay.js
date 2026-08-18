/* ==========================================================================
   cad-overlay.js — পেন্টাগ্রাফ (দুই জরিপের নকশা মিলিয়ে দেখা)
   --------------------------------------------------------------------------
   পেন্টাগ্রাফ কাজটি আসলে কী
     পুরনো জরিপের (সি.এস) দাগের ভেতর নতুন জরিপে (বি.এস) কোন কোন দাগ পড়েছে
     এবং কতটুকু পড়েছে — সেটি বের করা। এক বি.এস দাগ দুই সি.এস দাগে ভাগ হয়ে
     গেলে শিটে লেখা হয় "৩০.১৮ এর ১৬.০১ শতাংশ" — অর্থাৎ মোট ৩০.১৮ শতাংশের
     মধ্যে ১৬.০১ শতাংশ এই সি.এস দাগে।

   এর জন্য দুই বহুভুজের **ছেদ (intersection)** বের করতে হয়। দাগ অবতল
   (concave) হতে পারে, তাই সরাসরি Sutherland–Hodgman চলে না। সমাধান:
     ১. ছাঁচ-বহুভুজকে কান-কাটা (ear clipping) দিয়ে ত্রিভুজে ভাঙা
     ২. প্রতিটি ত্রিভুজ উত্তল — তার সাথে Sutherland–Hodgman
     ৩. টুকরোগুলোর ক্ষেত্রফল যোগ

   DOM ছোঁয় না।
   ========================================================================== */

const CadOverlay = {

  EPS: 1e-9,

  /* ==================== ১. ত্রিভুজে ভাঙা (ear clipping) ==================== */

  /** বহুভুজ → ত্রিভুজের তালিকা [[p,p,p], ...] */
  triangulate(poly) {
    const pts = CadCore.dedupe(poly.slice(), 1e-6);
    if (pts.length < 3) return [];
    // ঘড়ির উল্টো দিকে সাজাই — কান-কাটার নিয়ম তখন সরল
    const ring = CadCore.signedArea(pts) > 0 ? pts.slice().reverse() : pts.slice();
    const idx = ring.map((_, i) => i);
    const out = [];
    let guard = ring.length * ring.length + 64;

    while (idx.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let i = 0; i < idx.length; i++) {
        const ia = idx[(i - 1 + idx.length) % idx.length];
        const ib = idx[i];
        const ic = idx[(i + 1) % idx.length];
        const a = ring[ia], b = ring[ib], c = ring[ic];

        // উত্তল কোণ? (ccw এ ক্রস < ০ হলে উত্তল, কারণ y নিচমুখী)
        const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        if (cross >= -this.EPS) continue;

        // ভেতরে অন্য কোনো কোণা আছে কি?
        let bad = false;
        for (const j of idx) {
          if (j === ia || j === ib || j === ic) continue;
          if (this._inTriangle(ring[j], a, b, c)) { bad = true; break; }
        }
        if (bad) continue;

        out.push([a, b, c]);
        idx.splice(i, 1);
        clipped = true;
        break;
      }
      if (!clipped) break;                       // আটকে গেলে (স্ব-ছেদী) থামি
    }
    if (idx.length === 3) out.push([ring[idx[0]], ring[idx[1]], ring[idx[2]]]);
    return out;
  },

  _inTriangle(p, a, b, c) {
    const d1 = (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
    const d2 = (p.x - c.x) * (b.y - c.y) - (b.x - c.x) * (p.y - c.y);
    const d3 = (p.x - a.x) * (c.y - a.y) - (c.x - a.x) * (p.y - a.y);
    const neg = (d1 < -this.EPS) || (d2 < -this.EPS) || (d3 < -this.EPS);
    const pos = (d1 > this.EPS) || (d2 > this.EPS) || (d3 > this.EPS);
    return !(neg && pos);
  },

  /* ==================== ২. উত্তল ছাঁচে কাটা (Sutherland–Hodgman) ==================== */

  /**
   * subject বহুভুজকে উত্তল convex ছাঁচ দিয়ে কাটা
   * subject অবতল হলেও ক্ষেত্রফল ঠিক আসে।
   */
  clipConvex(subject, convex) {
    let out = subject.slice();
    const n = convex.length;
    // ছাঁচটি ccw ধরে নিই
    const clip = CadCore.signedArea(convex) > 0 ? convex.slice().reverse() : convex.slice();

    for (let i = 0; i < n && out.length; i++) {
      const a = clip[i], b = clip[(i + 1) % n];
      const input = out;
      out = [];
      // ccw (y নিচমুখী) এ ভেতরের দিক: ক্রস < ০
      const side = p => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

      for (let j = 0; j < input.length; j++) {
        const cur = input[j], prev = input[(j - 1 + input.length) % input.length];
        const sCur = side(cur), sPrev = side(prev);
        const inCur = sCur <= this.EPS, inPrev = sPrev <= this.EPS;

        if (inCur) {
          if (!inPrev) out.push(this._lineCross(prev, cur, sPrev, sCur));
          out.push(cur);
        } else if (inPrev) {
          out.push(this._lineCross(prev, cur, sPrev, sCur));
        }
      }
    }
    return out;
  },

  _lineCross(p, q, sp, sq) {
    const t = sp / (sp - sq);
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  },

  /* ==================== ৩. ছেদ ==================== */

  /**
   * দুই বহুভুজের ছেদের টুকরোগুলো
   * @returns {Array<Array<{x,y}>>}
   */
  intersectParts(a, b) {
    if (!a || !b || a.length < 3 || b.length < 3) return [];
    // দ্রুত বাদ — ঘের না ছুঁলে ছেদ নেই
    const ba = CadCore.bbox(a), bb = CadCore.bbox(b);
    if (ba.x > bb.x + bb.w || bb.x > ba.x + ba.w ||
        ba.y > bb.y + bb.h || bb.y > ba.y + ba.h) return [];

    const parts = [];
    for (const tri of this.triangulate(b)) {
      const piece = this.clipConvex(a, tri);
      if (piece.length >= 3 && CadCore.area(piece) > this.EPS) parts.push(piece);
    }
    return parts;
  },

  /** দুই বহুভুজের ছেদের ক্ষেত্রফল (পিক্সেল²) */
  intersectArea(a, b) {
    let s = 0;
    for (const p of this.intersectParts(a, b)) s += CadCore.area(p);
    return s;
  },

  /* ==================== ৪. পেন্টাগ্রাফ টেবিল ==================== */

  /**
   * পুরনো জরিপের প্রতিটি দাগের ভেতরে নতুন জরিপের কোন কোন দাগ পড়েছে
   *
   * @param {object} doc        নথি
   * @param {string} baseLayer  পুরনো জরিপের লেয়ার (যেমন 'cs')
   * @param {string} overLayer  নতুন জরিপের লেয়ার (যেমন 'bs')
   * @param {object} opt        { minFrac: এত ভাগের কম ছেদ হলে ধরব না }
   * @returns {Array} সারি — শিটের টেবিলে যেভাবে ছাপা হবে
   */
  pentagraph(doc, baseLayer, overLayer, opt) {
    const o = opt || {};
    const minFrac = o.minFrac == null ? 0.01 : o.minFrac;
    const k = doc.ftPerPx || 0;
    const toSatak = px => (k > 0 ? px * k * k : 0) / CadCore.SQFT_PER_SATAK;

    const act = CadCore.activeFeatures(doc);
    const base = act.filter(f => f.layer === baseLayer && f.closed && f.pts.length >= 3);
    const over = act.filter(f => f.layer === overLayer && f.closed && f.pts.length >= 3);

    // নতুন জরিপের প্রতিটি দাগের **মোট** ক্ষেত্রফল (আংশিক ছেদ বোঝাতে লাগে)
    const overTotal = new Map();
    for (const f of over) {
      const m = CadCore.measure(doc, f);
      overTotal.set(f.id, m.sqft / CadCore.SQFT_PER_SATAK);
    }

    const rows = [];
    for (const bf of base) {
      const bm = CadCore.measure(doc, bf);
      const baseSatak = bm.sqft / CadCore.SQFT_PER_SATAK;
      const items = [];

      for (const of_ of over) {
        const interPx = this.intersectArea(of_.pts, bf.pts);
        if (interPx <= 0) continue;
        const part = toSatak(interPx);
        const whole = overTotal.get(of_.id) || 0;
        if (whole > 0 && part / whole < minFrac) continue;
        if (part < 0.005) continue;

        items.push({
          dag: of_.dag || '—',
          featureId: of_.id,
          part,                                 // এই দাগে যতটুকু পড়েছে
          whole,                                // ঐ দাগের মোট
          partial: whole > 0 && (part / whole) < 0.985
        });
      }

      items.sort((x, y) => y.part - x.part);
      const sum = items.reduce((s, it) => s + it.part, 0);

      rows.push({
        dag: bf.dag || '—',
        featureId: bf.id,
        satak: baseSatak,
        items,
        total: sum,
        diff: baseSatak - sum
      });
    }
    rows.sort((a, b) => b.satak - a.satak);
    return rows;
  },

  /**
   * পেন্টাগ্রাফ সারি → শিটে ছাপার মতো লেখা
   * "৩০.১৮ এর ১৬.০১ শতাংশ" — নমুনা শিটের হুবহু ধরন
   */
  itemText(it, opts) {
    const o = opts || {};
    const bn = v => CadCore.bn(v.toFixed(2));
    if (it.partial && it.whole > 0) {
      return bn(it.whole) + ' এর ' + bn(it.part) + (o.bare ? '' : ' শতাংশ');
    }
    return bn(it.part) + (o.bare ? '' : ' শতাংশ');
  },

  /* ==================== ৫. দাগ ভাগ (বিভাজন) ==================== */

  /**
   * একটি দাগের ভেতরে হিস্যা অনুযায়ী ভাগ করার সরল সহায়তা —
   * একটি রেখা টেনে দাগটিকে দুই ভাগে কাটা।
   *
   * @returns {{left:Array, right:Array}|null}
   */
  splitByLine(poly, a, b) {
    if (!poly || poly.length < 3) return null;
    const side = p => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const left = [], right = [];

    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], nxt = poly[(i + 1) % poly.length];
      const sc = side(cur), sn = side(nxt);
      if (sc <= 0) left.push(cur);
      if (sc >= 0) right.push(cur);
      if ((sc < 0 && sn > 0) || (sc > 0 && sn < 0)) {
        const p = this._lineCross(cur, nxt, sc, sn);
        left.push(p); right.push(p);
      }
    }
    if (left.length < 3 || right.length < 3) return null;
    return { left, right };
  },

  /**
   * অনুপাত ধরে দাগ কাটা — নির্দিষ্ট দিকে রেখা সরিয়ে সরিয়ে
   * কাঙ্ক্ষিত ক্ষেত্রফল পাওয়া (দ্বিভাজন পদ্ধতি)
   *
   * @param {Array} poly     দাগ
   * @param {number} frac    প্রথম ভাগে মোট ক্ষেত্রফলের কত অংশ (০–১)
   * @param {number} angle   কাটার রেখার কোণ (রেডিয়ান)
   */
  splitByFraction(poly, frac, angle) {
    const total = CadCore.area(poly);
    if (!(total > 0)) return null;
    const target = total * Math.max(0.001, Math.min(0.999, frac));
    const ux = Math.cos(angle), uy = Math.sin(angle);        // রেখার দিক
    const nx = -uy, ny = ux;                                  // লম্ব

    /* ★ দ্বিভাজনের সীমা দাগের প্রকৃত বিস্তার ধরে
       আগে সীমা ছিল কেন্দ্র থেকে ±span, আর রেখা দাগের বাইরে চলে গেলে
       (`splitByLine` → null) নিঃশর্তে `lo = t` করা হতো। কিন্তু ধনাত্মক
       পাশে বেরিয়ে গেলে বাঁ ভাগ = পুরো দাগ, অর্থাৎ **বেশি** — তখন `hi`
       নামানো উচিত ছিল। ফলে অনুসন্ধান বাইরে বেরিয়ে আর ফিরত না, আর
       `best` থেকে যেত প্রথম চেষ্টাটাই (t=০, ঠিক অর্ধেক)।
       তাই **হিস্যা অর্ধেকের বেশি হলেই ভাগ সমান হয়ে যেত** — ১২:৪ আনা
       দিলেও ৮:৮ বেরোত। এখন সীমা [tmin, tmax] — রেখা সবসময় দাগের ভেতরেই। */
    let tmin = Infinity, tmax = -Infinity;
    for (const p of poly) {
      const t = p.x * nx + p.y * ny;
      if (t < tmin) tmin = t;
      if (t > tmax) tmax = t;
    }
    if (!(tmax - tmin > 1e-9)) return null;

    let lo = tmin, hi = tmax, best = null, bestErr = Infinity;
    for (let iter = 0; iter < 60; iter++) {
      const t = (lo + hi) / 2;
      const px = nx * t, py = ny * t;                 // ঐ রেখার একটি বিন্দু
      const cut = this.splitByLine(poly, { x: px, y: py },
                                         { x: px + ux, y: py + uy });
      if (!cut) {
        // প্রান্তঘেঁষা — কোন পাশে বেরিয়েছে সেটি দেখে দিক ঠিক করি
        if (t - tmin < tmax - t) lo = t; else hi = t;
        continue;
      }
      const aArea = CadCore.area(cut.left);
      const err = Math.abs(aArea - target);
      if (err < bestErr) { bestErr = err; best = cut; }
      if (err < target * 0.0005) break;
      if (aArea < target) lo = t; else hi = t;
    }
    return best;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CadOverlay;
