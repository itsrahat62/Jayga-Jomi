/* ==========================================================================
   kmz-fx.js — মৌজা নকশার ছবি প্রস্তুত করা (স্বচ্ছতা ও রঙ)
   ========================================================================== */

const KmzFx = {

  DEFAULT_THRESHOLD: 205,

  hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  },

  luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; },

  /**
   * পেপারের উজ্জ্বলতা অটো বের করা (৯০% percentile = কাগজের রঙ)
   */
  estimatePaperLuma(data) {
    if (!data || !data.length) return this.DEFAULT_THRESHOLD;
    const step = Math.max(1, Math.floor(data.length / (4 * 3000)));
    const lumas = [];
    for (let i = 0; i < data.length; i += step * 4) {
      lumas.push(Math.round(this.luma(data[i], data[i + 1], data[i + 2])));
    }
    lumas.sort((a, b) => a - b);
    const p90 = lumas[Math.floor(lumas.length * 0.90)] || this.DEFAULT_THRESHOLD;
    return Math.max(150, Math.min(255, p90));
  },

  /**
   * RGBA pixel processing — সরল adaptive threshold, কোনো erode/dilate নেই
   * এতে হাতে লেখা বাংলা সংখ্যা ও চিকন রেখা অক্ষত ও পরিষ্কার থাকে।
   */
  processPixels(data, o, w, h) {
    const opt = o || {};
    const transparent = !!opt.transparent;
    const paperY = this.estimatePaperLuma(data);

    // ink threshold: কাগজের রঙের ৭৫% এর নিচে = ink
    const inkTh = Math.round(paperY * 0.78);
    // soft zone: threshold থেকে ২০ লুমা নিচে পর্যন্ত smooth blend
    const softRange = 28;

    const col = opt.color ? this.hexToRgb(opt.color) : { r: 220, g: 38, b: 38 };

    let changed = 0, kept = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = this.luma(r, g, b);

      // বাদামী/হলুদ কাগজের দাগ ফিল্টার: রঙিন কিন্তু হালকা → কাগজ
      const isBrownPaper = r > 130 && g > 110 && b < 200 && lum > inkTh * 0.9;

      // ইংক ফ্যাক্টর: 0 (সাদা কাগজ) থেকে 1 (গাঢ় কালো কালি)
      let factor = 0;
      if (!isBrownPaper) {
        if (lum < inkTh - softRange) {
          // গাঢ় ink — সম্পূর্ণ রঙ বসবে
          factor = 1.0;
        } else if (lum < inkTh) {
          // soft edge — anti-aliased smooth blend
          factor = (inkTh - lum) / softRange;
          factor = Math.max(0, Math.min(1, factor));
        }
      }

      if (transparent) {
        const a = Math.round(factor * 255);
        const prev = data[i + 3];
        data[i + 3] = prev < 255 ? Math.round(a * prev / 255) : a;
        if (data[i + 3] === 0) changed++; else kept++;
      } else {
        kept++;
        if (factor > 0) {
          // কাগজের রঙ সাদা করে দাও
          const bg = Math.round(255 * (1 - factor));
          data[i]     = Math.round(col.r * factor + bg);
          data[i + 1] = Math.round(col.g * factor + bg);
          data[i + 2] = Math.round(col.b * factor + bg);
        } else {
          // কাগজ → সাদা
          data[i] = data[i + 1] = data[i + 2] = 255;
        }
      }
    }
    return { changed, kept };
  },

  /**
   * Canvas processing & PNG/JPEG generation
   */
  async apply(img, o) {
    const opt = o || {};
    const c = document.createElement('canvas');
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });

    // সাদা পটভূমি আগে দাও — PDF স্বচ্ছ হলেও সাদা থাকে
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);

    let stats = { changed: 0, kept: W * H };
    if (opt.transparent || opt.color) {
      const id = ctx.getImageData(0, 0, W, H);
      stats = this.processPixels(id.data, opt, W, H);
      ctx.clearRect(0, 0, W, H);
      ctx.putImageData(id, 0, 0);
    }

    const mime = opt.transparent ? 'image/png' : 'image/jpeg';
    const quality = mime === 'image/jpeg' ? 0.96 : undefined;
    const blob = await new Promise(res => c.toBlob(res, mime, quality));
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const out = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('প্রক্রিয়াকৃত ছবি পড়া গেল না')); };
      im.src = url;
    });

    return { bytes, img: out, mime, stats, width: W, height: H };
  },

  nameFor(name, mime) {
    const stem = String(name || 'map').replace(/\.[A-Za-z0-9]{1,5}$/, '');
    return stem + (mime === 'image/png' ? '.png' : '.jpg');
  },

  transparentPct(stats) {
    const total = (stats.changed || 0) + (stats.kept || 0);
    return total ? (stats.changed / total) * 100 : 0;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = KmzFx;
