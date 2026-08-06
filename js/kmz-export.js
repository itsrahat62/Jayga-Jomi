/* ==========================================================================
   kmz-export.js — মৌজা ম্যাপ → Google Earth (KMZ) এক্সপোর্ট
   --------------------------------------------------------------------------
   স্ক্যান করা মৌজা ম্যাপের ছবিকে স্যাটেলাইট ছবির সাথে মিলিয়ে (ক্যালিব্রেট করে)
   একটি KMZ ফাইল বানায়, যা Google Earth এ খোলা যায়।

   ★ কোনো বাইরের লাইব্রেরি লাগে না
     KMZ আসলে ZIP — এখানে হাতেই ZIP লেখা হয়েছে (stored, কম্প্রেশন ছাড়া,
     যা ZIP মানে সম্পূর্ণ বৈধ) সাথে নিজস্ব CRC32।

   ★ কেন gx:LatLonQuad, LatLonBox নয়
     <LatLonBox> অক্ষ-সমান্তরাল আয়তক্ষেত্র (উত্তর/দক্ষিণ/পূর্ব/পশ্চিম + ঘূর্ণন)।
     স্ক্যান করা পুরনো মৌজা ম্যাপ প্রায়ই বাঁকা ও তির্যক (skew) থাকে — বাক্সে
     মেলে না। <gx:LatLonQuad> এ চারটি কোণা আলাদা করে বসানো যায়, তাই
     তির্যক ছবিও সঠিক জায়গায় বসে।

   ★ নিয়ন্ত্রণ বিন্দু কয়টি
     ২টি → similarity (স্কেল + ঘূর্ণন + সরণ)। তির্যকতা ঠিক হয় না।
     ৩+   → affine (তির্যকতাও ধরে), least-squares — বিন্দু বেশি দিলে ত্রুটি কমে।
     প্রতিটি বিন্দুর অবশিষ্ট ত্রুটি মিটারে ফেরত দেওয়া হয়, যাতে ব্যবহারকারী
     নিজেই বুঝতে পারেন ক্যালিব্রেশন কতটা ভালো হয়েছে।

   DOM ছোঁয় না — Node এ টেস্ট করা যায় (tests/kmz-test.js)।
   ========================================================================== */

