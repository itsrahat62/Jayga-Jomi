/* ==========================================================================
   mouza-multi-source.js — মৌজা নকশা কোথা থেকে আসবে (একাধিক উৎস)
   --------------------------------------------------------------------------
   আগে নকশা আসত কেবল একটিমাত্র জায়গা থেকে — নিজস্ব আর্কাইভ। কিন্তু
   বাস্তবে নকশা নানা জায়গায় থাকে: সরকারি পোর্টাল, নিজের গুগল ড্রাইভ,
   অফিসের সার্ভার, বা কারো পাঠানো লিংক। তাই উৎসগুলো এক তালিকায় আনা হয়েছে,
   আর ব্যবহারকারী নিজেও নতুন উৎস যোগ করতে পারেন।

   ★ কোনটা সরাসরি আনা যায়, কোনটা যায় না — খোলাখুলি
     ব্রাউজার ভিন্ন ডোমেইন থেকে ফাইল আনতে দেয় না (CORS), আর সরকারি
     পোর্টালে লগইন/ক্যাপচা থাকে। তাই:
       · **আর্কাইভ**  — নিজস্ব প্রক্সি আছে, সরাসরি আসে
       · **সরাসরি লিংক / ড্রাইভ** — চেষ্টা করা হয়; না এলে কারণ বলে দেওয়া হয়
       · **সরকারি পোর্টাল** — নতুন ট্যাবে খোলে, সেখান থেকে নামিয়ে আপলোড
     ভুয়া প্রতিশ্রুতি না দিয়ে কোনটা কীভাবে কাজ করে তা বলে দেওয়াই ভালো।
   ========================================================================== */

