/* ==========================================================================
   cad-divide.js — জমির ভাগ-বণ্টন (যেকোনো আকৃতি)
   --------------------------------------------------------------------------
   একটি দাগ আর কয়েকজন অংশীদার — কার কতটুকু, আর সেটি জমিতে **কোথায়**।

   ★ আসল কাজটা কী
     ওয়ারিশ বা ক্রেতাদের মধ্যে জমি ভাগ করতে গিয়ে কেবল "কে কত শতাংশ পাবে"
     বের করাই যথেষ্ট নয় — জমিতে দাগ কেটে দেখাতে হয় কার অংশ কোনদিকে, আর
     প্রতিটি টুকরোর বাহুর মাপ কত। সেটিই এখানে হয়।

   ★ কীভাবে ভাগ হয়
     এক দিকে সমান্তরাল রেখা টেনে ফালি করে কাটা হয় (সবচেয়ে প্রচলিত)।
     প্রথম অংশীদারের হিস্যা অনুযায়ী এক ফালি কেটে নেওয়া হয়, তারপর যা বাকি
     থাকে তার উপর পরেরজনের হিস্যা — এভাবে ক্রমে। প্রতিবার দ্বিভাজন
     (bisection) দিয়ে রেখাটি এমন জায়গায় বসানো হয় যাতে ক্ষেত্রফল ঠিক মেলে।

     কাটার **কোণ** বদলানো যায় — রাস্তার দিক বা দাগের লম্বা বাহু বরাবর কাটলে
     প্রতিটি অংশ সমান সুবিধা পায়।

   ★ হিস্যা যেভাবে দেওয়া যায়
     অনুপাত (২:১:১) · শতাংশ · আনা-গন্ডা · সরাসরি জমির পরিমাণ — সবই ওজনে
     রূপান্তরিত হয়ে একই নিয়মে ভাগ হয়।

   DOM ছোঁয় না — Node এ পরীক্ষা করা যায়।
   ========================================================================== */

