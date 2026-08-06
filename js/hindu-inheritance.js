/* ==========================================================================
   হিন্দু উত্তরাধিকার (দায়ভাগ) — বাংলাদেশ
   ==========================================================================

   আইনি ভিত্তি:
   - বাংলাদেশে হিন্দু উত্তরাধিকার **দায়ভাগ** মত অনুযায়ী পরিচালিত (মিতাক্ষরা নয়)।
   - ভারতের Hindu Succession Act, 1956 বাংলাদেশে **প্রযোজ্য নয়** — এখানে
     অসংহিতাবদ্ধ শাস্ত্রীয় দায়ভাগ আইন + সম্পত্তিতে হিন্দু মহিলার অধিকার আইন, ১৯৩৭।
   - দায়ভাগের মূল নীতি: যিনি মৃতের আত্মার কল্যাণে পিণ্ডদানের অধিকারী,
     তিনিই সপিণ্ড ও উত্তরাধিকারী।

   এই ইঞ্জিন **পুরুষের নিঃউইল (intestate) সম্পত্তি** বণ্টন করে।
   DOM ছোঁয় না — tests/hindu-test.js দিয়ে যাচাইযোগ্য।

   ⚠️ সীমাবদ্ধতা ও সতর্কতা ফাইলের শেষে LIMITATIONS-এ লেখা আছে।
   ========================================================================== */