const MouzaMultiSource = {

  STORE_KEY: 'landinfo.mouzaSources.v1',

  /* ==================== ১. উৎসের তালিকা ==================== */

  /**
   * kind:
   *   archive — গাছ-সূচি + প্রক্সি (নিজস্ব সংগ্রহ)
   *   link    — সরাসরি URL বা গুগল ড্রাইভ লিংক
   *   portal  — বাইরের সাইট, নতুন ট্যাবে খোলে
   *   upload  — কম্পিউটার/ফোন থেকে ফাইল
   */
  BUILTIN: [
    {
      id: 'archive',
      kind: 'archive',
      name: 'নিজস্ব আর্কাইভ',
      note: 'সারাদেশের ১,৯৪,৩১৭টি মৌজা নকশা — বিভাগ → জেলা → উপজেলা → জরিপ ধরে খুঁজুন',
      icon: 'bi-collection',
      color: '#4338ca',
      direct: true
    },
    {
      id: 'upload',
      kind: 'upload',
      name: 'কম্পিউটার / ফোন থেকে',
      note: 'নিজের কাছে থাকা PDF, JPG বা PNG ফাইল',
      icon: 'bi-upload',
      color: '#15803d',
      direct: true
    },
    {
      id: 'link',
      kind: 'link',
      name: 'লিংক বা গুগল ড্রাইভ',
      note: 'নকশার সরাসরি লিংক, ড্রাইভের শেয়ার লিংক, বা অফিসের সার্ভারের ঠিকানা',
      icon: 'bi-link-45deg',
      color: '#0369a1',
      direct: true
    },
    {
      id: 'eporcha',
      kind: 'portal',
      name: 'ই-পর্চা (সরকারি)',
      note: 'ভূমি মন্ত্রণালয়ের মৌজা ম্যাপ সেবা — সেখান থেকে নামিয়ে এখানে আপলোড করুন',
      icon: 'bi-bank',
      color: '#b45309',
      url: 'https://eporcha.gov.bd/',
      direct: false
    },
    {
      id: 'dlrms',
      kind: 'portal',
      name: 'DLRMS (ভূমি রেকর্ড)',
      note: 'ডিজিটাল ভূমি রেকর্ড ব্যবস্থাপনা — খতিয়ান ও নকশা',
      icon: 'bi-building',
      color: '#7c3aed',
      url: 'https://dlrms.land.gov.bd/',
      direct: false
    },
    {
      id: 'mouzamap',
      kind: 'portal',
      name: 'mouzamap.tech',
      note: 'মৌজা নকশার সংগ্রহ — নামিয়ে এখানে আপলোড করুন',
      icon: 'bi-globe2',
      color: '#0d9488',
      url: 'https://www.mouzamap.tech/',
      direct: false
    }
  ],

  /** ব্যবহারকারীর নিজের যোগ করা উৎস (ব্রাউজারে সংরক্ষিত) */
  custom() {
    try {
      const raw = localStorage.getItem(this.STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  },

  saveCustom(list) {
    try { localStorage.setItem(this.STORE_KEY, JSON.stringify(list || [])); return true; }
    catch (_) { return false; }
  },

  /**
   * নতুন উৎস যোগ — নিজের সার্ভার বা ড্রাইভ ফোল্ডার
   * @param {object} src { name, url, kind }
   */
  addCustom(src) {
    const name = String((src && src.name) || '').trim();
    const url = String((src && src.url) || '').trim();
    if (!name) return { ok: false, error: 'উৎসের একটা নাম দিন' };
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'ঠিকানা http:// বা https:// দিয়ে শুরু হতে হবে' };
    const list = this.custom();
    if (list.some(s => s.url === url)) return { ok: false, error: 'এই ঠিকানা আগেই যোগ করা আছে' };
    list.push({
      id: 'custom-' + Date.now().toString(36),
      kind: src.kind === 'portal' ? 'portal' : 'link',
      name, url,
      note: src.note || 'আপনার যোগ করা উৎস',
      icon: 'bi-bookmark-star', color: '#be123c',
      direct: src.kind !== 'portal',
      custom: true
    });
    this.saveCustom(list);
    return { ok: true, list };
  },

  removeCustom(id) {
    const list = this.custom().filter(s => s.id !== id);
    this.saveCustom(list);
    return list;
  },

  /** সব উৎস একসাথে */
  all() { return this.BUILTIN.concat(this.custom()); },

  get(id) { return this.all().find(s => s.id === id) || null; },

  /* ==================== ২. লিংক বোঝা ==================== */

  /** গুগল ড্রাইভের শেয়ার লিংক দেখতে যেমন হয় */
  DRIVE_RE: [
    /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,})/,
    /drive\.google\.com\/open\?id=([A-Za-z0-9_-]{20,})/,
    /docs\.google\.com\/[^?]*\?id=([A-Za-z0-9_-]{20,})/,
    /[?&]id=([A-Za-z0-9_-]{20,})/
  ],

  /**
   * লিংক থেকে বোঝা — এটা ড্রাইভ ফাইল না সাধারণ URL?
   * @returns {{kind:'drive'|'direct', id?:string, url:string}|null}
   */
  parseLink(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    // খালি আইডি বসালেও চলবে
    if (/^[A-Za-z0-9_-]{20,}$/.test(t)) {
      return { kind: 'drive', id: t, url: 'https://drive.google.com/file/d/' + t + '/view' };
    }
    for (const re of this.DRIVE_RE) {
      const m = re.exec(t);
      if (m) return { kind: 'drive', id: m[1], url: t };
    }
    if (/^https?:\/\//i.test(t)) return { kind: 'direct', url: t };
    return null;
  },

  /** ড্রাইভ আইডি → সরাসরি নামানোর ঠিকানা */
  driveDownload(id) {
    return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id);
  },

  /* ==================== ৩. লিংক থেকে ফাইল আনা ==================== */

  /**
   * লিংক থেকে বাইট আনার চেষ্টা
   *
   * ব্রাউজার ভিন্ন ডোমেইনের ফাইল আনতে দেয় না (CORS) — তাই তিন ধাপে চেষ্টা:
   *   ১. ড্রাইভ হলে নিজস্ব প্রক্সি (আর্কাইভের জন্য যেটি আছে)
   *   ২. সরাসরি fetch
   *   ৩. না হলে পরিষ্কার করে কারণ ও করণীয় বলা
   *
   * @returns {Promise<{bytes:Uint8Array, mime:string, name:string}>}
   */
  async fetchLink(text, onStage) {
    const stage = (p, m) => { if (onStage) onStage(p, m); };
    const link = this.parseLink(text);
    if (!link) throw new Error('লিংকটা বোঝা গেল না — সম্পূর্ণ ঠিকানা (https://…) বসান।');

    // ১. ড্রাইভ — নিজস্ব প্রক্সি দিয়ে
    if (link.kind === 'drive' && typeof MouzaMap !== 'undefined' && MouzaMap.proxyUrl) {
      stage(10, 'গুগল ড্রাইভ থেকে আনা হচ্ছে…');
      try {
        const res = await fetch(MouzaMap.proxyUrl(link.id));
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.data && json.data.base64) {
            stage(70, 'ফাইল ডিকোড হচ্ছে…');
            const bin = atob(json.data.base64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return {
              bytes,
              mime: json.data.mimeType || 'application/pdf',
              name: json.data.fileName || 'নকশা'
            };
          }
        }
      } catch (_) { /* নিচে সরাসরি চেষ্টা */ }
    }

    // ২. সরাসরি
    const url = link.kind === 'drive' ? this.driveDownload(link.id) : link.url;
    stage(30, 'ঠিকানা থেকে ফাইল আনা হচ্ছে…');
    let res;
    try {
      res = await fetch(url, { mode: 'cors' });
    } catch (e) {
      throw new Error('এই ঠিকানা থেকে ব্রাউজার সরাসরি ফাইল আনতে পারছে না '
        + '(সাইটটি অন্য ডোমেইনের ফাইল ভাগ করতে দেয় না)। '
        + 'ফাইলটি নামিয়ে "কম্পিউটার থেকে" দিয়ে আপলোড করুন — কাজ একই হবে।');
    }
    if (!res.ok) throw new Error('ফাইল পাওয়া যায়নি (' + res.status + ')');

    stage(70, 'ফাইল আসছে…');
    const buf = await res.arrayBuffer();
    const mime = res.headers.get('content-type') || '';
    const name = decodeURIComponent((url.split('?')[0].split('/').pop() || 'নকশা'));
    if (!buf.byteLength) throw new Error('ফাইলটি খালি এসেছে');
    return { bytes: new Uint8Array(buf), mime, name };
  },

  /** ফাইলের শুরুর বাইট দেখে ধরন — content-type ভুল হলেও কাজ করে */
  sniff(bytes) {
    if (!bytes || bytes.length < 4) return '';
    const b = bytes;
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
    if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
    if (b[0] === 0x49 && b[1] === 0x49) return 'image/tiff';
    if (b[0] === 0x4D && b[1] === 0x4D) return 'image/tiff';
    return '';
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = MouzaMultiSource;
