/* ==========================================================================
   map-measure.js — মৌজা নকশা থেকে জমি পরিমাপ ও ভাগবণ্টন
   --------------------------------------------------------------------------
   ★ মূল ধারণা — স্কেল ক্যালিব্রেশন
     মৌজা নকশায় স্কেল-দণ্ড আঁকা থাকে (সাধারণত ৬৬০ ফুট = ১০ চেইন, নকশার
     স্কেল ১৬ ইঞ্চি = ১ মাইল)। ওই দণ্ডের দুই প্রান্তে ক্লিক করে বাস্তব দৈর্ঘ্য
     বললেই **ফুট প্রতি পিক্সেল** বেরিয়ে আসে। তারপর যেকোনো প্লট আঁকলে তার
     ক্ষেত্রফল বের করা যায়।

     স্কেল-দণ্ড না থাকলে বিকল্প: নকশার স্কেল (১৬ ইঞ্চি = ১ মাইল) ও স্ক্যানের
     DPI দিয়েও হিসাব হয় — `fromMapScale()`।

   ★ ভাগবণ্টন
     একটি প্লটকে নির্দিষ্ট অনুপাতে ভাগ করতে সমান্তরাল রেখা সরানো হয়;
     প্রতিটি ভাগের ক্ষেত্রফল লক্ষ্যে পৌঁছানো পর্যন্ত **বাইসেকশন খোঁজ**।
     ক্ষেত্রফল বের হয় বহুভুজ ক্লিপিং (Sutherland–Hodgman) + শোলেস সূত্রে।

   DOM ছোঁয় না — Node এ টেস্ট করা যায় (tests/mapmeasure-test.js)।
   ========================================================================== */