const HinduLaw = {

  /* ----------------------------------------------------------------------
     উত্তরাধিকারীর তালিকা — দায়ভাগের ক্রম অনুযায়ী সাজানো
     ---------------------------------------------------------------------- */
  categories: [
    { id: 'class1', title: 'শ্রেণি ১ — পুত্র, পৌত্র ও বিধবা স্ত্রী' },
    { id: 'class2', title: 'শ্রেণি ২ — কন্যা ও দৌহিত্র' },
    { id: 'class3', title: 'শ্রেণি ৩ — পিতা-মাতা ও ভাই' },
    { id: 'class4', title: 'শ্রেণি ৪ — ঊর্ধ্বতন ও অন্যান্য সপিণ্ড' }
  ],

  heirsConfig: [
    // ---- শ্রেণি ১ (একসাথে অংশ পান) ----
    { id: 'son', name: 'পুত্র', type: 'multi', cat: 'class1' },
    { id: 'deadSon', name: 'মৃত পুত্র', type: 'multi', cat: 'class1', isDynamicTrigger: true },
    { id: 'widow', name: 'বিধবা স্ত্রী', type: 'multi', cat: 'class1' },

    // ---- শ্রেণি ২ ----
    { id: 'unmarriedDaughter', name: 'অবিবাহিতা কন্যা', type: 'multi', cat: 'class2' },
    { id: 'sonfulDaughter', name: 'পুত্রবতী / পুত্রসম্ভবা কন্যা', type: 'multi', cat: 'class2' },
    { id: 'barrenDaughter', name: 'বন্ধ্যা বা নিঃসন্তান বিধবা কন্যা', type: 'multi', cat: 'class2' },
    { id: 'daughterSon', name: 'দৌহিত্র (কন্যার পুত্র)', type: 'multi', cat: 'class2' },

    // ---- শ্রেণি ৩ ----
    { id: 'father', name: 'পিতা', type: 'single', cat: 'class3' },
    { id: 'mother', name: 'মাতা', type: 'single', cat: 'class3' },
    { id: 'fullBrother', name: 'সহোদর ভাই', type: 'multi', cat: 'class3' },
    { id: 'stepBrother', name: 'বৈমাত্রেয় ভাই', type: 'multi', cat: 'class3' },
    { id: 'brotherSon', name: 'ভ্রাতুষ্পুত্র (ভাইয়ের পুত্র)', type: 'multi', cat: 'class3' },
    { id: 'brotherSonSon', name: 'ভাইয়ের পৌত্র', type: 'multi', cat: 'class3' },
    { id: 'sisterSon', name: 'ভাগিনেয় (বোনের পুত্র)', type: 'multi', cat: 'class3' },

    // ---- শ্রেণি ৪ ----
    { id: 'paternalGrandfather', name: 'পিতামহ (দাদা)', type: 'single', cat: 'class4' },
    { id: 'paternalGrandmother', name: 'পিতামহী (দাদী)', type: 'single', cat: 'class4' },
    { id: 'paternalUncle', name: 'পিতৃব্য (চাচা)', type: 'multi', cat: 'class4' },
    { id: 'paternalUncleSon', name: 'চাচাতো ভাই', type: 'multi', cat: 'class4' }
  ],

  /**
   * শ্রেণি ৩ ও ৪ এর একক-ক্রম: আগেরজন থাকলে পরেরজন সম্পূর্ণ বঞ্চিত।
   * প্রতিটি ধাপে ঐ শ্রেণির সবাই সমান অংশ পান (per capita)।
   */
  singleOrder: [
    'father', 'mother', 'fullBrother', 'stepBrother',
    'brotherSon', 'brotherSonSon', 'sisterSon',
    'paternalGrandfather', 'paternalGrandmother',
    'paternalUncle', 'paternalUncleSon'
  ],

  /**
   * একজন মৃত পুত্র আদৌ শাখা তৈরি করেন কি না।
   * তার পুত্র (পৌত্র) বা বিধবা স্ত্রী থাকলেই কেবল তার শাখা অংশ পাবে;
   * কেউ না থাকলে তিনি উত্তরাধিকারীই নন — তাকে গণনায় ধরা যাবে না।
   */
  deadSonHasHeirs(dyn, i) {
    return (dyn[`deadSon_${i}_son`] || 0) > 0 || (dyn[`deadSon_${i}_widow`] || 0) > 0;
  },

  /**
   * মূল বণ্টন।
   *
   * @param {object} counts  উত্তরাধিকারীর সংখ্যা — { son: 2, widow: 1, ... }
   * @param {object} dyn     মৃত পুত্রের বিবরণ — { deadSon_1_son: 2, deadSon_1_widow: 1 }
   * @returns {{shares: object, steps: string[], stage: string, limitedEstate: string[]}}
   *          shares — প্রতিটি key এর মোট অংশ (০–১)
   *          steps  — বাংলায় হিসাবের ব্যাখ্যা
   *          stage  — কোন শ্রেণি থেকে বণ্টন হয়েছে
   *          limitedEstate — যাদের অংশ "সীমিত স্বত্ব" (জীবনস্বত্ব)
   */
  calculate(counts, dyn = {}) {
    const c = {};
    this.heirsConfig.forEach(h => { c[h.id] = parseInt(counts[h.id]) || 0; });

    const shares = {};
    const steps = [];
    const limitedEstate = [];
    let stage = '';

    /* ============ শ্রেণি ১ — পুত্র/পৌত্র ও বিধবা স্ত্রী ============ */

    // শাখা (per stirpes): প্রতিটি জীবিত পুত্র একটি শাখা,
    // উত্তরাধিকারসহ প্রতিটি মৃত পুত্রও একটি শাখা
    const deadBranches = [];
    for (let i = 1; i <= c.deadSon; i++) {
      if (this.deadSonHasHeirs(dyn, i)) deadBranches.push(i);
    }
    const branchCount = c.son + deadBranches.length;
    const W = c.widow;

    if (branchCount > 0) {
      stage = 'class1';
      // বিধবা স্ত্রী এক পুত্রের সমান অংশ পান (১৯৩৭ আইনের ৩ ধারা)
      const units = branchCount + (W > 0 ? 1 : 0);
      const per = 1 / units;

      if (c.son > 0) {
        shares.son = per * c.son;
        steps.push(`মৃত ব্যক্তির ${this._bn(c.son)} জন জীবিত পুত্র প্রত্যেকে সমান অংশ পাবেন।`);
      }

      if (deadBranches.length > 0) {
        steps.push('প্রতিনিধিত্ব নীতিতে (per stirpes) মৃত পুত্রের উত্তরাধিকারীরা তাদের পিতার প্রাপ্য শাখা-অংশ পাবেন।');
      }

      deadBranches.forEach(i => {
        const ds = dyn[`deadSon_${i}_son`] || 0;   // পৌত্র
        const dw = dyn[`deadSon_${i}_widow`] || 0; // মৃত পুত্রের বিধবা

        if (ds > 0 && dw > 0) {
          // মৃত পুত্রের বিধবাও তার এক পুত্রের সমান অংশ পান
          const sub = per / (ds + 1);
          shares[`deadSon_${i}_son`] = sub * ds;
          shares[`deadSon_${i}_widow`] = sub;
          limitedEstate.push(`deadSon_${i}_widow`);
        } else if (ds > 0) {
          shares[`deadSon_${i}_son`] = per;
        } else {
          shares[`deadSon_${i}_widow`] = per;
          limitedEstate.push(`deadSon_${i}_widow`);
        }
      });

      if (W > 0) {
        shares.widow = per;
        limitedEstate.push('widow');
        steps.push(`সম্পত্তিতে হিন্দু মহিলার অধিকার আইন, ১৯৩৭ অনুযায়ী বিধবা স্ত্রী একজন পুত্রের সমান অংশ পাবেন।${W > 1 ? ' একাধিক বিধবা থাকায় তারা ঐ অংশ সমানভাবে ভাগ করে নেবেন।' : ''}`);
      }

      return { shares, steps, stage, limitedEstate };
    }

    // পুরুষ বংশধর নেই — বিধবা স্ত্রী থাকলে তিনিই সম্পূর্ণ সম্পত্তি পাবেন
    if (W > 0) {
      stage = 'widow';
      shares.widow = 1;
      limitedEstate.push('widow');
      steps.push('পুত্র, পৌত্র বা প্রপৌত্র কেউ না থাকায় বিধবা স্ত্রী সম্পূর্ণ সম্পত্তির উত্তরাধিকারী হবেন।');
      if (W > 1) steps.push('একাধিক বিধবা থাকায় তারা সম্পত্তি সমানভাবে ভাগ করে নেবেন।');
      return { shares, steps, stage, limitedEstate };
    }

    /* ============ শ্রেণি ২ — কন্যা ============ */
    // দায়ভাগে কন্যাদের মধ্যে অগ্রাধিকার:
    // অবিবাহিতা > পুত্রবতী/পুত্রসম্ভবা > বন্ধ্যা বা নিঃসন্তান বিধবা (বঞ্চিত)
    if (c.unmarriedDaughter > 0) {
      stage = 'daughter';
      shares.unmarriedDaughter = 1;
      limitedEstate.push('unmarriedDaughter');
      steps.push('পুত্র ও বিধবা স্ত্রী না থাকায় কন্যারা উত্তরাধিকারী। দায়ভাগ অনুযায়ী অবিবাহিতা কন্যার দাবি অগ্রগণ্য, তাই তিনি/তারাই সম্পূর্ণ সম্পত্তি পাবেন।');
      if (c.sonfulDaughter > 0 || c.barrenDaughter > 0) {
        steps.push('অবিবাহিতা কন্যা থাকায় বিবাহিতা কন্যারা এই ক্ষেত্রে বঞ্চিত হয়েছেন।');
      }
      return { shares, steps, stage, limitedEstate };
    }

    if (c.sonfulDaughter > 0) {
      stage = 'daughter';
      shares.sonfulDaughter = 1;
      limitedEstate.push('sonfulDaughter');
      steps.push('অবিবাহিতা কন্যা না থাকায় পুত্রবতী বা পুত্রসম্ভবা কন্যারা সম্পূর্ণ সম্পত্তির উত্তরাধিকারী হবেন।');
      if (c.barrenDaughter > 0) {
        steps.push('দায়ভাগ অনুযায়ী বন্ধ্যা বা নিঃসন্তান বিধবা কন্যা উত্তরাধিকার থেকে বঞ্চিত।');
      }
      return { shares, steps, stage, limitedEstate };
    }

    if (c.barrenDaughter > 0) {
      steps.push('দায়ভাগ অনুযায়ী বন্ধ্যা বা নিঃসন্তান বিধবা কন্যা পিণ্ডদানের অধিকারী নন, তাই তিনি উত্তরাধিকার পাবেন না।');
    }

    /* ============ দৌহিত্র (কন্যার পুত্র) — per capita ============ */
    if (c.daughterSon > 0) {
      stage = 'daughterSon';
      shares.daughterSon = 1;
      steps.push('কন্যা না থাকায় দৌহিত্রগণ (কন্যার পুত্র) উত্তরাধিকারী। তারা মাথাপিছু (per capita) সমান অংশ পাবেন — কোন কন্যার সন্তান তা বিবেচ্য নয়।');
      return { shares, steps, stage, limitedEstate };
    }

    /* ============ শ্রেণি ৩ ও ৪ — একক ক্রম ============ */
    for (const key of this.singleOrder) {
      if (c[key] > 0) {
        stage = key;
        shares[key] = 1;
        const h = this.heirsConfig.find(x => x.id === key);
        steps.push(`পূর্ববর্তী ক্রমের কোনো উত্তরাধিকারী না থাকায় ${h.name} সম্পূর্ণ সম্পত্তির উত্তরাধিকারী হবেন।`);
        if (c[key] > 1) steps.push(`${this._bn(c[key])} জন থাকায় তারা সমান অংশ পাবেন।`);
        if (key === 'mother') limitedEstate.push('mother');
        return { shares, steps, stage, limitedEstate };
      }
    }

    steps.push('কোনো উত্তরাধিকারী নির্বাচন করা হয়নি অথবা কেউ উত্তরাধিকারের যোগ্য নন।');
    return { shares, steps, stage: 'none', limitedEstate };
  },

  /** বাংলা সংখ্যা (calculators.js এর toBn না থাকলেও কাজ করে) */
  _bn(n) {
    return String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
  },

  /** একটি key এর পাঠযোগ্য বাংলা নাম */
  nameFor(key, dyn) {
    if (key.startsWith('deadSon_')) {
      const p = key.split('_');
      const i = this._bn(p[1]);
      return p[2] === 'widow'
        ? `মৃত পুত্র ${i} এর বিধবা স্ত্রী`
        : `মৃত পুত্র ${i} এর পুত্র (পৌত্র)`;
    }
    const h = this.heirsConfig.find(x => x.id === key);
    return h ? h.name : key;
  }
};

