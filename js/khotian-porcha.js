/* ==========================================================================
   khotian-porcha.js — খতিয়ান বিশ্লেষণ (পর্চার হিসাব)
   --------------------------------------------------------------------------
   কাঠামো প্রচলিত খতিয়ান বিশ্লেষণ রিপোর্টের আদলে (৩০ জুলাই ২০২৬)।

   ★ দুই স্তরের জমি — এটাই মূল কথা
     প্রতিটি দাগে দুটো আলাদা পরিমাণ থাকে:
       • দাগের মোট জমি      — গোটা দাগে যত জমি (ঐচ্ছিক, কেবল তথ্যের জন্য)
       • খতিয়ানে দাগের জমি  — এই খতিয়ানে যতটুকু নিবন্ধিত (বাধ্যতামূলক)
     একটি দাগ একাধিক খতিয়ানে বিভক্ত থাকতে পারে, তাই মালিকদের হিস্যা বসে
     **খতিয়ানে দাগের জমির** উপর — দাগের মোটের উপর নয়।

   ★ হিস্যার যোগফল ১ না-ও হতে পারে — এবং সেটা ভুল নয়
     খতিয়ানে ৪ জন মালিক থাকলেও কেবল ৩ জনের বিশ্লেষণ করা যায়। তখন হিস্যার
     যোগ ০.৮৩৩ হবে, আর বাকিটুকু "অন্য মালিকগণ" হিসেবে আলাদা দেখানো হয়।
     তাই হিস্যাকে অনুপাতে স্বাভাবিক (normalize) করা যাবে না — করলে
     প্রত্যেকের অংশ ভুলভাবে বেড়ে যাবে।

   ★ যোগফল হুবহু মেলানো (largest remainder)
     হিস্যার যোগ পুরো ১ হলে ভাগফলগুলোর যোগ খতিয়ানের জমির সমান হওয়া উচিত।
     কিন্তু রাউন্ডিংয়ে মেলে না — ১০০ শতক তিনজনে (২ দশমিক) = ৯৯.৯৯।
     তখন অবশিষ্টটুকু যাদের ভগ্নাংশ-অবশিষ্ট বড় তাদের মাঝে বিলি করা হয়।
     আংশিক বিশ্লেষণে (যোগ < ১) এই সমন্বয় হয় না — সেখানে ঘাটতিটাই তো
     অন্য মালিকদের প্রাপ্য।

   DOM ছোঁয় না — Node এ টেস্ট করা যায়।
   ========================================================================== */

