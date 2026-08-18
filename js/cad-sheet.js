/* ==========================================================================
   cad-sheet.js — ছাপার শিট (ডিমার্কেশন / পেন্টাগ্রাফ)
   --------------------------------------------------------------------------
   পেশাদার সার্ভে শিটে যা যা থাকে, সবই এখানে আঁকা হয়:

     · দুই স্তরের বর্ডার          · উত্তর দিকের তীর
     · শিরোনাম বাক্স              — জেলা / উপজেলা / মৌজা / জে.এল. / স্কেল
     · শিটের ধরন                  — ডিমার্কেশন বা পেন্টাগ্রাফ
     · পরিমাপকারি ও প্রতিষ্ঠান বাক্স
     · রিপোর্ট নোট (তারিখসহ)      · কর্ণ স্কেল (diagonal scale)
     · মূল নকশা                   — বাহুর মাপ, দাগ নম্বর, ক্ষেত্রফলসহ
     · পেন্টাগ্রাফ টেবিল          — সি.এস দাগ ↔ বি.এস দাগ মিলকরণ
     · সাংকেতিক চিহ্ন (legend)    · পাদটীকা

   সবকিছু **মিলিমিটারে** মাপা হয় (A4 = ২১০×২৯৭ মিমি), তারপর ছাপার
   রেজুলেশনে পিক্সেলে বদলে যায় — তাই ৩০০ DPI তেও লেআউট একই থাকে।
   ========================================================================== */

