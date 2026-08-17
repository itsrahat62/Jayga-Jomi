/* ==========================================================================
   kmz-source.js — KMZ টুলে ম্যাপ আনার দুটি পথ
   --------------------------------------------------------------------------
   ১. PDF → ছবি   (আর্কাইভের ৫২% ফাইল PDF)
   ২. আর্কাইভ থেকে সরাসরি বাছাই (বিভাগ → জেলা → উপজেলা → জরিপ → ফাইল)

   ⚠️ Drive এর লিংক কোথাও বানানো বা দেখানো হয় না — ফাইল কেবল
      MouzaMap.fetchBytes() (প্রক্সি) দিয়ে আসে। এটি ইউজারের স্পষ্ট নির্দেশ।

   pdf.js CDN থেকে আসে, কিন্তু **কেবল PDF দিলে তবেই** — অন্য সময় ৩১২ KB
   অকারণে নামে না।
   ========================================================================== */

const KmzSource = {

  /* pdf.js — Chart.js ও Bootstrap Icons যে CDN থেকে আসে, সেখান থেকেই */
  PDFJS: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  PDFJS_WORKER: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',

  /**
   * PDF কত বড় করে আঁকা হবে — সীমাগুলো
   * (প্রতিযোগী ২৩৮৪×১৬৮৪ পয়েন্টের পাতা ২.২ গুণে ৫২৪৫×৩৭০৫ = ১৯.৪ MP এ আঁকে)
   */
  MAX_SIDE: 16000,
  MAX_PIXELS: 60e6,          // Ultra HD 60 Megapixels
  MAX_PIXELS_SMALL: 30e6,    // ফোন/ট্যাব
  TARGET_DPI: 600,           // 600 DPI Ultra HD Quality
  DEFAULT_SIDE: 6400,        // পুরনো নাম — বাইরে ব্যবহার হয়

  /**
   * ★ আগে সবসময় দীর্ঘতম বাহু ৫২০০px ধরা হতো। সমস্যা — স্ক্যান করা মৌজা
   * নকশার PDF এ পাতার মাপ অনেক সময় **ছবির পিক্সেল সংখ্যাই** পয়েন্ট হিসেবে
   * লেখা থাকে (ছবি→PDF রূপান্তরে যা সবচেয়ে সাধারণ)। তখন ১৬,০০০px এর
   * স্ক্যান ৫২০০px এ নেমে আসত — দুই তৃতীয়াংশ রেজুলেশন হারিয়ে যেত।
   *
   * এখন দীর্ঘতম বাহু নয়, **মোট পিক্সেলের বাজেট** ধরা হয় — লম্বা-সরু
   * পাতাতেও পুরো বাজেট কাজে লাগে।
   */
  pixelBudget() {
    const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 8;
    const coarse = typeof matchMedia === 'function'
      && matchMedia('(pointer: coarse)').matches;
    return (mem <= 4 || coarse) ? this.MAX_PIXELS_SMALL : this.MAX_PIXELS;
  },

  /**
   * পাতার মাপ (পয়েন্টে) দেখে কত গুণে আঁকব
   * তিন সীমার মধ্যে যেটি সবচেয়ে ছোট: DPI লক্ষ্য · বাহুর সীমা · পিক্সেল বাজেট
   */
  renderScaleFor(wPt, hPt, budget) {
    const w = Math.max(1, wPt), h = Math.max(1, hPt);
    const cap = budget > 0 ? budget : this.MAX_PIXELS;
    const isImagePdf = Math.max(w, h) >= 1800; // PDF page points match original image pixels
    const maxScale = Math.min(this.TARGET_DPI / 72, this.MAX_SIDE / Math.max(w, h));
    const budgetScale = Math.sqrt(cap / (w * h));
    const calculated = Math.min(maxScale, budgetScale);
    return isImagePdf ? Math.max(1.0, calculated) : Math.max(0.05, calculated);
  },

  _pdfPromise: null,

  /** pdf.js একবারই নামে, তারপর ক্যাশে থাকে */
  loadPdfJs() {
    if (this._pdfPromise) return this._pdfPromise;
    this._pdfPromise = new Promise((resolve, reject) => {
      if (typeof pdfjsLib !== 'undefined') { resolve(pdfjsLib); return; }
      const s = document.createElement('script');
      s.src = this.PDFJS;
      s.onload = () => {
        if (typeof pdfjsLib === 'undefined') {
          reject(new Error('pdf.js লোড হলো কিন্তু চালু হয়নি'));
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = this.PDFJS_WORKER;
        resolve(pdfjsLib);
      };
      s.onerror = () => {
        this._pdfPromise = null;
        reject(new Error('pdf.js নামানো গেল না — ইন্টারনেট সংযোগ দেখুন'));
      };
      document.head.appendChild(s);
    });
    return this._pdfPromise;
  },

  /**
   * PDF এর একটি পাতা ছবিতে রূপান্তর
   * @param {Uint8Array} bytes  PDF এর বাইট
   * @param {object} opt { page = 1, targetSide, onStage }
   * @returns {Promise<{img, bytes, width, height, pageCount, name}>}
   */
  async pdfToImage(bytes, opt) {
    const o = opt || {};
    const stage = (p, m) => { if (o.onStage) o.onStage(p, m); };

    stage(5, 'pdf.js প্রস্তুত হচ্ছে…');
    const lib = await this.loadPdfJs();

    stage(25, 'PDF পড়া হচ্ছে…');
    // pdf.js মূল বাফারটি নিজের কাজে নিয়ে নেয় (detach), তাই কপি পাঠাই
    const doc = await lib.getDocument({ data: bytes.slice() }).promise;
    const pageCount = doc.numPages;
    const pageNo = Math.max(1, Math.min(pageCount, o.page || 1));
    const page = await doc.getPage(pageNo);

    // কত বড় করে আঁকা হবে — পিক্সেলের বাজেট ধরে
    const base = page.getViewport({ scale: 1 });
    const scale = o.targetSide
      ? Math.min(this.MAX_SIDE, Math.max(600, o.targetSide)) / Math.max(base.width, base.height)
      : this.renderScaleFor(base.width, base.height, o.budget || this.pixelBudget());
    const vp = page.getViewport({ scale });

    stage(50, 'পাতা আঁকা হচ্ছে…');
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d');
    // মৌজা ম্যাপ সাদা কাগজে — স্বচ্ছ পটভূমি সাদা করে দিই
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    // ★ ছবি হিসেবে ক্যানভাসটাই ফেরত যায় — আগে এখানে JPEG (৯২%) এ ঘুরিয়ে
    //   আনা হতো, তাতে হাতে আঁকা সূক্ষ্ম রেখায় কম্প্রেশনের দাগ পড়ত আর
    //   স্মৃতিও দ্বিগুণ লাগত। JPEG বাইট কেবল KMZ রপ্তানিতে দরকার — মাপের
    //   টুল `needBytes: false` দিয়ে সেটা এড়ায়।
    let outBytes = null;
    if (o.needBytes !== false) {
      stage(80, 'ছবিতে রূপান্তর হচ্ছে…');
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      outBytes = new Uint8Array(await blob.arrayBuffer());
    }

    stage(100, 'প্রস্তুত');
    return {
      img: canvas, canvas, bytes: outBytes,
      width: canvas.width, height: canvas.height,
      pageCount, page: pageNo,
      // পাতার মাপ — স্কেল বিশ্বাসযোগ্য কি না যাচাই করতে লাগে
      pagePt: { w: base.width, h: base.height },
      pageIn: { w: base.width / 72, h: base.height / 72 },
      // ★ রেন্ডার স্কেল ফেরত দেওয়া জরুরি — এটি থেকেই PDF এর DPI বেরোয়
      //   (MapMeasure.dpiForPdf: DPI = ৭২ × স্কেল)
      pdfScale: scale,
      // ★ পাতাটি ধরে রাখি — জুম করলে ওই অংশটুকু আরেকবার বেশি
      //   রেজুলেশনে আঁকা যায় (renderRegion)
      doc, pdfPage: page
    };
  },

  /** Blob → <img> (লোড হওয়া পর্যন্ত অপেক্ষা করে) */
  /**
   * ★ জুম করলে ছবি ফেটে যায় — তার সমাধান
   *
   * পুরো নকশা একবারে যত বড় আঁকা সম্ভব, তার সীমা আছে (স্মৃতি)। কিন্তু
   * ব্যবহারকারী একসাথে পুরো নকশা দেখেন না — জুম করলে একটুকু দেখেন।
   * তাই শুধু দৃশ্যমান অংশটুকু PDF থেকে নতুন করে আঁকি — তখন যত জুমই
   * করুন, রেখা ও দাগ নম্বর বেক্তরের মতোই পরিষ্কার থাকে।
   *
   * @param {object} page      pdf.js এর পাতা
   * @param {number} baseScale মূল ছবি যে স্কেলে আঁকা হয়েছিল
   * @param {object} rect      মূল ছবির পিক্সেলে {x, y, w, h}
   * @param {number} zoom      কত গুণ বেশি আঁকব
   */
  async renderRegion(page, baseScale, rect, zoom) {
    if (!page || !(baseScale > 0)) throw new Error('পাতা নেই');
    const z = Math.max(1, Math.min(8, Number(zoom) || 1));
    const w = Math.max(1, Math.round(rect.w * z));
    const h = Math.max(1, Math.round(rect.h * z));
    // স্মৃতির রাশ টানা — দৃশ্যমান এলাকাই তো, বড় হওয়ার কথা নয়
    if (w * h > 24e6) throw new Error('এলাকাটি খুব বড়');
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const vp = page.getViewport({ scale: baseScale * z });
    // পুরো পাতার ভেতর থেকে শুধু rect অংশটুকু ক্যানভাসে আনা
    ctx.translate(-rect.x * z, -rect.y * z);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas, x: rect.x, y: rect.y, w: rect.w, h: rect.h, zoom: z };
  },

  blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ছবিটি পড়া গেল না')); };
      img.src = url;
    });
  },

  /**
   * যেকোনো ফাইলের বাইট → ছবি (ধরন বুঝে PDF বা সরাসরি ছবি)
   * @returns {Promise<{img, bytes, width, height, wasPdf, pageCount}>}
   */
  async toImage(bytes, mimeType, opt) {
    const mime = String(mimeType || '');
    if (mime === 'application/pdf' || this.looksLikePdf(bytes)) {
      const r = await this.pdfToImage(bytes, opt);
      return { ...r, wasPdf: true };
    }
    if (mime === 'image/tiff' || this.looksLikeTiff(bytes)) {
      throw new Error('TIFF ছবি ব্রাউজারে খোলা যায় না। JPG বা PDF ফাইল দিন।');
    }
    const blob = new Blob([bytes], { type: mime || 'image/jpeg' });
    const img = await this.blobToImage(blob);
    return { img, bytes, width: img.width, height: img.height, wasPdf: false, pageCount: 1 };
  },

  /** ফাইলের প্রথম বাইট দেখে ধরন চেনা (mimeType ভুল হতে পারে) */
  looksLikePdf(b) {
    return b && b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
  },
  looksLikeTiff(b) {
    if (!b || b.length < 4) return false;
    return (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00) ||
           (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A);
  },

  /* ==================== আর্কাইভ থেকে বাছাই ==================== */

  cache: { tree: null, files: {} },

  async tree() {
    if (!this.cache.tree) this.cache.tree = await MouzaMap.loadTree();
    return this.cache.tree;
  },

  async filesOf(surveyId) {
    if (!this.cache.files[surveyId]) {
      this.cache.files[surveyId] = await MouzaMap.loadFiles(surveyId);
    }
    return this.cache.files[surveyId];
  },

  /** আর্কাইভের একটি ফাইল নামিয়ে ছবিতে রূপান্তর */
  async fromArchive(file, onStage, opt) {
    const got = await MouzaMap.fetchBytes(file, onStage);
    const bytes = new Uint8Array(await got.blob.arrayBuffer());
    if (onStage) onStage(96, 'ছবি প্রস্তুত হচ্ছে…');
    const r = await this.toImage(bytes, got.mimeType, {
      ...(opt || {}),
      onStage: (p, m) => { if (onStage) onStage(96 + p * 0.04, m); }
    });
    return { ...r, name: got.fileName };
  }
};

