/* ==========================================================================
   kmz-fx.js — মৌজা নকশার ছবি প্রস্তুত করা (স্বচ্ছতা ও রঙ)
   --------------------------------------------------------------------------
   কেন দরকার:
     স্ক্যান করা মৌজা নকশা সাদা কাগজে আঁকা। সেটিকে সরাসরি Google Earth এ
     বসালে সাদা কাগজটাই স্যাটেলাইট ছবি ঢেকে দেয় — নিজের জমি চেনা যায় না।
     সাদা অংশ স্বচ্ছ করে দিলে কেবল দাগের রেখা ভেসে থাকে, নিচে স্যাটেলাইট
     ছবি দেখা যায়।

   দুটি অংশ:
     ১. processPixels() — বিশুদ্ধ ফাংশন, RGBA বাইট নেয়-দেয়। DOM ছোঁয় না,
        তাই Node এ টেস্ট করা যায়।
     ২. apply() — ক্যানভাসে চালিয়ে PNG বাইট ফেরত দেয় (স্বচ্ছতার জন্য PNG
        অপরিহার্য — JPEG এ alpha নেই)।
   ========================================================================== */

const KmzFx = {

  /** ডিফল্ট সাদার মাত্রা — এর চেয়ে উজ্জ্বল পিক্সেল "কাগজ" ধরা হয় */
  DEFAULT_THRESHOLD: 205,

  /** '#rrggbb' → {r,g,b}; ভুল হলে null */
  hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  },

  /** উপলব্ধ উজ্জ্বলতা (মানুষের চোখ সবুজে বেশি সংবেদনশীল) */
  luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; },

  /**
   * RGBA বাইট প্রক্রিয়া করে (জায়গাতেই বদলায়)
   *
   * @param {Uint8ClampedArray|Uint8Array} data  RGBA, দৈর্ঘ্য = w×h×4
   * @param {object} o
   *   transparent : সাদা পটভূমি স্বচ্ছ করবে কি (ডিফল্ট false)
   *   threshold   : এর বেশি উজ্জ্বল হলে কাগজ (০–২৫৫, ডিফল্ট ২০৫)
   *   soft        : প্রান্ত মসৃণ করার পরিসর (ডিফল্ট ৪৫) — হঠাৎ কাটা এড়াতে
   *   color       : '#rrggbb' দিলে রেখার রঙ বদলায়; null হলে মূল রঙ
   *   strength    : রঙ কতটা বসবে ০–১ (ডিফল্ট ১)
   * @returns {{ changed:number, kept:number }} কত পিক্সেল স্বচ্ছ হলো
   */
  processPixels(data, o) {
    const opt = o || {};
    const transparent = !!opt.transparent;
    const th = Math.max(0, Math.min(255,
      opt.threshold == null ? this.DEFAULT_THRESHOLD : Number(opt.threshold)));
    const soft = Math.max(0, Number(opt.soft == null ? 45 : opt.soft));
    const col = opt.color ? this.hexToRgb(opt.color) : null;
    const strength = Math.max(0, Math.min(1, opt.strength == null ? 1 : Number(opt.strength)));

    let changed = 0, kept = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // পূর্ণসংখ্যায় গোল করা জরুরি: ০.২১২৬+০.৭১৫২+০.০৭২২ ভাসমান-বিন্দুতে
      // ঠিক ১ হয় না, তাই বিশুদ্ধ সাদার উজ্জ্বলতা ২৫৪.৯৯৯… আসত এবং
      // থ্রেশহোল্ড ২৫৫ দিলে সাদাও বাদ পড়ত না।
      const y = Math.round(this.luma(r, g, b));

      if (transparent) {
        let a;
        if (y >= th) {
          a = 0;                                  // পরিষ্কার কাগজ
        } else if (soft > 0 && y >= th - soft) {
          // প্রান্তে ক্রমশ মিলিয়ে যায় — নইলে রেখার ধার খসখসে দেখায়
          a = Math.round(255 * (th - y) / soft);
        } else {
          a = 255;                                // স্পষ্ট রেখা
        }
        // মূল ছবিতে আগে থেকেই স্বচ্ছতা থাকলে সেটাও মানি
        const prev = data[i + 3];
        data[i + 3] = prev < 255 ? Math.round(a * prev / 255) : a;
        if (data[i + 3] === 0) changed++; else kept++;
      } else {
        kept++;
      }

      if (col && data[i + 3] > 0) {
        // রেখা যত গাঢ়, রঙ তত বেশি বসে — হালকা ছায়া হালকাই থাকে
        const k = strength * (1 - y / 255);
        data[i]     = Math.round(r + (col.r - r) * k);
        data[i + 1] = Math.round(g + (col.g - g) * k);
        data[i + 2] = Math.round(b + (col.b - b) * k);
      }
    }
    return { changed, kept };
  },

  /**
   * ছবিটি ক্যানভাসে এনে প্রক্রিয়া করে নতুন বাইট ফেরত দেয়
   * @param {HTMLImageElement} img
   * @param {object} o  processPixels এর মতোই
   * @returns {Promise<{bytes:Uint8Array, img:HTMLImageElement, mime:string, stats}>}
   */
  async apply(img, o) {
    const opt = o || {};
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    let stats = { changed: 0, kept: c.width * c.height };
    if (opt.transparent || opt.color) {
      const id = ctx.getImageData(0, 0, c.width, c.height);
      stats = this.processPixels(id.data, opt);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.putImageData(id, 0, 0);
    }

    // স্বচ্ছতা থাকলে PNG বাধ্যতামূলক — JPEG এ alpha নেই
    const mime = opt.transparent ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(res =>
      c.toBlob(res, mime, mime === 'image/jpeg' ? 0.92 : undefined));
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const out = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('প্রক্রিয়াকৃত ছবি পড়া গেল না')); };
      im.src = url;
    });

    return { bytes, img: out, mime, stats,
             width: c.width, height: c.height };
  },

  /** ফাইলের নামের এক্সটেনশন mime অনুযায়ী ঠিক করা */
  nameFor(name, mime) {
    const stem = String(name || 'map').replace(/\.[A-Za-z0-9]{1,5}$/, '');
    return stem + (mime === 'image/png' ? '.png' : '.jpg');
  },

  /** কত শতাংশ স্বচ্ছ হলো — ব্যবহারকারীকে জানাতে */
  transparentPct(stats) {
    const total = (stats.changed || 0) + (stats.kept || 0);
    return total ? (stats.changed / total) * 100 : 0;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = KmzFx;
