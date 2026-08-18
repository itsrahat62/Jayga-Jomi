/* ==========================================================================
   cad-trace.js — স্ক্যান করা নকশা → ভেক্টর দাগ (স্বয়ংক্রিয় ডিজিটাইজেশন)
   --------------------------------------------------------------------------
   মৌজা নকশা একটি ছবি — তাতে দাগ নেই, কেবল কালির দাগ আছে। GIS/CAD এ কাজ
   করতে হলে প্রতিটি দাগকে **বহুভুজ** হিসেবে চেনাতে হয়। সেটিই এখানে হয়।

   কীভাবে
     ১. কালি চেনা      — Sauvola স্থানীয় থ্রেশহোল্ড (পুরনো হলদে কাগজেও চলে)
     ২. খোপ বের করা    — কালির ঘেরাটোপে আটকে থাকা সাদা অংশ = এক-একটি দাগ
     ৩. সীমানা ভাগ     — কালির পিক্সেলগুলো পাশের দাগদের মধ্যে ভাগ করে দেওয়া
                          (watershed) — তাতে দুই দাগের সীমানা **একই রেখা** হয়,
                          ফাঁক বা ওভারল্যাপ থাকে না
     ৪. রেখা টানা      — marching squares দিয়ে খোপের চারপাশে বন্ধ রিং
     ৫. ছাঁটাই         — Douglas–Peucker + প্রায়-সরল ভাঁজ মুছে দেওয়া
     ৬. ঝালাই (weld)   — কাছাকাছি কোণাগুলো এক বিন্দুতে মিলিয়ে দেওয়া

   ★ কেন ছোট মাপে কাজ হয়
     ৬ কোটি পিক্সেলের স্ক্যানে সরাসরি কাজ করলে ব্রাউজার আটকে যায়। তাই
     কাজটি ~৩০ লক্ষ পিক্সেলে নামিয়ে করা হয়, পরে স্থানাঙ্ক আবার আসল মাপে
     ফেরত নেওয়া হয়। দাগের কিনারা সরলরেখা বলে এতে নির্ভুলতা কমে না।
   ========================================================================== */