const MapMeasure = {

  /* ---------------- ধ্রুবক ---------------- */

  SQFT_PER_SATAK: 435.6,          // ১ শতক = ৪৩৫.৬ বর্গফুট (স্থির)
  FT_PER_CHAIN: 66,               // ১ চেইন (গান্টার শিকল) = ৬৬ ফুট = ১০০ লিংক
  FT_PER_MILE: 5280,              // ১৭৬০ গজ × ৩

  /* ---------------- গুনিয়া / লিংক ব্যবস্থা ----------------
     আমিনরা মৌজা নকশায় **লিংক** এককে মাপেন, ফুটে নয়।
        ১ লিংক  = ০.৬৬ ফুট = ৭.৯২ ইঞ্চি
        ১০০ লিংক = ১ গান্টার শিকল = ৬৬ ফুট
        ৮০০০ লিংক = ১ মাইল
        ★ ১০০০ বর্গ লিংক = ১ শতক   (০.৬৬² × ১০০০ = ৪৩৫.৬ বর্গফুট ✓)
        ১,০০,০০০ বর্গ লিংক = ১ একর
     উৎস: landregistrationbd.com — "গুনিয়া স্কেলে মৌজা ম্যাপ থেকে জমি পরিমাপ"
     ⚠️ ওই লেখায় "৬২৮০ ফুটে ১ মাইল" ছাপার ভুল; আসলে ৫২৮০ (১৭৬০ গজ × ৩)।
        ৫২৮০ ÷ ৮০০০ = ০.৬৬ — ওদেরই দেওয়া লিংকের মানের সাথে মেলে।
  */
  FT_PER_LINK: 0.66,
  LINK_PER_MILE: 8000,
  SQLINK_PER_SATAK: 1000,

  /**
   * ★ নকশা মাপার দুই রকম স্কেল — গুনিয়া ও ফুট (মাপনি)
   *
   * গুনিয়ায় দুটি সারি — নিচেরটা বড় ঘর, উপরেরটা ঠিক তার অর্ধেক।
   * ইউজারের (ভূমি রেকর্ডের বিশেষজ্ঞ) দেওয়া নিয়মের সাথে মিলিয়ে দেখা:
   *
   *   ইঞ্চি/মাইল | গুনিয়া নিচ | গুনিয়া উপর | ফুট স্কেল
   *   ১৬         | ২০ লিংক   | ১০ লিংক    | ১০ ফুট
   *   ৩২         | ১০ লিংক   | ৫ লিংক     | ৫ ফুট
   *   ৬৪         | ৫ লিংক    | ২.৫ লিংক   | ২.৫ ফুট
   *   ৮০         | ৪ লিংক    | ২ লিংক     | ২ ফুট
   *
   * অর্থাৎ প্রতি ইঞ্চিতে দাগের সংখ্যা স্থির — গুনিয়া নিচ ২৫, উপর ৫০,
   * ফুট স্কেল ৩৩। ফুট স্কেলের ৩৩ চারটি স্কেলেই এক:
   *   ৩৩০÷১০ = ১৬৫÷৫ = ৮২.৫÷২.৫ = ৬৬÷২ = ৩৩
   * তাই একটি ফুট স্কেল দিয়েই সব নকশা পড়া যায়, কেবল ঘরপ্রতি মান বদলায়।
   */
  GUNIA_MARKS_PER_INCH: 25,        // গুনিয়ার নিচের সারি (বড় ঘর)
  GUNIA_FINE_MARKS_PER_INCH: 50,   // গুনিয়ার উপরের সারি (ছোট ঘর)
  FOOT_SCALE_MARKS_PER_INCH: 33,   // ফুট (মাপনি) স্কেল

  /** যে তিন রকম সারি ধরে আমিনরা মাপেন */
  SCALE_BARS: [
    { id: 'gunia',     name: 'গুনিয়া নিচের সারি (বড় ঘর)', marksPerInch: 25, unit: 'link' },
    { id: 'guniaFine', name: 'গুনিয়া উপরের সারি (ছোট ঘর)', marksPerInch: 50, unit: 'link' },
    { id: 'foot',      name: 'ফুট (মাপনি) স্কেল', marksPerInch: 33, unit: 'ft' }
  ],

  /**
   * এক ঘর (এক দাগ থেকে পরের দাগ) কতটুকু
   * @param {string} barId  gunia | guniaFine | foot
   * @param {number} inchPerMile  ১৬ · ৩২ · ৬৪ · ৮০
   */
  barMark(barId, inchPerMile) {
    const bar = this.SCALE_BARS.filter(b => b.id === barId)[0];
    if (!bar) throw new Error('স্কেলের সারি চেনা গেল না');
    const n = Number(inchPerMile);
    if (!(n > 0)) throw new Error('স্কেল শূন্যের বেশি হতে হবে');
    const feet = (this.FT_PER_MILE / n) / bar.marksPerInch;
    // লিংক সরাসরি — ফুট থেকে ঘুরিয়ে আনলে ২০ এর বদলে ১৯.৯৯৯৯ আসে
    return { id: bar.id, feet, link: (this.LINK_PER_MILE / n) / bar.marksPerInch,
             marksPerInch: bar.marksPerInch, name: bar.name };
  },

  /** ঘর গুনে দূরত্ব — আমিন যেভাবে মাপেন */
  barLength(barId, inchPerMile, marks) {
    const m = this.barMark(barId, inchPerMile);
    const k = Number(marks) || 0;
    return { feet: m.feet * k, link: m.link * k, perMark: m };
  },

  /**
   * পদ্ধতি ২ এর দূরত্বের তালিকা — চেইনের সাথে ঘর-ভিত্তিকও
   * নকশার নিজের স্কেল-দণ্ডে ঘর গুনে ক্লিক করাটাই সবচেয়ে সহজ
   */
  calibChoices(inchPerMile) {
    const bn = v => (typeof toBn === 'function' ? toBn(v) : String(v));
    const num = v => bn(String(Number(v.toFixed(2))));
    const out = this.COMMON_SCALES.map(x => ({ ft: x.ft, label: x.label }));
    const n = Number(inchPerMile);
    if (!(n > 0)) return out;
    this.SCALE_BARS.forEach(b => {
      const m = this.barMark(b.id, n);
      // ১০ ঘর, আর পুরো ১ ইঞ্চি — দুটোই নকশায় গুনতে সহজ
      [10, b.marksPerInch].forEach(marks => {
        const ft = m.feet * marks;
        out.push({ ft, label: b.name + ' — ' + bn(marks) + ' ঘর'
          + (marks === b.marksPerInch ? ' (১ ইঞ্চি)' : '')
          + ' = ' + num(ft) + ' ফুট' });
      });
    });
    return out;
  },

  /** নকশায় প্রচলিত স্কেল-দণ্ডের দৈর্ঘ্য (ফুট) — ইউজার বদলাতে পারবেন */
  COMMON_SCALES: [
    { ft: 660, label: '৬৬০ ফুট (১০ চেইন)' },
    { ft: 330, label: '৩৩০ ফুট (৫ চেইন)' },
    { ft: 132, label: '১৩২ ফুট (২ চেইন)' },
    { ft: 66,  label: '৬৬ ফুট (১ চেইন)' }
  ],

  /**
   * মৌজা নকশার প্রচলিত স্কেল — "কত ইঞ্চিতে কত ফুট"
   * বাংলাদেশে সবচেয়ে প্রচলিত ১৬ ইঞ্চি = ১ মাইল, অর্থাৎ ইঞ্চিপ্রতি ৩৩০ ফুট।
   */
  /**
   * বাংলাদেশের মৌজা নকশায় প্রচলিত স্কেল — ইঞ্চি প্রতি মাইল
   * (গুনিয়া স্কেলের আর্টিকেল অনুযায়ী ১৬ · ৩২ · ৬৪ · ৮০ — এগুলোই বাস্তবে চলে)
   * প্রতিটির সাথে গুনিয়া স্কেলের পাঠও দেওয়া হলো, কারণ আমিনরা ওভাবেই পড়েন।
   */
  MAP_SCALES: [
    { inchPerMile: 16, label: '১৬ ইঞ্চি = ১ মাইল · 1″=330′ (সাধারণ মৌজা ম্যাপ)' },
    { inchPerMile: 32, label: '৩২ ইঞ্চি = ১ মাইল · 1″=165′' },
    { inchPerMile: 64, label: '৬৪ ইঞ্চি = ১ মাইল · 1″=82.5′' },
    { inchPerMile: 80, label: '৮০ ইঞ্চি = ১ মাইল · 1″=66′ (সিটি জরিপ / বিআরএস)' },
  ].map(function (x) {
    return { inchPerMile: x.inchPerMile, ftPerInch: 5280 / x.inchPerMile,
             linkPerInch: 8000 / x.inchPerMile,
             linkPerMark: (8000 / x.inchPerMile) / 25, label: x.label };
  }),

  /** স্ক্যানের প্রচলিত DPI */
  DPI_OPTIONS: [
    { dpi: 300, label: '৩০০ DPI (স্ট্যান্ডার্ড স্ক্যান)' },
    { dpi: 150, label: '১৫০ DPI (সাধারণ)' },
    { dpi: 200, label: '২০০ DPI' },
    { dpi: 400, label: '৪০০ DPI (উচ্চ মান)' },
    { dpi: 600, label: '৬০০ DPI (সর্বোচ্চ)' }
  ],

  /**
   * ★ PDF এ DPI বাছার দরকার নেই — রেন্ডার স্কেল থেকেই বেরিয়ে আসে।
   *
   * PDF এর পাতা পরিমাপ হয় **পয়েন্টে** (১ পয়েন্ট = ১/৭২ ইঞ্চি)। আমরা যখন
   * স্কেল `s` এ আঁকি, পাতার প্রস্থ `W` পয়েন্ট হলে ক্যানভাস হয় `W×s` পিক্সেল,
   * আর বাস্তব প্রস্থ `W/৭২` ইঞ্চি। তাই
   *      পিক্সেল/ইঞ্চি = (W×s) ÷ (W/৭২) = ৭২ × s
   * অর্থাৎ DPI কেবল রেন্ডার স্কেলের উপর নির্ভর করে — স্ক্যানের উপর নয়।
   * (প্রতিযোগীর ডায়ালগেও তাই "স্ক্যান DPI — PDF-এর জন্য বন্ধ" লেখা।)
   */
  dpiForPdf(renderScale) {
    const s = Number(renderScale);
    if (!(s > 0)) throw new Error('রেন্ডার স্কেল শূন্যের বেশি হতে হবে');
    return 72 * s;
  },

  /**
   * ফুটকে "৬০'১\"" ধাঁচে — মাঠে আমিনরা এভাবেই বলেন
   * ইঞ্চি ১২ হয়ে গেলে ফুটে চড়িয়ে দেওয়া হয় (৫৯'১২" নয়, ৬০'০")
   */
  formatFtIn(feet, bn) {
    const f = Number(feet) || 0;
    const neg = f < 0;
    let ft = Math.floor(Math.abs(f));
    let inch = Math.round((Math.abs(f) - ft) * 12);
    if (inch >= 12) { ft += 1; inch = 0; }
    const num = n => (bn === false || typeof toBn !== 'function') ? String(n) : toBn(n);
    return (neg ? '−' : '') + num(ft) + "'" + num(inch) + '"';
  },

  /** বহুভুজের প্রতিটি বাহুর দৈর্ঘ্য (ফুটে) — লেবেল বসানোর জন্য */
  edgeLengths(pts, ftPerPx, closed) {
    const out = [];
    if (!Array.isArray(pts) || pts.length < 2) return out;
    const n = closed === false ? pts.length - 1 : pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push({
        from: i, to: (i + 1) % pts.length,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        px: this.dist(a, b),
        feet: this.dist(a, b) * (ftPerPx || 0)
      });
    }
    return out;
  },

  /** বহুভুজের কেন্দ্র (ক্ষেত্রফল-ভারিত) — ভেতরে লেবেল বসাতে */
  centroid(pts) {
    if (!Array.isArray(pts) || pts.length === 0) return { x: 0, y: 0 };
    if (pts.length < 3) {
      const n = pts.length;
      return { x: pts.reduce((s, p) => s + p.x, 0) / n,
               y: pts.reduce((s, p) => s + p.y, 0) / n };
    }
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const cr = p.x * q.y - q.x * p.y;
      a += cr; cx += (p.x + q.x) * cr; cy += (p.y + q.y) * cr;
    }
    if (Math.abs(a) < 1e-12) {          // অবক্ষয়িত — গড় ধরি
      const n = pts.length;
      return { x: pts.reduce((s, p) => s + p.x, 0) / n,
               y: pts.reduce((s, p) => s + p.y, 0) / n };
    }
    a *= 0.5;
    return { x: cx / (6 * a), y: cy / (6 * a) };
  },

  /* ---------------- স্কেল ---------------- */

  /**
   * দুই বিন্দুর দূরত্ব (পিক্সেলে)
   */
  dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); },

  /**
   * স্কেল-দণ্ড থেকে ক্যালিব্রেশন
   * @param {{x,y}} a  দণ্ডের এক প্রান্ত
   * @param {{x,y}} b  অন্য প্রান্ত
   * @param {number} realFeet  ওই দূরত্ব বাস্তবে কত ফুট
   * @returns {{ftPerPx:number, pxLength:number, realFeet:number}}
   */
  calibrate(a, b, realFeet) {
    const px = this.dist(a, b);
    const ft = Number(realFeet);
    if (!(px > 0)) throw new Error('স্কেলের দুই প্রান্ত একই জায়গায় — দুটি আলাদা বিন্দু দিন');
    if (!(ft > 0)) throw new Error('বাস্তব দৈর্ঘ্য শূন্যের বেশি হতে হবে');
    return { ftPerPx: ft / px, pxLength: px, realFeet: ft };
  },

  /**
   * নকশার স্কেল ও স্ক্যানের DPI থেকে ক্যালিব্রেশন (স্কেল-দণ্ড না থাকলে)
   * উদাহরণ: ১৬ ইঞ্চি = ১ মাইল, ৩০০ DPI
   *   ১ ইঞ্চিতে বাস্তবে ৫২৮০/১৬ = ৩৩০ ফুট
   *   ১ ইঞ্চিতে ছবিতে ৩০০ পিক্সেল  →  ফুট/পিক্সেল = ৩৩০/৩০০ = ১.১
   * @param {number} inchesOnMap   নকশায় কত ইঞ্চি
   * @param {number} realFeet      তা বাস্তবে কত ফুট
   * @param {number} dpi           স্ক্যানের DPI
   */
  fromMapScale(inchesOnMap, realFeet, dpi) {
    const i = Number(inchesOnMap), f = Number(realFeet), d = Number(dpi);
    if (!(i > 0) || !(f > 0) || !(d > 0)) {
      throw new Error('ইঞ্চি, ফুট ও DPI — তিনটিই শূন্যের বেশি হতে হবে');
    }
    return { ftPerPx: (f / i) / d, inchesOnMap: i, realFeet: f, dpi: d };
  },

  /**
   * নকশার স্কেল থেকে গুনিয়ার পাঠ — আমিনদের ভাষায়
   * @param {number} inchPerMile  যেমন ১৬
   */
  guniaReading(inchPerMile) {
    const n = Number(inchPerMile);
    if (!(n > 0)) throw new Error('স্কেল শূন্যের বেশি হতে হবে');
    const linkPerInch = this.LINK_PER_MILE / n;
    return {
      inchPerMile: n,
      linkPerInch,
      ftPerInch: this.FT_PER_MILE / n,
      linkPerMark: linkPerInch / this.GUNIA_MARKS_PER_INCH,   // বড় এক দাগ
      ftPerMark: (this.FT_PER_MILE / n) / this.GUNIA_MARKS_PER_INCH
    };
  },

  /* ---------------- একক: ফুট ↔ লিংক ---------------- */

  ftToLink(feet) { return (Number(feet) || 0) / this.FT_PER_LINK; },
  linkToFt(link) { return (Number(link) || 0) * this.FT_PER_LINK; },

  /** বর্গফুট → বর্গ লিংক */
  sqftToSqlink(sqft) {
    return (Number(sqft) || 0) / (this.FT_PER_LINK * this.FT_PER_LINK);
  },

  /** দৈর্ঘ্য লিংকে লেখা — "৩৩৩.৩ লিংক" */
  formatLink(feet, digits) {
    const v = this.ftToLink(feet);
    const d = digits == null ? 1 : digits;
    const txt = v.toFixed(d);
    return (typeof toBn === 'function' ? toBn(txt) : txt) + ' লিংক';
  },

  /**
   * নকশার স্কেল (ইঞ্চি প্রতি মাইল) ও DPI থেকে সরাসরি ফুট/পিক্সেল
   * উদাহরণ: ১৬ ইঞ্চি = ১ মাইল, ৩০০ DPI → (৫২৮০/১৬)/৩০০ = ১.১
   */
  fromInchPerMile(inchPerMile, dpi) {
    const n = Number(inchPerMile);
    if (!(n > 0)) throw new Error('স্কেল শূন্যের বেশি হতে হবে');
    return this.fromMapScale(1, this.FT_PER_MILE / n, dpi);
  },

  /* ---------------- ক্ষেত্রফল ---------------- */

  /** শোলেস সূত্রে বহুভুজের ক্ষেত্রফল (পিক্সেল², সর্বদা ধনাত্মক) */
  areaPx(pts) {
    if (!Array.isArray(pts) || pts.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s) / 2;
  },

  /** বহুভুজের পরিসীমা (পিক্সেল) */
  perimeterPx(pts) {
    if (!Array.isArray(pts) || pts.length < 2) return 0;
    let s = 0;
    for (let i = 0; i < pts.length; i++) s += this.dist(pts[i], pts[(i + 1) % pts.length]);
    return s;
  },

  /** পিক্সেল² → বর্গফুট */
  sqFt(pts, ftPerPx) {
    const f = Number(ftPerPx);
    if (!(f > 0)) throw new Error('আগে স্কেল ঠিক করুন');
    return this.areaPx(pts) * f * f;
  },

  /**
   * বর্গফুট → সব একক
   * কাঠা/বিঘা ব্যবহারকারীর সেটিং অনুযায়ী (LandMath থেকে) — প্রজেক্টের নিয়ম
   */
  units(sqft) {
    const s = Number(sqft) || 0;
    const satak = s / this.SQFT_PER_SATAK;
    let sqftPerKatha = 720;
    if (typeof LandMath !== 'undefined' && LandMath.kathaBasis) {
      const b = LandMath.kathaBasis();
      if (b && b.sqft > 0) sqftPerKatha = b.sqft;
    }
    return {
      sqft: s,
      satak,
      acre: satak / 100,
      katha: s / sqftPerKatha,
      bigha: s / (sqftPerKatha * 20),
      sqm: s * 0.09290304,
      // আমিনরা বর্গ লিংকে হিসাব করেন — ১০০০ বর্গ লিংক = ১ শতক
      sqlink: s / (this.FT_PER_LINK * this.FT_PER_LINK)
    };
  },

  /* ---------------- ল্যাবেলের একক ---------------- */

  /**
   * বাহুর মাপ কোন এককে লেখা হবে
   * (ওদের "ল্যাবেলের একক" ড্রপডাউনের সমকক্ষ)
   */
  LABEL_UNITS: [
    { id: 'ftin',  label: "ফিট'ইঞ্চি\" (ডিফল্ট)" },
    { id: 'ft',    label: 'ফিট' },
    { id: 'link',  label: 'লিংক' },
    { id: 'chain', label: 'চেইন' },
    { id: 'meter', label: 'মিটার' }
  ],

  /**
   * ফুটকে নির্বাচিত এককে লেখা
   * @param {number} feet
   * @param {string} unit  ftin · ft · link · chain · meter
   */
  formatLength(feet, unit) {
    const f = Number(feet) || 0;
    const bn = t => (typeof toBn === 'function' ? toBn(t) : String(t));
    switch (unit) {
      case 'ft':    return bn(f.toFixed(1)) + "'";
      case 'link':  return bn(this.ftToLink(f).toFixed(1)) + ' লিংক';
      case 'chain': return bn((f / this.FT_PER_CHAIN).toFixed(3)) + ' চেইন';
      case 'meter': return bn((f * 0.3048).toFixed(2)) + ' মি';
      case 'ftin':
      default:      return this.formatFtIn(f);
    }
  },

  /* ---------------- বহুভুজ ক্লিপিং ---------------- */

  /**
   * সরলরেখার এক পাশের অংশ কেটে নেওয়া (Sutherland–Hodgman অর্ধ-তল ক্লিপ)
   * রেখা: বিন্দু `p0` দিয়ে যায়, দিক `n` (একক লম্ব ভেক্টর)।
   * `n·(P − p0) <= 0` পাশটি রাখা হয়।
   */
  clipHalfPlane(pts, p0, n) {
    if (!Array.isArray(pts) || pts.length < 3) return [];
    const side = p => n.x * (p.x - p0.x) + n.y * (p.y - p0.y);
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const A = pts[i], B = pts[(i + 1) % pts.length];
      const sa = side(A), sb = side(B);
      const inA = sa <= 0, inB = sb <= 0;
      if (inA) out.push(A);
      if (inA !== inB) {
        const t = sa / (sa - sb);            // ছেদবিন্দু
        out.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t });
      }
    }
    return out;
  },

  /**
   * নির্দিষ্ট দিকে সমান্তরাল রেখা সরিয়ে লক্ষ্য ক্ষেত্রফলের অংশ কাটা
   *
   * @param {Array} pts      মূল বহুভুজ (পিক্সেল)
   * @param {number} angleDeg কাটার রেখার লম্ব দিক (০° = পূর্ব, ৯০° = উত্তর)
   * @param {number} targetPxArea  কত পিক্সেল² কাটতে হবে
   * @returns {{piece:Array, rest:Array, offset:number, iterations:number, areaPx:number}}
   */
  cutByArea(pts, angleDeg, targetPxArea) {
    const total = this.areaPx(pts);
    if (total <= 0) throw new Error('বহুভুজের ক্ষেত্রফল শূন্য');
    const target = Number(targetPxArea);
    if (!(target > 0)) throw new Error('কাটার পরিমাণ শূন্যের বেশি হতে হবে');
    if (target >= total) throw new Error('কাটার পরিমাণ মোট জমির চেয়ে বেশি বা সমান');

    const r = angleDeg * Math.PI / 180;
    const n = { x: Math.cos(r), y: Math.sin(r) };

    // বহুভুজের সব বিন্দুকে n বরাবর প্রক্ষেপ করে সীমা বের করি
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) {
      const d = n.x * p.x + n.y * p.y;
      if (d < lo) lo = d;
      if (d > hi) hi = d;
    }

    // বাইসেকশন — offset বাড়ালে কাটা অংশ বাড়ে (একঘাতী)
    let a = lo, b = hi, mid = lo, piece = [], iter = 0;
    for (; iter < 60; iter++) {
      mid = (a + b) / 2;
      const p0 = { x: n.x * mid, y: n.y * mid };
      piece = this.clipHalfPlane(pts, p0, n);
      const got = this.areaPx(piece);
      if (Math.abs(got - target) < total * 1e-9) break;
      if (got < target) a = mid; else b = mid;
    }

    const p0 = { x: n.x * mid, y: n.y * mid };
    const rest = this.clipHalfPlane(pts, p0, { x: -n.x, y: -n.y });
    return { piece, rest, offset: mid, iterations: iter, areaPx: this.areaPx(piece) };
  },

  /**
   * শরিকদের মাঝে ভাগ — অনুপাত অনুযায়ী পরপর কেটে নেওয়া
   * @param {Array} pts
   * @param {number} angleDeg
   * @param {Array<number>} shares  অনুপাত (যেকোনো ধনাত্মক সংখ্যা; যোগফল ধরে ভাগ)
   * @returns {Array<{index, share, polygon, areaPx, ratio}>}
   */
  divide(pts, angleDeg, shares) {
    const list = (shares || []).map(Number).filter(v => v > 0);
    if (list.length < 2) throw new Error('অন্তত দুইজন শরিকের অংশ দিন');
    const sum = list.reduce((a, b) => a + b, 0);
    const total = this.areaPx(pts);

    const out = [];
    let remain = pts.slice();
    let remainArea = total;

    for (let i = 0; i < list.length - 1; i++) {
      const want = total * (list[i] / sum);
      if (want >= remainArea) {          // ভাসমান-বিন্দুর প্রান্তিক কেস
        out.push({ index: i, share: list[i], polygon: remain,
                   areaPx: remainArea, ratio: list[i] / sum });
        remain = []; remainArea = 0;
        break;
      }
      const c = this.cutByArea(remain, angleDeg, want);
      out.push({ index: i, share: list[i], polygon: c.piece,
                 areaPx: c.areaPx, ratio: list[i] / sum });
      remain = c.rest;
      remainArea = this.areaPx(remain);
    }
    if (remain.length >= 3) {
      const i = out.length;
      out.push({ index: i, share: list[i], polygon: remain,
                 areaPx: remainArea, ratio: list[i] / sum });
    }
    return out;
  },

  /**
   * ★ বেরিয়ে আসা স্কেলটা আদৌ বিশ্বাসযোগ্য?
   *
   * PDF থেকে DPI বের করা হয় `৭২ × রেন্ডার স্কেল` দিয়ে — কিন্তু সেটা ঠিক
   * তখনই, যখন PDF এর পাতার মাপ **আসল কাগজের মাপ**। স্ক্যান করা নকশা
   * ছবি→PDF করলে পাতার মাপ প্রায়ই ছবির পিক্সেল সংখ্যা হয়ে যায়; তখন
   * বেরোনো DPI অর্থহীন আর সব মাপ ওই অনুপাতে ভুল হয় — নীরবে।
   *
   * তাই ফলটা যাচাই করি: বাংলাদেশের মৌজা নকশা ১৬–৮০ ইঞ্চি = ১ মাইল, আর
   * স্ক্যান হয় ১৫০–৬০০ DPI তে। তাতে ১ পিক্সেল দাঁড়ায় ০.১১–২.২০ ফুট।
   * এর বাইরে গেলে ধরে নেওয়া যায় DPI ভুল।
   *
   * @returns {{ok:boolean, level:string, msg:string, ftPerPx:number}}
   */
  SANE_FT_PER_PX: { min: 0.08, max: 3.0 },

  scaleSanity(ftPerPx, dpi) {
    const f = Number(ftPerPx) || 0;
    const S = this.SANE_FT_PER_PX;
    if (!(f > 0)) {
      return { ok: false, level: 'none', ftPerPx: f, msg: 'স্কেল এখনো ঠিক করা হয়নি' };
    }
    if (f >= S.min && f <= S.max) {
      return { ok: true, level: 'ok', ftPerPx: f,
        msg: '১ পিক্সেল = ' + f.toFixed(3) + ' ফুট — স্বাভাবিক' };
    }
    const big = f > S.max;
    const off = big ? f / S.max : S.min / f;
    return {
      ok: false, level: 'bad', ftPerPx: f,
      msg: '১ পিক্সেল = ' + f.toFixed(3) + ' ফুট — মৌজা নকশায় এটি '
        + (big ? 'অস্বাভাবিক বড়' : 'অস্বাভাবিক ছোট') + '। মাপ প্রায় '
        + (off >= 2 ? Math.round(off) + ' গুণ' : 'অনেকটা')
        + (big ? ' বেশি' : ' কম') + ' আসবে।'
        + (dpi ? ' ধরা DPI ' + Math.round(dpi) + '.' : '')
    };
  },

  /* ---------------- বহুভুজ সত্যি বৈধ তো? ---------------- */

  /**
   * পরপর একই জায়গায় পড়া বিন্দু বাদ দেওয়া
   * ডবল-ট্যাপে দুবার বসলে শূন্য দৈর্ঘ্যের বাহু তৈরি হয় — ক্ষেত্রফল ঠিক
   * থাকলেও বাহুর তালিকায় "০'০"" আসে আর স্ব-ছেদের পরীক্ষাও গোলায়।
   */
  cleanPoints(pts, minDist) {
    if (!Array.isArray(pts)) return [];
    const d = minDist > 0 ? minDist : 1e-6;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const last = out[out.length - 1];
      if (last && Math.hypot(pts[i].x - last.x, pts[i].y - last.y) <= d) continue;
      out.push(pts[i]);
    }
    // শেষ ও প্রথম বিন্দুও এক হতে পারে
    while (out.length > 1) {
      const a = out[0], b = out[out.length - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) <= d) out.pop();
      else break;
    }
    return out;
  },

  /**
   * ★ নিজেকে কেটে যাওয়া বহুভুজ ধরা
   *
   * এটা কেন দরকার — কোণা ভুল ক্রমে বসলে শোয়েলেস সূত্র এক টুকরো
   * যোগ করে আর আরেক টুকরো বিয়োগ করে — উত্তর ভুল হয়, অথচ
   * বিশ্বাসযোগ্য দেখায়। মেপে দেখা: ৪০০×৩০০ px প্লটে একটি কোণা
   * ভেতরে টানলে ১৩৩৩.৩৩ শতকের বদলে ১০০০.০০ দেখায় — ২৫% ভুল।
   * পুরো উল্টে গেলে ০.০০।
   *
   * @returns {{i:number, j:number}|null} যে দুই বাহু কাটাকাটি করেছে
   */
  selfIntersects(pts) {
    if (!Array.isArray(pts) || pts.length < 4) return null;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        // পাশাপাশি বাহু প্রান্তে মিলবেই — তাদের বাদ
        if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
        if (this._segCross(a, b, pts[j], pts[(j + 1) % n])) return { i, j };
      }
    }
    return null;
  },

  /** দুই রেখাখণ্ড কাটাকাটি করে? (স্পর্শ ও মিশে যাওয়াও ধরা) */
  _segCross(a, b, c, d) {
    const cr = (o, u, v) => (u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x);
    const d1 = cr(a, b, c), d2 = cr(a, b, d), d3 = cr(c, d, a), d4 = cr(c, d, b);
    // স্পষ্ট ক্রস — দুই পাশে দুই চিহ্ন
    if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))
        && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0) return true;
    // সমরেখ হয়ে ওপরে পড়া (ডুপ্লিকেট বিন্দু এখানে ধরা পড়ে)
    const sz = Math.max(Math.hypot(b.x - a.x, b.y - a.y),
                        Math.hypot(d.x - c.x, d.y - c.y), 1);
    const E = 1e-9 * sz * sz;
    const on = (u, v, q) =>
      Math.min(u.x, v.x) - 1e-9 <= q.x && q.x <= Math.max(u.x, v.x) + 1e-9 &&
      Math.min(u.y, v.y) - 1e-9 <= q.y && q.y <= Math.max(u.y, v.y) + 1e-9;
    if (Math.abs(d1) <= E && on(a, b, c)) return true;
    if (Math.abs(d2) <= E && on(a, b, d)) return true;
    if (Math.abs(d3) <= E && on(c, d, a)) return true;
    if (Math.abs(d4) <= E && on(c, d, b)) return true;
    return false;
  },

  /**
   * ★ একটি ভাগ কয় আলাদা টুকরোয় পড়লো
   *
   * অবতল (U বা L আকারের) প্লট সমান্তরাল রেখায় কাটলে একজন শরিকের
   * অংশ দুই জায়গায় ছিটেফোটা পড়তে পারে — ক্ষেত্রফল ঠিক, কিন্তু বাস্তবে
   * এক টুকরো জমি নয়। বন্টননামায় এটা জানানো দরকার।
   *
   * পদ্ধতি — স্ক্যানলাইন সুইপ:
   *   ১. শীর্ষবিন্দুগুলোর y ধরে স্লাইস বানাই (বদল কেবল শীর্ষেই ঘটে)
   *   ২. প্রতি স্লাইসে বহুভুজটি কয়টা পট্টিতে কাটে বের করি
   *   ৩. পাশাপাশি স্লাইসের পট্টি মিললে একসাথে জোড়া লাগাই (union-find)
   *   ৪. কতগুলো দল রইল = কত টুকরো
   *
   * মাঝের একটি রেখা দেখলে চলত না — U এর দুই পা মাঝে আলাদা দেখালেও
   * নিচের পাটাতনে জোড়া থাকতে পারে। সেই ভুল এখানে হয় না।
   *
   * @returns {number} কতটি আলাদা টুকরো (ন্যূনতম ১)
   */
  countPieces(poly) {
    if (!Array.isArray(poly) || poly.length < 3) return 0;
    const n = poly.length;

    // শীর্ষের y গুলোই ঘটনা — এর মাঝে গঠন বদলায় না
    const ys = poly.map(q => q.y).slice().sort((a, b) => a - b);
    const uniq = [];
    for (let i = 0; i < ys.length; i++) {
      if (!uniq.length || Math.abs(ys[i] - uniq[uniq.length - 1]) > 1e-9) uniq.push(ys[i]);
    }
    if (uniq.length < 2) return 1;

    /** y রেখায় বহুভুজ কাটলে যে পট্টিগুলো পাওয়া যায় */
    const spansAt = y => {
      const xs = [];
      for (let i = 0; i < n; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
        }
      }
      xs.sort((p1, p2) => p1 - p2);
      const out = [];
      for (let i = 0; i + 1 < xs.length; i += 2) {
        if (xs[i + 1] - xs[i] > 1e-9) out.push([xs[i], xs[i + 1]]);
      }
      return out;
    };

    const find = (par, i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const par = [];
    let prev = [], prevIds = [];

    for (let k = 0; k + 1 < uniq.length; k++) {
      const spans = spansAt((uniq[k] + uniq[k + 1]) / 2);
      const ids = spans.map(() => { par.push(par.length); return par.length - 1; });
      // আগের স্লাইসের সাথে ওভারল্যাপ থাকলে এক দল
      for (let i = 0; i < spans.length; i++) {
        for (let j = 0; j < prev.length; j++) {
          const lo = Math.max(spans[i][0], prev[j][0]);
          const hi = Math.min(spans[i][1], prev[j][1]);
          if (hi - lo > 1e-9) {
            const a = find(par, ids[i]), b = find(par, prevIds[j]);
            if (a !== b) par[a] = b;
          }
        }
      }
      prev = spans; prevIds = ids;
    }

    if (!par.length) return 1;
    const roots = {};
    for (let i = 0; i < par.length; i++) roots[find(par, i)] = 1;
    return Math.max(1, Object.keys(roots).length);
  },

  /**
   * বিন্দুটি বহুভুজের ভেতরে? (ray casting)
   * প্লটে ট্যাপ করে বাছাই করার জন্য দরকার।
   */
  pointInPolygon(pt, poly) {
    if (!Array.isArray(poly) || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      const hit = (a.y > pt.y) !== (b.y > pt.y) &&
                  pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
      if (hit) inside = !inside;
    }
    return inside;
  },

  /**
   * বৃত্তকে বহুভুজে রূপান্তর — ক্ষেত্রফল ও ভাগ করার জন্য
   *
   * ★ ক্ষেত্রফল-রক্ষী (area-preserving)
   *   সাধারণ অন্তর্লিখিত n-ভুজের ক্ষেত্রফল πr² এর চেয়ে কম — ৭২ বাহুতে
   *   ০.১২৭% কম। জমির হিসাবে ১০০ শতকে ০.১৩ শতক ভুল, যা এড়ানো যায়।
   *   তাই ব্যাসার্ধ সামান্য বাড়িয়ে নেওয়া হয়:
   *        k = √( (2π/n) ÷ sin(2π/n) )
   *   এতে বহুভুজের ক্ষেত্রফল **ঠিক πr²** হয়, আর ১৮০ বাহুতে ব্যাসার্ধ
   *   মাত্র ০.০১০২% বাড়ে — চোখে ধরা পড়ে না।
   */
  circleToPolygon(center, radiusPx, segments) {
    const n = Math.max(12, Math.min(720, segments || 180));
    const step = (Math.PI * 2) / n;
    const k = Math.sqrt(step / Math.sin(step));      // ক্ষেত্রফল-রক্ষী সংশোধন
    const r = radiusPx * k;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i * step;
      out.push({ x: center.x + r * Math.cos(a),
                 y: center.y + r * Math.sin(a) });
    }
    return out;
  },

  /** বৃত্তের প্রকৃত ক্ষেত্রফল (পিক্সেল²) */
  circleAreaPx(radiusPx) {
    const r = Number(radiusPx) || 0;
    return Math.PI * r * r;
  },

  /**
   * ম্যানুয়াল ভাগ — যেকোনো রেখা টেনে প্লটকে দুই ভাগে কাটা
   * রেখাটি প্লটকে সত্যিই দুই ভাগ করছে কি না যাচাই করা হয়।
   * @returns {{a:Array, b:Array, areaA:number, areaB:number}}
   */
  sliceByLine(pts, p1, p2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-9)) throw new Error('রেখাটি অনেক ছোট — টেনে বড় করুন');

    // রেখার লম্ব ভেক্টর
    const n = { x: -dy / len, y: dx / len };
    const a = this.clipHalfPlane(pts, p1, n);
    const b = this.clipHalfPlane(pts, p1, { x: -n.x, y: -n.y });

    const aA = this.areaPx(a), aB = this.areaPx(b);
    const total = this.areaPx(pts);
    if (aA < total * 1e-6 || aB < total * 1e-6) {
      throw new Error('রেখাটি প্লটকে দুই ভাগে কাটছে না — প্লটের ভেতর দিয়ে টানুন');
    }
    return { a, b, areaA: aA, areaB: aB };
  },

  /**
   * কোনো বাহুর **লম্ব দিক** (ডিগ্রিতে) — ভাগের রেখা ওই বাহুর সমান্তরাল হবে
   * ওদের UI তে "কোন বাহু বরাবর কাটবেন" বাছাই করা যায়; সেটাই এখানে।
   */
  sideNormalAngle(pts, sideIndex) {
    if (!Array.isArray(pts) || pts.length < 3) throw new Error('বহুভুজ লাগবে');
    const i = ((Number(sideIndex) || 0) % pts.length + pts.length) % pts.length;
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 1e-9) throw new Error('বাহুটির দৈর্ঘ্য শূন্য');
    // বাহুর দিক (dx,dy) → লম্ব (−dy,dx) → কাটার রেখা বাহুর সমান্তরাল
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  },

  /** বাহুগুলোর তালিকা — ড্রপডাউনে দেখানোর জন্য */
  sideOptions(pts, ftPerPx) {
    const out = [];
    if (!Array.isArray(pts) || pts.length < 3) return out;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const bn = v => (typeof toBn === 'function' ? toBn(v) : String(v));
      out.push({
        index: i,
        label: 'বাহু ' + bn(i + 1) + '–' + bn(j + 1),
        feet: this.dist(pts[i], pts[j]) * (ftPerPx || 0)
      });
    }
    return out;
  },

  /**
   * নির্দিষ্ট বাহু বরাবর অনুপাতে ভাগ
   * @param {Array} pts
   * @param {number} sideIndex
   * @param {Array<number>} shares
   */
  divideAlongSide(pts, sideIndex, shares) {
    return this.divide(pts, this.sideNormalAngle(pts, sideIndex), shares);
  },

  /**
   * শরিকদের **নির্দিষ্ট শতক** অনুযায়ী কাটা — যোগফল মোটের চেয়ে কম হলে
   * অবশিষ্ট আলাদা করে ফেরত দেয় (বাস্তবে প্রায়ই কিছু জমি বাকি থাকে)।
   *
   * @param {Array} pts
   * @param {number} sideIndex
   * @param {Array<{name, satak}>} people
   * @param {number} ftPerPx
   * @returns {{parts:Array, leftover:object|null, totalSatak:number, askedSatak:number}}
   */
  divideByArea(pts, sideIndex, people, ftPerPx) {
    const f = Number(ftPerPx);
    if (!(f > 0)) throw new Error('আগে স্কেল ঠিক করুন');
    const list = (people || [])
      .map(x => ({ name: x.name || '', satak: Number(x.satak) || 0 }))
      .filter(x => x.satak > 0);
    if (!list.length) throw new Error('অন্তত একজন শরিকের অংশ দিন');

    const totalPx = this.areaPx(pts);
    const totalSqft = totalPx * f * f;
    const totalSatak = totalSqft / this.SQFT_PER_SATAK;
    const asked = list.reduce((a, b) => a + b.satak, 0);
    // ★ রাউন্ডিং সহনশীলতা — UI তে ক্ষেত্রফল দুই দশমিকে দেখানো হয়
    //   (৮৮.৮৮৮৮… → "৮৮.৮৯")। ব্যবহারকারী ওই দেখানো সংখ্যাটাই লিখবেন,
    //   তখন কড়াভাবে তুলনা করলে "প্লটের চেয়ে বেশি" বলে আটকে যেত।
    const tol = Math.max(0.01, totalSatak * 1e-6);
    if (asked > totalSatak + tol) {
      throw new Error('শরিকদের মোট (' + asked.toFixed(2) + ' শতক) প্লটের চেয়ে বেশি — '
        + 'প্লটে আছে ' + totalSatak.toFixed(2) + ' শতক');
    }

    // sideIndex সংখ্যা হলে বাহু, স্ট্রিং হলে দিক (w2e/e2w/n2s/s2n)
    const angle = typeof sideIndex === 'string'
      ? this.directionAngle(sideIndex)
      : this.sideNormalAngle(pts, sideIndex);
    const parts = [];
    let remain = pts.slice();

    for (let i = 0; i < list.length; i++) {
      const wantPx = (list[i].satak * this.SQFT_PER_SATAK) / (f * f);
      const remainPx = this.areaPx(remain);
      if (wantPx >= remainPx - remainPx * 1e-9) {      // শেষটুকু পুরোটাই
        parts.push({ ...list[i], polygon: remain, areaPx: remainPx,
                     satak: (remainPx * f * f) / this.SQFT_PER_SATAK });
        remain = [];
        break;
      }
      const c = this.cutByArea(remain, angle, wantPx);
      parts.push({ ...list[i], polygon: c.piece, areaPx: c.areaPx,
                   satak: (c.areaPx * f * f) / this.SQFT_PER_SATAK });
      remain = c.rest;
    }

    const leftPx = remain.length >= 3 ? this.areaPx(remain) : 0;
    const leftover = leftPx > totalPx * 1e-6
      ? { name: 'অবশিষ্ট', polygon: remain, areaPx: leftPx,
          satak: (leftPx * f * f) / this.SQFT_PER_SATAK }
      : null;

    // ★ অবতল প্লটে কারো অংশ দুই টুকরোয় পড়তে পারে — জানানো দরকার
    parts.forEach(x => { x.pieces = this.countPieces(x.polygon); });
    if (leftover) leftover.pieces = this.countPieces(leftover.polygon);
    const split = parts.filter(x => x.pieces > 1).length + (leftover && leftover.pieces > 1 ? 1 : 0);

    return { parts, leftover, totalSatak, askedSatak: asked, angle, split };
  },

  /**
   * ভাগবণ্টনের রিপোর্টের তথ্য — শতক ও শতাংশসহ
   */
  divisionReport(res, plotName) {
    const rows = res.parts.map((p, i) => ({
      serial: i + 1,
      name: p.name || ('শরিক ' + (i + 1)),
      satak: p.satak,
      pieces: p.pieces || 1,
      percent: res.totalSatak > 0 ? (p.satak / res.totalSatak) * 100 : 0
    }));
    if (res.leftover) {
      rows.push({ serial: rows.length + 1, name: 'অবশিষ্ট',
                  satak: res.leftover.satak,
                  pieces: res.leftover.pieces || 1,
                  percent: res.totalSatak > 0 ? (res.leftover.satak / res.totalSatak) * 100 : 0 });
    }
    const sum = rows.reduce((a, b) => a + b.satak, 0);
    return {
      plotName: plotName || '',
      totalSatak: res.totalSatak,
      rows,
      sumSatak: sum,
      // যোগফল মোটের সাথে মেলে কি না — কাগজে লেখার আগে দেখা জরুরি
      exact: Math.abs(sum - res.totalSatak) < Math.max(1e-6, res.totalSatak * 1e-6)
    };
  },

  /* ---------------- ভাগের দিক ---------------- */

  /**
   * চার দিক — ওদের "বন্টনের দিক (Direction)" ড্রপডাউনের সমকক্ষ
   * কোণ = কাটার রেখার লম্ব দিক (ছবির y নিচমুখী, তাই উত্তর = −y)
   */
  DIRECTIONS: [
    { id: 'w2e', angle: 0,   label: 'পশ্চিম থেকে পূর্ব (বাঁ → ডান)' },
    { id: 'e2w', angle: 180, label: 'পূর্ব থেকে পশ্চিম (ডান → বাঁ)' },
    { id: 'n2s', angle: 90,  label: 'উত্তর থেকে দক্ষিণ (উপর → নিচ)' },
    { id: 's2n', angle: 270, label: 'দক্ষিণ থেকে উত্তর (নিচ → উপর)' }
  ],

  directionAngle(id) {
    const d = this.DIRECTIONS.filter(x => x.id === id)[0];
    if (!d) throw new Error('দিক চেনা গেল না');
    return d.angle;
  },

  /**
   * শরিকদের অংশ যেভাবেই দেওয়া হোক, শতকে রূপান্তর
   * @param {string} mode   'pct' | 'satak' | 'equal'
   * @param {Array} people  [{name, value}]  (equal হলে value লাগে না)
   * @param {number} totalSatak
   */
  sharesToSatak(mode, people, totalSatak) {
    const T = Number(totalSatak) || 0;
    if (!(T > 0)) throw new Error('প্লটের ক্ষেত্রফল লাগবে');
    const list = people || [];
    if (!list.length) throw new Error('অন্তত একজন শরিকের অংশ দিন');

    if (mode === 'equal') {
      const each = T / list.length;
      return list.map((x, i) => ({ name: x.name || ('শরিক ' + (i + 1)), satak: each }));
    }
    if (mode === 'pct') {
      const sum = list.reduce((a, b) => a + (Number(b.value) || 0), 0);
      if (!(sum > 0)) throw new Error('শতাংশ শূন্যের বেশি হতে হবে');
      if (sum > 100 + 1e-6) {
        throw new Error('শতাংশের যোগ ' + sum.toFixed(2) + '% — ১০০ এর বেশি হতে পারে না');
      }
      return list.map((x, i) => ({ name: x.name || ('শরিক ' + (i + 1)),
                                   satak: T * (Number(x.value) || 0) / 100 }));
    }
    // satak
    return list.map((x, i) => ({ name: x.name || ('শরিক ' + (i + 1)),
                                 satak: Number(x.value) || 0 }));
  },

  /* ---------------- প্লট ব্যবস্থাপনা ---------------- */

  /** নতুন প্লটের কাঠামো */
  newPlot(id) {
    return { id, dag: '', name: '', points: [], closed: false };
  },

  /** একটি প্লটের হিসাব */
  measure(plot, ftPerPx) {
    const pts = (plot && plot.points) || [];
    const px = this.areaPx(pts);
    const sqft = ftPerPx > 0 ? px * ftPerPx * ftPerPx : 0;
    return {
      points: pts.length,
      areaPx: px,
      perimeterFt: ftPerPx > 0 ? this.perimeterPx(pts) * ftPerPx : 0,
      ...this.units(sqft)
    };
  },

  /** সব প্লটের যোগফল */
  totals(plots, ftPerPx) {
    let sqft = 0;
    (plots || []).forEach(p => {
      if (p.points && p.points.length >= 3) {
        sqft += this.areaPx(p.points) * ftPerPx * ftPerPx;
      }
    });
    return { count: (plots || []).filter(p => p.points && p.points.length >= 3).length,
             ...this.units(sqft) };
  },

  /* ---------------- প্রজেক্ট সেভ / রিস্টোর ---------------- */

  VERSION: 1,

  /** প্রজেক্ট → JSON টেক্সট (ছবি বাদে — ছবি আলাদা রাখা হয়) */
  exportProject(state) {
    const s = state || {};
    return JSON.stringify({
      app: 'land-info-map-measure',
      version: this.VERSION,
      mapName: s.mapName || '',
      imageWidth: s.imageWidth || 0,
      imageHeight: s.imageHeight || 0,
      scale: s.scale || null,
      plots: (s.plots || []).map(p => ({
        id: p.id, dag: p.dag || '', name: p.name || '',
        closed: !!p.closed,
        points: (p.points || []).map(q => ({ x: +q.x.toFixed(2), y: +q.y.toFixed(2) }))
      }))
    }, null, 1);
  },

  /** JSON টেক্সট → প্রজেক্ট (যাচাইসহ) */
  importProject(text) {
    let d;
    try { d = JSON.parse(text); }
    catch (e) { throw new Error('ফাইলটি বৈধ প্রজেক্ট ফাইল নয়'); }
    if (!d || d.app !== 'land-info-map-measure') {
      throw new Error('এটি এই টুলের প্রজেক্ট ফাইল নয়');
    }
    if (Number(d.version) > this.VERSION) {
      throw new Error('ফাইলটি নতুন সংস্করণের — টুল হালনাগাদ করুন');
    }
    return {
      mapName: d.mapName || '',
      imageWidth: Number(d.imageWidth) || 0,
      imageHeight: Number(d.imageHeight) || 0,
      scale: d.scale && d.scale.ftPerPx > 0 ? d.scale : null,
      plots: (d.plots || []).map((p, i) => ({
        id: p.id != null ? p.id : i + 1,
        dag: p.dag || '', name: p.name || '',
        closed: !!p.closed,
        points: (p.points || [])
          .filter(q => isFinite(q.x) && isFinite(q.y))
          .map(q => ({ x: Number(q.x), y: Number(q.y) }))
      }))
    };
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = MapMeasure;