const PorchaMath = {

  /** হিস্যার যোগ ১ ধরার সহনসীমা */
  FULL_EPS: 1e-6,

  /** খতিয়ানের ধরন */
  KHOTIAN_TYPES: [
    { id: 'bs',    name: 'বি.এস. (বর্তমান সার্ভে)' },
    { id: 'rs',    name: 'আর.এস. (রিভিশনাল সার্ভে)' },
    { id: 'sa',    name: 'এস.এ. (স্টেট একুইজিশন)' },
    { id: 'cs',    name: 'সি.এস. (ক্যাডাস্ট্রাল সার্ভে)' },
    { id: 'ps',    name: 'পি.এস. (পাকিস্তান সার্ভে)' },
    { id: 'namjari', name: 'নামজারি খতিয়ান' },
    { id: 'city',  name: 'মহানগর জরিপ' },
    { id: 'other', name: 'অন্যান্য' }
  ],

  /** জমির শ্রেণী — পর্চায় যেভাবে লেখা থাকে */
  LAND_CLASSES: [
    'কৃষি জমি', 'বাস্তু (বাড়িঘর)', 'ভিটা', 'পুকুর', 'ডোবা', 'বাগান',
    'বাঁশঝাড়', 'নালা/খাল', 'রাস্তা', 'দলা', 'ডাঙ্গা', 'দোলা', 'ছনখোলা',
    'পতিত', 'চর', 'বনভূমি', 'খাস জমি', 'অনির্ধারিত', 'অন্যান্য'
  ],

  /** হিস্যা দেওয়ার ধরন — দশমিক আগে (প্রজেক্টের নিয়ম) */
  HISSA_TYPES: [
    { id: 'decimal',  name: 'দশমিক (০–১)' },
    { id: 'anagonda', name: 'আনা-গণ্ডা' },
    { id: 'fraction', name: 'ভগ্নাংশ' },
    { id: 'percent',  name: 'শতাংশ (%)' }
  ],

  /** মালিকের অভিভাবক-সম্পর্ক */
  RELATIONS: [
    { id: 'father',  name: 'পিতা',  label: 'পিতার নাম' },
    { id: 'husband', name: 'স্বামী', label: 'স্বামীর নাম' },
    { id: 'mother',  name: 'মাতা',  label: 'মাতার নাম' }
  ],

  /** বাংলা একক নাম → LandMath এর একক আইডি */
  UNIT_IDS: {
    'শতক': 'satak', 'একর': 'acre', 'কাঠা': 'katha',
    'বিঘা': 'bigha', 'বর্গফুট': 'sqft'
  },

  /**
   * খতিয়ানের ধরন অনুযায়ী কোন হিস্যা-পদ্ধতি স্বাভাবিক তার পরামর্শ।
   * নতুন জরিপে দশমিক, পুরনো সি.এস./পি.এস. এ আনা-গণ্ডা।
   */
  suggestHissaType(khType) {
    return (khType === 'cs' || khType === 'ps') ? 'anagonda' : 'decimal';
  },

  /* ----------------------------------------------------------------------
     সাধারণ হেল্পার
     ---------------------------------------------------------------------- */

  round(x, decimals = 4) {
    const v = Number(x) || 0;
    return parseFloat(v.toFixed(decimals));
  },

  sumRounded(arr, decimals = 4) {
    return this.round(arr.reduce((a, b) => a + (Number(b) || 0), 0), decimals);
  },

  /** যেকোনো এককের পরিমাণকে বর্গফুটে */
  toSqft(value, unitName) {
    if (typeof LandMath === 'undefined') return 0;
    const id = this.UNIT_IDS[unitName] || 'satak';
    return parseFloat(LandMath.convertArea(value, id).sqft) || 0;
  },

  /**
   * একটি রাশিকে ভগ্নাংশ অনুযায়ী ভাগ করে — যোগফল হুবহু মিলিয়ে।
   * কেবল তখনই ব্যবহার্য যখন ভগ্নাংশগুলোর যোগ ১ (পূর্ণ খতিয়ান)।
   *
   * @returns {{parts:number[], total:number, adjusted:number[]}}
   */
  splitExact(total, weights, decimals = 4) {
    const n = weights.length;
    if (!n) return { parts: [], total: 0, adjusted: [] };

    const step = Math.pow(10, -decimals);
    const t = Number(total) || 0;
    const w = weights.map(x => Math.max(0, Number(x) || 0));
    const wSum = w.reduce((a, b) => a + b, 0);

    if (t <= 0 || wSum <= 0) {
      return { parts: new Array(n).fill(0), total: 0, adjusted: [] };
    }

    const units = Math.round(t / step);
    const raw = w.map(x => units * (x / wSum));
    const base = raw.map(Math.floor);
    let left = units - base.reduce((a, b) => a + b, 0);

    const order = raw
      .map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));

    const adjusted = [];
    for (let k = 0; k < order.length && left > 0; k++) {
      base[order[k].i]++;
      adjusted.push(order[k].i);
      left--;
    }

    const q = u => this.round(u * step, decimals);
    return { parts: base.map(q), total: q(units), adjusted };
  },

  /**
   * আংশিক বিশ্লেষণ — হিস্যা সরাসরি গুণ, কোনো স্বাভাবিকীকরণ নয়।
   * অবশিষ্টটুকু অন্য (তালিকাভুক্ত নয়) মালিকদের।
   */
  splitDirect(total, weights, decimals = 4) {
    const t = Math.max(0, Number(total) || 0);
    const parts = weights.map(f => this.round(t * Math.max(0, Number(f) || 0), decimals));
    return {
      parts,
      total: this.round(t, decimals),
      unallocated: this.round(t - this.sumRounded(parts, decimals), decimals),
      adjusted: []
    };
  },

  /* ----------------------------------------------------------------------
     পুরো পর্চার বিশ্লেষণ
     ---------------------------------------------------------------------- */

  /**
   * @param {object} cfg
   *   dags:   [{ no, cls, totalArea, khotianArea }]
   *   owners: [{ name, relation, guardian, address, type, data }]
   *   unit:   'শতক' | 'একর' | ...
   *   totalOwners: number   খতিয়ানে সর্বমোট কতজন মালিক
   *   decimals: number
   */
  analyze(cfg) {
    const decimals = Number.isFinite(cfg?.decimals) ? cfg.decimals : 4;
    const unit = cfg?.unit || 'শতক';
    const bn = x => (typeof toBn === 'function' ? toBn(x) : String(x));

    // ---- দাগ ----
    const dags = (cfg?.dags || []).map((d, i) => {
      const khotianArea = Math.max(0, Number(d?.khotianArea) || 0);
      const totalArea = Math.max(0, Number(d?.totalArea) || 0);
      return {
        idx: i,
        no: String(d?.no ?? '').trim() || `দাগ ${bn(i + 1)}`,
        cls: String(d?.cls ?? '').trim(),
        totalArea,                       // ০ মানে দেওয়া হয়নি (ঐচ্ছিক)
        hasTotal: totalArea > 0,
        khotianArea,
        khotianSqft: this.round(this.toSqft(khotianArea, unit), 1),
        // খতিয়ানের জমি দাগের মোটের চেয়ে বেশি হলে তথ্যে ভুল আছে
        overTotal: totalArea > 0 && khotianArea > totalArea + 1e-9
      };
    });

    // ---- মালিক ----
    const owners = (cfg?.owners || []).map((o, i) => {
      const fraction = (typeof LandMath !== 'undefined')
        ? LandMath.hissaToFraction(o?.type || 'decimal', o?.data || {})
        : (Number(o?.data?.decimal) || 0);
      const rel = this.RELATIONS.find(r => r.id === (o?.relation || 'father')) || this.RELATIONS[0];
      return {
        idx: i,
        name: String(o?.name ?? '').trim() || `মালিক ${bn(i + 1)}`,
        relation: rel.id,
        relationName: rel.name,
        guardianLabel: rel.label,
        guardian: String(o?.guardian ?? '').trim(),
        address: String(o?.address ?? '').trim(),
        type: o?.type || 'decimal',
        fraction: Math.max(0, Number(fraction) || 0),
        perDag: [],
        perDagSqft: [],
        total: 0,
        totalSqft: 0
      };
    });

    const weights = owners.map(o => o.fraction);
    const hissaSum = this.round(weights.reduce((a, b) => a + b, 0), 8);
    const isFull = Math.abs(hissaSum - 1) < this.FULL_EPS;
    const isOver = hissaSum > 1 + this.FULL_EPS;

    // ---- প্রতিটি দাগ আলাদা করে ভাগ ----
    let anyAdjusted = false;
    dags.forEach(d => {
      // পূর্ণ খতিয়ান হলে যোগফল মিলিয়ে ভাগ, নইলে সরাসরি গুণ
      const r = isFull
        ? this.splitExact(d.khotianArea, weights, decimals)
        : this.splitDirect(d.khotianArea, weights, decimals);

      d.split = r.parts;
      d.adjusted = r.adjusted || [];
      d.unallocated = r.unallocated !== undefined ? r.unallocated : 0;
      d.unallocatedSqft = this.round(this.toSqft(d.unallocated, unit), 1);
      if (d.adjusted.length) anyAdjusted = true;

      owners.forEach((o, oi) => {
        const v = r.parts[oi] || 0;
        o.perDag.push(v);
        o.perDagSqft.push(this.round(this.toSqft(v, unit), 1));
      });
    });

    owners.forEach(o => {
      o.total = this.sumRounded(o.perDag, decimals);
      o.totalSqft = this.round(this.toSqft(o.total, unit), 1);
    });

    const khotianTotal = this.sumRounded(dags.map(d => d.khotianArea), decimals);
    const dagGrandTotal = this.sumRounded(dags.map(d => d.totalArea), decimals);
    const analyzedTotal = this.sumRounded(owners.map(o => o.total), decimals);
    const unallocatedTotal = this.sumRounded(dags.map(d => d.unallocated), decimals);

    const totalOwners = Math.max(0, parseInt(cfg?.totalOwners) || 0);

    return {
      dags, owners, unit, decimals,

      khotianTotal,                                  // খতিয়ানে মোট জমি
      khotianTotalSqft: this.round(this.toSqft(khotianTotal, unit), 1),
      dagGrandTotal,                                 // দাগগুলোর সর্বমোট (যেগুলো দেওয়া আছে)
      analyzedTotal,                                 // বিশ্লেষিত মালিকদের মোট
      analyzedTotalSqft: this.round(this.toSqft(analyzedTotal, unit), 1),
      unallocatedTotal,                              // অন্য মালিকগণ
      unallocatedSqft: this.round(this.toSqft(unallocatedTotal, unit), 1),

      hissaSum,
      isFull,                                        // পুরো ১৬ আনা বিশ্লেষণ হয়েছে?
      isOver,                                        // হিস্যা ১ এর বেশি — তথ্যে ভুল
      hissaShortfall: this.round(1 - hissaSum, 8),

      totalOwners,
      analyzeCount: owners.length,
      isPartial: totalOwners > 0 && owners.length < totalOwners,
      countMismatch: totalOwners > 0 && owners.length > totalOwners,

      dagCount: dags.length,
      ownerCount: owners.length,
      anyAdjusted,
      anyOverTotal: dags.some(d => d.overTotal)
    };
  },

  /**
   * তফসিলের এক লাইন — নামজারির আবেদনে বা দলিলে হুবহু বসিয়ে দেওয়া যায়।
   */
  tofasilLine(owner, dags, unitName, decimals = 4) {
    const bn = x => (typeof toBn === 'function' ? toBn(x) : String(x));
    const parts = [];
    dags.forEach((d, i) => {
      const v = owner.perDag[i] || 0;
      if (v > 0) {
        const cls = d.cls ? ` (${d.cls})` : '';
        parts.push(`দাগ নং ${bn(d.no)}${cls} = ${bn(v.toFixed(decimals))} ${unitName}`);
      }
    });
    return parts.join(', ');
  },

  /** টুল পরীক্ষার নমুনা তথ্য */
  sampleData() {
    return {
      district: 'মুন্সীগঞ্জ',
      upazila: 'শ্রীনগর',
      mouza: 'ভাগ্যকুল',
      jl: '৮৫',
      khType: 'bs',
      khNo: '২৩৪',
      totalOwners: 4,
      unit: 'শতক',
      hissaType: 'decimal',
      owners: [
        { name: 'মোহাম্মদ আব্দুল করিম', relation: 'father', guardian: 'মৃত আব্দুল হামিদ মিয়া',
          address: 'ভাগ্যকুল, শ্রীনগর', data: { decimal: 0.333 } },
        { name: 'মোহাম্মদ রফিকুল ইসলাম', relation: 'father', guardian: 'মৃত আব্দুল হামিদ মিয়া',
          address: 'ঢাকা সদর', data: { decimal: 0.333 } },
        { name: 'মোসাম্মাৎ সুফিয়া বেগম', relation: 'husband', guardian: 'মোহাম্মদ আব্দুল করিম',
          address: 'ভাগ্যকুল, শ্রীনগর', data: { decimal: 0.167 } }
      ],
      dags: [
        { no: '৩৫৬', cls: 'কৃষি জমি', totalArea: 50, khotianArea: 33.5 },
        { no: '৩৫৭', cls: 'বাস্তু (বাড়িঘর)', totalArea: 20, khotianArea: 12 },
        { no: '৩৬২', cls: 'পুকুর', totalArea: 0, khotianArea: 8.25 }
      ],
      repName: 'আব্দুর করিম',
      repTitle: 'সার্ভেয়ার',
      repMobile: '০১৭০০০০০০০০'
    };
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = PorchaMath;
