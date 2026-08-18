/* ==========================================================================
   cad-core.js — ডিজিটাল সার্ভে (CAD) এর ভিত্তি
   --------------------------------------------------------------------------
   এখানে কেবল **গণিত ও নথি-মডেল** — DOM ছোঁয় না, তাই Node এ পরীক্ষা করা যায়।

   কী কী আছে
     ১. স্কেল      — "১২০\" = ১ মাইল" ধরনের মৌজা স্কেল ↔ ফুট/পিক্সেল
     ২. একক        — বর্গফুট ↔ শতাংশ/কাঠা/বিঘা/একর  (LandMath এর ভিত্তি মেনে)
     ৩. লেখা       — ৫৯'-১" ধরনের ফুট-ইঞ্চি, বাংলা অঙ্কে
     ৪. জ্যামিতি   — ক্ষেত্রফল, পরিসীমা, কেন্দ্র, সরলীকরণ, স্ন্যাপ
     ৫. নথি        — লেয়ার, ফিচার (দাগ), মেটা (জেলা/মৌজা/জে.এল.)

   ★ কেন আলাদা "লেখচিত্র একক" (drawing unit)
     নকশা আঁকা হয় **ছবির পিক্সেলে**। ছবির পিক্সেল থেকে মাটির ফুট বের হয়
     একটিমাত্র সংখ্যা দিয়ে — ftPerPx। সেটি দুই পথে পাওয়া যায়:
       ক. মৌজা স্কেল + PDF এর DPI  (নির্ভুল, যদি স্ক্যান বিকৃত না হয়)
       খ. চেনা দূরত্ব ধরে ক্যালিব্রেশন (দুই ক্লিক + মাপ) — বেশি নির্ভরযোগ্য
   ========================================================================== */

