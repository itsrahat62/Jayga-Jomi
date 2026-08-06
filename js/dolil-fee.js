/* ==========================================================================
   দলিল রেজিস্ট্রেশন খরচ ক্যালকুলেটর — বাংলাদেশ
   ==========================================================================

   📄 তথ্যসূত্র (অফিসিয়াল):
   নিবন্ধন অধিদপ্তর (rd.gov.bd) — "দলিল রেজিস্ট্রেশন সংক্রান্ত ফিস,
   স্ট্যাম্প শুল্ক ও করাদির হার", প্রকাশ: ১৬ সেপ্টেম্বর ২০২৫।
   https://rd.gov.bd/pages/static-pages/6922dc81933eb65569e10b8b

   উৎসে করের হার আয়কর আইন, ২০২৩ এর ধারা ১২৫ ও ১২৬ অনুযায়ী —
   উক্ত প্রজ্ঞাপনের সারণি ০১ থেকে ০৫ এ বর্ণিত।

   ⚠️ সরকার যেকোনো সময় হার বদলাতে পারে। ব্যবহারের আগে উপরের
      অফিসিয়াল তালিকা মিলিয়ে নিতে হবে।

   DOM ছোঁয় না — tests/dolil-test.js দিয়ে যাচাইযোগ্য।
   ========================================================================== */

