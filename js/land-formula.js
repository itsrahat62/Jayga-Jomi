/* ==========================================================================
   land-formula.js — জমির সকল সূত্র (রেফারেন্স পাতা)
   --------------------------------------------------------------------------
   ৯টি সেকশন, প্রতিটি আকৃতির
   সাথে ডায়াগ্রাম ও কপি করার বোতাম।

   ★ একটি গুরুত্বপূর্ণ পার্থক্য:
     ওরা "১ কাঠা = ৭২০ বর্গফুট = ১.৬৫ শতক" ও "১ বিঘা = ৩৩ শতক" ধ্রুব ধরে নিয়েছে।
     কিন্তু কাঠার মাপ অঞ্চলভেদে আলাদা (১.৬৫ / ২.৬০ / কাস্টম), তাই এখানে সব মান
     `basis` (LandMath.kathaBasis()) থেকে আসে — কোথাও হার্ডকোড নেই।

   DOM ছোঁয় না — কেবল ডেটা ও HTML স্ট্রিং বানায়, যাতে Node এ টেস্ট করা যায়।
   ========================================================================== */

const LandFormula = {

  /* ----------------------------------------------------------------------
     ডায়াগ্রাম — সব SVG viewBox "0 0 200 132"
     রঙ CSS ক্লাস থেকে আসে (.lf-fig) যাতে ডার্ক মোডে ঠিক থাকে
     ---------------------------------------------------------------------- */
  svg: {
    _wrap(inner) {
      return `<svg class="lf-fig" viewBox="0 0 200 132" role="img" aria-hidden="true">${inner}</svg>`;
    },

    /** বিষমবাহু ত্রিভুজ — তিন বাহু a, b, c */
    scalene() {
      return this._wrap(`
        <polygon class="lf-sh" points="18,112 182,112 132,24"/>
        <text class="lf-lbl" x="64" y="62">a</text>
        <text class="lf-lbl" x="165" y="66">b</text>
        <text class="lf-lbl" x="100" y="127">c</text>`);
    },

    /** সমকোণী ত্রিভুজ — ৯০° চিহ্নসহ।
        "উচ্চতা" লেখাটা ঘুরিয়ে দেওয়া — সোজা রাখলে ত্রিভুজের বাহুর উপর পড়ে যেত */
    right() {
      return this._wrap(`
        <polygon class="lf-sh" points="48,112 180,112 48,22"/>
        <path class="lf-mark" d="M48,100 L60,100 L60,112"/>
        <text class="lf-lbl" x="100" y="127">ভূমি</text>
        <text class="lf-lbl" transform="translate(32,92) rotate(-90)">উচ্চতা</text>`);
    },

    /** ট্রাপিজিয়াম — দুই সমান্তরাল বাহু a, b ও উচ্চতা h */
    trapezium() {
      return this._wrap(`
        <polygon class="lf-sh" points="56,24 148,24 184,112 16,112"/>
        <line class="lf-dash" x1="102" y1="24" x2="102" y2="112"/>
        <text class="lf-lbl" x="98" y="18">a</text>
        <text class="lf-lbl" x="98" y="127">b</text>
        <text class="lf-lbl" x="108" y="72">h</text>`);
    },

    /** আয়তক্ষেত্র — ডান পাশে "প্রস্থ" লেখার জায়গা রেখে চওড়া কমানো হয়েছে */
    rect() {
      return this._wrap(`
        <rect class="lf-sh" x="18" y="30" width="130" height="82"/>
        <text class="lf-lbl" x="62" y="127">দৈর্ঘ্য</text>
        <text class="lf-lbl" x="155" y="76">প্রস্থ</text>`);
    },

    /** বর্গক্ষেত্র */
    square() {
      return this._wrap(`
        <rect class="lf-sh" x="56" y="22" width="90" height="90"/>
        <text class="lf-lbl" x="98" y="127">a</text>
        <text class="lf-lbl" x="151" y="72">a</text>`);
    },

    /** সামান্তরিক — ভূমি b ও লম্ব উচ্চতা h */
    parallelogram() {
      return this._wrap(`
        <polygon class="lf-sh" points="56,24 186,24 144,112 14,112"/>
        <line class="lf-dash" x1="56" y1="24" x2="56" y2="112"/>
        <text class="lf-lbl" x="76" y="127">b</text>
        <text class="lf-lbl" x="62" y="72">h</text>`);
    },

    /** রম্বস — দুই কর্ণ d1, d2 */
    rhombus() {
      return this._wrap(`
        <polygon class="lf-sh" points="100,18 176,67 100,116 24,67"/>
        <line class="lf-dash" x1="24" y1="67" x2="176" y2="67"/>
        <line class="lf-dash" x1="100" y1="18" x2="100" y2="116"/>
        <text class="lf-lbl" x="140" y="60">d1</text>
        <text class="lf-lbl" x="104" y="102">d2</text>`);
    },

    /** বৃত্ত — ব্যাসার্ধ r */
    circle() {
      return this._wrap(`
        <circle class="lf-sh" cx="100" cy="66" r="46"/>
        <line class="lf-dash" x1="100" y1="66" x2="146" y2="66"/>
        <text class="lf-lbl" x="118" y="60">r</text>`);
    },

    /** উপবৃত্ত — দুই অর্ধ-অক্ষ a, b */
    ellipse() {
      return this._wrap(`
        <ellipse class="lf-sh" cx="100" cy="66" rx="72" ry="42"/>
        <line class="lf-dash" x1="100" y1="66" x2="172" y2="66"/>
        <line class="lf-dash" x1="100" y1="66" x2="100" y2="24"/>
        <text class="lf-lbl" x="132" y="60">a</text>
        <text class="lf-lbl" x="104" y="44">b</text>`);
    },

    /** গড় পদ্ধতি — চার বাহু, কর্ণ নেই (ভুল) */
    quadAvg() {
      return this._wrap(`
        <polygon class="lf-sh lf-bad" points="30,26 170,38 156,112 22,100"/>
        <text class="lf-lbl" x="94" y="20">a</text>
        <text class="lf-lbl" x="176" y="76">b</text>
        <text class="lf-lbl" x="86" y="127">c</text>
        <text class="lf-lbl" x="6" y="66">d</text>`);
    },

    /** কর্ণ পদ্ধতি — কর্ণ দিয়ে দুই ত্রিভুজ (সঠিক) */
    quadDiag() {
      return this._wrap(`
        <polygon class="lf-sh lf-good" points="30,26 170,38 156,112 22,100"/>
        <line class="lf-dash" x1="30" y1="26" x2="156" y2="112"/>
        <text class="lf-lbl" x="94" y="20">a</text>
        <text class="lf-lbl" x="176" y="76">b</text>
        <text class="lf-lbl" x="86" y="127">c</text>
        <text class="lf-lbl" x="6" y="66">d</text>
        <text class="lf-lbl lf-t" x="112" y="48">T1</text>
        <text class="lf-lbl lf-t" x="62" y="94">T2</text>`);
    }
  },

  /* ----------------------------------------------------------------------
     সূত্রের তালিকা
     plain = কপি বোতামে যা কপি হবে (সাধারণ টেক্সট)
     ---------------------------------------------------------------------- */
  SHAPES: [
    {
      id: 'heron', fig: 'scalene', badge: 'সর্বাধিক ব্যবহৃত',
      title: 'বিষমবাহু ত্রিভুজ — হিরণের সূত্র',
      steps: ['ধাপ ১ — অর্ধপরিসীমা:  s = (a + b + c) ÷ ২',
              'ধাপ ২ — ক্ষেত্রফল:  √[ s(s−a)(s−b)(s−c) ]'],
      plain: 's = (a + b + c) / 2\nক্ষেত্রফল = √[ s(s-a)(s-b)(s-c) ]',
      note: 'তিন বাহু জানলেই হয় — উচ্চতা লাগে না। জমি যত আঁকাবাঁকাই হোক, ত্রিভুজে ভেঙে এই সূত্রেই মাপা হয়।'
    },
    {
      id: 'right', fig: 'right',
      title: 'সমকোণী ত্রিভুজ',
      steps: ['ক্ষেত্রফল = ০.৫ × ভূমি × উচ্চতা'],
      plain: 'ক্ষেত্রফল = 0.5 × ভূমি × উচ্চতা',
      note: 'একটি কোণ ঠিক ৯০° (L আকৃতি) হলে এই সহজ সূত্রই যথেষ্ট।'
    },
    {
      id: 'trapezium', fig: 'trapezium', badge: 'বন্টনে কাজে লাগে',
      title: 'ট্রাপিজিয়াম',
      steps: ['ক্ষেত্রফল = ০.৫ × (a + b) × h'],
      plain: 'ক্ষেত্রফল = 0.5 × (a + b) × h',
      note: 'দুই বিপরীত আইল সমান্তরাল, বাকি দুটি বাঁকা। ভাইয়ে-ভাইয়ে বা ক্রেতা-বিক্রেতার মাঝে প্লট ভাগ করার সময় এটিই সবচেয়ে বেশি লাগে। h = দুই সমান্তরাল বাহুর লম্ব দূরত্ব।'
    },
    {
      id: 'rect', fig: 'rect',
      title: 'আয়তক্ষেত্র',
      steps: ['ক্ষেত্রফল = দৈর্ঘ্য × প্রস্থ'],
      plain: 'ক্ষেত্রফল = দৈর্ঘ্য × প্রস্থ',
      note: 'চার কোণই ৯০° হলে।'
    },
    {
      id: 'square', fig: 'square',
      title: 'বর্গক্ষেত্র',
      steps: ['ক্ষেত্রফল = a × a  =  a²'],
      plain: 'ক্ষেত্রফল = বাহু × বাহু',
      note: 'চার বাহু সমান ও চার কোণ ৯০°।'
    },
    {
      id: 'parallelogram', fig: 'parallelogram',
      title: 'সামান্তরিক',
      steps: ['ক্ষেত্রফল = ভূমি × উচ্চতা'],
      plain: 'ক্ষেত্রফল = ভূমি × উচ্চতা',
      note: 'বিপরীত বাহু সমান ও সমান্তরাল। উচ্চতা মানে বাহুর দৈর্ঘ্য নয় — লম্ব দূরত্ব।'
    },
    {
      id: 'rhombus', fig: 'rhombus',
      title: 'রম্বস',
      steps: ['ক্ষেত্রফল = ০.৫ × d1 × d2'],
      plain: 'ক্ষেত্রফল = 0.5 × কর্ণ১ × কর্ণ২',
      note: 'চার বাহু সমান, কিন্তু কোণ ৯০° নয়। d1 ও d2 হলো দুটি কর্ণ।'
    },
    {
      id: 'circle', fig: 'circle',
      title: 'বৃত্ত',
      steps: ['ক্ষেত্রফল = π × r²'],
      plain: 'ক্ষেত্রফল = π × r²   (π = 3.1416)',
      note: 'π ≈ ৩.১৪১৬, r = ব্যাসার্ধ। পুকুর বা গোলাকার জমির জন্য।'
    },
    {
      id: 'ellipse', fig: 'ellipse',
      title: 'উপবৃত্ত (ডিম্বাকার)',
      steps: ['ক্ষেত্রফল = π × a × b'],
      plain: 'ক্ষেত্রফল = π × a × b',
      note: 'a = বড় অর্ধ-অক্ষ, b = ছোট অর্ধ-অক্ষ।'
    }
  ],

  /** মাঠে মাপার ব্যবহারিক পরামর্শ */
  TIPS: [
    ['সঠিক স্কেল নির্ধারণ',
     'নকশা (ম্যাপ) থেকে মাপার সময় গান্টার্স স্কেল (গুনিয়া) দিয়ে কাগজের লিংক থেকে ফুটের মাপ বের করে নিন — ১ লিংক = ০.৬৬ ফুট।'],
    ['ফিতা টান টান রাখা',
     'আইল বরাবর ফিতা একদম সোজা ও টান টান রাখুন। ফিতা মাঝে ঝুলে থাকলে জমির মাপ বাস্তবের চেয়ে বেশি আসবে।'],
    ['কর্ণ মাপা বাধ্যতামূলক',
     'আঁকাবাঁকা জমিতে শুধু চার আইলের মাপ নিলে হবে না। এক কোণা থেকে আরেক কোণার কর্ণ (Diagonal) মেপে হিরণের সূত্রে হিসাব করতে হবে।'],
    ['নদীভাঙা বা বক্র সীমানা (Offset Method)',
     'জমির একপাশ নদীর মতো আঁকাবাঁকা হলে একটি সোজা বেস-লাইন টানুন। নির্দিষ্ট দূরত্ব পর পর বেস-লাইন থেকে সীমানা পর্যন্ত লম্ব (Offset) মাপুন, তারপর সিম্পসনের রুলে হিসাব করুন।'],
    ['একই একক, দুইবার মাপ',
     'সব মাপ একই এককে (ফুট) নিন — কোথাও হাত কোথাও ফুট মেশাবেন না। প্রতিটি বাহু অন্তত দুইবার মেপে মিলিয়ে নিন।']
  ],

  /** এই সাইটের যেসব টুল সূত্রগুলো নিজে থেকে হিসাব করে দেয় */
  TOOLS: [
    ['canvas-measure', 'জমি পরিমাপ ক্যানভাস', 'বাহু ও কর্ণ বসিয়ে যেকোনো আকৃতির জমি এঁকে ক্ষেত্রফল বের করুন।'],
    ['dag-portion', 'দাগের মধ্যে অত্র খতিয়ানের অংশ', 'দাগের মোট জমির মধ্যে আপনার অংশ কত, বের করুন।'],
    ['tofasil', 'তফসিল বন্টন', 'একাধিক গ্রহীতার মধ্যে জমি নিখুঁতভাবে বন্টন করুন।'],
    ['khotian-analyzer', 'খতিয়ান হিস্যা বিশ্লেষণ', 'হিস্যা অনুযায়ী প্রত্যেক মালিকের প্রাপ্য জমি।'],
    ['hissa-calc', 'হিস্যা ক্যালকুলেটর', 'খতিয়ানের মোট জমি থেকে নির্দিষ্ট হিস্যার জমি।'],
    ['ana-gonda', 'আনা-গণ্ডা কনভার্টার', 'আনা-গণ্ডা-কড়া-ক্রান্তি থেকে দশমিকে রূপান্তর।'],
    ['ratio', 'অনুপাত ক্যালকুলেটর', 'যেকোনো আনুপাতিক ভাগ ও ইনলাইন সমীকরণ।'],
    ['unit-converter', 'একক পরিবর্তন', 'শতক · কাঠা · বিঘা · একর · বর্গফুট রূপান্তর।'],
    ['farayeiz', 'উত্তরাধিকার (মুসলিম)', 'ফরায়েজ অনুযায়ী ওয়ারিশ বন্টন ও A4 সনদ।'],
    ['hindu', 'উত্তরাধিকার (হিন্দু)', 'দায়ভাগ মত অনুযায়ী সম্পত্তি বন্টন।'],
    ['dolil-fee', 'দলিল রেজিস্ট্রেশন খরচ', 'স্ট্যাম্প শুল্ক, ফি ও উৎসে করসহ মোট খরচ।'],
    ['mouza-value', 'মৌজা মূল্য তালিকা', 'সরকারনির্ধারিত সর্বনিম্ন বাজার মূল্যের তালিকা।'],
    ['print-studio', 'প্রিন্ট স্টুডিও', 'জমির নকশা ও মাপসহ A4 সার্ভে প্রতিবেদন।']
  ],

  /* ----------------------------------------------------------------------
     একক — কাঠা/বিঘা basis থেকে আসে, হার্ডকোড নয়
     ---------------------------------------------------------------------- */

  /**
   * @param {object} basis  LandMath.kathaBasis()
   * @returns {Array<{title:string, rows:Array<[string,string]>, dynamic:boolean}>}
   */
  unitGroups(basis) {
    const n = x => (typeof toBn === 'function' ? toBn(x) : String(x));
    const trim = x => String(parseFloat(Number(x).toFixed(4)));
    return [
      {
        title: 'শতক / ডেসিমেল', dynamic: false,
        rows: [
          ['১ শতক', n('435.6') + ' বর্গফুট'],
          ['১ শতক', n('1000') + ' বর্গলিংক'],
          ['১০০ শতক', '১ একর'],
          ['১ একর', n('43560') + ' বর্গফুট']
        ]
      },
      {
        title: 'কাঠা ও বিঘা', dynamic: true,
        rows: [
          ['১ কাঠা', n(trim(basis.sqftPerKatha)) + ' বর্গফুট'],
          ['১ কাঠা', n(trim(basis.satakPerKatha)) + ' শতক'],
          ['১ বিঘা', n('20') + ' কাঠা'],
          ['১ বিঘা', n(trim(basis.satakPerBigha)) + ' শতক']
        ]
      },
      {
        title: 'চেইন ও লিংক', dynamic: false,
        rows: [
          ['১ চেইন', n('66') + ' ফুট'],
          ['১ চেইন', n('100') + ' লিংক'],
          ['১ লিংক', n('0.66') + ' ফুট'],
          ['১ গজ', n('3') + ' ফুট']
        ]
      }
    ];
  },

  /* ----------------------------------------------------------------------
     HTML তৈরি
     ---------------------------------------------------------------------- */

  /** কপি বোতাম — AppController.copyFormula() ডাকে */
  _copyBtn(plain) {
    const safe = String(plain).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
    return `<button class="lf-copy" title="সূত্র কপি করুন" aria-label="সূত্র কপি করুন"
              onclick="AppController.copyFormula('${safe}')"><i class="bi bi-clipboard"></i></button>`;
  },

  _shapeCard(s) {
    const fig = this.svg[s.fig] ? this.svg[s.fig]() : '';
    return `
      <div class="lf-card" id="lf-${s.id}">
        <div class="lf-figwrap">${fig}</div>
        <div class="lf-body">
          <div class="lf-head">
            <span class="lf-title">${s.title}</span>
            ${s.badge ? `<span class="lf-badge">${s.badge}</span>` : ''}
            ${this._copyBtn(s.plain)}
          </div>
          <div class="lf-eq">${s.steps.map(x => `<div>${x}</div>`).join('')}</div>
          <p class="lf-note">${s.note}</p>
        </div>
      </div>`;
  },

  /**
   * পুরো পাতার HTML।
   * @param {object} basis  LandMath.kathaBasis()
   */
  render(basis) {
    const units = this.unitGroups(basis);

    return `
      <p class="lf-intro">
        মাঠে ফিতা দিয়ে <b>ফুটে</b> মেপে আগে <b>বর্গফুট</b> বের করতে হয়, তারপর
        শতক · কাঠা · বিঘা · একরে রূপান্তর করতে হয়। এই এক পাতাতেই সব সূত্র —
        সবচেয়ে বেশি ব্যবহৃতগুলো শুরুতে।
      </p>

      <div class="fz-panel">
        <div class="fz-panel-head"><span class="fz-badge-num">১</span><h3>পরিমাপের মৌলিক এককসমূহ</h3></div>
        <div class="fz-panel-body">
          <div class="lf-units">
            ${units.map(g => `
              <div class="lf-unit-box${g.dynamic ? ' lf-dyn' : ''}">
                <div class="lf-unit-title">${g.title}${g.dynamic ? ' <i class="bi bi-sliders" title="আপনার সেটিং অনুযায়ী"></i>' : ''}</div>
                ${g.rows.map(([k, v]) => `<div class="lf-unit-row"><span>${k}</span><b>${v}</b></div>`).join('')}
              </div>`).join('')}
          </div>
          <div class="fz-katha-note" style="margin-top:12px"></div>
        </div>
      </div>

      <div class="fz-panel">
        <div class="fz-panel-head"><span class="fz-badge-num">২</span><h3>সতর্কতা — গড় পদ্ধতির মারাত্মক ভুল</h3></div>
        <div class="fz-panel-body">
          <p class="lf-note" style="margin-bottom:14px">
            অনেক আমিন <b>বিপরীত দুই বাহুর গড়</b> করে গুণ করেন। জমি সামান্য বাঁকা হলেই
            এই পদ্ধতিতে জমির পরিমাণ বাস্তবের চেয়ে <b>অনেক বেশি</b> দেখায়। এড়িয়ে চলুন।
          </p>
          <div class="lf-compare">
            <div class="lf-card lf-card-bad">
              <div class="lf-figwrap">${this.svg.quadAvg()}</div>
              <div class="lf-body">
                <div class="lf-head"><span class="lf-title">ভুল পদ্ধতি (গড়)</span></div>
                <div class="lf-eq lf-eq-bad"><div>((a+c) ÷ ২) × ((b+d) ÷ ২)</div></div>
                <p class="lf-note">কর্ণ না মাপায় জমির প্রকৃত আকৃতি ধরাই পড়ে না।</p>
              </div>
            </div>
            <div class="lf-card lf-card-good">
              <div class="lf-figwrap">${this.svg.quadDiag()}</div>
              <div class="lf-body">
                <div class="lf-head">
                  <span class="lf-title">সঠিক পদ্ধতি (কর্ণ + হিরণ)</span>
                  ${this._copyBtn('ক্ষেত্রফল = ত্রিভুজ T1 + ত্রিভুজ T2  (হিরণের সূত্রে)')}
                </div>
                <div class="lf-eq"><div>ক্ষেত্রফল = ত্রিভুজ(T1) + ত্রিভুজ(T2)</div></div>
                <p class="lf-note">কর্ণ টেনে দুই ত্রিভুজে ভাগ করে হিরণের সূত্র — ১০০% নির্ভুল।</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="fz-panel">
        <div class="fz-panel-head"><span class="fz-badge-num">৩</span><h3>ক্ষেত্রফলের সূত্রসমূহ</h3></div>
        <div class="fz-panel-body">
          <div class="lf-cards">${this.SHAPES.map(s => this._shapeCard(s)).join('')}</div>
        </div>
      </div>

      <div class="fz-panel">
        <div class="fz-panel-head"><span class="fz-badge-num">৪</span><h3>হিস্যা ও বন্টনের সূত্র</h3></div>
        <div class="fz-panel-body">
          <div class="lf-cards lf-cards-plain">
            ${[
              ['দাগের মধ্যে অংশ', 'অংশ = আবেদিত জমি ÷ দাগের মোট জমি', 'dag-portion'],
              ['তফসিল বন্টন', 'নির্ণেয় অংশ = (গ্রহীতার জমি ÷ মোট জমি) × টার্গেট', 'tofasil'],
              ['খতিয়ানে প্রাপ্য জমি', 'প্রাপ্য জমি = মোট জমি × হিস্যা', 'khotian-analyzer'],
              ['আনা-গণ্ডা', '১৬ আনা = পূর্ণ · ১ আনা = ২০ গণ্ডা · ১ গণ্ডা = ৪ কড়া · ১ কড়া = ৩ ক্রান্তি · ১ ক্রান্তি = ২০ তিল', 'ana-gonda']
            ].map(([t, f, tool]) => `
              <div class="lf-card lf-card-flat">
                <div class="lf-body">
                  <div class="lf-head">
                    <span class="lf-title">${t}</span>
                    ${this._copyBtn(f)}
                  </div>
                  <div class="lf-eq"><div>${f}</div></div>
                  <button class="fz-btn-sub lf-open" onclick="AppController.openToolModal('${tool}')">
                    <i class="bi bi-box-arrow-in-right"></i> টুল খুলুন
                  </button>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="fz-panel">
        <div class="fz-panel-head"><span class="fz-badge-num">৫</span><h3>মাঠে জমি মাপার ব্যবহারিক গাইডলাইন</h3></div>
        <div class="fz-panel-body">
          <div class="lf-tips">
            ${this.TIPS.map(([t, d], i) => `
              <div class="lf-tip">
                <span class="lf-tip-num">${typeof toBn === 'function' ? toBn(i + 1) : i + 1}</span>
                <div><b>${t}</b><p>${d}</p></div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="fz-panel">
        <div class="fz-panel-head"><span class="fz-badge-num">৬</span><h3>হিসাব সহজ করার টুলস</h3></div>
        <div class="fz-panel-body">
          <p class="lf-note" style="margin-bottom:12px">
            সূত্র জানা থাকলেও মাঠে দাঁড়িয়ে খাতা-কলমে হিসাব করা সময়সাপেক্ষ, আর সামান্য ভুলেই
            পুরো মাপ উল্টে যেতে পারে। নিচের টুলগুলো নিমিষেই হিসাব করে দেবে।
          </p>
          <div class="lf-tools">
            ${this.TOOLS.map(([id, t, d]) => `
              <button class="lf-tool" onclick="AppController.openToolModal('${id}')">
                <span class="lf-tool-name">${t} <i class="bi bi-arrow-right"></i></span>
                <span class="lf-tool-desc">${d}</span>
              </button>`).join('')}
          </div>
        </div>
      </div>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = LandFormula;
