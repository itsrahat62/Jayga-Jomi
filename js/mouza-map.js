/* ==========================================================================
   mouza-map.js — সারাদেশের মৌজা ম্যাপ আর্কাইভ
   --------------------------------------------------------------------------
   ইউজারের নিজের সংগ্রহ — ১,৯৪,৩১৭টি ম্যাপ ফাইল, Google Drive এ রাখা।
   ইনডেক্স তৈরি ও যাচাইয়ের বিবরণ: data/mouza-map/README.md

   ★ দুই স্তরের ইনডেক্স (কেন এভাবে)
     tree.json         ০.১৪ MB — বিভাগ/জেলা/উপজেলা/জরিপ, ফাইল ছাড়া
     files/<id>.json   ১,০১২টি — যে জরিপ-ফোল্ডার খোলা হবে কেবল তারটাই আসে
     পুরো ইনডেক্স ৪৪ MB; একসাথে টানলে মোবাইলে অচল হতো।

   ★ ফাইল আনার একমাত্র পথ Apps Script প্রক্সি
     Drive ফাইলগুলো পাবলিক নয় (uc?export=view → ৪০৩, /preview → ৪০১)।
     প্রক্সিতে CORS `*`, তাই ব্রাউজার থেকে সরাসরি ডাকা যায় এবং বাইট
     base64 এ আসে — ফলে ক্যানভাসেও বসানো যাবে।

   ★ ২১৭টি ফাইল ৩৫ MB এর বড় (সবচেয়ে বড় ৭১৯.৮ MB) — প্রক্সির সীমা ছাড়ায়,
     ইনডেক্সে `tooBig: true` চিহ্নিত — টুলে এগুলোর Download বোতাম নিষ্ক্রিয় থাকে।

   DOM ছোঁয় না — Node এ টেস্ট করা যায়।
   ========================================================================== */