/* ==========================================================================
   KmzGeo — জায়গার নাম দিয়ে খোঁজা ও নিজের অবস্থান
   --------------------------------------------------------------------------
   ⚠️ কোনো API key নেই। দুটি ফ্রি সেবা ব্যবহার করা হয় (৩০ জুলাই ২০২৬ এ
      যাচাই করা — দুটোই `Access-Control-Allow-Origin: *` দেয়):
        ১. Nominatim (OpenStreetMap) — `countrycodes=bd` দিয়ে বাংলাদেশে সীমিত
        ২. Photon (Komoot) — Nominatim ব্যর্থ হলে

   দুটোরই শর্ত: **সেকেন্ডে একটির বেশি অনুরোধ নয়**। তাই টাইপ করার সাথে সাথে
   খোঁজা হয় না — ব্যবহারকারী বোতাম চাপলে বা Enter দিলে তবেই।
   ========================================================================== */

const KmzGeo = {

  NOMINATIM: 'https://nominatim.openstreetmap.org/search',
  PHOTON: 'https://photon.komoot.io/api/',

  /* বাংলাদেশের সীমা — ফল এই ঘেরের ভেতরে রাখতে */
  BD: { minLat: 20.5, maxLat: 26.7, minLng: 88.0, maxLng: 92.7 },

  _last: 0,

  /** শর্ত মানতে দুই অনুরোধের মাঝে অন্তত ১ সেকেন্ড */
  async throttle() {
    const gap = Date.now() - this._last;
    if (gap < 1100) await new Promise(r => setTimeout(r, 1100 - gap));
    this._last = Date.now();
  },

  inBd(lat, lng) {
    const b = this.BD;
    return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
  },

  /**
   * লেখাটি কি "অক্ষাংশ, দ্রাঘিমাংশ"? হলে সরাসরি সেটিই ফেরত দেয় —
   * অকারণে সার্ভারে অনুরোধ যায় না।
   */
  parseLatLng(text) {
    const t = (typeof toEn === 'function' ? toEn(String(text)) : String(text))
      .replace(/[^\d.,\-\s]/g, ' ').trim();
    const m = t.split(/[,\s]+/).filter(Boolean).map(Number);
    if (m.length < 2 || !isFinite(m[0]) || !isFinite(m[1])) return null;
    const [lat, lng] = m;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng, name: lat.toFixed(6) + ', ' + lng.toFixed(6), exact: true };
  },

  /**
   * নাম দিয়ে জায়গা খোঁজা
   * @returns {Promise<Array<{lat, lng, name, kind}>>}
   */
  async search(query) {
    const q = String(query || '').trim();
    if (q.length < 2) throw new Error('অন্তত দুটি অক্ষর লিখুন');

    const direct = this.parseLatLng(q);
    if (direct) return [direct];

    await this.throttle();
    try {
      const r = await this._nominatim(q);
      if (r.length) return r;
    } catch (e) { /* ফলব্যাকে যাই */ }

    await this.throttle();
    return await this._photon(q);
  },

  async _nominatim(q) {
    const b = this.BD;
    const url = this.NOMINATIM + '?' + new URLSearchParams({
      q, format: 'jsonv2', countrycodes: 'bd', limit: '8',
      'accept-language': 'bn',
      viewbox: [b.minLng, b.maxLat, b.maxLng, b.minLat].join(','),
      bounded: '1'
    });
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Nominatim ' + res.status);
    const d = await res.json();
    return d.map(x => ({
      lat: Number(x.lat), lng: Number(x.lon),
      name: x.display_name || x.name || '',
      kind: x.type || x.category || ''
    })).filter(x => isFinite(x.lat) && isFinite(x.lng));
  },

  async _photon(q) {
    const url = this.PHOTON + '?' + new URLSearchParams({
      q, limit: '8', lang: 'default', lat: '23.8', lon: '90.4'
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error('Photon ' + res.status);
    const d = await res.json();
    return (d.features || []).map(f => {
      const p = f.properties || {}, c = (f.geometry || {}).coordinates || [];
      return {
        lat: Number(c[1]), lng: Number(c[0]),
        name: [p.name, p.district, p.county, p.state, p.country].filter(Boolean).join(', '),
        kind: p.osm_value || p.type || ''
      };
    }).filter(x => isFinite(x.lat) && isFinite(x.lng) && this.inBd(x.lat, x.lng));
  },

  /**
   * ব্যবহারকারীর নিজের অবস্থান
   * ব্রাউজার অনুমতি চাইবে। HTTPS (বা localhost) ছাড়া কাজ করে না।
   */
  myLocation(opts) {
    const o = opts || {};
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('এই ব্রাউজারে অবস্থান জানার সুবিধা নেই।'));
        return;
      }
      if (!window.isSecureContext && location.protocol !== 'file:') {
        reject(new Error('অবস্থান জানতে হলে সাইটটি https দিয়ে খুলতে হবে।'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
        err => {
          const msg = {
            1: 'অবস্থান জানার অনুমতি দেওয়া হয়নি। ব্রাউজারের ঠিকানা-বারের পাশে '
               + 'তালা আইকনে গিয়ে Location অনুমতি দিন।',
            2: 'অবস্থান পাওয়া যাচ্ছে না — GPS বা নেটওয়ার্ক সংযোগ দেখুন।',
            3: 'অবস্থান জানতে বেশি সময় লাগছে। খোলা জায়গায় গিয়ে আবার চেষ্টা করুন।'
          }[err && err.code] || 'অবস্থান জানা গেল না।';
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: o.timeout || 15000, maximumAge: 60000 }
      );
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = KmzSource;
  module.exports.KmzSource = KmzSource;
  module.exports.KmzGeo = KmzGeo;
}
