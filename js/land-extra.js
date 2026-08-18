/* ==========================================================================
   land-extra.js — বাকি টুলগুলোর গণিত
   --------------------------------------------------------------------------
     ১. AreaSolver — ক্ষেত্রফল ও অজানা বাহু
     ২. MapJoint   — দুই নকশার সিট জোড়া লাগানোর রূপান্তর

   DOM ছোঁয় না — Node এ পরীক্ষা করা যায়।
   ========================================================================== */

/* ==========================================================================
   ১. ক্ষেত্রফল ও অজানা বাহু
   --------------------------------------------------------------------------
   মাঠে দুই রকম প্রশ্ন আসে:
     ক. বাহুগুলো জানা — ক্ষেত্রফল কত?
     খ. ক্ষেত্রফল জানা (খতিয়ানে লেখা), এক বাহু অজানা — সেটি কত?

   দ্বিতীয়টি বেশি কাজে লাগে: দলিলে জমির পরিমাণ লেখা আছে, মাঠে তিন বাহু
   মাপা গেছে, চতুর্থটা নদী/পুকুরের ধারে বলে মাপা যায়নি।
   ========================================================================== */

const AreaSolver = {

  SQFT_PER_SATAK: 435.6,

  /** তিন বাহু দিয়ে ত্রিভুজ হয় কি না */
  validTriangle(a, b, c) {
    return a > 0 && b > 0 && c > 0 &&
           a + b > c && b + c > a && c + a > b;
  },

  /** হেরনের সূত্র — তিন বাহু থেকে ক্ষেত্রফল */
  triangle(a, b, c) {
    if (!this.validTriangle(a, b, c)) return null;
    const s = (a + b + c) / 2;
    const v = s * (s - a) * (s - b) * (s - c);
    return v > 0 ? Math.sqrt(v) : null;
  },

  /**
   * চতুর্ভুজ — কর্ণ দিলে দুই ত্রিভুজের যোগফল
   * (কর্ণ ছাড়া চতুর্ভুজ নির্দিষ্ট নয়, তাই কর্ণ চাওয়া হয়)
   */
  quadWithDiagonal(a, b, c, d, diag) {
    const t1 = this.triangle(a, b, diag);
    const t2 = this.triangle(c, d, diag);
    if (t1 == null || t2 == null) return null;
    return t1 + t2;
  },

  /**
   * কর্ণ ছাড়া চতুর্ভুজের **সর্বোচ্চ সম্ভাব্য** ক্ষেত্রফল (ব্রহ্মগুপ্তের সূত্র)
   *
   * ★ কেন "সর্বোচ্চ"
   *   একই চার বাহুতে অসংখ্য চতুর্ভুজ সম্ভব — কব্জার মতো চেপে দিলে ক্ষেত্রফল
   *   কমে যায়। সবচেয়ে বেশি ক্ষেত্রফল হয় যখন চার কোণা একটি বৃত্তে পড়ে।
   *   তাই এই সংখ্যাটি **ঊর্ধ্বসীমা** — আসল জমি এর চেয়ে কম হতে পারে, বেশি নয়।
   *   নিখুঁত মান পেতে কর্ণ মেপে দিতে হবে।
   */
  quadMax(a, b, c, d) {
    if (![a, b, c, d].every(v => v > 0)) return null;
    const p = a + b + c + d;
    if (2 * Math.max(a, b, c, d) >= p) return null;   // চতুর্ভুজই হয় না
    const s = p / 2;
    const v = (s - a) * (s - b) * (s - c) * (s - d);
    return v > 0 ? Math.sqrt(v) : null;
  },

  /**
   * ত্রিভুজের অজানা তৃতীয় বাহু — দুই বাহু ও ক্ষেত্রফল জানা
   *
   * ক্ষেত্রফল = ½·a·b·sin(C)  ⇒  C = asin(2A / ab)
   * দুটি উত্তর সম্ভব (সূক্ষ্ম ও স্থূল কোণ) — দুটোই ফেরত দেওয়া হয়,
   * কারণ মাঠে কোনটি ঠিক তা জমির আকৃতি দেখে ব্যবহারকারীই বলতে পারেন।
   */
  triangleUnknownSide(a, b, area) {
    if (!(a > 0 && b > 0 && area > 0)) return null;
    const sinC = 2 * area / (a * b);
    if (sinC > 1 + 1e-12) return null;               // এত ক্ষেত্রফল সম্ভব নয়
    const s = Math.min(1, sinC);
    const c1 = Math.asin(s);                          // সূক্ষ্ম কোণ
    const c2 = Math.PI - c1;                          // স্থূল কোণ
    const side = ang => Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(ang));
    const out = [side(c1)];
    if (Math.abs(c2 - c1) > 1e-9) out.push(side(c2));
    return {
      sides: out,
      maxArea: a * b / 2,                             // ৯০° এ সর্বোচ্চ
      angles: [c1 * 180 / Math.PI, c2 * 180 / Math.PI]
    };
  },

  /**
   * চতুর্ভুজের অজানা এক বাহু — বাকি তিন বাহু, কর্ণ ও ক্ষেত্রফল জানা
   *
   * কর্ণ প্রথম ত্রিভুজ (a, b, diag) নির্দিষ্ট করে, তাই তার ক্ষেত্রফল জানা।
   * বাকি ক্ষেত্রফল দ্বিতীয় ত্রিভুজের (c, d, diag) — সেখান থেকে d বের হয়।
   */
  quadUnknownSide(a, b, diag, c, area) {
    const t1 = this.triangle(a, b, diag);
    if (t1 == null) return null;
    const rest = area - t1;
    if (!(rest > 0)) return null;                     // ক্ষেত্রফল খুব ছোট
    const r = this.triangleUnknownSide(c, diag, rest);
    if (!r) return null;
    return { sides: r.sides, firstTriangle: t1, secondTriangle: rest };
  },

  /** আয়তক্ষেত্র — দৈর্ঘ্য · প্রস্থ · ক্ষেত্রফল, যেকোনো দুটি থেকে তৃতীয় */
  rect(len, wid, area) {
    const L = len > 0 ? len : null, W = wid > 0 ? wid : null, A = area > 0 ? area : null;
    if (L && W) return { len: L, wid: W, area: L * W, solved: 'area' };
    if (L && A) return { len: L, wid: A / L, area: A, solved: 'wid' };
    if (W && A) return { len: A / W, wid: W, area: A, solved: 'len' };
    return null;
  },

  /** বর্গফুট → বাংলা এককে লেখা */
  units(sqft) {
    const katha = (typeof LandMath !== 'undefined' && LandMath.SQFT_PER_KATHA)
      ? LandMath.SQFT_PER_KATHA : 720;
    return {
      sqft,
      satak: sqft / this.SQFT_PER_SATAK,
      katha: sqft / katha,
      bigha: sqft / (katha * 20),
      acre: sqft / 43560,
      sqm: sqft / 10.7639
    };
  }
};

