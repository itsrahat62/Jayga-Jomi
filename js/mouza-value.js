/* ==========================================================================
   mouza-value.js — সম্পত্তির সর্বনিম্ন বাজার মূল্য (মৌজা মূল্য) তালিকা
   --------------------------------------------------------------------------
   সাব-রেজিস্ট্রি অফিসভিত্তিক সরকারি মৌজা রেটের PDF খুঁজে দেখায়।

   দুই স্তরের উৎস:
     ১. নিজস্ব — js/mouza-sources.js এ যা দেওয়া আছে (Google Drive/নিজের সার্ভার)
     ২. বাইরের — landvalue.amarvumi.com এর পাবলিক API

   নিজস্ব উৎস পাওয়া গেলে সেটাই আগে, না পেলে বাইরেরটা।
   তাই ভবিষ্যতে Drive এ ফাইল তুললে শুধু mouza-sources.js বদলালেই হবে।

   API কাঠামো (২৯ জুলাই ২০২৬ এ যাচাই করা):
     GET  {BASE}division                      → সব বিভাগ
     GET  {BASE}district/distName/{divisionId} → ওই বিভাগের জেলা
     GET  {BASE}office/officesName/{districtId}→ ওই জেলার অফিস
     POST {BASE}jomirmullo/search/  {officeId, year} → { jomirMulloFileUrl }
   আইডি হিসেবে সর্বত্র ২৪ অক্ষরের Mongo _id ব্যবহার হয় (diviId/districtId নয়)।
   ========================================================================== */

const MouzaValue = {

  API_BASE: 'https://ji4139zbah.execute-api.ap-south-1.amazonaws.com/api/v1/',

  /** যেসব বছরের তালিকা পাওয়া যায় — নতুনটা আগে */
  YEARS: ['2025', '2024'],

  /** একই জিনিস বারবার না আনার জন্য */
  cache: {},

  /* ----------------------------------------------------------------------
     পিওর হেল্পার — নেটওয়ার্ক ছাড়াই পরীক্ষা করা যায়
     ---------------------------------------------------------------------- */

  /**
   * API এর তালিকা-রেসপন্স থেকে {id, name} এর সাজানো অ্যারে বানায়।
   * ব্যর্থ বা অপ্রত্যাশিত রেসপন্সে খালি অ্যারে — কখনো throw করে না।
   */
  parseList(json) {
    if (!json || json.success !== true || !Array.isArray(json.data)) return [];
    return json.data
      .map(d => ({
        id: d._id || d.id || '',
        name: (d.name || '').trim()
      }))
      .filter(d => d.id && d.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'bn'));
  },

  /**
   * search রেসপন্স থেকে PDF এর লিংক বের করে।
   * ফাইল না থাকলে null।
   */
  parseSearch(json) {
    if (!json || json.success !== true) return null;
    const row = Array.isArray(json.data) ? json.data[0] : json.data;
    if (!row) return null;
    const url = (row.jomirMulloFileUrl || '').trim();
    if (!url) return null;
    return {
      url,
      year: String(row.year || ''),
      officeName: (row.officeId && row.officeId.name) || row.officeName || '',
      districtName: row.districtName || '',
      divisionName: row.divisionName || '',
      updatedAt: row.createdAt || ''
    };
  },

  /**
   * চূড়ান্ত সিদ্ধান্ত — কোন লিংকটা দেখানো হবে।
   * নিজস্ব উৎস থাকলে সেটাই, না থাকলে API এর লিংক।
   *
   * @param {string} officeId
   * @param {string} year
   * @param {string|null} apiUrl  API থেকে পাওয়া লিংক (না থাকলে null)
   * @returns {{view:string, open:string, source:'own'|'external', kind:string}|null}
   */
  resolve(officeId, year, apiUrl) {
    const own = (typeof MouzaSources !== 'undefined')
      ? MouzaSources.lookup(officeId, year)
      : null;

    if (own) return { view: own.view, open: own.open, source: 'own', kind: own.kind };

    if (apiUrl) {
      return { view: apiUrl, open: apiUrl, source: 'external', kind: 'direct' };
    }
    return null;
  },

  /** ফাইলের নাম URL থেকে বের করে (ডাউনলোডের নামের জন্য) */
  fileNameFrom(url, fallback) {
    try {
      const last = String(url).split('?')[0].split('/').pop() || '';
      const name = decodeURIComponent(last);
      if (name && /\.pdf$/i.test(name)) return name;
    } catch (e) { /* খারাপ এনকোডিং — নিচের fallback */ }
    return (fallback || 'mouza-rate') + '.pdf';
  },

  /* ----------------------------------------------------------------------
     নেটওয়ার্ক
     ---------------------------------------------------------------------- */

  async _get(path) {
    if (this.cache[path]) return this.cache[path];
    const res = await fetch(this.API_BASE + path, { method: 'GET' });
    const json = await res.json();
    this.cache[path] = json;
    return json;
  },

  async divisions() {
    return this.parseList(await this._get('division'));
  },

  async districts(divisionId) {
    if (!divisionId) return [];
    return this.parseList(await this._get('district/distName/' + divisionId));
  },

  async offices(districtId) {
    if (!districtId) return [];
    return this.parseList(await this._get('office/officesName/' + districtId));
  },

  /**
   * অফিস+বছরের ফাইল খোঁজে।
   * নিজস্ব উৎসে পেলে API তে যায়ই না — বাইরের সাইটের উপর নির্ভরতা কমে।
   */
  async search(officeId, year) {
    const own = (typeof MouzaSources !== 'undefined')
      ? MouzaSources.lookup(officeId, year)
      : null;
    if (own) {
      return { view: own.view, open: own.open, source: 'own', kind: own.kind, meta: null };
    }

    const key = `search:${officeId}:${year}`;
    let json = this.cache[key];
    if (!json) {
      const res = await fetch(this.API_BASE + 'jomirmullo/search/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officeId, year: String(year) })
      });
      json = await res.json();
      this.cache[key] = json;
    }

    const meta = this.parseSearch(json);
    const out = this.resolve(officeId, year, meta ? meta.url : null);
    return out ? Object.assign(out, { meta }) : null;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = MouzaValue;
