/* ==========================================================================
   calculators.js — LandMath: বিশুদ্ধ গণিত ইঞ্জিন (DOM ছোঁয় না)
   আনা-গণ্ডা · খতিয়ান · হিস্যা · একক রূপান্তর · দাগ পোরশন · তফসিল · অনুপাত
   ========================================================================== */

// Number Converters
const toBn = n => String(n).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
const toEn = n => String(n).replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]);

const LandMath = {
  /* ------------------------------------------------------------------------
     স্থির একক — এগুলো সারা বাংলাদেশে একই
     ১ একর = ৪৩,৫৬০ বর্গফুট = ১০০ শতক  →  ১ শতক = ৪৩৫.৬ বর্গফুট
     ------------------------------------------------------------------------ */
  SQFT_PER_SATAK: 435.6,
  SQFT_PER_ACRE: 43560.0,
  SQFT_PER_SQYARD: 9.0,
  SQFT_PER_SQMETER: 10.7639,

  /* ------------------------------------------------------------------------
     পরিবর্তনযোগ্য একক — কাঠা ও বিঘা
     ⚠️ বাংলাদেশে কাঠার মাপ অঞ্চলভেদে আলাদা। তাই এগুলো ধ্রুবক নয়।
        - স্ট্যান্ডার্ড (ঢাকা/সরকারি): ১ কাঠা = ৭২০ বর্গফুট ≈ ১.৬৫ শতক
        - কিছু অঞ্চলে:                ১ কাঠা = ২.৬০ শতক
        - প্রয়োজনে নিজের এলাকার মাপ (custom) দেওয়া যায়
     নিয়ম: **২০ কাঠা = ১ বিঘা** — কাঠার মান যাই হোক না কেন।
     তাই বিঘা কাঠা থেকেই হিসাব হয়, আলাদা করে সেট করা হয় না।
     ------------------------------------------------------------------------ */
  KATHA_PER_BIGHA: 20,

  /** কাঠার প্রিসেট — UI-তে দেখানোর জন্য */
  KATHA_PRESETS: [
    { id: 'standard', label: 'স্ট্যান্ডার্ড', satak: 720 / 435.6, note: '১ কাঠা = ৭২০ বর্গফুট' },
    { id: 'wide',     label: '২.৬০ শতক',      satak: 2.60,        note: 'কিছু অঞ্চলে প্রচলিত' },
    { id: 'custom',   label: 'কাস্টম',         satak: null,        note: 'নিজের এলাকার মাপ' }
  ],

  // বর্তমানে কার্যকর মান (ডিফল্ট: স্ট্যান্ডার্ড ৭২০ বর্গফুট)
  kathaMode: 'standard',
  SATAK_PER_KATHA: 720 / 435.6,
  SQFT_PER_KATHA: 720.0,
  SQFT_PER_BIGHA: 720.0 * 20,

  /**
   * কাঠার মাপ বদলায় (শতকে)। বিঘা আপনাআপনি ২০ কাঠা হিসেবে হালনাগাদ হয়।
   * @param {number} satakPerKatha  ১ কাঠা কত শতক
   * @param {string} mode           'standard' | 'wide' | 'custom'
   */
  setKatha(satakPerKatha, mode = 'custom') {
    const v = parseFloat(satakPerKatha);
    if (!isFinite(v) || v <= 0) return false;
    this.kathaMode = mode;
    this.SATAK_PER_KATHA = v;
    this.SQFT_PER_KATHA = v * this.SQFT_PER_SATAK;
    this.SQFT_PER_BIGHA = this.SQFT_PER_KATHA * this.KATHA_PER_BIGHA;
    return true;
  },

  /** প্রিসেট আইডি দিয়ে কাঠা সেট করে */
  setKathaPreset(id, customSatak) {
    const p = this.KATHA_PRESETS.find(x => x.id === id);
    if (!p) return false;
    return this.setKatha(p.satak !== null ? p.satak : customSatak, id);
  },

  /** বর্তমান কাঠা-ভিত্তির সারসংক্ষেপ (UI-তে দেখানোর জন্য) */
  kathaBasis() {
    return {
      mode: this.kathaMode,
      satakPerKatha: this.SATAK_PER_KATHA,
      sqftPerKatha: this.SQFT_PER_KATHA,
      satakPerBigha: this.SQFT_PER_BIGHA / this.SQFT_PER_SATAK,
      sqftPerBigha: this.SQFT_PER_BIGHA
    };
  },

  /* ------------------------------------------------------------------------
     বণ্টনের আগে বাদ যাওয়া খাত — দাফন-কাফন · ঋণ · ওসিয়ত
     ------------------------------------------------------------------------ */

  /** ওসিয়তের সর্বোচ্চ সীমা — ঋণ পরিশোধের পর অবশিষ্ট সম্পত্তির এক-তৃতীয়াংশ */
  BEQUEST_LIMIT: 1 / 3,

  /**
   * ফরায়েজে বণ্টনের আগে যা বাদ দিতে হয়, শরিয়াহ-নির্ধারিত ক্রমে:
   *   ১. দাফন-কাফনের খরচ
   *   ২. ঋণ পরিশোধ
   *   ৩. ওসিয়ত — ঋণ শোধের পর অবশিষ্টের সর্বোচ্চ ১/৩
   *   ৪. যা থাকে, তা-ই ওয়ারিশদের মাঝে বণ্টনযোগ্য
   *
   * একটি সম্পদের জন্য (জমি/স্বর্ণ/রৌপ্য/নগদ) — সব মান একই এককে দিতে হবে।
   *
   * @returns {{gross:number, funeral:number, debt:number, afterDebt:number,
   *            bequestAsked:number, bequestAllowed:number, bequest:number,
   *            bequestCapped:boolean, net:number, insufficient:boolean,
   *            shortfall:number, hasDeduction:boolean}}
   */
  estateAfterDeductions(gross, funeral = 0, debt = 0, bequest = 0) {
    const g = Math.max(0, Number(gross) || 0);
    const f = Math.max(0, Number(funeral) || 0);
    const d = Math.max(0, Number(debt) || 0);
    const bAsked = Math.max(0, Number(bequest) || 0);

    // দাফন-কাফন ও ঋণ মিলে সম্পত্তির চেয়ে বেশি হলে ওয়ারিশরা কিছুই পাবেন না।
    // (ঋণ ওয়ারিশদের নিজের দায় নয় — সম্পত্তি যতটুকু, ততটুকুই যাবে।)
    const need = f + d;
    const insufficient = need > g;
    const afterDebt = insufficient ? 0 : g - need;

    // ওসিয়ত ১/৩ এর বেশি হলে কেটে ১/৩ এ নামানো হয়
    const bequestAllowed = afterDebt * this.BEQUEST_LIMIT;
    const bequestCapped = bAsked > bequestAllowed + 1e-9;
    const b = bequestCapped ? bequestAllowed : bAsked;

    return {
      gross: g,
      funeral: f,
      debt: d,
      afterDebt,
      bequestAsked: bAsked,
      bequestAllowed,
      bequest: b,
      bequestCapped,
      net: Math.max(0, afterDebt - b),
      insufficient,
      shortfall: insufficient ? need - g : 0,
      hasDeduction: (f + d + bAsked) > 0
    };
  },

  // Ana-Gonda Unit Definitions (Base = Til)
  TIL_PER_KRANTI: 20,
  TIL_PER_KORA: 20 * 3,          // 60
  TIL_PER_GONDA: 20 * 3 * 4,      // 240
  TIL_PER_ANA: 20 * 3 * 4 * 20,   // 4800
  TOTAL_TIL_IN_16_ANA: 16 * 4800, // 76,800 Til = 1.0 (Full Share)

  /**
   * Convert Ana, Gonda, Kora, Kranti, Til to Fraction (0.0 to 1.0)
   */
  anaGondaToFraction(ana = 0, gonda = 0, kora = 0, kranti = 0, til = 0) {
    const totalTil = (ana * this.TIL_PER_ANA) + 
                     (gonda * this.TIL_PER_GONDA) + 
                     (kora * this.TIL_PER_KORA) + 
                     (kranti * this.TIL_PER_KRANTI) + 
                     Number(til);
    return totalTil / this.TOTAL_TIL_IN_16_ANA;
  },

  /**
   * Convert Fraction (0.0 to 1.0) to Ana, Gonda, Kora, Kranti, Til
   */
  fractionToAnaGonda(fraction) {
    let totalTil = Math.round(fraction * this.TOTAL_TIL_IN_16_ANA);
    
    const ana = Math.floor(totalTil / this.TIL_PER_ANA);
    totalTil %= this.TIL_PER_ANA;

    const gonda = Math.floor(totalTil / this.TIL_PER_GONDA);
    totalTil %= this.TIL_PER_GONDA;

    const kora = Math.floor(totalTil / this.TIL_PER_KORA);
    totalTil %= this.TIL_PER_KORA;

    const kranti = Math.floor(totalTil / this.TIL_PER_KRANTI);
    const til = Math.round(totalTil % this.TIL_PER_KRANTI);

    return { ana, gonda, kora, kranti, til };
  },

  /**
   * Format Ana-Gonda into readable Bengali string
   */
  formatAnaGondaString(ana, gonda, kora, kranti, til) {
    return `${toBn(ana)} আনা ${toBn(gonda)} গন্ডা ${toBn(kora)} কড়া ${toBn(kranti)} ক্রান্তি ${toBn(til)} তিল`;
  },

  /**
   * Convert Land Area between units
   */
  convertArea(value, fromUnit) {
    let sqft = 0;
    const val = parseFloat(value) || 0;

    switch (fromUnit) {
      case 'satak': sqft = val * this.SQFT_PER_SATAK; break;
      case 'katha': sqft = val * this.SQFT_PER_KATHA; break;
      case 'bigha': sqft = val * this.SQFT_PER_BIGHA; break;
      case 'acre': sqft = val * this.SQFT_PER_ACRE; break;
      case 'sqft': sqft = val; break;
      case 'sqyard': sqft = val * this.SQFT_PER_SQYARD; break;
      case 'sqmeter': sqft = val * this.SQFT_PER_SQMETER; break;
      case 'ajutangsha': sqft = (val / 1000) * this.SQFT_PER_SATAK; break;
      default: sqft = val;
    }

    return {
      satak: (sqft / this.SQFT_PER_SATAK).toFixed(6),
      katha: (sqft / this.SQFT_PER_KATHA).toFixed(4),
      bigha: (sqft / this.SQFT_PER_BIGHA).toFixed(4),
      acre: (sqft / this.SQFT_PER_ACRE).toFixed(4),
      sqft: sqft.toFixed(2),
      sqyard: (sqft / this.SQFT_PER_SQYARD).toFixed(2),
      sqmeter: (sqft / this.SQFT_PER_SQMETER).toFixed(2),
      ajutangsha: ((sqft / this.SQFT_PER_SATAK) * 1000).toFixed(2)
    };
  },

  /**
   * যেকোনো ধরনের হিস্যাকে ভগ্নাংশে (০–১) রূপান্তর করে।
   * হিস্যা ক্যালকুলেটর ও খতিয়ান বিশ্লেষণ — দুটোই এটি ব্যবহার করে।
   *
   * @param {string} type  'anagonda' | 'percent' | 'decimal' | 'fraction'
   * @param {object} d     ঐ ধরনের ইনপুট
   */
  hissaToFraction(type, d = {}) {
    switch (type) {
      case 'percent':
        return (parseFloat(d.percent) || 0) / 100;
      case 'decimal':
        return parseFloat(d.decimal) || 0;
      case 'fraction': {
        const num = parseFloat(d.num) || 0;
        const den = parseFloat(d.den) || 0;
        return den !== 0 ? num / den : 0;
      }
      case 'anagonda':
      default:
        return this.anaGondaToFraction(
          d.ana || 0, d.gonda || 0, d.kora || 0, d.kranti || 0, d.til || 0
        );
    }
  },

  /**
   * দশমিককে সরল ভগ্নাংশে ভাঙে — { n, d } আকারে (সংখ্যায়, বাংলা টেক্সটে নয়)।
   * ধরন বদলানোর সময় মান ধরে রাখতে কাজে লাগে।
   */
  toFractionParts(x, maxDen = 5040) {
    if (!isFinite(x) || Math.abs(x) < 1e-9) return { n: 0, d: 1 };
    let bn = 0, bd = 1, err = Infinity;
    for (let den = 1; den <= maxDen; den++) {
      const num = Math.round(x * den);
      const e = Math.abs(x - num / den);
      if (e < err - 1e-12) { err = e; bn = num; bd = den; if (e < 1e-10) break; }
    }
    return { n: bn, d: bd };
  },

  /**
   * Dedicated Hissa Share Calculator Engine
   */
  calculateHissaShare(totalLandValue, totalUnit, type, data) {
    const convertedTotal = this.convertArea(totalLandValue, totalUnit);
    const totalSatak = parseFloat(convertedTotal.satak) || 0;
    const fraction = this.hissaToFraction(type, data);

    const shareSatak = totalSatak * fraction;
    const resConverted = this.convertArea(shareSatak, 'satak');
    const anaGondaRes = this.fractionToAnaGonda(fraction);

    return {
      fractionPercent: toBn((fraction * 100).toFixed(3)) + '%',
      anaGondaStr: this.formatAnaGondaString(anaGondaRes.ana, anaGondaRes.gonda, anaGondaRes.kora, anaGondaRes.kranti, anaGondaRes.til),
      satak: toBn(resConverted.satak),
      katha: toBn(resConverted.katha),
      bigha: toBn(resConverted.bigha),
      sqft: toBn(resConverted.sqft),
      sqyard: toBn(resConverted.sqyard),
      ajutangsha: toBn(resConverted.ajutangsha)
    };
  },

  /**
   * খতিয়ানের মালিকদের হিস্যা বিশ্লেষণ।
   *
   * প্রতিটি মালিকের হিস্যা যেকোনো ধরনে দেওয়া যায় —
   * আনা-গণ্ডা, শতকরা, দশমিক বা ভগ্নাংশ (`owner.type`)।
   * ধরন না দিলে ডিফল্ট আনা-গণ্ডা ধরা হয় (পুরনো কোডের সাথে সামঞ্জস্য)।
   *
   * ফলাফলে সবসময় আনা-গণ্ডা সমতুল্য (`anaStr`) দেখানো হয় — যে ধরনেই
   * ইনপুট দেওয়া হোক, খতিয়ানের প্রচলিত ভাষায় বোঝা যায়।
   */
  calculateKhotian(totalLandSatak, ownersList) {
    const totalSqft = (parseFloat(totalLandSatak) || 0) * this.SQFT_PER_SATAK;
    let totalFractionSum = 0;

    const results = ownersList.map((owner, idx) => {
      const frac = this.hissaToFraction(owner.type || 'anagonda', owner);
      totalFractionSum += frac;

      const ownerSqft = totalSqft * frac;
      const ownerSatak = ownerSqft / this.SQFT_PER_SATAK;
      const ownerKatha = ownerSqft / this.SQFT_PER_KATHA;

      // ইনপুটের ধরন যাই হোক, আনা-গণ্ডা সমতুল্য বের করি
      const ag = this.fractionToAnaGonda(frac);
      const fp = this.toFractionParts(frac);

      return {
        id: idx + 1,
        serial: toBn(idx + 1),
        name: owner.name || `মালিক ${toBn(idx + 1)}`,
        anaStr: this.formatAnaGondaString(ag.ana, ag.gonda, ag.kora, ag.kranti, ag.til),
        fractionStr: fp.n === 0 ? '০' : `${toBn(fp.n)}/${toBn(fp.d)}`,
        fraction: frac,
        decimalStr: toBn(frac.toFixed(4)),          // অংশ (দশমিক)
        fractionPercent: toBn((frac * 100).toFixed(2)) + '%',
        satak: toBn(ownerSatak.toFixed(3)),
        katha: toBn(ownerKatha.toFixed(3)),
        sqft: toBn(ownerSqft.toFixed(2))
      };
    });

    // মোট সারির জন্য যোগফল
    const sumSatak = results.reduce((a, r, i) =>
      a + (totalSqft * (ownersList[i] ? this.hissaToFraction(ownersList[i].type || 'anagonda', ownersList[i]) : 0)) / this.SQFT_PER_SATAK, 0);
    const sumSqft = sumSatak * this.SQFT_PER_SATAK;

    return {
      results,
      totalLandSatak,
      totalFraction: totalFractionSum,
      totals: {
        decimalStr: toBn(totalFractionSum.toFixed(4)),
        percentStr: toBn((totalFractionSum * 100).toFixed(2)) + '%',
        anaStr: toBn((totalFractionSum * 16).toFixed(2)) + ' আনা',
        satak: toBn(sumSatak.toFixed(3)),
        katha: toBn((sumSqft / this.SQFT_PER_KATHA).toFixed(3)),
        sqft: toBn(sumSqft.toFixed(2))
      },
      totalFractionSum: toBn((totalFractionSum * 16).toFixed(2)) + ' আনা (' + toBn((totalFractionSum * 100).toFixed(2)) + '%)',
      isExact: Math.abs(totalFractionSum - 1.0) < 0.001
    };
  },

  /* ======================================================================
     দাগ পোরশন — দাগের মধ্যে অত্র খতিয়ানের অংশ
     সূত্র:  অংশ = আবেদিত জমি ÷ দাগের মোট জমি
     ====================================================================== */
  calculateDagPortion(dagTotal, applied) {
    const total = parseFloat(dagTotal) || 0;
    const part = parseFloat(applied) || 0;
    const frac = total > 0 ? part / total : 0;
    const ag = this.fractionToAnaGonda(frac);
    const fp = this.toFractionParts(frac);

    return {
      fraction: frac,
      decimalStr: toBn(frac.toFixed(6)),
      percentStr: toBn((frac * 100).toFixed(3)) + '%',
      fractionStr: fp.n === 0 ? '০' : `${toBn(fp.n)}/${toBn(fp.d)}`,
      anaStr: this.formatAnaGondaString(ag.ana, ag.gonda, ag.kora, ag.kranti, ag.til),
      // আবেদিত জমি দাগের চেয়ে বেশি হলে সতর্ক করা দরকার
      isOver: part > total && total > 0,
      isValid: total > 0
    };
  },

  /* ======================================================================
     তফসিল বন্টন — নামজারির আবেদনে একাধিক গ্রহীতার অংশ নির্ণয়
     সূত্র:  নির্ণেয় অংশ = (মালিকের জমি ÷ মোট জমি) × টার্গেট অংশ

     খতিয়ান বিশ্লেষণের ঠিক উল্টো —
       খতিয়ান: হিস্যা দেওয়া থাকে → জমি বের হয়
       তফসিল : জমি দেওয়া থাকে   → হিস্যা বের হয়

     @param {Array}  owners      [{ name, land }]
     @param {number} targetShare খতিয়ানে মোট কত অংশ বসবে (ডিফল্ট ১.০)
     @param {number} totalLand   মোট জমি; না দিলে মালিকদের যোগফল ধরা হয়
     ====================================================================== */
  calculateTofasil(owners, targetShare = 1, totalLand = null) {
    const list = (owners || []).map(o => ({
      name: o.name || '',
      land: parseFloat(o.land) || 0
    }));

    const sumLand = list.reduce((a, o) => a + o.land, 0);
    const base = (totalLand !== null && parseFloat(totalLand) > 0)
      ? parseFloat(totalLand) : sumLand;
    const target = parseFloat(targetShare) || 1;

    let shareSum = 0;
    const results = list.map((o, i) => {
      const share = base > 0 ? (o.land / base) * target : 0;
      shareSum += share;
      const ag = this.fractionToAnaGonda(share / (target || 1));
      const fp = this.toFractionParts(share);
      const conv = this.convertArea(o.land, 'satak');

      return {
        id: i + 1,
        serial: toBn(i + 1),
        name: o.name || `গ্রহীতা ${toBn(i + 1)}`,
        land: o.land,
        landStr: toBn(o.land.toFixed(4)),
        share,
        shareStr: toBn(share.toFixed(6)),
        sharePercent: toBn((share * 100).toFixed(3)) + '%',
        fractionStr: fp.n === 0 ? '০' : `${toBn(fp.n)}/${toBn(fp.d)}`,
        anaStr: this.formatAnaGondaString(ag.ana, ag.gonda, ag.kora, ag.kranti, ag.til),
        katha: toBn(conv.katha),
        sqft: toBn(conv.sqft)
      };
    });

    const totalConv = this.convertArea(sumLand, 'satak');
    return {
      results,
      base,
      target,
      totals: {
        landStr: toBn(sumLand.toFixed(4)),
        shareStr: toBn(shareSum.toFixed(6)),
        sharePercent: toBn((shareSum * 100).toFixed(3)) + '%',
        katha: toBn(totalConv.katha),
        sqft: toBn(totalConv.sqft)
      },
      // মালিকদের যোগফল মোট জমির সমান কি না
      isExact: base > 0 && Math.abs(sumLand - base) < 1e-6,
      leftover: base - sumLand
    };
  },

  /* ======================================================================
     অনুপাত ক্যালকুলেটর — প্রদত্ত পরিমাণগুলোর অনুপাতে টার্গেট ভাগ করে
     ====================================================================== */
  calculateRatio(amounts, target = null) {
    const list = (amounts || []).map(v => parseFloat(v) || 0);
    const sum = list.reduce((a, b) => a + b, 0);
    const t = (target !== null && parseFloat(target) > 0) ? parseFloat(target) : sum;

    const results = list.map((v, i) => {
      const ratio = sum > 0 ? v / sum : 0;
      return {
        id: i + 1,
        serial: toBn(i + 1),
        input: v,
        inputStr: toBn(v.toFixed(4)),
        ratio,
        ratioStr: toBn(ratio.toFixed(6)),
        percentStr: toBn((ratio * 100).toFixed(3)) + '%',
        result: ratio * t,
        resultStr: toBn((ratio * t).toFixed(4))
      };
    });

    // সরল অনুপাত (যেমন ২ : ১ : ১) — গসাগু দিয়ে ছোট করা
    const gcd = (a, b) => b < 1e-9 ? a : gcd(b, a % b);
    let simple = '—';
    if (sum > 0) {
      const parts = list.map(v => this.toFractionParts(v / sum));
      const lcm = parts.reduce((a, p) => a * p.d / gcd(a, p.d), 1);
      if (lcm <= 100000) {
        const nums = parts.map(p => Math.round(p.n * lcm / p.d));
        const g = nums.reduce((a, b) => gcd(a, b), nums[0] || 1) || 1;
        simple = nums.map(n => toBn(Math.round(n / g))).join(' : ');
      }
    }

    return {
      results,
      sum,
      sumStr: toBn(sum.toFixed(4)),
      target: t,
      targetStr: toBn(t.toFixed(4)),
      simpleRatio: simple
    };
  },

  /**
   * নিরাপদ গাণিতিক এক্সপ্রেশন হিসাব (যেমন "54+52+69*5/8")।
   * eval() ব্যবহার করা হয় না — কেবল সংখ্যা ও + - * / ( ) . অনুমোদিত।
   */
  evalExpression(expr) {
    const src = toEn(String(expr || '')).replace(/[০-৯]/g, '').trim();
    if (!src) return { ok: false, value: 0, error: '' };
    if (!/^[0-9+\-*/().\s]+$/.test(src)) {
      return { ok: false, value: 0, error: 'কেবল সংখ্যা ও + − × ÷ ( ) ব্যবহার করা যাবে' };
    }
    try {
      // Function কনস্ট্রাক্টর, তবে ইনপুট আগেই কঠোরভাবে ছাঁকা
      const v = Function('"use strict";return (' + src + ')')();
      if (typeof v !== 'number' || !isFinite(v)) {
        return { ok: false, value: 0, error: 'সমীকরণটি ঠিক নয়' };
      }
      return { ok: true, value: v, error: '' };
    } catch (e) {
      return { ok: false, value: 0, error: 'সমীকরণটি ঠিক নয়' };
    }
  },

  /**
   * দশমিক অংশকে সহজ ভগ্নাংশে রূপান্তর করে (যেমন ০.১২৫ → ১/৮)
   * ফরায়েজের অংশ সাধারণত ছোট হরবিশিষ্ট হয়, তাই maxDen ৫০৪০ যথেষ্ট।
   */
  toFractionBn(x, maxDen = 5040) {
    if (!isFinite(x) || Math.abs(x) < 1e-9) return '০';
    if (Math.abs(x - 1) < 1e-9) return '১';

    let bestN = 0, bestD = 1, bestErr = Infinity;
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(x * d);
      const err = Math.abs(x - n / d);
      if (err < bestErr - 1e-12) {
        bestErr = err; bestN = n; bestD = d;
        if (err < 1e-10) break;
      }
    }
    if (bestErr > 1e-6) return null; // সরল ভগ্নাংশে বসছে না
    return bestD === 1 ? toBn(bestN) : `${toBn(bestN)}/${toBn(bestD)}`;
  },

  /**
   * Quadrilateral Area via 4 sides + 1 Diagonal (Heron's Formula)
   */
  calculateQuadrilateral(a, b, c, d, diag) {
    a = parseFloat(a); b = parseFloat(b); c = parseFloat(c); d = parseFloat(d); diag = parseFloat(diag);
    if (!a || !b || !c || !d || !diag) return null;

    const s1 = (a + b + diag) / 2;
    const area1 = Math.sqrt(s1 * (s1 - a) * (s1 - b) * (s1 - diag));

    const s2 = (c + d + diag) / 2;
    const area2 = Math.sqrt(s2 * (s2 - c) * (s2 - d) * (s2 - diag));

    if (isNaN(area1) || isNaN(area2)) return null;

    const totalSqft = area1 + area2;
    return this.convertArea(totalSqft, 'sqft');
  }
};