const CadCore = {

  /* ==================== ১. মৌজা নকশার স্কেল ==================== */

  /**
   * বাংলাদেশে প্রচলিত মৌজা নকশার স্কেল।
   * `inch` = নকশার কত ইঞ্চিতে মাটির ১ মাইল।
   * RF (Representative Fraction) = ৬৩৩৬০ ÷ inch   (১ মাইল = ৬৩,৩৬০ ইঞ্চি)
   */
  SCALES: [
    { inch: 16,  label: '১৬" = ১ মাইল',  note: 'সি.এস / আর.এস মূল নকশা' },
    { inch: 32,  label: '৩২" = ১ মাইল',  note: 'বর্ধিত নকশা' },
    { inch: 64,  label: '৬৪" = ১ মাইল',  note: 'পেন্টাগ্রাফ শিট' },
    { inch: 120, label: '১২০" = ১ মাইল', note: 'ডিমার্কেশন শিট' },
    { inch: 240, label: '২৪০" = ১ মাইল', note: 'অতি বিস্তারিত' }
  ],

  INCHES_PER_MILE: 63360,
  FEET_PER_MILE: 5280,

  /** স্কেল "X\" = ১ মাইল" → নকশার ১ ইঞ্চিতে মাটির কত ফুট */
  feetPerMapInch(scaleInch) {
    const x = Number(scaleInch);
    if (!(x > 0)) throw new Error('স্কেল ০ এর বেশি হতে হবে');
    return this.FEET_PER_MILE / x;
  },

  /** স্কেল → RF হর (১:৩৯৬০ এর ৩৯৬০) */
  rfDenominator(scaleInch) {
    const x = Number(scaleInch);
    if (!(x > 0)) throw new Error('স্কেল ০ এর বেশি হতে হবে');
    return this.INCHES_PER_MILE / x;
  },

  /**
   * নকশার স্কেল ও ছবির DPI থেকে — পিক্সেল প্রতি কত ফুট
   * ছবির ১ ইঞ্চি = dpi পিক্সেল, আর নকশার ১ ইঞ্চি = feetPerMapInch ফুট
   */
  ftPerPxFromScale(scaleInch, dpi) {
    const d = Number(dpi);
    if (!(d > 0)) throw new Error('DPI ০ এর বেশি হতে হবে');
    return this.feetPerMapInch(scaleInch) / d;
  },

  /**
   * চেনা দূরত্ব ধরে ক্যালিব্রেশন — দুই বিন্দুর পিক্সেল-দূরত্ব ও আসল ফুট
   * @returns {number} ftPerPx
   */
  ftPerPxFromKnown(p1, p2, realFeet) {
    const d = this.dist(p1, p2);
    if (!(d > 0)) throw new Error('দুটি বিন্দু একই জায়গায় বসেছে');
    if (!(realFeet > 0)) throw new Error('দূরত্ব ০ এর বেশি হতে হবে');
    return realFeet / d;
  },

  /** ftPerPx ও DPI জানা থাকলে নকশার স্কেল কত ছিল তা ফিরে বের করা */
  scaleInchFrom(ftPerPx, dpi) {
    const f = Number(ftPerPx), d = Number(dpi);
    if (!(f > 0) || !(d > 0)) return null;
    return this.FEET_PER_MILE / (f * d);
  },

  /**
   * নকশার স্কেল ও মাপা ftPerPx থেকে স্ক্যানের DPI বের করা
   *
   * ★ কাজে লাগে যাচাইয়ে
   *   নকশায় ছাপা আছে "স্কেল ১৬" = ১ মাইল"। স্কেল-দণ্ড মেপে ftPerPx পেলে
   *   এখান থেকে স্ক্যানের DPI বেরোয়। সংখ্যাটি অস্বাভাবিক (যেমন ৯০০ বা ৪০)
   *   হলে বোঝা যায় স্কেল-দণ্ড ভুল মাপা হয়েছে — তখনই ধরা পড়ে।
   */
  dpiFrom(ftPerPx, scaleInch) {
    const f = Number(ftPerPx);
    if (!(f > 0)) return null;
    return this.feetPerMapInch(scaleInch) / f;
  },

  /* ==================== ১ক. দূরত্বের একক ====================
     বাংলাদেশের জরিপে চেইন-লিংক ব্যবস্থা (Gunter's chain) চলে, আর
     নকশার স্কেল-দণ্ড প্রায় সবসময় **চেইনে** আঁকা থাকে:
         ১০০ লিংক = ১ চেইন   ·   ৮০ চেইন = ১ মাইল
     তাই ১ চেইন = ৫২৮০ ÷ ৮০ = ৬৬ ফুট, আর ১ লিংক = ০.৬৬ ফুট।
     ======================================================== */

  LENGTH_UNITS: [
    { id: 'chain', name: 'চেইন', ft: 66,   note: '১ চেইন = ৬৬ ফুট (স্কেল-দণ্ডে এটিই থাকে)' },
    { id: 'link',  name: 'লিংক', ft: 0.66, note: '১০০ লিংক = ১ চেইন' },
    { id: 'foot',  name: 'ফুট',  ft: 1,    note: '' },
    { id: 'inch',  name: 'ইঞ্চি', ft: 1 / 12, note: '' },
    { id: 'hat',   name: 'হাত',  ft: 1.5,  note: '১ হাত = ১৮ ইঞ্চি' },
    { id: 'yard',  name: 'গজ',   ft: 3,    note: '১ গজ = ৩ ফুট' },
    { id: 'meter', name: 'মিটার', ft: 3.280839895, note: '' },
    { id: 'mile',  name: 'মাইল', ft: 5280, note: '৮০ চেইন = ১ মাইল' }
  ],

  lengthUnit(id) {
    return this.LENGTH_UNITS.find(u => u.id === id) || this.LENGTH_UNITS[2];
  },

  /** যেকোনো একক → ফুট */
  toFeet(value, unitId) {
    const v = this.num(value);
    if (!isFinite(v)) return NaN;
    return v * this.lengthUnit(unitId).ft;
  },

  /* ==================== ২. ক্ষেত্রফলের একক ==================== */

  SQFT_PER_SATAK: 435.6,
  SQFT_PER_ACRE: 43560,
  SATAK_PER_BIGHA: 33,

  /** কাঠার ভিত্তি LandMath থেকে — না থাকলে ৭২০ বর্গফুট */
  sqftPerKatha() {
    return (typeof LandMath !== 'undefined' && LandMath.SQFT_PER_KATHA)
      ? LandMath.SQFT_PER_KATHA : 720;
  },

  sqftPerBigha() {
    return (typeof LandMath !== 'undefined' && LandMath.SQFT_PER_BIGHA)
      ? LandMath.SQFT_PER_BIGHA : 720 * 20;
  },

  /** বর্গফুট → সব একক একসাথে */
  areaUnits(sqft) {
    const s = Number(sqft) || 0;
    return {
      sqft: s,
      satak: s / this.SQFT_PER_SATAK,
      katha: s / this.sqftPerKatha(),
      bigha: s / this.sqftPerBigha(),
      acre: s / this.SQFT_PER_ACRE,
      sqm: s / 10.7639
    };
  },

  /* ==================== ৩. লেখা সাজানো ==================== */

  /** সংখ্যা বাংলা অঙ্কে (toBn না থাকলেও ভাঙবে না) */
  bn(v) {
    return (typeof toBn === 'function') ? toBn(v) : String(v);
  },

  /**
   * ফুট → ৫৯'-১" ধরনের লেখা (নকশার দাগে যেভাবে লেখা হয়)
   * ইঞ্চি ০ হলে কেবল ৫৩' — শিটে ঠিক এভাবেই লেখা থাকে।
   */
  ftIn(feet, opts) {
    const o = opts || {};
    const v = Number(feet);
    if (!isFinite(v)) return '—';
    const neg = v < 0;
    let ft = Math.floor(Math.abs(v));
    let inch = Math.round((Math.abs(v) - ft) * 12);
    if (inch >= 12) { ft += 1; inch = 0; }
    const en = o.english === true;
    const F = en ? String(ft) : this.bn(ft);
    const I = en ? String(inch) : this.bn(inch);
    const body = inch === 0 ? `${F}'` : `${F}'-${I}"`;
    return (neg ? '-' : '') + body;
  },

  /** বর্গফুট → "৯.০০ শতাংশ" */
  satakText(sqft, opts) {
    const o = opts || {};
    const dec = o.decimals == null ? 2 : o.decimals;
    const v = (Number(sqft) || 0) / this.SQFT_PER_SATAK;
    const num = v.toFixed(dec);
    return (o.english ? num : this.bn(num)) + (o.bare ? '' : ' শতাংশ');
  },

  /**
   * বাংলা অঙ্ক → ইংরেজি অঙ্ক
   *
   * ★ কেন নিজের ভেতরেই রাখা
   *   বাইরের `toEn()` (calculators.js) না থাকলে চুপচাপ ভুল ফল আসত —
   *   "241" লিখে "২৪১" দাগ খুঁজলে মিলত না। তাই রূপান্তরটি এখানেই,
   *   কোনো নির্ভরতা ছাড়া।
   */
  enDigits(s) {
    return String(s == null ? '' : s).replace(/[০-৯]/g,
      d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  },

  /** ইংরেজি/বাংলা যেকোনো অঙ্ককে সংখ্যায় */
  num(text) {
    if (typeof text === 'number') return text;
    const t = this.enDigits(text).replace(/[^\d.\-]/g, '');
    const v = parseFloat(t);
    return isFinite(v) ? v : NaN;
  },

  /* ==================== ৪. জ্যামিতি ==================== */

  dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); },

  /** বহুভুজের পরিসীমা (বন্ধ ধরে) */
  perimeter(pts, closed) {
    if (!pts || pts.length < 2) return 0;
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += this.dist(pts[i - 1], pts[i]);
    if (closed !== false && pts.length > 2) s += this.dist(pts[pts.length - 1], pts[0]);
    return s;
  },

  /** জুতোর-ফিতা সূত্রে ক্ষেত্রফল (চিহ্নসহ) — পিক্সেল² */
  signedArea(pts) {
    if (!pts || pts.length < 3) return 0;
    let s = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      s += a.x * b.y - b.x * a.y;
    }
    return s / 2;
  },

  area(pts) { return Math.abs(this.signedArea(pts)); },

  /** ঘড়ির কাঁটার দিকে কি না (পর্দার স্থানাঙ্কে y নিচমুখী) */
  isClockwise(pts) { return this.signedArea(pts) > 0; },

  /** বহুভুজের ক্রম ঠিক করা — সবসময় একই দিকে */
  ensureCcw(pts) {
    return this.isClockwise(pts) ? pts.slice().reverse() : pts.slice();
  },

  /** বহুভুজের ভরকেন্দ্র (ক্ষেত্রফল-ভারিত) */
  centroid(pts) {
    if (!pts || !pts.length) return { x: 0, y: 0 };
    if (pts.length < 3) {
      return {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length
      };
    }
    let cx = 0, cy = 0, a = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const f = p.x * q.y - q.x * p.y;
      a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
    }
    a *= 3;
    if (Math.abs(a) < 1e-9) {
      return {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length
      };
    }
    return { x: cx / a, y: cy / a };
  },

  /** বিন্দুটি বহুভুজের ভেতরে? (রশ্মি-নিক্ষেপ) */
  pointInPolygon(pt, pts) {
    if (!pts || pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      const hit = ((yi > pt.y) !== (yj > pt.y)) &&
                  (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  },

  /** বিন্দু থেকে রেখাংশের সবচেয়ে কাছের বিন্দু */
  closestOnSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { x: a.x, y: a.y, t: 0 };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return { x: a.x + t * dx, y: a.y + t * dy, t };
  },

  /**
   * দাগ নম্বর কোথায় লিখব — "ভেতরের সবচেয়ে খোলা জায়গা"
   *
   * ভরকেন্দ্র অবতল (concave) বহুভুজে বাইরে পড়তে পারে — তখন নম্বরটি
   * পাশের দাগে গিয়ে বসে। তাই গ্রিড ধরে ভেতরের এমন বিন্দু খোঁজা হয় যেটি
   * কিনারা থেকে সবচেয়ে দূরে (pole of inaccessibility এর সরল রূপ)।
   */
  labelPoint(pts) {
    const c = this.centroid(pts);
    if (this.pointInPolygon(c, pts)) {
      // ভরকেন্দ্র ভেতরে থাকলেও সরু অংশে পড়তে পারে — কিনারার দূরত্ব দেখি
      if (this.distToEdge(c, pts) > this._extent(pts).min * 0.06) return c;
    }
    const bb = this.bbox(pts);
    let best = c, bestD = -1;
    const N = 24;
    for (let i = 1; i < N; i++) {
      for (let j = 1; j < N; j++) {
        const p = { x: bb.x + bb.w * i / N, y: bb.y + bb.h * j / N };
        if (!this.pointInPolygon(p, pts)) continue;
        const d = this.distToEdge(p, pts);
        if (d > bestD) { bestD = d; best = p; }
      }
    }
    return bestD > 0 ? best : c;
  },

  /** বিন্দু থেকে বহুভুজের কিনারার নিকটতম দূরত্ব */
  distToEdge(p, pts) {
    let best = Infinity;
    for (let i = 0, n = pts.length; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const q = this.closestOnSegment(p, a, b);
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < best) best = d;
    }
    return best;
  },

  bbox(pts) {
    if (!pts || !pts.length) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  },

  _extent(pts) {
    const b = this.bbox(pts);
    return { min: Math.min(b.w, b.h), max: Math.max(b.w, b.h) };
  },

  /** একাধিক বহুভুজের সম্মিলিত ঘের */
  bboxAll(list) {
    const all = [];
    for (const pts of list) if (pts && pts.length) all.push(...pts);
    return this.bbox(all);
  },

  /* ---------------- সরলীকরণ ---------------- */

  /**
   * Douglas–Peucker — অতিরিক্ত বিন্দু ছেঁটে ফেলা
   * স্বয়ংক্রিয় ট্রেসিং থেকে হাজারো বিন্দু আসে; দাগের কিনারা আসলে
   * কয়েকটি সরলরেখা, তাই ছাঁটাই না করলে ফাইল ভারী ও কুৎসিত হয়।
   */
  simplifyDP(pts, eps) {
    if (!pts || pts.length < 3) return (pts || []).slice();
    const e = eps > 0 ? eps : 1;
    const keep = new Uint8Array(pts.length);
    keep[0] = 1; keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];

    while (stack.length) {
      const [s, t] = stack.pop();
      if (t <= s + 1) continue;
      const a = pts[s], b = pts[t];
      let far = -1, farD = -1;
      for (let i = s + 1; i < t; i++) {
        const q = this.closestOnSegment(pts[i], a, b);
        const d = Math.hypot(pts[i].x - q.x, pts[i].y - q.y);
        if (d > farD) { farD = d; far = i; }
      }
      if (farD > e && far > 0) {
        keep[far] = 1;
        stack.push([s, far], [far, t]);
      }
    }
    const out = [];
    for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
    return out;
  },

  /** বন্ধ রিং এর জন্য DP — শুরুর বিন্দু যাতে কোণায় পড়ে সেভাবে ঘোরানো */
  simplifyRing(pts, eps) {
    if (!pts || pts.length < 4) return (pts || []).slice();
    // সবচেয়ে দূরের দুই বিন্দু ধরে রিং ভেঙে দুই ভাগে DP
    const c = this.centroid(pts);
    let far = 0, farD = -1;
    for (let i = 0; i < pts.length; i++) {
      const d = this.dist(c, pts[i]);
      if (d > farD) { farD = d; far = i; }
    }
    const rot = pts.slice(far).concat(pts.slice(0, far));
    let half = 0, halfD = -1;
    for (let i = 1; i < rot.length; i++) {
      const d = this.dist(rot[0], rot[i]);
      if (d > halfD) { halfD = d; half = i; }
    }
    const a = this.simplifyDP(rot.slice(0, half + 1), eps);
    const b = this.simplifyDP(rot.slice(half), eps);
    const out = a.concat(b.slice(1, -1));
    return out.length >= 3 ? out : rot;
  },

  /**
   * প্রায়-সরল পরপর বাহু জোড়া লাগানো
   * DP এর পরও স্ক্যানের কাঁপুনিতে ২–৩ ডিগ্রির ভাঁজ থেকে যায়। মৌজা দাগের
   * কিনারা বাস্তবে সরল — তাই ছোট কোণ মুছে দিলে ছাপা শিট পরিষ্কার দেখায়।
   */
  straighten(pts, angleDeg, closed) {
    if (!pts || pts.length < 3) return (pts || []).slice();
    const lim = Math.cos((angleDeg == null ? 8 : angleDeg) * Math.PI / 180);
    const isClosed = closed !== false;
    let out = pts.slice();

    for (let pass = 0; pass < 3; pass++) {
      const next = [];
      const n = out.length;
      for (let i = 0; i < n; i++) {
        if (!isClosed && (i === 0 || i === n - 1)) { next.push(out[i]); continue; }
        const p = out[i];
        const a = out[(i - 1 + n) % n], b = out[(i + 1) % n];
        const v1x = p.x - a.x, v1y = p.y - a.y;
        const v2x = b.x - p.x, v2y = b.y - p.y;
        const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
        if (l1 < 1e-9 || l2 < 1e-9) continue;          // একই বিন্দু — বাদ
        const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
        if (cos > lim) continue;                        // প্রায় সরল — বাদ
        next.push(p);
      }
      if (next.length < 3 || next.length === out.length) { out = next.length >= 3 ? next : out; break; }
      out = next;
    }
    return out;
  },

  /**
   * দুই সরলরেখার ছেদবিন্দু (A→B ও C→D বাড়িয়ে)
   * প্রায় সমান্তরাল হলে null
   */
  lineIntersect(a, b, c, d) {
    const ux = b.x - a.x, uy = b.y - a.y;
    const vx = d.x - c.x, vy = d.y - c.y;
    const den = ux * vy - uy * vx;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c.x - a.x) * vy - (c.y - a.y) * vx) / den;
    return { x: a.x + t * ux, y: a.y + t * uy };
  },

  /**
   * ছোট ছোট বাহু মুছে কোণা ফিরিয়ে আনা
   *
   * ★ কেন দরকার
   *   স্ক্যান থেকে রেখা টানার সময় কোণাগুলোতে সিঁড়ির মতো ধাপ পড়ে। ফলে
   *   একটি চারকোণা দাগে ছয়টি বাহু আসে — দুটি মাত্র ১–২ ফুটের। শিটে
   *   সেগুলোর মাপ ছাপা হলে নকশা নোংরা দেখায়, আর AutoCAD এ করা কাজের
   *   সাথে মেলে না।
   *
   * ★ কীভাবে ঠিক করা হয়
   *   ছোট বাহুটি ফেলে দিয়ে তার দুই পাশের **লম্বা বাহু দুটি বাড়িয়ে**
   *   যেখানে মেলে সেখানেই আসল কোণা — ঠিক যেভাবে সার্ভেয়ার হাতে কোণা
   *   বের করেন। রেখা দুটি প্রায় সমান্তরাল হলে মাঝবিন্দু নেওয়া হয়।
   */
  collapseShortEdges(pts, minLen, closed) {
    let out = (pts || []).slice();
    const isClosed = closed !== false;
    const lim = isClosed ? 3 : 2;
    let guard = out.length * 2 + 8;

    while (out.length > lim && guard-- > 0) {
      const n = out.length;
      /* সবচেয়ে ছোট বাহু খুঁজি
       *
       * ★ খোলা রেখায় দুই **প্রান্তবিন্দু কখনো নড়ানো যাবে না**
       *   আর্ক (দুই জংশনের মাঝের সীমানা) খোলা রেখা হিসেবেই ছাঁটা হয়। তার
       *   প্রান্ত মানে জংশন — তিন দাগের মিলনস্থল। প্রান্ত সরে গেলে ঐ জংশনে
       *   মেলা অন্য আর্কগুলো আর মিলবে না, দাগ একে অন্যের ভেতর ঢুকে যাবে।
       *   নমুনা নকশায় মেপে দেখা গেছে ঠিক এ কারণেই ৫০টি জোড়া ওভারল্যাপ করছিল;
       *   প্রান্ত স্থির করার পর তা ০ হয়।
       */
      let si = -1, sLen = minLen;
      const from = isClosed ? 0 : 1;
      const to = isClosed ? n : n - 2;                    // iC যেন n-1 না হয়
      for (let i = from; i < to; i++) {
        const d = this.dist(out[i], out[(i + 1) % n]);
        if (d < sLen) { sLen = d; si = i; }
      }
      if (si < 0) break;                                  // আর ছোট বাহু নেই

      const iB = si, iC = (si + 1) % n;
      const iA = (si - 1 + n) % n, iD = (si + 2) % n;
      const A = out[iA], B = out[iB], C = out[iC], D = out[iD];
      const mid = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };

      let np = mid;
      // খোলা রেখার দুই প্রান্ত বাড়ানো যায় না — মাঝবিন্দুই থাক
      if (isClosed || (iA !== iB && iD !== iC)) {
        const hit = this.lineIntersect(A, B, C, D);
        // ছেদবিন্দু কাছেই হলে সেটিই আসল কোণা
        if (hit && this.dist(hit, mid) < Math.max(minLen * 4, 6)) np = hit;
      }

      // B ও C এর জায়গায় একটি বিন্দু
      const next = [];
      for (let i = 0; i < n; i++) {
        if (i === iC) continue;
        next.push(i === iB ? np : out[i]);
      }
      if (next.length < lim) break;
      out = next;
    }
    return out;
  },

  /** খুব কাছাকাছি পরপর বিন্দু একটিতে মেলানো */
  dedupe(pts, tol) {
    const t = tol > 0 ? tol : 0.5;
    const out = [];
    for (const p of pts || []) {
      const last = out[out.length - 1];
      if (last && this.dist(last, p) < t) continue;
      out.push(p);
    }
    if (out.length > 2 && this.dist(out[0], out[out.length - 1]) < t) out.pop();
    return out;
  },

  /* ---------------- স্ন্যাপিং (টপোলজি) ---------------- */

  /**
   * নতুন বিন্দু বসানোর সময় পাশের দাগের কোণা/কিনারায় টেনে নেওয়া
   * — এতে দুই দাগের মাঝে ফাঁক বা ওভারল্যাপ থাকে না (CAD এর মতো)।
   *
   * @param {object} pt          যেখানে ক্লিক পড়েছে (পিক্সেল)
   * @param {Array}  features    সব ফিচার [{pts:[...]}, ...]
   * @param {object} opt         { tol, vertexOnly, skipId }
   * @returns {{x,y,kind:'vertex'|'edge'|null}}
   */
  snap(pt, features, opt) {
    const o = opt || {};
    const tol = o.tol > 0 ? o.tol : 10;
    // যে বিন্দুগুলো এইমাত্র টানা হচ্ছে, সেগুলোতে নিজেই স্ন্যাপ করা চলবে না
    const skip = o.skipPts && o.skipPts.length ? new Set(o.skipPts) : null;
    let best = null, bestD = tol;

    // ১. আগে কোণা — কোণায় বসাটাই সবচেয়ে জরুরি
    for (const f of features || []) {
      if (!f || !f.pts || f.id === o.skipId) continue;
      for (const p of f.pts) {
        if (skip && skip.has(p)) continue;
        const d = this.dist(pt, p);
        if (d < bestD) { bestD = d; best = { x: p.x, y: p.y, kind: 'vertex', feature: f }; }
      }
    }
    if (best) return best;
    if (o.vertexOnly) return { x: pt.x, y: pt.y, kind: null };

    // ২. তারপর কিনারা
    bestD = tol;
    for (const f of features || []) {
      if (!f || !f.pts || f.pts.length < 2 || f.id === o.skipId) continue;
      const n = f.pts.length;
      const lim = f.closed === false ? n - 1 : n;
      for (let i = 0; i < lim; i++) {
        const a = f.pts[i], b = f.pts[(i + 1) % n];
        if (skip && (skip.has(a) || skip.has(b))) continue;
        const q = this.closestOnSegment(pt, a, b);
        const d = Math.hypot(pt.x - q.x, pt.y - q.y);
        if (d < bestD) { bestD = d; best = { x: q.x, y: q.y, kind: 'edge', feature: f }; }
      }
    }
    return best || { x: pt.x, y: pt.y, kind: null };
  },

  /**
   * সূচের মতো কাঁটা (spike) ছেঁটে ফেলা
   *
   * ★ কেন হয়
   *   পুরনো নকশায় কালির রেখা কোথাও এক-দুই পিক্সেল ভাঙা থাকে। ঐ ফাঁক
   *   দিয়ে খোপটি পাশের দাগে ঢুকে আবার ফিরে আসে — ফলে বহুভুজে লম্বা,
   *   সরু, ছুঁচালো কাঁটা তৈরি হয়। দেখতেও খারাপ, ক্ষেত্রফলেও ভুল আসে।
   *
   * ★ চেনার উপায়
   *   কাঁটার ডগায় দুই বাহুর মাঝের কোণ অস্বাভাবিক সরু (১৫–২০° এর কম) —
   *   অর্থাৎ বাহু দুটি প্রায় নিজের উপরেই ভাঁজ হয়ে ফিরে এসেছে। আসল
   *   দাগের কোণা এত সরু হয় না।
   */
  despike(pts, angleDeg, closed) {
    if (!pts || pts.length < 4) return (pts || []).slice();
    const lim = Math.cos((angleDeg == null ? 18 : angleDeg) * Math.PI / 180);
    const isClosed = closed !== false;
    let out = pts.slice();
    let guard = out.length + 8;

    while (out.length > 3 && guard-- > 0) {
      const n = out.length;
      let worst = -1, worstCos = lim;
      for (let i = 0; i < n; i++) {
        if (!isClosed && (i === 0 || i === n - 1)) continue;
        const v = out[i], a = out[(i - 1 + n) % n], b = out[(i + 1) % n];
        const ax = a.x - v.x, ay = a.y - v.y;
        const bx = b.x - v.x, by = b.y - v.y;
        const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if (la < 1e-9 || lb < 1e-9) continue;
        // ডগায় দুই বাহুর মাঝের কোণের cos — ১ এর কাছে মানে খুব সরু
        const cos = (ax * bx + ay * by) / (la * lb);
        if (cos > worstCos) { worstCos = cos; worst = i; }
      }
      if (worst < 0) break;
      out.splice(worst, 1);
    }
    return out;
  },

  /**
   * চিমটি (pinch) খুলে ফেলা — ভাঙা রেখার ফাঁক দিয়ে ঢুকে পড়া অংশ বাদ দেওয়া
   *
   * ★ আসল সমস্যাটা কী
   *   পুরনো নকশায় কালির রেখা কোথাও এক পিক্সেল ভাঙা থাকলে খোপটি ঐ সরু
   *   ফাঁক দিয়ে পাশের দাগে ঢুকে যায়, ঘুরে আবার একই ফাঁক দিয়ে ফেরে। ফলে
   *   বহুভুজে লম্বা সরু "উপদ্বীপ" জুড়ে যায় — পর্দায় দেখতে সূচ বা V এর মতো।
   *
   *   এটি কেবল ডগার কোণ দেখে ধরা যায় না (ডগা চ্যাপ্টাও হতে পারে)। আসল
   *   চিহ্ন হলো — বহুভুজটি **নিজেকে প্রায় ছুঁয়ে ফেলে**: রিং এর দুটি
   *   পাশাপাশি-নয় এমন কোণা কালির প্রস্থের সমান দূরত্বে এসে পড়ে। সেটিই
   *   ফাঁকের মুখ।
   *
   * ★ সমাধান
   *   ঐ মুখে রিংটি দুই ভাগ করে **বড় ভাগটি** রাখা হয় — উপদ্বীপ বাদ পড়ে।
   *   দূরত্বের সীমা খুব ছোট (কয়েক পিক্সেল) রাখা হয়, যাতে সত্যিকারের
   *   সরু দাগ ভুল করে কাটা না পড়ে।
   */
  unpinch(pts, pinchDist, closed) {
    if (closed === false || !pts || pts.length < 6) return (pts || []).slice();
    const lim = pinchDist > 0 ? pinchDist : 3;
    let ring = pts.slice();

    for (let pass = 0; pass < 6; pass++) {
      const n = ring.length;
      if (n < 6) break;
      let found = null, bestD = lim;

      for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
          if (i === 0 && j === n - 1) continue;        // রিং-এ পাশাপাশি
          // দুই ভাগের কোনোটিই যেন খুব ছোট না হয় (নইলে শুধু কোণা কাটা হচ্ছে)
          if (j - i < 2 || n - (j - i) < 2) continue;
          const d = this.dist(ring[i], ring[j]);
          if (d < bestD) { bestD = d; found = [i, j]; }
        }
      }
      if (!found) break;

      const [i, j] = found;
      const loopA = ring.slice(i, j + 1);
      const loopB = ring.slice(j).concat(ring.slice(0, i + 1));
      const aA = loopA.length >= 3 ? this.area(loopA) : 0;
      const aB = loopB.length >= 3 ? this.area(loopB) : 0;
      if (aA <= 0 && aB <= 0) break;
      ring = (aA >= aB ? loopA : loopB);
    }
    return ring;
  },

  /**
   * ফালি (sliver) কি না — অস্বাভাবিক সরু ও লম্বা বহুভুজ
   * বৃত্তাকারতা = ৪π·ক্ষেত্রফল ÷ পরিসীমা²  (বর্গের ~০.৭৯, সুতোর মতো হলে ~০)
   */
  isSliver(pts, limit) {
    if (!pts || pts.length < 3) return true;
    const p = this.perimeter(pts, true);
    if (!(p > 0)) return true;
    const circ = 4 * Math.PI * this.area(pts) / (p * p);
    return circ < (limit == null ? 0.035 : limit);
  },

  /**
   * অর্থো/কোণ-লক — শেষ বাহুর সাথে ৯০°/৪৫° এ আটকানো (Shift চাপলে)
   */
  angleLock(from, to, stepDeg) {
    const step = (stepDeg || 45) * Math.PI / 180;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return { x: to.x, y: to.y };
    const ang = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len };
  },

  /* ==================== ৫. নথি (Document) ==================== */

  /**
   * লেয়ারের ছক — শিটে যেভাবে "সাংকেতিক চিহ্ন" ছাপা হয়
   * রঙগুলো নমুনা শিট থেকে নেওয়া: সি.এস লাল, বি.এস নীল/সবুজ,
   * ফুটের লাইন সবুজ, দাগের লাইন লাল।
   */
  LAYER_PRESETS: [
    { id: 'cs',    name: 'সি এস লাইন',      en: 'C.S. Line',      color: '#e11d48', width: 1.8, kind: 'plot' },
    { id: 'sa',    name: 'এস এ লাইন',       en: 'S.A. Line',      color: '#9333ea', width: 1.6, kind: 'plot' },
    { id: 'rs',    name: 'আর এস লাইন',      en: 'R.S. Line',      color: '#1e3a8a', width: 1.6, kind: 'plot' },
    { id: 'bs',    name: 'বি এস লাইন',      en: 'B.S. Line',      color: '#2563eb', width: 1.6, kind: 'plot' },
    { id: 'dag',   name: 'দাগের লাইন',      en: 'Dag Line',       color: '#dc2626', width: 2.0, kind: 'plot' },
    { id: 'foot',  name: 'ফুটের লাইন',      en: 'Footer Line',    color: '#16a34a', width: 1.0, kind: 'dim'  },
    { id: 'prop',  name: 'প্রপার্টি লাইন',  en: 'Property Line',  color: '#15803d', width: 2.6, kind: 'plot' },
    { id: 'road',  name: 'সরকারি রাস্তা',   color: '#be123c', width: 1.6, kind: 'road', fill: 'rgba(244,114,182,0.30)' },
    { id: 'water', name: 'নদী / পুকুর / খাল', color: '#0284c7', width: 1.6, kind: 'water', fill: 'rgba(56,189,248,0.28)' }
  ],

  layerPreset(id) {
    return this.LAYER_PRESETS.find(l => l.id === id) || this.LAYER_PRESETS[0];
  },

  /** খালি নথি */
  newDoc() {
    return {
      meta: {
        district: '', upazila: '', mouza: '', jl: '',
        scaleInch: 120,
        sheetType: 'demarcation',        // demarcation | pentagraph
        surveyorName: '', surveyorReg: '', surveyorEdu: '', surveyorPhone: '',
        firmName: '', firmAddress: '', firmPhone: '',
        reportNote: '', reportDate: '',
        footNote: 'প্রতিটি দাগের হিসেব অটোক্যাড দিয়ে করা হয়েছে। গড় পদ্ধতি পরিহার করা হয়েছে।'
      },
      layers: this.LAYER_PRESETS.map(p => ({
        id: p.id, name: p.name, color: p.color, width: p.width,
        kind: p.kind, fill: p.fill || null, visible: true, locked: false, used: false
      })),
      features: [],
      notes: [],                         // লেখা / চিহ্ন / বৃত্ত — হিসাবে যোগ হয় না
      khotian: null,                     // { name, data } — পর্চার ছবি
      ftPerPx: 0,                        // ০ = এখনো স্কেল বসানো হয়নি
      geo: null,                         // { params, latRef, lngRef, rmse } — ভূ-স্থানাঙ্ক
      _seq: 1,
      _nseq: 1
    };
  },

  /** নতুন ফিচার (দাগ / রেখা) */
  newFeature(doc, layerId, pts, props) {
    const p = props || {};
    const f = {
      id: 'f' + (doc._seq++),
      layer: layerId || 'dag',
      pts: (pts || []).map(q => ({ x: q.x, y: q.y })),
      closed: p.closed !== false,
      dag: p.dag || '',                  // দাগ নম্বর
      khotian: p.khotian || '',
      owner: p.owner || '',
      note: p.note || '',
      showDims: p.showDims !== false,    // বাহুর মাপ দেখাব?
      showArea: p.showArea !== false,    // ক্ষেত্রফল দেখাব?
      showLabel: p.showLabel !== false,
      hidden: p.hidden === true,         // "কেবল এগুলো দেখান" এ কাজে লাগে
      manualArea: p.manualArea == null ? null : Number(p.manualArea)   // শতাংশে
    };
    return f;
  },

  /**
   * এখন যেগুলো নিয়ে কাজ হচ্ছে — লুকানো নয়, লেয়ারও দেখা যাচ্ছে
   * আঁকা, শিট ও রপ্তানি — সবাই এই একটি তালিকাই মানে, তাই "যা দেখছেন
   * তাই যাবে" নিয়মটি সব জায়গায় এক থাকে।
   */
  activeFeatures(doc) {
    return doc.features.filter(f => {
      if (f.hidden) return false;
      const L = this.layer(doc, f.layer);
      return !L || L.visible;
    });
  },

  /** কোনো দাগ লুকানো আছে কি */
  hasHidden(doc) { return doc.features.some(f => f.hidden); },

  /**
   * দাগ নম্বর দিয়ে খোঁজা — "১৬২০, ১৬২১, 1601" সব চলবে
   * বাংলা ও ইংরেজি অঙ্ক দুটোই মেলে, কারণ ব্যবহারকারী যেকোনোটা লিখতে পারেন।
   */
  findByDag(doc, text) {
    // অঙ্ক এক রূপে এনে তুলনা — ব্যবহারকারী "২৪১" বা "241" যেটাই লিখুন
    const norm = v => this.enDigits(v)
      .replace(/[^\dA-Za-zঀ-৿/]/g, '').toLowerCase();
    const wanted = String(text || '')
      .split(/[,\s;।]+/).map(norm).filter(Boolean);
    if (!wanted.length) return { found: [], missing: [] };

    const found = [], hit = new Set();
    for (const w of wanted) {
      let any = false;
      for (const f of doc.features) {
        if (!f.dag) continue;
        if (norm(f.dag) === w) { found.push(f); hit.add(w); any = true; }
      }
      if (!any) {
        // পুরো না মিললে অংশ মিলিয়ে দেখি (৫৫২/১ ধরনের উপ-দাগ)
        for (const f of doc.features) {
          if (!f.dag) continue;
          const nf = norm(f.dag);
          if (nf.startsWith(w + '/') || nf === w) { found.push(f); hit.add(w); }
        }
      }
    }
    return {
      found,
      missing: wanted.filter(w => !hit.has(w))
    };
  },

  addFeature(doc, f) {
    doc.features.push(f);
    const L = doc.layers.find(l => l.id === f.layer);
    if (L) L.used = true;
    return f;
  },

  removeFeature(doc, id) {
    const i = doc.features.findIndex(f => f.id === id);
    if (i >= 0) doc.features.splice(i, 1);
    return i >= 0;
  },

  feature(doc, id) { return doc.features.find(f => f.id === id) || null; },

  layer(doc, id) { return doc.layers.find(l => l.id === id) || null; },

  /* ---------------- মাপ বের করা ---------------- */

  /** একটি ফিচারের সব মাপ — পিক্সেল থেকে ফুটে */
  measure(doc, f) {
    const k = doc.ftPerPx || 0;
    const pts = f.pts || [];
    const areaPx = f.closed ? this.area(pts) : 0;
    const periPx = this.perimeter(pts, f.closed);

    const sqft = k > 0 ? areaPx * k * k : 0;
    const manual = (f.manualArea != null && isFinite(f.manualArea))
      ? f.manualArea * this.SQFT_PER_SATAK : null;
    const finalSqft = manual != null ? manual : sqft;

    return {
      areaPx, periPx,
      sqft: finalSqft,
      autoSqft: sqft,
      isManual: manual != null,
      feet: k > 0 ? periPx * k : 0,
      units: this.areaUnits(finalSqft),
      sides: this.sides(doc, f)
    };
  },

  /** প্রতিটি বাহুর দৈর্ঘ্য + মাঝবিন্দু + কোণ (মাপ লেখার জন্য) */
  sides(doc, f) {
    const k = doc.ftPerPx || 0;
    const pts = f.pts || [];
    const n = pts.length;
    if (n < 2) return [];
    const lim = f.closed ? n : n - 1;
    const out = [];
    for (let i = 0; i < lim; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const px = this.dist(a, b);
      out.push({
        index: i,
        a, b,
        px,
        feet: k > 0 ? px * k : 0,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        angle: Math.atan2(b.y - a.y, b.x - a.x)
      });
    }
    return out;
  },

  /**
   * বাহুর পরিচয়-চাবি — ভাগ করা সীমানা চেনার জন্য
   *
   * ★ কেন দরকার
   *   পাশাপাশি দুই দাগ একই সীমানা ভাগ করে। দুটোরই বাহু ধরে মাপ লিখলে
   *   একই "২০২'-৪\"" দুবার ছাপা হয়, একটির উপর আরেকটি। আসল শিটে ভাগ করা
   *   সীমানার মাপ **একবারই** লেখা থাকে। তাই দুই প্রান্ত সাজিয়ে একটি চাবি
   *   বানানো হয় — একই সীমানার দুই বাহুর চাবি তখন এক হয়।
   */
  sideKey(a, b, quant) {
    const q = quant > 0 ? quant : 2;
    const r = v => Math.round(v / q);
    const p1 = [r(a.x), r(a.y)], p2 = [r(b.x), r(b.y)];
    const first = (p1[0] < p2[0] || (p1[0] === p2[0] && p1[1] <= p2[1])) ? p1 : p2;
    const last = first === p1 ? p2 : p1;
    return first[0] + ',' + first[1] + '|' + last[0] + ',' + last[1];
  },

  /**
   * প্রতিটি কোণার ভেতরের কোণ (ডিগ্রিতে)
   *
   * ★ কেন লাগে
   *   সার্ভেয়ার মাঠে কেবল বাহুর মাপ নয়, **কোণও** মেলান — দুই বাহুর মাপ ঠিক
   *   থাকলেও কোণ ভুল হলে জমির আকৃতি বদলে যায়। শিটে ৯০°, ৮৭° লিখে দিলে
   *   মাঠে ফিতা ধরে মিলিয়ে নেওয়া যায়।
   *
   * @returns {Array<{index, deg, at:{x,y}, bisector:{x,y}}>}
   *          bisector = কোণের ভেতরের দিক, লেখা বসানোর জন্য
   */
  angles(pts) {
    const out = [];
    const n = (pts || []).length;
    if (n < 3) return out;
    const sArea = this.signedArea(pts);
    for (let i = 0; i < n; i++) {
      const v = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
      let ax = a.x - v.x, ay = a.y - v.y;
      let bx = b.x - v.x, by = b.y - v.y;
      const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      if (la < 1e-9 || lb < 1e-9) continue;
      ax /= la; ay /= la; bx /= lb; by /= lb;
      let deg = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by))) * 180 / Math.PI;
      /* acos সবসময় ০–১৮০ দেয়। কোণাটি অবতল (reflex) কি না তা বোঝা যায়
         বহুভুজের ঘোরার দিকের সাথে মিলিয়ে: দুই বাহুর ক্রস-গুণফলের চিহ্ন
         আর ক্ষেত্রফলের চিহ্ন **এক হলে** কোণাটি ভেতরের দিকে ঢোকানো, তখন
         আসল কোণ ৩৬০ থেকে বিয়োগ। (বর্গ ⇒ ৯০°, L এর খাঁজ ⇒ ২৭০°) */
      const cross = ax * by - ay * bx;
      if ((cross > 0) === (sArea > 0)) deg = 360 - deg;
      let mx = ax + bx, my = ay + by;
      const ml = Math.hypot(mx, my);
      if (ml < 1e-9) { mx = -ay; my = ax; }
      else { mx /= ml; my /= ml; }
      out.push({ index: i, deg, at: { x: v.x, y: v.y }, bisector: { x: mx, y: my } });
    }
    return out;
  },

  /** নথির মোট — লেয়ার ধরে */
  totals(doc) {
    const byLayer = {};
    for (const f of doc.features) {
      if (!f.closed) continue;
      const m = this.measure(doc, f);
      if (!byLayer[f.layer]) byLayer[f.layer] = { count: 0, sqft: 0, dags: [] };
      byLayer[f.layer].count++;
      byLayer[f.layer].sqft += m.sqft;
      if (f.dag) byLayer[f.layer].dags.push({ dag: f.dag, sqft: m.sqft });
    }
    return byLayer;
  },

  /* ==================== ৬. সংরক্ষণ ==================== */

  /**
   * নথি → JSON
   * @param {object} opts { image } — ছবির ছোট কপি (dataURL) চাইলে সাথে যায়,
   *        তাতে পরে ফাইলটি খুললে নকশাটিও পটভূমিতে ফিরে আসে
   */
  toJson(doc, opts) {
    const o = opts || {};
    return JSON.stringify({
      v: 2,
      app: 'jaygajomi-cad',
      meta: doc.meta,
      layers: doc.layers,
      features: doc.features,
      notes: doc.notes || [],
      khotian: doc.khotian || null,      // খতিয়ান/পর্চার ছবি — সাথেই থাকে
      ftPerPx: doc.ftPerPx,
      geo: doc.geo ? { params: doc.geo.params, latRef: doc.geo.latRef, lngRef: doc.geo.lngRef,
                       rmse: doc.geo.rmse, mode: doc.geo.mode, points: doc.geo.points } : null,
      image: o.image || null,
      imageSize: o.imageSize || null
    });
  },

  fromJson(text) {
    const d = JSON.parse(text);
    const doc = this.newDoc();
    doc.meta = Object.assign(doc.meta, d.meta || {});
    if (Array.isArray(d.layers) && d.layers.length) doc.layers = d.layers;
    doc.features = Array.isArray(d.features) ? d.features : [];
    doc.notes = Array.isArray(d.notes) ? d.notes : [];
    doc.khotian = d.khotian || null;
    doc._nseq = doc.notes.reduce((m, n) => {
      const k = parseInt(String(n.id).replace(/\D/g, ''), 10);
      return isFinite(k) ? Math.max(m, k + 1) : m;
    }, 1);
    doc.ftPerPx = Number(d.ftPerPx) || 0;
    doc.geo = d.geo || null;
    doc._image = d.image || null;             // সংরক্ষিত নয় — কেবল খোলার সময়
    doc._imageSize = d.imageSize || null;
    doc._seq = doc.features.reduce((m, f) => {
      const n = parseInt(String(f.id).replace(/\D/g, ''), 10);
      return isFinite(n) ? Math.max(m, n + 1) : m;
    }, 1);
    return doc;
  },

  /**
   * আরেকটি নথির দাগ এই নথিতে জুড়ে দেওয়া (পেন্টাগ্রাফের জন্য)
   *
   * ★ স্থানাঙ্ক মেলানো
   *   দুটি নকশা আলাদাভাবে ডিজিটাইজ হলে দুটোর পিক্সেল-স্থানাঙ্ক আলাদা —
   *   সোজা জুড়ে দিলে একটার উপর আরেকটা ভুল জায়গায় বসবে। দুটোরই
   *   **ভূ-স্থানাঙ্ক** থাকলে অক্ষাংশ-দ্রাঘিমাংশের মাঝপথ ধরে নিখুঁতভাবে
   *   মেলানো যায় — সেটিই `mapPt` দিয়ে করা হয়।
   *
   * @param {object} dst        যে নথিতে জুড়বে
   * @param {object} src        যেখান থেকে আসবে
   * @param {object} opt        { mapPt, layer, prefix }
   * @returns {{added:number, layers:string[]}}
   */
  mergeInto(dst, src, opt) {
    const o = opt || {};
    const mapPt = o.mapPt || (p => ({ x: p.x, y: p.y }));
    const layers = new Set();
    let added = 0;

    // আসা লেয়ারগুলো না থাকলে যোগ করে নিই (রঙ-নামসহ)
    for (const sl of (src.layers || [])) {
      if (!dst.layers.some(l => l.id === sl.id)) dst.layers.push(Object.assign({}, sl));
    }

    for (const f of src.features) {
      const pts = f.pts.map(mapPt).filter(Boolean);
      if (pts.length < 2) continue;
      const g = this.newFeature(dst, o.layer || f.layer, pts, {
        closed: f.closed,
        dag: f.dag, khotian: f.khotian, owner: f.owner,
        note: f.note, showDims: f.showDims, showArea: f.showArea, showLabel: f.showLabel,
        manualArea: f.manualArea
      });
      this.addFeature(dst, g);
      layers.add(g.layer);
      added++;
    }
    return { added, layers: Array.from(layers) };
  }
};

/* Node এ পরীক্ষার জন্য */
if (typeof module !== 'undefined' && module.exports) module.exports = CadCore;