/* ==========================================================================
   ২. ম্যাপ জয়েন্ট — দুই সিট জোড়া লাগানো
   --------------------------------------------------------------------------
   একটি মৌজা প্রায়ই কয়েকটি সিটে (শিট) আঁকা থাকে। পুরো মৌজা একসাথে দেখতে
   হলে সিটগুলো পাশাপাশি বসাতে হয়।

   ★ কীভাবে বসানো হয়
     দুই সিটে **একই দুটি চেনা বিন্দু** দেখাতে হয় — সাধারণত সিটের কিনারায়
     ছাপা মিলকরণ চিহ্ন, বা দুই সিটে ভাগ হয়ে যাওয়া একটি দাগের দুই কোণা।
     দুই জোড়া বিন্দু থেকে **similarity রূপান্তর** (স্কেল + ঘূর্ণন + সরণ)
     বেরোয় — তাতেই দ্বিতীয় সিট প্রথমটির সাথে মিলে যায়।

     তির্যকতা (skew) ধরা হয় না — একই মৌজার সিট একই স্কেলে আঁকা, তাই
     স্কেল+ঘূর্ণনই যথেষ্ট। বেশি বিন্দু দিলে গড় নেওয়া হয়।
   ========================================================================== */

const MapJoint = {

  /**
   * দুই জোড়া বিন্দু → similarity রূপান্তর
   * src এর বিন্দুগুলো dst এর উপর বসাতে যা লাগে।
   *
   * @param {Array} src  [{x,y}, {x,y}]  দ্বিতীয় সিটে বাছা বিন্দু
   * @param {Array} dst  [{x,y}, {x,y}]  প্রথম সিটে ঐ একই জায়গা
   * @returns {{scale, rotation, tx, ty, apply}}
   */
  solve(src, dst) {
    if (!src || !dst || src.length < 2 || dst.length < 2) return null;
    const n = Math.min(src.length, dst.length);

    // দুইয়ের বেশি জোড়া থাকলে least-squares similarity (Umeyama এর সরল রূপ)
    const cs = { x: 0, y: 0 }, cd = { x: 0, y: 0 };
    for (let i = 0; i < n; i++) {
      cs.x += src[i].x; cs.y += src[i].y;
      cd.x += dst[i].x; cd.y += dst[i].y;
    }
    cs.x /= n; cs.y /= n; cd.x /= n; cd.y /= n;

    let sxx = 0, sxy = 0, varS = 0;
    for (let i = 0; i < n; i++) {
      const ax = src[i].x - cs.x, ay = src[i].y - cs.y;
      const bx = dst[i].x - cd.x, by = dst[i].y - cd.y;
      sxx += ax * bx + ay * by;                       // ডট
      sxy += ax * by - ay * bx;                       // ক্রস
      varS += ax * ax + ay * ay;
    }
    if (varS < 1e-12) return null;                    // সব বিন্দু একই জায়গায়

    const rotation = Math.atan2(sxy, sxx);
    const scale = Math.hypot(sxx, sxy) / varS;
    const cos = Math.cos(rotation) * scale, sin = Math.sin(rotation) * scale;
    const tx = cd.x - (cos * cs.x - sin * cs.y);
    const ty = cd.y - (sin * cs.x + cos * cs.y);

    const apply = p => ({ x: cos * p.x - sin * p.y + tx, y: sin * p.x + cos * p.y + ty });

    // প্রতিটি জোড়ার অবশিষ্ট ত্রুটি — মিল কতটা ভালো তা বোঝাতে
    let sum = 0, worst = 0;
    for (let i = 0; i < n; i++) {
      const q = apply(src[i]);
      const d = Math.hypot(q.x - dst[i].x, q.y - dst[i].y);
      sum += d * d; if (d > worst) worst = d;
    }
    return {
      scale, rotation, tx, ty, apply,
      rotationDeg: rotation * 180 / Math.PI,
      rmse: Math.sqrt(sum / n),
      maxError: worst,
      pairs: n
    };
  },

  /** রূপান্তরের পর ছবিটির চার কোণা কোথায় পড়বে */
  corners(t, w, h) {
    return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }].map(t.apply);
  },

  /** কয়েকটি সিট বসানোর পর সম্মিলিত ঘের */
  bounds(sheets) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of sheets) {
      for (const p of s) {
        if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
      }
    }
    if (!isFinite(x0)) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  },

  /** মিল কতটা ভালো — ব্যবহারকারীকে বোঝাতে */
  quality(rmse) {
    if (!isFinite(rmse)) return { level: 'unknown', label: 'অজানা' };
    if (rmse < 2) return { level: 'great', label: 'চমৎকার' };
    if (rmse < 8) return { level: 'good', label: 'ভালো' };
    if (rmse < 20) return { level: 'ok', label: 'মোটামুটি' };
    return { level: 'bad', label: 'দুর্বল — বিন্দু আবার বসান' };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AreaSolver, MapJoint };
}