const MouzaMap = {

  /* ---------------- কনফিগ — হোস্টিং বদলালে কেবল এখানেই বদলাবে ---------------- */

  /** ইনডেক্সের ভিত্তি পথ (আপেক্ষিক রাখলে যেখানেই হোস্ট হোক চলবে) */
  BASE: 'data/mouza-map/',

  /** ফাইল আনার প্রক্সি — ronedata/map এর Apps Script */
  PROXY: 'https://script.google.com/macros/s/AKfycbzlLhCx-_sL_TnV_wBOPicAYcwc'
       + 'qg3jTgawC_eysmTzVkvKZ6jl69h5I0JK3csRaL0j/exec',

  /** প্রক্সির রেসপন্স সীমা — এর বড় ফাইল এই টুল থেকে নামানো যায় না */
  PROXY_LIMIT: 35 * 1024 * 1024,

  cache: { tree: null, files: {} },

  /* ---------------- পিওর হেল্পার ---------------- */

  /** বাইটকে পড়ার মতো বাংলা লেখায় */
  formatSize(bytes) {
    const b = Number(bytes) || 0;
    const bn = x => (typeof toBn === 'function' ? toBn(x) : String(x));
    if (b >= 1073741824) return bn((b / 1073741824).toFixed(2)) + ' GB';
    if (b >= 1048576) return bn((b / 1048576).toFixed(1)) + ' MB';
    if (b >= 1024) return bn(Math.round(b / 1024)) + ' KB';
    return bn(b) + ' বাইট';
  },

  /** ফাইলটি প্রক্সিতে আনা যাবে কি না */
  canProxy(file) {
    if (!file) return false;
    if (file.tooBig) return false;
    return (Number(file.size) || 0) <= this.PROXY_LIMIT;
  },

  /** mimeType থেকে আইকন ও ধরনের নাম */
  fileKind(mime) {
    const m = String(mime || '');
    if (m === 'application/pdf') return { icon: 'bi-file-earmark-pdf', label: 'PDF' };
    if (m === 'image/tiff') return { icon: 'bi-file-earmark-image', label: 'TIFF' };
    if (m.startsWith('image/')) return { icon: 'bi-file-earmark-image', label: 'ছবি' };
    if (m.startsWith('text/')) return { icon: 'bi-file-earmark-text', label: 'টেক্সট' };
    return { icon: 'bi-file-earmark', label: 'অন্যান্য' };
  },

  /** ব্রাউজারে ছবি হিসেবে ক্যানভাসে বসানো যাবে কি (TIFF যাবে না) */
  canRenderInBrowser(mime) {
    return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(String(mime || ''));
  },

  /**
   * ফাইল আনার একমাত্র ঠিকানা — প্রক্সি।
   *
   * ⚠️ Drive এর লিংক বানানো বা দেখানোর কোনো ফাংশন এখানে রাখা হয়নি (ইউজারের
   *    নির্দেশ: "Drive এর link সবাইকে দেখানো যাবে না")। ইনডেক্সের JSON থেকেও
   *    `url` ফিল্ড মুছে ফেলা হয়েছে। নতুন কোড লেখার সময় Drive লিংক তৈরি করা
   *    যাবে না — ব্যবহারকারী কেবল প্রক্সির মধ্য দিয়েই ফাইল পাবেন।
   */
  proxyUrl(fileId) {
    return this.PROXY + '?action=download&fileId=' + encodeURIComponent(fileId);
  },

  /**
   * ট্রি থেকে জায়গা খোঁজে — বিভাগ/জেলা/উপজেলার নাম মিলিয়ে।
   * ১,৯৪,৩১৭ ফাইলের নাম একসাথে খোঁজা সম্ভব নয় (৪৪ MB লাগত), তাই
   * জায়গা ধরে খোঁজা হয়; ফোল্ডার খোলার পর ফাইলের নাম ছেঁকে দেখা যায়।
   * @returns {Array<{division, district, upazila, surveys, total}>}
   */
  searchPlaces(tree, query, limit = 40) {
    const q = String(query || '').trim().toLowerCase();
    if (!tree || q.length < 2) return [];
    const out = [];
    for (const dv of tree.divisions || []) {
      for (const dt of dv.districts || []) {
        for (const up of dt.upazilas || []) {
          const hay = (dv.name + ' ' + dt.name + ' ' + up.name).toLowerCase();
          if (hay.indexOf(q) === -1) continue;
          out.push({
            division: dv, district: dt, upazila: up,
            surveys: up.surveys || [],
            total: (up.surveys || []).reduce((a, s) => a + (s.count || 0), 0)
          });
          if (out.length >= limit) return out;
        }
      }
    }
    return out;
  },

  /** ফোল্ডারের ফাইল তালিকা ছাঁকে (নাম বা উপ-পথ মিলিয়ে) */
  filterFiles(files, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return files || [];
    return (files || []).filter(f =>
      String(f.name || '').toLowerCase().indexOf(q) !== -1 ||
      String(f.subPath || '').toLowerCase().indexOf(q) !== -1);
  },

  /** ট্রির সারসংক্ষেপ — কয়টি বিভাগ/জেলা/উপজেলা/ফাইল */
  summary(tree) {
    let dt = 0, up = 0, sv = 0, files = 0;
    for (const d of (tree && tree.divisions) || []) {
      dt += (d.districts || []).length;
      for (const t of d.districts || []) {
        up += (t.upazilas || []).length;
        for (const u of t.upazilas || []) {
          sv += (u.surveys || []).length;
          files += (u.surveys || []).reduce((a, s) => a + (s.count || 0), 0);
        }
      }
    }
    return { divisions: ((tree && tree.divisions) || []).length,
             districts: dt, upazilas: up, surveys: sv, files };
  },

  /* ---------------- নেটওয়ার্ক ---------------- */

  async loadTree() {
    if (this.cache.tree) return this.cache.tree;
    const res = await fetch(this.BASE + 'tree.json');
    if (!res.ok) throw new Error('tree.json আনা যায়নি (' + res.status + ')');
    this.cache.tree = await res.json();
    return this.cache.tree;
  },

  async loadFiles(surveyId) {
    if (this.cache.files[surveyId]) return this.cache.files[surveyId];
    const res = await fetch(this.BASE + 'files/' + surveyId + '.json');
    if (!res.ok) throw new Error('ফাইল তালিকা আনা যায়নি (' + res.status + ')');
    const list = await res.json();
    this.cache.files[surveyId] = list;
    return list;
  },

  /**
   * প্রক্সি দিয়ে ফাইলের বাইট আনে।
   * onStage(পার্সেন্ট, বার্তা) দিয়ে অগ্রগতি জানায় — প্রক্সি একবারেই পুরো
   * JSON পাঠায়, তাই সত্যিকারের বাইট-প্রগ্রেস পাওয়া যায় না; ধাপ জানানো হয়।
   * @returns {Promise<{blob:Blob, fileName:string, mimeType:string}>}
   */
  async fetchBytes(file, onStage) {
    const stage = (p, m) => { if (onStage) onStage(p, m); };
    if (!this.canProxy(file)) {
      throw new Error('ফাইলটি ' + this.formatSize(this.PROXY_LIMIT)
        + ' এর চেয়ে বড়, তাই এখান থেকে নামানো যাবে না।');
    }

    stage(5, 'সার্ভারে অনুরোধ পাঠানো হচ্ছে…');
    const res = await fetch(this.proxyUrl(file.id));
    if (!res.ok) throw new Error('প্রক্সি ব্যর্থ (' + res.status + ')');

    stage(25, 'সার্ভার থেকে ফাইল আসছে…');
    const json = await res.json();
    if (!json.success || !json.data || !json.data.base64) {
      throw new Error(json.error || 'প্রক্সি থেকে সঠিক উত্তর আসেনি');
    }

    stage(60, 'ফাইল ডিকোড হচ্ছে…');
    const bin = atob(json.data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    stage(95, 'প্রস্তুত হচ্ছে…');
    return {
      blob: new Blob([bytes], { type: json.data.mimeType || 'application/octet-stream' }),
      fileName: json.data.fileName || file.name,
      mimeType: json.data.mimeType || file.mimeType
    };
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = MouzaMap;
