/* ==========================================================================
   app.js — AppController: সব UI লজিক ও মুসলিম ফরায়েজ ইঞ্জিন
   ৩৩ ধরনের উত্তরাধিকারী · আগে/পরে মৃত ওয়ারিশ · মুনাছাখা · চার্ট · প্রিন্ট
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  AppController.init();
});

const AppController = {
  canvasEngine: null,
  mapPantograph: null,
  currentUnit: 'decimal',
  dynamicHeirData: {},
  lastCalculatedData: null,
  inputsVisible: false,
  myChart: null,

  categories: [
    { id: 'spouse_descendant', title: 'স্বামী/স্ত্রী এবং বংশধর' },
    { id: 'parents_ascendant', title: 'পিতা-মাতা এবং ঊর্ধ্বতন' },
    { id: 'siblings', title: 'ভাই-বোন' },
    { id: 'uncles_nephews', title: 'চাচা, ভাতিজা ও অন্যান্য আসাবা' }
  ],

  heirsConfig: [
    {id:'husband', name:'স্বামী', type:'single', cat:'spouse_descendant'},
    {id:'wife', name:'স্ত্রী', type:'multi', cat:'spouse_descendant'},
    {id:'son', name:'পুত্র', type:'multi', cat:'spouse_descendant'},
    {id:'daughter', name:'কন্যা', type:'multi', cat:'spouse_descendant'},
    {id:'deadSon', name:'মৃত পুত্র', type:'multi', cat:'spouse_descendant', isDynamicTrigger: true},
    {id:'deadDaughter', name:'মৃত কন্যা', type:'multi', cat:'spouse_descendant', isDynamicTrigger: true},
    {id:'sonSon', name:'পুত্রের পুত্র', type:'multi', cat:'spouse_descendant'},
    {id:'sonDaughter', name:'পুত্রের কন্যা', type:'multi', cat:'spouse_descendant'},

    {id:'father', name:'পিতা', type:'single', cat:'parents_ascendant'},
    {id:'mother', name:'মাতা', type:'single', cat:'parents_ascendant'},
    {id:'paternalGrandfather', name:'দাদা', type:'single', cat:'parents_ascendant'},
    {id:'paternalGrandmother', name:'দাদী', type:'single', cat:'parents_ascendant'},
    {id:'maternalGrandmother', name:'নানি', type:'single', cat:'parents_ascendant'},
    
    {id:'fullBrother', name:'সহোদর ভাই', type:'multi', cat:'siblings'},
    {id:'fullSister', name:'সহোদর বোন', type:'multi', cat:'siblings'},
    {id:'deadBrother', name:'মৃত ভাই', type:'multi', cat:'siblings', isDynamicTrigger: true},
    {id:'deadSister', name:'মৃত বোন', type:'multi', cat:'siblings', isDynamicTrigger: true},
    {id:'consanguineBrother', name:'সৎ ভাই (বৈমাত্রেয়)', type:'multi', cat:'siblings'},
    {id:'consanguineSister', name:'সৎ বোন (বৈমাত্রেয়)', type:'multi', cat:'siblings'},
    {id:'uterineBrother', name:'সৎ ভাই (বৈপিত্রেয়)', type:'multi', cat:'siblings'},
    {id:'uterineSister', name:'সৎ বোন (বৈপিত্রেয়)', type:'multi', cat:'siblings'},

    {id:'fullBrotherSon', name:'সহোদর ভাইয়ের পুত্র', type:'multi', cat:'uncles_nephews'},
    {id:'consanguineBrotherSon', name:'সৎ ভাই(বৈমাত্রেয়)-এর পুত্র', type:'multi', cat:'uncles_nephews'},
    {id:'fullBrotherSonSon', name:'সহোদর ভাইয়ের পুত্রের পুত্র', type:'multi', cat:'uncles_nephews'},
    {id:'consanguineBrotherSonSon', name:'সৎ ভাই(বৈমাত্রেয়)-এর পুত্রের পুত্র', type:'multi', cat:'uncles_nephews'},
    {id:'paternalUncle', name:'চাচা', type:'multi', cat:'uncles_nephews'},
    {id:'consanguinePaternalUncle', name:'চাচা (বৈমাত্রেয়)', type:'multi', cat:'uncles_nephews'},
    {id:'paternalUncleSon', name:'চাচাতো ভাই', type:'multi', cat:'uncles_nephews'},
    {id:'consanguinePaternalUncleSon', name:'চাচাতো ভাই (বৈমাত্রেয়)', type:'multi', cat:'uncles_nephews'},
    {id:'paternalUncleSonSon', name:'চাচাতো ভাইয়ের পুত্র', type:'multi', cat:'uncles_nephews'},
    {id:'consanguinePaternalUncleSonSon', name:'চাচাতো ভাই (বৈমাত্রেয়) এর পুত্র', type:'multi', cat:'uncles_nephews'},
    {id:'paternalUncleSonSonSon', name:'চাচাতো ভাইয়ের পুত্রের পুত্র', type:'multi', cat:'uncles_nephews'},
    {id:'consanguinePaternalUncleSonSonSon', name:'চাচাতো ভাই (বৈমাত্রেয়)এর পুত্রের পুত্র', type:'multi', cat:'uncles_nephews'}
  ],

  /**
   * একটি ধাপ ভেঙে পড়লেও বাকি অ্যাপ যেন চালু হয়।
   * আগে init() এর ভেতরে কিছু throw করলে পরের সব ধাপ থেমে যেত —
   * ফলে একটা টুলও কাজ করত না (যেমন localStorage বন্ধ থাকলে)।
   */
  _step(name, fn) {
    try { fn(); }
    catch (e) { console.error(`Land Info: "${name}" ধাপে সমস্যা হয়েছে —`, e); }
  },

  init() {
    this._step('থিম', () => this.initTheme());
    this._step('নেভিগেশন', () => this.attachNavEvents());
    this._step('সার্চ', () => this.attachSearchFilter());
    this._step('মডাল', () => this.initModalListeners());
    this._step('খতিয়ান সারি', () => this.initKhotianDynamicRows());
    this._step('উত্তরাধিকারী তালিকা', () => this.renderHeirs());
    this._step('ইনপুট লিসেনার', () => this.setupInputListeners());
    this._step('কাঠা সেটিং', () => this.initKathaSetting());
    this._step('hash টুল', () => this.openToolFromHash());
    window.addEventListener('hashchange', () => this.openToolFromHash());
  },

  /* ------------------------------------------------------------------------
     নিরাপদ localStorage
     ------------------------------------------------------------------------
     থার্ড-পার্টি স্টোরেজ ব্লক করা থাকলে, কড়া প্রাইভেসি সেটিংয়ে, বা সাইটটি
     অন্য কোনো পাতায় iframe-এ বসানো থাকলে localStorage ছুঁলেই SecurityError
     থ্রো করে। আগে এতে পুরো init() ভেঙে পড়ত। এখন সেটিং শুধু সংরক্ষিত হয় না —
     সাইট আগের মতোই চলে।
     ------------------------------------------------------------------------ */
  storeGet(key) {
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
      // প্রজেক্টের নাম Land Pro → Land Info হওয়ার আগে সেভ হওয়া সেটিং
      // (land_pro_*) যেন হারিয়ে না যায় — ব্যবহারকারীর কাঠার মাপ ও ডার্ক মোড
      if (key.indexOf('land_info_') === 0) {
        return window.localStorage.getItem(key.replace('land_info_', 'land_pro_'));
      }
      return null;
    } catch (e) { return null; }
  },

  storeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  },

  /**
   * URL এর hash দেখে সরাসরি টুল খোলে — যেমন index.html#tool=farayeiz
   * এতে নির্দিষ্ট টুলের লিংক শেয়ার করা যায়।
   */
  openToolFromHash() {
    const m = (location.hash || '').match(/^#tool=([a-z-]+)$/i);
    if (m) this.openToolModal(m[1]);
  },

  /* ------------------------------------------------------------------------
     1. Theme & Drawer Management
     ------------------------------------------------------------------------ */
  initTheme() {
    const isDark = this.storeGet('land_info_dark') === 'true';
    if (isDark) {
      document.documentElement.classList.add('dark-theme');
      this.updateDarkIcon(true);
    }
  },

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark-theme');
    this.storeSet('land_info_dark', isDark);
    this.updateDarkIcon(isDark);
    if (this.canvasEngine) this.canvasEngine.render();
  },

  updateDarkIcon(isDark) {
    const icons = document.querySelectorAll('.dark-toggle-icon');
    icons.forEach(icon => {
      icon.className = isDark ? 'bi bi-sun-fill dark-toggle-icon' : 'bi bi-moon-stars-fill dark-toggle-icon';
    });
  },

  attachNavEvents() {
    const drawerToggle = document.getElementById('drawer-toggle');
    const drawerClose = document.getElementById('drawer-close');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const darkBtn = document.getElementById('dark-toggle-btn');
    const darkBtnDrawer = document.getElementById('dark-toggle-drawer');

    if (drawerToggle) drawerToggle.addEventListener('click', () => this.toggleDrawer(true));
    if (drawerClose) drawerClose.addEventListener('click', () => this.toggleDrawer(false));
    if (drawerOverlay) drawerOverlay.addEventListener('click', () => this.toggleDrawer(false));

    if (darkBtn) darkBtn.addEventListener('click', () => this.toggleTheme());
    if (darkBtnDrawer) darkBtnDrawer.addEventListener('click', () => this.toggleTheme());
  },

  toggleDrawer(open) {
    const navDrawer = document.getElementById('nav-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    if (open) {
      navDrawer.classList.add('active');
      drawerOverlay.classList.add('active');
    } else {
      navDrawer.classList.remove('active');
      drawerOverlay.classList.remove('active');
    }
  },

  /* ------------------------------------------------------------------------
     2. Search & Category Filter
     ------------------------------------------------------------------------ */
  attachSearchFilter() {
    const searchInput = document.getElementById('tool-search-input');
    const filterChips = document.querySelectorAll('.chip-btn');
    const toolCards = document.querySelectorAll('.tool-card');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        toolCards.forEach(card => {
          const title = card.getAttribute('data-title') || '';
          const category = card.getAttribute('data-category') || '';
          const matches = title.toLowerCase().includes(query) || category.toLowerCase().includes(query);
          card.style.display = matches ? 'flex' : 'none';
        });
      });
    }

    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const cat = chip.getAttribute('data-filter');
        toolCards.forEach(card => {
          if (cat === 'all' || card.getAttribute('data-category') === cat) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  },

  /* ------------------------------------------------------------------------
     3. Tool Modals Handler
     ------------------------------------------------------------------------ */
  initModalListeners() {
    // মডাল কেবল ক্লোজ (×) বোতামে ক্লিক করলেই বন্ধ হবে।
    // বাইরে ক্লিক বা Esc চাপলে বন্ধ হবে না — লম্বা ফর্মে অনেক তথ্য
    // দেওয়ার পর ভুল করে বাইরে ক্লিক করলে সব হারিয়ে যেত।
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    window.onCanvasAreaChange = (sqft) => {
      this.updateCanvasAreaUI(sqft);
    };
  },

  openToolModal(toolId) {
    const modal = document.getElementById('app-modal');
    const modalTitle = document.getElementById('modal-title-text');
    const modalIcon = document.getElementById('modal-title-icon');

    if (!modal) return;

    const allViews = document.querySelectorAll('.tool-view-content');
    allViews.forEach(v => v.style.display = 'none');

    let targetView = document.getElementById(`view-${toolId}`);
    if (targetView) {
      targetView.style.display = 'block';
    }

    // কাঠা/বিঘা দেখায় এমন টুলে বর্তমান মাপ জানিয়ে দিই
    this.showKathaNotes();

    switch (toolId) {
      case 'canvas-measure':
        modalTitle.innerText = 'মৌজা ম্যাপ ও জমি পরিমাপ ক্যানভাস';
        modalIcon.className = 'bi bi-rulers text-primary';
        setTimeout(() => {
          if (!this.canvasEngine) {
            this.canvasEngine = new LandCanvasEngine('land-canvas');
          } else {
            this.canvasEngine.initCanvas();
          }
          // বাহু ও কর্ণের ইনপুট বক্স তৈরি করে আকৃতি আঁকা
          if (!document.querySelector('#cm-sides .cm-side')) this.rebuildSideInputs();
          else this.updateCanvasFromInputs();
        }, 150);
        break;

      case 'hissa-calc':
        modalTitle.innerText = 'হিস্যা ক্যালকুলেটর (Hissa Calculator)';
        modalIcon.className = 'bi bi-percent text-success';
        this.runHissaCalc();
        break;

      case 'ana-gonda':
        modalTitle.innerText = 'আনা-গন্ডা-কড়া-ক্রান্তি কনভার্টার';
        modalIcon.className = 'bi bi-calculator text-primary';
        this.runAnaGondaCalc();
        break;

      case 'khotian-analyzer':
        modalTitle.innerText = 'খতিয়ান মালিকানা হিস্যা বিশ্লেষণ';
        modalIcon.className = 'bi bi-file-earmark-spreadsheet text-primary';
        this.runKhotianCalc();
        break;

      case 'farayeiz':
        modalTitle.innerText = 'উত্তরাধিকার (মুসলিম) — ফরায়েজ';
        modalIcon.className = 'bi bi-diagram-3 text-primary';
        this.renderDeductionRows();
        break;

      case 'hindu':
        modalTitle.innerText = 'উত্তরাধিকার (হিন্দু) — দায়ভাগ';
        modalIcon.className = 'bi bi-diagram-2 text-warning';
        this.renderHinduHeirs();
        break;

      case 'unit-converter':
        modalTitle.innerText = 'জমি একক পরিবর্তন (Unit Converter)';
        modalIcon.className = 'bi bi-arrow-repeat text-primary';
        this.syncKathaUI();
        this.runUnitConverter();
        break;

      case 'dolil-fee':
        modalTitle.innerText = 'দলিল রেজিস্ট্রেশন খরচ ক্যালকুলেটর';
        modalIcon.className = 'bi bi-cash-coin text-success';
        this.initDolilFee();
        break;

      case 'dag-portion':
        modalTitle.innerText = 'দাগের মধ্যে অত্র খতিয়ানের অংশ';
        modalIcon.className = 'bi bi-pin-map text-primary';
        this.runDagPortion();
        break;

      case 'tofasil':
        modalTitle.innerText = 'তফসিল বন্টন ক্যালকুলেটর';
        modalIcon.className = 'bi bi-file-earmark-text text-success';
        this.initTofasilRows();
        this.runTofasil();
        break;

      case 'ratio':
        modalTitle.innerText = 'অনুপাত ক্যালকুলেটর';
        modalIcon.className = 'bi bi-pie-chart text-warning';
        this.initRatioRows();
        this.runRatio();
        this.runExpression();
        break;

      case 'land-formula':
        modalTitle.innerText = 'জমির সকল সূত্র';
        modalIcon.className = 'bi bi-book text-info';
        this.renderLandFormula();
        break;

      case 'map-overlay':
        modalTitle.innerText = 'তুলনামূলক ম্যাপ প্যান্টোগ্রাফ (Pantograph)';
        modalIcon.className = 'bi bi-layers-half text-primary';
        setTimeout(() => {
          if (!this.mapPantograph) {
            this.mapPantograph = new MapPantograph('pantograph-container');
          }
        }, 150);
        break;

      case 'print-studio':
        modalTitle.innerText = 'সার্ভে প্রতিবেদন প্রিন্ট স্টুডিও';
        modalIcon.className = 'bi bi-printer text-primary';
        break;

      case 'mouza-value':
        modalTitle.innerText = 'সম্পত্তির সর্বনিম্ন বাজার মূল্য (মৌজা মূল্য)';
        modalIcon.className = 'bi bi-file-earmark-bar-graph text-warning';
        this.initMouzaValue();
        break;

      case 'khotian-porcha':
        modalTitle.innerText = 'খতিয়ান বিশ্লেষণ (পর্চার হিসাব)';
        modalIcon.className = 'bi bi-table text-primary';
        this.initPorcha();
        break;

      case 'mouza-map':
        modalTitle.innerText = 'সারাদেশের মৌজা ম্যাপ';
        modalIcon.className = 'bi bi-map text-primary';
        this.initMouzaMap();
        break;

      case 'kmz-export':
        modalTitle.innerText = 'গুগল আর্থে মৌজা ম্যাপ (KMZ)';
        modalIcon.className = 'bi bi-globe-americas text-primary';
        this.initKmz();
        break;

      case 'map-measure':
        modalTitle.innerText = 'মৌজা ম্যাপে জমি পরিমাপ';
        modalIcon.className = 'bi bi-rulers text-primary';
        this.initMeasure();
        break;
    }

    modal.classList.add('active');
  },


  /* ------------------------------------------------------------------------
     KMZ এক্সপোর্ট — মৌজা ম্যাপ → Google Earth
     গণিত KmzExport এ, আঁকা KmzMap/KmzImage এ। এখানে কেবল সংযোগ।
     ------------------------------------------------------------------------ */

  kmz: { step: 0, img: null, imgBytes: null, imgName: '',
         imgPts: [], geoPts: [], pairs: [],
         opacity: 0.78, result: null,
         tree: null, treeLoaded: false, arch: {}, archFiles: [], archShown: [],
         geoHits: [],
         bgClear: true, threshold: 205, color: '#dc2626', fx: null },

  initKmz() {
    this.kmzRenderColors();
    this.kmzStep(this.kmz.img ? this.kmz.step : 0);
  },

  /* ---- ধাপ ব্যবস্থাপনা ---- */

  kmzStep(n) {
    const k = this.kmz;
    if (n === 1 && !k.img) return;
    if (n === 2 && k.imgPts.length < 2) return;
    if (n === 3 && k.geoPts.length < 2) return;

    k.step = n;
    for (let i = 0; i <= 3; i++) {
      const el = document.getElementById('kmz-s' + i);
      if (el) el.style.display = i === n ? '' : 'none';
    }
    this.kmzStatus(null);

    if (n === 1) { this.kmzSizeCanvas('kmz-canvas-img'); this.kmzInitImgStage(); }
    if (n === 2) { this.kmzSizeCanvas('kmz-canvas-map'); this.kmzInitMapStage(); this.kmzOverlayMouzaOnMap(); }
    if (n === 3) { k.pairs = this.kmzPairs(); this.kmzRender(); this.kmzApplyFx(); }
    this.kmzUpdatePills();
  },

  /** ক্যানভাসকে তার ধারকের মাপে বসানো (পূর্ণ পর্দার মঞ্চ) */
  kmzSizeCanvas(id) {
    const c = document.getElementById(id);
    if (!c) return;
    const r = c.parentElement.getBoundingClientRect();
    const w = Math.max(280, Math.round(r.width));
    const h = Math.max(240, Math.round(r.height));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  },

  kmzInitImgStage() {
    const c = document.getElementById('kmz-canvas-img');
    if (!c) return;
    if (!c._kmzInit) {
      c._kmzInit = true;
      KmzImage.init(c, { onPick: pt => this.kmzAddImgPt(pt) });
    } else { KmzImage.state.canvas = c; }
    const activeImg = (this.kmz.fx && this.kmz.fx.img) || this.kmz.img;
    if (activeImg) KmzImage.setImage(activeImg);
    this.kmzDrawImgPts();
  },

  kmzInitMapStage() {
    const c = document.getElementById('kmz-canvas-map');
    if (!c) return;
    if (!c._kmzInit) {
      c._kmzInit = true;
      KmzMap.init(c, { onPick: g => this.kmzAddGeoPt(g) });
    } else { KmzMap.state.canvas = c; KmzMap.draw(); }
    this.kmzDrawGeoPts();
  },

  /* ---- ধাপ ২ তে মৌজা ম্যাপ স্যাটেলাইটের ওপর অর্ধস্বচ্ছভাবে দেখানো ---- */
  kmzOverlayMouzaOnMap() {
    const k = this.kmz;
    const activeImg = (k.fx && k.fx.img) || k.img;
    if (!activeImg || k.imgPts.length < 2 || k.geoPts.length < 2) return;
    if (!KmzMap.state) return;

    // প্রতিবার geo পয়েন্ট বসানোর পর overlay আঁকা
    KmzMap._mouzaOverlay = { img: activeImg, imgPts: k.imgPts, geoPts: k.geoPts };
    KmzMap.draw();
  },

  /** নকশার বিন্দু ও ভূ-বিন্দু জোড়া বাঁধা (ক্রম অনুযায়ী) */
  kmzPairs() {
    const k = this.kmz;
    const n = Math.min(k.imgPts.length, k.geoPts.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ px: k.imgPts[i].x, py: k.imgPts[i].y,
                 lat: k.geoPts[i].lat, lng: k.geoPts[i].lng });
    }
    return out;
  },

  kmzAddImgPt(pt) {
    this.kmz.imgPts.push({ x: pt.x, y: pt.y });
    this.kmzDrawImgPts();
    this.kmzUpdatePills();
  },

  kmzAddGeoPt(g) {
    const k = this.kmz;
    if (k.geoPts.length >= k.imgPts.length) {
      this.kmzStatus('সবগুলো পয়েন্ট বসানো হয়ে গেছে। "পরবর্তী ধাপ" চাপুন।');
      return;
    }
    k.geoPts.push({ lat: g.lat, lng: g.lng });
    this.kmzDrawGeoPts();
    this.kmzUpdatePills();
    // প্রতিবার নতুন পয়েন্ট বসালে মৌজা ম্যাপ ওভারলে আপডেট
    if (k.geoPts.length >= 2) this.kmzOverlayMouzaOnMap();
  },

  kmzUndo(stage) {
    const k = this.kmz;
    if (stage === 1) {
      k.imgPts.pop();
      if (k.geoPts.length > k.imgPts.length) k.geoPts.length = k.imgPts.length;
      this.kmzDrawImgPts();
    } else {
      k.geoPts.pop();
      this.kmzDrawGeoPts();
    }
    this.kmzUpdatePills();
  },

  /** শেষ বসানো বিন্দু লাল, বাকিগুলো নীল — ওদের মতোই */
  kmzDrawImgPts() {
    if (!KmzImage.state) return;
    const n = this.kmz.imgPts.length;
    KmzImage.setMarkers(this.kmz.imgPts.map((p, i) => ({
      x: p.x, y: p.y, n: toBn(i + 1), current: i === n - 1
    })));
  },

  kmzDrawGeoPts() {
    if (!KmzMap.state) return;
    const n = this.kmz.geoPts.length;
    KmzMap.setMarkers(this.kmz.geoPts.map((p, i) => ({
      lat: p.lat, lng: p.lng, n: toBn(i + 1), current: i === n - 1
    })));
  },

  kmzUpdatePills() {
    const k = this.kmz;
    const p1 = document.getElementById('kmz-pill1');
    if (p1) p1.innerHTML = '<span class="dot"></span>নকশায় পয়েন্ট বসান<b>'
      + toBn(k.imgPts.length) + '</b>';

    const p2 = document.getElementById('kmz-pill2');
    if (p2) {
      const done = k.geoPts.length, need = k.imgPts.length;
      p2.innerHTML = done >= need
        ? '<span class="dot ok"></span>সব পয়েন্ট বসানো হয়েছে<b>' + toBn(done) + '/' + toBn(need) + '</b>'
        : '<span class="dot"></span>পয়েন্ট ' + toBn(done + 1) + ' বসান<b>'
          + toBn(done) + '/' + toBn(need) + '</b>';
    }

    const n1 = document.getElementById('kmz-next1');
    if (n1) n1.disabled = k.imgPts.length < 2;
    const n2 = document.getElementById('kmz-next2');
    if (n2) n2.disabled = k.geoPts.length < 2;

    const t1 = document.getElementById('kmz-tip1');
    if (t1) t1.textContent = k.imgPts.length < 2
      ? 'জুম করে চেনা জায়গায় ক্লিক করুন — রাস্তার মোড়, পুকুরের কোণা, ব্রিজ'
      : 'আরও পয়েন্ট দিলে বাঁকা স্ক্যানও নিখুঁত বসবে (৩–৫টি ভালো)';
  },

  kmzImgZoom(d) {
    const c = document.getElementById('kmz-canvas-img');
    if (c && KmzImage.state) KmzImage.zoomAt({ x: c.width / 2, y: c.height / 2 }, d > 0 ? 1.4 : 1 / 1.4);
  },

  /* ---- উৎস বাছাই ---- */

  kmzChoose(kind) {
    if (kind === 'file') {
      const f = document.getElementById('kmz-file');
      if (f) f.click();
      return;
    }
    const pa = document.getElementById('kmz-pane-arch');
    if (pa) pa.style.display = pa.style.display === 'none' ? '' : 'none';
    if (!this.kmz.treeLoaded) this.kmzArchInit();
  },

  /* ---- অগ্রগতি বার ---- */
  kmzProg(pct, msg) {
    const box = document.getElementById('kmz-prog');
    const fill = document.getElementById('kmz-prog-fill');
    const txt = document.getElementById('kmz-prog-txt');
    if (!box) return;
    if (pct == null) { box.style.display = 'none'; return; }
    box.style.display = '';
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (txt) txt.textContent = msg || '';
  },

  async runMouzaOcr() {
    const k = this.kmz;
    if (!k.img) {
      alert('আগে একটি মৌজা ম্যাপ ফাইল আনুন বা আপলোড করুন।');
      return;
    }
    if (typeof KmzCC === 'undefined') {
      alert('KmzCC লোড হয়নি — পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
      return;
    }

    const ocrBtn = document.getElementById('kmz-ocr-btn');
    if (ocrBtn) { ocrBtn.disabled = true; ocrBtn.style.opacity = '0.5'; }

    try {
      // আসল কালো ছবি (original PDF রূপান্তর)
      const srcImg = k.img;

      const tempC = document.createElement('canvas');
      tempC.width  = srcImg.naturalWidth  || srcImg.width;
      tempC.height = srcImg.naturalHeight || srcImg.height;
      const tempCtx = tempC.getContext('2d');
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, tempC.width, tempC.height);
      tempCtx.drawImage(srcImg, 0, 0);

      // KmzCC: হালকা লেখা মুছো, মোটা দাগ নম্বর + রেখা রাখো
      const result = await KmzCC.process(tempC, {
        onProgress: (pct, msg) => {
          this.kmzProg(pct, msg);
          this.kmzStatus(msg);
        }
      });

      this.kmzProg(null);

      // result → Image
      const blob = await new Promise(res => result.toBlob(res, 'image/png'));
      const url  = URL.createObjectURL(blob);
      const img  = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload  = () => { URL.revokeObjectURL(url); resolve(im); };
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ছবি তৈরি হলো না')); };
        im.src = url;
      });

      k.ocrResult = img;
      k.ocrLabels = [];
      KmzImage.setOcrLabels([]);
      KmzImage.setImage(img);
      if (KmzImage.state) KmzImage.draw();

      this.kmzStatus('পরিষ্কার সম্পন্ন — হালকা লেখা বাদ দেওয়া হয়েছে, দাগ নম্বর ও রেখা পরিষ্কার আছে।');

    } catch (e) {
      this.kmzProg(null);
      console.warn('Map clean error:', e);
      this.kmzStatus('সমস্যা হয়েছে: ' + e.message, true);
    } finally {
      if (ocrBtn) { ocrBtn.disabled = false; ocrBtn.style.opacity = ''; }
    }
  },

  /** OCR ভাষা টগল (bn <-> en) */
  kmzToggleOcrLang() {
    const k = this.kmz;
    k.ocrLang = (k.ocrLang === 'en') ? 'bn' : 'en';
    const btn = document.getElementById('kmz-ocr-lang-btn');
    if (btn) btn.textContent = k.ocrLang === 'bn' ? 'বাং' : 'EN';
  },

  /* ------------------------------------------------------------------------
     নেটওয়ার্ক ব্যর্থতার কারণ বুঝিয়ে বলা।
     সবচেয়ে সাধারণ কারণ: index.html সরাসরি file:// দিয়ে খোলা হয়েছে —
     তখন ব্রাউজার নিরাপত্তার কারণে পাশের JSON ফাইলও পড়তে দেয় না।
     ------------------------------------------------------------------------ */
  kmzNetHint(what, err) {
    if (location.protocol === 'file:') {
      return what + ' আনা যায়নি — ফাইলটি সরাসরি খোলা হয়েছে (file://), '
        + 'তাই ব্রাউজার পাশের ডেটা ফাইল পড়তে দিচ্ছে না। ফোল্ডারে গিয়ে '
        + '"python -m http.server 8899" চালিয়ে http://127.0.0.1:8899/ খুলুন।';
    }
    const m = String((err && err.message) || '');
    if (/Failed to fetch|NetworkError|ERR_INTERNET/i.test(m)) {
      return what + ' আনা যায়নি — ইন্টারনেট সংযোগ দেখুন।';
    }
    if (/40[34]/.test(m)) {
      return what + ' আনা যায়নি — ডেটা ফাইল খুঁজে পাওয়া যায়নি ('
        + 'data/mouza-map/ ফোল্ডারটি আছে কি না দেখুন)।';
    }
    return what + ' আনা যায়নি: ' + m;
  },

  kmzRenderColors() {
    const box = document.getElementById('kmz-colors');
    if (!box) return;
    const colors = [
      { name: 'রেড (লাল)', hex: '#ef4444' },
      { name: 'কালো (মূল)', hex: '' },
      { name: 'নীল', hex: '#2563eb' },
      { name: 'সবুজ', hex: '#059669' },
      { name: 'বেগুনি', hex: '#9333ea' }
    ];
    box.innerHTML = colors.map((c) => `
      <button type="button" class="kmz-color-btn ${this.kmz.color === c.hex ? 'active' : ''}"
              style="background:${c.hex || '#1e293b'}" title="${c.name}"
              onclick="AppController.kmzSetColor('${c.hex}')"></button>
    `).join('');
  },

  async kmzApplyFx() {
    const k = this.kmz;
    if (!k.rawImg) return;
    try {
      this.kmzProg(20, 'মানচিত্র প্রক্রিয়াকরণ করা হচ্ছে…');
      const tempC = document.createElement('canvas');
      tempC.width = k.rawImg.naturalWidth || k.rawImg.width;
      tempC.height = k.rawImg.naturalHeight || k.rawImg.height;
      const tempCtx = tempC.getContext('2d');
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, tempC.width, tempC.height);
      tempCtx.drawImage(k.rawImg, 0, 0);

      // KmzCC দিয়ে প্রসেস: সীমানা রেখা লাল/রঙিন হবে, দাগ নম্বর গাঢ় কালো থাকবে
      const cleanCanvas = await KmzCC.process(tempC, {
        color: k.color || '#ef4444', // ডিফল্ট লাল
        onProgress: (pct, msg) => this.kmzProg(pct, msg)
      });

      const blob = await new Promise(res => cleanCanvas.toBlob(res, 'image/png'));
      const url = URL.createObjectURL(blob);
      const cleanImg = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ছবি তৈরি হলো না')); };
        im.src = url;
      });

      k.img = cleanImg;
      this.kmzProg(null);

      if (KmzImage.state) {
        KmzImage.setImage(cleanImg);
        KmzImage.draw();
      }
    } catch (e) {
      console.warn('KMZ FX Error:', e);
      this.kmzProg(null);
      if (k.rawImg && KmzImage.state) {
        KmzImage.setImage(k.rawImg);
        KmzImage.draw();
      }
    }
  },

  kmzSetBg(clear) {
    this.kmz.bgClear = !!clear;
    const keepBtn = document.getElementById('kmz-bg-keep');
    const clearBtn = document.getElementById('kmz-bg-clear');
    if (keepBtn) keepBtn.classList.toggle('active', !clear);
    if (clearBtn) clearBtn.classList.toggle('active', !!clear);

    const thField = document.getElementById('kmz-th-field');
    if (thField) thField.style.display = clear ? '' : 'none';

    this.kmzApplyFx();
  },

  async kmzSetColor(hex) {
    this.kmz.color = hex || null;
    this.kmzRenderColors();
    await this.kmzApplyFx();
  },
  kmzImgZoom(d) {
    const c = document.getElementById('kmz-canvas-img');
    if (c && KmzImage.state) KmzImage.zoomAt({ x: c.width / 2, y: c.height / 2 }, d > 0 ? 1.4 : 1 / 1.4);
  },

  kmzChoose(kind) {
    if (kind === 'file') {
      const f = document.getElementById('kmz-file');
      if (f) f.click();
      return;
    }
    const pa = document.getElementById('kmz-pane-arch');
    if (pa) pa.style.display = pa.style.display === 'none' ? '' : 'none';
    if (!this.kmz.treeLoaded) this.kmzArchInit();
  },

  kmzProg(pct, msg) {
    const box = document.getElementById('kmz-prog');
    const fill = document.getElementById('kmz-prog-fill');
    const txt = document.getElementById('kmz-prog-txt');
    if (!box) return;
    if (pct == null) { box.style.display = 'none'; return; }
    box.style.display = '';
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (txt) txt.textContent = msg || '';
  },


  kmzThreshold(val) {
    this.kmz.threshold = Number(val) || 205;
    const valSpan = document.getElementById('kmz-th-val');
    if (valSpan) valSpan.textContent = toBn(this.kmz.threshold);
    this.kmzApplyFx();
  },

  /* ---- ছবি বসানো (সব উৎসের সাধারণ ধাপ) ---- */
  async kmzUseImage(r, name) {
    const k = this.kmz;
    k.img = r.img; k.rawImg = r.img; k.imgBytes = r.bytes; k.imgName = name || 'map.jpg';
    k.imgPts = []; k.geoPts = []; k.pairs = []; k.fx = null;
    
    // ডিফল্টভাবে ব্যাকগ্রাউন্ড পরিষ্কার সেট
    k.bgClear = true;
    k.color = '#ef4444'; // ডিফল্ট লাল

    // ১. ফিল্টার ইফেক্ট ও স্টেজ ১ চালু (স্বয়ংক্রিয়ভাবে ক্লিনআপ প্রসেস করবে)
    await this.kmzApplyFx();
    this.kmzStep(1);
    this.kmzStatus('নকশা প্রস্তুত — ' + toBn(r.width) + '×' + toBn(r.height)
      + (r.wasPdf ? ' (PDF থেকে আল্ট্রা HD রেজোলিউশন)' : '') + '। হালকা লেখা অপসারণ ও দাগ নম্বর পরিষ্কার করা হয়েছে। চেনা জায়গায় ক্লিক করে পয়েন্ট বসান।');
  },

  kmzLoadFile(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = () => this.kmzStatus('ফাইলটি পড়া গেল না।', true);
    reader.onload = async ev => {
      const buf = new Uint8Array(ev.target.result);
      this.kmzProg(5, 'ফাইল পড়া হচ্ছে…');
      try {
        const r = await KmzSource.toImage(buf, f.type, {
          onStage: (pc, m) => this.kmzProg(pc, m)
        });
        this.kmzProg(null);
        this.kmzUseImage(r, f.name);
      } catch (e) {
        this.kmzProg(null);
        this.kmzStatus(e.message, true);
      }
    };
    reader.readAsArrayBuffer(f);
  },

  /* ---- আর্কাইভ থেকে বাছাই ---- */

  async kmzArchInit() {
    const k = this.kmz;
    const sel = document.getElementById('kmz-div');
    const searchInput = document.getElementById('kmz-fsearch');
    try {
      this.kmzProg(20, 'আর্কাইভের সূচি আসছে…');
      k.tree = await KmzSource.tree();
      k.treeLoaded = true;
      this.kmzProg(null);
      if (sel) {
        sel.innerHTML = '<option value="">— বিভাগ বাছুন —</option>' +
          k.tree.divisions.map((d, i) => '<option value="' + i + '">' + d.name + '</option>').join('');
      }
      if (searchInput) {
        searchInput.disabled = false;
      }
    } catch (e) {
      this.kmzProg(null);
      if (sel) sel.innerHTML = '<option value="">— আনা যায়নি —</option>';
      this.kmzStatus(this.kmzNetHint('আর্কাইভের সূচি', e), true);
    }
  },

  _kmzFill(id, items, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !items || !items.length;
    el.innerHTML = '<option value="">— ' + label + ' —</option>' +
      (items || []).map((x, i) => '<option value="' + i + '">' + x.name +
        (x.count ? ' (' + toBn(x.count) + ')' : '') + '</option>').join('');
  },

  kmzArchDiv() {
    const k = this.kmz;
    const i = document.getElementById('kmz-div').value;
    k.arch = { div: i === '' ? null : k.tree.divisions[i] };
    this._kmzFill('kmz-dist', k.arch.div ? k.arch.div.districts : [], 'জেলা বাছুন');
    this._kmzFill('kmz-upa', [], 'উপজেলা');
    this._kmzFill('kmz-srv', [], 'জরিপ');
    this.kmzArchList([]);
  },
  kmzArchDist() {
    const k = this.kmz;
    const i = document.getElementById('kmz-dist').value;
    k.arch.dist = i === '' ? null : k.arch.div.districts[i];
    this._kmzFill('kmz-upa', k.arch.dist ? k.arch.dist.upazilas : [], 'উপজেলা বাছুন');
    this._kmzFill('kmz-srv', [], 'জরিপ');
    this.kmzArchList([]);
  },
  kmzArchUpa() {
    const k = this.kmz;
    const i = document.getElementById('kmz-upa').value;
    k.arch.upa = i === '' ? null : k.arch.dist.upazilas[i];
    this._kmzFill('kmz-srv', k.arch.upa ? k.arch.upa.surveys : [], 'জরিপ বাছুন');
    this.kmzArchList([]);
  },
  async kmzArchSrv() {
    const k = this.kmz;
    const i = document.getElementById('kmz-srv').value;
    k.arch.srv = i === '' ? null : k.arch.upa.surveys[i];
    const search = document.getElementById('kmz-fsearch');
    if (!k.arch.srv) { this.kmzArchList([]); return; }
    try {
      this.kmzProg(30, 'ফাইলের তালিকা আসছে…');
      k.archFiles = await KmzSource.filesOf(k.arch.srv.id);
      this.kmzProg(null);
      if (search) { search.disabled = false; search.value = ''; }
      this.kmzArchList(k.archFiles);
    } catch (e) {
      this.kmzProg(null);
      this.kmzArchList([]);
      this.kmzStatus(this.kmzNetHint('ফাইলের তালিকা', e), true);
    }
  },

  kmzArchFilter() {
    const q = (document.getElementById('kmz-fsearch') || {}).value || '';
    this.kmzArchList(MouzaMap.filterFiles(this.kmz.archFiles || [], q));
  },

  kmzArchFilterGlobal() {
    const input = document.getElementById('kmz-fsearch');
    const sugBox = document.getElementById('kmz-search-suggestions');
    if (!input) return;
    const q = input.value.trim().toLowerCase();

    if (this.kmz.archFiles && this.kmz.archFiles.length) {
      this.kmzArchList(MouzaMap.filterFiles(this.kmz.archFiles, q));
    }

    if (!q || q.length < 1 || !this.kmz.tree) {
      if (sugBox) sugBox.style.display = 'none';
      return;
    }

    const matches = [];
    const tree = this.kmz.tree;

    tree.divisions.forEach((div, divIdx) => {
      div.districts.forEach((dist, distIdx) => {
        dist.upazilas.forEach((upa, upaIdx) => {
          upa.surveys.forEach((srv, srvIdx) => {
            const fullText = `${div.name} ${dist.name} ${upa.name} ${srv.name}`.toLowerCase();
            if (fullText.includes(q) || srv.name.toLowerCase().includes(q) || upa.name.toLowerCase().includes(q) || dist.name.toLowerCase().includes(q)) {
              matches.push({
                type: 'survey',
                title: `${upa.name} — ${srv.name}`,
                subtitle: `${div.name} ➔ ${dist.name} ${srv.count ? ' (' + toBn(srv.count) + 'টি নকশা)' : ''}`,
                divIdx, distIdx, upaIdx, srvIdx
              });
            }
          });
        });
      });
    });

    if (sugBox) {
      if (!matches.length) {
        sugBox.innerHTML = '<div class="kmz-sug-item kmz-sug-empty">কোনো ম্যাপ বা জরিপ মেলেনি</div>';
        sugBox.style.display = 'block';
      } else {
        const topMatches = matches.slice(0, 10);
        sugBox.innerHTML = topMatches.map((m) => `
          <div class="kmz-sug-item" onclick="AppController.kmzSelectSuggestion(${m.divIdx}, ${m.distIdx}, ${m.upaIdx}, ${m.srvIdx})">
            <div class="kmz-sug-title"><i class="bi bi-map-fill text-primary"></i> ${m.title}</div>
            <div class="kmz-sug-meta">${m.subtitle}</div>
          </div>
        `).join('');
        sugBox.style.display = 'block';
      }
    }
  },

  async kmzSelectSuggestion(divIdx, distIdx, upaIdx, srvIdx) {
    const sugBox = document.getElementById('kmz-search-suggestions');
    if (sugBox) sugBox.style.display = 'none';

    const k = this.kmz;
    if (!k.tree) return;

    const divSel = document.getElementById('kmz-div');
    if (divSel) divSel.value = divIdx;
    this.kmzArchDiv();

    setTimeout(() => {
      const distSel = document.getElementById('kmz-dist');
      if (distSel) distSel.value = distIdx;
      this.kmzArchDist();

      setTimeout(() => {
        const upaSel = document.getElementById('kmz-upa');
        if (upaSel) upaSel.value = upaIdx;
        this.kmzArchUpa();

        setTimeout(() => {
          const srvSel = document.getElementById('kmz-srv');
          if (srvSel) srvSel.value = srvIdx;
          this.kmzArchSrv();
        }, 50);
      }, 50);
    }, 50);
  },

  kmzArchList(files) {
    const box = document.getElementById('kmz-arch-list');
    if (!box) return;
    const list = files || [];
    if (!list.length) {
      box.className = 'kmz-arch-list';
      box.textContent = this.kmz.arch && this.kmz.arch.srv
        ? 'এই জরিপে কোনো ফাইল মেলেনি।'
        : 'উপরে বিভাগ থেকে জরিপ পর্যন্ত বেছে নিন।';
      return;
    }
    const shown = list.slice(0, 150);
    box.className = 'kmz-arch-list has';
    box.innerHTML = shown.map((f, i) => {
      const usable = MouzaMap.canProxy(f);
      const isTiff = String(f.mimeType) === 'image/tiff';
      const kind = MouzaMap.fileKind(f.mimeType);
      const bad = !usable || isTiff;
      return '<button type="button" class="kmz-af' + (bad ? ' bad' : '') + '"' +
        (bad ? ' disabled title="' + (isTiff ? 'TIFF ব্রাউজারে খোলা যায় না'
                                             : 'ফাইলটি খুব বড়') + '"' : '') +
        ' onclick="AppController.kmzPickArchive(' + i + ')">' +
        '<i class="bi ' + kind.icon + '"></i>' +
        '<span class="kmz-af-n">' + f.name + '</span>' +
        '<span class="kmz-af-s">' + MouzaMap.formatSize(f.size) + '</span>' +
        '</button>';
    }).join('') +
    (list.length > shown.length
      ? '<div class="kmz-af-more">আরও ' + toBn(list.length - shown.length) +
        'টি — খুঁজে ছেঁকে নিন</div>' : '');
    this.kmz.archShown = shown;
  },

  async kmzPickArchive(i) {
    const f = (this.kmz.archShown || [])[i];
    if (!f) return;
    try {
      this.kmzProg(3, 'ফাইল নামানো হচ্ছে…');
      const r = await KmzSource.fromArchive(f, (pc, m) => this.kmzProg(pc, m));
      this.kmzProg(null);
      this.kmzUseImage(r, r.name || f.name);
    } catch (e) {
      this.kmzProg(null);
      this.kmzStatus(e.message, true);
    }
  },

  kmzFitImage() { if (this.kmz.img) KmzImage.fit(); },
  kmzZoom(d) { KmzMap.zoomBy(d); },

  /* ---- জায়গা খোঁজা (নাম বা স্থানাঙ্ক) ---- */

  async kmzGoto() {
    const el = document.getElementById('kmz-goto');
    const btn = document.getElementById('kmz-go-btn');
    if (!el) return;
    const q = String(el.value || '').trim();
    if (!q) { this.kmzStatus('জায়গার নাম বা স্থানাঙ্ক লিখুন।', true); return; }

    if (btn) btn.disabled = true;
    this.kmzGeoList(null, 'খোঁজা হচ্ছে…');
    try {
      const res = await KmzGeo.search(q);
      if (!res.length) {
        this.kmzGeoList([], 'কিছু পাওয়া যায়নি। বানান বদলে বা কাছের বড় জায়গার নাম দিয়ে দেখুন।');
        return;
      }
      if (res.length === 1 || res[0].exact) {
        this.kmzGoTo(res[0]);
        this.kmzGeoList(null);
      } else {
        this.kmzGeoList(res);
      }
    } catch (e) {
      this.kmzGeoList([], e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /** ফলের তালিকা দেখানো (null = লুকানো) */
  kmzGeoList(list, msg) {
    const box = document.getElementById('kmz-geo-results');
    if (!box) return;
    if (list === null && !msg) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = '';
    if (!list || !list.length) {
      box.innerHTML = '<div class="kmz-geo-msg">' + (msg || '…') + '</div>';
      return;
    }
    this.kmz.geoHits = list;
    box.innerHTML = list.map((r, i) =>
      '<button type="button" class="kmz-geo-item" onclick="AppController.kmzGeoPick(' + i + ')">' +
        '<i class="bi bi-geo-alt"></i>' +
        '<span class="kmz-geo-n">' + r.name + '</span>' +
        '<span class="kmz-geo-c">' + toBn(r.lat.toFixed(4)) + ', ' + toBn(r.lng.toFixed(4)) + '</span>' +
      '</button>').join('') +
      '<div class="kmz-geo-msg">তথ্যসূত্র: OpenStreetMap</div>';
  },

  kmzGeoPick(i) {
    const r = (this.kmz.geoHits || [])[i];
    if (!r) return;
    this.kmzGoTo(r);
    this.kmzGeoList(null);
  },

  /** ম্যাপকে একটি জায়গায় নেওয়া */
  kmzGoTo(place, zoom) {
    KmzMap.setCenter(place.lat, place.lng, zoom || 17);
    this.kmzStatus((place.name ? place.name.split(',')[0] + ' — ' : '')
      + 'ওই জায়গায় নেওয়া হলো। এবার ম্যাপে নিয়ন্ত্রণ বিন্দু বসান।');
  },

  /* ---- আমার অবস্থান ---- */

  async kmzMyLocation() {
    const btn = document.getElementById('kmz-loc-btn');
    if (btn) { btn.disabled = true; btn.classList.add('busy'); }
    this.kmzStatus('অবস্থান জানা হচ্ছে… ব্রাউজার অনুমতি চাইলে "Allow" দিন।');
    try {
      const pos = await KmzGeo.myLocation();
      KmzMap.setCenter(pos.lat, pos.lng, 18);
      this.kmzStatus('আপনার অবস্থানে নেওয়া হলো (নির্ভুলতা প্রায় '
        + toBn(Math.round(pos.accuracy)) + ' মিটার)।');
      if (!KmzGeo.inBd(pos.lat, pos.lng)) {
        this.kmzStatus('আপনার অবস্থান বাংলাদেশের বাইরে দেখাচ্ছে — '
          + 'ম্যাপে নিজে খুঁজে নিন।', true);
      }
    } catch (e) {
      this.kmzStatus(e.message, true);
    } finally {
      if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
    }
  },




  kmzOpacity(v) {
    this.kmz.opacity = Number(v) / 100;
    const el = document.getElementById('kmz-op-val');
    if (el) el.textContent = toBn(v) + '%';
    this.kmzPreview(this.kmz.fx);
  },

  /* ---- নকশার পটভূমি ও রঙ (ভিডিওর "স্বচ্ছভাবে / ব্যাকগ্রাউন্ডসহ") ---- */

  KMZ_COLORS: [
    { id: null,      name: 'মূল রঙ',   swatch: 'orig' },
    { id: '#111827', name: 'কালো',     swatch: '#111827' },
    { id: '#dc2626', name: 'লাল',      swatch: '#dc2626' },
    { id: '#2563eb', name: 'নীল',      swatch: '#2563eb' },
    { id: '#16a34a', name: 'সবুজ',     swatch: '#16a34a' },
    { id: '#f59e0b', name: 'হলুদ',     swatch: '#f59e0b' },
    { id: '#ffffff', name: 'সাদা',     swatch: '#ffffff' }
  ],

  kmzRenderColors() {
    const box = document.getElementById('kmz-colors');
    if (!box) return;
    box.innerHTML = this.KMZ_COLORS.map((c, i) =>
      '<button type="button" class="kmz-sw' +
        (this.kmz.color === c.id ? ' active' : '') + '"' +
        ' title="' + c.name + '" onclick="AppController.kmzSetColor(' + i + ')">' +
        (c.swatch === 'orig'
          ? '<span class="kmz-sw-orig"></span>'
          : '<span class="kmz-sw-c" style="background:' + c.swatch + '"></span>') +
        '<span class="kmz-sw-n">' + c.name + '</span>' +
      '</button>').join('');
  },

  kmzSetColor(i) {
    const c = this.KMZ_COLORS[i];
    if (!c) return;
    this.kmz.color = c.id;
    this.kmzRenderColors();
    this.kmzApplyFx();
  },

  kmzSetBg(clear) {
    this.kmz.bgClear = !!clear;
    const a = document.getElementById('kmz-bg-keep');
    const b = document.getElementById('kmz-bg-clear');
    if (a) a.classList.toggle('active', !clear);
    if (b) b.classList.toggle('active', clear);
    const th = document.getElementById('kmz-th-field');
    if (th) th.style.display = clear ? '' : 'none';
    this.kmzApplyFx();
  },

  kmzThreshold(v) {
    this.kmz.threshold = Number(v);
    const el = document.getElementById('kmz-th-val');
    if (el) el.textContent = toBn(v);
    clearTimeout(this._kmzThTimer);
    this._kmzThTimer = setTimeout(() => this.kmzApplyFx(), 220);
  },

  /**
   * মূল ছবিতে স্বচ্ছতা/রঙ বসিয়ে রপ্তানির ছবি তৈরি।
   * ফল `kmz.fx` এ রাখা হয় — KMZ বানানোর সময় এটিই ব্যবহৃত হয়।
   */


  /** প্রিভিউ — স্যাটেলাইট-সদৃশ পটভূমির উপর নকশা কেমন দেখাবে */
  kmzPreview(fx) {
    const box = document.getElementById('kmz-preview-box');
    const cv = document.getElementById('kmz-preview');
    const note = document.getElementById('kmz-preview-note');
    if (!box || !cv) return;
    const src = fx ? fx.img : this.kmz.img;
    if (!src) { box.style.display = 'none'; return; }
    box.style.display = '';

    const ctx = cv.getContext('2d');
    // চেকার + সবুজাভ পটভূমি — স্বচ্ছতা চোখে ধরা পড়ে
    const S = 12;
    for (let y = 0; y < cv.height; y += S) {
      for (let x = 0; x < cv.width; x += S) {
        ctx.fillStyle = ((x / S + y / S) % 2) ? '#3f6b3f' : '#4d7a4d';
        ctx.fillRect(x, y, S, S);
      }
    }
    const sc = Math.min(cv.width / src.width, cv.height / src.height);
    const w = src.width * sc, h = src.height * sc;
    ctx.globalAlpha = this.kmz.opacity;
    ctx.drawImage(src, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    ctx.globalAlpha = 1;

    if (note) {
      note.textContent = fx
        ? (fx.mime === 'image/png' ? 'PNG · ' : 'JPEG · ')
          + toBn(KmzFx.transparentPct(fx.stats).toFixed(0)) + '% স্বচ্ছ'
        : 'মূল ছবি';
    }
  },


  kmzStatus(msg, warn) {
    const el = document.getElementById('kmz-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = '';
    el.textContent = msg;
    el.className = 'kmz-status' + (warn ? ' warn' : '');
  },

  kmzRender() {
    const k = this.kmz;
    const res = document.getElementById('kmz-result');
    const dl = document.getElementById('kmz-dl');
    k.result = null;
    if (!res) return;

    if (k.pairs.length < 2) {
      res.className = 'kmz-empty';
      res.textContent = 'অন্তত ২টি জোড়া বিন্দু লাগবে।';
      if (dl) dl.disabled = true;
      return;
    }

    let t;
    try {
      t = KmzExport.solveTransform(k.pairs);
    } catch (e) {
      res.className = 'kmz-empty bad';
      res.textContent = e.message;
      if (dl) dl.disabled = true;
      return;
    }

    k.result = t;
    const q = KmzExport.quality(t.rmse);
    const modeTxt = t.mode === 'affine' ? 'অ্যাফাইন (তির্যকতাও ধরে)' : 'সিমিলারিটি';

    res.className = 'kmz-ok';
    res.innerHTML =
      '<div class="fz-stats">' +
        '<div class="fz-stat"><span class="v kmz-q-' + q.level + '">' + q.label + '</span><span class="l">ক্যালিব্রেশন</span></div>' +
        '<div class="fz-stat"><span class="v">' + toBn(t.rmse.toFixed(2)) + ' মি</span><span class="l">গড় ত্রুটি</span></div>' +
        '<div class="fz-stat"><span class="v">' + toBn(t.maxError.toFixed(2)) + ' মি</span><span class="l">সর্বোচ্চ ত্রুটি</span></div>' +
        '<div class="fz-stat"><span class="v">' + toBn(k.pairs.length) + 'টি</span><span class="l">নিয়ন্ত্রণ বিন্দু</span></div>' +
        '<div class="fz-stat"><span class="v">' + toBn(t.scale.toFixed(3)) + '</span><span class="l">মিটার / পিক্সেল</span></div>' +
        '<div class="fz-stat"><span class="v" style="font-size:0.9rem">' + modeTxt + '</span><span class="l">পদ্ধতি</span></div>' +
      '</div>' +
      (k.pairs.length === 2
        ? '<div class="fz-warn" style="margin-top:12px"><i class="bi bi-info-circle"></i>' +
          '<span>২টি বিন্দুতে <b>তির্যকতা ঠিক হয় না</b>। পিছনে গিয়ে <b>আরও ১–২টি</b> ' +
          'বিন্দু দিলে ত্রুটি কমবে।</span></div>'
        : '') +
      (t.maxError > 25
        ? '<div class="fz-warn" style="margin-top:12px"><i class="bi bi-exclamation-triangle"></i>' +
          '<span>কোনো একটি বিন্দুর ত্রুটি <b>' + toBn(t.maxError.toFixed(0)) + ' মিটার</b> — ' +
          'সম্ভবত দুই পাশে একই জায়গা ক্লিক করা হয়নি বা ক্রম মেলেনি।</span></div>'
        : '');

    if (dl) dl.disabled = false;
  },

  kmzDownload() {
    const k = this.kmz;
    if (!k.img || !k.result) return;
    let out;
    try {
      const useFx = k.fx;
      out = KmzExport.build({
        imageBytes: useFx ? useFx.bytes : k.imgBytes,
        imageName: useFx ? KmzFx.nameFor(k.imgName, useFx.mime) : k.imgName,
        width: k.img.width,
        height: k.img.height,
        name: (document.getElementById('kmz-name') || {}).value || 'মৌজা ম্যাপ',
        opacity: k.opacity,
        points: k.pairs
      });
    } catch (e) {
      this.kmzStatus('KMZ বানানো গেল না: ' + e.message, true);
      return;
    }
    const blob = new Blob([out.bytes], { type: 'application/vnd.google-earth.kmz' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const base = ((document.getElementById('kmz-name') || {}).value || 'mouza-map')
      .replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    a.href = url; a.download = base + '.kmz';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.kmzStatus('KMZ নামানো হলো — Google Earth এ খুলুন।');
  },


  /* ------------------------------------------------------------------------
     মৌজা ম্যাপে জমি পরিমাপ — গণিত MapMeasure এ, আঁকা MeasureCanvas এ
     ------------------------------------------------------------------------ */

  mm: { img: null, imgName: '', isPdf: false, pdfScale: 0,
        ftPerPx: 0, scaleFrom: '', calibrating: null,
        tree: null, treeLoaded: false, arch: {}, archFiles: [], archShown: [],
        divMode: 'prop', shareMode: 'satak', shares: [], division: null, cutLine: null },

  initMeasure() {
    const c = document.getElementById('mm-canvas');
    if (!c) return;
    this.mmSizeCanvas();
    if (!c._mmInit) {
      c._mmInit = true;
      MeasureCanvas.init(c, {
        onChange: () => this.mmRefresh(),
        onSelect: () => this.mmRefresh(),
        onView: () => { this.mmPrecision(); this.mmHiResSoon(); },
        onHistory: () => this.mmRenderHistory(),
        onRestore: data => {
          this.mm.ftPerPx = data.ftPerPx;
          this.mm.division = data.division;
          this.mm.scaleFrom = 'ইতিহাস থেকে ফিরিয়ে আনা';
        }
      });
      // ★ জানালার মাপ বদলালে বা ফোন ঘোরালে ক্যানভাস আর ক্লিকের হিসাব
      //   আলাদা হয়ে যেত — তখন থেকে সব ক্লিক সরে পড়ত
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => this.mmSizeCanvas()).observe(c);
      } else {
        window.addEventListener('resize', () => this.mmSizeCanvas());
      }
    } else {
      MeasureCanvas.state.canvas = c;
      MeasureCanvas.draw();
    }
    this.mmFillScaleOptions();
    this.mmFillLabelUnits();
    this.mmRefresh();
  },

  /** বাহুর লেবেলের একক — ফিট'ইঞ্চি · ফিট · লিংক · চেইন · মিটার */
  mmFillLabelUnits() {
    const sel = document.getElementById('mm-label-unit');
    if (!sel) return;
    sel.innerHTML = MapMeasure.LABEL_UNITS
      .map(u => '<option value="' + u.id + '">' + u.label + '</option>').join('');
    sel.value = MeasureCanvas.state ? MeasureCanvas.state.labelUnit : 'ftin';
  },

  mmLabelUnit(u) {
    MeasureCanvas.setLabelUnit(u);
    this.mmDivRefresh();          // বাহুর তালিকাও একই এককে
  },

  mmSizeCanvas() {
    const c = document.getElementById('mm-canvas');
    const st = document.getElementById('mm-stage');
    if (!c || !st) return;
    // ★ canvas এর নিজের মাপ ধরতে হবে, stage এর নয় — stage এ বর্ডার আছে,
    //   CSS ক্যানভাসকে টানে তার **ভেতরের** মাপে। আগে stage এর মাপ বসানোয়
    //   ২ পিক্সেল ফারাক থাকত, জুম-আউটে যা ২০+ ফুট ভুল হয়ে দাঁড়াত।
    const r = c.getBoundingClientRect();
    const w = Math.max(280, Math.round(r.width || st.clientWidth));
    const h = Math.max(320, Math.round(r.height || st.clientHeight));
    const s = MeasureCanvas.state;
    // মাপ না বদলালে কিছুই করব না — ResizeObserver থেকে ডাকা হয়, তাই
    // অকারণে draw() করলে "loop completed with undelivered notifications"
    if (s && s.viewW === w && s.viewH === h) return;
    if (s) MeasureCanvas.resize(w, h);
    else { c.width = w; c.height = h; }
  },

  /* ---- স্কেলের ড্রপডাউন ---- */

  mmFillScaleOptions() {
    const ms = document.getElementById('mm-mapscale');
    if (ms && !ms.options.length) {
      ms.innerHTML = MapMeasure.MAP_SCALES.map((x, i) =>
        '<option value="' + i + '">' + x.label + '</option>').join('');
    }
    const dp = document.getElementById('mm-dpi');
    if (dp && !dp.options.length) {
      dp.innerHTML = MapMeasure.DPI_OPTIONS.map(x =>
        '<option value="' + x.dpi + '">' + x.label + '</option>').join('');
    }
    this.mmFillBarLengths();
  },

  /**
   * ★ পদ্ধতি ২ এর দূরত্বের তালিকা — নকশার স্কেল বদলালে বদলায়
   *
   * আমিনরা ফিতা ধরে ফুট গোনেন না — গুনিয়া বা ফুট স্কেলের **ঘর**
   * গোনেন। তাই চেইনের সাথে ঘর-ভিত্তিক বিকল্পও থাকে, আর খুলে লেখা
   * থাকে কত ঘর = কত ফুট।
   */
  /**
   * ★ গুনিয়া ও ফুট স্কেলে এক ঘর কত — ছবি এঁকে দেখানো
   *
   * আমিনরা গুনিয়া হাতে ধরে ঘর গোনেন, কিন্তু কোন সারিতে এক ঘর কত লিংক
   * তা নকশার স্কেলের উপর নির্ভর করে — নতুন কেউ এখানেই ঠকেন।
   * তাই বাছাই অনুযায়ী দুই সারির দাগ ও ফুট স্কেল সরাসরি এঁকে দেখাই।
   */
  /**
   * ★ পদ্ধতি ২ এর ছবি — নকশার স্কেল-দণ্ডে কোথায় ক্লিক
   *
   * মৌজা নকশার নিচে যে দণ্ড আঁকা থাকে সেটি **কর্ণ স্কেল** — বাঁ প্রান্তে
   * ০, মাঝে ৫, ডান প্রান্তে ১০ চেইন। বাঁ অর্ধেকে তির্যক রেখার জাল,
   * যা দিয়ে চেইনের ভগ্নাংশ পড়া যায়; বাঁ পাশে ২ · ৪ · ৬ · ৮ · ১০।
   *
   * দুটি লাল পিন দেখায় ঠিক কোন দুই দাগে ক্লিক করতে হবে — ইউজার
   * যে দূরত্ব বেছেছেন সেই অনুযায়ী সরে, আর নিচে তীর দিয়ে মাপ লেখা থাকে।
   */
  mmDrawCalibHelp() {
    const box = document.getElementById('mm-calib-help');
    if (!box) return;
    const bl = document.getElementById('mm-barlen');
    const raw = (bl || {}).value;
    const feet = Number(raw);

    const CH = 10;                       // দণ্ডটি ১০ চেইন
    const W = 340, H = 132;
    const L = 34, R = W - 20;            // দণ্ডের দুই প্রান্ত (বাঁ = ০)
    const T = 46, B = 92;                // উপর-নিচ
    const per = (R - L) / CH;
    const xAt = c => L + per * c;
    const bn = v => toBn(String(Number(v.toFixed(2))));

    /* দণ্ডের জাল */
    let grid = '';
    for (let i = 0; i <= 5; i++) {
      const y = T + (B - T) * i / 5;
      grid += 'M' + L + ' ' + y.toFixed(1) + 'H' + R + ' ';
    }
    for (let c = 0; c <= CH; c++) {
      grid += 'M' + xAt(c).toFixed(1) + ' ' + T + 'V' + B + ' ';
    }
    /* বাঁ অর্ধেকে তির্যক জাল (০ থেকে ৫ চেইন) */
    let diag = '';
    for (let c = 0; c < 5; c++) {
      diag += 'M' + xAt(c).toFixed(1) + ' ' + T
            + 'L' + xAt(c + 1).toFixed(1) + ' ' + B + ' ';
    }

    /* কোথায় ক্লিক — বাছাই অনুযায়ী */
    let x1 = xAt(0), x2 = xAt(CH), lab2 = '১০ চেইন', note = '', span = '';
    if (feet > 0) {
      const ch = feet / MapMeasure.FT_PER_CHAIN;
      if (ch <= CH + 1e-9) {
        x2 = xAt(ch);
        lab2 = (Math.abs(ch - Math.round(ch)) < 1e-9 ? toBn(Math.round(ch)) : bn(ch))
             + ' চেইন';
        span = bn(feet) + ' ফুট = ' + lab2;
      } else {
        note = '⚠️ নির্বাচিত <b>' + bn(feet) + ' ফুট</b> দণ্ডটির চেয়েও বড় — '
             + 'নকশায় এত লম্বা চেনা দূরত্ব থাকলে তবেই বাছুন।';
        span = bn(feet) + ' ফুট';
      }
    } else if (raw === 'custom') {
      note = 'দৈর্ঘ্য নিজে লিখবেন — বোতামে চাপ দিলে জিজ্ঞেস করবে।';
      span = 'আপনার লেখা মাপ';
    }

    /* পিন — বাক্স + নিচের দিকে তির, তারপর ড্যাশ রেখা ও বিন্দু */
    const pin = (x, n) => {
      const cx = Math.max(L + 9, Math.min(R - 9, x));
      return '<g class="c-pin">'
        + '<line x1="' + x.toFixed(1) + '" y1="' + (T - 4)
        + '" x2="' + x.toFixed(1) + '" y2="' + (B + 4) + '"/>'
        + '<circle class="c-hit" cx="' + x.toFixed(1) + '" cy="' + B + '" r="3.4"/>'
        + '<path class="c-tip" d="M' + (x - 4.5).toFixed(1) + ' ' + (T - 8)
        + 'H' + (x + 4.5).toFixed(1) + 'L' + x.toFixed(1) + ' ' + (T - 2) + 'Z"/>'
        + '<rect class="c-tag" x="' + (cx - 9) + '" y="' + (T - 26)
        + '" width="18" height="18" rx="9"/>'
        + '<text class="c-tagt" x="' + cx + '" y="' + (T - 13.5) + '">' + toBn(n) + '</text>'
        + '</g>';
    };

    /* দুই পিনের মাঝে মাপের তীর */
    const ay = B + 22;
    const arrow = Math.abs(x2 - x1) > 26
      ? '<g class="c-arrow">'
        + '<line x1="' + x1.toFixed(1) + '" y1="' + ay + '" x2="' + x2.toFixed(1)
        + '" y2="' + ay + '"/>'
        + '<path d="M' + (x1 + 6).toFixed(1) + ' ' + (ay - 3.5) + 'L' + x1.toFixed(1)
        + ' ' + ay + 'L' + (x1 + 6).toFixed(1) + ' ' + (ay + 3.5) + 'Z"/>'
        + '<path d="M' + (x2 - 6).toFixed(1) + ' ' + (ay - 3.5) + 'L' + x2.toFixed(1)
        + ' ' + ay + 'L' + (x2 - 6).toFixed(1) + ' ' + (ay + 3.5) + 'Z"/>'
        + (span ? '<rect class="c-spanbg" x="' + ((x1 + x2) / 2 - 42) + '" y="' + (ay - 8)
            + '" width="84" height="16" rx="8"/>'
            + '<text class="c-spant" x="' + ((x1 + x2) / 2) + '" y="' + (ay + 4)
            + '">' + span + '</text>' : '')
        + '</g>' : '';

    box.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-calib-svg" role="img" '
      + 'aria-label="নকশার স্কেল-দণ্ডে কোথায় ক্লিক করতে হবে">'
      + '<rect x="' + L + '" y="' + T + '" width="' + (R - L) + '" height="' + (B - T)
      + '" class="c-body"/>'
      + '<path d="' + diag + '" class="c-diag"/>'
      + '<path d="' + grid + '" class="c-grid"/>'
      + '<circle cx="' + L + '" cy="' + (T - 30) + '" r="0"/>'
      + '<text x="' + L + '" y="' + (B + 11) + '" class="c-lab">০</text>'
      + '<text x="' + xAt(5) + '" y="' + (B + 11) + '" class="c-lab">৫</text>'
      + '<text x="' + R + '" y="' + (B + 11) + '" class="c-lab end">১০ চেইন</text>'
      + '<text x="' + (L - 5) + '" y="' + (T + 5) + '" class="c-side">২</text>'
      + '<text x="' + (L - 5) + '" y="' + ((T + B) / 2 + 3) + '" class="c-side">৬</text>'
      + '<text x="' + (L - 5) + '" y="' + (B + 2) + '" class="c-side">১০</text>'
      + arrow + pin(x1, 1) + pin(x2, 2)
      + '</svg>'
      + '<p class="mm-calib-cap">'
      + '<span class="c-num">১</span> দণ্ডের <b>‘০’ দাগে</b> ক্লিক করুন, '
      + 'তারপর <span class="c-num">২</span> <b>‘' + lab2 + '’ দাগে</b>।'
      + (note ? '<br>' + note : '') + '</p>';
  },

  mmDrawGunia() {
    const box = document.getElementById('mm-gunia');
    if (!box) return;
    const ms = document.getElementById('mm-mapscale');
    const sc = MapMeasure.MAP_SCALES[Number((ms || {}).value || 0)];
    if (!sc) { box.innerHTML = ''; return; }

    const W = 260, H = 40;
    const num = v => toBn(String(Number(v.toFixed(2))));
    /** একটি সারি — ১০টি ঘর, মাঝে লম্বা দাগ */
    const row = (y, n, tall) => {
      let d = '';
      for (let i = 0; i <= n; i++) {
        const x = 10 + (W - 20) * i / n;
        const big = i % 5 === 0;
        d += 'M' + x.toFixed(1) + ' ' + y + 'v' + (big ? tall : tall * 0.55) + ' ';
      }
      return d;
    };

    const g = MapMeasure.barMark('gunia', sc.inchPerMile);
    const f = MapMeasure.barMark('guniaFine', sc.inchPerMile);
    const ft = MapMeasure.barMark('foot', sc.inchPerMile);

    const svg =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mm-gunia-svg" role="img" '
      + 'aria-label="গুনিয়া স্কেলের দুই সারি">'
      + '<rect x="8" y="6" width="' + (W - 16) + '" height="' + (H - 12)
      + '" rx="3" class="g-body"/>'
      + '<line x1="8" y1="' + (H / 2) + '" x2="' + (W - 8) + '" y2="' + (H / 2)
      + '" class="g-mid"/>'
      // উপরের সারি — দ্বিগুণ ঘন, মান অর্ধেক
      + '<path d="' + row(6, 20, 7) + '" class="g-tick"/>'
      // নিচের সারি — বড় ঘর
      + '<path d="' + row(H - 6, 10, -7) + '" class="g-tick"/>'
      + '</svg>';

    box.innerHTML =
      '<div class="mm-gunia-head"><i class="bi bi-rulers"></i> এই নকশায় '
      + '<b>' + toBn(sc.inchPerMile) + '″ = ১ মাইল</b> — এক ঘর কত?</div>'
      + svg
      + '<ul class="mm-gunia-list">'
      + '<li><span class="g-dot up"></span>গুনিয়া <b>উপরের</b> সারি (ছোট ঘর) '
      + '<b>' + num(f.link) + ' লিংক</b> <i>= ' + num(f.feet) + ' ফুট</i></li>'
      + '<li><span class="g-dot down"></span>গুনিয়া <b>নিচের</b> সারি (বড় ঘর) '
      + '<b>' + num(g.link) + ' লিংক</b> <i>= ' + num(g.feet) + ' ফুট</i></li>'
      + '<li><span class="g-dot ft"></span>ফুট (মাপনি) স্কেল '
      + '<b>' + num(ft.feet) + ' ফুট</b> <i>(প্রতি ইঞ্চিতে ৩৩ ঘর)</i></li>'
      + '</ul>'
      + '<p class="mm-gunia-note">এক ঘর = এক দাগ থেকে পরের দাগ পর্যন্ত। '
      + 'উপরের সারি সবসময় নিচের সারির ঠিক অর্ধেক।</p>';
  },

  mmFillBarLengths() {
    this.mmDrawGunia();
    const bl = document.getElementById('mm-barlen');
    if (!bl) return;
    const ms = document.getElementById('mm-mapscale');
    const sc = MapMeasure.MAP_SCALES[Number((ms || {}).value || 0)];
    const keep = bl.value;
    const list = MapMeasure.calibChoices(sc ? sc.inchPerMile : 0);
    const chain = list.filter(x => /চেইন/.test(x.label));
    const bars = list.filter(x => !/চেইন/.test(x.label));
    const opt = x => '<option value="' + x.ft + '">' + x.label + '</option>';
    bl.innerHTML =
      '<optgroup label="নকশার স্কেল-দণ্ড (চেইন)">'
        + chain.map(opt).join('') + '</optgroup>'
      + (bars.length && sc
          ? '<optgroup label="ঘর গুনে — ' + toBn(sc.inchPerMile) + '″/মাইল নকশায়">'
            + bars.map(opt).join('') + '</optgroup>' : '')
      + '<option value="custom">অন্য দৈর্ঘ্য (নিজে লিখব)</option>';
    // আগের বাছাই থাকলে রাখি, নইলে ৫ চেইন (সবচেয়ে প্রচলিত)
    if (keep && [].some.call(bl.options, o => o.value === keep)) bl.value = keep;
    else bl.value = '330';
    this.mmDrawCalibHelp();
  },

  mmScaleDialog(show) {
    const m = document.getElementById('mm-scale-modal');
    if (!m) return;
    m.style.display = show ? '' : 'none';
    if (show) this.mmSyncDpiState();
  },

  /** PDF হলে DPI বন্ধ — কারণ রেন্ডার স্কেল থেকেই বেরিয়ে আসে */
  mmSyncDpiState() {
    const k = this.mm;
    const dp = document.getElementById('mm-dpi');
    const badge = document.getElementById('mm-dpi-badge');
    const note = document.getElementById('mm-dpi-note');
    if (!dp) return;
    const save = document.getElementById('mm-scale-save');
    if (save) { save.disabled = false; save.textContent = 'সেভ করুন'; }

    if (k.isPdf && k.pdfScale > 0) {
      const dpi = MapMeasure.dpiForPdf(k.pdfScale);
      // ★ আগে এখানে ড্রপডাউন **বন্ধ** করে দেওয়া হতো — ধরে নেওয়া হতো PDF এর
      //   পাতার মাপ মানেই আসল কাগজের মাপ। স্ক্যান করা নকশায় তা প্রায়ই নয়
      //   (পাতার মাপ = ছবির পিক্সেল সংখ্যা)। তখন বেরোনো DPI অর্থহীন, অথচ
      //   ইউজার বদলাতেও পারতেন না — সব মাপ নীরবে ভুল হতো।
      const trusty = dpi >= 100 && dpi <= 900;
      /* ★★ PDF এ DPI হাতে বাছা যাবে না — এবং এটা খেয়ালের বশে নয়।
         আমরা PDF নিজেরাই আঁকি, তাই ছবির পিক্সেল ঘনত্ব আমাদের রেন্ডার
         স্কেলের উপর নির্ভর করে। "৩০০ DPI" কথাটার তখন কোনো স্থির অর্থ
         থাকে না — রেন্ডার বড় করলেই একই জমি বড় মাপা হয়।
         বাস্তবে ঘটেছিল: রেন্ডার ১.৪০× বড় করার পর হাতে বসানো ৩০০ DPI
         দিয়ে মাপ ১.৪০× লম্বা, ক্ষেত্রফল ১.৯৭× বেশি আসছিল।
         একমাত্র স্থির মান `৭২ × রেন্ডার স্কেল` — এতে ফল কেবল PDF এর
         পাতার মাপের উপর নির্ভর করে, আমাদের রেজুলেশনে বদলায় না। */
      dp.disabled = true;
      if (!dp._mmSet) {
        if (![].some.call(dp.options, o => Math.abs(Number(o.value) - dpi) < 0.5)) {
          const op = document.createElement('option');
          op.value = String(Math.round(dpi));
          op.textContent = 'PDF থেকে পাওয়া — ' + toBn(dpi.toFixed(0)) + ' DPI';
          dp.insertBefore(op, dp.firstChild);
        }
        dp.value = String(Math.round(dpi));
        dp._mmSet = true;
      }
      if (badge) {
        badge.style.display = '';
        badge.textContent = trusty ? '✓ PDF থেকে পাওয়া' : '⚠ কাজে লাগবে না';
        badge.className = 'mm-badge ' + (trusty ? 'auto' : 'warn');
      }
      // পাতার মাপ পিক্সেল-পয়েন্ট হলে পদ্ধতি ১ দিয়ে কিছুতেই ঠিক হবে না
      if (!trusty && save) {
        save.disabled = true;
        save.textContent = 'এই PDF এ সম্ভব নয়';
      }
      if (note) {
        const pg = k.pageIn
          ? ' পাতার মাপ ' + toBn(k.pageIn.w.toFixed(1)) + '×'
            + toBn(k.pageIn.h.toFixed(1)) + ' ইঞ্চি।'
          : '';
        note.innerHTML = trusty
          ? 'PDF থেকে DPI বেরিয়ে এসেছে <b>' + toBn(dpi.toFixed(0)) + '</b>।' + pg
            + ' এটি PDF নিজেই বলে দেয়, তাই হাতে বাছার দরকার নেই।'
          : '<b>এই PDF দিয়ে পদ্ধতি ১ চলবে না।</b> পাতার মাপ '
            + (k.pageIn ? '<b>' + toBn(k.pageIn.w.toFixed(0)) + '×'
                + toBn(k.pageIn.h.toFixed(0)) + ' ইঞ্চি</b> — ' : '')
            + 'অর্থাৎ ছবির পিক্সেল সংখ্যাকেই পাতার মাপ ধরে PDF বানানো হয়েছে, '
            + 'আসল কাগজের মাপ এতে নেই। কাগজের মাপ না জানলে DPI বের করার '
            + 'কোনো উপায় নেই — অনুমান করলে মাপ নীরবে ভুল হবে। '
            + 'নিচের <b>পদ্ধতি ২</b> ব্যবহার করুন, ওটাই এখানে সঠিক পথ।';
      }
    } else {
      dp.disabled = false;
      if (badge) badge.style.display = 'none';
      if (note) note.textContent = 'ছবির DPI জানা না থাকলে ৩০০ ধরে নিন — '
        + 'নিখুঁত মাপ চাইলে পদ্ধতি ২ ব্যবহার করুন।';
    }
  },

  mmApplyMapScale() {
    const k = this.mm;
    const i = Number((document.getElementById('mm-mapscale') || {}).value || 0);
    const sc = MapMeasure.MAP_SCALES[i];
    if (!sc) return;
    /* ★ PDF হলে সবসময় বেরোনো DPI — ড্রপডাউনের মান নয়।
       আমরা PDF নিজেরাই আঁকি, তাই হাতে বসানো DPI আমাদের রেন্ডার
       রেজুলেশনের সাথে অর্থ বদলায়; `৭২ × রেন্ডার স্কেল` নিলে ফল কেবল
       PDF এর পাতার মাপের উপর নির্ভর করে, আমরা কত বড় আঁকলাম তাতে নয়। */
    let dpi;
    if (k.isPdf && k.pdfScale > 0) {
      dpi = MapMeasure.dpiForPdf(k.pdfScale);
      if (!(dpi >= 100 && dpi <= 900)) {
        alert('এই PDF এ পাতার মাপ আসল কাগজের মাপ নয়, তাই DPI বের করা '
          + 'যাচ্ছে না (এল ' + toBn(dpi.toFixed(0)) + ')।\n\n'
          + 'অনুমান করলে মাপ নীরবে ভুল হবে। নিচের পদ্ধতি ২ — '
          + '"ম্যাপ থেকে মাপুন" ব্যবহার করুন।');
        return;
      }
    } else {
      dpi = Number((document.getElementById('mm-dpi') || {}).value || 300);
    }
    try {
      const r = MapMeasure.fromMapScale(1, sc.ftPerInch, dpi);
      const sane = MapMeasure.scaleSanity(r.ftPerPx, dpi);
      if (!sane.ok && !confirm(sane.msg + '\n\nতবু এই স্কেলই বসাবেন?')) return;
      k.ftPerPx = r.ftPerPx;
      k.scaleFrom = sc.label + ' · ' + toBn(dpi.toFixed(0)) + ' DPI';
      MeasureCanvas.setScale(k.ftPerPx);
      MeasureCanvas.commitHistory('স্কেল সেট করা');
      this.mmScaleDialog(false);
      this.mmRefresh();
    } catch (e) { alert(e.message); }
  },

  /* ---- পদ্ধতি ২ — ম্যাপ থেকে ক্যালিব্রেট ---- */

  mmStartCalibrate() {
    const k = this.mm;
    if (!k.img) { alert('আগে একটি ম্যাপ নিন'); return; }
    let ft = (document.getElementById('mm-barlen') || {}).value;
    if (ft === 'custom') {
      const v = prompt('স্কেল-দণ্ডটি বাস্তবে কত ফুট?', '৬৬০');
      if (v == null) return;
      ft = Number(toEn(String(v)));
      if (!(ft > 0)) { alert('সঠিক দূরত্ব দিন!'); return; }
    }
    k.calibrating = { feet: Number(ft) };
    this.mmScaleDialog(false);
    this.mmCalibHint(0);
    MeasureCanvas.startCalibrate(
      (p1, p2) => this.mmFinishCalibrate(p1, p2),
      n => this.mmCalibHint(n)
    );
  },

  mmCalibHint(done) {
    const k = this.mm;
    const bar = document.getElementById('mm-draw-bar');
    const hint = document.getElementById('mm-draw-hint');
    const fin = document.getElementById('mm-finish');
    if (!bar || !hint || !k.calibrating) return;
    bar.style.display = '';
    if (fin) fin.style.display = 'none';
    // ক্যালিব্রেশনে "শেষ পয়েন্ট মুছুন" এর কোনো অর্থ নেই
    const un = document.getElementById('mm-undo');
    if (un) un.style.display = 'none';
    const touch = matchMedia('(pointer: coarse)').matches;
    hint.innerHTML = '<b>স্কেল ঠিক করা —</b> দুই ক্লিকের মাঝের দূরত্ব <b>'
      + toBn(k.calibrating.feet) + ' ফুট</b>। '
      + (done === 0 ? '<b>১ম</b>' : '<b>২য়</b>') + ' বিন্দুতে '
      + (touch ? 'চাপ দিন' : 'ক্লিক করুন')
      + ' (' + toBn(done) + '/২) · ভুল হলে বাতিল';
  },

  mmFinishCalibrate(p1, p2) {
    const k = this.mm;
    const bar = document.getElementById('mm-draw-bar');
    const fin = document.getElementById('mm-finish');
    if (fin) fin.style.display = '';
    const un = document.getElementById('mm-undo');
    if (un) un.style.display = '';
    const feet = k.calibrating ? k.calibrating.feet : 0;
    try {
      const r = MapMeasure.calibrate(p1, p2, feet);
      k.ftPerPx = r.ftPerPx;
      k.scaleFrom = 'ম্যাপ থেকে মাপা (' + toBn(feet) + ' ফুট = '
        + toBn(Math.round(r.pxLength)) + ' পিক্সেল)';
      k.calibrating = null;
      MeasureCanvas.setScale(k.ftPerPx);
      MeasureCanvas.commitHistory('স্কেল ক্যালিব্রেট করা');
      if (bar) bar.style.display = 'none';
      this.mmTool('pan');
      this.mmRefresh();

      /* ★ ক্যালিব্রেশনের ভুল সবচেয়ে ব্যয়বহুল — একবার ভুল হলে পরের
         প্রতিটি মাপে সেটা গুণ হয়ে বসে। দুই ক্লিক পর্দায় যত কম পিক্সেল
         দূরে, ভুলের হার তত বেশি (১ পিক্সেল এদিক-ওদিক ÷ মোট পিক্সেল)।
         তাই কম হলে বলে দিই, আর সংখ্যাটাও দেখাই। */
      const spanPx = r.pxLength * (MeasureCanvas.state.scale || 1);
      if (spanPx < 150) {
        const err = (100 / Math.max(spanPx, 1)).toFixed(1);
        alert('স্কেল বসেছে, কিন্তু দুই ক্লিক পর্দায় মাত্র '
          + toBn(Math.round(spanPx)) + ' পিক্সেল দূরে ছিল।\n\n'
          + 'এক পিক্সেল এদিক-ওদিক হলেই স্কেলে প্রায় ' + toBn(err)
          + '% ভুল — আর সেই ভুল পরের সব মাপে গুণ হয়ে বসবে।\n\n'
          + 'ভালো হয় যদি জুম করে (+ বোতাম বা দুই আঙুলে) আবার '
          + 'ক্যালিব্রেট করেন — দুই বিন্দু পর্দাজুড়ে যত দূরে, তত নিখুঁত।');
      }
    } catch (e) {
      k.calibrating = null;
      if (bar) bar.style.display = 'none';
      alert(e.message + ' — আবার চেষ্টা করুন।');
      this.mmRefresh();
    }
  },

  /* ---- টুল ---- */

  mmTool(t) {
    if (this.mm.calibrating) return;
    MeasureCanvas.setTool(t);
    document.querySelectorAll('#mm-tools .mm-tool').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === t));
    const bar = document.getElementById('mm-draw-bar');
    if (bar) bar.style.display = t === 'draw' ? '' : 'none';
    const pb = document.getElementById('mm-pt-bar');
    if (pb) pb.style.display = t === 'point' ? '' : 'none';
    if (t !== 'point') MeasureCanvas.state.picked = null;
    this.mmRefresh();
  },

  /** পয়েন্ট টুলে বাছাই করা কোণা মুছে ফেলা */
  mmDelVertex() {
    const p = MeasureCanvas.state.picked;
    if (!p) return;
    if (!MeasureCanvas.deleteVertex(p.plot, p.index)) {
      alert('একটি প্লটে অন্তত ৩টি বিন্দু থাকতেই হবে — আর মোছা যাবে না।');
      return;
    }
    this.mmRefresh();
  },

  /**
   * ★ জুম করলে ছবি ফেটে যাওয়া ঠেকানো
   *
   * পুরো নকশা একবারে যত বড় আঁকা সম্ভব তার সীমা আছে (স্মৃতি)। কিন্তু
   * জুম করলে পর্দায় তো একটুকুই থাকে — তাই শুধু সেই অংশটুকু PDF থেকে
   * নতুন করে আঁকি। স্মৃতি বাড়ে না, অথচ রেখা বেক্তরের মতো পরিষ্কার থাকে।
   *
   * ছবি (JPG/PNG) এ এটা করা যায় না — ওখানে বেশি রেজুলেশন নেই।
   */
  HIRES_MIN_ZOOM: 1.15,

  mmHiResSoon() {
    clearTimeout(this._mmHiT);
    this._mmHiT = setTimeout(() => this.mmHiRes(), 220);
  },

  async mmHiRes() {
    const k = this.mm;
    /* ★ pdf.js একই পাতায় দুটি রেন্ডার একসাথে চালাতে দেয় না — দ্বিতীয়টি
       প্রথমটিকে মেরে ফেলে। দ্রুত জুম + প্যান করলে ঠিক তাই হতো আর
       ছবি ফাটাই থেকে যেত। তাই একটি শেষ না হলে আরেকটি শুরু হয় না। */
    if (k.hiBusy) { k.hiAgain = true; return; }
    k.hiBusy = true;
    try { await this._mmHiResOnce(); }
    finally {
      k.hiBusy = false;
      if (k.hiAgain) { k.hiAgain = false; this.mmHiResSoon(); }
    }
  },

  async _mmHiResOnce() {
    const k = this.mm;
    const st = MeasureCanvas.state;
    if (!k.pdfPage || !st || !k.img) return;
    // মূল ছবির তুলনায় কত গুণ বড় দেখানো হচ্ছে (পর্দার ঘনত্বসহ)
    const need = st.scale * st.dpr;
    if (need < this.HIRES_MIN_ZOOM) {
      if (st.hi) MeasureCanvas.setHiRes(null);
      return;
    }
    const rect = MeasureCanvas.visibleRect();
    if (!rect) return;
    const seq = ++k.hiSeq;
    try {
      const hi = await KmzSource.renderRegion(k.pdfPage, k.pdfScale, rect, need);
      if (seq !== k.hiSeq) return;              // এর মধ্যে আবার নড়েছে
      MeasureCanvas.setHiRes(hi);
    } catch (e) {
      // এলাকা খুব বড় বা রেন্ডার বাতিল — মূল ছবিই থাকুক, কিছু ভাঙে না
      if (seq === k.hiSeq && st.hi) MeasureCanvas.setHiRes(null);
    }
  },

  mmZoom(d) { MeasureCanvas.zoom(d); this.mmPrecision(); },
  mmFit() { MeasureCanvas.fit(); this.mmPrecision(); },

  /**
   * ★ এই জুমে এক পর্দা-পিক্সেল কত ফুট
   *
   * পুরো নকশা পর্দায় ধরালে ১ পিক্সেল ১০-১২ ফুট হয়ে যায় — তখন যত ভালো
   * করেই ক্লিক করুন, ক্ষেত্রফলে ২-৩% ভুল থাকবেই। এটা বাগ নয়, জ্যামিতি।
   * তাই সংখ্যাটা চোখের সামনে রাখি, আর বেশি হলে জুম করতে বলি।
   */
  mmPrecision() {
    const el = document.getElementById('mm-prec');
    if (!el) return;
    const k = this.mm;
    const st = MeasureCanvas.state;
    if (!k.img || !(k.ftPerPx > 0) || !st || !(st.scale > 0)) {
      el.style.display = 'none';
      return;
    }
    const ft = k.ftPerPx / st.scale;          // ১ পর্দা-পিক্সেল = কত ফুট
    const level = ft > 3 ? 'bad' : ft > 1 ? 'warn' : 'ok';
    el.style.display = '';
    el.className = 'mm-prec ' + level;
    el.innerHTML = '<i class="bi bi-' +
      (level === 'ok' ? 'crosshair' : 'exclamation-triangle') + '"></i>' +
      '<span>১ পিক্সেল ≈ <b>' + MapMeasure.formatLength(ft, st.labelUnit) + '</b>' +
      (level === 'ok' ? '' : ' — জুম করে আঁকুন') + '</span>';
  },

  mmUndoPoint() { MeasureCanvas.undoDraftPoint(); },

  mmHistoryUndo() { MeasureCanvas.undoHistory(); },
  mmHistoryRedo() { MeasureCanvas.redoHistory(); },
  mmHistoryGo(i) { MeasureCanvas.restoreHistory(Number(i)); },
  /**
   * "বাতিল" — যা চলছিল তাই থামায়
   * ★ আগে কেবল খসড়া মুছত। ক্যালিব্রেশন শুরু করে ফেললে বেরোনোর কোনো পথই
   *   ছিল না (cancelCalibrate লেখা থাকলেও কোথাও বাঁধা ছিল না)।
   */
  mmCancelDraft() {
    if (this.mm.calibrating) {
      this.mm.calibrating = null;
      MeasureCanvas.cancelCalibrate();
      const bar = document.getElementById('mm-draw-bar');
      if (bar) bar.style.display = 'none';
      const un = document.getElementById('mm-undo');
      if (un) un.style.display = '';
      this.mmRefresh();
      return;
    }
    MeasureCanvas.cancelDraft();
  },

  mmFinish() {
    const r = MeasureCanvas.closePlot();
    if (!r.ok) { alert(r.msg); return; }
    this.mmRefresh();
  },

  /** নিজেকে কাটা প্লট দিয়ে ভাগ করা বা মাপ নেওয়া নিরাপদ নয় */
  mmGuardBroken(plot) {
    const bad = plot && MeasureCanvas.plotBroken(plot);
    if (!bad) return false;
    alert('এই প্লটের ' + toBn(bad.i + 1) + ' নং আর ' + toBn(bad.j + 1)
      + ' নং বাহু একে অপরকে কেটেছে, তাই ক্ষেত্রফলই ভুল আসছে।\n\n'
      + 'পয়েন্ট টুল দিয়ে কোণাটি ঠিক জায়গায় সরান, তারপর আবার চেষ্টা করুন।');
    return true;
  },

  mmClear() {
    if (!MeasureCanvas.state.plots.length && !MeasureCanvas.state.draft.length) return;
    if (!confirm('সব প্লট ও পয়েন্ট মুছে দেবেন?')) return;
    MeasureCanvas.clearAll();
    this.mmRefresh();
  },

  mmDeletePlot(i) {
    MeasureCanvas.deletePlot(i);
    this.mmRefresh();
  },

  mmSetDag(i, v) {
    const p = MeasureCanvas.state.plots[i];
    if (p) {
      const dag = String(v || '').trim();
      if (p.dag === dag) return;
      p.dag = dag;
      MeasureCanvas.draw();
      MeasureCanvas.commitHistory('দাগ নং পরিবর্তন');
    }
  },

  /* ---- হালনাগাদ ---- */

  mmRefresh() {
    const k = this.mm;
    const has = !!k.img;
    ['mm-left', 'mm-tools', 'mm-tiles', 'mm-scale-pill', 'mm-list-wrap', 'mm-history-wrap'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = has ? '' : 'none';
    });
    const intro = document.getElementById('mm-intro');
    if (intro) intro.style.display = has ? 'none' : '';
    if (!has) return;

    // স্কেলের অবস্থা
    const txt = document.getElementById('mm-scale-txt');
    const pill = document.getElementById('mm-scale-pill');
    if (txt) {
      txt.textContent = k.ftPerPx > 0
        ? '১ পিক্সেল = ' + toBn(k.ftPerPx.toFixed(4)) + ' ফুট'
        : 'স্কেল ঠিক করুন — ক্লিক করুন';
    }
    if (pill) pill.className = 'mm-scale-pill' + (k.ftPerPx > 0 ? ' ok' : ' warn');
    this.mmPrecision();

    // টাইল
    const st = MeasureCanvas.stats();
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('mm-t-cur', k.ftPerPx > 0 ? toBn(st.current.satak.toFixed(2)) + ' শতক' : '— শতক');
    set('mm-t-tot', k.ftPerPx > 0 ? toBn(st.totals.satak.toFixed(2)) + ' শতক' : '— শতক');
    set('mm-t-cnt', toBn(st.totals.count) + 'টি');

    // আঁকার বার
    const fin = document.getElementById('mm-finish');
    if (fin && !k.calibrating) {
      fin.style.display = '';
      fin.disabled = MeasureCanvas.state.draft.length < 3;
    }
    const hint = document.getElementById('mm-draw-hint');
    if (hint && !k.calibrating) {
      const n = MeasureCanvas.state.draft.length;
      // আঙুলে নিয়ম আলাদা — এক আঙুল বিন্দু বসায়, দুই আঙুল সরায়/জুম করে
      const touch = matchMedia('(pointer: coarse)').matches;
      hint.textContent = n === 0
        ? (touch ? 'আঙুল চেপে ধরুন — আতশকাচে দেখে ছাড়লেই বিন্দু · দুই আঙুলে সরান ও জুম'
                 : 'ম্যাপে ক্লিক করে পয়েন্ট বসান · টেনে সরান, স্ক্রলে জুম')
        : n < 3 ? toBn(n) + 'টি পয়েন্ট — অন্তত ৩টি দরকার'
        : toBn(n) + 'টি পয়েন্ট — প্রথম পয়েন্টে ' + (touch ? 'চাপ দিলেই' : 'ক্লিক করলেও')
          + ' প্লট বন্ধ হবে';
    }

    // পয়েন্ট এডিট — কোণা বাছা থাকলে মোছার বোতাম সচল
    const del = document.getElementById('mm-pt-del');
    const pth = document.getElementById('mm-pt-hint');
    if (del) {
      const pk = MeasureCanvas.state.picked;
      const plot = pk ? MeasureCanvas.state.plots[pk.plot] : null;
      del.disabled = !plot || plot.points.length <= 3;
      if (pth) {
        pth.textContent = !plot
          ? 'কোণার বিন্দু ধরে টানুন · বাহুর গায়ে চাপ দিলে নতুন বিন্দু'
          : (plot.points.length <= 3
              ? 'ত্রিভুজে আর বিন্দু মোছা যায় না'
              : (plot.dag ? 'দাগ ' + plot.dag : plot.name) + ' — '
                + toBn(pk.index + 1) + ' নং কোণা বাছা হয়েছে');
      }
    }

    this.mmRenderList();
    this.mmRenderHistory();

    // ভাগবণ্টন খোলা থাকলে প্লট বদলালে বাহুর তালিকাও বদলাতে হবে
    const dw = document.getElementById('mm-div-wrap');
    if (dw && dw.style.display !== 'none') this.mmDivRefresh();
  },

  mmRenderList() {
    const box = document.getElementById('mm-list');
    const pill = document.getElementById('mm-list-pill');
    if (!box) return;
    const k = this.mm;
    const plots = MeasureCanvas.state.plots;
    if (pill) pill.textContent = toBn(plots.length) + 'টি';
    if (!plots.length) { box.className = 'mm-list'; box.textContent = 'কোনো প্লট নেই'; return; }

    box.className = 'mm-list has';
    box.innerHTML = plots.map((p, i) => {
      const m = MapMeasure.measure(p, k.ftPerPx);
      const sel = i === MeasureCanvas.state.selected;
      // নিজেকে কাটা প্লটের সংখ্যা দেখানোই বিপজ্জনক — বদলে সতর্কতা
      const bad = MeasureCanvas.plotBroken(p);
      return '<div class="mm-row' + (sel ? ' sel' : '') + (bad ? ' bad' : '') + '">' +
        '<span class="mm-row-n">' + toBn(i + 1) + '</span>' +
        '<input class="mm-row-dag" value="' + (p.dag || '') + '" placeholder="দাগ নং"' +
          ' onchange="AppController.mmSetDag(' + i + ', this.value)">' +
        (bad
          ? '<span class="mm-row-a warn" title="' + toBn(bad.i + 1) + ' ও '
              + toBn(bad.j + 1) + ' নং বাহু কাটাকাটি করছে">'
              + '<i class="bi bi-exclamation-triangle-fill"></i> বাহু কাটাকাটি</span>'
              + '<span class="mm-row-k">মাপ ধরা হয়নি</span>'
          : '<span class="mm-row-a">' +
            (k.ftPerPx > 0 ? toBn(m.satak.toFixed(2)) + ' শতক' : '—') + '</span>' +
            '<span class="mm-row-k">' +
            (k.ftPerPx > 0 ? toBn(m.katha.toFixed(2)) + ' কাঠা' : '') + '</span>') +
        '<button type="button" class="fz-btn-del" title="মুছুন"' +
          ' onclick="AppController.mmDeletePlot(' + i + ')"><i class="bi bi-x-lg"></i></button>' +
      '</div>';
    }).join('') +
    (k.ftPerPx > 0 ? '<div class="mm-row total"><span></span><span>মোট</span>' +
      '<span class="mm-row-a">' + toBn(MeasureCanvas.stats().totals.satak.toFixed(2)) +
      ' শতক</span><span class="mm-row-k">' +
      toBn(MeasureCanvas.stats().totals.katha.toFixed(2)) + ' কাঠা</span><span></span></div>' : '');
  },

  mmRenderHistory() {
    const box = document.getElementById('mm-history');
    const pill = document.getElementById('mm-history-pill');
    const undo = document.getElementById('mm-history-undo');
    const redo = document.getElementById('mm-history-redo');
    if (!MeasureCanvas.state) return;
    const h = MeasureCanvas.historyInfo();
    if (undo) undo.disabled = !h.canUndo;
    if (redo) redo.disabled = !h.canRedo;
    if (pill) pill.textContent = toBn(h.items.length) + 'টি';
    if (!box) return;
    const start = Math.max(0, h.items.length - 10);
    box.innerHTML = h.items.slice(start).map((item, n) => {
      const i = start + n;
      return '<button type="button" class="mm-history-row' + (item.current ? ' current' : '') +
        '" onclick="AppController.mmHistoryGo(' + i + ')"' +
        (item.current ? ' aria-current="true"' : '') + '>' +
        '<span>' + toBn(i + 1) + '</span><b>' + item.label + '</b>' +
        (item.current ? '<i class="bi bi-check2"></i>' : '') + '</button>';
    }).reverse().join('');
  },


  /* ---- ভাগবণ্টন ---- */

  mmDivideMode() {
    const k = this.mm;
    if (!MeasureCanvas.state.plots.length) {
      alert('আগে অন্তত একটি প্লট আঁকুন!');
      return;
    }
    if (MeasureCanvas.state.selected < 0) MeasureCanvas.state.selected = 0;
    this.mmTool('select');
    document.querySelectorAll('#mm-tools .mm-tool').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === 'divide'));
    const w = document.getElementById('mm-div-wrap');
    if (w) w.style.display = '';
    if (!k.shares.length) { k.shares = [{ name: '', value: '' }, { name: '', value: '' }]; }
    this.mmDivRefresh();
  },

  mmDivMode(m) {
    this.mm.divMode = m;
    const a = document.getElementById('mm-dm-prop');
    const b = document.getElementById('mm-dm-man');
    if (a) a.classList.toggle('active', m === 'prop');
    if (b) b.classList.toggle('active', m === 'manual');
    const pp = document.getElementById('mm-div-prop');
    const pm = document.getElementById('mm-div-man');
    if (pp) pp.style.display = m === 'prop' ? '' : 'none';
    if (pm) pm.style.display = m === 'manual' ? '' : 'none';
  },

  /** নির্বাচিত প্লট */
  mmSelPlot() {
    const i = MeasureCanvas.state.selected;
    return i >= 0 ? MeasureCanvas.state.plots[i] : null;
  },

  mmDivRefresh() {
    const k = this.mm;
    const plot = this.mmSelPlot();
    const pill = document.getElementById('mm-div-plot');
    if (pill) {
      pill.textContent = plot
        ? (plot.dag ? 'দাগ ' + plot.dag : plot.name) + ' — '
          + (k.ftPerPx > 0 ? toBn(MapMeasure.measure(plot, k.ftPerPx).satak.toFixed(2)) + ' শতক' : '')
        : 'প্লট বাছুন';
      pill.className = 'fz-pill' + (plot ? ' ok' : '');
    }

    // কাটার রেখা — উপরে ৪ দিক, নিচে প্লটের বাহুগুলো
    const sel = document.getElementById('mm-div-side');
    if (sel && plot) {
      const cur = sel.value;
      const unit = MeasureCanvas.state ? MeasureCanvas.state.labelUnit : 'ftin';
      const opts = MapMeasure.sideOptions(plot.points, k.ftPerPx);
      sel.innerHTML =
        '<optgroup label="নির্দিষ্ট দিকে">' +
          MapMeasure.DIRECTIONS.map(d =>
            '<option value="' + d.id + '">' + d.label + '</option>').join('') +
        '</optgroup>' +
        '<optgroup label="বাহুর সমান্তরালে">' +
          opts.map(o => '<option value="' + o.index + '">' + o.label +
            (k.ftPerPx > 0 ? ' · ' + MapMeasure.formatLength(o.feet, unit) : '') +
            '</option>').join('') +
        '</optgroup>';
      // আগের বাছাই ধরে রাখা — দিক হলে সবসময়, বাহু হলে যদি এখনো থাকে
      if (cur && (isNaN(Number(cur)) || Number(cur) < opts.length)) sel.value = cur;
    }

    this.mmShareMode(k.shareMode, true);
  },

  /** অংশ দেওয়ার ধরন — % · শতক · সমান ভাগে */
  mmShareMode(m, keep) {
    const k = this.mm;
    k.shareMode = m;
    [['pct', 'mm-sm-pct'], ['satak', 'mm-sm-satak'], ['equal', 'mm-sm-equal']]
      .forEach(([id, el]) => {
        const b = document.getElementById(el);
        if (b) b.classList.toggle('active', m === id);
      });
    // ধরন বদলালে আগের সংখ্যাগুলো আর অর্থবহ থাকে না
    if (!keep) k.shares.forEach(s => { s.value = ''; });
    this.mmRenderShares();
  },

  mmAddShare() {
    this.mm.shares.push({ name: '', value: '' });
    this.mmRenderShares();
  },
  mmDelShare(i) {
    this.mm.shares.splice(i, 1);
    this.mmRenderShares();
  },
  mmSetShare(i, field, v) {
    if (!this.mm.shares[i]) return;
    this.mm.shares[i][field] = field === 'value' ? toEn(String(v)) : v;
    this.mmSharePill();
  },

  /** এই মুহূর্তে শরিকদের অংশ শতকে — না পারলে null */
  mmShareSatak() {
    const k = this.mm;
    const plot = this.mmSelPlot();
    const total = plot && k.ftPerPx > 0 ? MapMeasure.measure(plot, k.ftPerPx).satak : 0;
    if (!(total > 0)) return null;
    const list = k.shareMode === 'equal'
      ? k.shares
      : k.shares.filter(x => Number(x.value) > 0);
    if (!list.length) return null;
    try {
      return { total, parts: MapMeasure.sharesToSatak(k.shareMode, list.map((x, i) => ({
        name: (x.name || '').trim() || ('শরিক ' + toBn(i + 1)),
        value: Number(x.value) || 0
      })), total) };
    } catch (e) {
      return { total, error: e.message };
    }
  },

  mmSharePill() {
    const el = document.getElementById('mm-share-pill');
    if (!el) return;
    const k = this.mm;
    const r = this.mmShareSatak();
    const total = r ? r.total
      : (this.mmSelPlot() && k.ftPerPx > 0
          ? MapMeasure.measure(this.mmSelPlot(), k.ftPerPx).satak : 0);
    if (r && r.error) {
      el.textContent = r.error;
      el.className = 'fz-pill bad';
      return;
    }
    const asked = r ? r.parts.reduce((a, b) => a + b.satak, 0) : 0;
    el.textContent = toBn(asked.toFixed(2)) + ' / ' + toBn(total.toFixed(2)) + ' শতক';
    el.className = 'fz-pill' + (asked > total + 0.01 ? ' bad' : asked > 0 ? ' ok' : '');
  },

  mmRenderShares() {
    const box = document.getElementById('mm-shares');
    if (!box) return;
    // কেউ ঘরে লিখতে থাকলে DOM ভাঙা যাবে না — ফোকাস হারিয়ে যেত
    const ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT' && box.contains(ae)) { this.mmSharePill(); return; }
    const mode = this.mm.shareMode;
    const unit = mode === 'pct' ? '%' : 'শতক';
    const r = mode === 'equal' ? this.mmShareSatak() : null;
    box.innerHTML = this.mm.shares.map((sh, i) =>
      '<div class="mm-share">' +
        '<span class="mm-share-n">' + toBn(i + 1) + '</span>' +
        '<input class="mm-share-name" placeholder="শরিক ' + toBn(i + 1) + ' এর নাম"' +
          ' value="' + (sh.name || '') + '"' +
          ' oninput="AppController.mmSetShare(' + i + ',\'name\',this.value)">' +
        (mode === 'equal'
          ? '<span class="mm-share-amt mm-share-eq">' +
              (r && r.parts[i] ? toBn(r.parts[i].satak.toFixed(2)) + ' শতক' : '—') + '</span>'
          : '<span class="fz-input-wrap mm-share-amt"><input inputmode="decimal" placeholder="০"' +
              ' value="' + (sh.value || '') + '"' +
              ' oninput="AppController.mmSetShare(' + i + ',\'value\',this.value)">' +
              '<span class="mm-share-u">' + unit + '</span></span>') +
        '<button type="button" class="fz-btn-del" onclick="AppController.mmDelShare(' + i + ')">' +
          '<i class="bi bi-x-lg"></i></button>' +
      '</div>').join('');
    this.mmSharePill();
  },

  mmDivPreview() { /* বাহু বদলালে কিছু করার নেই — ভাগ করলে দেখা যাবে */ },

  mmDoDivide() {
    const k = this.mm;
    const plot = this.mmSelPlot();
    if (!plot) { alert('আগে একটি প্লট নির্বাচন করুন'); return; }
    if (!(k.ftPerPx > 0)) { alert('আগে স্কেল ঠিক করুন'); return; }
    if (this.mmGuardBroken(plot)) return;
    // দিক হলে স্ট্রিং (w2e…), বাহু হলে সূচক — divideByArea দুটোই নেয়
    const raw = String((document.getElementById('mm-div-side') || {}).value || '0');
    const side = /^\d+$/.test(raw) ? Number(raw) : raw;

    const r = this.mmShareSatak();
    if (!r) { alert('অন্তত একজন শরিকের অংশ দিন'); return; }
    if (r.error) { alert(r.error); return; }
    const people = r.parts.filter(x => x.satak > 0);
    if (!people.length) { alert('অন্তত একজন শরিকের অংশ দিন'); return; }

    try {
      const res = MapMeasure.divideByArea(plot.points, side, people, k.ftPerPx);
      k.division = res;
      MeasureCanvas.setDivision(res);
      MeasureCanvas.commitHistory('আনুপাতিক ভাগবণ্টন');
      this.mmShowDivResult(MapMeasure.divisionReport(res,
        plot.dag ? 'দাগ ' + plot.dag : plot.name));
    } catch (e) {
      alert(e.message);
    }
  },

  mmStartManualCut() {
    const k = this.mm;
    const plot = this.mmSelPlot();
    if (!plot) { alert('আগে একটি প্লট নির্বাচন করুন'); return; }
    if (!(k.ftPerPx > 0)) { alert('আগে স্কেল ঠিক করুন'); return; }
    if (this.mmGuardBroken(plot)) return;
    const bar = document.getElementById('mm-draw-bar');
    const hint = document.getElementById('mm-draw-hint');
    const fin = document.getElementById('mm-finish');
    if (bar) bar.style.display = '';
    if (fin) fin.style.display = 'none';
    if (hint) hint.innerHTML = '<b>ম্যানুয়াল ভাগ —</b> প্লটের এক পাশ থেকে অন্য পাশে '
      + 'দুটি ক্লিক করে রেখা টানুন';
    MeasureCanvas.startCalibrate(
      (p1, p2) => this.mmFinishManualCut(plot, p1, p2),
      n => { if (hint) hint.innerHTML = '<b>ম্যানুয়াল ভাগ —</b> আর '
        + toBn(2 - n) + 'টি ক্লিক'; }
    );
  },

  mmFinishManualCut(plot, p1, p2) {
    const k = this.mm;
    const bar = document.getElementById('mm-draw-bar');
    const fin = document.getElementById('mm-finish');
    if (bar) bar.style.display = 'none';
    if (fin) fin.style.display = '';
    this.mmTool('select');
    try {
      const c = MapMeasure.sliceByLine(plot.points, p1, p2);
      const f = k.ftPerPx, S = MapMeasure.SQFT_PER_SATAK;
      const base = plot.dag ? 'দাগ ' + plot.dag : plot.name;
      const res = {
        parts: [
          { name: base + '-ক', polygon: c.a, areaPx: c.areaA, satak: c.areaA * f * f / S },
          { name: base + '-খ', polygon: c.b, areaPx: c.areaB, satak: c.areaB * f * f / S }
        ],
        leftover: null,
        totalSatak: MapMeasure.areaPx(plot.points) * f * f / S,
        askedSatak: 0
      };
      k.division = res;
      MeasureCanvas.setDivision(res);
      MeasureCanvas.commitHistory('ম্যানুয়াল ভাগবণ্টন');
      this.mmShowDivResult(MapMeasure.divisionReport(res, base));
    } catch (e) {
      alert(e.message);
    }
  },

  mmClearDivision() {
    if (!this.mm.division) return;
    this.mm.division = null;
    MeasureCanvas.setDivision(null);
    MeasureCanvas.commitHistory('ভাগবণ্টন মোছা');
    const r = document.getElementById('mm-div-result');
    if (r) r.style.display = 'none';
  },

  mmShowDivResult(rep) {
    const box = document.getElementById('mm-div-result');
    if (!box) return;
    box.style.display = '';
    box.innerHTML =
      '<div class="mm-div-title"><i class="bi bi-file-earmark-text"></i> ' +
        'জমি ভাগ-বন্টন রিপোর্ট' + (rep.plotName ? ' — ' + rep.plotName : '') + '</div>' +
      '<table class="mm-div-table"><thead><tr>' +
        '<th>ক্রম</th><th>শরিক</th><th>জমি</th><th>শতাংশ</th></tr></thead><tbody>' +
      rep.rows.map((r, i) =>
        '<tr' + (r.name === 'অবশিষ্ট' ? ' class="left"' : '') + '>' +
          '<td><span class="mm-div-dot" style="background:' + this.mmDivColor(i) + '"></span>' +
            toBn(r.serial) + '</td>' +
          '<td>' + r.name +
            // ★ অবতল প্লটে কারো অংশ দুই টুকরোয় পড়তে পারে
            (r.pieces > 1 ? ' <span class="mm-div-split" title="এই অংশটি এক টুকরো নয়">'
              + '<i class="bi bi-exclamation-triangle-fill"></i> '
              + toBn(r.pieces) + ' টুকরো</span>' : '') + '</td>' +
          '<td class="num">' + toBn(r.satak.toFixed(2)) + ' শতক</td>' +
          '<td class="num">' + toBn(r.percent.toFixed(2)) + '%</td>' +
        '</tr>').join('') +
      '</tbody><tfoot><tr>' +
        '<td colspan="2">সর্বমোট</td>' +
        '<td class="num">' + toBn(rep.sumSatak.toFixed(2)) + ' শতক</td>' +
        '<td class="num">১০০.০০%</td>' +
      '</tr></tfoot></table>' +
      (rep.exact
        ? '<p class="mm-div-ok"><i class="bi bi-check-circle"></i> যোগফল মূল প্লটের সাথে হুবহু মিলেছে।</p>'
        : '<p class="mm-div-bad"><i class="bi bi-exclamation-triangle"></i> যোগফল মিলছে না — আবার দেখুন।</p>') +
      (rep.rows.some(r => r.pieces > 1)
        ? '<p class="mm-div-bad"><i class="bi bi-exclamation-triangle"></i> '
          + 'প্লটটি অবতল (কোণা ভেতরের দিকে ঢোকা), তাই কারো কারো অংশ <b>এক টুকরোয় পড়েনি</b>। '
          + 'ক্ষেত্রফল ঠিক আছে, কিন্তু জমি দু জায়গায় ছড়িয়ে থাকবে — অন্য বাহু বা '
          + 'দিক বেছে আবার ভাগ করে দেখুন।</p>'
        : '') +
      '<button type="button" class="btn btn-outline btn-sm" onclick="AppController.mmCopyReport()">' +
        '<i class="bi bi-clipboard"></i> রিপোর্ট কপি করুন</button>';
    this.mm.lastReport = rep;
  },

  mmDivColor(i) {
    const C = ['#3b82f6', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];
    return C[i % C.length];
  },

  mmCopyReport() {
    const rep = this.mm.lastReport;
    if (!rep) return;
    const L = ['জমি ভাগ-বন্টন রিপোর্ট' + (rep.plotName ? ' — ' + rep.plotName : ''),
               'মোট জমি: ' + toBn(rep.totalSatak.toFixed(2)) + ' শতক', '', 'শরিকদের বিবরণ:'];
    rep.rows.forEach(r => L.push('  ' + toBn(r.serial) + '. ' + r.name + ' — '
      + toBn(r.satak.toFixed(2)) + ' শতক (' + toBn(r.percent.toFixed(2)) + '%)'));
    L.push('', 'সর্বমোট: ' + toBn(rep.sumSatak.toFixed(2)) + ' শতক');
    const txt = L.join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(
      () => this.showToast && this.showToast('রিপোর্ট কপি হয়েছে'), () => {});
  },

  /* ---- অগ্রগতি ---- */

  mmProg(pct, msg) {
    const box = document.getElementById('mm-prog');
    const fill = document.getElementById('mm-prog-fill');
    const txt = document.getElementById('mm-prog-txt');
    if (!box) return;
    if (pct == null) { box.style.display = 'none'; return; }
    box.style.display = '';
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (txt) txt.textContent = msg || '';
  },

  /* ---- ম্যাপ আনা ---- */

  mmPick(kind) {
    if (kind === 'file' || kind === 'menu') {
      if (kind === 'menu') {
        const a = document.getElementById('mm-arch');
        if (a && a.style.display !== 'none') { a.style.display = 'none'; return; }
      }
      if (kind === 'file') { const f = document.getElementById('mm-file'); if (f) f.click(); return; }
    }
    const a = document.getElementById('mm-arch');
    if (a) a.style.display = a.style.display === 'none' ? '' : 'none';
    if (!this.mm.treeLoaded) this.mmArchInit();
  },

  mmUseImage(r, name, isPdf, pdfScale) {
    const k = this.mm;
    k.img = r.img; k.imgName = name || 'map.jpg';
    k.isPdf = !!isPdf; k.pdfScale = pdfScale || 0;
    k.pageIn = r.pageIn || null;
    // ★ জুম করলে ওই অংশটুকু PDF থেকে নতুন করে আঁকতে পাতাটি লাগে
    k.pdfPage = r.pdfPage || null;
    k.hiSeq = (k.hiSeq || 0) + 1;
    MeasureCanvas.setHiRes(null);
    const dpEl = document.getElementById('mm-dpi');
    if (dpEl) dpEl._mmSet = false;      // নতুন ফাইলে আবার বসবে
    k.ftPerPx = 0; k.scaleFrom = ''; k.calibrating = null;
    MeasureCanvas.setImage(r.img);
    MeasureCanvas.setScale(0);
    const a = document.getElementById('mm-arch');
    if (a) a.style.display = 'none';
    this.mmRefresh();
    this.mmScaleDialog(true);
  },

  mmLoadFile(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const buf = new Uint8Array(ev.target.result);
      this.mmProg(5, 'ফাইল পড়া হচ্ছে…');
      try {
        const isPdf = KmzSource.looksLikePdf(buf) || f.type === 'application/pdf';
        const r = await KmzSource.toImage(buf, f.type, {
          needBytes: false,                       // মাপে JPEG লাগে না
          onStage: (pc, m) => this.mmProg(pc, m)
        });
        this.mmProg(null);
        // PDF হলে রেন্ডার স্কেল বের করি (DPI এর জন্য)
        let pdfScale = 0;
        if (isPdf && r.width) pdfScale = r.pdfScale || 0;
        this.mmUseImage(r, f.name, isPdf, pdfScale);
      } catch (e) {
        this.mmProg(null);
        alert(e.message);
      }
    };
    reader.readAsArrayBuffer(f);
  },

  /* ---- আর্কাইভ ---- */

  async mmArchInit() {
    const sel = document.getElementById('mm-div');
    try {
      this.mmProg(20, 'আর্কাইভের সূচি আসছে…');
      this.mm.tree = await KmzSource.tree();
      this.mm.treeLoaded = true;
      this.mmProg(null);
      if (sel) sel.innerHTML = '<option value="">— বিভাগ বাছুন —</option>' +
        this.mm.tree.divisions.map((d, i) => '<option value="' + i + '">' + d.name + '</option>').join('');
    } catch (e) {
      this.mmProg(null);
      if (sel) sel.innerHTML = '<option value="">— আনা যায়নি —</option>';
      alert(this.kmzNetHint('আর্কাইভের সূচি', e));
    }
  },

  _mmFill(id, items, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !items || !items.length;
    el.innerHTML = '<option value="">— ' + label + ' —</option>' +
      (items || []).map((x, i) => '<option value="' + i + '">' + x.name +
        (x.count ? ' (' + toBn(x.count) + ')' : '') + '</option>').join('');
  },

  mmArchDiv() {
    const k = this.mm, i = document.getElementById('mm-div').value;
    k.arch = { div: i === '' ? null : k.tree.divisions[i] };
    this._mmFill('mm-dist', k.arch.div ? k.arch.div.districts : [], 'জেলা বাছুন');
    this._mmFill('mm-upa', [], 'উপজেলা'); this._mmFill('mm-srv', [], 'জরিপ');
    this.mmArchList([]);
  },
  mmArchDist() {
    const k = this.mm, i = document.getElementById('mm-dist').value;
    k.arch.dist = i === '' ? null : k.arch.div.districts[i];
    this._mmFill('mm-upa', k.arch.dist ? k.arch.dist.upazilas : [], 'উপজেলা বাছুন');
    this._mmFill('mm-srv', [], 'জরিপ'); this.mmArchList([]);
  },
  mmArchUpa() {
    const k = this.mm, i = document.getElementById('mm-upa').value;
    k.arch.upa = i === '' ? null : k.arch.dist.upazilas[i];
    this._mmFill('mm-srv', k.arch.upa ? k.arch.upa.surveys : [], 'জরিপ বাছুন');
    this.mmArchList([]);
  },
  async mmArchSrv() {
    const k = this.mm, i = document.getElementById('mm-srv').value;
    k.arch.srv = i === '' ? null : k.arch.upa.surveys[i];
    const se = document.getElementById('mm-fsearch');
    if (!k.arch.srv) { this.mmArchList([]); if (se) se.disabled = true; return; }
    try {
      this.mmProg(30, 'ফাইলের তালিকা আসছে…');
      k.archFiles = await KmzSource.filesOf(k.arch.srv.id);
      this.mmProg(null);
      if (se) { se.disabled = false; se.value = ''; }
      this.mmArchList(k.archFiles);
    } catch (e) {
      this.mmProg(null); this.mmArchList([]);
      alert(this.kmzNetHint('ফাইলের তালিকা', e));
    }
  },
  mmArchFilter() {
    const q = (document.getElementById('mm-fsearch') || {}).value || '';
    this.mmArchList(MouzaMap.filterFiles(this.mm.archFiles || [], q));
  },
  mmArchList(files) {
    const box = document.getElementById('mm-arch-list');
    if (!box) return;
    const list = files || [];
    if (!list.length) {
      box.className = 'kmz-arch-list';
      box.textContent = this.mm.arch && this.mm.arch.srv
        ? 'এই জরিপে কোনো ফাইল মেলেনি।' : 'উপরে বিভাগ থেকে জরিপ পর্যন্ত বেছে নিন।';
      return;
    }
    const shown = list.slice(0, 150);
    box.className = 'kmz-arch-list has';
    box.innerHTML = shown.map((f, i) => {
      const bad = !MouzaMap.canProxy(f) || String(f.mimeType) === 'image/tiff';
      const kind = MouzaMap.fileKind(f.mimeType);
      return '<button type="button" class="kmz-af' + (bad ? ' bad' : '') + '"' +
        (bad ? ' disabled' : '') + ' onclick="AppController.mmPickArchive(' + i + ')">' +
        '<i class="bi ' + kind.icon + '"></i><span class="kmz-af-n">' + f.name + '</span>' +
        '<span class="kmz-af-s">' + MouzaMap.formatSize(f.size) + '</span></button>';
    }).join('');
    this.mm.archShown = shown;
  },
  async mmPickArchive(i) {
    const f = (this.mm.archShown || [])[i];
    if (!f) return;
    try {
      this.mmProg(3, 'ফাইল নামানো হচ্ছে…');
      const r = await KmzSource.fromArchive(f, (pc, m) => this.mmProg(pc, m),
                                            { needBytes: false });
      this.mmProg(null);
      this.mmUseImage(r, r.name || f.name, !!r.wasPdf, r.pdfScale || 0);
    } catch (e) {
      this.mmProg(null); alert(e.message);
    }
  },

  closeModal() {
    const modal = document.getElementById('app-modal');
    if (modal) modal.classList.remove('active');
  },

  /* ------------------------------------------------------------------------
     4. Dynamic Heir Cards Generator
     ------------------------------------------------------------------------ */
  /**
   * উত্তরাধিকারীর তালিকা render করে — uttoradhikar.gov.bd এর আদলে।
   * প্রতিটি ক্যাটাগরি একটি অ্যাকর্ডিয়ন, ভেতরে টিক-দেওয়া সারি।
   * টিক দিলে (multi হলে) সংখ্যা কাউন্টার প্রকাশ পায়।
   */
  renderHeirs() {
    const wrapper = document.getElementById('heir-container-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    this.categories.forEach((cat, ci) => {
      const catHeirs = this.heirsConfig.filter(h => h.cat === cat.id);
      if (catHeirs.length === 0) return;

      const acc = document.createElement('div');
      // প্রথম ক্যাটাগরি (স্বামী/স্ত্রী ও বংশধর) খোলা থাকবে — সবচেয়ে বেশি ব্যবহৃত
      acc.className = 'fz-acc' + (ci === 0 ? ' open' : '');
      acc.id = `fz-acc-${cat.id}`;

      let rowsHtml = '';
      catHeirs.forEach(h => {
        const isMulti = h.type === 'multi';
        rowsHtml += `
          <div class="fz-heir" id="row-${h.id}" data-heir="${h.id}" data-name="${h.name}"
               onclick="AppController.toggleHeirCard('${h.id}')">
            <span class="fz-check"><i class="bi bi-check-lg"></i></span>
            <span class="fz-heir-name">${h.name}</span>
            <span class="fz-single-hint ${isMulti ? 'multi' : 'single'}">১ জন</span>
            <span class="fz-counter ${isMulti ? 'multi' : 'single'}" onclick="event.stopPropagation()">
              <button type="button" class="fz-cbtn" onclick="AppController.updateQty('${h.id}', -1, event)"
                      aria-label="কমান">&minus;</button>
              <input class="fz-cinput" id="count-${h.id}" value="০" inputmode="numeric"
                     oninput="AppController.handleManualInput('${h.id}', this.value)"
                     onblur="AppController.formatInput('${h.id}')">
              <button type="button" class="fz-cbtn" onclick="AppController.updateQty('${h.id}', 1, event)"
                      aria-label="বাড়ান">+</button>
            </span>
            <input type="checkbox" id="chk-${h.id}" hidden>
          </div>`;

        if (h.isDynamicTrigger) {
          rowsHtml += `<div id="dynamic-${h.id}-container"></div>`;
        }
      });

      acc.innerHTML = `
        <button type="button" class="fz-acc-head" onclick="AppController.toggleAccordion('${cat.id}')">
          <span class="fz-acc-pill zero" id="fz-pill-${cat.id}">০</span>
          <span class="fz-acc-title">${cat.title}</span>
          <i class="bi bi-chevron-down fz-acc-chev"></i>
        </button>
        <div class="fz-acc-body">${rowsHtml}</div>`;

      wrapper.appendChild(acc);
    });

    this.refreshHeirSummary();
  },

  toggleAccordion(catId) {
    const acc = document.getElementById(`fz-acc-${catId}`);
    if (acc) acc.classList.toggle('open');
  },

  /**
   * সার্চ বক্স দিয়ে উত্তরাধিকারী ছাঁকা। মিল পাওয়া গেলে
   * সংশ্লিষ্ট অ্যাকর্ডিয়ন আপনাআপনি খুলে যায়।
   */
  filterHeirs(query) {
    const q = (query || '').trim().toLowerCase();
    this.categories.forEach(cat => {
      const acc = document.getElementById(`fz-acc-${cat.id}`);
      if (!acc) return;
      let visible = 0;
      acc.querySelectorAll('.fz-heir').forEach(row => {
        const name = (row.dataset.name || '').toLowerCase();
        const match = !q || name.includes(q);
        row.classList.toggle('hidden', !match);
        if (match) visible++;
      });
      // খোঁজার সময় মিল থাকলে খুলবে, না থাকলে পুরো ক্যাটাগরি লুকাবে
      acc.style.display = (q && visible === 0) ? 'none' : '';
      if (q) acc.classList.toggle('open', visible > 0);
    });
  },

  /**
   * নির্বাচিত উত্তরাধিকারীর ট্যাগ, ক্যাটাগরির সংখ্যা-পিল ও
   * মোবাইলের স্টিকি বারের গণনা হালনাগাদ করে।
   */
  refreshHeirSummary() {
    const bar = document.getElementById('fz-selected-bar');
    let total = 0;
    const tags = [];

    this.categories.forEach(cat => {
      let catTotal = 0;
      this.heirsConfig.filter(h => h.cat === cat.id).forEach(h => {
        const n = parseInt(toEn(document.getElementById(`count-${h.id}`)?.value || '0')) || 0;
        if (n > 0) {
          catTotal += n;
          tags.push(`<span class="fz-tag" onclick="AppController.updateHeirState('${h.id}', 0)" title="বাদ দিন">
            ${h.name}${n > 1 ? `<span class="fz-tag-count">${toBn(n)}</span>` : ''}
            <i class="bi bi-x"></i></span>`);
        }
      });
      total += catTotal;
      const pill = document.getElementById(`fz-pill-${cat.id}`);
      if (pill) {
        pill.textContent = toBn(catTotal);
        pill.classList.toggle('zero', catTotal === 0);
      }
    });

    if (bar) {
      bar.innerHTML = tags.length
        ? tags.join('')
        : '<span class="fz-selected-empty">এখনো কোনো উত্তরাধিকারী নির্বাচন করা হয়নি</span>';
    }

    const cnt = document.getElementById('fz-sticky-count');
    if (cnt) cnt.textContent = toBn(total);

    const s1 = document.getElementById('fz-step-1');
    const s2 = document.getElementById('fz-step-2');
    if (s1 && s2) {
      s1.classList.toggle('done', total > 0);
      s2.classList.toggle('active', total > 0);
    }
  },

  toggleHeirCard(id) {
    const val = parseInt(toEn(document.getElementById(`count-${id}`)?.value || '0'));
    this.updateHeirState(id, val > 0 ? 0 : 1);
  },

  updateQty(id, delta, e) {
    if (e) e.stopPropagation();
    const val = parseInt(toEn(document.getElementById(`count-${id}`)?.value || '0'));
    this.updateHeirState(id, val + delta);
  },

  handleManualInput(id, val) {
    this.updateHeirState(id, parseInt(toEn(val) || '0'), true);
  },

  formatInput(id) {
    const inp = document.getElementById(`count-${id}`);
    if (inp) inp.value = toBn(parseInt(toEn(inp.value) || '0'));
  },

  updateHeirState(id, val, isManualInput) {
    const inp = document.getElementById(`count-${id}`);
    const chk = document.getElementById(`chk-${id}`);
    const row = document.getElementById(`row-${id}`);
    const config = this.heirsConfig.find(x => x.id === id);

    if (!config) return;
    if (isNaN(val) || val < 0) val = 0;
    if (config.type === 'single' && val > 1) val = 1;

    if (id === 'husband' && val > 0) this.updateHeirState('wife', 0, false);
    if (id === 'wife' && val > 0) this.updateHeirState('husband', 0, false);

    if (!isManualInput && inp) inp.value = toBn(val);

    if (val > 0) {
      if (chk) chk.checked = true;
      if (row) row.classList.add('active');
    } else {
      if (chk) chk.checked = false;
      if (row) row.classList.remove('active');
    }

    if (config.isDynamicTrigger) {
      this.renderDynamicHeirs(id, val);
    }

    this.refreshHeirSummary();
  },

  setDynTiming(parentId, i, val) {
    this.dynamicHeirData[`${parentId}_${i}_timing`] = val;
    if (val === 'pre') {
      if (['deadBrother', 'deadSister', 'deadSon', 'deadDaughter'].includes(parentId)) {
        this.dynamicHeirData[`${parentId}_${i}_spouse`] = 0;
      }
    }
    this.renderDynamicHeirs(parentId, parseInt(toEn(document.getElementById(`count-${parentId}`)?.value || '0')));
  },

  renderDynamicHeirs(parentId, count) {
    const container = document.getElementById(`dynamic-${parentId}-container`);
    if (!container) return;
    container.innerHTML = '';
    if (count === 0) return;

    let titlePrefix = '';
    if (parentId === 'deadSon') titlePrefix = 'মৃত পুত্র';
    if (parentId === 'deadDaughter') titlePrefix = 'মৃত কন্যা';
    if (parentId === 'deadBrother') titlePrefix = 'মৃত ভাই';
    if (parentId === 'deadSister') titlePrefix = 'মৃত বোন';

    let html = '';
    for (let i = 1; i <= count; i++) {
      const timingKey = `${parentId}_${i}_timing`;
      if (!this.dynamicHeirData[timingKey]) this.dynamicHeirData[timingKey] = 'post';
      let timing = this.dynamicHeirData[timingKey];

      const spouseKey = `${parentId}_${i}_spouse`;
      const sonKey = `${parentId}_${i}_son`;
      const dauKey = `${parentId}_${i}_daughter`;

      if (this.dynamicHeirData[spouseKey] === undefined) this.dynamicHeirData[spouseKey] = 0;
      if (this.dynamicHeirData[sonKey] === undefined) this.dynamicHeirData[sonKey] = 0;
      if (this.dynamicHeirData[dauKey] === undefined) this.dynamicHeirData[dauKey] = 0;

      let showSpouse = timing === 'post';
      let spouseLabel = (parentId === 'deadDaughter' || parentId === 'deadSister') ? 'স্বামী' : 'স্ত্রী';

      // একটি ছোট কাউন্টার ফিল্ড তৈরির হেল্পার
      const miniField = (label, key) => `
        <div class="fz-dead-field">
          <label>${label}</label>
          <div class="fz-mini-counter">
            <button type="button" onclick="AppController.updateDynQty('${key}', -1)" aria-label="কমান">&minus;</button>
            <input id="dyn-${key}" value="${toBn(this.dynamicHeirData[key])}" inputmode="numeric"
                   onchange="AppController.setDynVal('${key}', this.value)">
            <button type="button" onclick="AppController.updateDynQty('${key}', 1)" aria-label="বাড়ান">+</button>
          </div>
        </div>`;

      html += `
      <div class="fz-dead-card">
        <div class="fz-dead-title">
          <i class="bi bi-diagram-2"></i> ${titlePrefix} ${toBn(i)} এর ওয়ারিশ
        </div>
        <div class="fz-timing">
          <button type="button" class="fz-timing-btn ${timing === 'pre' ? 'active' : ''}"
                  onclick="AppController.setDynTiming('${parentId}', ${i}, 'pre')">
            মূল ব্যক্তির আগে মৃত
          </button>
          <button type="button" class="fz-timing-btn ${timing === 'post' ? 'active' : ''}"
                  onclick="AppController.setDynTiming('${parentId}', ${i}, 'post')">
            পরে মৃত
          </button>
        </div>
        <div class="fz-dead-grid">
          ${showSpouse ? miniField(spouseLabel, spouseKey) : ''}
          ${miniField('পুত্র', sonKey)}
          ${miniField('কন্যা', dauKey)}
        </div>
      </div>`;
    }
    container.innerHTML = html;
  },

  updateDynQty(key, delta) {
    let val = (this.dynamicHeirData[key] || 0) + delta;
    if (val < 0) val = 0;
    this.dynamicHeirData[key] = val;
    const el = document.getElementById(`dyn-${key}`);
    if (el) el.value = toBn(val);
  },

  setDynVal(key, strVal) {
    let val = parseInt(toEn(strVal)) || 0;
    if (val < 0) val = 0;
    this.dynamicHeirData[key] = val;
    const el = document.getElementById(`dyn-${key}`);
    if (el) el.value = toBn(val);
  },

  switchInheritanceSubTab(tabId) {
    const tabs = ['calculator', 'bonton', 'bistarito', 'faq'];
    tabs.forEach(t => {
      const btn = document.getElementById(`subtab-btn-${t}`);
      const view = document.getElementById(`subtab-view-${t}`);
      if (btn) {
        if (t === tabId) {
          btn.classList.add('active');
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
        } else {
          btn.classList.remove('active', 'btn-primary');
          btn.classList.add('btn-secondary');
        }
      }
      if (view) view.style.display = (t === tabId) ? 'block' : 'none';
    });
  },

  setInheritanceUnit(unit) {
    this.currentUnit = unit;
    const btnDec = document.getElementById('inh-unit-dec');
    const btnAcr = document.getElementById('inh-unit-acr');
    if (btnDec) btnDec.classList.toggle('active', unit === 'decimal');
    if (btnAcr) btnAcr.classList.toggle('active', unit === 'acre');

    const label = document.getElementById('inh-land-unit-label');
    if (label) label.textContent = (unit === 'acre') ? 'একর' : 'শতাংশ';

    // বাদের ঘরে জমির একক লেখা থাকে — একক বদলালে সেটাও বদলাতে হবে
    const dbox = document.getElementById('inh-deduct-rows');
    if (dbox) delete dbox.dataset.sig;
    this.renderDeductionRows();

    if (this.lastCalculatedData) this.renderResultsFromState();
  },

  setupInputListeners() {
    ['inh-land-input','inh-gold-input','inh-silver-input','inh-cash-input'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', e => {
          e.target.value = toBn(toEn(e.target.value));
          // যে সম্পদ দেওয়া হয়েছে তার জন্যই কেবল বাদের ঘর দেখাব
          this.renderDeductionRows();
        });
      }
    });
    this.renderDeductionRows();
  },

  /* ------------------------------------------------------------------------
     বণ্টনের আগে বাদ — দাফন-কাফন · ঋণ · ওসিয়ত
     ------------------------------------------------------------------------ */

  /** চারটি সম্পদের সংজ্ঞা — এক জায়গায় রাখা, যাতে সব লুপে একই ক্রম থাকে */
  ASSET_DEFS: [
    { key: 'land',   input: 'inh-land-input',   label: 'জমি',        unit: null,     dec: 4 },
    { key: 'gold',   input: 'inh-gold-input',   label: 'স্বর্ণ',      unit: 'ভরি',    dec: 3 },
    { key: 'silver', input: 'inh-silver-input', label: 'রৌপ্য',      unit: 'ভরি',    dec: 3 },
    { key: 'money',  input: 'inh-cash-input',   label: 'নগদ মুদ্রা', unit: 'টাকা',   dec: 0 }
  ],

  /** ওই সম্পদের একক — জমির একক ব্যবহারকারীর টগল অনুযায়ী বদলায় */
  assetUnit(a) {
    return a.unit || (this.currentUnit === 'acre' ? 'একর' : 'শতাংশ');
  },

  assetGross(a) {
    return parseFloat(toEn(document.getElementById(a.input)?.value || '0')) || 0;
  },

  /**
   * যেসব সম্পদ দেওয়া হয়েছে (> ০) কেবল তাদের জন্য বাদের ঘর তৈরি করে।
   * এতে সাধারণ ব্যবহারকারী (শুধু জমি) মাত্র ৩টি ঘর দেখেন, ১২টি নয়।
   * আগে বসানো মান হারায় না — dataset এ রাখা থাকে।
   */
  renderDeductionRows() {
    const box = document.getElementById('inh-deduct-rows');
    if (!box) return;

    const active = this.ASSET_DEFS.filter(a => this.assetGross(a) > 0);
    const sig = active.map(a => a.key + this.assetUnit(a)).join(',');
    if (box.dataset.sig === sig) { this.refreshDeductionPill(); return; }

    if (!active.length) {
      box.innerHTML = `<p class="fz-cert-note" style="text-align:left;margin:0">
        আগে উপরে সম্পদের পরিমাণ দিন — তারপর এখানে সেই সম্পদ থেকে কত বাদ যাবে তা লিখতে পারবেন।</p>`;
      box.dataset.sig = sig;
      this.refreshDeductionPill();
      return;
    }

    box.innerHTML = active.map(a => {
      const u = this.assetUnit(a);
      const v = k => this.deductions[`${a.key}_${k}`] || '';
      return `
        <div class="fz-dead-card" id="ded-card-${a.key}">
          <div class="fz-dead-title">
            <i class="bi bi-dash-circle"></i> ${a.label} থেকে বাদ
            <span class="fz-pill" style="flex:none">${u}</span>
          </div>
          <div class="fz-dead-grid">
            <div class="fz-dead-field">
              <label for="ded-${a.key}-funeral">দাফন-কাফন খরচ</label>
              <input type="text" id="ded-${a.key}-funeral" inputmode="decimal" placeholder="০"
                     value="${v('funeral')}"
                     oninput="AppController.onDeductionInput('${a.key}','funeral',this)">
            </div>
            <div class="fz-dead-field">
              <label for="ded-${a.key}-debt">ঋণ পরিশোধ</label>
              <input type="text" id="ded-${a.key}-debt" inputmode="decimal" placeholder="০"
                     value="${v('debt')}"
                     oninput="AppController.onDeductionInput('${a.key}','debt',this)">
            </div>
            <div class="fz-dead-field">
              <label for="ded-${a.key}-bequest">ওসিয়ত <span style="opacity:.7">(সর্বোচ্চ ১/৩)</span></label>
              <input type="text" id="ded-${a.key}-bequest" inputmode="decimal" placeholder="০"
                     value="${v('bequest')}"
                     oninput="AppController.onDeductionInput('${a.key}','bequest',this)">
            </div>
          </div>
          <div class="fz-ded-sum" id="ded-sum-${a.key}"></div>
        </div>`;
    }).join('');

    box.dataset.sig = sig;
    this.refreshDeductionSummary();
  },

  /** ব্যবহারকারীর বসানো বাদের মান (বাংলা সংখ্যায় লেখা) */
  deductions: {},

  onDeductionInput(key, kind, el) {
    el.value = toBn(toEn(el.value));
    this.deductions[`${key}_${kind}`] = el.value;
    this.refreshDeductionSummary();
  },

  /** একটি সম্পদের বাদের হিসাব */
  deductionFor(a) {
    const num = k => parseFloat(toEn(this.deductions[`${a.key}_${k}`] || '0')) || 0;
    return LandMath.estateAfterDeductions(
      this.assetGross(a), num('funeral'), num('debt'), num('bequest'));
  },

  /** প্রতিটি কার্ডের নিচে "মোট → বাদ → বণ্টনযোগ্য" দেখায় */
  refreshDeductionSummary() {
    this.ASSET_DEFS.forEach(a => {
      const out = document.getElementById(`ded-sum-${a.key}`);
      if (!out) return;
      const d = this.deductionFor(a);
      const u = this.assetUnit(a);
      const n = x => toBn(x.toFixed(a.dec));

      if (!d.hasDeduction) { out.innerHTML = ''; return; }

      let html = `<div class="fz-ded-line">
          <span>মোট ${a.label}</span><b>${n(d.gross)} ${u}</b></div>`;
      if (d.funeral) html += `<div class="fz-ded-line minus">
          <span>দাফন-কাফন</span><b>− ${n(d.funeral)}</b></div>`;
      if (d.debt) html += `<div class="fz-ded-line minus">
          <span>ঋণ</span><b>− ${n(d.debt)}</b></div>`;
      if (d.bequest) html += `<div class="fz-ded-line minus">
          <span>ওসিয়ত</span><b>− ${n(d.bequest)}</b></div>`;
      html += `<div class="fz-ded-line net">
          <span>ওয়ারিশদের মাঝে বণ্টনযোগ্য</span><b>${n(d.net)} ${u}</b></div>`;

      // লেখাটা অবশ্যই একটি <span> এ মুড়তে হবে — .fz-ded-alert flex, তাই খোলা
      // টেক্সট ও <b> আলাদা আলাদা কলাম হয়ে যায়
      if (d.insufficient) {
        html += `<div class="fz-ded-alert danger"><i class="bi bi-exclamation-triangle-fill"></i>
          <span>দাফন-কাফন ও ঋণ মিলে ${n(d.funeral + d.debt)} ${u} — ${a.label} এর চেয়ে
          ${n(d.shortfall)} ${u} বেশি। ওয়ারিশরা এই সম্পদ থেকে কিছুই পাবেন না।</span></div>`;
      } else if (d.bequestCapped) {
        html += `<div class="fz-ded-alert"><i class="bi bi-info-circle-fill"></i>
          <span>ওসিয়ত ${n(d.bequestAsked)} ${u} লেখা হয়েছে, কিন্তু শরিয়াহ অনুযায়ী সর্বোচ্চ
          ১/৩ = <b>${n(d.bequestAllowed)} ${u}</b> পর্যন্তই বৈধ — তাই সেটাই ধরা হয়েছে।
          বাকিটা পেতে সব ওয়ারিশের সম্মতি লাগবে।</span></div>`;
      }
      out.innerHTML = html;
    });
    this.refreshDeductionPill();
  },

  /** অ্যাকর্ডিয়নের মাথায় কতটি সম্পদে বাদ দেওয়া আছে তা দেখায় */
  refreshDeductionPill() {
    const pill = document.getElementById('inh-deduct-pill');
    if (!pill) return;
    const n = this.ASSET_DEFS.filter(a => this.assetGross(a) > 0 && this.deductionFor(a).hasDeduction).length;
    pill.textContent = toBn(n);
    pill.classList.toggle('zero', n === 0);
  },

  resetInheritanceForm() {
    this.heirsConfig.forEach(h => {
      this.updateHeirState(h.id, 0, false);
    });
    this.dynamicHeirData = {};
    this.lastCalculatedData = null;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('inh-land-input', '১০০');
    set('inh-gold-input', '০');
    set('inh-silver-input', '০');
    set('inh-cash-input', '০');
    set('fz-heir-search', '');
    this.filterHeirs('');

    // বাদের ঘরগুলোও খালি করি, নইলে রিসেটের পরেও পুরনো ঋণ/ওসিয়ত ধরা থাকত
    this.deductions = {};
    this.lastDeductions = null;
    const dbox = document.getElementById('inh-deduct-rows');
    if (dbox) delete dbox.dataset.sig;
    this.renderDeductionRows();
    const dres = document.getElementById('res-deduction-box');
    if (dres) { dres.style.display = 'none'; dres.innerHTML = ''; }
    document.getElementById('inh-deduct-acc')?.classList.remove('open');

    const res = document.getElementById('result-section');
    if (res) res.style.display = 'none';

    const s3 = document.getElementById('fz-step-3');
    if (s3) s3.classList.remove('active', 'done');

    this.refreshHeirSummary();
  },

  /* ------------------------------------------------------------------------
     ৫. মূল উত্তরাধিকার (ফরায়েজ) ইঞ্জিনের হিসাব
     ------------------------------------------------------------------------ */
  /**
   * একজন মৃত উত্তরাধিকারী (মৃত পুত্র/কন্যা/ভাই/বোন) আদৌ অংশ পাওয়ার যোগ্য কি না।
   *
   * - "আগে মৃত" (pre): মুসলিম পারিবারিক আইন ১৯৬১ এর ৪ ধারা অনুযায়ী কেবল তার
   *   সন্তানরাই প্রতিনিধিত্বের ভিত্তিতে অংশ পায়। সন্তান না থাকলে তিনি মোটেও
   *   উত্তরাধিকারী নন — তাকে গণনায় ধরা যাবে না। (পুত্রবধূ শ্বশুরের সম্পত্তি পান না)
   * - "পরে মৃত" (post): তিনি নিজে উত্তরাধিকারী হয়েছিলেন, তাই তার স্বামী/স্ত্রী
   *   ও সন্তানরা মুনাছাখা নীতিতে অংশ পাবেন। কেউ না থাকলে তার অংশ বাকি
   *   উত্তরাধিকারীদের মাঝেই ফিরে যাবে — তাই গণনায় ধরা যাবে না।
   */
  isDeadHeirActive(key, i) {
    const timing = this.dynamicHeirData[`${key}_${i}_timing`] || 'post';
    const s = this.dynamicHeirData[`${key}_${i}_son`] || 0;
    const d = this.dynamicHeirData[`${key}_${i}_daughter`] || 0;
    const sp = this.dynamicHeirData[`${key}_${i}_spouse`] || 0;
    return timing === 'pre' ? (s > 0 || d > 0) : (s > 0 || d > 0 || sp > 0);
  },

  calculateDistribution() {
    this.inputsVisible = false;

    // দাফন-কাফন, ঋণ ও ওসিয়ত বাদ দিয়ে যা থাকে, কেবল সেটাই ওয়ারিশদের মাঝে ভাগ হবে।
    // inputs এ নিট পরিমাণ বসিয়ে দিলে নিচের পুরো হিসাব-প্রদর্শন আগের মতোই কাজ করে।
    const deductions = {};
    const inputs = {};
    this.ASSET_DEFS.forEach(a => {
      const d = this.deductionFor(a);
      deductions[a.key] = d;
      inputs[a.key] = d.net;
    });
    this.lastDeductions = deductions;

    const counts = {};
    this.heirsConfig.forEach(h => {
      counts[h.id] = parseInt(toEn(document.getElementById(`count-${h.id}`)?.value || '0'));
    });

    let shares = {};
    let steps = [];
    let fixedShareSum = 0;

    let virtualDeadSons = 0, totalPostSons = 0;
    let virtualDeadDaughters = 0, totalPostDaughters = 0;
    let virtualDeadBrothers = 0, totalPostBrothers = 0;
    let virtualDeadSisters = 0, totalPostSisters = 0;

    // মুনাছাখা থেকে উদ্বৃত্ত অংশ (পরে-মৃত ব্যক্তির স্বামী/স্ত্রী অংশ নেওয়ার পর
    // যদি তার কোনো সন্তান না থাকে) — শেষে অন্যদের মাঝে পুনঃবন্টন হবে
    let munasakhaLeftovers = [];

    for (let i = 1; i <= counts.deadSon; i++) {
      if (!this.isDeadHeirActive('deadSon', i)) continue;
      let timing = this.dynamicHeirData[`deadSon_${i}_timing`] || 'post';
      if (timing === 'pre') virtualDeadSons++; else totalPostSons++;
    }
    for (let i = 1; i <= counts.deadDaughter; i++) {
      if (!this.isDeadHeirActive('deadDaughter', i)) continue;
      let timing = this.dynamicHeirData[`deadDaughter_${i}_timing`] || 'post';
      if (timing === 'pre') virtualDeadDaughters++; else totalPostDaughters++;
    }
    for (let i = 1; i <= counts.deadBrother; i++) {
      if (!this.isDeadHeirActive('deadBrother', i)) continue;
      let timing = this.dynamicHeirData[`deadBrother_${i}_timing`] || 'post';
      if (timing === 'pre') virtualDeadBrothers++; else totalPostBrothers++;
    }
    for (let i = 1; i <= counts.deadSister; i++) {
      if (!this.isDeadHeirActive('deadSister', i)) continue;
      let timing = this.dynamicHeirData[`deadSister_${i}_timing`] || 'post';
      if (timing === 'pre') virtualDeadSisters++; else totalPostSisters++;
    }

    const S = counts.son + virtualDeadSons + totalPostSons;
    const D = counts.daughter + virtualDeadDaughters + totalPostDaughters;

    // পুত্রের পুত্র / পুত্রের কন্যা — পুত্র জীবিত থাকলে সম্পূর্ণ বঞ্চিত (হাজব)
    if (S > 0) { counts.sonSon = 0; counts.sonDaughter = 0; }
    const SS = counts.sonSon;
    const SD = counts.sonDaughter;

    // ফিকহে "সন্তান" বলতে পুত্রের সন্তানও বোঝায় — স্বামী/স্ত্রী, পিতা-মাতা ও
    // বৈপিত্রেয় ভাই-বোনের অংশ নির্ধারণে এরাও বংশধর হিসেবে গণ্য।
    const isDescendant = (S > 0 || D > 0 || SS > 0 || SD > 0);
    // ভাই-বোনকে বঞ্চিত করে কেবল পুরুষ বংশধর (পুত্র বা পুত্রের পুত্র)
    const isMaleDescendant = (S > 0 || SS > 0);
    // কন্যা বা পুত্রের কন্যার উপস্থিতিতে বোন আসাবা মাআল গায়র হন
    const hasFemaleDescendant = (D > 0 || SD > 0);

    let originalSonCount = counts.son;
    let originalDaughterCount = counts.daughter;
    let originalFullBrotherCount = counts.fullBrother;
    let originalFullSisterCount = counts.fullSister;

    counts.son = S;
    counts.daughter = D;
    counts.fullBrother = counts.fullBrother + totalPostBrothers + virtualDeadBrothers;
    counts.fullSister = counts.fullSister + totalPostSisters + virtualDeadSisters;

    if (counts.father > 0) counts.paternalGrandfather = 0;
    if (counts.mother > 0) { counts.maternalGrandmother = 0; counts.paternalGrandmother = 0; }
    if (counts.father > 0) counts.paternalGrandmother = 0;

    if (isMaleDescendant || counts.father > 0 || counts.paternalGrandfather > 0) {
      counts.fullBrother = 0; counts.fullSister = 0;
      counts.consanguineBrother = 0; counts.consanguineSister = 0;
      counts.uterineBrother = 0; counts.uterineSister = 0;
    }

    if (counts.fullBrother > 0 || (counts.fullSister > 0 && hasFemaleDescendant)) {
      counts.consanguineBrother = 0; counts.consanguineSister = 0;
    } else if (counts.fullSister > 1 && counts.consanguineBrother === 0) {
      counts.consanguineSister = 0;
    }

    if (isDescendant) {
      counts.uterineBrother = 0; counts.uterineSister = 0;
    }

    const asabaPriority = [
      'son', 'sonSon', 'father', 'paternalGrandfather',
      'fullBrother', 'consanguineBrother',
      'fullBrotherSon', 'consanguineBrotherSon', 'fullBrotherSonSon', 'consanguineBrotherSonSon',
      'paternalUncle', 'consanguinePaternalUncle', 'paternalUncleSon', 'consanguinePaternalUncleSon',
      'paternalUncleSonSon', 'consanguinePaternalUncleSonSon', 'paternalUncleSonSonSon', 'consanguinePaternalUncleSonSonSon'
    ];
    
    let highestAsabaIndex = -1;
    let localS = S > 0 ? 1 : 0; 
    let activeAsabas = { 'son': localS, ...counts };
    
    if (counts.fullSister > 0 && hasFemaleDescendant) activeAsabas['fullBrother'] = 1;
    if (counts.consanguineSister > 0 && hasFemaleDescendant) activeAsabas['consanguineBrother'] = 1;

    for (let i = 0; i < asabaPriority.length; i++) {
      if (activeAsabas[asabaPriority[i]] > 0) {
        highestAsabaIndex = i;
        break;
      }
    }
    
    if (highestAsabaIndex > -1) {
      for (let i = highestAsabaIndex + 1; i < asabaPriority.length; i++) {
        if (asabaPriority[i] !== 'son' && asabaPriority[i] !== 'father' && asabaPriority[i] !== 'paternalGrandfather') {
          counts[asabaPriority[i]] = 0; 
        }
      }
    }

    // --- Core Share Calculation ---
    if (counts.husband > 0) { 
      shares.husband = isDescendant ? 0.25 : 0.5; 
      fixedShareSum += shares.husband; 
      steps.push(isDescendant ? 'যেহেতু মৃত ব্যক্তির সন্তান বা অধস্তন বংশধর জীবিত আছেন, তাই স্বামী সম্পত্তির ১/৪ অংশ লাভ করবেন।' : 'মৃত ব্যক্তির কোন সন্তান বা অধস্তন বংশধর না থাকায় স্বামী সম্পত্তির ১/২ অংশ লাভ করবেন।');
    }
    if (counts.wife > 0) { 
      shares.wife = isDescendant ? 0.125 : 0.25; 
      fixedShareSum += shares.wife; 
      steps.push(isDescendant ? 'যেহেতু মৃত স্বামীর সন্তান বা অধস্তন বংশধর জীবিত আছেন, তাই স্ত্রী সম্পত্তির ১/৮ অংশ লাভ করবেন।' : 'মৃত স্বামীর কোন সন্তান বা অধস্তন বংশধর না থাকায় স্ত্রী সম্পত্তির ১/৪ অংশ লাভ করবেন।');
    }
    
    if (counts.father > 0) { 
      shares.father = 1/6; 
      fixedShareSum += shares.father; 
      if (isDescendant) steps.push('সন্তান বা অধস্তন বংশধর জীবিত থাকায় পিতা নির্ধারিত অংশ হিসেবে সম্পত্তির ১/৬ অংশ পাবেন।');
      else steps.push('পিতা নির্ধারিত অংশ হিসেবে ১/৬ অংশ পাবেন এবং অবশিষ্টভোগী (আসাবা) হিসেবেও বিবেচিত হবেন।');
    }
    else if (counts.paternalGrandfather > 0) { 
      shares.paternalGrandfather = 1/6; 
      fixedShareSum += shares.paternalGrandfather; 
      if (isDescendant) steps.push('পিতা মৃত এবং সন্তান বা অধস্তন বংশধর জীবিত থাকায় দাদা নির্ধারিত অংশ হিসেবে সম্পত্তির ১/৬ অংশ পাবেন।');
    }

    let totalSiblings = counts.fullBrother + counts.fullSister + counts.consanguineBrother + counts.consanguineSister + counts.uterineBrother + counts.uterineSister;
    
    if (counts.mother > 0) {
      if (isDescendant || totalSiblings >= 2) {
        shares.mother = 1/6;
        steps.push('যেহেতু মৃত ব্যক্তির সন্তান বা একাধিক ভাই-বোন জীবিত আছেন, তাই মাতা সম্পত্তির ১/৬ অংশ লাভ করবেন।');
      } else if (counts.father > 0 && (counts.husband > 0 || counts.wife > 0)) {
        shares.mother = (1 - (shares.husband || 0) - (shares.wife || 0)) / 3;
        steps.push('স্বামী বা স্ত্রী এবং পিতা উভয়েই বর্তমান থাকায় উমারিয়্যাত নীতি অনুযায়ী স্বামী/স্ত্রীর অংশ দেওয়ার পর অবশিষ্ট সম্পত্তির ১/৩ অংশ মাতা পাবেন।');
      } else {
        shares.mother = 1/3;
        steps.push('মৃত ব্যক্তির কোন সন্তান বা একাধিক ভাই-বোন না থাকায় মাতা সম্পত্তির ১/৩ অংশ লাভ করবেন।');
      }
      fixedShareSum += shares.mother;
    }

    let gmCount = counts.paternalGrandmother + counts.maternalGrandmother;
    if (gmCount > 0) {
      let s = (1/6) / gmCount;
      if (counts.paternalGrandmother > 0) shares.paternalGrandmother = s;
      if (counts.maternalGrandmother > 0) shares.maternalGrandmother = s;
      fixedShareSum += (1/6);
      steps.push('মাতা জীবিত না থাকায় দাদী/নানী নির্ধারিত অংশ হিসেবে সম্পত্তির ১/৬ অংশ লাভ করবেন।');
    }

    let virtDaughterShare = 0;
    if (S === 0 && D > 0) {
      virtDaughterShare = (D === 1) ? 0.5 : (2/3);
      fixedShareSum += virtDaughterShare;
      steps.push(D === 1 ? 'মৃত ব্যক্তির কোন পুত্র না থাকায় একমাত্র কন্যা হিসেবে সম্পত্তির ১/২ অংশ লাভ করবেন।' : 'মৃত ব্যক্তির কোন পুত্র না থাকায় কন্যারা একত্রে সম্পত্তির ২/৩ অংশ লাভ করবেন।');
    }

    // ---- পুত্রের কন্যার নির্ধারিত অংশ ----
    // পুত্রের পুত্র থাকলে তিনি নির্ধারিত অংশ পান না — আসাবা বিল গায়র হিসেবে
    // পুত্রের পুত্রের সাথে ২:১ অনুপাতে অবশিষ্ট পান (নিচে residue অংশে)।
    if (S === 0 && SS === 0 && SD > 0) {
      if (D === 0) {
        shares.sonDaughter = (SD === 1) ? 0.5 : (2 / 3);
        steps.push(SD === 1
          ? 'পুত্র বা কন্যা না থাকায় একমাত্র পুত্রের কন্যা সম্পত্তির ১/২ অংশ লাভ করবেন।'
          : 'পুত্র বা কন্যা না থাকায় পুত্রের কন্যারা একত্রে সম্পত্তির ২/৩ অংশ লাভ করবেন।');
      } else if (D === 1) {
        shares.sonDaughter = 1 / 6;
        steps.push('একজন কন্যা ১/২ অংশ পাওয়ায়, ২/৩ অংশ পূর্ণ করার জন্য পুত্রের কন্যা তাকমিলা হিসেবে ১/৬ অংশ পাবেন।');
      } else {
        steps.push('দুই বা ততোধিক কন্যা ২/৩ অংশ নিয়ে নেওয়ায় এবং পুত্রের পুত্র না থাকায় পুত্রের কন্যা বঞ্চিত হয়েছেন।');
      }
      if (shares.sonDaughter) fixedShareSum += shares.sonDaughter;
    }

    let uSibCount = counts.uterineBrother + counts.uterineSister;
    if (uSibCount > 0) {
      let totalUSibShare = (uSibCount === 1) ? 1/6 : 1/3;
      let perUSib = totalUSibShare / uSibCount;
      if (counts.uterineBrother > 0) shares.uterineBrother = perUSib * counts.uterineBrother;
      if (counts.uterineSister > 0) shares.uterineSister = perUSib * counts.uterineSister;
      fixedShareSum += totalUSibShare;
      steps.push(uSibCount === 1 ? 'মৃত ব্যক্তির সন্তান বা পিতা-দাদা না থাকায় একমাত্র বৈপিত্রেয় ভাই/বোন ১/৬ অংশ পাবেন।' : 'মৃত ব্যক্তির সন্তান বা পিতা-দাদা না থাকায় বৈপিত্রেয় ভাই-বোনেরা একত্রে ১/৩ অংশ সমহারে পাবেন।');
    }

    // বোনের নির্ধারিত অংশ কেবল কোনো বংশধর না থাকলেই; কন্যা বা পুত্রের কন্যা
    // থাকলে তিনি আসাবা মাআল গায়র হবেন (নিচে residue অংশে)
    if (!isDescendant && counts.fullBrother === 0 && counts.fullSister > 0) {
      shares.fullSister = (counts.fullSister === 1) ? 0.5 : (2/3);
      fixedShareSum += shares.fullSister;
      steps.push(counts.fullSister === 1 ? 'মৃত ব্যক্তির সন্তান, পিতা বা ভাই না থাকায় একমাত্র সহোদর বোন ১/২ অংশ পাবেন।' : 'মৃত ব্যক্তির সন্তান, পিতা বা ভাই না থাকায় সহোদর বোনেরা একত্রে ২/৩ অংশ পাবেন।');
    }

    if (!isDescendant && counts.fullBrother === 0 && counts.consanguineBrother === 0 && counts.consanguineSister > 0) {
      if (counts.fullSister === 1) {
        shares.consanguineSister = 1/6;
        fixedShareSum += 1/6;
        steps.push('একজন সহোদর বোন তার নির্ধারিত ১/২ অংশ পাওয়ায়, বৈমাত্রেয় বোন ২/৩ অংশ পূর্ণ করার জন্য ১/৬ অংশ পাবেন।');
      } else if (counts.fullSister === 0) {
        shares.consanguineSister = (counts.consanguineSister === 1) ? 0.5 : (2/3);
        fixedShareSum += shares.consanguineSister;
        steps.push(counts.consanguineSister === 1 ? 'অন্যান্য নিকটাত্মীয় না থাকায় একমাত্র বৈমাত্রেয় বোন ১/২ অংশ পাবেন।' : 'অন্যান্য নিকটাত্মীয় না থাকায় বৈমাত্রেয় বোনেরা একত্রে ২/৩ অংশ পাবেন।');
      }
    }

    if (fixedShareSum > 1.00001) {
      steps.push(`আউল নীতি: অংশীদারদের মোট অংশের পরিমাণ সম্পূর্ণ সম্পত্তির (১ অংশ) চেয়ে বেশি হয়ে যাওয়ায় আনুপাতিক হারে সবার অংশ হ্রাস করা হয়েছে।`);
      for (let k in shares) shares[k] = shares[k] / fixedShareSum;
      virtDaughterShare = virtDaughterShare / fixedShareSum;
      fixedShareSum = 1;
    }

    let residue = 1 - fixedShareSum;
    let virtSonShare = 0;

    if (residue > 0.00001) {
      if (S > 0) {
        let ratioUnit = (S * 2) + D;
        virtSonShare = (residue * S * 2) / ratioUnit;
        virtDaughterShare += (residue * D) / ratioUnit;
        if (D > 0) {
          steps.push('পুত্র ও কন্যা উভয়েই উপস্থিত থাকায়, কন্যারা অবশিষ্টভোগী হিসেবে গণ্য হবেন এবং পুত্র ও কন্যা ২:১ অনুপাতে অবশিষ্ট সম্পত্তির উত্তরাধিকারী হবেন।');
        } else {
          steps.push('অন্যান্য অংশীদারদের অংশ বন্টনের পর পুত্র একমাত্র অবশিষ্টভোগী হিসেবে সম্পূর্ণ অবশিষ্ট সম্পত্তির অধিকার লাভ করবেন।');
        }
        residue = 0;
      } else if (SS > 0) {
        // পুত্রের পুত্র আসাবা; পুত্রের কন্যা থাকলে তার সাথে ২:১ অনুপাতে
        let ratioUnit = (SS * 2) + SD;
        shares.sonSon = (residue * SS * 2) / ratioUnit;
        if (SD > 0) {
          shares.sonDaughter = (shares.sonDaughter || 0) + (residue * SD) / ratioUnit;
          steps.push('পুত্রের পুত্রের উপস্থিতিতে পুত্রের কন্যা আসাবা বিল গায়র হিসেবে গণ্য হয়েছেন এবং তারা অবশিষ্ট সম্পত্তি ২:১ অনুপাতে লাভ করেছেন।');
        } else {
          steps.push('পুত্র না থাকায় পুত্রের পুত্র অবশিষ্টভোগী (আসাবা) হিসেবে অবশিষ্ট সম্পূর্ণ সম্পত্তির উত্তরাধিকারী হবেন।');
        }
        residue = 0;
      } else if (counts.father > 0) {
        shares.father += residue; residue = 0;
        steps.push('পিতা একমাত্র অবশিষ্টভোগী হিসেবে অবশিষ্ট সম্পূর্ণ সম্পত্তির উত্তরাধিকারী হবেন।');
      } else if (counts.paternalGrandfather > 0) {
        shares.paternalGrandfather += residue; residue = 0;
        steps.push('দাদা অবশিষ্টভোগী হিসেবে অবশিষ্ট সম্পূর্ণ সম্পত্তির উত্তরাধিকারী হবেন।');
      } else if (counts.fullBrother > 0) {
        let ratioUnit = (counts.fullBrother * 2) + counts.fullSister;
        shares.fullBrother = (residue * counts.fullBrother * 2) / ratioUnit;
        if (counts.fullSister > 0) {
          shares.fullSister = (shares.fullSister || 0) + (residue * counts.fullSister) / ratioUnit;
          steps.push('সহোদর ভাই ও বোন অবশিষ্টভোগী হিসেবে অবশিষ্ট সম্পত্তি ২:১ অনুপাতে লাভ করেছেন।');
        } else {
          steps.push('সহোদর ভাই অবশিষ্টভোগী হিসেবে অবশিষ্ট সম্পূর্ণ সম্পত্তির উত্তরাধিকারী হবেন।');
        }
        residue = 0;
      } else if (counts.fullSister > 0 && hasFemaleDescendant) {
        shares.fullSister = (shares.fullSister || 0) + residue; residue = 0;
        steps.push('কন্যা বা পুত্রের কন্যার উপস্থিতিতে সহোদর বোন আসাবা (আসাবা মাআল গায়র) হিসেবে অবশিষ্ট সম্পত্তির উত্তরাধিকারী হয়েছেন।');
      } else if (counts.consanguineBrother > 0) {
        let ratioUnit = (counts.consanguineBrother * 2) + counts.consanguineSister;
        shares.consanguineBrother = (residue * counts.consanguineBrother * 2) / ratioUnit;
        if (counts.consanguineSister > 0) {
          shares.consanguineSister = (shares.consanguineSister || 0) + (residue * counts.consanguineSister) / ratioUnit;
          steps.push('বৈমাত্রেয় ভাই ও বোন অবশিষ্টভোগী হিসেবে অবশিষ্ট সম্পত্তি ২:১ অনুপাতে লাভ করেছেন।');
        } else {
          steps.push('বৈমাত্রেয় ভাই অবশিষ্টভোগী হিসেবে অবশিষ্ট সম্পূর্ণ সম্পত্তির উত্তরাধিকারী হবেন।');
        }
        residue = 0;
      } else if (counts.consanguineSister > 0 && hasFemaleDescendant) {
        shares.consanguineSister = (shares.consanguineSister || 0) + residue; residue = 0;
        steps.push('কন্যা বা পুত্রের কন্যার উপস্থিতিতে বৈমাত্রেয় বোন আসাবা (আসাবা মাআল গায়র) হিসেবে অবশিষ্ট সম্পত্তির উত্তরাধিকারী হয়েছেন।');
      } else {
        for (let i = 5; i < asabaPriority.length; i++) {
          let k = asabaPriority[i];
          if (counts[k] > 0) {
            shares[k] = residue; residue = 0;
            steps.push(`${this.heirsConfig.find(h=>h.id===k).name} একমাত্র অবশিষ্টভোগী হিসেবে অবশিষ্ট সম্পত্তির উত্তরাধিকারী হবেন।`);
            break;
          }
        }
      }
    }

    if (residue > 0.00001) {
      let spShare = (shares.husband || 0) + (shares.wife || 0);
      let returnable = 1 - spShare;
      let currentBloodShare = fixedShareSum - spShare;
      
      if (currentBloodShare > 0.00001) {
        steps.push('রাদ্দ নীতি: আসাবা বা অবশিষ্টভোগী না থাকায় এবং নির্দিষ্ট অংশ দেওয়ার পর সম্পত্তি অবশিষ্ট থাকায় স্বামী/স্ত্রী ব্যতীত অন্যান্য অংশীদারদের মাঝে তা আনুপাতিক হারে পুনঃবন্টন করা হয়েছে।');
        for (let k in shares) {
          if (k !== 'husband' && k !== 'wife') {
            shares[k] = (shares[k] / currentBloodShare) * returnable;
          }
        }
        virtDaughterShare = (virtDaughterShare / currentBloodShare) * returnable;
      } else {
        steps.push('একমাত্র উত্তরাধিকারী হিসেবে স্বামী/স্ত্রী অবশিষ্ট সম্পূর্ণ সম্পত্তির অধিকারী হবেন অথবা প্রচলিত নিয়ম অনুযায়ী তা বাইতুল মালে জমা হবে।');
      }
    }

    // Restore counts for post-calc
    counts.son = originalSonCount;
    counts.daughter = originalDaughterCount;
    counts.fullBrother = originalFullBrotherCount;
    counts.fullSister = originalFullSisterCount;

    // 1. Dead Sons
    if (S > 0 && virtSonShare > 0) {
      let perVirtualSon = virtSonShare / S;
      if (counts.son > 0) shares.son = perVirtualSon * counts.son;
      
      for (let i = 1; i <= counts.deadSon; i++) {
        if (!this.isDeadHeirActive('deadSon', i)) continue;
        let timing = this.dynamicHeirData[`deadSon_${i}_timing`] || 'post';
        let sp = this.dynamicHeirData[`deadSon_${i}_spouse`] || 0;
        let s = this.dynamicHeirData[`deadSon_${i}_son`] || 0;
        let d = this.dynamicHeirData[`deadSon_${i}_daughter`] || 0;

        if (timing === 'pre') {
          if (s > 0 || d > 0) {
            let ratio = (s * 2) + d;
            if (s > 0) shares[`deadSon_${i}_son`] = (perVirtualSon * s * 2) / ratio;
            if (d > 0) shares[`deadSon_${i}_daughter`] = (perVirtualSon * d) / ratio;
            steps.push(`মৃত পুত্র ${toBn(i)} (আগে মৃত): ১৯৬১ সালের আইন অনুযায়ী তার সন্তানরা পিতার প্রাপ্য অংশ লাভ করেছেন।`);
          }
        } else {
          let baseShare = perVirtualSon;
          let spouseShare = 0;
          if (sp > 0) {
            spouseShare = (s > 0 || d > 0) ? baseShare * (1/8) : baseShare * (1/4);
            shares[`deadSon_${i}_spouse`] = spouseShare / sp; 
          }
          let remainder = baseShare - spouseShare;
          if (s > 0 || d > 0) {
            let ratio = (s * 2) + d;
            if (s > 0) shares[`deadSon_${i}_son`] = (remainder * s * 2) / ratio;
            if (d > 0) shares[`deadSon_${i}_daughter`] = (remainder * d) / ratio;
          } else if (remainder > 0.00001) {
            munasakhaLeftovers.push({ prefix: `deadSon_${i}_`, amount: remainder });
          }
          steps.push(`মৃত পুত্র ${toBn(i)} (পরে মৃত): মুনাছাখা নীতি অনুযায়ী তার প্রাপ্য অংশ তার স্ত্রী (১/৮) এবং পুত্র-কন্যাদের (২:১) মাঝে বন্টন করা হয়েছে।`);
        }
      }
    }

    // 2. Dead Daughters
    if (D > 0 && virtDaughterShare > 0) {
      let perVirtualDaughter = virtDaughterShare / D;
      if (counts.daughter > 0) shares.daughter = perVirtualDaughter * counts.daughter;
      
      for (let i = 1; i <= counts.deadDaughter; i++) {
        if (!this.isDeadHeirActive('deadDaughter', i)) continue;
        let timing = this.dynamicHeirData[`deadDaughter_${i}_timing`] || 'post';
        let sp = this.dynamicHeirData[`deadDaughter_${i}_spouse`] || 0;
        let s = this.dynamicHeirData[`deadDaughter_${i}_son`] || 0;
        let d = this.dynamicHeirData[`deadDaughter_${i}_daughter`] || 0;

        if (timing === 'pre') {
          if (s > 0 || d > 0) {
            let ratio = (s * 2) + d;
            if (s > 0) shares[`deadDaughter_${i}_son`] = (perVirtualDaughter * s * 2) / ratio;
            if (d > 0) shares[`deadDaughter_${i}_daughter`] = (perVirtualDaughter * d) / ratio;
            steps.push(`মৃত কন্যা ${toBn(i)} (আগে মৃত): ১৯৬১ সালের আইন অনুযায়ী তার সন্তানরা মাতার প্রাপ্য অংশ লাভ করেছেন।`);
          }
        } else {
          let baseShare = perVirtualDaughter;
          let spouseShare = 0;
          if (sp > 0) {
            spouseShare = (s > 0 || d > 0) ? baseShare * (1/4) : baseShare * (1/2);
            shares[`deadDaughter_${i}_spouse`] = spouseShare / sp; 
          }
          let remainder = baseShare - spouseShare;
          if (s > 0 || d > 0) {
            let ratio = (s * 2) + d;
            if (s > 0) shares[`deadDaughter_${i}_son`] = (remainder * s * 2) / ratio;
            if (d > 0) shares[`deadDaughter_${i}_daughter`] = (remainder * d) / ratio;
          } else if (remainder > 0.00001) {
            munasakhaLeftovers.push({ prefix: `deadDaughter_${i}_`, amount: remainder });
          }
          steps.push(`মৃত কন্যা ${toBn(i)} (পরে মৃত): মুনাছাখা নীতি অনুযায়ী তার প্রাপ্য অংশ তার স্বামী এবং পুত্র-কন্যাদের (২:১) মাঝে বন্টন করা হয়েছে।`);
        }
      }
    }

    // 3. Dead Brothers
    let totalBrothersForCalc = originalFullBrotherCount + totalPostBrothers + virtualDeadBrothers;
    if (totalBrothersForCalc > 0 && shares.fullBrother > 0) {
      let perBrother = shares.fullBrother / totalBrothersForCalc;
      shares.fullBrother = perBrother * originalFullBrotherCount;

      for (let i = 1; i <= counts.deadBrother; i++) {
        if (!this.isDeadHeirActive('deadBrother', i)) continue;
        let timing = this.dynamicHeirData[`deadBrother_${i}_timing`] || 'post';
        let sp = this.dynamicHeirData[`deadBrother_${i}_spouse`] || 0;
        let s = this.dynamicHeirData[`deadBrother_${i}_son`] || 0;
        let d = this.dynamicHeirData[`deadBrother_${i}_daughter`] || 0;

        if (timing === 'post') {
          let baseShare = perBrother;
          let spouseShare = 0;
          if (sp > 0) {
            spouseShare = (s > 0 || d > 0) ? baseShare * (1/8) : baseShare * (1/4);
            shares[`deadBrother_${i}_spouse`] = spouseShare / sp;
          }
          let remainder = baseShare - spouseShare;
          if (s > 0 || d > 0) {
            let ratio = (s * 2) + d;
            if (s > 0) shares[`deadBrother_${i}_son`] = (remainder * s * 2) / ratio;
            if (d > 0) shares[`deadBrother_${i}_daughter`] = (remainder * d) / ratio;
          } else if (remainder > 0.00001) {
            munasakhaLeftovers.push({ prefix: `deadBrother_${i}_`, amount: remainder });
          }
          steps.push(`মৃত ভাই ${toBn(i)} (পরে মৃত): মুনাছাখা নীতি অনুযায়ী তার প্রাপ্য অংশ তার স্ত্রী এবং পুত্র-কন্যাদের মাঝে বন্টন করা হয়েছে।`);
        } else {
          let baseShare = perBrother;
          if (s > 0 || d > 0) {
            let ratio = (s * 2) + d;
            if (s > 0) shares[`deadBrother_${i}_son`] = (baseShare * s * 2) / ratio;
            if (d > 0) shares[`deadBrother_${i}_daughter`] = (baseShare * d) / ratio;
            steps.push(`মৃত ভাই ${toBn(i)} (আগে মৃত): মুসলিম পারিবারিক আইন ১৯৬১ অনুযায়ী তার পুত্র ও কন্যাদের (২:১) মাঝে বন্টন করা হয়েছে।`);
          }
        }
      }
    }

    // 4. Dead Sisters
    let totalSistersForCalc = originalFullSisterCount + totalPostSisters + virtualDeadSisters;
    if (totalSistersForCalc > 0 && shares.fullSister > 0) {
      let perSister = shares.fullSister / totalSistersForCalc;
      shares.fullSister = perSister * originalFullSisterCount;

      for (let i = 1; i <= counts.deadSister; i++) {
        if (!this.isDeadHeirActive('deadSister', i)) continue;
        let timing = this.dynamicHeirData[`deadSister_${i}_timing`] || 'post';
        let sp = this.dynamicHeirData[`deadSister_${i}_spouse`] || 0;
        let s = this.dynamicHeirData[`deadSister_${i}_son`] || 0;
        let d = this.dynamicHeirData[`deadSister_${i}_daughter`] || 0;

        if (timing === 'post') {
          let baseShare = perSister;
          let spouseShare = 0;
          if (sp > 0) {
            spouseShare = (s > 0 || d > 0) ? baseShare * (1/4) : baseShare * (1/2);
            shares[`deadSister_${i}_spouse`] = spouseShare / sp;
          }
          let remainder = baseShare - spouseShare;
          if (s > 0 || d > 0) {
            let ratio = (s * 2) + d;
            if (s > 0) shares[`deadSister_${i}_son`] = (remainder * s * 2) / ratio;
            if (d > 0) shares[`deadSister_${i}_daughter`] = (remainder * d) / ratio;
          } else if (remainder > 0.00001) {
            munasakhaLeftovers.push({ prefix: `deadSister_${i}_`, amount: remainder });
          }
          steps.push(`মৃত বোন ${toBn(i)} (পরে মৃত): মুনাছাখা নীতি অনুযায়ী তার প্রাপ্য অংশ তার স্বামী এবং পুত্র-কন্যাদের মাঝে বন্টন করা হয়েছে।`);
        } else {
          let baseShare = perSister;
          if (s > 0 || d > 0) {
            let ratio = (s * 2) + d;
            if (s > 0) shares[`deadSister_${i}_son`] = (baseShare * s * 2) / ratio;
            if (d > 0) shares[`deadSister_${i}_daughter`] = (baseShare * d) / ratio;
            steps.push(`মৃত বোন ${toBn(i)} (আগে মৃত): মুসলিম পারিবারিক আইন ১৯৬১ অনুযায়ী তার পুত্র ও কন্যাদের (২:১) মাঝে বন্টন করা হয়েছে।`);
          }
        }
      }
    }

    // মুনাছাখার উদ্বৃত্ত: পরে-মৃত ব্যক্তির স্বামী/স্ত্রী নির্ধারিত অংশ নেওয়ার পর
    // সন্তান না থাকায় যে অংশ পড়ে থাকে, তা তার নিজের শাখা বাদে বাকি
    // উত্তরাধিকারীদের মাঝে আনুপাতিক হারে বন্টন হবে।
    munasakhaLeftovers.forEach(lo => {
      const eligible = Object.keys(shares).filter(k => !k.startsWith(lo.prefix) && shares[k] > 0.00001);
      const base = eligible.reduce((sum, k) => sum + shares[k], 0);
      if (base > 0.00001) {
        eligible.forEach(k => { shares[k] += lo.amount * (shares[k] / base); });
        steps.push('পরে-মৃত উত্তরাধিকারীর কোনো সন্তান না থাকায়, তার স্বামী/স্ত্রীর অংশ বাদে অবশিষ্ট সম্পত্তি অন্যান্য উত্তরাধিকারীদের মাঝে আনুপাতিক হারে বন্টন করা হয়েছে।');
      }
    });

    let finalCounts = { ...counts };
    for (let key in this.dynamicHeirData) finalCounts[key] = this.dynamicHeirData[key];

    if (steps.length === 0) steps.push('ফারায়েজ আইন অনুযায়ী স্বাভাবিক নিয়মে বন্টন প্রক্রিয়া সম্পন্ন হয়েছে।');

    this.lastCalculatedData = { shares, counts: finalCounts, inputs, steps, deductions };
    this.renderResultsFromState();
  },

  renderResultsFromState() {
    if (!this.lastCalculatedData) return;
    this.renderResults(this.lastCalculatedData.shares, this.lastCalculatedData.counts, this.lastCalculatedData.inputs, this.lastCalculatedData.steps);
  },

  /**
   * ফলাফলের উপরে দেখায় — মূল সম্পত্তি থেকে কী কী বাদ গিয়ে কতটুকু বণ্টন হলো।
   * বাদ কিছু না থাকলে বাক্সটি লুকানো থাকে।
   */
  renderDeductionResult() {
    const box = document.getElementById('res-deduction-box');
    if (!box) return;

    const ded = this.lastCalculatedData?.deductions || this.lastDeductions;
    const rows = this.ASSET_DEFS
      .map(a => ({ a, d: ded?.[a.key] }))
      .filter(x => x.d && x.d.gross > 0 && x.d.hasDeduction);

    if (!rows.length) { box.style.display = 'none'; box.innerHTML = ''; return; }

    const capped = rows.some(x => x.d.bequestCapped);
    const short = rows.some(x => x.d.insufficient);

    box.style.display = 'block';
    box.innerHTML = `
      <div class="fz-panel" style="margin:0">
        <div class="fz-panel-head">
          <span class="fz-badge-num"><i class="bi bi-dash-lg"></i></span>
          <h3>বণ্টনের আগে যা বাদ গেছে</h3>
        </div>
        <div class="fz-panel-body">
          <div class="fz-res-table-wrap">
            <table class="fz-ded-table">
              <thead><tr>
                <th style="text-align:left">সম্পদ</th>
                <th>মোট</th><th>দাফন-কাফন</th><th>ঋণ</th><th>ওসিয়ত</th>
                <th>বণ্টনযোগ্য</th>
              </tr></thead>
              <tbody>
                ${rows.map(({ a, d }) => {
                  const n = x => x ? toBn(x.toFixed(a.dec)) : '—';
                  return `<tr>
                    <td style="text-align:left"><b>${a.label}</b>
                      <span style="opacity:.65;font-size:.8em">(${this.assetUnit(a)})</span></td>
                    <td>${toBn(d.gross.toFixed(a.dec))}</td>
                    <td>${n(d.funeral)}</td>
                    <td>${n(d.debt)}</td>
                    <td>${n(d.bequest)}${d.bequestCapped ? ' <b style="color:var(--danger)">*</b>' : ''}</td>
                    <td style="color:var(--primary);font-weight:700">${toBn(d.net.toFixed(a.dec))}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          ${capped ? `<p class="fz-cert-note" style="text-align:left;margin-top:10px">
            <b style="color:var(--danger)">*</b> ওসিয়ত ১/৩ এর বেশি লেখা হয়েছিল, তাই
            শরিয়াহ অনুযায়ী ১/৩ এ নামিয়ে ধরা হয়েছে। বাকিটা দিতে হলে সব ওয়ারিশের সম্মতি লাগবে।</p>` : ''}
          ${short ? `<div class="fz-ded-alert danger" style="margin-top:10px">
            <i class="bi bi-exclamation-triangle-fill"></i>
            <span>কোনো সম্পদে দাফন-কাফন ও ঋণ মিলে সম্পত্তির চেয়ে বেশি — সেখানে
            ওয়ারিশরা কিছুই পাবেন না।</span></div>` : ''}
          <p class="fz-cert-note" style="text-align:left;margin-top:10px">
            নিচের বণ্টন <b>বণ্টনযোগ্য</b> পরিমাণের উপর করা হয়েছে, মূল সম্পত্তির উপর নয়।</p>
        </div>
      </div>`;
  },

  /**
   * ফলাফলের কী-গুলো উত্তরাধিকারীর স্বাভাবিক ক্রমে সাজায়
   * (heirsConfig এর ক্রম অনুযায়ী)। মৃত উত্তরাধিকারীর সন্তানরা
   * তাদের মূল উত্তরাধিকারীর ঠিক পরেই বসে।
   */
  sortedShareKeys(shares) {
    const order = {};
    this.heirsConfig.forEach((h, i) => { order[h.id] = i; });
    const sub = { spouse: 0.1, son: 0.2, daughter: 0.3 };

    const rank = k => {
      if (order[k] !== undefined) return order[k];
      const parts = k.split('_');            // যেমন deadSon_1_son
      const base = order[parts[0]];
      if (base === undefined) return 999;
      return base + (parseInt(parts[1]) || 0) / 100 + (sub[parts[2]] || 0) / 100;
    };

    return Object.keys(shares)
      .filter(k => shares[k] >= 0.00001)
      .sort((a, b) => rank(a) - rank(b));
  },

  getNameForKey(k) {
    if (k.startsWith('deadSon_')) {
      let parts = k.split('_');
      let timing = this.dynamicHeirData[`${parts[0]}_${parts[1]}_timing`] || 'post';
      let txt = timing === 'pre' ? '(আগে মৃত)' : '(পরে মৃত)';
      if (parts[2] === 'spouse') return `মৃত পুত্র ${txt} ${toBn(parts[1])} এর স্ত্রী`;
      return `মৃত পুত্র ${txt} ${toBn(parts[1])} এর ${parts[2] === 'son' ? 'পুত্র' : 'কন্যা'}`;
    }
    if (k.startsWith('deadDaughter_')) {
      let parts = k.split('_');
      let timing = this.dynamicHeirData[`${parts[0]}_${parts[1]}_timing`] || 'post';
      let txt = timing === 'pre' ? '(আগে মৃত)' : '(পরে মৃত)';
      if (parts[2] === 'spouse') return `মৃত কন্যা ${txt} ${toBn(parts[1])} এর স্বামী`;
      return `মৃত কন্যা ${txt} ${toBn(parts[1])} এর ${parts[2] === 'son' ? 'পুত্র' : 'কন্যা'}`;
    }
    if (k.startsWith('deadBrother_')) {
      let parts = k.split('_');
      let timing = this.dynamicHeirData[`${parts[0]}_${parts[1]}_timing`] || 'post';
      let txt = timing === 'pre' ? '(আগে মৃত)' : '(পরে মৃত)';
      if (parts[2] === 'spouse') return `মৃত ভাই ${txt} ${toBn(parts[1])} এর স্ত্রী (ভাবি)`;
      return `মৃত ভাই ${txt} ${toBn(parts[1])} এর ${parts[2] === 'son' ? 'পুত্র (ভাতিজা)' : 'কন্যা (ভাতিজি)'}`;
    }
    if (k.startsWith('deadSister_')) {
      let parts = k.split('_');
      let timing = this.dynamicHeirData[`${parts[0]}_${parts[1]}_timing`] || 'post';
      let txt = timing === 'pre' ? '(আগে মৃত)' : '(পরে মৃত)';
      if (parts[2] === 'spouse') return `মৃত বোন ${txt} ${toBn(parts[1])} এর স্বামী (ভগ্নিপতি)`;
      return `মৃত বোন ${txt} ${toBn(parts[1])} এর ${parts[2] === 'son' ? 'পুত্র (ভাগিনা)' : 'কন্যা (ভাগনি)'}`;
    }
    return this.heirsConfig.find(h=>h.id === k)?.name || k;
  },

  renderResults(shares, counts, inputs, steps) {
    const resSec = document.getElementById('result-section');
    if (resSec) {
      resSec.style.display = 'block';
      resSec.scrollIntoView({ behavior: 'smooth' });
    }

    this.renderDeductionResult();

    const showSixDigits = document.getElementById('chkSixDigits')?.checked || false;
    const landDecimals = showSixDigits ? 6 : 3;
    // চেকবক্স টিক দিলে ভগ্নাংশ ও শতাংশ কলাম দেখা যাবে
    const showFraction = document.getElementById('chkShowFraction')?.checked || false;

    let headHtml = '<tr><th style="text-align:left">আত্মীয়</th>';
    if (this.inputsVisible) headHtml += '<th style="width:24%;text-align:left">নাম</th>';
    headHtml += '<th style="text-align:center">অংশ</th>';
    if (showFraction) {
      headHtml += '<th style="text-align:center">ভগ্নাংশ</th>';
      headHtml += '<th style="text-align:center">অংশ (%)</th>';
    }

    if (inputs.land) headHtml += `<th style="text-align:right">জমি (${this.currentUnit === 'acre' ? 'একর' : 'শতক'})</th>`;
    if (inputs.gold) headHtml += '<th style="text-align:right">স্বর্ণ (ভরি)</th>';
    if (inputs.silver) headHtml += '<th style="text-align:right">রৌপ্য (ভরি)</th>';
    if (inputs.money) headHtml += '<th style="text-align:right">টাকা</th>';
    headHtml += '</tr>';
    document.getElementById('res-thead').innerHTML = headHtml;

    const deceasedRow = document.getElementById('deceased-name-row');
    if (deceasedRow) deceasedRow.style.display = this.inputsVisible ? 'block' : 'none';

    let bodyHtml = '';
    let cardsHtml = '';
    let labels = [], data = [], bgColors = ['#2563EB','#F59E0B','#10B981','#8B5CF6','#EC4899','#EF4444', '#06b6d4', '#f97316', '#6366f1', '#14b8a6'];
    const landUnit = this.currentUnit === 'acre' ? 'একর' : 'শতক';
    let totalShare = 0;

    for (const k of this.sortedShareKeys(shares)) {
      totalShare += shares[k];
      const count = counts[k] || 1;
      const perPersonShare = shares[k] / count;
      const percent = (perPersonShare * 100).toFixed(2);
      // সরকারি সাইটের মতো মূল "অংশ" দশমিকে (যেমন ০.১২৫)
      const decimalStr = toBn(perPersonShare.toFixed(4));
      const fracStr = LandMath.toFractionBn(perPersonShare) || '—';
      const baseName = this.getNameForKey(k);

      labels.push(baseName);
      data.push(shares[k] * 100);

      for (let i = 0; i < count; i++) {
        let name = count > 1 ? `${baseName} - ${toBn(i+1)}` : baseName;

        // ---- ডেস্কটপ টেবিল সারি ----
        bodyHtml += `<tr><td style="font-weight:600;text-align:left">${name}</td>`;
        if (this.inputsVisible) bodyHtml += `<td style="text-align:left"><input type="text" class="form-control print-name-input" data-id="${k}-${i}" placeholder="নাম লিখুন"/></td>`;
        bodyHtml += `<td style="text-align:center;font-weight:700">${decimalStr}</td>`;
        if (showFraction) {
          bodyHtml += `<td style="text-align:center;font-weight:700;color:var(--secondary)">${fracStr}</td>`;
          bodyHtml += `<td style="text-align:center">${toBn(percent)}%</td>`;
        }

        if (inputs.land) bodyHtml += `<td style="text-align:right;font-weight:700;color:var(--primary)">${toBn((inputs.land * perPersonShare).toFixed(landDecimals))}</td>`;
        if (inputs.gold) bodyHtml += `<td style="text-align:right">${toBn((inputs.gold * perPersonShare).toFixed(3))}</td>`;
        if (inputs.silver) bodyHtml += `<td style="text-align:right">${toBn((inputs.silver * perPersonShare).toFixed(3))}</td>`;
        if (inputs.money) bodyHtml += `<td style="text-align:right">${toBn((inputs.money * perPersonShare).toFixed(0))}</td>`;
        bodyHtml += '</tr>';

        // ---- মোবাইল কার্ড ----
        let items = '';
        // চেকবক্স টিক দিলে ভগ্নাংশ ও শতাংশ যোগ হয়
        if (showFraction) {
          items += `<div class="fz-res-item"><span class="lbl">ভগ্নাংশ</span><span class="val" style="color:var(--secondary)">${fracStr}</span></div>`;
          items += `<div class="fz-res-item"><span class="lbl">অংশ (%)</span><span class="val">${toBn(percent)}%</span></div>`;
        }
        if (inputs.land) items += `<div class="fz-res-item"><span class="lbl">জমি (${landUnit})</span><span class="val">${toBn((inputs.land * perPersonShare).toFixed(landDecimals))}</span></div>`;
        if (inputs.gold) items += `<div class="fz-res-item"><span class="lbl">স্বর্ণ (ভরি)</span><span class="val">${toBn((inputs.gold * perPersonShare).toFixed(3))}</span></div>`;
        if (inputs.silver) items += `<div class="fz-res-item"><span class="lbl">রৌপ্য (ভরি)</span><span class="val">${toBn((inputs.silver * perPersonShare).toFixed(3))}</span></div>`;
        if (inputs.money) items += `<div class="fz-res-item"><span class="lbl">টাকা</span><span class="val">${toBn((inputs.money * perPersonShare).toFixed(0))}</span></div>`;

        const nameInput = this.inputsVisible
          ? `<div style="margin-top:9px"><input type="text" class="form-control print-name-input" data-id="${k}-${i}" placeholder="নাম লিখুন" style="width:100%"></div>`
          : '';

        cardsHtml += `
          <div class="fz-res-card">
            <div class="fz-res-card-top">
              <span class="fz-res-name">${name}</span>
              <span class="fz-res-pct">${decimalStr}</span>
            </div>
            ${items ? `<div class="fz-res-grid">${items}</div>` : ''}
            ${nameInput}
          </div>`;
      }
    }
    document.getElementById('res-tbody').innerHTML = bodyHtml;
    const cardBox = document.getElementById('fz-res-cards');
    if (cardBox) cardBox.innerHTML = cardsHtml;

    // ---- মোট ১০০% না হলে সতর্কবার্তা (LIMIT-1) ----
    const warnBox = document.getElementById('fz-warn-box');
    const warnText = document.getElementById('fz-warn-text');
    if (warnBox && warnText) {
      const missing = 1 - totalShare;
      if (missing > 0.0001) {
        warnText.innerHTML = `বন্টিত অংশের মোট পরিমাণ <b>${toBn((totalShare * 100).toFixed(2))}%</b> — সম্পত্তির
          <b>${toBn((missing * 100).toFixed(2))}%</b> কোনো উত্তরাধিকারী পাচ্ছেন না। হানাফি মতে
          নির্ধারিত অংশীদার ও আসাবা না থাকলে অবশিষ্ট সম্পত্তি যবিল আরহাম (দূরবর্তী আত্মীয় —
          যেমন কন্যার সন্তান, মামা, খালা, ফুফু) পাবেন, তারাও না থাকলে তা রাষ্ট্রীয় কোষাগারে
          (বাইতুল মাল) যাবে। এই ক্যালকুলেটরে যবিল আরহাম হিসাব করা হয় না।`;
        warnBox.style.display = 'flex';
      } else {
        warnBox.style.display = 'none';
      }
    }

    const stepContainer = document.getElementById('res-steps');
    if (stepContainer) {
      stepContainer.innerHTML = steps.map(s => `<li>${s}</li>`).join('');
    }

    // ধাপ নির্দেশক হালনাগাদ
    ['fz-step-1', 'fz-step-2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('done'); el.classList.remove('active'); }
    });
    const s3 = document.getElementById('fz-step-3');
    if (s3) s3.classList.add('active');

    if (this.myChart) this.myChart.destroy();
    
    const chartEl = document.getElementById('res-chart');
    if (chartEl && typeof Chart !== 'undefined') {
      let backgroundColorsForChart = [];
      for (let i = 0; i < data.length; i++) { backgroundColorsForChart.push(bgColors[i % bgColors.length]); }

      this.myChart = new Chart(chartEl, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: backgroundColorsForChart, borderWidth: 0 }] },
        options: { cutout: '65%', plugins: { legend: { display: false } } }
      });
    }
  },

  toggleNameInputs() {
    if (!this.lastCalculatedData) return;
    if (!this.inputsVisible) { this.inputsVisible = true; this.renderResultsFromState(); }
    else { this.initPrint(true); }
  },

  initPrint(withName) {
    if (!this.lastCalculatedData) return;
    let deceasedName = ''; let namesMap = {};
    if (withName) {
      deceasedName = document.getElementById('deceased-name-input')?.value || '';
      document.querySelectorAll('.print-name-input').forEach(inp => { namesMap[inp.getAttribute('data-id')] = inp.value; });
    }
    this.generatePrintReport(this.lastCalculatedData, withName, deceasedName, namesMap);
  },

  generatePrintReport(data, withNames, deceasedName, namesMap) {
    let container = document.getElementById('print-report-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'print-report-container';
      document.body.appendChild(container);
    }
    
    const { shares, counts, inputs, steps } = data;
    const activeProps = [];
    const landLabel = this.currentUnit === 'acre' ? 'জমি (একর)' : 'জমি (শতক)';
    if (inputs.land > 0) activeProps.push({ id: 'land', label: landLabel });
    if (inputs.gold > 0) activeProps.push({ id: 'gold', label: 'স্বর্ণ (ভরি)' });
    if (inputs.silver > 0) activeProps.push({ id: 'silver', label: 'রৌপ্য (ভরি)' });
    if (inputs.money > 0) activeProps.push({ id: 'money', label: 'টাকা' });

    const showSixDigits = document.getElementById('chkSixDigits')?.checked;
    const landDec = showSixDigits ? 6 : 3;

    // ---- টেবিলের হেডার ----
    const showFraction = document.getElementById('chkShowFraction')?.checked || false;

    let theadHTML = '<tr><th style="width:8%">ক্রমিক</th><th style="width:26%">আত্মীয়</th>';
    if (withNames) theadHTML += '<th style="width:20%">নাম</th>';
    theadHTML += '<th style="width:11%">অংশ</th>';
    if (showFraction) theadHTML += '<th style="width:10%">ভগ্নাংশ</th><th style="width:11%">অংশ (%)</th>';
    activeProps.forEach(p => { theadHTML += `<th>${p.label}</th>`; });
    theadHTML += '</tr>';

    // ---- সারি ----
    let tbodyHTML = '', serial = 1, totalPct = 0;
    const propTotals = {};
    activeProps.forEach(p => { propTotals[p.id] = 0; });

    for (const k of this.sortedShareKeys(shares)) {
      const count = counts[k] || 1;
      const perPersonShare = shares[k] / count;
      const percent = (perPersonShare * 100).toFixed(2);
      const baseName = this.getNameForKey(k);
      const fracStr = LandMath.toFractionBn(perPersonShare) || '—';

      for (let i = 0; i < count; i++) {
        const name = count > 1 ? `${baseName} - ${toBn(i + 1)}` : baseName;
        totalPct += perPersonShare * 100;

        tbodyHTML += `<tr><td>${toBn(serial++)}</td><td class="pr-left">${name}</td>`;
        if (withNames) tbodyHTML += `<td class="pr-left">${namesMap[`${k}-${i}`] || ''}</td>`;
        tbodyHTML += `<td>${toBn(perPersonShare.toFixed(4))}</td>`;
        if (showFraction) tbodyHTML += `<td>${fracStr}</td><td>${toBn(percent)}%</td>`;
        activeProps.forEach(p => {
          const decimals = p.id === 'money' ? 0 : (p.id === 'land' ? landDec : 3);
          const val = inputs[p.id] * perPersonShare;
          propTotals[p.id] += val;
          tbodyHTML += `<td>${toBn(val.toFixed(decimals))}</td>`;
        });
        tbodyHTML += '</tr>';
      }
    }

    // ---- মোট সারি ----
    let tfootHTML = `<tr><td colspan="${withNames ? 3 : 2}" class="pr-left">সর্বমোট</td>`;
    tfootHTML += `<td>${toBn((totalPct / 100).toFixed(4))}</td>`;
    if (showFraction) tfootHTML += `<td>—</td><td>${toBn(totalPct.toFixed(2))}%</td>`;
    activeProps.forEach(p => {
      const decimals = p.id === 'money' ? 0 : (p.id === 'land' ? landDec : 3);
      tfootHTML += `<td>${toBn(propTotals[p.id].toFixed(decimals))}</td>`;
    });
    tfootHTML += '</tr>';

    // ---- সম্পদের বিবরণ ----
    let assetsHTML = '';
    if (activeProps.length) {
      const cells = activeProps.map(p => {
        const decimals = p.id === 'money' ? 0 : (p.id === 'land' ? landDec : 3);
        return `<span><b>${p.label}:</b> ${toBn(inputs[p.id].toFixed(decimals))}</span>`;
      }).join('');
      assetsHTML = `<div class="pr-assets"><h3>বণ্টনযোগ্য সম্পদের বিবরণ</h3>
                    <div class="pr-assets-grid">${cells}</div></div>`;
    }

    // ---- বণ্টনের আগে যা বাদ গেছে (সনদে না থাকলে কাগজটা বিভ্রান্তিকর হতো,
    //      কারণ উপরের "বণ্টনযোগ্য" মূল সম্পত্তির চেয়ে কম) ----
    const ded = this.lastCalculatedData?.deductions || this.lastDeductions;
    let dedHTML = '';
    const dedRows = this.ASSET_DEFS
      .map(a => ({ a, d: ded?.[a.key] }))
      .filter(x => x.d && x.d.gross > 0 && x.d.hasDeduction);

    if (dedRows.length) {
      const anyCapped = dedRows.some(x => x.d.bequestCapped);
      dedHTML = `
        <div class="pr-assets">
          <h3>বণ্টনের পূর্বে বাদ যাওয়া খাত</h3>
          <table class="pr-table pr-table-sm">
            <thead><tr>
              <th class="pr-left">সম্পদ</th><th>মোট</th><th>দাফন-কাফন</th>
              <th>ঋণ</th><th>ওসিয়ত</th><th>বণ্টনযোগ্য</th>
            </tr></thead>
            <tbody>
              ${dedRows.map(({ a, d }) => {
                const n = x => x ? toBn(x.toFixed(a.dec)) : '—';
                return `<tr>
                  <td class="pr-left">${a.label} (${this.assetUnit(a)})</td>
                  <td>${toBn(d.gross.toFixed(a.dec))}</td>
                  <td>${n(d.funeral)}</td>
                  <td>${n(d.debt)}</td>
                  <td>${n(d.bequest)}${d.bequestCapped ? ' *' : ''}</td>
                  <td>${toBn(d.net.toFixed(a.dec))}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <p class="pr-note" style="margin-top:6px">
            শরিয়াহ অনুযায়ী ক্রম — দাফন-কাফনের খরচ, অতঃপর ঋণ, অতঃপর ওসিয়ত
            (ঋণ পরিশোধের পর অবশিষ্টের সর্বোচ্চ এক-তৃতীয়াংশ)। অবশিষ্ট সম্পত্তিই
            নিম্নে ওয়ারিশগণের মাঝে বণ্টিত হয়েছে।
            ${anyCapped ? '<br><b>*</b> ওসিয়ত এক-তৃতীয়াংশের অধিক হওয়ায় এক-তৃতীয়াংশ ধরা হয়েছে।' : ''}
          </p>
        </div>`;
    }

    const today = new Date();
    const dateBn = toBn(today.toLocaleDateString('en-GB').replace(/\//g, '-'));

    container.innerHTML = `
      <div class="pr-head">
        <h1>উত্তরাধিকার সনদ</h1>
        <div class="pr-sub">মুসলিম উত্তরাধিকার আইন (ফরায়েজ) অনুযায়ী সম্পত্তি বণ্টন বিবরণী</div>
      </div>

      <div class="pr-meta">
        <div><b>মৃত ব্যক্তির নাম:</b> ${deceasedName || '.'.repeat(30)}</div>
        <div style="text-align:right"><b>তারিখ:</b> ${dateBn}</div>
      </div>

      ${dedHTML}
      ${assetsHTML}

      <table class="pr-table">
        <thead>${theadHTML}</thead>
        <tbody>${tbodyHTML}</tbody>
        <tfoot>${tfootHTML}</tfoot>
      </table>

      <div class="pr-steps">
        <h3>হিসাবের ধাপসমূহ</h3>
        <ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>
      </div>

      <div class="pr-note">
        সতর্কীকরণ: এই বিবরণী একটি স্বয়ংক্রিয় ক্যালকুলেটর দ্বারা প্রস্তুত। জটিল হিসাব নিয়ে
        সন্দেহ বা মতবিরোধ থাকলে অভিজ্ঞ আইনজীবীর মাধ্যমে চূড়ান্ত করুন। এই ফলাফলের
        আইনগত দায় কর্তৃপক্ষ গ্রহণ করবে না।
      </div>

      <div class="pr-sign">
        <div>প্রস্তুতকারীর স্বাক্ষর</div>
        <div>সাক্ষীর স্বাক্ষর</div>
        <div>তারিখ ও সীলমোহর</div>
      </div>

      <div class="pr-foot">Land Info — ফ্রি ডিজিটাল ভূমি সার্ভিস · উত্তরাধিকার ক্যালকুলেটর</div>
    `;

    window.print();
  },

  /* ========================================================================
     ৫খ. হিন্দু উত্তরাধিকার (দায়ভাগ)
     গণিত js/hindu-inheritance.js এর HinduLaw এ — এখানে শুধু UI।
     ======================================================================== */

  hinduDyn: {},          // মৃত পুত্রের বিবরণ
  hinduLast: null,       // সর্বশেষ হিসাব
  hinduUnit: 'decimal',
  hinduChart: null,

  renderHinduHeirs() {
    const wrap = document.getElementById('hd-heir-wrapper');
    if (!wrap || wrap.dataset.built === '1') { this.refreshHinduSummary(); return; }
    wrap.innerHTML = '';

    HinduLaw.categories.forEach((cat, ci) => {
      const heirs = HinduLaw.heirsConfig.filter(h => h.cat === cat.id);
      if (!heirs.length) return;

      const acc = document.createElement('div');
      acc.className = 'fz-acc' + (ci === 0 ? ' open' : '');
      acc.id = `hd-acc-${cat.id}`;

      let rows = '';
      heirs.forEach(h => {
        const multi = h.type === 'multi';
        rows += `
          <div class="fz-heir" id="hd-row-${h.id}" data-name="${h.name}"
               onclick="AppController.toggleHinduHeir('${h.id}')">
            <span class="fz-check"><i class="bi bi-check-lg"></i></span>
            <span class="fz-heir-name">${h.name}</span>
            <span class="fz-single-hint ${multi ? 'multi' : 'single'}">১ জন</span>
            <span class="fz-counter ${multi ? 'multi' : 'single'}" onclick="event.stopPropagation()">
              <button type="button" class="fz-cbtn" onclick="AppController.stepHinduHeir('${h.id}',-1)">&minus;</button>
              <input class="fz-cinput" id="hd-count-${h.id}" value="০" inputmode="numeric"
                     oninput="AppController.setHinduHeir('${h.id}', this.value, true)">
              <button type="button" class="fz-cbtn" onclick="AppController.stepHinduHeir('${h.id}',1)">+</button>
            </span>
          </div>`;
        if (h.isDynamicTrigger) rows += `<div id="hd-dyn-${h.id}"></div>`;
      });

      acc.innerHTML = `
        <button type="button" class="fz-acc-head" onclick="AppController.toggleAccordionEl('hd-acc-${cat.id}')">
          <span class="fz-acc-pill zero" id="hd-pill-${cat.id}">০</span>
          <span class="fz-acc-title">${cat.title}</span>
          <i class="bi bi-chevron-down fz-acc-chev"></i>
        </button>
        <div class="fz-acc-body">${rows}</div>`;
      wrap.appendChild(acc);
    });

    wrap.dataset.built = '1';
    this.refreshHinduSummary();
  },

  toggleAccordionEl(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('open');
  },

  hinduCount(id) {
    return parseInt(toEn(document.getElementById(`hd-count-${id}`)?.value || '0')) || 0;
  },

  toggleHinduHeir(id) {
    this.setHinduHeir(id, this.hinduCount(id) > 0 ? 0 : 1);
  },

  stepHinduHeir(id, delta) {
    this.setHinduHeir(id, this.hinduCount(id) + delta);
  },

  setHinduHeir(id, val, manual) {
    const cfg = HinduLaw.heirsConfig.find(h => h.id === id);
    if (!cfg) return;
    let v = parseInt(toEn(val)) || 0;
    if (v < 0) v = 0;
    if (cfg.type === 'single' && v > 1) v = 1;

    const inp = document.getElementById(`hd-count-${id}`);
    if (inp && !manual) inp.value = toBn(v);

    const row = document.getElementById(`hd-row-${id}`);
    if (row) row.classList.toggle('active', v > 0);

    if (cfg.isDynamicTrigger) this.renderHinduDeadSons(v);
    this.refreshHinduSummary();
  },

  /** মৃত পুত্রের উপ-ফর্ম (তার পৌত্র ও বিধবা স্ত্রী) */
  renderHinduDeadSons(count) {
    const box = document.getElementById('hd-dyn-deadSon');
    if (!box) return;
    if (!count) { box.innerHTML = ''; return; }

    let html = '';
    for (let i = 1; i <= count; i++) {
      const sk = `deadSon_${i}_son`, wk = `deadSon_${i}_widow`;
      if (this.hinduDyn[sk] === undefined) this.hinduDyn[sk] = 0;
      if (this.hinduDyn[wk] === undefined) this.hinduDyn[wk] = 0;

      const mini = (key, label, max) => `
        <div class="fz-dead-field">
          <label>${label}</label>
          <div class="fz-mini-counter">
            <button type="button" onclick="AppController.stepHinduDyn('${key}',-1,${max})">&minus;</button>
            <input id="hd-dyn-${key}" value="${toBn(this.hinduDyn[key])}" inputmode="numeric"
                   onchange="AppController.setHinduDyn('${key}', this.value, ${max})">
            <button type="button" onclick="AppController.stepHinduDyn('${key}',1,${max})">+</button>
          </div>
        </div>`;

      html += `
        <div class="fz-dead-card">
          <div class="fz-dead-title"><i class="bi bi-diagram-2"></i> মৃত পুত্র ${toBn(i)} এর উত্তরাধিকারী</div>
          <div class="fz-dead-grid">
            ${mini(sk, 'পুত্র (পৌত্র)', 20)}
            ${mini(wk, 'বিধবা স্ত্রী', 4)}
          </div>
        </div>`;
    }
    box.innerHTML = html;
  },

  stepHinduDyn(key, delta, max) {
    this.setHinduDyn(key, (this.hinduDyn[key] || 0) + delta, max);
  },

  setHinduDyn(key, val, max) {
    let v = parseInt(toEn(val)) || 0;
    if (v < 0) v = 0;
    if (max !== undefined && v > max) v = max;
    this.hinduDyn[key] = v;
    const el = document.getElementById(`hd-dyn-${key}`);
    if (el) el.value = toBn(v);
    this.refreshHinduSummary();
  },

  filterHinduHeirs(query) {
    const q = (query || '').trim().toLowerCase();
    HinduLaw.categories.forEach(cat => {
      const acc = document.getElementById(`hd-acc-${cat.id}`);
      if (!acc) return;
      let visible = 0;
      acc.querySelectorAll('.fz-heir').forEach(row => {
        const match = !q || (row.dataset.name || '').toLowerCase().includes(q);
        row.classList.toggle('hidden', !match);
        if (match) visible++;
      });
      acc.style.display = (q && visible === 0) ? 'none' : '';
      if (q) acc.classList.toggle('open', visible > 0);
    });
  },

  refreshHinduSummary() {
    const bar = document.getElementById('hd-selected-bar');
    let total = 0;
    const tags = [];

    HinduLaw.categories.forEach(cat => {
      let sub = 0;
      HinduLaw.heirsConfig.filter(h => h.cat === cat.id).forEach(h => {
        const n = this.hinduCount(h.id);
        if (n > 0) {
          sub += n;
          tags.push(`<span class="fz-tag" onclick="AppController.setHinduHeir('${h.id}', 0)" title="বাদ দিন">
            ${h.name}${n > 1 ? `<span class="fz-tag-count">${toBn(n)}</span>` : ''}
            <i class="bi bi-x"></i></span>`);
        }
      });
      total += sub;
      const pill = document.getElementById(`hd-pill-${cat.id}`);
      if (pill) { pill.textContent = toBn(sub); pill.classList.toggle('zero', sub === 0); }
    });

    if (bar) {
      bar.innerHTML = tags.length ? tags.join('')
        : '<span class="fz-selected-empty">এখনো কোনো উত্তরাধিকারী নির্বাচন করা হয়নি</span>';
    }
    const cnt = document.getElementById('hd-sticky-count');
    if (cnt) cnt.textContent = toBn(total);

    const s1 = document.getElementById('hd-step-1'), s2 = document.getElementById('hd-step-2');
    if (s1) s1.classList.toggle('done', total > 0);
    if (s2) s2.classList.toggle('active', total > 0);
  },

  setHinduUnit(unit) {
    this.hinduUnit = unit;
    const d = document.getElementById('hd-unit-dec'), a = document.getElementById('hd-unit-acr');
    if (d) d.classList.toggle('active', unit === 'decimal');
    if (a) a.classList.toggle('active', unit === 'acre');
    const lbl = document.getElementById('hd-land-unit-label');
    if (lbl) lbl.textContent = unit === 'acre' ? 'একর' : 'শতাংশ';
    if (this.hinduLast) this.renderHinduResults();
  },

  resetHinduForm() {
    HinduLaw.heirsConfig.forEach(h => this.setHinduHeir(h.id, 0));
    this.hinduDyn = {};
    this.hinduLast = null;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('hd-land-input', '১০০');
    set('hd-gold-input', '০');
    set('hd-silver-input', '০');
    set('hd-cash-input', '০');
    set('hd-heir-search', '');
    this.filterHinduHeirs('');
    const res = document.getElementById('hd-result-section');
    if (res) res.style.display = 'none';
    const s3 = document.getElementById('hd-step-3');
    if (s3) s3.classList.remove('active', 'done');
    this.refreshHinduSummary();
  },

  calculateHindu() {
    const counts = {};
    HinduLaw.heirsConfig.forEach(h => { counts[h.id] = this.hinduCount(h.id); });

    const num = id => parseFloat(toEn(document.getElementById(id)?.value || '0')) || 0;
    const inputs = {
      land: num('hd-land-input'),
      gold: num('hd-gold-input'),
      silver: num('hd-silver-input'),
      money: num('hd-cash-input')
    };

    const res = HinduLaw.calculate(counts, this.hinduDyn);
    this.hinduLast = { ...res, counts, inputs };
    this.renderHinduResults();
  },

  renderHinduResults() {
    if (!this.hinduLast) return;
    const { shares, steps, counts, inputs, limitedEstate } = this.hinduLast;

    const sec = document.getElementById('hd-result-section');
    if (sec) { sec.style.display = 'block'; sec.scrollIntoView({ behavior: 'smooth' }); }

    const showFrac = document.getElementById('hd-chk-fraction')?.checked || false;
    const landUnit = this.hinduUnit === 'acre' ? 'একর' : 'শতক';

    // ---- টেবিল হেডার ----
    let head = '<tr><th style="text-align:left">আত্মীয়</th><th style="text-align:center">অংশ</th>';
    if (showFrac) head += '<th style="text-align:center">ভগ্নাংশ</th><th style="text-align:center">অংশ (%)</th>';
    if (inputs.land) head += `<th style="text-align:right">জমি (${landUnit})</th>`;
    if (inputs.gold) head += '<th style="text-align:right">স্বর্ণ (ভরি)</th>';
    if (inputs.silver) head += '<th style="text-align:right">রৌপ্য (ভরি)</th>';
    if (inputs.money) head += '<th style="text-align:right">টাকা</th>';
    head += '</tr>';
    document.getElementById('hd-res-thead').innerHTML = head;

    // ---- প্রতিটি key এর ব্যক্তি-সংখ্যা ----
    const personCount = k => {
      if (k.startsWith('deadSon_')) return this.hinduDyn[k] || 1;
      return counts[k] || 1;
    };

    let body = '', cards = '', labels = [], data = [];
    const colors = ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#EF4444', '#06b6d4', '#f97316'];

    Object.keys(shares).filter(k => shares[k] > 1e-9).forEach(k => {
      const n = personCount(k);
      const per = shares[k] / n;
      const pct = (per * 100).toFixed(2);
      const dec = toBn(per.toFixed(4));
      const fr = LandMath.toFractionBn(per) || '—';
      const base = HinduLaw.nameFor(k, this.hinduDyn);
      const limited = limitedEstate.includes(k);

      labels.push(base);
      data.push(shares[k] * 100);

      for (let i = 0; i < n; i++) {
        const nm = n > 1 ? `${base} - ${toBn(i + 1)}` : base;
        const mark = limited ? ' <span style="font-size:0.72rem;color:var(--accent);font-weight:700">(সীমিত স্বত্ব)</span>' : '';

        body += `<tr><td style="font-weight:600;text-align:left">${nm}${mark}</td>`;
        body += `<td style="text-align:center;font-weight:700">${dec}</td>`;
        if (showFrac) {
          body += `<td style="text-align:center;font-weight:700;color:var(--secondary)">${fr}</td>`;
          body += `<td style="text-align:center">${toBn(pct)}%</td>`;
        }
        if (inputs.land) body += `<td style="text-align:right;font-weight:700;color:var(--primary)">${toBn((inputs.land * per).toFixed(3))}</td>`;
        if (inputs.gold) body += `<td style="text-align:right">${toBn((inputs.gold * per).toFixed(3))}</td>`;
        if (inputs.silver) body += `<td style="text-align:right">${toBn((inputs.silver * per).toFixed(3))}</td>`;
        if (inputs.money) body += `<td style="text-align:right">${toBn((inputs.money * per).toFixed(0))}</td>`;
        body += '</tr>';

        let items = '';
        if (showFrac) {
          items += `<div class="fz-res-item"><span class="lbl">ভগ্নাংশ</span><span class="val" style="color:var(--secondary)">${fr}</span></div>`;
          items += `<div class="fz-res-item"><span class="lbl">অংশ (%)</span><span class="val">${toBn(pct)}%</span></div>`;
        }
        if (inputs.land) items += `<div class="fz-res-item"><span class="lbl">জমি (${landUnit})</span><span class="val">${toBn((inputs.land * per).toFixed(3))}</span></div>`;
        if (inputs.gold) items += `<div class="fz-res-item"><span class="lbl">স্বর্ণ (ভরি)</span><span class="val">${toBn((inputs.gold * per).toFixed(3))}</span></div>`;
        if (inputs.silver) items += `<div class="fz-res-item"><span class="lbl">রৌপ্য (ভরি)</span><span class="val">${toBn((inputs.silver * per).toFixed(3))}</span></div>`;
        if (inputs.money) items += `<div class="fz-res-item"><span class="lbl">টাকা</span><span class="val">${toBn((inputs.money * per).toFixed(0))}</span></div>`;

        cards += `
          <div class="fz-res-card">
            <div class="fz-res-card-top">
              <span class="fz-res-name">${nm}${mark}</span>
              <span class="fz-res-pct">${dec}</span>
            </div>
            ${items ? `<div class="fz-res-grid">${items}</div>` : ''}
          </div>`;
      }
    });

    document.getElementById('hd-res-tbody').innerHTML = body;
    document.getElementById('hd-res-cards').innerHTML = cards;

    // ---- সীমিত স্বত্বের সতর্কবার্তা ----
    const warn = document.getElementById('hd-limited-warn');
    const warnTxt = document.getElementById('hd-limited-text');
    if (warn && warnTxt) {
      const names = limitedEstate.filter(k => shares[k] > 1e-9)
        .map(k => HinduLaw.nameFor(k, this.hinduDyn));
      if (names.length) {
        warnTxt.innerHTML = `<b>সীমিত স্বত্ব:</b> দায়ভাগ মত অনুযায়ী ${names.join(', ')} —
          এদের প্রাপ্ত অংশ <b>জীবনস্বত্ব (limited estate)</b>। তারা সম্পত্তি ভোগ করতে পারবেন,
          কিন্তু সাধারণত বিক্রি বা হস্তান্তর করতে পারবেন না। তাদের মৃত্যুর পর সম্পত্তি
          মৃত ব্যক্তির পরবর্তী উত্তরাধিকারীর কাছে ফিরে যাবে।`;
        warn.style.display = 'flex';
      } else {
        warn.style.display = 'none';
      }
    }

    // ---- ধাপ ----
    const stepBox = document.getElementById('hd-res-steps');
    if (stepBox) stepBox.innerHTML = steps.map(s => `<li>${s}</li>`).join('');

    // ---- চার্ট ----
    if (this.hinduChart) this.hinduChart.destroy();
    const chartEl = document.getElementById('hd-res-chart');
    if (chartEl && typeof Chart !== 'undefined' && data.length) {
      this.hinduChart = new Chart(chartEl, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: data.map((_, i) => colors[i % colors.length]), borderWidth: 0 }] },
        options: { cutout: '65%', plugins: { legend: { display: false } } }
      });
    }

    ['hd-step-1', 'hd-step-2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.add('done'); el.classList.remove('active'); }
    });
    const s3 = document.getElementById('hd-step-3');
    if (s3) s3.classList.add('active');
  },

  /** হিন্দু উত্তরাধিকার সনদ — A4 প্রিন্ট */
  printHindu() {
    if (!this.hinduLast) { this.calculateHindu(); }
    if (!this.hinduLast) return;

    const { shares, steps, counts, inputs, limitedEstate } = this.hinduLast;
    let container = document.getElementById('print-report-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'print-report-container';
      document.body.appendChild(container);
    }

    const landLabel = this.hinduUnit === 'acre' ? 'জমি (একর)' : 'জমি (শতক)';
    const props = [];
    if (inputs.land > 0) props.push({ id: 'land', label: landLabel, dec: 3 });
    if (inputs.gold > 0) props.push({ id: 'gold', label: 'স্বর্ণ (ভরি)', dec: 3 });
    if (inputs.silver > 0) props.push({ id: 'silver', label: 'রৌপ্য (ভরি)', dec: 3 });
    if (inputs.money > 0) props.push({ id: 'money', label: 'টাকা', dec: 0 });

    let thead = '<tr><th style="width:8%">ক্রমিক</th><th style="width:30%">আত্মীয়</th><th style="width:12%">অংশ</th>';
    props.forEach(p => { thead += `<th>${p.label}</th>`; });
    thead += '</tr>';

    const personCount = k => k.startsWith('deadSon_') ? (this.hinduDyn[k] || 1) : (counts[k] || 1);
    let tbody = '', serial = 1, totalDec = 0;
    const totals = {}; props.forEach(p => totals[p.id] = 0);

    Object.keys(shares).filter(k => shares[k] > 1e-9).forEach(k => {
      const n = personCount(k), per = shares[k] / n;
      const base = HinduLaw.nameFor(k, this.hinduDyn);
      const limited = limitedEstate.includes(k) ? ' (সীমিত স্বত্ব)' : '';
      for (let i = 0; i < n; i++) {
        totalDec += per;
        tbody += `<tr><td>${toBn(serial++)}</td><td class="pr-left">${n > 1 ? `${base} - ${toBn(i + 1)}` : base}${limited}</td>`;
        tbody += `<td>${toBn(per.toFixed(4))}</td>`;
        props.forEach(p => {
          const v = inputs[p.id] * per;
          totals[p.id] += v;
          tbody += `<td>${toBn(v.toFixed(p.dec))}</td>`;
        });
        tbody += '</tr>';
      }
    });

    let tfoot = `<tr><td colspan="2" class="pr-left">সর্বমোট</td><td>${toBn(totalDec.toFixed(4))}</td>`;
    props.forEach(p => { tfoot += `<td>${toBn(totals[p.id].toFixed(p.dec))}</td>`; });
    tfoot += '</tr>';

    let assets = '';
    if (props.length) {
      assets = `<div class="pr-assets"><h3>বণ্টনযোগ্য সম্পদের বিবরণ</h3><div class="pr-assets-grid">` +
        props.map(p => `<span><b>${p.label}:</b> ${toBn(inputs[p.id].toFixed(p.dec))}</span>`).join('') +
        `</div></div>`;
    }

    const dateBn = toBn(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));

    container.innerHTML = `
      <div class="pr-head">
        <h1>উত্তরাধিকার সনদ (হিন্দু)</h1>
        <div class="pr-sub">দায়ভাগ মত ও সম্পত্তিতে হিন্দু মহিলার অধিকার আইন, ১৯৩৭ অনুযায়ী বণ্টন বিবরণী</div>
      </div>
      <div class="pr-meta">
        <div><b>মৃত ব্যক্তির নাম:</b> ${'.'.repeat(30)}</div>
        <div style="text-align:right"><b>তারিখ:</b> ${dateBn}</div>
      </div>
      ${assets}
      <table class="pr-table">
        <thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot>
      </table>
      <div class="pr-steps">
        <h3>হিসাবের ধাপসমূহ</h3>
        <ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>
      </div>
      <div class="pr-note">
        সতর্কীকরণ: বাংলাদেশে হিন্দু উত্তরাধিকার আইন অসংহিতাবদ্ধ ও ব্যাখ্যাসাপেক্ষ।
        "সীমিত স্বত্ব" চিহ্নিত উত্তরাধিকারীগণ জীবনস্বত্ব পান — সাধারণত সম্পত্তি
        হস্তান্তর করতে পারেন না। জটিল ক্ষেত্রে অভিজ্ঞ আইনজীবীর মাধ্যমে চূড়ান্ত করুন।
        এই ফলাফলের আইনগত দায় কর্তৃপক্ষ গ্রহণ করবে না।
      </div>
      <div class="pr-sign">
        <div>প্রস্তুতকারীর স্বাক্ষর</div><div>সাক্ষীর স্বাক্ষর</div><div>তারিখ ও সীলমোহর</div>
      </div>
      <div class="pr-foot">Land Info — ফ্রি ডিজিটাল ভূমি সার্ভিস · উত্তরাধিকার ক্যালকুলেটর</div>
    `;

    window.print();
  },

  /* ========================================================================
     ৫গ. দাগ পোরশন · তফসিল বন্টন · অনুপাত · জমির সূত্র
     গণিত LandMath এ — এখানে শুধু UI।
     ======================================================================== */

  /* ========================================================================
     দলিল রেজিস্ট্রেশন খরচ — গণিত js/dolil-fee.js এর DolilFee এ
     ======================================================================== */

  lastDolil: null,

  /** ড্রপডাউনগুলো একবারই তৈরি হয় */
  initDolilFee() {
    const fill = (id, arr, fn) => {
      const el = document.getElementById(id);
      if (el && !el.options.length) el.innerHTML = arr.map(fn).join('');
    };

    fill('df-deed', DolilFee.DEED_TYPES, d => `<option value="${d.id}">${d.name}</option>`);
    fill('df-district', DolilFee.DISTRICTS, d => `<option value="${d}">${d}</option>`);
    fill('df-land-unit', DolilFee.LAND_UNITS, u => `<option value="${u.id}">${u.name}</option>`);
    fill('df-localtax', DolilFee.LOCAL_TAX,
      x => `<option value="${x.id}">${x.name} — ${toBn(x.pct)}%</option>`);
    fill('df-land-area', DolilFee.LAND_AREAS, (a, i) =>
      `<option value="${a.id}">${toBn(i + 1)}। ${a.name}</option>`);
    fill('df-land-class', DolilFee.LAND_CLASSES, c => `<option value="${c.id}">${c.name}</option>`);
    fill('df-lease-term', DolilFee.LEASE_TERMS,
      t => `<option value="${t.id}">${t.name} — ${toBn(t.pct)}%</option>`);
    fill('df-building-125', DolilFee.BUILDING_125, (b, i) =>
      `<option value="${b.id}">${toBn(i + 1)}। ${b.name} — প্রতি বর্গমিটার ${DolilFee.moneyBn(b.perSqm)} বা ${toBn(b.pct)}%</option>`);
    fill('df-building-126', DolilFee.BUILDING_126, (b, i) =>
      `<option value="${b.id}">${toBn(i + 1)}। ${b.name}</option>`);

    // ডিফল্ট: শেষ এলাকা (উপজেলা) ও চ-শ্রেণি — সবচেয়ে সাধারণ কেস
    const la = document.getElementById('df-land-area');
    if (la && !la.dataset.init) { la.value = 'b2'; la.dataset.init = '1'; }
    const lc = document.getElementById('df-land-class');
    if (lc && !lc.dataset.init) { lc.value = 'cho'; lc.dataset.init = '1'; }

    this.runDolilFee();
  },

  resetDolilFee() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
    set('df-deed', 'saf_kabla'); set('df-lang', 'bn'); set('df-district', 'ঢাকা');
    set('df-pages', 10); set('df-copies', 0);
    set('df-land-qty', 10); set('df-land-unit', 'satak');
    set('df-value', 5000000); set('df-mouza-rate', 0);
    set('df-loan', 0); set('df-consid', 0);
    set('df-localtax', 'union'); set('df-land-area', 'b2'); set('df-land-class', 'cho');
    set('df-building-sqft', 1200); set('df-building-value', 0);
    set('df-building-kind', 'res'); set('df-building-125', 's3'); set('df-building-126', 'd6');
    set('df-vatkind', 'plot'); set('df-lease-term', 'upto5');
    chk('df-dev', false); chk('df-has-building', false);
    chk('df-orig-stamp', false); chk('df-lease-10', false);
    this.runDolilFee();
  },

  /** মৌজা রেট × পরিমাণ → দলিল মূল্য */
  calcFromMouzaRate() {
    const num = id => parseFloat(toEn(document.getElementById(id)?.value || '0')) || 0;
    const satak = DolilFee.toSatak(num('df-land-qty'),
      document.getElementById('df-land-unit')?.value);
    const v = num('df-mouza-rate') * satak;
    const el = document.getElementById('df-value');
    if (el && v > 0) { el.value = Math.round(v); this.runDolilFee(); }
  },

  runDolilFee() {
    const num = id => parseFloat(toEn(document.getElementById(id)?.value || '0')) || 0;
    const val = id => document.getElementById(id)?.value;
    const show = (id, on, disp) => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? (disp || 'flex') : 'none';
    };

    const deed = DolilFee.DEED_TYPES.find(d => d.id === val('df-deed')) || DolilFee.DEED_TYPES[0];
    const isDev = document.getElementById('df-dev')?.checked || false;
    const hasBuilding = document.getElementById('df-has-building')?.checked || false;

    /* ---- শর্তাধীন ইনপুট দেখানো/লুকানো ---- */
    show('df-loan-wrap', deed.valueOf === 'loan');
    show('df-consid-wrap', deed.valueOf === 'consideration');
    show('df-lease-wrap', !!deed.lease, 'block');
    show('df-orig-row', !!deed.copy, 'flex');
    show('df-src125-wrap', !!deed.srcTax125, 'block');
    show('df-vat-wrap', deed.vat && isDev);
    show('df-b126-wrap', deed.srcTax126 && isDev && hasBuilding);
    show('df-building-fields', hasBuilding, 'block');
    show('df-building-panel', deed.srcTax125 || deed.srcTax126, 'block');
    show('df-area-panel', deed.localTax || deed.srcTax125 || deed.vat, 'block');

    const lbl = document.getElementById('df-value-label');
    if (lbl) {
      lbl.textContent = deed.valueOf === 'loan' ? 'সম্পত্তির মূল্য'
        : deed.id === 'ewaj' ? 'সম্পত্তির মূল্য (বৃহত্তর এক পক্ষের মূল্য বাদ দিয়ে)'
          : 'জমির মূল্য';
    }

    const res = DolilFee.calculate({
      deedType: deed.id,
      propertyValue: num('df-value'),
      loanAmount: num('df-loan'),
      considerationValue: num('df-consid'),
      landQty: num('df-land-qty'),
      landUnit: val('df-land-unit'),
      landAreaId: val('df-land-area'),
      landClassId: val('df-land-class'),
      localTaxId: val('df-localtax'),
      district: val('df-district'),
      sellerIsDeveloper: isDev,
      hasBuilding,
      buildingSqft: num('df-building-sqft'),
      buildingValue: num('df-building-value'),
      buildingKind: val('df-building-kind'),
      building125Id: val('df-building-125'),
      building126Id: val('df-building-126'),
      pages: num('df-pages'),
      copies: num('df-copies'),
      language: val('df-lang'),
      leaseTermId: val('df-lease-term'),
      leaseYearsAbove10: document.getElementById('df-lease-10')?.checked || false,
      originalStampUpto1000: document.getElementById('df-orig-stamp')?.checked || false,
      vatKind: val('df-vatkind')
    });
    this.lastDolil = res;

    const note = document.getElementById('df-deed-note');
    if (note) note.textContent = [res.deed.note, res.deed.valueNote].filter(Boolean).join(' ');

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('df-total', DolilFee.moneyBn(res.total) + ' টাকা');
    set('df-overhead', res.baseValue > 0
      ? `মূল্য ${DolilFee.moneyBn(res.baseValue)} টাকার ${toBn(res.overheadPct.toFixed(2))}% · জমি ${toBn(res.landSatak.toFixed(3))} শতক`
      : 'মূল্য দিন');

    const tbody = document.getElementById('df-tbody');
    if (tbody) {
      tbody.innerHTML = res.items.map((it, i) => `
        <tr>
          <td>${toBn(i + 1)}</td>
          <td style="text-align:left;font-weight:600">${it.name}</td>
          <td style="text-align:left;font-size:0.82rem;color:var(--text-muted)">${it.detail}</td>
          <td style="text-align:right;font-weight:700;color:var(--primary)">${DolilFee.moneyBn(it.amount)}</td>
        </tr>`).join('');
    }
    const tfoot = document.getElementById('df-tfoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr style="font-weight:700;background:var(--bg-input)">
          <td colspan="3" style="text-align:left">সর্বমোট</td>
          <td style="text-align:right">${DolilFee.moneyBn(res.total)}</td>
        </tr>`;
    }

    const cards = document.getElementById('df-cards');
    if (cards) {
      cards.innerHTML = res.items.map((it, i) => `
        <div class="fz-res-card">
          <div class="fz-res-card-top">
            <span class="fz-res-name">${toBn(i + 1)}. ${it.name}</span>
            <span class="fz-res-pct">${DolilFee.moneyBn(it.amount)}</span>
          </div>
          ${it.detail ? `<div style="font-size:0.8rem;color:var(--text-muted)">${it.detail}</div>` : ''}
        </div>`).join('') + `
        <div class="fz-res-card" style="background:var(--bg-input);font-weight:700">
          <div class="fz-res-card-top" style="margin-bottom:0;padding-bottom:0;border:none">
            <span class="fz-res-name">সর্বমোট</span>
            <span class="fz-res-pct" style="background:var(--secondary)">${DolilFee.moneyBn(res.total)}</span>
          </div>
        </div>`;
    }

    const w = document.getElementById('df-warn');
    const wt = document.getElementById('df-warn-text');
    if (w && wt) {
      if (res.warnings.length) {
        wt.innerHTML = res.warnings.map(x => `• ${x}`).join('<br>');
        w.style.display = 'flex';
      } else w.style.display = 'none';
    }
  },

  /** খরচের বিবরণী A4 প্রিন্ট */
  printDolilFee() {
    this.runDolilFee();
    if (!this.lastDolil) return;
    const res = this.lastDolil;
    const val = id => document.getElementById(id)?.value || '';

    let container = document.getElementById('print-report-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'print-report-container';
      document.body.appendChild(container);
    }

    const rows = res.items.map((it, i) => `
      <tr><td>${toBn(i + 1)}</td><td class="pr-left">${it.name}</td>
      <td class="pr-left" style="font-size:8.5pt">${it.detail}</td>
      <td style="text-align:right">${DolilFee.moneyBn(it.amount)}</td></tr>`).join('');

    const dateBn = toBn(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
    const S = DolilFee.SOURCE;
    const unitName = (DolilFee.LAND_UNITS.find(u => u.id === val('df-land-unit')) || {}).name || '';

    container.innerHTML = `
      <div class="pr-head">
        <h1>দলিল রেজিস্ট্রেশন খরচের বিবরণী</h1>
        <div class="pr-sub">আনুমানিক হিসাব — ${S.authority}, ${S.date} এর হার অনুযায়ী</div>
      </div>

      <div class="pr-meta">
        <div><b>দলিলের ধরন:</b> ${res.deed.name}</div>
        <div style="text-align:right"><b>তারিখ:</b> ${dateBn}</div>
      </div>

      <div class="pr-assets">
        <h3>দলিলের তথ্য</h3>
        <div class="pr-inline">
          <span><b>মূল্য:</b> ${DolilFee.moneyBn(res.baseValue)} টাকা</span>
          <span><b>জমি:</b> ${toBn(val('df-land-qty'))} ${unitName} (${toBn(res.landSatak.toFixed(3))} শতক)</span>
          <span><b>জেলা:</b> ${val('df-district')}</span>
          <span><b>ভাষা:</b> ${val('df-lang') === 'en' ? 'English' : 'বাংলা'}</span>
          <span><b>পৃষ্ঠা:</b> ${toBn(val('df-pages'))}</span>
          <span><b>মোট খরচ:</b> মূল্যের ${toBn(res.overheadPct.toFixed(2))}%</span>
        </div>
      </div>

      <table class="pr-table">
        <thead><tr><th style="width:8%">ক্রমিক</th><th style="width:26%">খরচের খাত</th>
          <th>হিসাবের ভিত্তি</th><th style="width:18%">টাকা</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="3" class="pr-left">সর্বমোট</td>
          <td style="text-align:right">${DolilFee.moneyBn(res.total)}</td></tr></tfoot>
      </table>

      ${res.warnings.length ? `<div class="pr-note" style="border-style:solid">
        <b>লক্ষণীয়:</b> ${res.warnings.join(' ')}</div>` : ''}

      <div class="pr-note">
        সতর্কীকরণ: এটি একটি <b>আনুমানিক</b> হিসাব, স্বয়ংক্রিয় ক্যালকুলেটর দ্বারা প্রস্তুত।
        হার-সূত্র: ${S.authority} — "${S.title}", ${S.date}।
        সরকার যেকোনো সময় হার পরিবর্তন করতে পারে। প্রকৃত খরচ দলিলের ধরন, এলাকা ও
        স্থানীয় নিয়মভেদে কমবেশি হতে পারে। টাকা জমা দেওয়ার আগে অবশ্যই
        সাব-রেজিস্ট্রি অফিসে যাচাই করে নিন।
      </div>

      <div class="pr-sign">
        <div>ক্রেতার স্বাক্ষর</div><div>দলিল লেখক</div><div>তারিখ ও সীলমোহর</div>
      </div>

      <div class="pr-foot">Land Info — ফ্রি ডিজিটাল ভূমি সার্ভিস · দলিল খরচ ক্যালকুলেটর</div>
    `;
    window.print();
  },
  /* ---------------- দাগ পোরশন ---------------- */
  runDagPortion() {
    const num = id => parseFloat(toEn(document.getElementById(id)?.value || '0')) || 0;
    const res = LandMath.calculateDagPortion(num('dp-total'), num('dp-applied'));

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('dp-res-decimal', res.decimalStr);
    set('dp-res-fraction', res.fractionStr);
    set('dp-res-percent', res.percentStr);
    set('dp-res-ana', res.anaStr);

    const warn = document.getElementById('dp-warn');
    const wt = document.getElementById('dp-warn-text');
    if (warn && wt) {
      if (!res.isValid) {
        wt.textContent = 'দাগের মোট জমি শূন্য — অংশ বের করা যাচ্ছে না।';
        warn.style.display = 'flex';
      } else if (res.isOver) {
        wt.innerHTML = '<b>আবেদিত জমি দাগের মোট জমির চেয়ে বেশি।</b> অংশ ১ এর বেশি হয়ে গেছে — সংখ্যাগুলো যাচাই করুন।';
        warn.style.display = 'flex';
      } else {
        warn.style.display = 'none';
      }
    }
  },

  /* ---------------- তফসিল বন্টন ---------------- */
  lastTofasil: null,

  initTofasilRows() {
    const btn = document.getElementById('tf-add-btn');
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', () => this.addTofasilRow());
      btn.dataset.bound = '1';
    }
    const box = document.getElementById('tf-rows');
    if (box && box.children.length === 0) {
      this.addTofasilRow({ name: 'গ্রহীতা ১', land: 50 });
      this.addTofasilRow({ name: 'গ্রহীতা ২', land: 30 });
      this.addTofasilRow({ name: 'গ্রহীতা ৩', land: 20 });
    }
  },

  addTofasilRow(init = {}) {
    const box = document.getElementById('tf-rows');
    if (!box) return;
    const n = box.children.length + 1;

    const card = document.createElement('div');
    card.className = 'fz-row-card';
    card.innerHTML = `
      <div class="fz-row-card-top">
        <div class="fz-input-wrap">
          <input type="text" class="tf-name" value="${init.name || `গ্রহীতা ${toBn(n)}`}"
                 placeholder="গ্রহীতার নাম" oninput="AppController.runTofasil()">
        </div>
        <button type="button" class="fz-btn-del" title="বাদ দিন"
                onclick="this.closest('.fz-row-card').remove(); AppController.runTofasil();">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      <div class="fz-dead-field">
        <label>প্রাপ্য জমি</label>
        <div class="fz-input-wrap">
          <input type="number" class="tf-land" value="${init.land !== undefined ? init.land : 0}"
                 inputmode="decimal" oninput="AppController.runTofasil()"
                 style="padding:9px 12px;font-size:0.92rem">
          <span class="fz-unit-suffix" style="padding:0 11px">শতক</span>
        </div>
      </div>`;

    box.appendChild(card);
    this.runTofasil();
  },

  tofasilColumns() {
    const on = id => document.getElementById(id)?.checked === true;
    return { ana: on('tf-col-ana'), frac: on('tf-col-frac'), pct: on('tf-col-pct'), katha: on('tf-col-katha') };
  },

  runTofasil() {
    const box = document.getElementById('tf-rows');
    if (!box) return;

    const owners = Array.from(box.children).map(c => ({
      name: c.querySelector('.tf-name')?.value,
      land: parseFloat(toEn(c.querySelector('.tf-land')?.value || '0')) || 0
    }));

    const num = id => parseFloat(toEn(document.getElementById(id)?.value || '0')) || 0;
    const totalInput = num('tf-total');
    const res = LandMath.calculateTofasil(owners, num('tf-target') || 1,
      totalInput > 0 ? totalInput : null);
    this.lastTofasil = res;

    const cols = this.tofasilColumns();

    // টেবিল হেডার
    const thead = document.getElementById('tf-res-thead');
    if (thead) {
      let h = '<tr><th style="width:8%">ক্রমিক</th><th style="text-align:left">গ্রহীতার নাম</th><th>জমি (শতক)</th>';
      if (cols.katha) h += '<th>জমি (কাঠা)</th>';
      h += '<th>নির্ণেয় অংশ</th>';
      if (cols.frac) h += '<th>ভগ্নাংশ</th>';
      if (cols.pct) h += '<th>অংশ (%)</th>';
      if (cols.ana) h += '<th>আনা-গন্ডা</th>';
      thead.innerHTML = h + '</tr>';
    }

    const tbody = document.getElementById('tf-res-tbody');
    if (tbody) {
      tbody.innerHTML = res.results.map(r => {
        let c = `<tr><td>${r.serial}</td><td style="text-align:left"><strong>${r.name}</strong></td>`;
        c += `<td style="font-weight:700;color:var(--primary)">${r.landStr}</td>`;
        if (cols.katha) c += `<td>${r.katha}</td>`;
        c += `<td style="font-weight:700">${r.shareStr}</td>`;
        if (cols.frac) c += `<td style="color:var(--secondary);font-weight:700">${r.fractionStr}</td>`;
        if (cols.pct) c += `<td>${r.sharePercent}</td>`;
        if (cols.ana) c += `<td style="font-size:0.85rem">${r.anaStr}</td>`;
        return c + '</tr>';
      }).join('');
    }

    const tfoot = document.getElementById('tf-res-tfoot');
    if (tfoot) {
      const t = res.totals;
      let f = '<tr style="font-weight:700;background:var(--bg-input)"><td colspan="2" style="text-align:left">সর্বমোট</td>';
      f += `<td>${t.landStr}</td>`;
      if (cols.katha) f += `<td>${t.katha}</td>`;
      f += `<td>${t.shareStr}</td>`;
      if (cols.frac) f += '<td>—</td>';
      if (cols.pct) f += `<td>${t.sharePercent}</td>`;
      if (cols.ana) f += '<td>—</td>';
      tfoot.innerHTML = f + '</tr>';
    }

    // মোবাইল কার্ড
    const cards = document.getElementById('tf-res-cards');
    if (cards) {
      cards.innerHTML = res.results.map(r => {
        const meta = [];
        if (cols.frac) meta.push('ভগ্নাংশ ' + r.fractionStr);
        if (cols.pct) meta.push(r.sharePercent);
        if (cols.ana) meta.push(r.anaStr);
        let items = `<div class="fz-res-item"><span class="lbl">জমি (শতক)</span><span class="val">${r.landStr}</span></div>`;
        if (cols.katha) items += `<div class="fz-res-item"><span class="lbl">জমি (কাঠা)</span><span class="val">${r.katha}</span></div>`;
        return `
          <div class="fz-res-card">
            <div class="fz-res-card-top">
              <span class="fz-res-name">${r.serial}. ${r.name}</span>
              <span class="fz-res-pct">${r.shareStr}</span>
            </div>
            ${meta.length ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${meta.join(' &nbsp;·&nbsp; ')}</div>` : ''}
            <div class="fz-res-grid">${items}</div>
          </div>`;
      }).join('') + `
        <div class="fz-res-card" style="background:var(--bg-input);font-weight:700">
          <div class="fz-res-card-top" style="margin-bottom:0;padding-bottom:0;border:none">
            <span class="fz-res-name">সর্বমোট</span>
            <span class="fz-res-pct" style="background:${res.isExact ? 'var(--secondary)' : 'var(--accent)'}">${res.totals.shareStr}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">
            ${res.totals.landStr} শতক · ${res.totals.sharePercent}
          </div>
        </div>`;
    }

    const badge = document.getElementById('tf-sum-badge');
    if (badge) {
      badge.textContent = `মোট ${res.totals.shareStr}`;
      badge.classList.toggle('ok', res.isExact);
      badge.classList.toggle('bad', !res.isExact);
      if (!res.isExact && res.leftover > 1e-9) {
        badge.textContent = `মোট ${res.totals.shareStr} · বাকি ${toBn(res.leftover.toFixed(4))} শতক`;
      }
    }
  },

  printTofasil() {
    this.runTofasil();
    if (!this.lastTofasil) return;
    const res = this.lastTofasil;
    const cols = this.tofasilColumns();
    const b = LandMath.kathaBasis();

    let container = document.getElementById('print-report-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'print-report-container';
      document.body.appendChild(container);
    }

    let thead = '<tr><th style="width:8%">ক্রমিক</th><th style="width:28%">গ্রহীতার নাম</th><th>জমি (শতক)</th>';
    if (cols.katha) thead += '<th>জমি (কাঠা)</th>';
    thead += '<th>নির্ণেয় অংশ</th>';
    if (cols.frac) thead += '<th>ভগ্নাংশ</th>';
    if (cols.pct) thead += '<th>অংশ (%)</th>';
    if (cols.ana) thead += '<th>আনা-গন্ডা</th>';
    thead += '</tr>';

    const tbody = res.results.map(r => {
      let c = `<tr><td>${r.serial}</td><td class="pr-left">${r.name}</td><td>${r.landStr}</td>`;
      if (cols.katha) c += `<td>${r.katha}</td>`;
      c += `<td>${r.shareStr}</td>`;
      if (cols.frac) c += `<td>${r.fractionStr}</td>`;
      if (cols.pct) c += `<td>${r.sharePercent}</td>`;
      if (cols.ana) c += `<td style="font-size:8pt">${r.anaStr}</td>`;
      return c + '</tr>';
    }).join('');

    const t = res.totals;
    let tfoot = '<tr><td colspan="2" class="pr-left">সর্বমোট</td><td>' + t.landStr + '</td>';
    if (cols.katha) tfoot += `<td>${t.katha}</td>`;
    tfoot += `<td>${t.shareStr}</td>`;
    if (cols.frac) tfoot += '<td>—</td>';
    if (cols.pct) tfoot += `<td>${t.sharePercent}</td>`;
    if (cols.ana) tfoot += '<td>—</td>';
    tfoot += '</tr>';

    const dateBn = toBn(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));

    container.innerHTML = `
      <div class="pr-head">
        <h1>তফসিল বন্টননামা</h1>
        <div class="pr-sub">নামজারির আবেদনে গ্রহীতাদের প্রাপ্য জমি ও নির্ণেয় অংশ</div>
      </div>
      <div class="pr-meta">
        <div><b>মৌজা / খতিয়ান নং:</b> ${'.'.repeat(28)}</div>
        <div style="text-align:right"><b>তারিখ:</b> ${dateBn}</div>
      </div>
      <div class="pr-assets">
        <h3>জমি ও এককের বিবরণ</h3>
        <div class="pr-assets-grid">
          <span><b>মোট জমি:</b> ${toBn(res.base.toFixed(4))} শতক</span>
          <span><b>টার্গেট অংশ:</b> ${toBn(res.target.toFixed(4))}</span>
          <span><b>গ্রহীতা সংখ্যা:</b> ${toBn(res.results.length)} জন</span>
          <span><b>১ কাঠা:</b> ${toBn(b.satakPerKatha.toFixed(4))} শতক</span>
        </div>
      </div>
      <table class="pr-table"><thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot></table>
      ${res.isExact ? '' : `<div class="pr-note" style="border-style:solid">
        <b>সতর্কতা:</b> গ্রহীতাদের জমির যোগফল ${t.landStr} শতক — মোট জমি
        ${toBn(res.base.toFixed(4))} শতকের সমান নয়। পার্থক্য
        ${toBn(res.leftover.toFixed(4))} শতক।</div>`}
      <div class="pr-note">
        সতর্কীকরণ: এই বন্টননামা একটি স্বয়ংক্রিয় ক্যালকুলেটর দ্বারা প্রস্তুত।
        মূল দলিল ও খতিয়ানের সাথে মিলিয়ে যাচাই করে নিন।
      </div>
      <div class="pr-sign">
        <div>প্রস্তুতকারীর স্বাক্ষর</div><div>দলিল লেখক</div><div>তারিখ ও সীলমোহর</div>
      </div>
      <div class="pr-foot">Land Info — ফ্রি ডিজিটাল ভূমি সার্ভিস · তফসিল বন্টন ক্যালকুলেটর</div>
    `;
    window.print();
  },

  /* ---------------- অনুপাত ক্যালকুলেটর ---------------- */
  initRatioRows() {
    const btn = document.getElementById('rt-add-btn');
    if (btn && !btn.dataset.bound) {
      btn.addEventListener('click', () => this.addRatioRow());
      btn.dataset.bound = '1';
    }
    const box = document.getElementById('rt-rows');
    if (box && box.children.length === 0) {
      this.addRatioRow(2); this.addRatioRow(1); this.addRatioRow(1);
    }
  },

  addRatioRow(val = 0) {
    const box = document.getElementById('rt-rows');
    if (!box) return;
    const n = box.children.length + 1;

    const card = document.createElement('div');
    card.className = 'fz-row-card';
    card.style.padding = '10px 12px';
    card.innerHTML = `
      <div class="fz-row-card-top" style="margin-bottom:0">
        <span style="font-size:0.85rem;font-weight:700;color:var(--text-muted);min-width:26px">${toBn(n)}.</span>
        <div class="fz-input-wrap">
          <input type="number" class="rt-val" value="${val}" inputmode="decimal"
                 placeholder="পরিমাণ" oninput="AppController.runRatio()">
        </div>
        <button type="button" class="fz-btn-del" title="বাদ দিন"
                onclick="this.closest('.fz-row-card').remove(); AppController.renumberRatioRows(); AppController.runRatio();">
          <i class="bi bi-trash"></i>
        </button>
      </div>`;
    box.appendChild(card);
    this.runRatio();
  },

  renumberRatioRows() {
    const box = document.getElementById('rt-rows');
    if (!box) return;
    Array.from(box.children).forEach((c, i) => {
      const s = c.querySelector('span');
      if (s) s.textContent = toBn(i + 1) + '.';
    });
  },

  runRatio() {
    const box = document.getElementById('rt-rows');
    if (!box) return;
    const vals = Array.from(box.children)
      .map(c => parseFloat(toEn(c.querySelector('.rt-val')?.value || '0')) || 0);

    const target = parseFloat(toEn(document.getElementById('rt-target')?.value || '0')) || 0;
    const res = LandMath.calculateRatio(vals, target > 0 ? target : null);

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rt-simple', res.simpleRatio);
    set('rt-sum-line', `প্রদত্ত মোট ${res.sumStr} · চাহিত মোট ${res.targetStr}`);

    const tbody = document.getElementById('rt-res-tbody');
    if (tbody) {
      tbody.innerHTML = res.results.map(r => `
        <tr>
          <td>${r.serial}</td>
          <td>${r.inputStr}</td>
          <td style="font-weight:700">${r.ratioStr}</td>
          <td>${r.percentStr}</td>
          <td style="font-weight:700;color:var(--primary)">${r.resultStr}</td>
        </tr>`).join('');
    }
    const tfoot = document.getElementById('rt-res-tfoot');
    if (tfoot) {
      tfoot.innerHTML = `
        <tr style="font-weight:700;background:var(--bg-input)">
          <td colspan="2">সর্বমোট</td><td>১.০০০০০০</td><td>১০০.০০০%</td><td>${res.targetStr}</td>
        </tr>`;
    }

    const cards = document.getElementById('rt-res-cards');
    if (cards) {
      cards.innerHTML = res.results.map(r => `
        <div class="fz-res-card">
          <div class="fz-res-card-top">
            <span class="fz-res-name">${r.serial}. পরিমাণ ${r.inputStr}</span>
            <span class="fz-res-pct">${r.resultStr}</span>
          </div>
          <div class="fz-res-grid">
            <div class="fz-res-item"><span class="lbl">অনুপাত</span><span class="val">${r.ratioStr}</span></div>
            <div class="fz-res-item"><span class="lbl">শতকরা</span><span class="val">${r.percentStr}</span></div>
          </div>
        </div>`).join('');
    }
  },

  runExpression() {
    const el = document.getElementById('rt-expr');
    const out = document.getElementById('rt-expr-res');
    if (!el || !out) return;
    const r = LandMath.evalExpression(el.value);
    out.textContent = r.ok ? toBn(String(Math.round(r.value * 1e6) / 1e6)) : (r.error || '০');
    out.style.fontSize = r.ok ? '' : '1rem';
  },

  /* ---------------- জমির সকল সূত্র ---------------- */
  renderLandFormula() {
    const box = document.getElementById('lf-content');
    if (!box) return;

    // কাঠার সেটিং বদলালে সূত্রপাতাও নতুন করে আঁকতে হয় (একক অংশে মান বদলায়),
    // তাই বর্তমান ভিত্তিটা মনে রেখে কেবল বদলালেই পুনরায় তৈরি করি
    const basis = LandMath.kathaBasis();
    const sig = `${basis.mode}:${basis.satakPerKatha}`;
    if (box.dataset.sig === sig) return;

    box.innerHTML = LandFormula.render(basis);
    box.dataset.sig = sig;
    this.showKathaNotes();
  },

  /**
   * সূত্র ক্লিপবোর্ডে কপি করে ও উপরে ছোট একটা টোস্ট দেখায়।
   * clipboard API না থাকলে (বা http ছাড়া) পুরনো execCommand পদ্ধতিতে যায়।
   */
  copyFormula(text) {
    const done = () => this.showToast('সূত্র কপি করা হয়েছে!');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this._copyFallback(text, done));
    } else {
      this._copyFallback(text, done);
    }
  },

  _copyFallback(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { window.prompt('কপি করুন:', text); }
    document.body.removeChild(ta);
  },

  /** উপরে ভাসমান ছোট বার্তা (index.html এর #copy-toast) */
  showToast(msg) {
    const t = document.getElementById('copy-toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 1800);
  },

  /* ------------------------------------------------------------------------
     6. Other Tool Handlers
     ------------------------------------------------------------------------ */
  /* ---------------- N-বাহু জমি পরিমাপ ---------------- */

  // বাহুর ডিফল্ট মাপ (প্রথমবার ইনপুট তৈরির সময়)
  DEFAULT_SIDES: [100, 80, 100, 80, 90, 70, 80, 75, 85, 65, 90, 70],

  sideCount() {
    return Math.max(3, Math.min(12,
      parseInt(toEn(document.getElementById('cm-side-count')?.value || '4')) || 4));
  },

  setSideCount(n) {
    const el = document.getElementById('cm-side-count');
    if (el) el.value = n;
    this.rebuildSideInputs();
  },

  changeSideCount(delta) {
    this.setSideCount(Math.max(3, Math.min(12, this.sideCount() + delta)));
  },

  /**
   * বাহু ও কর্ণের ইনপুট বক্সগুলো নতুন করে তৈরি করে।
   * আগের মান থাকলে ধরে রাখে, নতুন ঘরে ডিফল্ট বসায়।
   */
  rebuildSideInputs() {
    const n = this.sideCount();
    const sideBox = document.getElementById('cm-sides');
    const diagBox = document.getElementById('cm-diags');
    if (!sideBox || !diagBox) return;

    const oldSides = Array.from(sideBox.querySelectorAll('.cm-side')).map(i => i.value);
    const oldDiags = Array.from(diagBox.querySelectorAll('.cm-diag')).map(i => i.value);

    const field = (cls, id, label, val) => `
      <div class="fz-dead-field">
        <label>${label}</label>
        <div class="fz-input-wrap">
          <input type="number" class="${cls}" id="${id}" value="${val}" inputmode="decimal"
                 oninput="AppController.updateCanvasFromInputs()"
                 style="padding:9px 11px;font-size:0.92rem">
          <span class="fz-unit-suffix" style="padding:0 9px">ফুট</span>
        </div>
      </div>`;

    let sh = '';
    for (let i = 0; i < n; i++) {
      const v = oldSides[i] !== undefined ? oldSides[i] : (this.DEFAULT_SIDES[i] || 80);
      sh += field('cm-side', `cm-side-${i}`, `বাহু ${toBn(i + 1)} (কোণা ${toBn(i + 1)} → ${toBn(i + 2 > n ? 1 : i + 2)})`, v);
    }
    sideBox.innerHTML = sh;

    // N বাহুর জন্য (N−৩) কর্ণ; কর্ণ i হলো কোণা ১ → কোণা (i+2)
    const dCount = Math.max(0, n - 3);
    let dh = '';
    for (let i = 0; i < dCount; i++) {
      let v = oldDiags[i];
      if (v === undefined) {
        // অনুমান: দুই পাশের বাহুর যোগফলের ৭০% — সাধারণত ত্রিভুজ অসমতা মানে
        const a = parseFloat(oldSides[0] ?? this.DEFAULT_SIDES[0]) || 100;
        const b = parseFloat(oldSides[i + 1] ?? this.DEFAULT_SIDES[i + 1]) || 80;
        v = Math.round(Math.hypot(a, b));
      }
      dh += field('cm-diag', `cm-diag-${i}`, `কর্ণ ${toBn(i + 1)} (কোণা ১ → ${toBn(i + 3)})`, v);
    }
    diagBox.innerHTML = dh;

    // ৩ বাহুতে কর্ণ লাগে না; গড় পদ্ধতি কেবল চতুর্ভুজে
    const dp = document.getElementById('cm-diag-panel');
    if (dp) dp.style.display = dCount > 0 ? '' : 'none';
    const avgRow = document.getElementById('cm-avg-row');
    if (avgRow) avgRow.style.display = (n === 4) ? '' : 'none';

    // সেগমেন্টেড বোতামের অবস্থা
    document.querySelectorAll('#view-canvas-measure .fz-seg-btn').forEach(b => {
      b.classList.toggle('active', b.textContent.includes(`(${toBn(n)})`));
    });

    this.updateCanvasFromInputs();
  },

  updateCanvasFromInputs() {
    if (!this.canvasEngine) return;

    const sides = Array.from(document.querySelectorAll('#cm-sides .cm-side'))
      .map(i => parseFloat(toEn(i.value)) || 0);
    const diags = Array.from(document.querySelectorAll('#cm-diags .cm-diag'))
      .map(i => parseFloat(toEn(i.value)) || 0);
    if (!sides.length) return;

    const useAvg = document.getElementById('cm-avg')?.checked && sides.length === 4;
    const res = this.canvasEngine.setPolygonInputs(sides, diags, useAvg);

    const box = document.getElementById('cm-error');
    const txt = document.getElementById('cm-error-text');
    if (box && txt) {
      if (!res.ok) {
        txt.innerHTML = `<b>আকৃতি তৈরি করা যাচ্ছে না।</b> ${res.error}`;
        box.style.display = 'flex';
      } else if (res.method === 'average') {
        txt.innerHTML = `<b>গড় পদ্ধতিতে আনুমানিক হিসাব হচ্ছে।</b>
          জমি ঠিক আয়তাকার না হলে এই ফল ভুল আসতে পারে। নির্ভুল ফলের জন্য
          একটি কর্ণ মেপে উপরের ঘরে লিখুন ও এই টিক তুলে দিন।`;
        box.style.display = 'flex';
      } else {
        box.style.display = 'none';
      }
    }
  },

  updateCanvasAreaUI(sqft) {
    const converted = LandMath.convertArea(sqft, 'sqft');
    const satakEl = document.getElementById('res-canvas-satak');
    const sqftEl = document.getElementById('res-canvas-sqft');
    const kathaEl = document.getElementById('res-canvas-katha');

    if (satakEl) satakEl.innerText = toBn(converted.satak);
    if (sqftEl) sqftEl.innerText = toBn(converted.sqft);
    if (kathaEl) kathaEl.innerText = toBn(converted.katha);
  },

  /**
   * সংখ্যা ইনপুটে +/- বোতামের সাধারণ হেল্পার — সব টুলে ব্যবহারযোগ্য।
   * মান min…max এর মধ্যে আটকে রাখে এবং ইনপুট ইভেন্ট ছোঁড়ে যাতে
   * সংশ্লিষ্ট ক্যালকুলেটর আপনাআপনি চলে।
   */
  stepField(id, delta, min, max) {
    const el = document.getElementById(id);
    if (!el) return;
    let v = (parseFloat(toEn(el.value)) || 0) + delta;
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },

  /** হিস্যার ধরন বদলায় (সেগমেন্টেড বোতাম) */
  setHissaType(type) {
    const hidden = document.getElementById('hc-hissa-type');
    if (hidden) hidden.value = type;
    document.querySelectorAll('.fz-seg-btn[data-hc]').forEach(b => {
      b.classList.toggle('active', b.dataset.hc === type);
    });
    this.runHissaCalc();
  },

  runHissaCalc() {
    const totalLand = parseFloat(toEn(document.getElementById('hc-total-land')?.value || '0')) || 0;
    const totalUnit = document.getElementById('hc-total-unit')?.value || 'satak';
    const type = document.getElementById('hc-hissa-type')?.value || 'anagonda';

    document.getElementById('hc-panel-anagonda').style.display = (type === 'anagonda') ? 'grid' : 'none';
    document.getElementById('hc-panel-percent').style.display = (type === 'percent') ? 'flex' : 'none';
    document.getElementById('hc-panel-decimal').style.display = (type === 'decimal') ? 'flex' : 'none';
    document.getElementById('hc-panel-fraction').style.display = (type === 'fraction') ? 'grid' : 'none';

    const data = {
      ana: parseFloat(toEn(document.getElementById('hc-ana')?.value || '0')) || 0,
      gonda: parseFloat(toEn(document.getElementById('hc-gonda')?.value || '0')) || 0,
      kora: parseFloat(toEn(document.getElementById('hc-kora')?.value || '0')) || 0,
      kranti: parseFloat(toEn(document.getElementById('hc-kranti')?.value || '0')) || 0,
      til: parseFloat(toEn(document.getElementById('hc-til')?.value || '0')) || 0,
      percent: parseFloat(toEn(document.getElementById('hc-percent')?.value || '0')) || 0,
      decimal: parseFloat(toEn(document.getElementById('hc-decimal')?.value || '0')) || 0,
      num: parseFloat(toEn(document.getElementById('hc-num')?.value || '0')) || 0,
      den: parseFloat(toEn(document.getElementById('hc-den')?.value || '1')) || 1
    };

    const res = LandMath.calculateHissaShare(totalLand, totalUnit, type, data);

    // অংশ দশমিক ও ভগ্নাংশ আকারেও দেখাই
    const frac = LandMath.hissaToFraction(type, data);
    const dEl = document.getElementById('hc-res-decimal');
    if (dEl) dEl.innerText = toBn(frac.toFixed(4));
    const fEl = document.getElementById('hc-res-fraction');
    if (fEl) fEl.innerText = LandMath.toFractionBn(frac) || '—';

    document.getElementById('hc-res-percent').innerText = res.fractionPercent;
    document.getElementById('hc-res-anagonda').innerText = res.anaGondaStr;
    document.getElementById('hc-res-satak').innerText = res.satak;
    document.getElementById('hc-res-katha').innerText = res.katha;
    document.getElementById('hc-res-bigha').innerText = res.bigha;
    document.getElementById('hc-res-sqft').innerText = res.sqft;
    // বর্গগজ আগে কখনো হালনাগাদ হতো না — স্থির প্লেসহোল্ডার দেখাত
    document.getElementById('hc-res-sqyard').innerText = res.sqyard;
    document.getElementById('hc-res-ajutangsha').innerText = res.ajutangsha;
  },

  runAnaGondaCalc() {
    const ana = parseFloat(toEn(document.getElementById('ag-ana')?.value || '0')) || 0;
    const gonda = parseFloat(toEn(document.getElementById('ag-gonda')?.value || '0')) || 0;
    const kora = parseFloat(toEn(document.getElementById('ag-kora')?.value || '0')) || 0;
    const kranti = parseFloat(toEn(document.getElementById('ag-kranti')?.value || '0')) || 0;
    const til = parseFloat(toEn(document.getElementById('ag-til')?.value || '0')) || 0;

    const frac = LandMath.anaGondaToFraction(ana, gonda, kora, kranti, til);
    const totalLandSatak = parseFloat(toEn(document.getElementById('ag-total-land')?.value || '100')) || 100;

    const ownerSatak = totalLandSatak * frac;
    const converted = LandMath.convertArea(ownerSatak, 'satak');

    document.getElementById('ag-res-frac').innerText = toBn((frac * 100).toFixed(3)) + '%';
    const agD = document.getElementById('ag-res-decimal');
    if (agD) agD.innerText = toBn(frac.toFixed(4));
    const agF = document.getElementById('ag-res-fraction');
    if (agF) agF.innerText = LandMath.toFractionBn(frac) || '—';
    document.getElementById('ag-res-satak').innerText = toBn(converted.satak);
    document.getElementById('ag-res-sqft').innerText = toBn(converted.sqft);
    document.getElementById('ag-res-katha').innerText = toBn(converted.katha);
  },

  initKhotianDynamicRows() {
    const addBtn = document.getElementById('khotian-add-row-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.addKhotianRow());

    // প্রথম মালিক (৮ আনা = অর্ধেক) দিয়ে শুরু
    const box = document.getElementById('khotian-rows-tbody');
    if (box && box.children.length === 0) this.addKhotianRow({ fraction: 0.5 });
  },

  // খতিয়ানে হিস্যা কোন ধরনে লেখা হবে (ডিফল্ট দশমিক)
  khotianType: 'decimal',
  lastKhotian: null,

  /**
   * হিস্যার ধরন বদলায়। মালিকদের বর্তমান হিস্যা ভগ্নাংশে বের করে
   * নতুন ধরনের সমতুল্য মানে বসিয়ে দেয় — তাই ধরন বদলালেও হিসাব একই থাকে।
   */
  setKhotianType(type) {
    const box = document.getElementById('khotian-rows-tbody');
    const keep = [];
    if (box) {
      Array.from(box.children).forEach(card => {
        keep.push({
          name: card.querySelector('.kh-name')?.value || '',
          fraction: this.readKhotianFraction(card)
        });
      });
    }

    this.khotianType = type;
    document.querySelectorAll('.fz-seg-btn[data-kht]').forEach(b => {
      b.classList.toggle('active', b.dataset.kht === type);
    });

    if (box) {
      box.innerHTML = '';
      keep.forEach(o => this.addKhotianRow(o));
      if (!keep.length) this.addKhotianRow({ fraction: 0.5 });
    }
    this.runKhotianCalc();
  },

  /** একটি মালিক-কার্ড থেকে বর্তমান ধরন অনুযায়ী ভগ্নাংশ পড়ে */
  readKhotianFraction(card) {
    const num = sel => parseFloat(toEn(card.querySelector(sel)?.value || '0')) || 0;
    const t = card.dataset.type || 'anagonda';
    return LandMath.hissaToFraction(t, {
      ana: num('.kh-ana'), gonda: num('.kh-gonda'), kora: num('.kh-kora'),
      kranti: num('.kh-kranti'), til: num('.kh-til'),
      percent: num('.kh-percent'), decimal: num('.kh-decimal'),
      num: num('.kh-num'), den: num('.kh-den')
    });
  },

  /**
   * একজন মালিকের কার্ড যোগ করে। মোবাইল ও ডেস্কটপ দুটোতেই কার্ড —
   * খতিয়ানে অনেকগুলো সংখ্যা-ফিল্ড টেবিলে ছোট পর্দায় ধরে না।
   *
   * @param {object} init  { name, fraction } — ভগ্নাংশ দিলে বর্তমান ধরনের
   *                       সমতুল্য মান বসানো হয়
   */
  addKhotianRow(init = {}) {
    const box = document.getElementById('khotian-rows-tbody');
    if (!box) return;
    const n = box.children.length + 1;
    const uid = `kh${Date.now()}${n}${Math.floor(performance.now())}`;
    const type = this.khotianType;
    const f = init.fraction || 0;

    const counter = (cls, label, val, max) => `
      <div class="fz-dead-field">
        <label>${label}</label>
        <div class="fz-mini-counter">
          <button type="button" onclick="AppController.stepField('${uid}-${cls}',-1,0,${max})">&minus;</button>
          <input type="number" id="${uid}-${cls}" class="${cls}" value="${val}" min="0" max="${max}"
                 inputmode="numeric" oninput="AppController.runKhotianCalc()">
          <button type="button" onclick="AppController.stepField('${uid}-${cls}',1,0,${max})">+</button>
        </div>
      </div>`;

    const plain = (cls, label, val, step, suffix) => `
      <div class="fz-dead-field">
        <label>${label}</label>
        <div class="fz-input-wrap">
          <input type="number" ${step ? `step="${step}"` : ''} class="${cls}" value="${val}"
                 inputmode="decimal" oninput="AppController.runKhotianCalc()"
                 style="padding:8px 11px;font-size:0.9rem">
          ${suffix ? `<span class="fz-unit-suffix" style="padding:0 10px">${suffix}</span>` : ''}
        </div>
      </div>`;

    let fields = '';
    if (type === 'anagonda') {
      const ag = LandMath.fractionToAnaGonda(f);
      fields = `<div class="fz-ag-grid">
        ${counter('kh-ana', 'আনা', ag.ana, 16)}
        ${counter('kh-gonda', 'গন্ডা', ag.gonda, 20)}
        ${counter('kh-kora', 'কড়া', ag.kora, 4)}
        ${counter('kh-kranti', 'ক্রান্তি', ag.kranti, 3)}
        ${counter('kh-til', 'তিল', ag.til, 20)}
      </div>`;
    } else if (type === 'percent') {
      fields = `<div class="fz-ag-grid">${plain('kh-percent', 'শতকরা হিস্যা', (f * 100).toFixed(4).replace(/\.?0+$/, ''), '0.0001', '%')}</div>`;
    } else if (type === 'decimal') {
      fields = `<div class="fz-ag-grid">${plain('kh-decimal', 'দশমিক হিস্যা', f.toFixed(6).replace(/\.?0+$/, ''), '0.000001', '')}</div>`;
    } else {
      const fp = LandMath.toFractionParts(f);
      fields = `<div class="fz-ag-grid">
        ${plain('kh-num', 'লব (উপরে)', fp.n, '1', '')}
        ${plain('kh-den', 'হর (নিচে)', fp.d, '1', '')}
      </div>`;
    }

    const card = document.createElement('div');
    card.className = 'fz-row-card';
    card.dataset.type = type;
    card.innerHTML = `
      <div class="fz-row-card-top">
        <div class="fz-input-wrap">
          <input type="text" class="kh-name" value="${init.name || `মালিক ${toBn(n)}`}"
                 placeholder="মালিকের নাম" oninput="AppController.runKhotianCalc()">
        </div>
        <button type="button" class="fz-btn-del" title="বাদ দিন"
                onclick="this.closest('.fz-row-card').remove(); AppController.runKhotianCalc();">
          <i class="bi bi-trash"></i>
        </button>
      </div>
      ${fields}`;

    box.appendChild(card);
    this.runKhotianCalc();
  },

  /** কোন কলামগুলো দেখানো হবে — চেকবক্স থেকে পড়ে */
  khotianColumns() {
    const on = id => document.getElementById(id)?.checked !== false;
    return {
      ana: on('kh-col-ana'),
      frac: on('kh-col-frac'),
      pct: on('kh-col-pct'),
      katha: on('kh-col-katha'),
      sqft: on('kh-col-sqft')
    };
  },

  /**
   * খতিয়ান বিবরণী A4 কাগজে প্রিন্ট করে।
   * টেবিলে যেসব কলাম দেখানো আছে, প্রিন্টেও সেগুলোই যায়।
   */
  printKhotian() {
    this.runKhotianCalc();
    if (!this.lastKhotian) return;

    const { res, totalLand } = this.lastKhotian;
    const cols = this.khotianColumns();
    const b = LandMath.kathaBasis();

    let container = document.getElementById('print-report-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'print-report-container';
      document.body.appendChild(container);
    }

    let thead = '<tr><th style="width:8%">ক্রমিক</th><th style="width:26%">মালিকের নাম</th>';
    if (cols.ana) thead += '<th>হিস্যা (আনা-গন্ডা)</th>';
    if (cols.frac) thead += '<th>ভগ্নাংশ</th>';
    thead += '<th>অংশ (দশমিক)</th>';
    if (cols.pct) thead += '<th>অংশ (%)</th>';
    thead += '<th>জমি (শতক)</th>';
    if (cols.katha) thead += '<th>জমি (কাঠা)</th>';
    if (cols.sqft) thead += '<th>বর্গফুট</th>';
    thead += '</tr>';

    const tbody = res.results.map(row => {
      let c = `<tr><td>${row.serial}</td><td class="pr-left">${row.name}</td>`;
      if (cols.ana) c += `<td>${row.anaStr}</td>`;
      if (cols.frac) c += `<td>${row.fractionStr}</td>`;
      c += `<td>${row.decimalStr}</td>`;
      if (cols.pct) c += `<td>${row.fractionPercent}</td>`;
      c += `<td>${row.satak}</td>`;
      if (cols.katha) c += `<td>${row.katha}</td>`;
      if (cols.sqft) c += `<td>${row.sqft}</td>`;
      return c + '</tr>';
    }).join('');

    const t = res.totals;
    let tfoot = '<tr><td colspan="2" class="pr-left">সর্বমোট</td>';
    if (cols.ana) tfoot += `<td>${t.anaStr}</td>`;
    if (cols.frac) tfoot += '<td>—</td>';
    tfoot += `<td>${t.decimalStr}</td>`;
    if (cols.pct) tfoot += `<td>${t.percentStr}</td>`;
    tfoot += `<td>${t.satak}</td>`;
    if (cols.katha) tfoot += `<td>${t.katha}</td>`;
    if (cols.sqft) tfoot += `<td>${t.sqft}</td>`;
    tfoot += '</tr>';

    const dateBn = toBn(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));
    const warnLine = res.isExact ? '' :
      `<div class="pr-note" style="border-style:solid">
         <b>সতর্কতা:</b> মালিকদের হিস্যার যোগফল ${t.decimalStr} (${t.percentStr}) —
         পূর্ণ ১৬ আনা (১.০০০০) নয়। খতিয়ানে কোনো মালিক বাদ পড়েছে কি না যাচাই করুন।
       </div>`;

    container.innerHTML = `
      <div class="pr-head">
        <h1>খতিয়ান মালিকানা হিস্যা বিবরণী</h1>
        <div class="pr-sub">মালিকদের হিস্যা অনুযায়ী জমির পরিমাণ নির্ণয়</div>
      </div>

      <div class="pr-meta">
        <div><b>মৌজা / খতিয়ান নং:</b> ${'.'.repeat(28)}</div>
        <div style="text-align:right"><b>তারিখ:</b> ${dateBn}</div>
      </div>

      <div class="pr-assets">
        <h3>জমি ও এককের বিবরণ</h3>
        <div class="pr-assets-grid">
          <span><b>খতিয়ানের মোট জমি:</b> ${toBn(Number(totalLand).toFixed(3))} শতক</span>
          <span><b>১ কাঠা:</b> ${toBn(b.satakPerKatha.toFixed(4))} শতক</span>
          <span><b>১ বিঘা:</b> ${toBn(b.satakPerBigha.toFixed(4))} শতক</span>
          <span><b>মালিক সংখ্যা:</b> ${toBn(res.results.length)} জন</span>
        </div>
      </div>

      <table class="pr-table">
        <thead>${thead}</thead><tbody>${tbody}</tbody><tfoot>${tfoot}</tfoot>
      </table>

      ${warnLine}

      <div class="pr-note">
        সতর্কীকরণ: এই বিবরণী একটি স্বয়ংক্রিয় ক্যালকুলেটর দ্বারা প্রস্তুত।
        মূল খতিয়ান ও দলিলের সাথে মিলিয়ে যাচাই করে নিন। জটিল ক্ষেত্রে অভিজ্ঞ
        আমিন বা আইনজীবীর মাধ্যমে চূড়ান্ত করুন। এই ফলাফলের আইনগত দায়
        কর্তৃপক্ষ গ্রহণ করবে না।
      </div>

      <div class="pr-sign">
        <div>প্রস্তুতকারীর স্বাক্ষর</div><div>আমিন / সার্ভেয়ার</div><div>তারিখ ও সীলমোহর</div>
      </div>

      <div class="pr-foot">Land Info — ফ্রি ডিজিটাল ভূমি সার্ভিস · খতিয়ান ক্যালকুলেটর</div>
    `;

    window.print();
  },

  runKhotianCalc() {
    const totalLand = parseFloat(toEn(document.getElementById('khotian-total-land')?.value || '100')) || 100;
    const box = document.getElementById('khotian-rows-tbody');
    if (!box) return;

    const owners = [];
    Array.from(box.children).forEach(card => {
      const num = sel => parseFloat(toEn(card.querySelector(sel)?.value || '0')) || 0;
      owners.push({
        name: card.querySelector('.kh-name')?.value,
        type: card.dataset.type || 'anagonda',
        ana: num('.kh-ana'), gonda: num('.kh-gonda'), kora: num('.kh-kora'),
        kranti: num('.kh-kranti'), til: num('.kh-til'),
        percent: num('.kh-percent'), decimal: num('.kh-decimal'),
        num: num('.kh-num'), den: num('.kh-den')
      });
    });

    const res = LandMath.calculateKhotian(totalLand, owners);
    this.lastKhotian = { res, totalLand };

    const cols = this.khotianColumns();

    // ডেস্কটপ টেবিল — কেবল টিক দেওয়া কলামগুলো
    const thead = document.getElementById('khotian-res-thead');
    if (thead) {
      let h = '<tr><th style="width:7%">ক্রমিক</th><th style="text-align:left">মালিকের নাম</th>';
      if (cols.ana) h += '<th>হিস্যা (আনা-গন্ডা)</th>';
      if (cols.frac) h += '<th>ভগ্নাংশ</th>';
      h += '<th>অংশ (দশমিক)</th>';
      if (cols.pct) h += '<th>অংশ (%)</th>';
      h += '<th>জমি (শতক)</th>';
      if (cols.katha) h += '<th>জমি (কাঠা)</th>';
      if (cols.sqft) h += '<th>বর্গফুট</th>';
      thead.innerHTML = h + '</tr>';
    }

    const resTbody = document.getElementById('khotian-res-tbody');
    if (resTbody) {
      resTbody.innerHTML = res.results.map(row => {
        let c = `<tr><td>${row.serial}</td><td style="text-align:left"><strong>${row.name}</strong></td>`;
        if (cols.ana) c += `<td>${row.anaStr}</td>`;
        if (cols.frac) c += `<td style="font-weight:700;color:var(--secondary)">${row.fractionStr}</td>`;
        c += `<td style="font-weight:700">${row.decimalStr}</td>`;
        if (cols.pct) c += `<td>${row.fractionPercent}</td>`;
        c += `<td style="font-weight:700;color:var(--primary)">${row.satak}</td>`;
        if (cols.katha) c += `<td>${row.katha}</td>`;
        if (cols.sqft) c += `<td>${row.sqft}</td>`;
        return c + '</tr>';
      }).join('');
    }

    // মোট সারি — যোগফল ঠিক ১৬ আনা (১.০০০০) হলো কি না দেখা যায়
    const resTfoot = document.getElementById('khotian-res-tfoot');
    if (resTfoot) {
      const t = res.totals;
      const warn = res.isExact ? '' : ' style="color:var(--danger)"';
      let f = '<tr style="font-weight:700;background:var(--bg-input)"><td colspan="2" style="text-align:left">মোট</td>';
      if (cols.ana) f += `<td${warn}>${t.anaStr}</td>`;
      if (cols.frac) f += '<td>—</td>';
      f += `<td${warn}>${t.decimalStr}</td>`;
      if (cols.pct) f += `<td${warn}>${t.percentStr}</td>`;
      f += `<td>${t.satak}</td>`;
      if (cols.katha) f += `<td>${t.katha}</td>`;
      if (cols.sqft) f += `<td>${t.sqft}</td>`;
      resTfoot.innerHTML = f + '</tr>';
    }

    // মোবাইল কার্ড — একই টগল মানা হয়
    const resCards = document.getElementById('khotian-res-cards');
    if (resCards) {
      resCards.innerHTML = res.results.map(row => {
        const meta = [];
        if (cols.ana) meta.push(row.anaStr);
        if (cols.frac) meta.push('ভগ্নাংশ ' + row.fractionStr);
        if (cols.pct) meta.push(row.fractionPercent);

        let items = `<div class="fz-res-item"><span class="lbl">শতক</span><span class="val">${row.satak}</span></div>`;
        if (cols.katha) items += `<div class="fz-res-item"><span class="lbl">কাঠা</span><span class="val">${row.katha}</span></div>`;
        if (cols.sqft) items += `<div class="fz-res-item"><span class="lbl">বর্গফুট</span><span class="val">${row.sqft}</span></div>`;

        return `
        <div class="fz-res-card">
          <div class="fz-res-card-top">
            <span class="fz-res-name">${row.serial}. ${row.name}</span>
            <span class="fz-res-pct">${row.decimalStr}</span>
          </div>
          ${meta.length ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${meta.join(' &nbsp;·&nbsp; ')}</div>` : ''}
          <div class="fz-res-grid">${items}</div>
        </div>`;
      }).join('') + `
        <div class="fz-res-card" style="background:var(--bg-input);font-weight:700">
          <div class="fz-res-card-top" style="margin-bottom:0;padding-bottom:0;border:none">
            <span class="fz-res-name">মোট</span>
            <span class="fz-res-pct" style="background:${res.isExact ? 'var(--secondary)' : 'var(--danger)'}">${res.totals.decimalStr}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">
            ${res.totals.anaStr} · ${res.totals.percentStr} · ${res.totals.satak} শতক
          </div>
        </div>`;
    }

    const sumBadge = document.getElementById('khotian-sum-badge');
    if (sumBadge) {
      sumBadge.innerText = `মোট: ${res.totalFractionSum}`;
      sumBadge.classList.toggle('ok', res.isExact);
      sumBadge.classList.toggle('bad', !res.isExact);
    }
  },

  /* ------------------------------------------------------------------------
     কাঠার মাপ — অঞ্চলভেদে আলাদা হওয়ায় ব্যবহারকারী বেছে নিতে পারেন।
     সেটিংটি সব টুলে প্রযোজ্য এবং localStorage-এ সংরক্ষিত থাকে।
     ------------------------------------------------------------------------ */
  KATHA_STORE: 'land_info_katha',

  /** পেজ লোডে সংরক্ষিত কাঠা-সেটিং ফিরিয়ে আনে */
  initKathaSetting() {
    try {
      const raw = this.storeGet(this.KATHA_STORE);
      if (raw) {
        const s = JSON.parse(raw);
        LandMath.setKathaPreset(s.mode, s.custom);
        const inp = document.getElementById('uc-katha-custom');
        if (inp && s.custom) inp.value = s.custom;
      }
    } catch (e) { /* সংরক্ষিত মান নষ্ট হলে ডিফল্টেই চলবে */ }
    this.syncKathaUI();
  },

  setKathaMode(mode) {
    const customInp = document.getElementById('uc-katha-custom');
    const custom = parseFloat(toEn(customInp?.value || '0'));

    if (mode === 'custom' && !(custom > 0)) {
      // অবৈধ কাস্টম মান — শুধু ইনপুট বক্স দেখাই, হিসাব বদলাই না
      this.syncKathaUI(mode);
      return;
    }

    LandMath.setKathaPreset(mode, custom);
    try {
      this.storeSet(this.KATHA_STORE, JSON.stringify({ mode, custom }));
    } catch (e) { /* বেসরকারি মোডে সংরক্ষণ ব্যর্থ হতে পারে */ }

    this.syncKathaUI(mode);
    this.refreshAllCalculators();
  },

  /** বোতামের অবস্থা, কাস্টম বক্স ও ভিত্তি-টাইলগুলো হালনাগাদ করে */
  syncKathaUI(forceMode) {
    const mode = forceMode || LandMath.kathaMode;

    document.querySelectorAll('.fz-seg-btn[data-katha]').forEach(b => {
      b.classList.toggle('active', b.dataset.katha === mode);
    });
    const wrap = document.getElementById('uc-katha-custom-wrap');
    if (wrap) wrap.style.display = (mode === 'custom') ? 'flex' : 'none';

    const b = LandMath.kathaBasis();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = toBn(v); };
    set('uc-basis-katha-satak', b.satakPerKatha.toFixed(4));
    set('uc-basis-katha-sqft', b.sqftPerKatha.toFixed(2));
    set('uc-basis-bigha-satak', b.satakPerBigha.toFixed(4));
    set('uc-basis-bigha-sqft', b.sqftPerBigha.toFixed(2));
  },

  /** কাঠা বদলালে যেসব টুল খোলা আছে সেগুলো আবার হিসাব করে */
  refreshAllCalculators() {
    if (document.getElementById('uc-res-satak')) this.runUnitConverter();
    if (document.getElementById('hc-res-satak')) this.runHissaCalc();
    if (document.getElementById('ag-res-satak')) this.runAnaGondaCalc();
    if (document.getElementById('khotian-res-tbody')) this.runKhotianCalc();
    // সূত্রপাতার একক অংশে কাঠা/বিঘার মান দেখানো হয় — সেটাও নতুন করে আঁকতে হবে
    if (document.getElementById('lf-content')) this.renderLandFormula();
    if (this.canvasEngine) this.updateCanvasFromInputs();
    this.showKathaNotes();
  },

  /**
   * যেসব টুলে কাঠা/বিঘা দেখানো হয়, সেখানে বর্তমান কাঠার মাপ জানিয়ে দেয় —
   * নইলে ব্যবহারকারী বুঝবেন না কোন হিসাবে ফলাফল এসেছে।
   */
  showKathaNotes() {
    const b = LandMath.kathaBasis();
    const modeName = { standard: 'স্ট্যান্ডার্ড', wide: 'চওড়া', custom: 'কাস্টম' }[b.mode] || '';
    const html = `<span><i class="bi bi-rulers"></i> <b>${modeName} কাঠা:</b></span>` +
      `<span>১ কাঠা = ${toBn(b.satakPerKatha.toFixed(4))} শতক</span>` +
      `<span>·</span>` +
      `<span>১ বিঘা = ${toBn(b.satakPerBigha.toFixed(4))} শতক</span>` +
      `<a href="#" onclick="AppController.openToolModal('unit-converter');return false;">বদলান</a>`;

    document.querySelectorAll('.fz-katha-note').forEach(el => { el.innerHTML = html; });
  },

  runUnitConverter() {
    const val = parseFloat(toEn(document.getElementById('uc-input-val')?.value || '1')) || 1;
    const unit = document.getElementById('uc-input-unit')?.value || 'satak';

    const res = LandMath.convertArea(val, unit);

    document.getElementById('uc-res-satak').innerText = toBn(res.satak);
    document.getElementById('uc-res-sqft').innerText = toBn(res.sqft);
    document.getElementById('uc-res-katha').innerText = toBn(res.katha);
    document.getElementById('uc-res-bigha').innerText = toBn(res.bigha);
    document.getElementById('uc-res-acre').innerText = toBn(res.acre);
    document.getElementById('uc-res-ajutangsha').innerText = toBn(res.ajutangsha);
  },

  /** ক্যানভাসে মাপা ক্ষেত্রফল প্রিন্ট ফর্মে তুলে আনে */
  pullAreaFromCanvas() {
    if (!this.canvasEngine) return;
    const sqft = this.canvasEngine.calculateAreaSqFt();
    const el = document.getElementById('print-area-satak');
    if (el && sqft > 0) el.value = toBn((sqft / LandMath.SQFT_PER_SATAK).toFixed(3));
  },

  triggerPrintReport() {
    const v = id => document.getElementById(id)?.value || '';
    const satak = parseFloat(toEn(v('print-area-satak'))) || 0;

    // কাঠা/বিঘা ব্যবহারকারীর সেট করা কাঠার মাপ অনুযায়ী —
    // আগে /1.65 হার্ডকোড ছিল, তাই চওড়া কাঠার এলাকায় ভুল আসত
    const conv = LandMath.convertArea(satak, 'satak');

    // ক্যানভাসে যা মাপা হয়েছে সেই বাহু-কর্ণও প্রতিবেদনে যাবে
    const sides = Array.from(document.querySelectorAll('#cm-sides .cm-side'))
      .map(i => parseFloat(toEn(i.value)) || 0).filter(x => x > 0);
    const diagonals = Array.from(document.querySelectorAll('#cm-diags .cm-diag'))
      .map(i => parseFloat(toEn(i.value)) || 0).filter(x => x > 0);

    ReportGenerator.generateSurveyReport({
      clientName: v('print-client-name'),
      mouzaName: v('print-mouza'),
      khotianNo: v('print-khotian'),
      dagNo: v('print-dag'),
      district: v('print-district'),
      surveyorName: v('print-surveyor-name'),
      surveyorPhone: v('print-surveyor-phone'),
      areaSatak: satak ? toBn(satak.toFixed(3)) : '',
      areaKatha: satak ? toBn(conv.katha) : '',
      areaBigha: satak ? toBn(conv.bigha) : '',
      areaSqFt: satak ? toBn(conv.sqft) : '',
      kathaBasis: LandMath.kathaBasis(),
      sides, diagonals,
      plotImgData: this.canvasEngine ? this.canvasEngine.exportImagePNG() : null
    });
  },

  /* ------------------------------------------------------------------------
     সারাদেশের মৌজা ম্যাপ আর্কাইভ
     ইনডেক্স: data/mouza-map/ (README.md এ কীভাবে তৈরি হয়েছে লেখা আছে)
     ------------------------------------------------------------------------ */

  mmTree: null,
  mmFiles: [],          // বর্তমান জরিপ-ফোল্ডারের ফাইল
  mmReady: false,

  async initMouzaMap() {
    if (this.mmReady) return;
    this.mmReady = true;
    try {
      const tree = await MouzaMap.loadTree();
      this.mmTree = tree;

      const s = MouzaMap.summary(tree);
      const box = document.getElementById('mm-summary');
      if (box) {
        box.innerHTML = [
          [toBn(s.files.toLocaleString('en-US').replace(/,/g, ',')), 'মোট ম্যাপ ফাইল'],
          [toBn(s.districts), 'জেলা'],
          [toBn(s.upazilas), 'উপজেলা'],
          [toBn(s.surveys), 'জরিপ ফোল্ডার']
        ].map(([v, l]) =>
          `<div class="fz-stat"><span class="v">${v}</span><span class="l">${l}</span></div>`).join('');
      }

      this.fillMouzaSelect('mm-division',
        tree.divisions.map(d => ({ id: d.id, name: d.name })), 'বিভাগ বাছুন');
    } catch (e) {
      const box = document.getElementById('mm-summary');
      if (box) {
        box.innerHTML = `<div class="fz-ded-alert danger" style="grid-column:1/-1">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <span>ইনডেক্স আনা যায়নি — <b>${e.message}</b><br>
          এই টুল <code>file://</code> থেকে চলে না (CORS)। লোকাল সার্ভার দিয়ে খুলুন:
          <code>python -m http.server</code></span></div>`;
      }
      this.mmReady = false;
    }
  },

  /** ট্রি থেকে বর্তমানে নির্বাচিত নোড */
  mmSelected() {
    const g = id => document.getElementById(id)?.value || '';
    const dv = (this.mmTree?.divisions || []).find(x => x.id === g('mm-division'));
    const dt = (dv?.districts || []).find(x => x.id === g('mm-district'));
    const up = (dt?.upazilas || []).find(x => x.id === g('mm-upazila'));
    const sv = (up?.surveys || []).find(x => x.id === g('mm-survey'));
    return { dv, dt, up, sv };
  },

  onMouzaMapDivision() {
    const { dv } = this.mmSelected();
    this.fillMouzaSelect('mm-district',
      (dv?.districts || []).map(d => ({ id: d.id, name: d.name })),
      dv ? 'জেলা বাছুন' : 'আগে বিভাগ বাছুন');
    this.fillMouzaSelect('mm-upazila', [], 'আগে জেলা বাছুন');
    this.fillMouzaSelect('mm-survey', [], 'আগে উপজেলা বাছুন');
    this.hideMouzaMapFiles();
  },

  onMouzaMapDistrict() {
    const { dt } = this.mmSelected();
    this.fillMouzaSelect('mm-upazila',
      (dt?.upazilas || []).map(u => ({ id: u.id, name: u.name })),
      dt ? 'উপজেলা বাছুন' : 'আগে জেলা বাছুন');
    this.fillMouzaSelect('mm-survey', [], 'আগে উপজেলা বাছুন');
    this.hideMouzaMapFiles();
  },

  onMouzaMapUpazila() {
    const { up } = this.mmSelected();
    // জরিপের নামের সাথে ফাইলসংখ্যা দেখাই — কোনটায় কত আছে বোঝা যায়
    this.fillMouzaSelect('mm-survey',
      (up?.surveys || []).map(s => ({ id: s.id, name: `${s.name} (${toBn(s.count)} ফাইল)` })),
      up ? 'জরিপ বাছুন' : 'আগে উপজেলা বাছুন');
    this.hideMouzaMapFiles();
    // একটাই জরিপ থাকলে নিজেই বেছে নিই
    if (up && up.surveys.length === 1) {
      const sel = document.getElementById('mm-survey');
      if (sel) { sel.value = up.surveys[0].id; this.onMouzaMapSurvey(); }
    }
  },

  async onMouzaMapSurvey() {
    const { sv } = this.mmSelected();
    if (!sv) { this.hideMouzaMapFiles(); return; }

    const panel = document.getElementById('mm-files-panel');
    const box = document.getElementById('mm-files');
    if (panel) panel.style.display = 'block';
    if (box) box.innerHTML = '<p class="fz-cert-note" style="text-align:left;margin:0">তালিকা আসছে…</p>';

    try {
      this.mmFiles = await MouzaMap.loadFiles(sv.id);
      const f = document.getElementById('mm-file-filter');
      if (f) f.value = '';
      this.renderMouzaMapFiles(this.mmFiles);
    } catch (e) {
      if (box) box.innerHTML = `<div class="fz-ded-alert danger">
        <i class="bi bi-exclamation-triangle-fill"></i><span>${e.message}</span></div>`;
    }
  },

  hideMouzaMapFiles() {
    const p = document.getElementById('mm-files-panel');
    if (p) p.style.display = 'none';
    this.mmFiles = [];
  },

  filterMouzaMapFiles(q) {
    this.renderMouzaMapFiles(MouzaMap.filterFiles(this.mmFiles, q));
  },

  renderMouzaMapFiles(list) {
    const box = document.getElementById('mm-files');
    const cnt = document.getElementById('mm-file-count');
    if (!box) return;

    if (cnt) {
      cnt.textContent = list.length === this.mmFiles.length
        ? `${toBn(list.length)} ফাইল`
        : `${toBn(list.length)} / ${toBn(this.mmFiles.length)}`;
    }

    if (!list.length) {
      box.innerHTML = '<p class="fz-cert-note" style="text-align:left;margin:0">কিছু পাওয়া যায়নি।</p>';
      return;
    }

    // অনেক ফাইল হলে (একটি ফোল্ডারে ৬০০+ পর্যন্ত) প্রথম ২০০টি দেখাই
    const LIMIT = 200;
    const show = list.slice(0, LIMIT);

    box.innerHTML = `<div class="mm-list">${show.map((f, i) => {
      const k = MouzaMap.fileKind(f.mimeType);
      const big = !MouzaMap.canProxy(f);
      return `
        <div class="mm-item${big ? ' mm-big' : ''}">
          <i class="bi ${k.icon} mm-ico"></i>
          <div class="mm-meta">
            <span class="mm-name">${f.name}</span>
            <span class="mm-sub">${k.label} · ${MouzaMap.formatSize(f.size)}${
              f.subPath ? ' · <i class="bi bi-folder2"></i> ' + f.subPath : ''}</span>
            ${big ? `<span class="mm-warn"><i class="bi bi-exclamation-triangle"></i>
              ফাইলটি খুব বড় (${MouzaMap.formatSize(MouzaMap.PROXY_LIMIT)} এর বেশি) —
              এখান থেকে নামানো যাবে না</span>` : ''}
          </div>
          <div class="mm-act">
            ${big
              // ৩৫ MB এর বড় ফাইল প্রক্সিতে আসে না। Drive এর লিংক দেখানো
              // যাবে না, তাই বোতামটি নিষ্ক্রিয় রাখা হয় — কারণ পাশের
              // সতর্কবার্তায় লেখা আছে।
              ? `<button class="fz-btn-sub mm-btn" disabled title="ফাইলটি খুব বড়">
                   <i class="bi bi-slash-circle"></i> Download</button>`
              : `<button class="fz-btn-sub mm-btn" title="Download"
                   onclick="AppController.downloadMouzaMapFile(${i})">
                   <i class="bi bi-download"></i> Download</button>`}
          </div>
        </div>`;
    }).join('')}</div>
    ${list.length > LIMIT ? `<p class="fz-cert-note" style="text-align:left;margin-top:10px">
      প্রথম ${toBn(LIMIT)} টি দেখানো হয়েছে (মোট ${toBn(list.length)})।
      উপরের ঘরে নাম লিখে ছেঁকে নিন।</p>` : ''}`;

    this.mmShown = show;
  },

  async downloadMouzaMapFile(idx) {
    const f = (this.mmShown || [])[idx];
    if (!f) return;

    const panel = document.getElementById('mm-dl-panel');
    const box = document.getElementById('mm-dl');
    if (panel) panel.style.display = 'block';
    if (box) {
      box.innerHTML = `
        <div class="mm-dl-row">
          <div><b>${f.name}</b><p>${MouzaMap.formatSize(f.size)}</p></div>
        </div>
        <div class="mm-bar"><span id="mm-bar-fill" style="width:5%"></span></div>
        <p class="fz-cert-note" id="mm-dl-msg" style="text-align:left;margin-top:8px">শুরু হচ্ছে…</p>`;
    }
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const stage = (pct, msg) => {
      const bar = document.getElementById('mm-bar-fill');
      const m = document.getElementById('mm-dl-msg');
      if (bar) bar.style.width = Math.max(3, pct) + '%';
      if (m) m.textContent = msg;
    };

    try {
      const { blob, fileName } = await MouzaMap.fetchBytes(f, stage);
      stage(100, 'সম্পন্ন — ফাইল সংরক্ষণ হচ্ছে');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      this.showToast('ম্যাপ নামানো হয়েছে');
    } catch (e) {
      if (box) {
        box.innerHTML += `<div class="fz-ded-alert danger" style="margin-top:10px">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <span>${e.message}<br>কিছুক্ষণ পর আবার চেষ্টা করুন।</span></div>`;
      }
    }
  },

  /** জায়গা খুঁজে সরাসরি সেখানে যাওয়ার ব্যবস্থা */
  searchMouzaMap(q) {
    const box = document.getElementById('mm-search-results');
    if (!box) return;
    const res = MouzaMap.searchPlaces(this.mmTree, q, 25);

    if (!q || q.trim().length < 2) { box.innerHTML = ''; return; }
    if (!res.length) {
      box.innerHTML = '<p class="fz-cert-note" style="text-align:left;margin:10px 0 0">কিছু পাওয়া যায়নি।</p>';
      return;
    }

    box.innerHTML = `<div class="mm-hits">${res.map(r => `
      <button class="mm-hit" onclick="AppController.gotoMouzaMap('${r.division.id}','${r.district.id}','${r.upazila.id}')">
        <span class="mm-hit-name">${r.upazila.name}</span>
        <span class="mm-hit-path">${r.district.name} · ${r.division.name}</span>
        <span class="mm-hit-count">${toBn(r.total)} ফাইল · ${toBn(r.surveys.length)} জরিপ</span>
      </button>`).join('')}</div>`;
  },

  gotoMouzaMap(dvId, dtId, upId) {
    const set = (id, v, fn) => {
      const el = document.getElementById(id);
      if (el) { el.value = v; fn(); }
    };
    set('mm-division', dvId, () => this.onMouzaMapDivision());
    set('mm-district', dtId, () => this.onMouzaMapDistrict());
    set('mm-upazila', upId, () => this.onMouzaMapUpazila());
    document.getElementById('mm-division')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  resetMouzaMap() {
    ['mm-district', 'mm-upazila', 'mm-survey'].forEach(id =>
      this.fillMouzaSelect(id, [], '—'));
    const d = document.getElementById('mm-division');
    if (d) d.value = '';
    this.fillMouzaSelect('mm-district', [], 'আগে বিভাগ বাছুন');
    this.fillMouzaSelect('mm-upazila', [], 'আগে জেলা বাছুন');
    this.fillMouzaSelect('mm-survey', [], 'আগে উপজেলা বাছুন');
    ['mm-search', 'mm-file-filter'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const sr = document.getElementById('mm-search-results');
    if (sr) sr.innerHTML = '';
    this.hideMouzaMapFiles();
    const dp = document.getElementById('mm-dl-panel');
    if (dp) dp.style.display = 'none';
  },

  /* ------------------------------------------------------------------------
     মৌজা মূল্য তালিকা (সম্পত্তির সর্বনিম্ন বাজার মূল্য)
     ------------------------------------------------------------------------ */

  /** সর্বশেষ যে ফাইলটা দেখানো হয়েছে */
  mouzaCurrent: null,
  mouzaReady: false,

  initMouzaValue() {
    // বছরের তালিকা একবারই বসাই
    const yearSel = document.getElementById('mv-year');
    if (yearSel && !yearSel.options.length) {
      yearSel.innerHTML = MouzaValue.YEARS
        .map(y => `<option value="${y}">${toBn(y)} সাল</option>`).join('');
    }

    if (this.mouzaReady) return;
    this.mouzaReady = true;
    this.loadMouzaDivisions();
  },

  /** select এ অপশন বসানোর সাধারণ হেল্পার */
  fillMouzaSelect(id, items, placeholder) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      items.map(it => `<option value="${it.id}">${it.name}</option>`).join('');
    sel.disabled = items.length === 0;
  },

  async loadMouzaDivisions() {
    const sel = document.getElementById('mv-division');
    try {
      const list = await MouzaValue.divisions();
      this.fillMouzaSelect('mv-division', list, 'বিভাগ বাছুন');
    } catch (e) {
      if (sel) sel.innerHTML = '<option value="">তালিকা আনা যায়নি</option>';
      this.showMouzaStatus('error',
        'বিভাগের তালিকা আনা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
    }
  },

  async onMouzaDivision() {
    const divId = document.getElementById('mv-division')?.value || '';
    this.fillMouzaSelect('mv-district', [], 'লোড হচ্ছে…');
    this.fillMouzaSelect('mv-office', [], 'আগে জেলা বাছুন');
    this.hideMouzaResult();
    if (!divId) {
      this.fillMouzaSelect('mv-district', [], 'আগে বিভাগ বাছুন');
      return;
    }
    try {
      const list = await MouzaValue.districts(divId);
      this.fillMouzaSelect('mv-district', list, 'জেলা বাছুন');
    } catch (e) {
      this.fillMouzaSelect('mv-district', [], 'তালিকা আনা যায়নি');
    }
  },

  async onMouzaDistrict() {
    const distId = document.getElementById('mv-district')?.value || '';
    this.fillMouzaSelect('mv-office', [], 'লোড হচ্ছে…');
    this.hideMouzaResult();
    if (!distId) {
      this.fillMouzaSelect('mv-office', [], 'আগে জেলা বাছুন');
      return;
    }
    try {
      const list = await MouzaValue.offices(distId);
      this.fillMouzaSelect('mv-office', list, 'অফিস বাছুন');
    } catch (e) {
      this.fillMouzaSelect('mv-office', [], 'তালিকা আনা যায়নি');
    }
  },

  /** অফিস বাছলেই সরাসরি খুঁজে দেখাই — বাড়তি একটা ক্লিক বাঁচে */
  onMouzaOffice() {
    if (document.getElementById('mv-office')?.value) this.runMouzaValue();
    else this.hideMouzaResult();
  },

  hideMouzaResult() {
    const p = document.getElementById('mv-result-panel');
    if (p) p.style.display = 'none';
    this.mouzaCurrent = null;
  },

  showMouzaStatus(kind, msg) {
    const panel = document.getElementById('mv-result-panel');
    const status = document.getElementById('mv-status');
    const found = document.getElementById('mv-found');
    const pill = document.getElementById('mv-source-pill');
    if (!panel || !status) return;

    panel.style.display = 'block';
    if (found) found.style.display = 'none';
    if (pill) pill.textContent = '';

    const icon = kind === 'error' ? 'bi-exclamation-triangle-fill'
      : kind === 'loading' ? 'bi-arrow-repeat' : 'bi-info-circle-fill';
    const color = kind === 'error' ? 'var(--danger)' : 'var(--text-secondary)';
    status.innerHTML = `<span style="color:${color}"><i class="bi ${icon}"></i> ${msg}</span>`;
  },

  async runMouzaValue() {
    const officeSel = document.getElementById('mv-office');
    const officeId = officeSel?.value || '';
    const officeName = officeSel?.selectedOptions?.[0]?.textContent || '';
    const year = document.getElementById('mv-year')?.value || MouzaValue.YEARS[0];

    if (!officeId) {
      this.showMouzaStatus('info', 'বিভাগ, জেলা ও সাব-রেজিস্ট্রি অফিস বেছে নিন।');
      return;
    }

    this.showMouzaStatus('loading', 'তালিকা খোঁজা হচ্ছে…');

    let res = null;
    try {
      res = await MouzaValue.search(officeId, year);
    } catch (e) {
      this.showMouzaStatus('error',
        'সার্ভার থেকে তথ্য আনা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।');
      return;
    }

    if (!res) {
      this.showMouzaStatus('error',
        `<b>${officeName}</b> এর ${toBn(year)} সালের তালিকা পাওয়া যায়নি। ` +
        'অন্য বছর বেছে দেখুন।');
      return;
    }

    this.mouzaCurrent = Object.assign({ officeId, officeName, year }, res);
    this.renderMouzaResult();
  },

  renderMouzaResult() {
    const c = this.mouzaCurrent;
    if (!c) return;

    const panel = document.getElementById('mv-result-panel');
    const found = document.getElementById('mv-found');
    const status = document.getElementById('mv-status');
    const pill = document.getElementById('mv-source-pill');
    const meta = document.getElementById('mv-meta');
    const frame = document.getElementById('mv-frame');

    if (panel) panel.style.display = 'block';
    if (found) found.style.display = 'block';
    if (status) status.innerHTML = '';

    if (pill) {
      const own = c.source === 'own';
      pill.textContent = own ? 'নিজস্ব উৎস' : 'বাইরের উৎস';
      pill.style.background = own ? 'var(--success-light, #dcfce7)' : 'var(--warning-light, #fef3c7)';
      pill.style.color = own ? '#15803d' : '#b45309';
    }

    if (meta) {
      const m = c.meta || {};
      const rows = [
        [c.officeName || m.officeName || '—', 'সাব-রেজিস্ট্রি অফিস'],
        [m.districtName || '—', 'জেলা'],
        [m.divisionName || '—', 'বিভাগ'],
        [toBn(c.year) + ' সাল', 'মূল্য তালিকার বছর']
      ];
      meta.innerHTML = rows.map(([v, l]) =>
        `<div class="fz-stat"><span class="v">${v}</span><span class="l">${l}</span></div>`).join('');
    }

    // কনফিগ কোড কপির বোতাম কেবল বাইরের উৎসের বেলায় দরকার
    const cfgBtn = document.getElementById('mv-cfg-btn');
    if (cfgBtn) cfgBtn.style.display = c.source === 'own' ? 'none' : '';

    if (frame) frame.src = c.view;
  },

  openMouzaPdf() {
    if (this.mouzaCurrent) window.open(this.mouzaCurrent.open, '_blank', 'noopener');
  },

  /**
   * ডাউনলোড — Drive এর ফাইল ব্রাউজারে সরাসরি নামানো যায় না,
   * তাই সেক্ষেত্রে নতুন ট্যাবে খুলে দিই।
   */
  downloadMouzaPdf() {
    const c = this.mouzaCurrent;
    if (!c) return;
    if (c.kind === 'drive') { this.openMouzaPdf(); return; }

    const a = document.createElement('a');
    a.href = c.open;
    a.download = MouzaValue.fileNameFrom(c.open, `${c.officeName || 'mouza'}-${c.year}`);
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  /** নিজের Drive এ ফাইল রাখার জন্য mouza-sources.js এ বসানোর কোড কপি করে */
  copyMouzaConfig() {
    const c = this.mouzaCurrent;
    if (!c) return;
    const code = MouzaSources.snippetFor(c.officeId, c.officeName, c.year);
    const done = () => alert(
      'কনফিগ কোড কপি হয়েছে।\n\n' +
      'js/mouza-sources.js ফাইলের OFFICES এর ভেতরে বসিয়ে\n' +
      'Google Drive আইডিটা লিখে দিন।'
    );
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(() => window.prompt('কপি করুন:', code));
    } else {
      window.prompt('কপি করুন:', code);
    }
  },

  /* ------------------------------------------------------------------------
     খতিয়ান বিশ্লেষণ (পর্চার হিসাব)
     কাঠামো প্রচলিত খতিয়ান বিশ্লেষণ রিপোর্টের আদলে।
     ------------------------------------------------------------------------ */

  porchaReady: false,
  porchaType: 'decimal',
  porchaDags: [],      // [{ no, cls, totalArea, khotianArea }]
  porchaOwners: [],    // [{ name, relation, guardian, address, data }]
  lastPorcha: null,

  initPorcha() {
    const sel = document.getElementById('kp-type');
    if (sel && !sel.options.length) {
      sel.innerHTML = '<option value="">— নির্বাচন করুন —</option>' +
        PorchaMath.KHOTIAN_TYPES.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }
    const seg = document.getElementById('kp-type-seg');
    if (seg && !seg.children.length) this.renderPorchaTypeSeg();

    if (this.porchaReady) { this.runPorcha(); return; }
    this.porchaReady = true;
    this.porchaDags = [{ no: '', cls: '', totalArea: '', khotianArea: '' }];
    this.porchaOwners = [{ name: '', relation: 'father', guardian: '', address: '', data: {} }];
    this.renderPorchaOwners();
    this.renderPorchaDags();
    this.runPorcha();
  },

  renderPorchaTypeSeg() {
    const seg = document.getElementById('kp-type-seg');
    if (!seg) return;
    seg.innerHTML = PorchaMath.HISSA_TYPES.map(t => `
      <button type="button" class="fz-seg-btn${t.id === this.porchaType ? ' active' : ''}"
              data-kpt="${t.id}" onclick="AppController.setPorchaType('${t.id}')">${t.name}</button>`).join('');
  },

  setPorchaType(type) {
    this.porchaType = type;
    document.querySelectorAll('#kp-type-seg .fz-seg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.kpt === type);
    });
    this.renderPorchaOwners();
    this.runPorcha();
  },

  /** খতিয়ানের ধরন অনুযায়ী কোন হিস্যা-পদ্ধতি স্বাভাবিক তার পরামর্শ */
  onPorchaKhTypeChange() {
    const kh = document.getElementById('kp-type')?.value || '';
    const hint = document.getElementById('kp-type-hint');
    if (!kh) { if (hint) hint.innerHTML = ''; this.runPorcha(); return; }

    const suggested = PorchaMath.suggestHissaType(kh);
    const old = kh === 'cs' || kh === 'ps';
    if (hint) {
      hint.innerHTML = old
        ? '<i class="bi bi-lightbulb"></i> পুরনো <b>সি.এস./পি.এস.</b> খতিয়ানে অংশ সাধারণত <b>আনা-গণ্ডা</b> পদ্ধতিতে লেখা থাকে।'
        : '<i class="bi bi-lightbulb"></i> <b>বি.এস./আর.এস./এস.এ.</b> খতিয়ানে অংশ সাধারণত <b>দশমিক</b> পদ্ধতিতে লেখা থাকে (যেমন ০.২৫০)।';
    }
    if (suggested !== this.porchaType) this.setPorchaType(suggested);
    else this.runPorcha();
  },

  onPorchaTotalOwners(el) {
    el.value = toBn(toEn(el.value));
    this.runPorcha();
  },

  /* ---------------- দাগ ---------------- */

  addPorchaDag() {
    this.porchaDags.push({ no: '', cls: '', totalArea: '', khotianArea: '' });
    this.renderPorchaDags();
    this.runPorcha();
  },

  removePorchaDag(i) {
    if (this.porchaDags.length <= 1) return;
    this.porchaDags.splice(i, 1);
    this.renderPorchaDags();
    this.runPorcha();
  },

  onPorchaDagInput(i, field, el) {
    if (field === 'totalArea' || field === 'khotianArea') el.value = toBn(toEn(el.value));
    this.porchaDags[i][field] = el.value;
    this.runPorcha();
  },

  renderPorchaDags() {
    const box = document.getElementById('kp-dag-rows');
    if (!box) return;
    const u = this.porchaUnit();
    const esc = s => String(s || '').replace(/"/g, '&quot;');

    box.innerHTML = this.porchaDags.map((d, i) => `
      <div class="fz-row-card">
        <div class="kp-card-head">
          <span class="kp-card-num">${toBn(i + 1)}</span>
          <span class="kp-card-title">দাগ ${toBn(i + 1)}${d.no ? ' — ' + d.no : ''}</span>
          <button class="fz-btn-del" title="মুছুন" aria-label="মুছুন"
                  onclick="AppController.removePorchaDag(${i})"><i class="bi bi-trash"></i></button>
        </div>
        <div class="kp-grid">
          <div class="kp-f">
            <label>দাগ নং</label>
            <input type="text" value="${esc(d.no)}" placeholder="যেমন ৩৫৬"
                   oninput="AppController.onPorchaDagInput(${i},'no',this)">
          </div>
          <div class="kp-f">
            <label>শ্রেণী <span class="opt">(ঐচ্ছিক)</span></label>
            <select onchange="AppController.onPorchaDagInput(${i},'cls',this)">
              <option value="">— শ্রেণী নির্বাচন —</option>
              ${PorchaMath.LAND_CLASSES.map(c =>
                `<option value="${c}"${d.cls === c ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="kp-f">
            <label>দাগের মোট জমি (${u}) <span class="opt">(ঐচ্ছিক)</span></label>
            <input type="text" inputmode="decimal" value="${esc(d.totalArea)}" placeholder="দাগের সর্বমোট"
                   oninput="AppController.onPorchaDagInput(${i},'totalArea',this)">
          </div>
          <div class="kp-f">
            <label>খতিয়ানে দাগের জমি (${u}) <span class="req">*</span></label>
            <input type="text" inputmode="decimal" value="${esc(d.khotianArea)}" placeholder="খতিয়ানে পরিমাণ"
                   oninput="AppController.onPorchaDagInput(${i},'khotianArea',this)">
          </div>
        </div>
        <div class="fz-ded-sum" id="kp-dag-sum-${i}"></div>
      </div>`).join('');
  },

  /* ---------------- মালিক ---------------- */

  addPorchaOwner() {
    this.porchaOwners.push({ name: '', relation: 'father', guardian: '', address: '', data: {} });
    this.renderPorchaOwners();
    this.runPorcha();
  },

  removePorchaOwner(i) {
    if (this.porchaOwners.length <= 1) return;
    this.porchaOwners.splice(i, 1);
    this.renderPorchaOwners();
    this.runPorcha();
  },

  onPorchaOwnerInput(i, key, el) {
    const o = this.porchaOwners[i];
    if (key === 'name' || key === 'guardian' || key === 'address') {
      o[key] = el.value;
    } else if (key === 'relation') {
      o.relation = el.value;
      this.renderPorchaOwners();   // লেবেল বদলাবে (পিতার নাম / স্বামীর নাম)
    } else {
      el.value = toBn(toEn(el.value));
      o.data[key] = parseFloat(toEn(el.value)) || 0;
    }
    this.runPorcha();
  },

  /** হিস্যার ধরন অনুযায়ী ভিন্ন ঘর */
  porchaHissaFields(i, data) {
    const v = k => (data[k] !== undefined && data[k] !== 0) ? toBn(data[k]) : '';
    const f = (k, label, ph, cls) => `
      <div class="kp-f ${cls || ''}">
        <label>${label}</label>
        <input type="text" inputmode="decimal" value="${v(k)}" placeholder="${ph || '০'}"
               oninput="AppController.onPorchaOwnerInput(${i},'${k}',this)">
      </div>`;

    switch (this.porchaType) {
      case 'anagonda':
        return f('ana', 'আনা') + f('gonda', 'গণ্ডা') + f('kora', 'কড়া')
             + f('kranti', 'ক্রান্তি') + f('til', 'তিল');
      case 'fraction':
        return f('num', 'লব (উপরে)') + f('den', 'হর (নিচে)');
      case 'percent':
        return f('percent', 'অংশ (শতাংশ %)', 'যেমন ২৫', 'kp-half');
      default:
        return f('decimal', 'অংশ (০ – ১.০০০)', 'যেমন ০.২৫০', 'kp-half');
    }
  },

  renderPorchaOwners() {
    const box = document.getElementById('kp-owner-rows');
    if (!box) return;
    const esc = s => String(s || '').replace(/"/g, '&quot;');

    box.innerHTML = this.porchaOwners.map((o, i) => {
      const rel = PorchaMath.RELATIONS.find(r => r.id === (o.relation || 'father')) || PorchaMath.RELATIONS[0];
      return `
      <div class="fz-row-card">
        <div class="kp-card-head">
          <span class="kp-card-num">${toBn(i + 1)}</span>
          <span class="kp-card-title">মালিক ${toBn(i + 1)}${o.name ? ' — ' + o.name : ''}</span>
          <button class="fz-btn-del" title="মুছুন" aria-label="মুছুন"
                  onclick="AppController.removePorchaOwner(${i})"><i class="bi bi-trash"></i></button>
        </div>
        <div class="kp-grid">
          <div class="kp-f kp-full">
            <label>মালিকের নাম</label>
            <input type="text" value="${esc(o.name)}" placeholder="মালিকের পূর্ণ নাম"
                   oninput="AppController.onPorchaOwnerInput(${i},'name',this)">
          </div>
          <div class="kp-f">
            <label>সম্পর্ক</label>
            <select onchange="AppController.onPorchaOwnerInput(${i},'relation',this)">
              ${PorchaMath.RELATIONS.map(r =>
                `<option value="${r.id}"${o.relation === r.id ? ' selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </div>
          <div class="kp-f kp-grow">
            <label>${rel.label}</label>
            <input type="text" value="${esc(o.guardian)}" placeholder="${rel.label}"
                   oninput="AppController.onPorchaOwnerInput(${i},'guardian',this)">
          </div>
          <div class="kp-f kp-full">
            <label>সাং / ঠিকানা</label>
            <input type="text" value="${esc(o.address)}" placeholder="গ্রাম বা মহল্লার নাম"
                   oninput="AppController.onPorchaOwnerInput(${i},'address',this)">
          </div>
          ${this.porchaHissaFields(i, o.data || {})}
        </div>
        <div class="fz-ded-sum" id="kp-own-sum-${i}"></div>
      </div>`;
    }).join('');
  },

  /* ---------------- হিসাব ---------------- */

  porchaUnit() {
    return document.getElementById('kp-unit')?.value || 'শতক';
  },

  runPorcha() {
    const num = id => parseFloat(toEn(document.getElementById(id)?.value || '')) || 0;
    const res = PorchaMath.analyze({
      unit: this.porchaUnit(),
      decimals: parseInt(document.getElementById('kp-decimals')?.value || '4'),
      totalOwners: num('kp-total-owners'),
      dags: this.porchaDags.map(d => ({
        no: d.no, cls: d.cls,
        totalArea: parseFloat(toEn(String(d.totalArea || ''))) || 0,
        khotianArea: parseFloat(toEn(String(d.khotianArea || ''))) || 0
      })),
      owners: this.porchaOwners.map(o => ({
        name: o.name, relation: o.relation, guardian: o.guardian, address: o.address,
        type: this.porchaType, data: o.data || {}
      }))
    });
    this.lastPorcha = res;
    this.renderPorchaResult(res);
    this.showKathaNotes();
  },

  renderPorchaResult(res) {
    const u = res.unit, dec = res.decimals;
    const n = x => toBn(Number(x).toFixed(dec));
    const sq = x => toBn(Number(x).toFixed(1));

    const cnt = document.getElementById('kp-analyze-count');
    if (cnt) {
      cnt.value = res.totalOwners
        ? `${toBn(res.analyzeCount)} জন (মোট ${toBn(res.totalOwners)} জনের মধ্যে)`
        : `${toBn(res.analyzeCount)} জন`;
    }

    const dagPill = document.getElementById('kp-dag-total');
    if (dagPill) dagPill.textContent = `খতিয়ানে মোট ${n(res.khotianTotal)} ${u}`;

    const hp = document.getElementById('kp-hissa-badge');
    if (hp) {
      const ag = LandMath.fractionToAnaGonda(res.hissaSum);
      hp.textContent = `${toBn((res.hissaSum * 100).toFixed(2))}% · `
        + LandMath.formatAnaGondaString(ag.ana, ag.gonda, ag.kora, ag.kranti, ag.til);
      hp.classList.toggle('ok', res.isFull);
    }

    // প্রতিটি দাগের কার্ডের নিচে সারসংক্ষেপ
    res.dags.forEach((d, i) => {
      const el = document.getElementById(`kp-dag-sum-${i}`);
      if (!el) return;
      if (!d.khotianArea) { el.innerHTML = ''; return; }
      let h = '';
      if (d.hasTotal) h += `<div class="fz-ded-line"><span>দাগের মোট</span><b>${n(d.totalArea)} ${u}</b></div>`;
      h += `<div class="fz-ded-line net"><span>খতিয়ানে এই দাগে</span>
            <b>${n(d.khotianArea)} ${u} · ${sq(d.khotianSqft)} বর্গফুট</b></div>`;
      if (d.overTotal) {
        h += `<div class="fz-ded-alert danger"><i class="bi bi-exclamation-triangle-fill"></i>
          <span>খতিয়ানের জমি (${n(d.khotianArea)}) দাগের মোট (${n(d.totalArea)}) এর চেয়ে বেশি —
          তথ্য মিলিয়ে দেখুন।</span></div>`;
      }
      el.innerHTML = h;
    });

    // প্রতিটি মালিকের কার্ডের নিচে তার মোট
    res.owners.forEach((o, i) => {
      const el = document.getElementById(`kp-own-sum-${i}`);
      if (!el) return;
      el.innerHTML = o.fraction > 0
        ? `<div class="fz-ded-line net">
             <span>অংশ ${toBn((o.fraction * 100).toFixed(4))}% — মোট প্রাপ্য</span>
             <b>${n(o.total)} ${u}</b></div>`
        : '';
    });

    const hasData = res.dagCount > 0 && res.ownerCount > 0
                    && res.khotianTotal > 0 && res.hissaSum > 0;

    // ---- সতর্কবার্তা ----
    const warn = document.getElementById('kp-warn');
    if (warn) {
      let w = '';
      if (res.isOver) {
        w += `<div class="fz-ded-alert danger"><i class="bi bi-exclamation-triangle-fill"></i>
          <span>মালিকদের অংশের যোগফল <b>${toBn((res.hissaSum * 100).toFixed(2))}%</b> —
          ১০০% এর বেশি হতে পারে না। অংশগুলো মিলিয়ে দেখুন।</span></div>`;
      } else if (hasData && !res.isFull) {
        w += `<div class="fz-ded-alert"><i class="bi bi-info-circle-fill"></i>
          <span>এটি <b>আংশিক বিশ্লেষণ</b> — তালিকার ${toBn(res.ownerCount)} জনের অংশের যোগ
          ${toBn((res.hissaSum * 100).toFixed(2))}%। বাকি
          <b>${toBn((res.hissaShortfall * 100).toFixed(2))}%</b> অন্য মালিকদের, তাই
          <b>${n(res.unallocatedTotal)} ${u}</b> আলাদা করে দেখানো হয়েছে।</span></div>`;
      }
      if (res.countMismatch) {
        w += `<div class="fz-ded-alert danger"><i class="bi bi-exclamation-triangle-fill"></i>
          <span>তালিকায় ${toBn(res.ownerCount)} জন মালিক আছেন, কিন্তু "মোট মালিক" দেওয়া হয়েছে
          ${toBn(res.totalOwners)} জন।</span></div>`;
      }
      if (res.anyAdjusted) {
        w += `<div class="fz-ded-alert"><i class="bi bi-check2-circle"></i>
          <span>দশমিকের পর ${toBn(dec)} ঘরে রাউন্ড করার অবশিষ্টটুকু সমন্বয় করা হয়েছে,
          যাতে <b>প্রতিটি দাগের যোগফল খতিয়ানে ওই দাগের জমির সমান হয়</b>।</span></div>`;
      }
      warn.innerHTML = w;
    }

    // ---- সারসংক্ষেপ ----
    const sum = document.getElementById('kp-summary');
    if (sum) {
      sum.innerHTML = !hasData ? '' : `
        <div class="fz-stats" style="margin-bottom:14px">
          <div class="fz-stat"><span class="v">${n(res.khotianTotal)}</span>
            <span class="l">খতিয়ানে মোট (${u})</span></div>
          <div class="fz-stat"><span class="v">${n(res.analyzedTotal)}</span>
            <span class="l">বিশ্লেষিত মালিকদের মোট</span></div>
          ${res.unallocatedTotal > 0 ? `<div class="fz-stat"><span class="v">${n(res.unallocatedTotal)}</span>
            <span class="l">অন্য মালিকগণ</span></div>` : ''}
          <div class="fz-stat"><span class="v">${sq(res.khotianTotalSqft)}</span>
            <span class="l">খতিয়ানে মোট (বর্গফুট)</span></div>
        </div>`;
    }

    // ---- দাগের তালিকা ----
    const dt = document.getElementById('kp-dag-table');
    if (dt) {
      dt.innerHTML = !hasData ? '' : `
        <div class="kp-block">
          <div class="kp-block-head"><i class="bi bi-list-ol"></i> দাগের তালিকা</div>
          <div class="kp-scroll">
            <table class="kp-matrix">
              <thead><tr>
                <th class="kp-left">ক্র.</th><th class="kp-left">দাগ নং</th><th class="kp-left">শ্রেণী</th>
                <th>দাগের মোট</th><th>খতিয়ানে দাগের জমি</th><th>বর্গফুট</th>
              </tr></thead>
              <tbody>
                ${res.dags.map((d, i) => `<tr>
                  <td class="kp-left">${toBn(i + 1)}</td>
                  <td class="kp-left">${d.no}</td>
                  <td class="kp-left">${d.cls || '—'}</td>
                  <td>${d.hasTotal ? n(d.totalArea) + ' ' + u : '—'}</td>
                  <td><b>${n(d.khotianArea)} ${u}</b></td>
                  <td>${sq(d.khotianSqft)}</td>
                </tr>`).join('')}
              </tbody>
              <tfoot><tr>
                <td class="kp-left" colspan="4">মোট খতিয়ান জমি</td>
                <td>${n(res.khotianTotal)} ${u}</td>
                <td>${sq(res.khotianTotalSqft)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>`;
    }

    // ---- প্রতি মালিকের আলাদা রিপোর্ট ----
    const rep = document.getElementById('kp-owner-reports');
    if (rep) {
      rep.innerHTML = !hasData ? '' : res.owners.map((o, oi) => `
        <div class="kp-block">
          <div class="kp-block-head">
            <i class="bi bi-person-fill"></i> মালিক ${toBn(oi + 1)} — ${o.name}
            <span class="kp-head-pill">${toBn((o.fraction * 100).toFixed(4))}%</span>
          </div>
          <div class="kp-owner-meta">
            <span>${o.relationName}: <b>${o.guardian || '—'}</b></span>
            <span>সাং: <b>${o.address || '—'}</b></span>
          </div>
          <div class="kp-scroll">
            <table class="kp-matrix">
              <thead><tr>
                <th class="kp-left">দাগ নং</th><th class="kp-left">শ্রেণী</th>
                <th>দাগের মোট</th><th>খতিয়ানে দাগের জমি</th>
                <th>এই মালিকের অংশ</th><th>বর্গফুটে</th>
              </tr></thead>
              <tbody>
                ${res.dags.map((d, di) => `<tr>
                  <td class="kp-left">${d.no}</td>
                  <td class="kp-left">${d.cls || '—'}</td>
                  <td>${d.hasTotal ? n(d.totalArea) + ' ' + u : '—'}</td>
                  <td>${n(d.khotianArea)} ${u}</td>
                  <td><b>${n(o.perDag[di])} ${u}</b></td>
                  <td>${sq(o.perDagSqft[di])}</td>
                </tr>`).join('')}
              </tbody>
              <tfoot><tr>
                <td class="kp-left" colspan="4">মোট জমি (${toBn(res.dagCount)} দাগে)</td>
                <td>${n(o.total)} ${u}</td>
                <td>${sq(o.totalSqft)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>`).join('') + (res.unallocatedTotal > 0 ? `
        <div class="kp-block kp-block-muted">
          <div class="kp-block-head"><i class="bi bi-people"></i> অন্য মালিকগণ (তালিকায় নেই)
            <span class="kp-head-pill">${toBn((res.hissaShortfall * 100).toFixed(4))}%</span>
          </div>
          <div class="kp-scroll">
            <table class="kp-matrix">
              <thead><tr><th class="kp-left">দাগ নং</th><th>অবশিষ্ট জমি</th><th>বর্গফুটে</th></tr></thead>
              <tbody>${res.dags.map(d => `<tr><td class="kp-left">${d.no}</td>
                <td><b>${n(d.unallocated)} ${u}</b></td><td>${sq(d.unallocatedSqft)}</td></tr>`).join('')}</tbody>
              <tfoot><tr><td class="kp-left">সর্বমোট</td>
                <td>${n(res.unallocatedTotal)} ${u}</td><td>${sq(res.unallocatedSqft)}</td></tr></tfoot>
            </table>
          </div>
        </div>` : '');
    }

    // ---- তুলনামূলক ম্যাট্রিক্স (ডেস্কটপে বাড়তি সুবিধা) ----
    const mx = document.getElementById('kp-matrix-wrap');
    if (mx) {
      mx.innerHTML = (!hasData || res.ownerCount < 2) ? '' : `
        <div class="kp-block">
          <div class="kp-block-head"><i class="bi bi-table"></i> এক নজরে (মালিক × দাগ)</div>
          <div class="kp-scroll">
            <table class="kp-matrix">
              <thead><tr><th class="kp-sticky kp-left">দাগ নং</th><th>খতিয়ানে</th>
                ${res.owners.map(o => `<th>${o.name}<br><span class="kp-sub">${toBn((o.fraction * 100).toFixed(2))}%</span></th>`).join('')}
                ${res.unallocatedTotal > 0 ? '<th>অন্যরা</th>' : ''}
              </tr></thead>
              <tbody>
                ${res.dags.map((d, di) => `<tr>
                  <td class="kp-sticky kp-left">${d.no}</td>
                  <td><b>${n(d.khotianArea)}</b></td>
                  ${res.owners.map(o => `<td>${n(o.perDag[di])}</td>`).join('')}
                  ${res.unallocatedTotal > 0 ? `<td class="kp-muted">${n(d.unallocated)}</td>` : ''}
                </tr>`).join('')}
              </tbody>
              <tfoot><tr><td class="kp-sticky kp-left">সর্বমোট</td><td>${n(res.khotianTotal)}</td>
                ${res.owners.map(o => `<td>${n(o.total)}</td>`).join('')}
                ${res.unallocatedTotal > 0 ? `<td>${n(res.unallocatedTotal)}</td>` : ''}
              </tr></tfoot>
            </table>
          </div>
        </div>`;
    }

    // ---- তফসিল ----
    const tof = document.getElementById('kp-tofasil');
    if (tof) {
      const rows = hasData ? res.owners.filter(o => o.total > 0) : [];
      tof.innerHTML = !rows.length ? '' : `
        <div class="kp-tofasil">
          <div class="kp-tofasil-head"><i class="bi bi-file-text"></i> তফসিলের জন্য বিবরণ</div>
          ${rows.map(o => {
            const line = PorchaMath.tofasilLine(o, res.dags, u, dec);
            const full = `${o.name}, ${o.relationName}: ${o.guardian || '—'}, সাং: ${o.address || '—'} — `
              + `মোট ${n(o.total)} ${u}। ${line}`;
            return `<div class="kp-tofasil-row">
              <div><b>${o.name}</b> — মোট ${n(o.total)} ${u}<p>${line || '—'}</p></div>
              <button class="lf-copy" title="কপি করুন" aria-label="কপি করুন"
                      onclick="AppController.copyFormula('${full.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">
                <i class="bi bi-clipboard"></i></button>
            </div>`;
          }).join('')}
        </div>`;
    }
  },

  /** টুল পরীক্ষার জন্য নমুনা তথ্য */
  loadPorchaSample() {
    const S = PorchaMath.sampleData();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('kp-district', S.district);
    set('kp-upazila', S.upazila);
    set('kp-mouza', S.mouza);
    set('kp-jl', S.jl);
    set('kp-khotian-no', S.khNo);
    set('kp-total-owners', toBn(S.totalOwners));
    set('kp-unit', S.unit);
    set('kp-rep-name', S.repName);
    set('kp-rep-title', S.repTitle);
    set('kp-rep-mobile', S.repMobile);
    const t = document.getElementById('kp-type');
    if (t) t.value = S.khType;

    this.porchaType = S.hissaType;
    this.porchaOwners = S.owners.map(o => ({ ...o, data: { ...o.data } }));
    this.porchaDags = S.dags.map(d => ({
      no: d.no, cls: d.cls,
      totalArea: d.totalArea ? toBn(d.totalArea.toFixed(2)) : '',
      khotianArea: toBn(d.khotianArea.toFixed(2))
    }));

    this.renderPorchaTypeSeg();
    this.renderPorchaOwners();
    this.renderPorchaDags();
    this.onPorchaKhTypeChange();
    this.showToast('নমুনা তথ্য লোড হয়েছে');
  },

  resetPorcha() {
    ['kp-district', 'kp-upazila', 'kp-mouza', 'kp-jl', 'kp-khotian-no',
     'kp-total-owners', 'kp-rep-name', 'kp-rep-title', 'kp-rep-mobile'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const t = document.getElementById('kp-type'); if (t) t.value = '';
    const h = document.getElementById('kp-type-hint'); if (h) h.innerHTML = '';

    this.porchaType = 'decimal';
    this.porchaDags = [{ no: '', cls: '', totalArea: '', khotianArea: '' }];
    this.porchaOwners = [{ name: '', relation: 'father', guardian: '', address: '', data: {} }];
    this.renderPorchaTypeSeg();
    this.renderPorchaOwners();
    this.renderPorchaDags();
    this.runPorcha();
  },

  printPorcha() {
    const res = this.lastPorcha;
    if (!res || !res.dagCount || !res.ownerCount || !res.khotianTotal) {
      alert('আগে দাগ ও মালিকের তথ্য দিন।');
      return;
    }
    const u = res.unit, dec = res.decimals;
    const n = x => toBn(Number(x).toFixed(dec));
    const sq = x => toBn(Number(x).toFixed(1));
    const v = id => document.getElementById(id)?.value?.trim() || '';
    const typeName = (PorchaMath.KHOTIAN_TYPES.find(
      t => t.id === document.getElementById('kp-type')?.value) || {}).name || '—';

    let container = document.getElementById('print-report-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'print-report-container';
      document.body.appendChild(container);
    }
    const dateBn = toBn(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));

    const dagTable = `
      <table class="pr-table pr-table-sm">
        <thead><tr><th class="pr-left">ক্র.</th><th class="pr-left">দাগ নং</th><th class="pr-left">শ্রেণী</th>
          <th>দাগের মোট</th><th>খতিয়ানে দাগের জমি</th><th>বর্গফুট</th></tr></thead>
        <tbody>${res.dags.map((d, i) => `<tr>
          <td class="pr-left">${toBn(i + 1)}</td><td class="pr-left">${d.no}</td>
          <td class="pr-left">${d.cls || '—'}</td>
          <td>${d.hasTotal ? n(d.totalArea) : '—'}</td>
          <td>${n(d.khotianArea)}</td><td>${sq(d.khotianSqft)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td class="pr-left" colspan="4">মোট খতিয়ান জমি</td>
          <td>${n(res.khotianTotal)}</td><td>${sq(res.khotianTotalSqft)}</td></tr></tfoot>
      </table>`;

    const ownerTables = res.owners.map((o, oi) => `
      <div class="pr-assets">
        <h3>মালিক ${toBn(oi + 1)} — ${o.name} (অংশ ${toBn((o.fraction * 100).toFixed(4))}%)</h3>
        <p class="pr-inline"><span><b>${o.relationName}:</b> ${o.guardian || '—'}</span>
          <span><b>সাং:</b> ${o.address || '—'}</span></p>
        <table class="pr-table pr-table-sm">
          <thead><tr><th class="pr-left">দাগ নং</th><th class="pr-left">শ্রেণী</th>
            <th>খতিয়ানে দাগের জমি</th><th>এই মালিকের অংশ</th><th>বর্গফুট</th></tr></thead>
          <tbody>${res.dags.map((d, di) => `<tr>
            <td class="pr-left">${d.no}</td><td class="pr-left">${d.cls || '—'}</td>
            <td>${n(d.khotianArea)}</td><td>${n(o.perDag[di])}</td>
            <td>${sq(o.perDagSqft[di])}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td class="pr-left" colspan="3">মোট (${toBn(res.dagCount)} দাগে)</td>
            <td>${n(o.total)} ${u}</td><td>${sq(o.totalSqft)}</td></tr></tfoot>
        </table>
        <p class="pr-note" style="margin-top:4px"><b>তফসিল:</b>
          ${PorchaMath.tofasilLine(o, res.dags, u, dec) || '—'}</p>
      </div>`).join('');

    const others = res.unallocatedTotal > 0 ? `
      <div class="pr-assets">
        <h3>অন্য মালিকগণ (এই রিপোর্টে বিশ্লেষিত নন) — অংশ ${toBn((res.hissaShortfall * 100).toFixed(4))}%</h3>
        <p class="pr-inline">${res.dags.map(d =>
          `<span>দাগ ${d.no}: ${n(d.unallocated)} ${u}</span>`).join('')}
          <span><b>সর্বমোট: ${n(res.unallocatedTotal)} ${u}</b></span></p>
      </div>` : '';

    container.innerHTML = `
      <div class="pr-head">
        <h1>খতিয়ান বিশ্লেষণ রিপোর্ট</h1>
        <div class="pr-sub">মালিকের অংশ, দাগ ও ভূমির পরিমাণ বিশ্লেষণ</div>
      </div>

      <div class="pr-meta">
        <div><b>জেলা:</b> ${v('kp-district') || '—'} &nbsp; <b>উপজেলা:</b> ${v('kp-upazila') || '—'}</div>
        <div style="text-align:right"><b>তারিখ:</b> ${dateBn}</div>
      </div>
      <div class="pr-meta">
        <div><b>মৌজা:</b> ${v('kp-mouza') || '—'} &nbsp; <b>জে.এল. নং:</b> ${v('kp-jl') || '—'}</div>
        <div style="text-align:right"><b>একক:</b> ${u}</div>
      </div>
      <div class="pr-meta">
        <div><b>খতিয়ানের ধরণ:</b> ${typeName} &nbsp; <b>খতিয়ান নং:</b> ${v('kp-khotian-no') || '—'}</div>
        <div style="text-align:right"><b>দাগ:</b> ${toBn(res.dagCount)} টি</div>
      </div>
      <div class="pr-meta">
        <div><b>বিশ্লেষণ:</b> ${res.totalOwners
          ? `মোট ${toBn(res.totalOwners)} জন মালিকের মধ্যে ${toBn(res.ownerCount)} জনের`
          : `${toBn(res.ownerCount)} জন মালিকের`}</div>
        <div style="text-align:right"><b>মোট জমি:</b> ${n(res.khotianTotal)} ${u}</div>
      </div>

      <div class="pr-assets"><h3>দাগের তালিকা</h3>${dagTable}</div>

      ${ownerTables}
      ${others}

      ${!res.isFull ? `<p class="pr-note"><b>দ্রষ্টব্য:</b> এটি আংশিক বিশ্লেষণ — তালিকাভুক্ত
        মালিকদের অংশের যোগ ${toBn((res.hissaSum * 100).toFixed(2))}%। অবশিষ্ট অংশ অন্য
        মালিকদের, তাদের অংশ কারো সাথে যোগ করা হয়নি।</p>` : ''}

      <p class="pr-note">বিশ্লেষণ করা হয়েছে <b>খতিয়ানে দাগের জমির</b> উপর (দাগের মোট জমির উপর নয়)।
      দশমিকের পর ${toBn(dec)} ঘর পর্যন্ত হিসাব।${res.anyAdjusted
        ? ' রাউন্ডিংয়ের অবশিষ্ট সমন্বয় করা হয়েছে, তাই প্রতিটি দাগের যোগফল মিলে যায়।' : ''}</p>

      <p class="pr-note">সতর্কীকরণ: এই রিপোর্ট একটি স্বয়ংক্রিয় ক্যালকুলেটর দ্বারা প্রস্তুত।
      দলিল বা নামজারিতে ব্যবহারের আগে অভিজ্ঞ আইনজীবী/সার্ভেয়ারের মাধ্যমে যাচাই করে নিন।</p>

      <div class="pr-sign">
        <div>${v('kp-rep-name') || 'রিপোর্টকারীর স্বাক্ষর'}${
          v('kp-rep-title') ? '<br><span style="font-weight:400">' + v('kp-rep-title') + '</span>' : ''}${
          v('kp-rep-mobile') ? '<br><span style="font-weight:400">' + v('kp-rep-mobile') + '</span>' : ''}</div>
        <div>সাক্ষীর স্বাক্ষর</div>
        <div>তারিখ ও সীলমোহর</div>
      </div>
      <div class="pr-foot">Land Info — ফ্রি ডিজিটাল ভূমি সার্ভিস</div>`;

    window.print();
  },

  resetMouzaValue() {
    ['mv-district', 'mv-office'].forEach(id => {
      const s = document.getElementById(id);
      if (s) { s.innerHTML = '<option value="">—</option>'; s.disabled = true; }
    });
    const d = document.getElementById('mv-division');
    if (d) d.value = '';
    const y = document.getElementById('mv-year');
    if (y) y.value = MouzaValue.YEARS[0];
    this.fillMouzaSelect('mv-district', [], 'আগে বিভাগ বাছুন');
    this.fillMouzaSelect('mv-office', [], 'আগে জেলা বাছুন');
    const frame = document.getElementById('mv-frame');
    if (frame) frame.src = 'about:blank';
    this.hideMouzaResult();
  }
};