const KmzExport = {

  /* ==================== ১. CRC32 (ZIP এর বাধ্যতামূলক অংশ) ==================== */

  _crcTable: null,

  crcTable() {
    if (this._crcTable) return this._crcTable;
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    this._crcTable = t;
    return t;
  },

  /** বাইট-অ্যারের CRC32 (unsigned) */
  crc32(bytes) {
    const t = this.crcTable();
    let c = -1;
    for (let i = 0; i < bytes.length; i++) c = (c >>> 8) ^ t[(c ^ bytes[i]) & 0xFF];
    return (c ^ -1) >>> 0;
  },

  /* ==================== ২. ZIP লেখক (stored) ==================== */

  /** ছোট বাইট-বাফার লেখক — little endian */
  _writer() {
    const parts = [];
    let len = 0;
    return {
      u16(v) { parts.push(Uint8Array.from([v & 255, (v >>> 8) & 255])); len += 2; },
      u32(v) {
        parts.push(Uint8Array.from([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]));
        len += 4;
      },
      raw(b) { parts.push(b); len += b.length; },
      get length() { return len; },
      done() {
        const out = new Uint8Array(len);
        let o = 0;
        for (const p of parts) { out.set(p, o); o += p.length; }
        return out;
      }
    };
  },

  /** UTF-8 বাইটে রূপান্তর (ব্রাউজার ও Node দুটোতেই চলে) */
  utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    return Uint8Array.from(Buffer.from(str, 'utf8'));      // Node fallback
  },

  /**
   * ZIP আর্কাইভ বানায় — কম্প্রেশন ছাড়া (method 0 = stored)
   * @param {Array<{name:string, data:Uint8Array}>} files
   * @returns {Uint8Array}
   */
  zip(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('ZIP এ অন্তত একটি ফাইল লাগবে');
    }
    const out = this._writer();
    const central = [];

    for (const f of files) {
      if (!f || !f.name || !f.data) throw new Error('ফাইলের নাম ও ডেটা দুটোই লাগবে');
      const nameBytes = this.utf8(f.name);
      const crc = this.crc32(f.data);
      const offset = out.length;

      out.u32(0x04034b50);                       // local file header signature
      out.u16(20);                               // version needed
      out.u16(0x0800);                           // flag: নাম UTF-8
      out.u16(0);                                // method 0 = stored
      out.u16(0); out.u16(0);                    // সময় ও তারিখ (০ — নির্ধারক ফল)
      out.u32(crc);
      out.u32(f.data.length);                    // compressed size
      out.u32(f.data.length);                    // uncompressed size
      out.u16(nameBytes.length);
      out.u16(0);                                // extra field length
      out.raw(nameBytes);
      out.raw(f.data);

      central.push({ nameBytes, crc, size: f.data.length, offset });
    }

    const cdStart = out.length;
    for (const c of central) {
      out.u32(0x02014b50);                       // central directory signature
      out.u16(20); out.u16(20);                  // version made by / needed
      out.u16(0x0800); out.u16(0);               // flag / method
      out.u16(0); out.u16(0);                    // সময় / তারিখ
      out.u32(c.crc); out.u32(c.size); out.u32(c.size);
      out.u16(c.nameBytes.length);
      out.u16(0); out.u16(0);                    // extra / comment
      out.u16(0); out.u16(0); out.u32(0);        // disk / attrs
      out.u32(c.offset);
      out.raw(c.nameBytes);
    }
    const cdSize = out.length - cdStart;

    out.u32(0x06054b50);                         // end of central directory
    out.u16(0); out.u16(0);
    out.u16(central.length); out.u16(central.length);
    out.u32(cdSize); out.u32(cdStart);
    out.u16(0);                                  // comment length

    return out.done();
  },

  /* ==================== ৩. ভূ-স্থানাঙ্কের গণিত ==================== */

  /**
   * এক ডিগ্রি অক্ষাংশ কত মিটার (উপবৃত্তাকার পৃথিবীর সূত্র)
   * উৎস: WGS-84 এর প্রচলিত সন্নিকট সূত্র
   */
  metersPerDegLat(lat) {
    const r = lat * Math.PI / 180;
    return 111132.92 - 559.82 * Math.cos(2 * r) + 1.175 * Math.cos(4 * r)
           - 0.0023 * Math.cos(6 * r);
  },

  /** এক ডিগ্রি দ্রাঘিমাংশ কত মিটার (অক্ষাংশভেদে বদলায়) */
  metersPerDegLng(lat) {
    const r = lat * Math.PI / 180;
    return 111412.84 * Math.cos(r) - 93.5 * Math.cos(3 * r) + 0.118 * Math.cos(5 * r);
  },

  /**
   * নিয়ন্ত্রণ বিন্দু থেকে পিক্সেল → ভূ-স্থানাঙ্ক রূপান্তর বের করে
   *
   * মডেল (স্থানীয় সমতল মিটার কাঠামোয়, ছবির y নিচমুখী বলে উল্টানো):
   *     E = a·px + b·(−py) + c        (পূর্বমুখী মিটার)
   *     N = d·px + e·(−py) + f        (উত্তরমুখী মিটার)
   *
   * ২ বিন্দু  → similarity (a=e, b=−d) — স্কেল ও ঘূর্ণন, তির্যকতা নয়
   * ৩+ বিন্দু → পূর্ণ affine, least-squares
   *
   * @param {Array<{px:number, py:number, lat:number, lng:number}>} pts
   * @returns {{mode, toGeo, residuals, rmse, maxError, scale, rotationDeg}}
   */
  solveTransform(pts) {
    if (!Array.isArray(pts) || pts.length < 2) {
      throw new Error('অন্তত ২টি নিয়ন্ত্রণ বিন্দু দিতে হবে');
    }
    for (const p of pts) {
      if (!isFinite(p.px) || !isFinite(p.py) || !isFinite(p.lat) || !isFinite(p.lng)) {
        throw new Error('নিয়ন্ত্রণ বিন্দুতে অবৈধ সংখ্যা আছে');
      }
      if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
        throw new Error('অক্ষাংশ/দ্রাঘিমাংশ সীমার বাইরে');
      }
    }

    // স্থানীয় সমতল কাঠামোর কেন্দ্র
    const latRef = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lngRef = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    const mLat = this.metersPerDegLat(latRef);
    const mLng = this.metersPerDegLng(latRef);

    const toM = p => ({ E: (p.lng - lngRef) * mLng, N: (p.lat - latRef) * mLat });
    const P = pts.map(p => ({ x: p.px, y: -p.py, ...toM(p) }));   // y উল্টানো

    let a, b, c, d, e, f, mode;

    if (pts.length === 2) {
      /* --- similarity: দুই বিন্দুতে একক সমাধান --- */
      const dx = P[1].x - P[0].x, dy = P[1].y - P[0].y;
      const dE = P[1].E - P[0].E, dN = P[1].N - P[0].N;
      const den = dx * dx + dy * dy;
      if (den === 0) throw new Error('দুটি নিয়ন্ত্রণ বিন্দু একই পিক্সেলে বসেছে');
      // [E;N] = s·R·[x;y] + t   →  a=s·cosθ, b=−s·sinθ
      a = (dx * dE + dy * dN) / den;
      b = (dx * dN - dy * dE) / den;
      // similarity এ: E = a·x − b·y + c ; N = b·x + a·y + f
      c = P[0].E - (a * P[0].x - b * P[0].y);
      f = P[0].N - (b * P[0].x + a * P[0].y);
      d = b; e = a; b = -b;                    // সাধারণ affine রূপে বসানো
      mode = 'similarity';
    } else {
      /* --- affine: least-squares (৬ প্যারামিটার) --- */
      let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, n = P.length;
      let sxE = 0, syE = 0, sE = 0, sxN = 0, syN = 0, sN = 0;
      for (const p of P) {
        sxx += p.x * p.x; sxy += p.x * p.y; syy += p.y * p.y;
        sx += p.x; sy += p.y;
        sxE += p.x * p.E; syE += p.y * p.E; sE += p.E;
        sxN += p.x * p.N; syN += p.y * p.N; sN += p.N;
      }
      const M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
      const sol1 = this._solve3(M, [sxE, syE, sE]);
      const sol2 = this._solve3(M, [sxN, syN, sN]);
      if (!sol1 || !sol2) {
        throw new Error('নিয়ন্ত্রণ বিন্দুগুলো এক সরলরেখায় — ভিন্ন জায়গায় বসান');
      }
      [a, b, c] = sol1;
      [d, e, f] = sol2;
      mode = 'affine';
    }

    const toGeo = (px, py) => {
      const x = px, y = -py;
      const E = a * x + b * y + c;
      const N = d * x + e * y + f;
      return { lng: lngRef + E / mLng, lat: latRef + N / mLat };
    };

    // প্রতিটি নিয়ন্ত্রণ বিন্দুর অবশিষ্ট ত্রুটি (মিটারে)
    const residuals = pts.map((p, i) => {
      const g = toGeo(p.px, p.py);
      const dE = (g.lng - p.lng) * mLng;
      const dN = (g.lat - p.lat) * mLat;
      return { index: i, meters: Math.hypot(dE, dN) };
    });
    const rmse = Math.sqrt(residuals.reduce((s, r) => s + r.meters * r.meters, 0) / residuals.length);
    const maxError = residuals.reduce((m, r) => Math.max(m, r.meters), 0);

    // মানব-পাঠযোগ্য স্কেল ও ঘূর্ণন (a,d থেকে)
    const scale = Math.hypot(a, d);                       // মিটার প্রতি পিক্সেল
    const rotationDeg = Math.atan2(d, a) * 180 / Math.PI;

    return { mode, toGeo, residuals, rmse, maxError, scale, rotationDeg,
             params: { a, b, c, d, e, f }, latRef, lngRef };
  },

  /** ৩×৩ রৈখিক সমীকরণ (Gaussian elimination + আংশিক পিভটিং) */
  _solve3(M, v) {
    const A = [[M[0][0], M[0][1], M[0][2], v[0]],
               [M[1][0], M[1][1], M[1][2], v[1]],
               [M[2][0], M[2][1], M[2][2], v[2]]];
    for (let i = 0; i < 3; i++) {
      let piv = i;
      for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
      if (Math.abs(A[piv][i]) < 1e-12) return null;        // অনন্য সমাধান নেই
      [A[i], A[piv]] = [A[piv], A[i]];
      for (let r = 0; r < 3; r++) {
        if (r === i) continue;
        const k = A[r][i] / A[i][i];
        for (let cIdx = i; cIdx < 4; cIdx++) A[r][cIdx] -= k * A[i][cIdx];
      }
    }
    return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
  },

  /**
   * ছবির চার কোণার ভূ-স্থানাঙ্ক — gx:LatLonQuad এর ক্রমে
   * ক্রম: নিচ-বাম → নিচ-ডান → উপর-ডান → উপর-বাম (ঘড়ির উল্টো দিকে)
   */
  imageCorners(transform, width, height) {
    if (!(width > 0) || !(height > 0)) throw new Error('ছবির প্রস্থ ও উচ্চতা লাগবে');
    return [
      transform.toGeo(0, height),
      transform.toGeo(width, height),
      transform.toGeo(width, 0),
      transform.toGeo(0, 0)
    ];
  },

  /* ==================== ৪. KML ==================== */

  /** XML এ নিরাপদ করা */
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  },

  /**
   * GroundOverlay সহ KML
   * @param {string} name       ম্যাপের নাম
   * @param {string} imgName    ZIP এর ভেতরে ছবির নাম
   * @param {Array}  corners    imageCorners() এর ফল
   * @param {object} opts       { opacity: 0–1, description }
   */
  buildKml(name, imgName, corners, opts) {
    if (!Array.isArray(corners) || corners.length !== 4) {
      throw new Error('চারটি কোণা লাগবে');
    }
    const o = opts || {};
    const alpha = Math.round(Math.min(1, Math.max(0, o.opacity == null ? 0.78 : o.opacity)) * 255);
    const color = alpha.toString(16).padStart(2, '0') + 'ffffff';   // aabbggrr
    const coords = corners
      .map(p => `${p.lng.toFixed(10)},${p.lat.toFixed(10)},0`)
      .join(' ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${this.esc(name)}</name>
    <open>1</open>
    <GroundOverlay>
      <name>${this.esc(name)}</name>
      <description>${this.esc(o.description || 'Land Info — মৌজা ম্যাপ')}</description>
      <color>${color}</color>
      <drawOrder>1</drawOrder>
      <Icon><href>${this.esc(imgName)}</href></Icon>
      <gx:LatLonQuad><coordinates>${coords}</coordinates></gx:LatLonQuad>
    </GroundOverlay>
  </Document>
</kml>`;
  },

  /* ==================== ৫. পূর্ণ KMZ ==================== */

  /**
   * সব একসাথে — KMZ বাইট ফেরত দেয়
   * @param {object} o { imageBytes, imageName, width, height, points, name, opacity }
   * @returns {{ bytes:Uint8Array, transform, corners, kml }}
   */
  build(o) {
    if (!o || !o.imageBytes || !o.imageBytes.length) throw new Error('ম্যাপের ছবি লাগবে');
    const imgName = this.safeName(o.imageName || 'map.jpg');
    const t = this.solveTransform(o.points);
    const corners = this.imageCorners(t, o.width, o.height);
    const kml = this.buildKml(o.name || 'মৌজা ম্যাপ', imgName, corners,
                              { opacity: o.opacity, description: o.description });
    const bytes = this.zip([
      { name: 'doc.kml', data: this.utf8(kml) },
      { name: imgName, data: o.imageBytes }
    ]);
    return { bytes, transform: t, corners, kml };
  },

  /**
   * ZIP এর ভেতরে নিরাপদ ফাইলনাম
   * KML এর <href> এ বাংলা নাম দিলে কিছু রিডারে ভাঙে, তাই ASCII তে নামানো হয়।
   * বাংলা নাম পুরোটা বাদ পড়লে "map" ব্যবহার হয় — `RS-__.jpg` জাতীয়
   * কুৎসিত নাম যাতে না হয়।
   */
  safeName(n) {
    const base = String(n == null ? '' : n).split(/[\\/]/).pop() || '';
    // চেনা ছবির এক্সটেনশন থাকলে সেটাই, নইলে .jpg
    // (PDF থেকে রূপান্তরিত হলে ডেটা JPEG, তাই "x.pdf" → "x.jpg", "x.pdf.jpg" নয়)
    const ext = (base.match(/\.(jpe?g|png|gif|tiff?)$/i) || [])[0] || '.jpg';
    const stem = base
      .replace(/\.[A-Za-z0-9]{1,5}$/, '')    // যেকোনো এক্সটেনশন বাদ
      .replace(/[^A-Za-z0-9._-]+/g, '_')     // অ-ASCII ও ফাঁকা → এক আন্ডারস্কোর
      .replace(/_+/g, '_')                   // পরপর একাধিক → একটি
      .replace(/^[_.-]+|[_.-]+$/g, '');      // দুই প্রান্তের বিভাজক বাদ
    return (stem ? stem.slice(0, 60) : 'map') + ext.toLowerCase();
  },

  /** ক্যালিব্রেশন কতটা ভালো — ব্যবহারকারীকে বোঝানোর জন্য */
  quality(rmse) {
    if (!isFinite(rmse)) return { level: 'unknown', label: 'অজানা' };
    if (rmse < 2)  return { level: 'great', label: 'চমৎকার' };
    if (rmse < 8)  return { level: 'good',  label: 'ভালো' };
    if (rmse < 25) return { level: 'ok',    label: 'মোটামুটি' };
    return { level: 'bad', label: 'দুর্বল — বিন্দু আবার বসান' };
  }
};

/* Node এ টেস্টের জন্য */
if (typeof module !== 'undefined' && module.exports) module.exports = KmzExport;