const CadSheet = {

  A4: { w: 210, h: 297 },
  DPI: 200,

  /* ---------------- ছোট সহায়ক ---------------- */

  _u(mm) { return mm * this._k; },

  _box(ctx, x, y, w, h, opt) {
    const o = opt || {};
    const u = this._u.bind(this);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(u(x), u(y), u(w), u(h)); }
    ctx.strokeStyle = o.color || '#d946ef';
    ctx.lineWidth = Math.max(1, u(o.lw == null ? 0.35 : o.lw));
    ctx.strokeRect(u(x), u(y), u(w), u(h));
  },

  _line(ctx, x1, y1, x2, y2, color, lw) {
    const u = this._u.bind(this);
    ctx.strokeStyle = color || '#000';
    ctx.lineWidth = Math.max(1, u(lw == null ? 0.3 : lw));
    ctx.beginPath();
    ctx.moveTo(u(x1), u(y1)); ctx.lineTo(u(x2), u(y2));
    ctx.stroke();
  },

  /** মিমি-তে ফন্ট সাইজ দিয়ে লেখা */
  _text(ctx, txt, x, y, opt) {
    const o = opt || {};
    const u = this._u.bind(this);
    ctx.save();
    ctx.font = (o.weight || '600') + ' ' + Math.round(u(o.size || 3)) + 'px "Noto Sans Bengali", "Anek Bangla", sans-serif';
    ctx.fillStyle = o.color || '#000';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'middle';
    ctx.fillText(String(txt), u(x), u(y));
    const w = ctx.measureText(String(txt)).width;
    ctx.restore();
    return w / this._k;                       // মিমি তে ফেরত
  },

  /** কেন্দ্রে বসানো, বাক্সের চেয়ে চওড়া হলে ছোট করে নেওয়া */
  _fitText(ctx, txt, cx, cy, maxW, opt) {
    const o = opt || {};
    let size = o.size || 3;
    const u = this._u.bind(this);
    for (let i = 0; i < 12; i++) {
      ctx.font = (o.weight || '600') + ' ' + Math.round(u(size)) + 'px "Noto Sans Bengali", "Anek Bangla", sans-serif';
      if (ctx.measureText(String(txt)).width <= u(maxW)) break;
      size *= 0.92;
    }
    return this._text(ctx, txt, cx, cy, Object.assign({}, o, { size, align: o.align || 'center' }));
  },

  /* ==================== উত্তর দিকের তীর ==================== */

  /**
   * নমুনা শিটের তীরটি লম্বা, সরু ও কালো — উপরে ছুঁচালো, মাঝে খাঁজ।
   * সার্ভে শিটে এই ধরনই প্রচলিত।
   */
  /**
   * উত্তর তীর
   * @param {number} deg  উত্তর কোন দিকে — উপরের দিক থেকে ঘড়ির কাঁটার দিকে ডিগ্রিতে।
   *   নকশা যেভাবে স্ক্যান হয়েছে উত্তর সেভাবে উপরে নাও থাকতে পারে, তাই
   *   ডিজাইন পর্দায় বসানো কোণটিই এখানে আসে (`doc.meta.northDeg`)।
   */
  northArrow(ctx, x, y, w, h, deg) {
    const rot = ((Number(deg) || 0) % 360 + 360) % 360;
    /* ★ কেন ঘোরালে অন্য আকৃতি
       চিরাচরিত লম্বা তীরটি ১১ × ৪৪ মিমি — সেটি ৯০° ঘোরালে ৪৪ মিমি চওড়া হয়ে
       শিরোনাম বাক্সের উপর উঠে যায়। তাই উত্তর উপরে না থাকলে বাঁ মার্জিনে
       আঁটে এমন একটি কম্পাস-বৃত্ত আঁকা হয়। উত্তর উপরে থাকলে (সাধারণ ক্ষেত্রে)
       আগের তীরটিই হুবহু আগের মতো থাকে। */
    if (rot > 0.5 && rot < 359.5) return this._compassRose(ctx, x, y, w, rot);

    const u = this._u.bind(this);
    const cx = x + w / 2;
    const shaft = w * 0.13;              // দণ্ডের অর্ধ-প্রস্থ
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(u(cx), u(y));                                    // চূড়া

    // ডান পাশ — তিনটি ধাপে নামা ফলা
    ctx.lineTo(u(x + w), u(y + h * 0.26));
    ctx.lineTo(u(cx + shaft), u(y + h * 0.21));
    ctx.lineTo(u(x + w * 0.94), u(y + h * 0.52));
    ctx.lineTo(u(cx + shaft), u(y + h * 0.47));
    ctx.lineTo(u(x + w * 0.88), u(y + h * 0.76));
    ctx.lineTo(u(cx + shaft), u(y + h * 0.71));
    ctx.lineTo(u(cx + shaft), u(y + h));                        // দণ্ডের গোড়া
    ctx.lineTo(u(cx - shaft), u(y + h));

    // বাঁ পাশ — আয়নার প্রতিচ্ছবি
    ctx.lineTo(u(cx - shaft), u(y + h * 0.71));
    ctx.lineTo(u(x + w * 0.12), u(y + h * 0.76));
    ctx.lineTo(u(cx - shaft), u(y + h * 0.47));
    ctx.lineTo(u(x + w * 0.06), u(y + h * 0.52));
    ctx.lineTo(u(cx - shaft), u(y + h * 0.21));
    ctx.lineTo(u(x), u(y + h * 0.26));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  /** উত্তর উপরে না থাকলে — বাঁ মার্জিনে আঁটে এমন কম্পাস */
  _compassRose(ctx, x, y, w, deg) {
    const u = this._u.bind(this);
    const cx = x + w / 2, cy = y + 10, R = 7.6;     // মিমি
    const rad = deg * Math.PI / 180;

    ctx.save();
    ctx.translate(u(cx), u(cy));
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1, u(0.25));
    ctx.beginPath(); ctx.arc(0, 0, u(R), 0, Math.PI * 2); ctx.stroke();

    ctx.save();
    ctx.rotate(rad);
    ctx.fillStyle = '#000';
    ctx.beginPath();                                  // উত্তরমুখী ফলা
    ctx.moveTo(0, -u(R - 0.6));
    ctx.lineTo(u(1.7), u(1.4)); ctx.lineTo(0, u(0.3)); ctx.lineTo(-u(1.7), u(1.4));
    ctx.closePath(); ctx.fill();
    ctx.beginPath();                                  // দক্ষিণমুখী (ফাঁপা)
    ctx.moveTo(0, u(R - 0.6));
    ctx.lineTo(u(1.3), -u(1.0)); ctx.lineTo(0, 0); ctx.lineTo(-u(1.3), -u(1.0));
    ctx.closePath(); ctx.stroke();
    ctx.restore();

    // অক্ষর সোজা থাকে, কেবল অবস্থান ঘোরে
    const fs = Math.max(6, u(2.6));
    ctx.font = '700 ' + Math.round(fs) + 'px "Noto Sans Bengali", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    [['উ', 0], ['পূ', 90], ['দ', 180], ['প', 270]].forEach(([t, a]) => {
      const th = (a + deg) * Math.PI / 180;
      ctx.fillText(t, Math.sin(th) * u(R + 3.2), -Math.cos(th) * u(R + 3.2));
    });
    ctx.restore();
  },

  /* ==================== কর্ণ স্কেল (diagonal scale) ==================== */

  /**
   * পুরনো নকশার সাথে দেওয়া মাপকাঠি — বাঁয়ের খোপে তির্যক রেখা দিয়ে
   * ভগ্নাংশ পড়া যায়, ডানে পুরো একক।
   */
  diagonalScale(ctx, x, y, w, h, meta) {
    const rows = 6, units = 4;
    const leftW = w * 0.42;                 // তির্যক (ভগ্নাংশের) অংশ
    const stepR = (w - leftW) / units;      // ডান পাশে এক-একটি পুরো একক
    const rowH = h / rows;

    this._box(ctx, x, y, w, h, { color: '#000', lw: 0.28 });

    // অনুভূমিক সারি
    for (let i = 1; i < rows; i++) this._line(ctx, x, y + i * rowH, x + w, y + i * rowH, '#000', 0.18);

    // ডান পাশের পুরো একক (ভেতরের দাগ)
    for (let i = 1; i < units; i++) {
      const px = x + leftW + i * stepR;
      this._line(ctx, px, y, px, y + h, '#000', 0.18);
    }

    // বাঁ পাশের তির্যক রেখা
    const sub = 5;
    for (let i = 0; i <= sub; i++) {
      const topX = x + leftW * (i / sub);
      const botX = x + leftW * ((i - 1) / sub);
      this._line(ctx, topX, y, Math.max(x, botX), y + h, '#000', 0.16);
    }
    this._line(ctx, x + leftW, y, x + leftW, y + h, '#000', 0.28);

    /* মাপের লেখা
       বাঁ প্রান্তে ভগ্নাংশের ঘর, তাই সেখানে উল্টো দিকে গোনা হয় —
       ০ বসে তির্যক অংশের **ডান** প্রান্তে, আর তার বাঁয়ে উপ-বিভাগ। */
    const ft = meta && meta.scaleInch ? CadCore.feetPerMapInch(meta.scaleInch) : 44;
    const unit = Math.max(10, Math.round(ft / 10) * 10);

    this._text(ctx, '০', x + leftW, y - 1.5,
               { size: 1.8, align: 'center', color: '#000', weight: '600' });
    this._text(ctx, CadCore.bn(unit) + "'", x, y - 1.5,
               { size: 1.7, align: 'center', color: '#000', weight: '500' });
    for (let i = 1; i <= units; i++) {
      this._text(ctx, CadCore.bn(i * unit) + "'", x + leftW + i * stepR, y - 1.5,
                 { size: 1.7, align: 'center', color: '#000', weight: '500' });
    }
    // বাঁ পাশে ভগ্নাংশের সারি (০ থেকে ১০০%, নিচের সারিতে ১০০)
    for (let i = 0; i <= rows; i += 2) {
      const pct = Math.round(i / rows * 100);
      this._text(ctx, CadCore.bn(pct) + '%', x - 0.9, y + i * rowH,
                 { size: 1.5, align: 'right', color: '#000', weight: '500' });
    }
  },

  /* ==================== মূল নকশা ==================== */

  /**
   * ভেক্টর দাগগুলো শিটের নির্দিষ্ট এলাকায় ফিট করে আঁকা
   * @returns {{k:number, ox:number, oy:number}} নকশা→শিট রূপান্তর
   */
  drawPlan(ctx, doc, area, opt) {
    const o = opt || {};
    const u = this._u.bind(this);
    // "যা দেখছেন তাই যাবে" — লুকানো দাগ শিটে ছাপা হয় না
    const feats = CadCore.activeFeatures(doc).filter(f => f.pts && f.pts.length >= 2);
    if (!feats.length) return null;

    const bb = CadCore.bboxAll(feats.map(f => f.pts));
    if (!(bb.w > 0) && !(bb.h > 0)) return null;

    const pad = 4;                              // মিমি
    const availW = area.w - pad * 2, availH = area.h - pad * 2;
    const k = Math.min(availW / (bb.w || 1), availH / (bb.h || 1));
    const ox = area.x + pad + (availW - bb.w * k) / 2 - bb.x * k;
    const oy = area.y + pad + (availH - bb.h * k) / 2 - bb.y * k;
    const T = p => ({ x: u(ox + p.x * k), y: u(oy + p.y * k) });

    /* ── দাগ আঁকা ── */
    const ordered = doc.layers.slice().reverse();
    for (const L of ordered) {
      if (!L.visible) continue;
      for (const f of feats) {
        if (f.layer !== L.id) continue;
        ctx.save();
        ctx.beginPath();
        const p0 = T(f.pts[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < f.pts.length; i++) { const q = T(f.pts[i]); ctx.lineTo(q.x, q.y); }
        if (f.closed) ctx.closePath();
        if (f.closed && L.fill) { ctx.fillStyle = L.fill; ctx.fill(); }
        ctx.strokeStyle = L.color;
        ctx.lineWidth = Math.max(1, u((L.width || 1.5) * 0.16));
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }

    /* ── লেখা ──
     * শিটেও ভিড় সামলাতে হয়: দাগ নম্বর ও ক্ষেত্রফল আগে বসে, তারপর
     * বাহুর মাপ (লম্বা বাহু আগে)। আগের লেখার সাথে ঠেকে গেলে বাদ পড়ে —
     * নইলে হাজার দাগের নকশায় শিট পড়ার অযোগ্য হয়ে যায়।
     */
    const placed = [];
    const claim = (cx, cy, w, h) => {
      const r = { x: cx - w / 2, y: cy - h / 2, w, h };
      for (const q of placed) {
        if (r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h) return false;
      }
      placed.push(r);
      return true;
    };

    /* দাগ নম্বর ও ক্ষেত্রফল */
    for (const L of ordered) {
      if (!L.visible) continue;
      for (const f of feats) {
        if (f.layer !== L.id || !f.closed || !f.showLabel) continue;
        const q = T(CadCore.labelPoint(f.pts));
        let dy = 0;
        if (f.dag) {
          ctx.save();
          ctx.font = '800 ' + Math.round(u(o.dagSize || 3.4)) + 'px "Noto Sans Bengali", sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const t = CadCore.bn(f.dag);
          const w = ctx.measureText(t).width;
          if (claim(q.x, q.y, w + u(0.6), u(o.dagSize || 3.4) * 1.2)) {
            ctx.fillStyle = L.color;
            ctx.fillText(t, q.x, q.y);
            dy = u(3.6);
          }
          ctx.restore();
        }
        if (o.area !== false && doc.ftPerPx > 0 && f.showArea) {
          const m = CadCore.measure(doc, f);
          if (m.sqft > 0) {
            ctx.save();
            ctx.font = '600 ' + Math.round(u(o.areaSize || 2.4)) + 'px "Noto Sans Bengali", sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const t = CadCore.satakText(m.sqft);
            const w = ctx.measureText(t).width;
            if (claim(q.x, q.y + dy, w + u(0.6), u(o.areaSize || 2.4) * 1.2)) {
              ctx.fillStyle = '#111827';
              ctx.fillText(t, q.x, q.y + dy);
            }
            ctx.restore();
          }
        }
      }
    }

    /* বাহুর মাপ (ভাগ করা সীমানা একবারই) */
    if (o.dims !== false && doc.ftPerPx > 0) {
      const fs = o.dimSize || 2.1;
      const seen = new Set();
      const jobs = [];
      for (const f of feats) {
        if (!f.showDims) continue;
        const c = CadCore.centroid(f.pts);
        for (const sd of CadCore.sides(doc, f)) {
          if (sd.px * k < 7) continue;                  // ছোট বাহু — লেখা ধরবে না
          const key = CadCore.sideKey(sd.a, sd.b, Math.max(1, 1.5 / k));
          if (seen.has(key)) continue;
          seen.add(key);
          jobs.push({ sd, c });
        }
      }
      jobs.sort((a, b) => b.sd.px - a.sd.px);

      ctx.save();
      ctx.font = '700 ' + Math.round(u(fs)) + 'px "Noto Sans Bengali", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1d4ed8';
      for (const { sd, c } of jobs) {
        let nx = sd.mid.x - c.x, ny = sd.mid.y - c.y;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl; ny /= nl;
        let ang = sd.angle;
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;

        const m = T({ x: sd.mid.x + nx * (2.0 / k), y: sd.mid.y + ny * (2.0 / k) });
        const txt = CadCore.ftIn(sd.feet);
        const tw = ctx.measureText(txt).width, th = u(fs) * 1.15;
        const ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
        if (!claim(m.x, m.y, tw * ca + th * sa, tw * sa + th * ca)) continue;

        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(ang);
        ctx.fillText(txt, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    /* ── লেখা, চিহ্ন ও বৃত্ত ──
       নোটগুলো শিটেও যায় — মাঠে যা লিখে রেখেছেন, ছাপা কাগজেও সেটাই থাকে।
       কোনো হিসাবে যোগ হয় না, তাই ক্ষেত্রফলের যোগফল বদলায় না। */
    if (o.notes !== false && typeof CadNotes !== 'undefined') {
      const nts = CadNotes.visible(doc);
      const nfs = o.noteSize || 2.6;
      for (const n of nts) {
        const q = T(n);
        ctx.save();
        ctx.strokeStyle = n.color || '#b45309';
        ctx.fillStyle = n.color || '#b45309';
        ctx.lineWidth = Math.max(0.7, u(0.25));
        if (n.kind === 'circle') {
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(1, u(n.r * k)), 0, Math.PI * 2);
          ctx.stroke();
        } else if (n.kind === 'pin') {
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(1, u(0.9)), 0, Math.PI * 2);
          ctx.fill();
        }
        if (n.text) {
          ctx.font = '700 ' + Math.round(u(nfs)) + 'px "Noto Sans Bengali", sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = n.kind === 'pin' ? 'bottom' : 'middle';
          const ty = n.kind === 'pin' ? q.y - u(1.6) : q.y;
          const tw = ctx.measureText(n.text).width;
          if (claim(q.x, ty, tw + u(0.6), u(nfs) * 1.2)) ctx.fillText(n.text, q.x, ty);
        }
        ctx.restore();
      }
    }
    return { k, ox, oy };
  },

  /* ==================== টেবিল ==================== */

  /**
   * সাধারণ টেবিল আঁকা
   * @param {Array<Array<string>>} rows   প্রথম সারি = শিরোনাম
   * @param {Array<number>} colW          কলামের প্রস্থ (মিমি)
   */
  table(ctx, x, y, colW, rows, opt) {
    const o = opt || {};
    const rowH = o.rowH || 6;
    const color = o.color || '#dc2626';
    const totalW = colW.reduce((s, v) => s + v, 0);
    let cy = y;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      let cx = x;
      const h = row._h || rowH;
      for (let c = 0; c < colW.length; c++) {
        const cell = row[c];
        if (cell === null || cell === undefined) { cx += colW[c]; continue; }
        const span = (cell && cell.span) || 1;
        const w = colW.slice(c, c + span).reduce((s, v) => s + v, 0);
        const txt = (cell && cell.text != null) ? cell.text : cell;
        const rows2 = (cell && cell.rows) || 1;
        this._box(ctx, cx, cy, w, h * rows2, { color, lw: o.lw || 0.3 });
        this._fitText(ctx, txt, cx + w / 2, cy + h * rows2 / 2, w - 1.5, {
          size: (cell && cell.size) || o.size || 2.3,
          weight: (r === 0 || (cell && cell.bold)) ? '800' : '600',
          color: (cell && cell.color) || (r === 0 ? color : '#111827')
        });
        cx += w;
        c += span - 1;
      }
      cy += h;
    }
    return { w: totalW, h: cy - y };
  },

  /* ==================== পূর্ণ শিট ==================== */

  /**
   * @param {object} doc
   * @param {object} opts { dpi, pentagraph:{base,over}, onProgress }
   * @returns {Promise<HTMLCanvasElement>}
   */
  async render(doc, opts) {
    const o = opts || {};
    const dpi = o.dpi || this.DPI;
    this._k = dpi / 25.4;                       // ১ মিমি = কত পিক্সেল
    const u = this._u.bind(this);

    // বাংলা ফন্ট না এলে ক্যানভাসে বর্গ বসে — তাই অপেক্ষা করি
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }

    const c = document.createElement('canvas');
    c.width = Math.round(u(this.A4.w));
    c.height = Math.round(u(this.A4.h));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);

    const M = doc.meta || {};
    const isPenta = M.sheetType === 'pentagraph';

    /* ── বর্ডার ── */
    this._box(ctx, 5, 5, 200, 287, { color: '#000', lw: 0.5 });
    this._box(ctx, 8, 8, 194, 281, { color: '#000', lw: 0.35 });

    /* ── উত্তর তীর — ডিজাইন পর্দায় বসানো দিক অনুযায়ী ── */
    this.northArrow(ctx, 12, 12, 11, 44, (doc.meta && doc.meta.northDeg) || 0);

    /* ── শিরোনাম বাক্স ── */
    const tb = { x: 26, y: 12, w: 54, h: 30 };
    this._box(ctx, tb.x, tb.y, tb.w, tb.h, { color: '#d946ef', lw: 0.4 });
    const lines = [
      'জেলাঃ ' + (M.district || '—'),
      'উপজেলাঃ ' + (M.upazila || '—'),
      'মৌজাঃ ' + (M.mouza || '—'),
      'জে,এল, নং ' + (M.jl || '—'),
      'স্কেলঃ ' + CadCore.bn(M.scaleInch || 120) + '" = ১ মাইল'
    ];
    lines.forEach((t, i) => {
      this._fitText(ctx, t, tb.x + tb.w / 2, tb.y + 4 + i * 5.6, tb.w - 3,
                    { size: 3.5, weight: '700', color: '#111827' });
    });

    /* ── শিটের ধরন ── */
    const kindBox = { x: 84, y: 12, w: 40, h: 8 };
    this._box(ctx, kindBox.x, kindBox.y, kindBox.w, kindBox.h, { color: '#d946ef', lw: 0.4 });
    this._box(ctx, kindBox.x + 6, kindBox.y + 1.4, kindBox.w - 12, kindBox.h - 2.8, { color: '#111827', lw: 0.3 });
    this._fitText(ctx, isPenta ? 'পেন্টাগ্রাফ' : 'ডিমার্কেশন',
                  kindBox.x + kindBox.w / 2, kindBox.y + kindBox.h / 2, kindBox.w - 14,
                  { size: 3.6, weight: '800', color: '#dc2626' });

    /* ── পরিমাপকারি ── */
    const sv = { x: 84, y: 20.5, w: 40, h: 21.5 };
    this._box(ctx, sv.x, sv.y, sv.w, sv.h, { color: '#d946ef', lw: 0.4 });
    const svLines = [
      { t: 'পরিমাপকারি', s: 3.0, w: '800' },
      { t: 'সার্ভেয়ার ' + (M.surveyorName || '—'), s: 2.6, w: '700' },
      { t: 'রেজিঃ ' + (M.surveyorReg || '—'), s: 2.1, w: '600' },
      { t: M.surveyorEdu || '', s: 2.0, w: '600' },
      { t: M.surveyorPhone ? 'মোবাঃ ' + M.surveyorPhone : '', s: 2.1, w: '600' }
    ].filter(l => l.t);
    svLines.forEach((l, i) => {
      this._fitText(ctx, l.t, sv.x + sv.w / 2, sv.y + 3.2 + i * 4.0, sv.w - 3,
                    { size: l.s, weight: l.w, color: '#111827' });
    });

    /* ── প্রতিষ্ঠান ── */
    const fb = { x: 128, y: 12, w: 68, h: 24 };
    this._box(ctx, fb.x, fb.y, fb.w, fb.h, { color: '#dc2626', lw: 0.4 });
    this._fitText(ctx, M.firmName || 'ডিজিটাল সার্ভে', fb.x + fb.w / 2, fb.y + 5, fb.w - 4,
                  { size: 4.6, weight: '800', color: '#111827' });
    this._fitText(ctx, 'যোগাযোগঃ', fb.x + fb.w / 2, fb.y + 10.5, fb.w - 4,
                  { size: 3.0, weight: '700', color: '#111827' });
    const addr = String(M.firmAddress || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const addrLines = [];
    for (let i = 0; i < addr.length; i += 2) addrLines.push(addr.slice(i, i + 2).join(', '));
    addrLines.slice(0, 2).forEach((t, i) => {
      this._fitText(ctx, t, fb.x + fb.w / 2, fb.y + 14.5 + i * 3.6, fb.w - 4,
                    { size: 2.4, weight: '600', color: '#111827' });
    });
    if (M.firmPhone) {
      this._fitText(ctx, 'মোবাঃ ' + M.firmPhone, fb.x + fb.w / 2, fb.y + 21, fb.w - 4,
                    { size: 3.0, weight: '700', color: '#111827' });
    }

    /* ── রিপোর্ট নোট ── */
    const rn = { x: 110, y: 44, w: 86, h: 15 };
    if (M.reportNote || M.reportDate) {
      this._box(ctx, rn.x, rn.y, rn.w, rn.h, { color: '#dc2626', lw: 0.35 });
      const note = M.reportNote ||
        ((isPenta ? 'বি এস এবং সি এস' : 'বি এস') + ' জরিপ নকশা পর্যবেক্ষণ করে প্রস্তুতকৃত '
         + (isPenta ? 'পেন্টাগ্রাফ' : 'ডিমার্কেশন') + ' রিপোর্ট');
      const words = note.split(' ');
      const half = Math.ceil(words.length / 2);
      this._fitText(ctx, words.slice(0, half).join(' '), rn.x + rn.w / 2, rn.y + 4, rn.w - 4,
                    { size: 2.5, weight: '700' });
      this._fitText(ctx, words.slice(half).join(' '), rn.x + rn.w / 2, rn.y + 7.8, rn.w - 4,
                    { size: 2.5, weight: '700' });
      this._line(ctx, rn.x + 12, rn.y + 9.6, rn.x + rn.w - 12, rn.y + 9.6, '#111827', 0.2);
      if (M.reportDate) {
        this._fitText(ctx, 'রিপোর্ট প্রদানের তারিখঃ ' + M.reportDate,
                      rn.x + rn.w / 2, rn.y + 12.2, rn.w - 4, { size: 2.4, weight: '700' });
      }
    }

    /* ── কর্ণ স্কেল ── */
    let planTop = 62;
    if (o.showScaleBar !== false) {
      this.diagonalScale(ctx, 27, 46, 52, 20, M);
      planTop = 70;
    }

    /* ── পেন্টাগ্রাফ / সারাংশ টেবিল ── */
    let tableBox = null;
    if (isPenta && o.pentagraph) {
      tableBox = this._pentaTable(ctx, doc, o.pentagraph);
    } else if (o.summaryTable !== false) {
      tableBox = this._summaryTable(ctx, doc);
    }

    /* ── মূল নকশা ── */
    const planArea = {
      x: 12, y: planTop,
      w: 186,
      h: (tableBox ? tableBox.y : 238) - planTop - 3
    };
    this.drawPlan(ctx, doc, planArea, o.plan || {});

    /* ── সাংকেতিক চিহ্ন ── */
    this._legend(ctx, doc, 13, 252);

    /* ── পাদটীকা ── */
    if (M.footNote) {
      const fn = { x: 78, y: 254, w: 100, h: 14 };
      this._box(ctx, fn.x, fn.y, fn.w, fn.h, { color: '#dc2626', lw: 0.35 });
      const words = String(M.footNote).split(' ');
      const half = Math.ceil(words.length / 2);
      this._fitText(ctx, words.slice(0, half).join(' '), fn.x + fn.w / 2, fn.y + 4.5, fn.w - 4,
                    { size: 2.5, weight: '700' });
      this._fitText(ctx, words.slice(half).join(' '), fn.x + fn.w / 2, fn.y + 9.5, fn.w - 4,
                    { size: 2.5, weight: '700' });
    }

    return c;
  },

  /* ---------------- সাংকেতিক চিহ্ন ---------------- */

  _legend(ctx, doc, x, y) {
    const used = doc.layers.filter(L => L.visible &&
      CadCore.activeFeatures(doc).some(f => f.layer === L.id));
    if (!used.length) return null;

    const w = 56, hdr = 7, rowH = 6.5;
    const h = hdr + rowH * used.length;
    const col = '#dc2626';

    this._box(ctx, x, y, w, hdr, { color: col, lw: 0.35 });
    this._fitText(ctx, 'সাংকেতিক চিহ্ন', x + w / 2, y + hdr / 2, w - 3,
                  { size: 3.2, weight: '800', color: '#111827' });

    used.forEach((L, i) => {
      const ry = y + hdr + i * rowH;
      this._box(ctx, x, ry, w * 0.55, rowH, { color: col, lw: 0.3 });
      this._box(ctx, x + w * 0.55, ry, w * 0.45, rowH, { color: col, lw: 0.3 });
      this._fitText(ctx, L.name, x + w * 0.275, ry + rowH / 2, w * 0.5,
                    { size: 2.4, weight: '700', color: '#111827' });
      // রঙের নমুনা রেখা
      const u = this._u.bind(this);
      ctx.save();
      ctx.strokeStyle = L.color;
      ctx.lineWidth = Math.max(2, u(0.55));
      ctx.beginPath();
      ctx.moveTo(u(x + w * 0.60), u(ry + rowH / 2));
      ctx.lineTo(u(x + w * 0.95), u(ry + rowH / 2));
      ctx.stroke();
      ctx.restore();
    });
    return { x, y, w, h };
  },

  /* ---------------- পেন্টাগ্রাফ টেবিল ---------------- */

  _pentaTable(ctx, doc, cfg) {
    const rows = CadOverlay.pentagraph(doc, cfg.base, cfg.over, cfg);
    if (!rows.length) return null;

    const baseL = CadCore.layer(doc, cfg.base) || CadCore.layerPreset(cfg.base);
    const overL = CadCore.layer(doc, cfg.over) || CadCore.layerPreset(cfg.over);
    const shortName = n => String(n).replace(/\s*লাইন$/, '').trim();

    const colW = [20, 26, 20, 28];
    const rowH = 6;
    // মোট উচ্চতা আগে হিসাব করে নিচ থেকে বসাই
    let n = 1;
    for (const r of rows) n += r.items.length + 1;             // + মোট সারি
    const height = n * rowH;
    const x = 196 - colW.reduce((s, v) => s + v, 0);
    const y = Math.max(120, 248 - height);

    let cy = y;
    // শিরোনাম
    this.table(ctx, x, cy, colW, [[
      shortName(baseL.name) + ' দাগ', 'সম্পদের পরিমান',
      shortName(overL.name) + ' দাগ', 'সম্পদের পরিমান'
    ]], { rowH, size: 2.3 });
    cy += rowH;

    for (const r of rows) {
      const span = r.items.length + 1;                          // + মোট
      // বাঁ দুই কলাম — পুরো দলটির জন্য একটি বড় ঘর
      this._box(ctx, x, cy, colW[0], rowH * span, { color: '#dc2626', lw: 0.3 });
      this._box(ctx, x + colW[0], cy, colW[1], rowH * span, { color: '#dc2626', lw: 0.3 });
      this._fitText(ctx, CadCore.bn(r.dag), x + colW[0] / 2, cy + rowH * span / 2, colW[0] - 2,
                    { size: 2.8, weight: '800', color: baseL.color });
      this._fitText(ctx, CadCore.satakText(r.satak * CadCore.SQFT_PER_SATAK),
                    x + colW[0] + colW[1] / 2, cy + rowH * span / 2, colW[1] - 2,
                    { size: 2.4, weight: '700', color: '#111827' });

      const rx = x + colW[0] + colW[1];
      r.items.forEach((it, i) => {
        const ry = cy + i * rowH;
        this._box(ctx, rx, ry, colW[2], rowH, { color: '#dc2626', lw: 0.3 });
        this._box(ctx, rx + colW[2], ry, colW[3], rowH, { color: '#dc2626', lw: 0.3 });
        this._fitText(ctx, CadCore.bn(it.dag), rx + colW[2] / 2, ry + rowH / 2, colW[2] - 2,
                      { size: 2.7, weight: '800', color: overL.color });
        this._fitText(ctx, CadOverlay.itemText(it), rx + colW[2] + colW[3] / 2, ry + rowH / 2, colW[3] - 1.5,
                      { size: it.partial ? 1.9 : 2.4, weight: '700', color: '#111827' });
      });

      const ty = cy + r.items.length * rowH;
      this._box(ctx, rx, ty, colW[2], rowH, { color: '#dc2626', lw: 0.3 });
      this._box(ctx, rx + colW[2], ty, colW[3], rowH, { color: '#dc2626', lw: 0.3 });
      this._fitText(ctx, 'মোট', rx + colW[2] / 2, ty + rowH / 2, colW[2] - 2,
                    { size: 2.6, weight: '800', color: '#1d4ed8' });
      this._fitText(ctx, CadCore.satakText(r.total * CadCore.SQFT_PER_SATAK),
                    rx + colW[2] + colW[3] / 2, ty + rowH / 2, colW[3] - 2,
                    { size: 2.4, weight: '800', color: '#1d4ed8' });

      cy += rowH * span;
    }
    return { x, y, w: colW.reduce((s, v) => s + v, 0), h: cy - y };
  },

  /* ---------------- সাধারণ সারাংশ টেবিল ---------------- */

  _summaryTable(ctx, doc) {
    const list = CadCore.activeFeatures(doc)
      .filter(f => f.closed && f.dag)
      .map(f => ({ dag: f.dag, m: CadCore.measure(doc, f), layer: f.layer }));
    if (!list.length || !(doc.ftPerPx > 0)) return null;

    const colW = [26, 34];
    const rowH = 6;
    const rows = [['দাগ নং', 'সম্পদের পরিমান']];
    for (const it of list.slice(0, 26)) {
      rows.push([CadCore.bn(it.dag), CadCore.satakText(it.m.sqft)]);
    }
    if (list.length > 1) {
      const total = list.reduce((s, it) => s + it.m.sqft, 0);
      rows.push([{ text: 'মোট', bold: true, color: '#1d4ed8' },
                 { text: CadCore.satakText(total), bold: true, color: '#1d4ed8' }]);
    }
    const w = colW.reduce((s, v) => s + v, 0);
    const h = rows.length * rowH;
    const x = 196 - w;
    const y = Math.max(120, 248 - h);
    this.table(ctx, x, y, colW, rows, { rowH, size: 2.4 });
    return { x, y, w, h };
  },

  /* ==================== রপ্তানি ==================== */

  /** শিট → PNG ডাউনলোড */
  async downloadPng(doc, opts) {
    const c = await this.render(doc, opts);
    return new Promise(res => {
      c.toBlob(b => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url;
        a.download = ((doc.meta.mouza || 'survey') + '-' +
          (doc.meta.sheetType === 'pentagraph' ? 'pentagraph' : 'demarcation') + '.png')
          .replace(/[^\w.\-]+/g, '_');
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        res(c);
      }, 'image/png');
    });
  },

  /** ছাপার জানালা — A4 তে ঠিকভাবে বসে */
  async print(doc, opts) {
    const c = await this.render(doc, Object.assign({ dpi: 300 }, opts || {}));
    const data = c.toDataURL('image/png');
    const w = window.open('', '_blank');
    if (!w) throw new Error('পপ-আপ আটকে গেছে — ব্রাউজারে অনুমতি দিন');
    w.document.write(
      '<!doctype html><html><head><meta charset="utf-8"><title>' +
      (doc.meta.mouza || 'Survey Sheet') +
      '</title><style>@page{size:A4 portrait;margin:0}' +
      'html,body{margin:0;padding:0;background:#fff}' +
      'img{width:210mm;height:297mm;display:block}</style></head><body>' +
      '<img src="' + data + '" onload="setTimeout(function(){window.print()},250)">' +
      '</body></html>'
    );
    w.document.close();
    return c;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CadSheet;
