/* ==========================================================================
   kmz-cc.js — Sauvola Adaptive Thresholding + Transparent Background Engine
   ========================================================================== */

const KmzCC = {

  luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; },

  hexToRgb(hex) {
    if (!hex) return { r: 239, g: 68, b: 68 }; // Default Red
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return { r: 239, g: 68, b: 68 };
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  },

  /**
   * Sauvola Adaptive Thresholding
   */
  sauvolaThreshold(data, w, h) {
    const binary = new Uint8Array(w * h);
    
    const integral = new Float64Array(w * h);
    const integralSq = new Float64Array(w * h);

    // Integral Image তৈরি
    for (let y = 0; y < h; y++) {
      let sum = 0;
      let sumSq = 0;
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const pi = idx * 4;
        const val = this.luma(data[pi], data[pi + 1], data[pi + 2]);
        
        sum += val;
        sumSq += val * val;

        if (y === 0) {
          integral[idx] = sum;
          integralSq[idx] = sumSq;
        } else {
          integral[idx] = integral[idx - w] + sum;
          integralSq[idx] = integralSq[idx - w] + sumSq;
        }
      }
    }

    // Sauvola Parameters (Finetuned for maps)
    const winSize = Math.max(30, Math.round(w / 80)); // উইন্ডো সাইজ
    const halfWin = (winSize / 2) | 0;
    const k = 0.15; // k-ফ্যাক্টর
    const R = 128;  // ডাইনামিক রেঞ্জ স্ট্যান্ডার্ড ডেভিয়েশন

    for (let y = 0; y < h; y++) {
      const yMin = Math.max(0, y - halfWin);
      const yMax = Math.min(h - 1, y + halfWin);

      for (let x = 0; x < w; x++) {
        const xMin = Math.max(0, x - halfWin);
        const xMax = Math.min(w - 1, x + halfWin);

        const count = (yMax - yMin + 1) * (xMax - xMin + 1);

        const idx00 = yMin * w + xMin;
        const idx01 = yMin * w + xMax;
        const idx10 = yMax * w + xMin;
        const idx11 = yMax * w + xMax;

        const sum = integral[idx11] - (xMin > 0 ? integral[idx11 - (xMax - xMin + 1)] : 0) - (yMin > 0 ? integral[idx11 - (yMax - yMin + 1) * w] : 0) + (xMin > 0 && yMin > 0 ? integral[idx00 - 1 - w] : 0);
        const sumSq = integralSq[idx11] - (xMin > 0 ? integralSq[idx11 - (xMax - xMin + 1)] : 0) - (yMin > 0 ? integralSq[idx11 - (yMax - yMin + 1) * w] : 0) + (xMin > 0 && yMin > 0 ? integralSq[idx00 - 1 - w] : 0);

        const mean = sum / count;
        const variance = (sumSq - (sum * sum) / count) / count;
        const stdDev = Math.sqrt(Math.max(0, variance));

        const idx = y * w + x;
        const pi = idx * 4;
        const val = this.luma(data[pi], data[pi + 1], data[pi + 2]);

        // উইন্ডো ভ্যারিয়েশন খুব কম থাকলে বাইপাস (পিওর হোয়াইট)
        if (stdDev < 4.0) {
          binary[idx] = 0;
          continue;
        }

        // Sauvola threshold
        const threshold = mean * (1 + k * (stdDev / R - 1));

        // লোকাল কনট্রাস্ট সেফটি
        if (val < threshold && (mean - val) > 10) {
          binary[idx] = 1;
        } else {
          binary[idx] = 0;
        }
      }
    }
    return binary;
  },

  labelComponents(binary, w, h) {
    const labels = new Int32Array(w * h).fill(-1);
    let nextId = 0;
    const stack = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (binary[idx] === 0 || labels[idx] !== -1) continue;

        const id = nextId++;
        labels[idx] = id;
        stack.push(idx);

        while (stack.length) {
          const cur = stack.pop();
          const cx = cur % w, cy = (cur / w) | 0;
          const nb4 = [
            cy > 0     ? cur - w : -1,
            cy < h - 1 ? cur + w : -1,
            cx > 0     ? cur - 1 : -1,
            cx < w - 1 ? cur + 1 : -1,
          ];
          for (const nb of nb4) {
            if (nb < 0 || binary[nb] === 0 || labels[nb] !== -1) continue;
            labels[nb] = id;
            stack.push(nb);
          }
        }
      }
    }
    return { labels, count: nextId };
  },

  computeStats(labels, count, w) {
    const minX = new Int32Array(count).fill(99999);
    const minY = new Int32Array(count).fill(99999);
    const maxX = new Int32Array(count).fill(0);
    const maxY = new Int32Array(count).fill(0);
    const pixels = new Int32Array(count);

    for (let idx = 0; idx < labels.length; idx++) {
      const id = labels[idx];
      if (id < 0) continue;
      const x = idx % w, y = (idx / w) | 0;
      if (x < minX[id]) minX[id] = x;
      if (y < minY[id]) minY[id] = y;
      if (x > maxX[id]) maxX[id] = x;
      if (y > maxY[id]) maxY[id] = y;
      pixels[id]++;
    }

    const stats = [];
    for (let id = 0; id < count; id++) {
      if (pixels[id] === 0) continue;
      stats.push({
        id,
        w: maxX[id] - minX[id] + 1,
        h: maxY[id] - minY[id] + 1,
        pixels: pixels[id]
      });
    }
    return stats;
  },

  async process(srcCanvas, opts) {
    const o = opts || {};
    const prog = o.onProgress || (() => {});
    const targetRgb = this.hexToRgb(o.color || '#ef4444');

    const W = srcCanvas.width, H = srcCanvas.height;
    const imgSize = Math.sqrt(W * H);
    const scale = imgSize / 2000;

    prog(10, 'ম্যাপ ব্যাকগ্রাউন্ড স্বচ্ছ করা হচ্ছে…');

    const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    // ১. Sauvola Adaptive Thresholding
    const binary = this.sauvolaThreshold(data, W, H);

    prog(55, 'পিক্সেলের মসৃণতা ও স্বচ্ছতা হিসাব করা হচ্ছে…');

    // ২. Connected Components Analysis
    const { labels, count } = this.labelComponents(binary, W, H);
    const stats = this.computeStats(labels, count, W);
    
    const removeSet = new Set();
    const MIN_NOISE = Math.max(3, Math.round(6 * scale * scale));

    for (const b of stats) {
      if (b.pixels < MIN_NOISE || b.w < 2 || b.h < 2) {
        removeSet.add(b.id);
      }
    }

    prog(80, 'স্বচ্ছ ব্যাকগ্রাউন্ডসহ ম্যাপ রেন্ডারিং করা হচ্ছে…');

    const outCanvas = document.createElement('canvas');
    outCanvas.width = W; outCanvas.height = H;
    const outCtx = outCanvas.getContext('2d');
    
    // ব্যাকগ্রাউন্ড সম্পূর্ণ খালি/স্বচ্ছ রাখা হলো (সাদা ফিল করা বাদ দেওয়া হলো)
    outCtx.clearRect(0, 0, W, H);

    const outData = outCtx.getImageData(0, 0, W, H);
    const od = outData.data;

    const softRange = 18;

    for (let idx = 0; idx < labels.length; idx++) {
      const id = labels[idx];
      const si = idx * 4;
      const r = data[si], g = data[si + 1], b = data[si + 2];
      const lum = this.luma(r, g, b);

      if (id >= 0 && !removeSet.has(id)) {
        // রেখা ও দাগ নম্বর
        const inkLimit = 160;
        let factor = 1.0;
        
        if (lum > inkLimit - softRange) {
          factor = (inkLimit - lum) / softRange;
          factor = Math.max(0.15, Math.min(1.0, factor));
        }

        od[si]     = targetRgb.r;
        od[si + 1] = targetRgb.g;
        od[si + 2] = targetRgb.b;
        od[si + 3] = Math.round(factor * 255); // আলফা চ্যানেলে সফট ট্রানজিশন (স্বচ্ছতা ব্লেন্ডিং)
      } else {
        // ব্যাকগ্রাউন্ড বা নয়েজ ডট -> সম্পূর্ণ স্বচ্ছ (Alpha = 0)
        od[si]     = 0;
        od[si + 1] = 0;
        od[si + 2] = 0;
        od[si + 3] = 0;
      }
    }

    outCtx.putImageData(outData, 0, 0);
    prog(100, 'সম্পন্ন!');
    return outCanvas;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = KmzCC;