const DolilFee = {

  SOURCE: {
    title: 'দলিল রেজিস্ট্রেশন সংক্রান্ত ফিস, স্ট্যাম্প শুল্ক ও করাদির হার',
    authority: 'নিবন্ধন অধিদপ্তর',
    date: '১৬ সেপ্টেম্বর ২০২৫',
    url: 'https://rd.gov.bd/pages/static-pages/6922dc81933eb65569e10b8b'
  },

  SQFT_PER_SQM: 10.7639,

  /* ======================================================================
     দলিলের ধরন
     stamp   : {pct, max} | {flat} | {slabs}
     aFee    : {pct, min, max} | {flat} | {slabs}
     valueOf : কোন অঙ্কের উপর হিসাব হবে —
               'property' (সম্পত্তির মূল্য) | 'loan' (ঋণ) | 'consideration' (পণমূল্য)
     ====================================================================== */
  DEED_TYPES: [
    { id: 'saf_kabla', sl: '০১', name: 'সাফ কবলা (ক্রয়-বিক্রয়)',
      stamp: { pct: 1.5, max: 20000000 }, aFee: { pct: 1, min: 100 },
      localTax: true, srcTax125: true, srcTax126: true, vat: true,
      note: 'সাধারণ জমি বিক্রয় দলিল — সবচেয়ে বেশি ব্যবহৃত।' },

    { id: 'ewaj', sl: '০২', name: 'এওয়াজ বা বিনিময়',
      stamp: { pct: 1, max: 10000000 }, aFee: { pct: 1, min: 100 },
      localTax: true, srcTax125: false, srcTax126: false, vat: false,
      valueNote: 'বৃহত্তর এক পক্ষের মূল্য বাদ দিয়ে সম্পত্তির মূল্য দিন।',
      note: 'সম্পত্তি অদল-বদল।' },

    { id: 'danpotro', sl: '০৩', name: 'দানপত্র',
      stamp: { pct: 1.5 }, aFee: { pct: 1, min: 100 },
      localTax: true, srcTax125: false, srcTax126: false, vat: false,
      note: 'দান করে দেওয়া সম্পত্তি।' },

    { id: 'heba_ewaj', sl: '০৪', name: 'হেবাবিল এওয়াজ',
      stamp: { pct: 1.5 }, aFee: { pct: 1, min: 100 },
      localTax: true, srcTax125: false, srcTax126: false, vat: false,
      note: 'বিনিময়ের শর্তে হেবা।' },

    { id: 'waqf', sl: '০৫', name: 'ওয়াকফ দলিল',
      stamp: { pct: 1.5 }, aFee: { pct: 1, min: 100 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'ওয়াকফ লিল্লাহর ক্ষেত্রে স্থানীয় সরকার কর প্রযোজ্য নয়।' },

    { id: 'heba_ghoshona', sl: '০৬', name: 'হেবার ঘোষণাপত্র',
      stamp: { flat: 1000 }, aFee: { flat: 100 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'নির্দিষ্ট আত্মীয়তার সম্পর্কে প্রযোজ্য। স্ট্যাম্প ১,০০০ ও এ-ফি ১০০ টাকা।' },

    { id: 'dan_ghoshona', sl: '০৬', name: 'দানের ঘোষণাপত্র',
      stamp: { flat: 1000 }, aFee: { flat: 100 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'হিন্দু, খ্রিষ্টান ও বৌদ্ধ ধর্মাবলম্বীদের নির্দিষ্ট সম্পর্কে প্রযোজ্য।' },

    { id: 'ghoshona', sl: '০৬', name: 'ঘোষণাপত্র',
      stamp: { flat: 1000 }, aFee: { flat: 100 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'সাধারণ ঘোষণাপত্র।' },

    { id: 'bontonnama', sl: '০৭', name: 'বন্টননামা / বাটোয়ারা',
      stamp: { flat: 100 },
      aFee: { slabs: [
        { upto: 300000, fee: 500 }, { upto: 1000000, fee: 700 },
        { upto: 3000000, fee: 1200 }, { upto: 5000000, fee: 1800 },
        { upto: Infinity, fee: 2000 } ] },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'এ-ফি সম্পত্তির মূল্য অনুযায়ী ধাপে ধাপে।' },

    { id: 'baynanama', sl: '০৮', name: 'বায়নাপত্র',
      stamp: { flat: 300 },
      aFee: { slabs: [
        { upto: 500000, fee: 500 }, { upto: 5000000, fee: 1000 },
        { upto: Infinity, fee: 2000 } ] },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'উভয়পক্ষ দ্বারা সম্পাদিত হবে।' },

    { id: 'bayna_batil', sl: '০৯', name: 'বায়না রহিতকরণপত্র (বাতিল)',
      stamp: { flat: 500 }, aFee: { flat: 100 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'ই-ফি ১০০ টাকা; এন ও ই ফি সাফ কবলার ন্যায়।' },

    { id: 'mortgage', sl: '১০', name: 'বন্ধকী দলিল (ব্যাংক/আর্থিক প্রতিষ্ঠানের অনুকূলে)',
      valueOf: 'loan',
      stamp: { slabs: [
        { upto: 5000000, fee: 2000 }, { upto: 10000000, fee: 5000 },
        { upto: Infinity, fee: 5000 } ] },
      aFee: { slabs: [
        { upto: 500000, pct: 1, min: 200, max: 500 },
        { upto: 2000000, pct: 0.25, min: 1500, max: 2000 },
        { upto: Infinity, pct: 0.25, min: 1500, max: 2000 } ] },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'মঞ্জুরিকৃত ঋণের পরিমাণের উপর হিসাব হয়। ১ কোটির ঊর্ধ্বে হলে সাব-রেজিস্ট্রি অফিসে যাচাই করুন।' },

    { id: 'redemption', sl: '১১', name: 'বন্ধকী সম্পত্তির রিডেমশন',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'ঋণ পরিশোধের পর বন্ধক মুক্তি।' },

    { id: 'nadabi', sl: '১২', name: 'নাদাবীপত্র / মুক্তিপত্র',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'দাবি ত্যাগের দলিল।' },

    { id: 'chuktipotro', sl: '১৩', name: 'চুক্তিপত্র',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'সাধারণ চুক্তি।' },

    { id: 'vrom_shongshodhon', sl: '১৪', name: 'ভ্রম সংশোধন',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'পূর্ববর্তী দলিলের ভুল সংশোধন।' },

    { id: 'will', sl: '২৬', name: 'উইল',
      stamp: { flat: 0 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'স্ট্যাম্প শুল্ক প্রযোজ্য নয়। সি-ফিস ২০০ টাকা।' },

    { id: 'osiyot', sl: '১৫', name: 'অছিয়তনামা',
      stamp: { flat: 0 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'স্ট্যাম্প শুল্ক প্রযোজ্য নয়।' },

    { id: 'poa_irrevocable_paid', sl: '১৬', name: 'অপ্রত্যাহারযোগ্য পাওয়ার অব অ্যাটর্নি (পণমূল্যের বিনিময়ে)',
      valueOf: 'consideration',
      stamp: { pct: 1.5, max: 20000000 }, aFee: { pct: 1, min: 100 },
      localTax: true, srcTax125: true, srcTax126: false, vat: false,
      note: 'পণমূল্যের বিনিময়ে হলে সাফ কবলার ন্যায় হিসাব।' },

    { id: 'poa_irrevocable_free', sl: '১৭', name: 'অপ্রত্যাহারযোগ্য পাওয়ার অব অ্যাটর্নি (পণমূল্য ব্যতীত)',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false,
      note: 'পণমূল্য না থাকলে নির্দিষ্ট হার।' },

    { id: 'poa_bank', sl: '১৮', name: 'অপ্রত্যাহারযোগ্য পাওয়ার অব অ্যাটর্নি (ব্যাংক/আর্থিক প্রতিষ্ঠানের অনুকূলে)',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false, note: '' },

    { id: 'poa_general', sl: '১৯', name: 'সাধারণ পাওয়ার অব অ্যাটর্নি',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false, note: '' },

    { id: 'poa_special', sl: '২০', name: 'বিশেষ পাওয়ার অব অ্যাটর্নি',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false, note: '' },

    { id: 'poa_cancel', sl: '২১', name: 'পাওয়ার অব অ্যাটর্নি বাতিলকরণ',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false, note: '' },

    { id: 'bohalkoron', sl: '২২', name: 'বহালকরণপত্র',
      stamp: { flat: 300 }, aFee: { flat: 200 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false, note: '' },

    { id: 'trust', sl: '২৩', name: 'ট্রাস্ট দলিল',
      stamp: { pct: 1.5 }, aFee: { pct: 1, min: 100 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false, note: '' },

    { id: 'lease', sl: '২৭', name: 'ইজারা বা লিজ',
      stamp: { leaseSlabs: true }, aFee: { pct: 1, min: 100 },
      localTax: true, srcTax125: false, srcTax126: false, vat: false, lease: true,
      note: 'ইজারার মেয়াদ অনুযায়ী স্ট্যাম্প শুল্ক ০.১% থেকে ০.৪%। ১০ বছরের বেশি মেয়াদে অতিরিক্ত ৪% কর।' },

    { id: 'nokol', sl: '২৮', name: 'অনুলিপি / নকল (Copy)',
      stamp: { copyStamp: true }, aFee: { flat: 0 },
      localTax: false, srcTax125: false, srcTax126: false, vat: false, copy: true,
      note: 'মূল দলিলের স্ট্যাম্প ১,০০০ বা তদনিম্ন হলে ১০০ টাকা, অন্যথায় ২০০ টাকা। কোর্ট ফি ২০ টাকা।' }
  ],

  /* ইজারার মেয়াদ অনুযায়ী স্ট্যাম্প (ক্রমিক ২৭) */
  LEASE_TERMS: [
    { id: 'upto5', name: '৫ বছর পর্যন্ত', pct: 0.1, max: 2000000 },
    { id: 'upto25', name: '৫ বছরের বেশি, ২৫ বছর পর্যন্ত', pct: 0.2, max: 10000000 },
    { id: 'above25', name: '২৫ বছরের বেশি বা চিরস্থায়ী', pct: 0.3, max: 20000000 },
    { id: 'other', name: 'অন্যান্য ক্ষেত্রে', pct: 0.4, max: 30000000 }
  ],

  /* ---------------------------------------------------------------------
     স্থানীয় সরকার কর
     --------------------------------------------------------------------- */
  LOCAL_TAX: [
    { id: 'union', name: 'ইউনিয়ন / উপজেলা / জেলা / ক্যান্টনমেন্ট বোর্ড', pct: 3 },
    { id: 'city', name: 'সিটি কর্পোরেশন / ক্যান্টনমেন্ট বোর্ড (উপজেলাধীন নয়)', pct: 2 }
  ],

  /* ---------------------------------------------------------------------
     এলাকার শ্রেণি — সারণি-১ এর কলাম
     --------------------------------------------------------------------- */
  LAND_CLASSES: [
    { id: 'ka', name: 'ক-শ্রেণি — রাজউক/গৃহায়ন/গণপূর্ত/ক্যান্টনমেন্ট বোর্ড নিয়ন্ত্রণাধীন বাণিজ্যিক প্লট' },
    { id: 'kha', name: 'খ-শ্রেণি — ঐ কর্তৃপক্ষের নিয়ন্ত্রণাধীন আবাসিক প্লট' },
    { id: 'ga', name: 'গ-শ্রেণি — ডেভেলপার/রিয়েল এস্টেট প্রতিষ্ঠিত এলাকার বাণিজ্যিক প্লট' },
    { id: 'gha', name: 'ঘ-শ্রেণি — ডেভেলপার/রিয়েল এস্টেট প্রতিষ্ঠিত এলাকার আবাসিক প্লট' },
    { id: 'uo', name: 'ঙ-শ্রেণি — শিল্প প্লট' },
    { id: 'cho', name: 'চ-শ্রেণি — উপরের কোনোটি নয়, অন্যান্য এলাকা' }
  ],

  /* ---------------------------------------------------------------------
     সারণি ০১ ও ০২ — উৎসে কর (ধারা ১২৫), জমির ক্ষেত্রে
     নিয়ম: দলিল মূল্যের নির্দিষ্ট % অথবা শতকপ্রতি নির্দিষ্ট টাকা — যেটি বেশি
     rates = [ক, খ, গ, ঘ, ঙ, চ] শ্রেণির শতকপ্রতি টাকা
     --------------------------------------------------------------------- */
  LAND_AREAS: [
    { id: 'a1', pct: 5, rates: [900000, 350000, 900000, 350000, 500000, 300000],
      name: 'ঢাকা — গুলশান, বনানী, মতিঝিল ও তেজগাঁও থানার সকল মৌজা' },
    { id: 'a2', pct: 5, rates: [650000, 300000, 650000, 300000, 300000, 200000],
      name: 'ঢাকা — ধানমন্ডি, ওয়ারী, তেজগাঁও শিল্পাঞ্চল, শাহবাগ, রমনা, পল্টন, বংশাল, নিউমার্কেট, কলাবাগান' },
    { id: 'a3', pct: 5, rates: [400000, 175000, 400000, 175000, 175000, 85000],
      name: 'ঢাকা — কাফরুল, মোহাম্মদপুর, সূত্রাপুর, যাত্রাবাড়ী, উত্তরা, ক্যান্টনমেন্ট, চকবাজার, কোতোয়ালী, লালবাগ, খিলগাঁও, শ্যামপুর, গেন্ডারিয়া' },
    { id: 'a4', pct: 5, rates: [350000, 150000, 350000, 150000, 150000, 75000],
      name: 'ঢাকা — খিলক্ষেত, বিমানবন্দর, উত্তরা পশ্চিম, মুগদা, রূপনগর, ভাষানটেক, বাড্ডা, পল্লবী, ভাটারা, শাহজাহানপুর, মিরপুর, দারুস সালাম, দক্ষিণখান, উত্তরখান, তুরাগ, শাহ আলী, সবুজবাগ, কদমতলী, কামরাঙ্গীরচর, হাজারীবাগ, ডেমরা, আদাবর; নারায়ণগঞ্জ সদর' },
    { id: 'a5', pct: 3, rates: [175000, 70000, 175000, 70000, 70000, 35000],
      name: 'চট্টগ্রাম — খুলশী, পাঁচলাইশ, পাহাড়তলী, হালিশহর, কোতোয়ালী; নারায়ণগঞ্জ — সোনারগাঁও, ফতুল্লা, সিদ্ধিরগঞ্জ, বন্দর; গাজীপুর — সদর, বাসন, কোনাবাড়ী, গাছা, টঙ্গী পূর্ব ও পশ্চিম' },
    { id: 'a6', pct: 3, rates: [125000, 60000, 125000, 60000, 60000, 30000],
      name: 'ঢাকা — দোহার, নবাবগঞ্জ, কেরানীগঞ্জ, সাভার, ধামরাই; চট্টগ্রাম — আকবরশাহ, ইপিজেড, কর্ণফুলী, চকবাজার, চান্দগাঁও, ডবলমুরিং, পতেঙ্গা, বন্দর, বাকলিয়া, বায়েজিদ বোস্তামী, সদরঘাট; নারায়ণগঞ্জ — রূপগঞ্জ, আড়াইহাজার' },
    { id: 'a7', pct: 3, rates: [100000, 50000, 100000, 50000, 50000, 25000],
      name: 'উপরের ১–৬ এর বাইরে — অন্যান্য সিটি কর্পোরেশন, উন্নয়ন কর্তৃপক্ষ ও জেলা সদরের সকল পৌরসভা' },
    { id: 'b1', pct: 2, flat: 10000,
      name: 'সারণি-১ এর বাইরে অন্য যেকোনো পৌরসভার সকল মৌজা' },
    { id: 'b2', pct: 2, flat: 500,
      name: 'উপরের কোনোটি নয় — সকল উপজেলা (পৌরসভা ব্যতীত)' }
  ],

  /* ---------------------------------------------------------------------
     সারণি ০৩ — উৎসে কর (ধারা ১২৫), স্থাপনা/ফ্ল্যাটের ক্ষেত্রে
     প্রতি বর্গমিটার নির্দিষ্ট টাকা অথবা দলিল মূল্যের % — যেটি বেশি
     --------------------------------------------------------------------- */
  BUILDING_125: [
    { id: 's1', perSqm: 800, pct: 8, name: 'ক ও খ শ্রেণির ভূমিতে অবস্থিত স্থাপনা' },
    { id: 's2', perSqm: 500, pct: 6, name: 'ঙ শ্রেণির ভূমিতে এবং সারণি-২ ক্রমিক ১ এর মৌজায় অবস্থিত' },
    { id: 's3', perSqm: 300, pct: 6, name: 'অন্যান্য ক্ষেত্রে' }
  ],

  /* ---------------------------------------------------------------------
     সারণি ০৪ — উৎসে আয়কর (ধারা ১২৬), ডেভেলপারের ভবন/অ্যাপার্টমেন্ট
     প্রতি বর্গমিটার টাকা [আবাসিক, বাণিজ্যিক]
     --------------------------------------------------------------------- */
  BUILDING_126: [
    { id: 'd1', res: 1600, com: 6500, name: 'ঢাকা — গুলশান, বনানী, মতিঝিল, তেজগাঁও' },
    { id: 'd2', res: 1500, com: 5000, name: 'ঢাকা — ধানমন্ডি, ওয়ারী, তেজগাঁও শিল্পাঞ্চল, শাহবাগ, রমনা, পল্টন, বংশাল, নিউমার্কেট, কলাবাগান' },
    { id: 'd3', res: 1400, com: 4000, name: 'ঢাকা — খিলক্ষেত, কাফরুল, মোহাম্মদপুর, সূত্রাপুর, যাত্রাবাড়ী, উত্তরা, ক্যান্টনমেন্ট, চকবাজার, কোতোয়ালী, লালবাগ, খিলগাঁও, শ্যামপুর, গেন্ডারিয়া' },
    { id: 'd4', res: 1300, com: 3500, name: 'ঢাকা — বিমানবন্দর, উত্তরা পশ্চিম, মুগদা, রূপনগর, ভাষানটেক, বাড্ডা, পল্লবী, ভাটারা, মিরপুর, দারুস সালাম, দক্ষিণখান, উত্তরখান, তুরাগ, শাহ আলী, সবুজবাগ, কদমতলী, কামরাঙ্গীরচর, হাজারীবাগ, ডেমরা, আদাবর; চট্টগ্রাম খুলশী, পাঁচলাইশ, পাহাড়তলী, হালিশহর, কোতোয়ালী; গাজীপুর সদর, বাসন, কোনাবাড়ী, গাছা, টঙ্গী, জয়দেবপুর, কালীগঞ্জ; নারায়ণগঞ্জ সদর, ফতুল্লা, সিদ্ধিরগঞ্জ, বন্দর, রূপগঞ্জ, সোনারগাঁও' },
    { id: 'd5', res: 700, com: 2000, name: 'ঢাকা — দোহার, নবাবগঞ্জ, কেরানীগঞ্জ, সাভার, ধামরাই; চট্টগ্রাম — আকবরশাহ, ইপিজেড, কর্ণফুলী, চান্দগাঁও, ডবলমুরিং, পতেঙ্গা, বন্দর, বাকলিয়া, বায়েজিদ বোস্তামী, সদরঘাট; নারায়ণগঞ্জ আড়াইহাজার; এবং ঢাকা দক্ষিণ/উত্তর, চট্টগ্রাম, নারায়ণগঞ্জ ও গাজীপুর ব্যতীত অন্যান্য সিটি কর্পোরেশন' },
    { id: 'd6', res: 300, com: 1000, name: 'উপরের ১–৫ এর বাইরে সকল এলাকা' }
  ],

  /* সারণি ০৫ — ধারা ১২৬, ডেভেলপারের প্লট/জমি */
  PLOT_126_DISTRICTS: ['ঢাকা', 'গাজীপুর', 'নারায়ণগঞ্জ', 'মুন্সিগঞ্জ', 'মানিকগঞ্জ', 'নরসিংদী', 'চট্টগ্রাম'],
  PLOT_126_HIGH: 5,
  PLOT_126_LOW: 3,

  DISTRICTS: [
    'ঢাকা', 'গাজীপুর', 'নারায়ণগঞ্জ', 'মুন্সিগঞ্জ', 'মানিকগঞ্জ', 'নরসিংদী', 'চট্টগ্রাম',
    'টাঙ্গাইল', 'রাজবাড়ী', 'গোপালগঞ্জ', 'কিশোরগঞ্জ', 'ফরিদপুর', 'মাদারীপুর', 'শরীয়তপুর',
    'রাজশাহী', 'চাঁপাইনবাবগঞ্জ', 'নাটোর', 'বগুড়া', 'পাবনা', 'সিরাজগঞ্জ', 'জয়পুরহাট', 'নওগাঁ',
    'ব্রাহ্মণবাড়িয়া', 'চাঁদপুর', 'কুমিল্লা', 'নোয়াখালী', 'কক্সবাজার', 'ফেনী', 'লক্ষ্মীপুর',
    'খুলনা', 'বাগেরহাট', 'সাতক্ষীরা', 'যশোর', 'ঝিনাইদহ', 'নড়াইল', 'মাগুরা', 'কুষ্টিয়া', 'চুয়াডাঙ্গা', 'মেহেরপুর',
    'বরিশাল', 'পটুয়াখালী', 'পিরোজপুর', 'বরগুনা', 'ঝালকাঠি', 'ভোলা',
    'রংপুর', 'কুড়িগ্রাম', 'লালমনিরহাট', 'গাইবান্ধা', 'নীলফামারী', 'দিনাজপুর', 'ঠাকুরগাঁও', 'পঞ্চগড়',
    'সিলেট', 'মৌলভীবাজার', 'সুনামগঞ্জ', 'হবিগঞ্জ',
    'ময়মনসিংহ', 'নেত্রকোণা', 'জামালপুর', 'শেরপুর'
  ],

  /* জমির পরিমাপের একক → শতক */
  LAND_UNITS: [
    { id: 'satak', name: 'শতাংশ / শতক', toSatak: 1 },
    { id: 'katha', name: 'কাঠা', toSatak: 720 / 435.6 },
    { id: 'ajutangsha', name: 'অযুতাংশ', toSatak: 1 / 1000 },
    { id: 'sqmeter', name: 'বর্গমিটার', toSatak: 10.7639 / 435.6 },
    { id: 'sqft', name: 'বর্গফুট', toSatak: 1 / 435.6 }
  ],

  /* সাধারণ ফি */
  FIXED: {
    holofnama: 300,
    eFee: 100,
    nFeePerPage: 24,
    nnFeePerPage: 36,
    courtFee: 10,
    courtFeeCopy: 20
  },

  VAT: { plot: 2, flatUpto1600: 2, flatAbove1600: 4.5 },

  /* ---------------------------------------------------------------------
     সহায়ক
     --------------------------------------------------------------------- */
  _slab(slabs, value) {
    for (const s of slabs) if (value <= s.upto) return s;
    return slabs[slabs.length - 1];
  },

  toSatak(qty, unitId) {
    const u = this.LAND_UNITS.find(x => x.id === unitId) || this.LAND_UNITS[0];
    return (parseFloat(qty) || 0) * u.toSatak;
  },

  /**
   * মূল হিসাব।
   *
   * @param {object} o
   *   deedType, propertyValue, loanAmount, considerationValue
   *   landQty, landUnit                 — জমির পরিমাণ ও একক
   *   landAreaId, landClassId           — সারণি ১/২ এর এলাকা ও শ্রেণি
   *   localTaxId                        — 'union' | 'city'
   *   district                          — ধারা ১২৬ (প্লট) এর জন্য
   *   sellerIsDeveloper                 — ডেভেলপার/রিয়েল এস্টেট কি না
   *   hasBuilding, buildingSqft, buildingValue
   *   buildingKind                      — 'res' | 'com'
   *   building125Id, building126Id
   *   pages, copies, language           — 'bn' | 'en'
   *   leaseTermId, leaseYearsAbove10
   *   originalStampUpto1000             — নকলের ক্ষেত্রে
   *   vatKind                           — 'plot' | 'flat_upto' | 'flat_above'
   */
  calculate(o = {}) {
    const deed = this.DEED_TYPES.find(d => d.id === o.deedType) || this.DEED_TYPES[0];
    const num = v => Math.max(0, parseFloat(v) || 0);

    const propVal = num(o.propertyValue);
    const loan = num(o.loanAmount);
    const consid = num(o.considerationValue);
    // কোন অঙ্কের উপর স্ট্যাম্প ও এ-ফি হিসাব হবে
    const base = deed.valueOf === 'loan' ? loan
      : deed.valueOf === 'consideration' ? (consid || propVal) : propVal;

    const satak = this.toSatak(o.landQty, o.landUnit);
    const pages = Math.max(1, parseInt(o.pages) || 1);
    const copies = Math.max(0, parseInt(o.copies) || 0);
    const isEnglish = o.language === 'en';

    const items = [];
    const warnings = [];
    const add = (name, amount, detail) =>
      items.push({ name, amount: Math.round(amount * 100) / 100, detail: detail || '' });

    /* ---- ১. স্ট্যাম্প শুল্ক ---- */
    if (deed.stamp.copyStamp) {
      const st = o.originalStampUpto1000 ? 100 : 200;
      add('স্ট্যাম্প শুল্ক', st, o.originalStampUpto1000
        ? 'মূল দলিলের স্ট্যাম্প ১,০০০ টাকা বা তদনিম্ন' : 'অন্যান্য ক্ষেত্রে');
    } else if (deed.stamp.leaseSlabs) {
      const t = this.LEASE_TERMS.find(x => x.id === o.leaseTermId) || this.LEASE_TERMS[0];
      let st = base * t.pct / 100;
      let detail = `${t.name} — ${this._bn(t.pct)}%`;
      if (st > t.max) { st = t.max; detail += ' (সর্বোচ্চ সীমা প্রয়োগ)'; warnings.push('ইজারার স্ট্যাম্প শুল্ক সর্বোচ্চ সীমায় পৌঁছেছে।'); }
      add('স্ট্যাম্প শুল্ক', st, detail);
    } else if (deed.stamp.slabs) {
      const s = this._slab(deed.stamp.slabs, base);
      add('স্ট্যাম্প শুল্ক', s.fee, 'ঋণের পরিমাণ অনুযায়ী ধাপ');
      if (base > 10000000) warnings.push('১ কোটি টাকার ঊর্ধ্বে বন্ধকী দলিলের স্ট্যাম্প ধাপে ধাপে বাড়ে — সাব-রেজিস্ট্রি অফিসে যাচাই করুন।');
    } else if (deed.stamp.flat !== undefined) {
      if (deed.stamp.flat > 0) add('স্ট্যাম্প শুল্ক', deed.stamp.flat, 'নির্দিষ্ট হার');
      else add('স্ট্যাম্প শুল্ক', 0, 'প্রযোজ্য নয়');
    } else {
      let st = base * deed.stamp.pct / 100;
      let detail = `${deed.valueOf === 'loan' ? 'ঋণের' : 'দলিল মূল্যের'} ${this._bn(deed.stamp.pct)}%`;
      if (deed.stamp.max && st > deed.stamp.max) {
        st = deed.stamp.max; detail += ' (সর্বোচ্চ সীমা প্রয়োগ)';
        warnings.push('স্ট্যাম্প শুল্ক সর্বোচ্চ সীমায় পৌঁছেছে।');
      }
      add('স্ট্যাম্প শুল্ক', st, detail);
    }

    /* ---- ২. হলফনামা ---- */
    if (!deed.copy) add('হলফনামা স্ট্যাম্প', this.FIXED.holofnama, 'নির্দিষ্ট');

    /* ---- ৩. রেজিস্ট্রেশন এ-ফি ---- */
    if (deed.aFee.flat !== undefined) {
      if (deed.aFee.flat > 0) add('রেজিস্ট্রেশন ফি (এ-ফি)', deed.aFee.flat, 'নির্দিষ্ট হার');
    } else if (deed.aFee.slabs) {
      const s = this._slab(deed.aFee.slabs, base);
      if (s.pct !== undefined) {
        let af = base * s.pct / 100;
        let d = `${this._bn(s.pct)}%`;
        if (s.min && af < s.min) { af = s.min; d += ' (সর্বনিম্ন সীমা)'; }
        if (s.max && af > s.max) { af = s.max; d += ' (সর্বোচ্চ সীমা)'; }
        add('রেজিস্ট্রেশন ফি (এ-ফি)', af, d);
      } else {
        add('রেজিস্ট্রেশন ফি (এ-ফি)', s.fee, 'মূল্য অনুযায়ী ধাপ');
      }
    } else {
      let af = base * deed.aFee.pct / 100;
      let d = `${deed.valueOf === 'loan' ? 'ঋণের' : 'দলিল মূল্যের'} ${this._bn(deed.aFee.pct)}%`;
      if (deed.aFee.min && af < deed.aFee.min) { af = deed.aFee.min; d += ' (সর্বনিম্ন সীমা)'; }
      add('রেজিস্ট্রেশন ফি (এ-ফি)', af, d);
    }

    /* ---- ৪. এন-ফি · ই-ফি · এনএন-ফি · কোর্ট ফি ---- */
    const nRate = this.FIXED.nFeePerPage * (isEnglish ? 2 : 1);
    add('এন-ফি', pages * nRate,
      `${this._bn(pages)} পৃষ্ঠা × ${this._bn(nRate)} টাকা${isEnglish ? ' (ইংরেজি দলিলে দ্বিগুণ)' : ''}`);
    add('ই-ফি', this.FIXED.eFee, 'নির্দিষ্ট');
    if (copies > 0) {
      const nnRate = this.FIXED.nnFeePerPage * (isEnglish ? 2 : 1);
      add('এনএন-ফি (নকল)', copies * nnRate, `${this._bn(copies)} পৃষ্ঠা × ${this._bn(nnRate)} টাকা`);
    }
    add('কোর্ট ফি', deed.copy ? this.FIXED.courtFeeCopy : this.FIXED.courtFee, 'নির্দিষ্ট');

    /* ---- ৫. স্থানীয় সরকার কর ---- */
    if (deed.localTax) {
      const lt = this.LOCAL_TAX.find(x => x.id === o.localTaxId) || this.LOCAL_TAX[0];
      add('স্থানীয় সরকার কর', base * lt.pct / 100, `${lt.name} — ${this._bn(lt.pct)}%`);
    }

    /* ---- ৬. উৎসে কর — ধারা ১২৫ (জমি) ---- */
    if (deed.srcTax125) {
      const area = this.LAND_AREAS.find(a => a.id === o.landAreaId) || this.LAND_AREAS[this.LAND_AREAS.length - 1];
      const ci = Math.max(0, this.LAND_CLASSES.findIndex(c => c.id === (o.landClassId || 'cho')));
      const perSatak = area.flat !== undefined ? area.flat : area.rates[ci];

      const byPct = base * area.pct / 100;
      const byArea = perSatak * satak;
      const src = Math.max(byPct, byArea);
      add('উৎসে কর — ভূমি (ধারা ১২৫)', src,
        byArea > byPct
          ? `শতকপ্রতি ${this._bn(this._money(perSatak))} × ${this._bn(satak.toFixed(3))} শতক (${this._bn(area.pct)}% এর চেয়ে বেশি)`
          : `দলিল মূল্যের ${this._bn(area.pct)}%`);

      /* স্থাপনা থাকলে সারণি-৩ */
      if (o.hasBuilding) {
        const bv = num(o.buildingValue);
        const sqm = num(o.buildingSqft) / this.SQFT_PER_SQM;
        const b = this.BUILDING_125.find(x => x.id === o.building125Id) || this.BUILDING_125[2];
        const byArea2 = b.perSqm * sqm;
        const byPct2 = bv * b.pct / 100;
        add('উৎসে কর — স্থাপনা (ধারা ১২৫)', Math.max(byArea2, byPct2),
          byArea2 > byPct2
            ? `প্রতি বর্গমিটার ${this._bn(this._money(b.perSqm))} × ${this._bn(sqm.toFixed(2))} বর্গমিটার`
            : `স্থাপনার মূল্যের ${this._bn(b.pct)}%`);
      }
    }

    /* ---- ৭. উৎসে আয়কর — ধারা ১২৬ (ডেভেলপার) ---- */
    if (deed.srcTax126 && o.sellerIsDeveloper) {
      const high = this.PLOT_126_DISTRICTS.includes(o.district);
      const pct = high ? this.PLOT_126_HIGH : this.PLOT_126_LOW;
      add('উৎসে আয়কর — প্লট (ধারা ১২৬)', base * pct / 100,
        `${o.district || 'অন্যান্য জেলা'} — দলিল মূল্যের ${this._bn(pct)}%`);

      if (o.hasBuilding) {
        const sqm = num(o.buildingSqft) / this.SQFT_PER_SQM;
        const d = this.BUILDING_126.find(x => x.id === o.building126Id) || this.BUILDING_126[5];
        const rate = (o.buildingKind === 'com') ? d.com : d.res;
        add('উৎসে আয়কর — ভবন (ধারা ১২৬)', rate * sqm,
          `${o.buildingKind === 'com' ? 'বাণিজ্যিক' : 'আবাসিক'} — প্রতি বর্গমিটার ${this._bn(this._money(rate))} × ${this._bn(sqm.toFixed(2))}`);
      }
    }

    /* ---- ৮. VAT (কেবল ডেভেলপার) ---- */
    if (deed.vat && o.sellerIsDeveloper) {
      const kind = o.vatKind || 'plot';
      const pct = kind === 'flat_above' ? this.VAT.flatAbove1600
        : kind === 'flat_upto' ? this.VAT.flatUpto1600 : this.VAT.plot;
      const label = kind === 'flat_above' ? '১৬০০ বর্গফুটের ঊর্ধ্বে ভবন/ফ্ল্যাট'
        : kind === 'flat_upto' ? '১–১৬০০ বর্গফুট ভবন/ফ্ল্যাট' : 'প্লট';
      const vatBase = (kind === 'plot') ? base : (num(o.buildingValue) || base);
      add('মূল্য সংযোজন কর (VAT)', vatBase * pct / 100,
        `${label} — ${this._bn(pct)}% · কেবল ডেভেলপার/কো-ডেভেলপার`);
    }

    /* ---- ইজারায় অতিরিক্ত কর ---- */
    if (deed.lease && o.leaseYearsAbove10) {
      add('ইজারা কর (১০ বছরের বেশি)', base * 4 / 100, 'ইজারা মূল্যের ৪%');
    }

    const total = items.reduce((a, i) => a + i.amount, 0);
    return {
      deed, items,
      total: Math.round(total * 100) / 100,
      baseValue: base,
      landSatak: satak,
      overheadPct: base > 0 ? (total / base) * 100 : 0,
      warnings
    };
  },

  _bn(n) { return String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]); },

  _money(n) {
    const s = Math.round(Number(n) || 0).toString();
    if (s.length <= 3) return s;
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    const parts = [];
    while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); }
    if (rest) parts.unshift(rest);
    return parts.join(',') + ',' + last3;
  },

  moneyBn(n) { return this._bn(this._money(n)); }
};

if (typeof module !== 'undefined' && module.exports) module.exports = { DolilFee };