const CadTrace = {

  /**
   * কাজের সময় ছবিটি সর্বোচ্চ কত পিক্সেলে নামানো হবে
   *
   * ★ ৮ মেগাপিক্সেল কেন
   *   নমুনা নকশায় (৬০ MP স্ক্যান) মেপে দেখা হয়েছে — রেখা কালির **মাঝ বরাবর**
   *   কতটা নিখুঁত বসে:
   *       ৩.২ MP → ২.৮৫ px   (০.৯ সেকেন্ড)
   *       ৮   MP → ২.০২ px   (১.৩ সেকেন্ড)   ← ২৯% ভালো, সময় সামান্য বেশি
   *       ১৬  MP → ১.৮৯ px   (২.৪ সেকেন্ড)   ← লাভ কম, সময় দ্বিগুণ
   *   তাই ৮ MP-ই সেরা বিনিময়।
   */
  WORK_PIXELS: 8e6,

  /**
   * ★ সব মাপ রেজুলেশনের সাথে বদলাতে হয়
   *   ৩.২ MP এ "১ পিক্সেল" যত বড় জায়গা, ৮ MP এ তত নয়। তাই কালির ফাঁক
   *   জোড়ার ব্যাসার্ধ, নয়েজের সীমা, সরলীকরণের কড়াকড়ি — সবই বেসলাইনের
   *   সাথে অনুপাতে বাড়াতে হয়। না বাড়ালে বেশি রেজুলেশনে ফাঁক আর জোড়া লাগে
   *   না, দাগ লিক করে মিশে যায় — মেপে দেখা গেছে ২৬ MP তে দাগ ১১৯৪ → ১১৬৩
   *   নেমে গিয়েছিল ঠিক এ কারণেই।
   */
  BASE_PIXELS: 3.2e6,

  resScale(w, h) {
    return Math.max(0.5, Math.min(4, Math.sqrt((w * h) / this.BASE_PIXELS)));
  },

  /* ==================== ১. ছবি প্রস্তুত ==================== */

  /**
   * ক্যানভাস → কাজের মাপের ধূসর ছবি
   * @returns {{gray:Uint8ClampedArray, w, h, scale}}  scale = আসল ÷ কাজের
   */
  prepare(srcCanvas, opts) {
    const o = opts || {};
    const W = srcCanvas.width, H = srcCanvas.height;
    const budget = o.workPixels > 0 ? o.workPixels : this.WORK_PIXELS;
    const k = Math.min(1, Math.sqrt(budget / (W * H)));
    const w = Math.max(2, Math.round(W * k));
    const h = Math.max(2, Math.round(H * k));

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcCanvas, 0, 0, W, H, 0, 0, w, h);

    const d = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      // আলফা ০ (স্বচ্ছ) মানে কাগজ — সাদা ধরি
      gray[i] = d[p + 3] < 8 ? 255
        : (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) | 0;
    }
    return { gray, w, h, scale: W / w };
  },

  /* ==================== ২. কালি চেনা ==================== */

  /**
   * Sauvola স্থানীয় থ্রেশহোল্ড — integral image দিয়ে O(n)
   *
   * বৈশ্বিক থ্রেশহোল্ড পুরনো নকশায় খাটে না: এক কোণা হলদে, আরেক কোণা
   * ফ্যাকাশে। স্থানীয় গড় ও বিচ্যুতি ধরে সিদ্ধান্ত নিলে দুই জায়গাতেই
   * কালি ঠিকভাবে ধরা পড়ে।
   *
   * @returns {Uint8Array} ink — ১ হলে কালি
   */
  inkMask(gray, w, h, opts) {
    const o = opts || {};
    const win = Math.max(15, Math.round((o.window || (Math.min(w, h) / 24))) | 1);
    const k = o.k == null ? 0.16 : o.k;
    const R = 128;
    const flatFloor = o.flatFloor == null ? 6 : o.flatFloor;   // সমতল এলাকায় কালি নেই

    const n = w * h;
    // integral image (একটি অতিরিক্ত সারি/কলামসহ — সীমানা হিসাব সহজ হয়)
    const I = new Float64Array((w + 1) * (h + 1));
    const I2 = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let rs = 0, rs2 = 0;
      for (let x = 0; x < w; x++) {
        const v = gray[y * w + x];
        rs += v; rs2 += v * v;
        const j = (y + 1) * (w + 1) + (x + 1);
        I[j] = I[j - (w + 1)] + rs;
        I2[j] = I2[j - (w + 1)] + rs2;
      }
    }
    const rect = (A, x0, y0, x1, y1) => {
      const W1 = w + 1;
      return A[(y1 + 1) * W1 + (x1 + 1)] - A[y0 * W1 + (x1 + 1)]
           - A[(y1 + 1) * W1 + x0] + A[y0 * W1 + x0];
    };

    const half = win >> 1;
    const ink = new Uint8Array(n);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - half), y1 = Math.min(h - 1, y + half);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - half), x1 = Math.min(w - 1, x + half);
        const cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
        const s = rect(I, x0, y0, x1, y1);
        const s2 = rect(I2, x0, y0, x1, y1);
        const mean = s / cnt;
        const varc = Math.max(0, s2 / cnt - mean * mean);
        const sd = Math.sqrt(varc);
        const idx = y * w + x;
        const v = gray[idx];
        if (sd < flatFloor) { ink[idx] = 0; continue; }        // ফাঁকা কাগজ
        const t = mean * (1 + k * (sd / R - 1));
        ink[idx] = (v < t && (mean - v) > 8) ? 1 : 0;
      }
    }
    return ink;
  },

  /**
   * কালির ছোট ছোট ফুটকি (নয়েজ) মুছে ফেলা ও ছোট ফাঁক জোড়া দেওয়া
   * নকশায় হাতে টানা রেখা মাঝে মাঝে ভাঙা থাকে — জোড়া না দিলে দুই দাগ
   * এক হয়ে যায়।
   */
  cleanInk(ink, w, h, opts) {
    const o = opts || {};
    let m = ink;
    const close = o.close == null ? 1 : o.close;      // ফাঁক জোড়া
    if (close > 0) {
      m = this.dilate(m, w, h, close);
      m = this.erode(m, w, h, close);
    }
    if (o.despeckle !== false) m = this.despeckle(m, w, h, o.minInk || 4);
    return m;
  },

  dilate(mask, w, h, r) {
    let cur = mask;
    for (let step = 0; step < r; step++) {
      const out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (cur[i]) { out[i] = 1; continue; }
          if ((x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) ||
              (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w])) out[i] = 1;
        }
      }
      cur = out;
    }
    return cur;
  },

  erode(mask, w, h, r) {
    let cur = mask;
    for (let step = 0; step < r; step++) {
      const out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (!cur[i]) continue;
          const ok = (x > 0 ? cur[i - 1] : 1) && (x < w - 1 ? cur[i + 1] : 1) &&
                     (y > 0 ? cur[i - w] : 1) && (y < h - 1 ? cur[i + w] : 1);
          out[i] = ok ? 1 : 0;
        }
      }
      cur = out;
    }
    return cur;
  },

  /** নির্দিষ্ট আকারের চেয়ে ছোট কালির দলা মুছে ফেলা */
  despeckle(mask, w, h, minPix) {
    const n = w * h;
    const seen = new Uint8Array(n);
    const out = new Uint8Array(n);
    const stack = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (!mask[s] || seen[s]) continue;
      let sp = 0, cnt = 0;
      const members = [];
      stack[sp++] = s; seen[s] = 1;
      while (sp) {
        const i = stack[--sp];
        members.push(i); cnt++;
        const x = i % w, y = (i / w) | 0;
        if (x > 0     && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
        if (x < w - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
        if (y > 0     && mask[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[sp++] = i - w; }
        if (y < h - 1 && mask[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[sp++] = i + w; }
      }
      if (cnt >= minPix) for (const i of members) out[i] = 1;
    }
    return out;
  },

  /* ==================== ২ক. কোনটা সীমানার রেখা, কোনটা লেখা ==================== */

  /**
   * কালির দলগুলো আলাদা করে চেনা (৮-দিক — তির্যক রেখাও অটুট থাকে)
   * @returns {{labels:Int32Array, count, sizes, diag:Float32Array}}
   */
  inkComponents(ink, w, h) {
    const n = w * h;
    const labels = new Int32Array(n).fill(-1);
    const queue = new Int32Array(n);
    const sizes = [];
    const diag = [];
    let count = 0;

    for (let s = 0; s < n; s++) {
      if (!ink[s] || labels[s] >= 0) continue;
      const id = count++;
      let head = 0, tail = 0, size = 0;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      queue[tail++] = s; labels[s] = id;
      while (head < tail) {
        const i = queue[head++];
        size++;
        const x = i % w, y = (i / w) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w || (!dx && !dy)) continue;
            const j = ny * w + nx;
            if (ink[j] && labels[j] < 0) { labels[j] = id; queue[tail++] = j; }
          }
        }
      }
      sizes.push(size);
      diag.push(Math.hypot(x1 - x0 + 1, y1 - y0 + 1));
    }
    return { labels, count, sizes, diag };
  },

  /**
   * ★ দাগের সীমারেখা বনাম দাগ নম্বরের লেখা — এই পার্থক্যটাই আসল চাবি
   *
   * নকশায় লেখা ০, ৪, ৬, ৮, ৯ এর ভেতরে বন্ধ ফাঁকা জায়গা থাকে। মাপ দেখে
   * সেগুলো ছোট দাগ থেকে আলাদা করা যায় না — একটি নিলফামারীর নকশায়
   * ছোট দাগ ২০০ পিক্সেল, আর বড় অঙ্কের ফাঁকা ১৫০ পিক্সেল।
   *
   * কিন্তু **গঠনে** পার্থক্য স্পষ্ট:
   *   · দাগের সীমারেখাগুলো একে অপরের সাথে জোড়া — পুরো নকশা জুড়ে
   *     একটিমাত্র বিশাল জাল (network) বানায়।
   *   · একটি অঙ্ক একা দাঁড়িয়ে থাকে — ছোট, বিচ্ছিন্ন দলা।
   *
   * তাই বড় জালের অংশ কালিকে "সীমানা" ধরা হয়। যে খোপের গা ঘেঁষে সীমানার
   * কালি আছে, সেটিই দাগ — বাকিটা লেখা।
   *
   * @returns {Uint8Array} ১ হলে ঐ পিক্সেল সীমানার রেখার অংশ
   */
  structureMask(ink, w, h, opts) {
    const o = opts || {};
    const comp = this.inkComponents(ink, w, h);
    if (!comp.count) return new Uint8Array(w * h);

    /**
     * সীমা কীভাবে ঠিক হয়
     *
     * ছবির মাপের সাথে তুলনা করাই যথেষ্ট নয় — পাতলা নকশায় (কম রেখা, বড়
     * অঙ্ক) একটি অঙ্কই মোট কালির বড় অংশ হয়ে যায়। তাই মাপ নয়, **বিস্তার**
     * দেখা হয়, আর তুলনা করা হয় **সবচেয়ে বড় দলের সাথে**: সীমানার জাল
     * সবসময়ই নকশা জুড়ে ছড়ানো, একটি অঙ্ক তার এক-দশমাংশও নয়। এভাবে ঘন ও
     * পাতলা — দুই ধরনের নকশাতেই সীমা নিজে থেকে বসে যায়।
     */
    const imgDiag = Math.hypot(w, h);
    let maxDiag = 0;
    for (let id = 0; id < comp.count; id++) if (comp.diag[id] > maxDiag) maxDiag = comp.diag[id];
    const minDiag = Math.max(
      imgDiag * (o.structDiag == null ? 0.03 : o.structDiag),
      maxDiag * (o.structRel == null ? 0.18 : o.structRel)
    );

    const isStruct = new Uint8Array(comp.count);
    let structCount = 0;
    for (let id = 0; id < comp.count; id++) {
      if (comp.diag[id] >= minDiag) { isStruct[id] = 1; structCount++; }
    }
    // কিছুই না মিললে (যেমন খুব ছোট নমুনা) সব কালিই সীমানা ধরি
    const out = new Uint8Array(w * h);
    if (!structCount) { out.fill(1, 0); for (let i = 0; i < out.length; i++) out[i] = ink[i]; return out; }
    for (let i = 0; i < out.length; i++) {
      const id = comp.labels[i];
      out[i] = (id >= 0 && isStruct[id]) ? 1 : 0;
    }
    out._structCount = structCount;
    return out;
  },

  /* ==================== ৩. খোপ (দাগ) বের করা ==================== */

  /**
   * কালির ঘেরাটোপে আটকে থাকা সাদা অংশগুলো আলাদা করে চেনা, তারপর
   * কালির পিক্সেলগুলো নিকটতম খোপের সাথে জুড়ে দেওয়া (multi-source BFS)।
   *
   * এই দ্বিতীয় ধাপটাই আসল কৌশল — এতে পাশাপাশি দুই দাগ **একই সীমারেখা**
   * ভাগ করে নেয়। নইলে দুই দাগের মাঝে কালির প্রস্থ সমান একটা ফাঁক থেকে
   * যেত এবং যোগফল মিলত না।
   *
   * @param {Uint8Array} [structure]  সীমানার রেখার কালি (structureMask)
   * @returns {{labels:Int32Array, count:number, sizes:Int32Array, touch:Uint8Array}}
   */
  regions(ink, w, h, structure) {
    const n = w * h;
    const labels = new Int32Array(n).fill(-1);
    const queue = new Int32Array(n);
    let count = 0;
    const sizes = [];

    // ক. সাদা অংশের সংযুক্ত দল
    for (let s = 0; s < n; s++) {
      if (ink[s] || labels[s] >= 0) continue;
      const id = count++;
      let head = 0, tail = 0, size = 0;
      queue[tail++] = s; labels[s] = id;
      while (head < tail) {
        const i = queue[head++]; size++;
        const x = i % w, y = (i / w) | 0;
        if (x > 0     && !ink[i - 1] && labels[i - 1] < 0) { labels[i - 1] = id; queue[tail++] = i - 1; }
        if (x < w - 1 && !ink[i + 1] && labels[i + 1] < 0) { labels[i + 1] = id; queue[tail++] = i + 1; }
        if (y > 0     && !ink[i - w] && labels[i - w] < 0) { labels[i - w] = id; queue[tail++] = i - w; }
        if (y < h - 1 && !ink[i + w] && labels[i + w] < 0) { labels[i + w] = id; queue[tail++] = i + w; }
      }
      sizes.push(size);
    }

    /* খ. প্রতিটি খোপ কি সীমানার রেখা ছুঁয়েছে?
       এখনই দেখতে হয় — পরের ধাপে কালির পিক্সেলগুলো খোপে ঢুকে যাবে,
       তখন আর "কালি" আর "খোপ" আলাদা করা যাবে না। */
    let touch = null;
    if (structure) {
      touch = new Uint8Array(count);
      for (let i = 0; i < n; i++) {
        if (!structure[i]) continue;
        const x = i % w, y = (i / w) | 0;
        if (x > 0     && labels[i - 1] >= 0) touch[labels[i - 1]] = 1;
        if (x < w - 1 && labels[i + 1] >= 0) touch[labels[i + 1]] = 1;
        if (y > 0     && labels[i - w] >= 0) touch[labels[i - w]] = 1;
        if (y < h - 1 && labels[i + w] >= 0) touch[labels[i + w]] = 1;
      }
    }

    // গ. কালির পিক্সেল — নিকটতম খোপে ভাগ করে দেওয়া
    let head = 0, tail = 0;
    const q2 = new Int32Array(n);
    for (let i = 0; i < n; i++) if (labels[i] >= 0) q2[tail++] = i;
    while (head < tail) {
      const i = q2[head++];
      const id = labels[i];
      const x = i % w, y = (i / w) | 0;
      if (x > 0     && labels[i - 1] < 0) { labels[i - 1] = id; q2[tail++] = i - 1; }
      if (x < w - 1 && labels[i + 1] < 0) { labels[i + 1] = id; q2[tail++] = i + 1; }
      if (y > 0     && labels[i - w] < 0) { labels[i - w] = id; q2[tail++] = i - w; }
      if (y < h - 1 && labels[i + w] < 0) { labels[i + w] = id; q2[tail++] = i + w; }
    }

    // ঘ. ভাগ পাওয়ার পর প্রকৃত মাপ আবার গোনা
    const finalSizes = new Int32Array(count);
    for (let i = 0; i < n; i++) if (labels[i] >= 0) finalSizes[labels[i]]++;

    return { labels, count, sizes: finalSizes, touch };
  },

  /** কোন খোপগুলো ছবির কিনারা ছুঁয়েছে (বাইরের ফাঁকা জায়গা) */
  borderLabels(labels, w, h) {
    const set = new Set();
    for (let x = 0; x < w; x++) { set.add(labels[x]); set.add(labels[(h - 1) * w + x]); }
    for (let y = 0; y < h; y++) { set.add(labels[y * w]); set.add(labels[y * w + w - 1]); }
    set.delete(-1);
    return set;
  },

  /* ==================== ৪. সীমানা আঁকা (marching squares) ==================== */

  DIRS: { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 },
  DVEC: [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }],

  /**
   * এক-একটি খোপের চারপাশে বন্ধ রিং
   *
   * পিক্সেলের **কোণার জালিতে** হাঁটা হয় (পিক্সেলের কেন্দ্রে নয়) — তাতে
   * সীমানাটি ঠিক দুই পিক্সেলের মাঝখান দিয়ে যায়, আর পাশাপাশি দুই খোপ
   * হুবহু একই রেখা পায়।
   *
   * নিয়ম: হাঁটার সময় খোপটি সবসময় **বাঁ পাশে** থাকে।
   *
   * @param {function} inside  (x,y) => true হলে ঐ পিক্সেল খোপের ভেতরে
   */
  traceRing(inside, w, h, startX, startY, opts) {
    const dense = !!(opts && opts.dense);
    const D = this.DIRS, V = this.DVEC;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : (inside(x, y) ? 1 : 0);

    let cx = startX, cy = startY;
    let dir = D.DOWN;                    // শুরুর কোণায় কেবল SE ভরা → নিচে
    const ring = [];
    const maxSteps = 4 * (w + h) * 40 + 1000;
    let firstDir = -1;

    for (let step = 0; step < maxSteps; step++) {
      const nw = at(cx - 1, cy - 1);
      const ne = at(cx,     cy - 1);
      const se = at(cx,     cy);
      const sw = at(cx - 1, cy);
      const v = nw * 1 + ne * 2 + se * 4 + sw * 8;

      let nd;
      switch (v) {
        case 1:  nd = D.UP;    break;
        case 2:  nd = D.RIGHT; break;
        case 3:  nd = D.RIGHT; break;
        case 4:  nd = D.DOWN;  break;
        case 5:  nd = (dir === D.LEFT) ? D.DOWN : D.UP;    break;   // স্যাডল
        case 6:  nd = D.DOWN;  break;
        case 7:  nd = D.DOWN;  break;
        case 8:  nd = D.LEFT;  break;
        case 9:  nd = D.UP;    break;
        case 10: nd = (dir === D.UP) ? D.LEFT : D.RIGHT;   break;   // স্যাডল
        case 11: nd = D.RIGHT; break;
        case 12: nd = D.LEFT;  break;
        case 13: nd = D.UP;    break;
        case 14: nd = D.LEFT;  break;
        default: return ring;            // ০ বা ১৫ — সীমানা নেই
      }

      /* সাধারণত দিক বদলালেই কেবল কোণা রাখি — সোজা অংশে অজস্র বিন্দু জমে না।
         কিন্তু টপোলজি ঠিক রাখতে (simplifyTopology) **প্রতিটি জালিবিন্দু**
         দরকার: তাতে পাশাপাশি দুই দাগ ভাগ করা সীমানায় হুবহু একই বিন্দুগুলো
         পায়, আর জংশন খুঁজে বের করা যায়। */
      if (dense || nd !== dir || ring.length === 0) ring.push({ x: cx, y: cy });
      dir = nd;
      if (firstDir < 0) firstDir = nd;

      cx += V[nd].x; cy += V[nd].y;
      if (cx === startX && cy === startY && ring.length > 2) break;
    }
    return ring;
  },

  /** একটি লেবেলের সবচেয়ে উপরের-বাঁয়ের পিক্সেল (রিং শুরুর জায়গা) */
  findStart(labels, w, h, id) {
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] === id) return { x: i % w, y: (i / w) | 0 };
    }
    return null;
  },

  /* ==================== ৪ক. টপোলজি অটুট রেখে সরলীকরণ ==================== */

  /**
   * ★ কেন আলাদা করে এই কাজটা লাগে (মেপে পাওয়া সমস্যা)
   *
   *   প্রতিটি দাগ আলাদাভাবে সরলীকরণ করলে **ভাগ করা সীমানার দুই পাশ দুইভাবে
   *   ছাঁটা হয়** — একই কাঁপুনি একদিকে ভেতরে ঢোকে, অন্যদিকে বাইরে বেরোয়।
   *   ফলে দুই দাগ একে অন্যের ভেতর ঢুকে যায়, পর্দায় তেরছা রেখা ও সরু ফালি
   *   দেখা যায়। নমুনা নকশায় মেপে দেখা গেছে:
   *
   *       কাঁচা রিং        →  ওভারল্যাপ করা জোড়া:   ২
   *       আলাদা DP এর পর   →  ওভারল্যাপ করা জোড়া: ৫৫৬   ← আসল দোষ
   *
   * ★ সমাধান — arc-node টপোলজি (GIS এ প্রচলিত পথ)
   *   ১. সব রিং **প্রতিটি জালিবিন্দুসহ** (dense) আঁকা হয়, তাই পাশাপাশি দুই
   *      দাগ ভাগ করা সীমানায় হুবহু একই বিন্দু পায় (উল্টো ক্রমে)।
   *   ২. যে বিন্দুতে ২টির বেশি প্রতিবেশী — সেটি **জংশন** (তিন দাগের মিলনস্থল)।
   *   ৩. দুই জংশনের মাঝের অংশ = একটি **আর্ক**। প্রতিটি আর্ক **একবারই**
   *      সরলীকরণ হয় এবং ফল ক্যাশে থাকে।
   *   ৪. রিং আবার গড়া হয় ঐ সরলীকৃত আর্ক জোড়া দিয়ে।
   *
   *   এতে দুই পাশ **একই রেখাই** পায় — ফাঁক নেই, ওভারল্যাপ নেই, যোগফল মেলে।
   */
  simplifyTopology(rings, opts) {
    const o = opts || {};
    const eps = o.eps > 0 ? o.eps : 1.6;
    const angle = o.straighten == null ? 7 : o.straighten;
    const minEdge = o.minEdge > 0 ? o.minEdge : eps * 3.2;
    const K = p => p.x + ',' + p.y;

    /* ১. প্রতিবেশী গোনা — সীমানার জালে প্রতিটি বিন্দুর ডিগ্রি */
    const neigh = new Map();
    const link = (a, b) => {
      const ka = K(a), kb = K(b);
      let arr = neigh.get(ka);
      if (!arr) { arr = []; neigh.set(ka, arr); }
      if (arr.indexOf(kb) < 0) arr.push(kb);
    };
    for (const r of rings) {
      const n = r.length;
      for (let i = 0; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; link(a, b); link(b, a); }
    }
    const isNode = p => {
      const arr = neigh.get(K(p));
      return !arr || arr.length !== 2;        // ডিগ্রি ২ নয় ⇒ জংশন
    };

    /* ২. আর্ক একবারই সরলীকরণ, ফল ক্যাশে */
    const cache = new Map();
    const simplifyArc = arc => {
      const fwd = arc.map(K).join(' ');
      const rev = arc.slice().reverse().map(K).join(' ');
      const flip = rev < fwd;
      const key = flip ? rev : fwd;
      let s = cache.get(key);
      if (!s) {
        const base = flip ? arc.slice().reverse() : arc;
        s = CadCore.simplifyDP(base, eps);
        s = CadCore.straighten(s, angle, false);          // খোলা রেখা — প্রান্ত স্থির
        /* ★ collapseShortEdges এখানে ইচ্ছে করেই চালানো হয় না
         *
         *   ওটি ছোট বাহু ফেলে দিয়ে দুই পাশের রেখা বাড়িয়ে **নতুন কোণা** বসায়।
         *   নতুন কোণাটি আর্কের করিডোরের বাইরে ছিটকে পাশের তৃতীয় দাগের ভেতর
         *   ঢুকে যেতে পারে। নমুনা নকশায় মেপে দেখা গেছে:
         *       collapse সহ  →  ২৬ জোড়া ওভারল্যাপ, ৩৬টি স্ব-ছেদ
         *       collapse ছাড়া →  ০ জোড়া ওভারল্যাপ
         *   সার্ভের কাজে ক্ষেত্রফলের যোগফল মেলাটা সৌন্দর্যের চেয়ে জরুরি, তাই
         *   স্বয়ংক্রিয় পথে এটি বাদ। দরকার হলে ব্যবহারকারী "কাঁটা সারান"
         *   বোতাম দিয়ে বেছে বেছে চালাতে পারেন।
         */
        cache.set(key, s);
      }
      return flip ? s.slice().reverse() : s;
    };

    /* ৩. রিং ভেঙে আর্ক, তারপর আবার গড়া */
    const out = [];
    for (const r of rings) {
      let firstNode = -1;
      for (let i = 0; i < r.length; i++) if (isNode(r[i])) { firstNode = i; break; }

      // কোনো জংশন নেই — দ্বীপের মতো একা রিং, পুরোটাই এক বন্ধ আর্ক
      if (firstNode < 0) {
        let s = CadCore.simplifyRing(r, eps);
        s = CadCore.straighten(s, angle, true);
        s = CadCore.collapseShortEdges(s, minEdge, true);
        s = CadCore.dedupe(s, 0.4);
        if (s.length >= 3) out.push(s);
        continue;
      }

      const rot = r.slice(firstNode).concat(r.slice(0, firstNode));
      const built = [];
      let cur = [rot[0]];
      for (let i = 1; i <= rot.length; i++) {
        const p = rot[i % rot.length];
        cur.push(p);
        if (isNode(p)) {
          const s = simplifyArc(cur);
          for (let k = 0; k < s.length - 1; k++) built.push(s[k]);   // শেষ বিন্দু পরের আর্কের শুরু
          cur = [p];
        }
      }
      const ring = CadCore.dedupe(built, 0.4);
      if (ring.length >= 3) out.push(ring);
    }
    return out;
  },

  /* ==================== ৫. পুরো নকশা ডিজিটাইজ ==================== */

  /**
   * এক ক্লিকে পুরো নকশার সব দাগ বের করা
   *
   * @param {HTMLCanvasElement} canvas   নকশার ছবি
   * @param {object} opts
   *        minSatakPx  — এর চেয়ে ছোট খোপ বাদ (কাজের পিক্সেলে)
   *        maxFrac     — ছবির এত ভাগের বেশি হলে বাদ (বাইরের ফাঁকা)
   *        eps         — সরলীকরণের কড়াকড়ি (কাজের পিক্সেলে)
   *        straighten  — কত ডিগ্রি পর্যন্ত ভাঁজ মুছব
   *        onProgress  — (pct, msg)
   * @returns {Promise<{polys:Array<Array<{x,y}>>, work:{w,h,scale}, stats}>}
   */
  async traceAll(canvas, opts) {
    const o = opts || {};
    const prog = o.onProgress || (() => {});
    const yield_ = () => new Promise(r => setTimeout(r, 0));

    prog(6, 'নকশা প্রস্তুত হচ্ছে…');
    const { gray, w, h, scale } = this.prepare(canvas, o);
    await yield_();

    prog(18, 'কালির রেখা চেনা হচ্ছে…');
    let ink = this.inkMask(gray, w, h, o);
    await yield_();

    prog(34, 'ভাঙা রেখা জোড়া দেওয়া হচ্ছে…');
    /* রেজুলেশন-ভিত্তিক মাপ — সব সীমা বেসলাইনের অনুপাতে বাড়ে/কমে,
       নইলে বেশি রেজুলেশনে একই আসল ফাঁক আর জোড়া লাগে না */
    const RES = this.resScale(w, h);
    ink = this.cleanInk(ink, w, h, Object.assign({
      close: Math.max(1, Math.round(RES)),
      minInk: Math.max(4, Math.round(4 * RES * RES))
    }, o));
    await yield_();

    prog(44, 'সীমানার রেখা ও লেখা আলাদা করা হচ্ছে…');
    const structure = o.useStructure === false ? null : this.structureMask(ink, w, h, o);
    await yield_();

    prog(52, 'দাগের খোপ আলাদা করা হচ্ছে…');
    const { labels, count, sizes, touch } = this.regions(ink, w, h, structure);
    await yield_();

    const border = this.borderLabels(labels, w, h);
    const total = w * h;
    /**
     * ★ ছাঁকনি
     *
     * ভুয়া দাগ (অঙ্কের ভেতরের ফাঁকা) বাদ দেওয়ার আসল কাজটি করে
     * structureMask — খোপটি সীমানার রেখা ছুঁয়েছে কি না। তাই মাপের সীমা
     * এখানে **ঢিলা** রাখা যায়, নইলে আসল ছোট দাগগুলোও বাদ পড়ত।
     * (নিলফামারীর নমুনা নকশায় ছোট দাগ ~২০০ পিক্সেল, আর বড় অঙ্কের
     *  ফাঁকা ~১৫০ পিক্সেল — কেবল মাপ দেখে আলাদা করা যায় না।)
     */
    const hasStruct = !!touch;
    const minPix = o.minSatakPx > 0 ? o.minSatakPx
      : (hasStruct ? Math.max(40, Math.round(total * 0.000025))
                   : Math.max(500, Math.round(total * 0.0004)));
    const minSide = o.minSide > 0 ? o.minSide : (hasStruct ? 5 * RES : 18 * RES);
    const maxPix = Math.round(total * (o.maxFrac > 0 ? o.maxFrac : 0.35));

    // প্রতিটি খোপের ঘের — সরু ফুটকি বাদ দিতে লাগে
    const bx0 = new Int32Array(count).fill(2147483647);
    const by0 = new Int32Array(count).fill(2147483647);
    const bx1 = new Int32Array(count).fill(-1);
    const by1 = new Int32Array(count).fill(-1);
    for (let i = 0; i < labels.length; i++) {
      const id = labels[i];
      if (id < 0) continue;
      const px = i % w, py = (i / w) | 0;
      if (px < bx0[id]) bx0[id] = px;
      if (py < by0[id]) by0[id] = py;
      if (px > bx1[id]) bx1[id] = px;
      if (py > by1[id]) by1[id] = py;
    }

    const wanted = [];
    let tooSmall = 0, textDropped = 0;
    for (let id = 0; id < count; id++) {
      if (border.has(id)) continue;                 // বাইরের ফাঁকা জায়গা
      const s = sizes[id];
      if (s > maxPix) continue;
      if (touch && !touch[id]) { textDropped++; continue; }   // লেখার ভেতরের ফাঁকা
      const side = Math.min(bx1[id] - bx0[id] + 1, by1[id] - by0[id] + 1);
      if (s < minPix || side < minSide) { tooSmall++; continue; }
      wanted.push(id);
    }
    wanted.sort((a, b) => sizes[b] - sizes[a]);
    const cap = o.maxPolys > 0 ? o.maxPolys : 1500;
    const dropped = Math.max(0, wanted.length - cap);
    const use = wanted.slice(0, cap);

    prog(58, CadCore.bn(use.length) + 'টি দাগ পাওয়া গেছে — রেখা টানা হচ্ছে…');
    await yield_();

    // দ্রুত খোঁজার জন্য প্রতিটি লেবেলের প্রথম পিক্সেল একবারেই বের করি
    const firstPix = new Int32Array(count).fill(-1);
    for (let i = 0; i < labels.length; i++) {
      const id = labels[i];
      if (id >= 0 && firstPix[id] < 0) firstPix[id] = i;
    }

    /* সরলীকরণের কড়াকড়ি — পুরো অনুপাতে নয়, **বর্গমূলে**
     *
     *   পুরো অনুপাতে বাড়ালে কোণা কমে, কিন্তু রেখা কালির কেন্দ্র থেকে সরে যায়;
     *   একদম না বাড়ালে নিখুঁত হয়, কিন্তু অকারণে অজস্র কোণা জমে। ৮ MP তে
     *   মেপে দেখা গেছে (দাগ সংখ্যা তিনটিতেই এক — ১৩২৪):
     *       eps ১.৬০ → কেন্দ্র থেকে ২.৬৩ px, গড় কোণা ১১.১
     *       eps ২.০০ → কেন্দ্র থেকে ২.৭৯ px, গড় কোণা  ৮.৯   ← ভারসাম্য
     *       eps ২.৫৩ → কেন্দ্র থেকে ২.৯৪ px, গড় কোণা  ৭.৯
     *   বর্গমূল ঠিক মাঝেরটিই দেয়।
     */
    const eps = o.eps > 0 ? o.eps : 1.6 * Math.sqrt(RES);
    const angle = o.straighten == null ? 7 : o.straighten;
    const minEdge = o.minEdge > 0 ? o.minEdge : eps * 3.2;

    /* ── ধাপ ১: প্রতিটি খোপের সীমানা **প্রতিটি জালিবিন্দুসহ** আঁকা ──
       এখনই সরলীকরণ করি না — করলে ভাগ করা সীমানার দুই পাশ আলাদাভাবে ছাঁটা
       হয়ে যেত, আর দুই দাগ একে অন্যের ভেতর ঢুকে পড়ত। */
    const dense = [];
    for (let n = 0; n < use.length; n++) {
      const id = use[n];
      const p0 = firstPix[id];
      if (p0 < 0) continue;
      const sx = p0 % w, sy = (p0 / w) | 0;
      const inside = (x, y) => labels[y * w + x] === id;
      const ring = this.traceRing(inside, w, h, sx, sy, { dense: true });
      if (ring.length >= 3) dense.push(ring);

      if ((n & 63) === 0) {
        prog(58 + 22 * n / use.length,
             CadCore.bn(dense.length) + '/' + CadCore.bn(use.length) + ' দাগের সীমানা আঁকা হয়েছে…');
        await yield_();
      }
    }

    /* ── ধাপ ২: ভাগ করা সীমানা (আর্ক) ধরে **একবারই** সরলীকরণ ── */
    prog(82, 'ভাগ করা সীমানা ধরে সরলীকরণ হচ্ছে…');
    await yield_();
    let rings = this.simplifyTopology(dense, { eps, straighten: angle, minEdge });
    await yield_();

    /* ── ধাপ ৩: ছাঁকনি ──
       এখানে আর unpinch/despike চালানো হয় না — ওগুলো প্রতিটি রিং আলাদাভাবে
       বদলায়, ফলে সদ্য মেলানো টপোলজি আবার ভেঙে যেত (মেপে দেখা গেছে
       ওভারল্যাপ ৫৫৬ → ৮০৪ হয়ে যায়)। দরকার হলে ব্যবহারকারী "কাঁটা সারান"
       বোতাম দিয়ে নিজে চালাতে পারেন। */
    prog(92, 'ছাঁকনি চলছে…');
    const polys = [];
    let slivers = 0;
    for (const ring of rings) {
      if (ring.length < 3) continue;
      if (CadCore.area(ring) < minPix * 0.4) continue;
      if (o.keepSlivers !== true && CadCore.isSliver(ring, o.sliver)) { slivers++; continue; }
      polys.push(ring.map(p => ({ x: p.x * scale, y: p.y * scale })));
    }
    await yield_();

    prog(100, 'সম্পন্ন');
    return {
      polys,
      work: { w, h, scale },
      stats: { found: wanted.length, used: polys.length, dropped, tooSmall, textDropped,
               slivers, minPix, minSide, maxPix, structure: !!touch }
    };
  },

  /**
   * এক ক্লিকে একটি দাগ (ম্যাজিক ওয়ান্ড)
   * ব্যবহারকারী দাগের ভেতরে ক্লিক করলে কেবল সেই খোপটিই বহুভুজ হয়।
   */
  traceAt(canvas, imgX, imgY, opts) {
    const o = opts || {};
    const cache = o.cache && o.cache.gray ? o.cache : null;
    const prep = cache || this.prepare(canvas, o);
    const { w, h, scale } = prep;

    let ink = cache && cache.ink ? cache.ink : this.cleanInk(this.inkMask(prep.gray, w, h, o), w, h, o);
    // ম্যাজিক ওয়ান্ডে ব্যবহারকারী নিজেই ক্লিক করেছেন — লেখা/সীমানার
    // বাছবিচার লাগে না, যা দেখাচ্ছে সেটাই দিই
    let reg = cache && cache.regions ? cache.regions : this.regions(ink, w, h);

    if (o.cache) {
      o.cache.gray = prep.gray; o.cache.w = w; o.cache.h = h; o.cache.scale = scale;
      o.cache.ink = ink; o.cache.regions = reg;
    }

    const x = Math.round(imgX / scale), y = Math.round(imgY / scale);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    const id = reg.labels[y * w + x];
    if (id < 0) return null;

    const total = w * h;
    if (reg.sizes[id] > total * (o.maxFrac > 0 ? o.maxFrac : 0.5)) return null;   // বাইরের ফাঁকা

    const start = this.findStart(reg.labels, w, h, id);
    if (!start) return null;
    const inside = (px, py) => reg.labels[py * w + px] === id;
    let ring = this.traceRing(inside, w, h, start.x, start.y);
    if (ring.length < 3) return null;

    const eps = o.eps > 0 ? o.eps : 1.6;
    ring = CadCore.simplifyRing(ring, eps);
    ring = CadCore.straighten(ring, o.straighten == null ? 7 : o.straighten, true);
    ring = CadCore.collapseShortEdges(ring, o.minEdge > 0 ? o.minEdge : eps * 3.2, true);
    ring = CadCore.dedupe(ring, 0.75);
    if (ring.length < 3) return null;

    return ring.map(p => ({ x: p.x * scale, y: p.y * scale }));
  },

  /* ==================== ৬. ঝালাই (weld) ==================== */

  /**
   * কাছাকাছি কোণাগুলো এক বিন্দুতে মিলিয়ে দেওয়া
   *
   * প্রতিটি বহুভুজ আলাদাভাবে ছাঁটাই হওয়ায় ভাগ করা সীমানায় সামান্য
   * এদিক-ওদিক হয়। CAD এ এটি অগ্রহণযোগ্য — তাই গ্রিড-হ্যাশে কাছের
   * কোণাগুলোকে তাদের গড় অবস্থানে বসিয়ে দেওয়া হয়।
   */
  weld(polys, tol) {
    const t = tol > 0 ? tol : 2;
    const cell = t * 2;
    const grid = new Map();
    const key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);

    // ক. প্রতিটি কোণাকে একটি দলে ফেলা
    const nodes = [];   // { x, y, n }
    const refs = [];    // { poly, index, node }

    for (const poly of polys) {
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        let found = -1;
        const gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell);
        for (let dx = -1; dx <= 1 && found < 0; dx++) {
          for (let dy = -1; dy <= 1 && found < 0; dy++) {
            const bucket = grid.get((gx + dx) + ',' + (gy + dy));
            if (!bucket) continue;
            for (const ni of bucket) {
              const nd = nodes[ni];
              if (Math.hypot(nd.x / nd.n - p.x, nd.y / nd.n - p.y) <= t) { found = ni; break; }
            }
          }
        }
        if (found < 0) {
          found = nodes.length;
          nodes.push({ x: p.x, y: p.y, n: 1 });
          const k = key(p.x, p.y);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(found);
        } else {
          nodes[found].x += p.x; nodes[found].y += p.y; nodes[found].n++;
        }
        refs.push({ poly, index: i, node: found });
      }
    }

    // খ. দলের গড়ে সবাইকে বসানো
    for (const r of refs) {
      const nd = nodes[r.node];
      r.poly[r.index] = { x: nd.x / nd.n, y: nd.y / nd.n };
    }

    // গ. ঝালাইয়ের পর একই বিন্দু পরপর এলে বাদ
    for (let i = 0; i < polys.length; i++) {
      polys[i] = CadCore.dedupe(polys[i], 0.4);
    }
    return polys;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CadTrace;