/* ==========================================================================
   LIMITATIONS — জানা সীমাবদ্ধতা (নতুন চ্যাটে এটা পড়ো)
   --------------------------------------------------------------------------
   1. সীমিত স্বত্ব: বিধবা স্ত্রী, কন্যা ও মাতা যে অংশ পান তা দায়ভাগ মতে
      **জীবনস্বত্ব (limited estate)** — বিক্রি বা হস্তান্তর করা যায় না,
      তাদের মৃত্যুর পর সম্পত্তি মৃতের পরবর্তী উত্তরাধিকারীর কাছে ফিরে যায়।
      ইঞ্জিন এটি `limitedEstate` অ্যারেতে চিহ্নিত করে, UI-তে সতর্কবার্তা দেখায়।
   2. প্রপৌত্র (পুত্রের পুত্রের পুত্র) স্তর এখনো নেই — কেবল পৌত্র পর্যন্ত।
   3. ৫৩ জন সপিণ্ডের পূর্ণ তালিকার একটি ব্যবহারিক উপসেট বাস্তবায়িত।
      সকুল্য ও সমানোদক (দূরবর্তী সপিণ্ড) নেই।
   4. স্ত্রীধন ও হিন্দু নারীর নিজস্ব সম্পত্তির বণ্টন এই ইঞ্জিনে নেই —
      সেটির নিয়ম আলাদা এবং বিতর্কিত।
   5. অন্যান্য অযোগ্যতা (অপবিত্রতা, ধর্মান্তর, সন্ন্যাস) হিসাব করা হয় না।
   ========================================================================== */

if (typeof module !== 'undefined' && module.exports) module.exports = { HinduLaw };