const CadDivide = {

  /* ==================== ১. হিস্যার একক ==================== */

  /**
   * হিস্যা লেখার ধরন
   *  ratio  — নিছক অনুপাত (২, ১, ১)
   *  satak  — সরাসরি শতাংশ (২৫.৫০)
   *  ana    — আনা-গন্ডা (১৬ আনা = পুরো জমি)
   *  percent— শতকরা ভাগ (৫০%, ২৫%, ২৫%)
   */
  SHARE_MODES: [
    { id: 'ratio',   name: 'অনুপাত',      hint: 'যেমন ২ : ১ : ১' },
    { id: 'ana',     name: 'আনা',        hint: '১৬ আনায় পুরো জমি' },
    { id: 'percent', name: 'শতকরা (%)',  hint: 'যোগফল ১০০ হওয়া ভালো' },
    { id: 'satak',   name: 'শতাংশ',      hint: 'সরাসরি জমির পরিমাণ' }
  ],

  /**
   * অংশীদারের তালিকা → স্বাভাবিকীকৃত ওজন (যোগফল ১)
   *
   * ★ কেন ওজনে নামানো হয়
   *   অনুপাত, আনা, শতকরা, শতাংশ — ধরন যাই হোক, ভাগের গণিত একই। তাই সব
   *   একবারে ওজনে নামিয়ে নিলে বাকি কোড আর ধরন নিয়ে ভাবে না।
   *
   * @param {Array} shares  [{ name, value }]
   * @returns {{ weights:number[], total:number, warn:string|null }}
   */
  normalize(shares, mode) {
    const vals = (shares || []).map(s => {
      const v = CadCore.num(s && s.value);
      return isFinite(v) && v > 0 ? v : 0;
    });
    const total = vals.reduce((a, b) => a + b, 0);
    if (!(total > 0)) {
      return { weights: [], total: 0, warn: 'অন্তত একজনের হিস্যা ০ এর বেশি হতে হবে' };
    }

    let warn = null;
    if (mode === 'ana' && Math.abs(total - 16) > 0.01) {
      warn = 'আনার যোগফল ' + CadCore.bn(total.toFixed(2)) + ' — পুরো জমি ১৬ আনা। '
           + 'অনুপাত ধরে ভাগ করা হয়েছে।';
    } else if (mode === 'percent' && Math.abs(total - 100) > 0.01) {
      warn = 'শতকরার যোগফল ' + CadCore.bn(total.toFixed(2)) + '% — ১০০ নয়। '
           + 'অনুপাত ধরে ভাগ করা হয়েছে।';
    }
    return { weights: vals.map(v => v / total), total, warn };
  },

  /* ==================== ২. ভাগ করা ==================== */

  /**
   * বহুভুজকে হিস্যা অনুযায়ী সমান্তরাল ফালিতে কাটা
   *
   * @param {Array}  poly     দাগ (পিক্সেল স্থানাঙ্ক)
   * @param {Array}  weights  স্বাভাবিকীকৃত ওজন (যোগফল ১)
   * @param {object} opt      { angle: কাটার রেখার কোণ (রেডিয়ান) }
   * @returns {Array<Array<{x,y}>>}  প্রতিটি অংশের বহুভুজ
   */
  slice(poly, weights, opt) {
    const o = opt || {};
    const angle = o.angle == null ? 0 : o.angle;
    if (!poly || poly.length < 3) return [];
    if (!weights || !weights.length) return [];
    if (weights.length === 1) return [poly.slice()];

    const parts = [];
    let rest = poly.slice();
    let left = 1;                                  // এখনো কাটা বাকি এমন ভগ্নাংশ

    for (let i = 0; i < weights.length - 1; i++) {
      const want = weights[i] / left;              // অবশিষ্টের কত অংশ
      const cut = CadOverlay.splitByFraction(rest, want, angle);
      if (!cut) {                                  // কাটা গেল না — বাকিটা এক টুকরো
        parts.push(rest);
        return parts;
      }
      parts.push(cut.left);
      rest = cut.right;
      left -= weights[i];
      if (left <= 1e-9) break;
    }
    parts.push(rest);
    return parts;
  },

  /**
   * পূর্ণ ভাগ-বণ্টন — অংশীদারসহ, মাপসহ
   *
   * @param {object} doc     নথি (ftPerPx লাগে ক্ষেত্রফলের জন্য)
   * @param {Array}  poly    দাগ
   * @param {Array}  shares  [{ name, value }]
   * @param {object} opt     { mode, angle }
   */
  divide(doc, poly, shares, opt) {
    const o = opt || {};
    const mode = o.mode || 'ratio';
    const { weights, warn } = this.normalize(shares, mode);
    if (!weights.length) return { ok: false, error: warn || 'হিস্যা দিন', parts: [] };

    const parts = this.slice(poly, weights, { angle: o.angle == null ? 0 : o.angle });
    const totalPx = CadCore.area(poly);
    const k = doc && doc.ftPerPx > 0 ? doc.ftPerPx : 0;
    const toSqft = px => px * k * k;

    const out = parts.map((p, i) => {
      const areaPx = CadCore.area(p);
      const sqft = toSqft(areaPx);
      const want = weights[i] * totalPx;
      return {
        name: (shares[i] && shares[i].name) || ('অংশীদার ' + CadCore.bn(i + 1)),
        share: shares[i] ? shares[i].value : '',
        weight: weights[i],
        pts: p,
        areaPx,
        sqft,
        satak: k > 0 ? sqft / CadCore.SQFT_PER_SATAK : 0,
        /* চাওয়া ও পাওয়ার পার্থক্য — দ্বিভাজনের সীমা, সাধারণত ০.১% এর কম */
        errorPct: want > 0 ? (areaPx - want) / want * 100 : 0,
        sides: this._sides(p, k)
      };
    });

    const sumSqft = out.reduce((s, p) => s + p.sqft, 0);
    /* কোনো অংশ প্রায় শূন্য হয়ে গেলে চুপ করে থাকা চলবে না — আকৃতি বিকৃত
       (যেমন দুটি কোণা একই জায়গায়) হলে এমন হয়, আর তখন ফল বিশ্বাসযোগ্য নয়। */
    const empty = out.filter(p => p.areaPx < totalPx * 0.001).length;
    const bad = empty ? 'ভাগ ঠিকমতো হয়নি — ' + CadCore.bn(empty)
      + 'টি অংশ প্রায় শূন্য। জমির আকৃতি দেখে নিন (বাহুর মাপ বা কর্ণ ভুল হতে পারে)।' : null;

    return {
      ok: !bad,
      error: bad,
      warn: bad || warn,
      parts: out,
      totalSqft: toSqft(totalPx),
      sumSqft,
      /* ভাগের পর যোগফল মূল জমির সমান কি না — গোলমাল ধরার সহজ উপায় */
      lossSqft: toSqft(totalPx) - sumSqft,
      maxErrorPct: out.reduce((m, p) => Math.max(m, Math.abs(p.errorPct)), 0)
    };
  },

  _sides(pts, k) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const px = CadCore.dist(a, b);
      out.push({ px, feet: k > 0 ? px * k : 0,
                 mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
    }
    return out;
  },

  /* ==================== ৩. কাটার সুবিধাজনক কোণ ==================== */

  /**
   * দাগের সবচেয়ে লম্বা বাহু বরাবর কাটলে ফালিগুলো সবচেয়ে "স্বাভাবিক" হয় —
   * লম্বা সরু ফালি হয় না, আর রাস্তার দিক সাধারণত লম্বা বাহুই হয়।
   */
  suggestAngle(poly) {
    if (!poly || poly.length < 3) return 0;
    let best = 0, bestLen = -1;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const d = CadCore.dist(a, b);
      if (d > bestLen) { bestLen = d; best = Math.atan2(b.y - a.y, b.x - a.x); }
    }
    return best;
  },

  /** ডিগ্রি ↔ রেডিয়ান (UI স্লাইডারের জন্য) */
  deg(rad) { return rad * 180 / Math.PI; },
  rad(deg) { return deg * Math.PI / 180; },

  /* ==================== ৪. বাহুর মাপ থেকে আকৃতি ==================== */

  /**
   * বাহুর দৈর্ঘ্য (ও ঐচ্ছিক কর্ণ) থেকে বহুভুজ বানানো
   *
   * ★ কেন কর্ণ লাগে
   *   কেবল চারটি বাহু দিয়ে চতুর্ভুজ নির্দিষ্ট হয় না — একই চার বাহুতে অসংখ্য
   *   আকৃতি সম্ভব (কব্জার মতো নড়ে)। একটি কর্ণ দিলে সেটি দুটি ত্রিভুজে ভাগ
   *   হয়ে যায়, তখন আকৃতি নির্দিষ্ট। কর্ণ না দিলে সমকোণী ধরে নেওয়া হয়।
   *
   * @param {number[]} sides   বাহুর দৈর্ঘ্য (ফুটে), ৩–১২টি
   * @param {number}   diag    প্রথম ও তৃতীয় কোণার মাঝের কর্ণ (ঐচ্ছিক)
   * @param {number}   ftPerPx স্থানাঙ্কে নামানোর মাপ
   */
  fromSides(sides, diag, ftPerPx) {
    const s = (sides || []).map(v => CadCore.num(v)).filter(v => isFinite(v) && v > 0);
    if (s.length < 3) return null;
    const k = ftPerPx > 0 ? ftPerPx : 1;
    const px = s.map(v => v / k);                  // ফুট → পিক্সেল

    if (s.length === 3) {
      // ত্রিভুজ — তিন বাহুতেই নির্দিষ্ট
      const [a, b, c] = px;
      if (a + b <= c || b + c <= a || c + a <= b) return null;   // ত্রিভুজ হয় না
      const cosA = (a * a + c * c - b * b) / (2 * a * c);
      const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));
      return [
        { x: 0, y: 0 },
        { x: a, y: 0 },
        { x: c * Math.cos(ang), y: c * Math.sin(ang) }
      ];
    }

    if (s.length === 4) {
      const d = CadCore.num(diag);
      const [a, b, c, dd] = px;
      if (isFinite(d) && d > 0) {
        const dp = d / k;
        // দুই ত্রিভুজ: (a, b, dp) ও (c, dd, dp)
        const t1 = this._triangle(a, b, dp);
        const t2 = this._triangle(dp, c, dd);
        if (t1 && t2) {
          // প্রথম ত্রিভুজ: (0,0) → (a,0) → P
          const P = { x: a + b * Math.cos(Math.PI - t1.angleB), y: b * Math.sin(Math.PI - t1.angleB) };
          // কর্ণ (0,0)–P বরাবর দ্বিতীয় ত্রিভুজ উল্টোদিকে
          const base = Math.atan2(P.y, P.x);
          const Q = {
            x: P.x + c * Math.cos(base + Math.PI - t2.angleB),
            y: P.y + c * Math.sin(base + Math.PI - t2.angleB)
          };
          const poly = [{ x: 0, y: 0 }, { x: a, y: 0 }, P, Q];
          if (poly.every(p => isFinite(p.x) && isFinite(p.y)) && CadCore.area(poly) > 0) return poly;
        }
      }
      /* কর্ণ নেই — ট্রাপিজিয়াম ধরে নিই (১ম ও ৩য় বাহু সমান্তরাল)
       *
       * চার বাহু দিয়ে চতুর্ভুজ নির্দিষ্ট হয় না (কব্জার মতো নড়ে), তাই একটি
       * যুক্তিসঙ্গত অনুমান লাগে। মাঠের চতুর্ভুজ দাগ প্রায়ই ট্রাপিজিয়াম, আর
       * a=c ও b=d হলে এটি নিখুঁত আয়তক্ষেত্রই দেয়।
       *
       *   P0(0,0) ── a ── P1(a,0)
       *      │                │
       *      d                b
       *      │                │
       *   P3(x,h) ── c ── P2(x+c,h)
       *
       *   b² = (x + c − a)² + h²   ও   d² = x² + h²
       */
      const [A, B, C, Dd] = px;
      let x3, h2;
      if (Math.abs(C - A) > 1e-9) {
        x3 = (B * B - Dd * Dd - (C - A) * (C - A)) / (2 * (C - A));
        h2 = Dd * Dd - x3 * x3;
      } else {
        x3 = 0;                                   // a = c ⇒ সমান্তরাল বাহু, সমকোণে বসাই
        h2 = Dd * Dd;
      }
      if (h2 > 1e-9) {
        const h = Math.sqrt(h2);
        const poly = [{ x: 0, y: 0 }, { x: A, y: 0 }, { x: x3 + C, y: h }, { x: x3, y: h }];
        if (poly.every(p => isFinite(p.x) && isFinite(p.y)) &&
            CadCore.area(poly) > 1e-6 &&
            CadCore.dedupe(poly, 1e-6).length === 4) return poly;
      }
      // তাও না হলে গড় মাপের আয়তক্ষেত্র — অন্তত ক্ষেত্রফলটা কাছাকাছি থাকে
      const w = (A + C) / 2, hh = (B + Dd) / 2;
      if (!(w > 0 && hh > 0)) return null;
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: hh }, { x: 0, y: hh }];
    }

    // ৫+ বাহু — বাহুর দৈর্ঘ্যের অনুপাতে বহুভুজ (আনুমানিক, পরে টেনে ঠিক করা যায়)
    const perim = px.reduce((a, b) => a + b, 0);
    let ang = 0;
    const pts = [{ x: 0, y: 0 }];
    for (let i = 0; i < px.length - 1; i++) {
      const last = pts[pts.length - 1];
      pts.push({ x: last.x + px[i] * Math.cos(ang), y: last.y + px[i] * Math.sin(ang) });
      ang += 2 * Math.PI * px[i] / perim;
    }
    return pts;
  },

  /** তিন বাহু থেকে ত্রিভুজের কোণ (B কোণাটি a ও c এর মাঝে) */
  _triangle(a, b, c) {
    if (a + b <= c || b + c <= a || c + a <= b) return null;
    const cosB = (a * a + b * b - c * c) / (2 * a * b);
    return { angleB: Math.acos(Math.max(-1, Math.min(1, cosB))) };
  },

  /* ==================== ৫. তালিকা ==================== */

  /** ভাগের ফল → CSV */
  toCsv(result, doc) {
    const rows = [['অংশীদার', 'হিস্যা', 'শতাংশ', 'কাঠা', 'বর্গফুট', 'বাহুর সংখ্যা']];
    for (const p of result.parts) {
      rows.push([
        p.name, p.share,
        p.satak ? p.satak.toFixed(3) : '',
        p.sqft ? (p.sqft / CadCore.sqftPerKatha()).toFixed(3) : '',
        p.sqft ? p.sqft.toFixed(1) : '',
        p.pts.length
      ]);
    }
    rows.push([]);
    rows.push(['মোট', '', (result.sumSqft / CadCore.SQFT_PER_SATAK).toFixed(3), '',
               result.sumSqft.toFixed(1), '']);
    const esc = v => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CadDivide;
