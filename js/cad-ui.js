/* ==========================================================================
   cad-ui.js — ডিজিটাল সার্ভে (CAD) টুলের নিয়ন্ত্রণ
   --------------------------------------------------------------------------
   পর্দার সব বোতাম, তালিকা ও ফর্ম এখানে। গণিত নেই — সেটি
   CadCore / CadTrace / CadOverlay / CadSheet / CadGeo তে।
   ========================================================================== */

const CadApp = {

  doc: null,
  src: null,            // { canvas, bytes, name, width, height, dpi }
  src2: null,           // পেন্টাগ্রাফের দ্বিতীয় নকশা
  started: false,
  tab: 'layers',
  geo: { open: false, imgPts: [], mapPts: [], awaiting: 'img' },
  _loadTarget: 1,

  /* ==================== চালু ==================== */

  init() {
    if (!this.doc) this.doc = CadCore.newDoc();
    this._fillScaleOptions();
    this.renderMeta();
    this.renderLayers();
    this.renderSurveyPick();
    this.renderSources();
    this.renderSteps();
    this.show(this.started ? 'work' : 'start');
    if (this.started) {
      /* ★ ফিরে এলে সব যেন আগের মতোই চলে
         অন্য টুলে গিয়ে ফিরে এলে ডান পাশের তালিকা, উপরের “ডিজাইনে খুলুন”
         ও ফেরত/আবার বোতামগুলো আগের অবস্থায় আটকে থাকত — তাই এখানেই সব
         আবার এঁকে দিই, আর ক্যানভাসের মাপও নতুন করে নিই। */
      this.renderFeatures();
      this.renderStats();
      this.renderRasters();
      if (CadView.state) CadView._syncHistoryBtns();
      setTimeout(() => {
        this.sizeCanvas();
        this._initView();                     // ক্যানভাস বদলে থাকলে আবার বাঁধি
        if (CadView.state) this.tool(CadView.state.tool || 'pan');
        CadView.draw();
      }, 60);
    }
  },

  /* ==================== ধাপের পথনির্দেশ ====================
     ★ কেন দরকার
       টুলটিতে অনেক কিছু আছে — কোনটা আগে কোনটা পরে, তা না জানলে
       ব্যবহারকারী আটকে যান। তাই উপরে সবসময় ছয়টি ধাপ দেখানো হয়:
       কোনটা শেষ, কোনটা এখন করতে হবে। ধাপে ক্লিক করলেই সেই কাজে যাওয়া যায়।
     ======================================================== */

  STEPS: [
    { id: 'src',   n: '১', label: 'নকশা',       icon: 'bi-image' },
    { id: 'scale', n: '২', label: 'স্কেল',       icon: 'bi-rulers' },
    { id: 'trace', n: '৩', label: 'ডিজিটাইজ',   icon: 'bi-stars' },
    { id: 'dag',   n: '৪', label: 'দাগ নম্বর',   icon: 'bi-hash' },
    { id: 'sheet', n: '৫', label: 'শিট',        icon: 'bi-file-earmark-text' },
    { id: 'geo',   n: '৬', label: 'গুগল ম্যাপ',  icon: 'bi-globe-americas' }
  ],

  /** কোন ধাপ শেষ হয়েছে */
  stepDone(id) {
    const d = this.doc;
    switch (id) {
      case 'src':   return !!(this.src || (CadView.state && CadView.state.rasters.length) || d.features.length);
      case 'scale': return d.ftPerPx > 0;
      case 'trace': return d.features.length > 0;
      case 'dag':   return d.features.some(f => f.dag);
      case 'sheet': return !!(d.meta.mouza || d.meta.district);
      case 'geo':   return CadGeo.hasGeo(d);
    }
    return false;
  },

  /** এখন কোন ধাপে আছি — প্রথম যেটি বাকি */
  currentStep() {
    for (const s of this.STEPS) if (!this.stepDone(s.id)) return s.id;
    return 'geo';
  },

  renderSteps() {
    const box = document.getElementById('cad-steps');
    if (!box) return;
    const cur = this.currentStep();
    box.innerHTML = this.STEPS.map(s => {
      const done = this.stepDone(s.id);
      const active = s.id === cur;
      return `<button type="button" class="cad-step${done ? ' done' : ''}${active ? ' active' : ''}"
                onclick="CadApp.gotoStep('${s.id}')" title="${s.label}">
        <span class="cad-step-n">${done ? '<i class="bi bi-check-lg"></i>' : s.n}</span>
        <span class="cad-step-t">${s.label}</span>
      </button>`;
    }).join('<span class="cad-step-sep"></span>');

    const hint = document.getElementById('cad-next-hint');
    if (hint) {
      const msg = {
        src:   'শুরু করুন — মৌজা নকশার PDF বা ছবি দিন।',
        scale: '<b>স্কেল</b> বসান: বাঁয়ের রুলার টুল নিয়ে চেনা দূরত্বের দুই প্রান্তে ক্লিক করে মাপ লিখুন। এটি ছাড়া ক্ষেত্রফল বেরোবে না।',
        trace: '<b>স্বয়ংক্রিয় ডিজিটাইজ</b> চাপুন — নকশার সব দাগ একসাথে ভেক্টর হবে। অথবা জাদুকাঠি দিয়ে এক ক্লিকে একটি করে।',
        dag:   '<b>দাগ নম্বর</b> বসান — ডানের “দাগ” ট্যাবে তালিকা ধরে ধরে লিখুন, বা ক্যানভাসে দাগে ক্লিক করে বিস্তারিত ঘরে লিখুন।',
        sheet: '<b>শিট</b> ট্যাবে জেলা, উপজেলা, মৌজা ও পরিমাপকারির নাম দিন — তারপর রপ্তানি ট্যাব থেকে A4 শিট ছাপুন।',
        geo:   '<b>গুগল ম্যাপে বসাতে</b> বাঁয়ের <i class="bi bi-geo-alt"></i> চাপুন — নকশা ও স্যাটেলাইটে ২–৫ জোড়া চেনা বিন্দু মিলিয়ে দিন।'
      }[cur];
      hint.innerHTML = '<i class="bi bi-lightbulb"></i> ' + (msg || '');
      hint.style.display = cur === 'geo' && CadGeo.hasGeo(this.doc) ? 'none' : '';
    }
  },

  gotoStep(id) {
    switch (id) {
      case 'src':   this.reset(); break;
      case 'scale': this.setTab('layers'); this.tool('scale'); break;
      case 'trace': this.setTab('layers'); this.autoDigitize(); break;
      case 'dag':   this.setTab('dags'); break;
      case 'sheet': this.setTab('sheet'); break;
      case 'geo':   this.geoOpen(); break;
    }
  },

  show(what) {
    const start = document.getElementById('cad-start');
    const work = document.getElementById('cad-work');
    const bar = document.getElementById('cad-workbar');
    if (start) start.style.display = what === 'start' ? '' : 'none';
    if (work) work.style.display = what === 'work' ? '' : 'none';
    if (bar) bar.style.display = what === 'work' ? '' : 'none';
    if (what === 'work') this.renderSteps();
  },

  status(msg, bad) {
    const el = document.getElementById('cad-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.className = 'cad-status' + (bad ? ' bad' : '');
    el.textContent = msg;
  },

  prog(pct, msg) {
    const box = document.getElementById('cad-prog');
    const fill = document.getElementById('cad-prog-fill');
    const txt = document.getElementById('cad-prog-txt');
    if (!box) return;
    if (pct == null) { box.style.display = 'none'; return; }
    box.style.display = '';
    if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    if (txt) txt.textContent = msg || '';
  },

  sizeCanvas() {
    const c = document.getElementById('cad-canvas');
    if (!c || !c.parentElement) return;
    const r = c.parentElement.getBoundingClientRect();
    const w = Math.max(320, Math.round(r.width));
    const h = Math.max(320, Math.round(r.height));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  },

  /* ==================== উৎস ==================== */

  /* ==================== কোন জরিপের নকশা ====================
     আপলোডের সময়ই ঠিক করে নেওয়া হয় — তাতে সব দাগ সঠিক লেয়ারে যায়,
     রঙ ও সাংকেতিক চিহ্নও আপনাআপনি মিলে যায়। পরে বদলানোও যায়।
     ======================================================== */

  SURVEYS: [
    { id: 'cs',   short: 'সি.এস',  full: 'সি এস জরিপ (পুরনো)' },
    { id: 'sa',   short: 'এস.এ',   full: 'এস এ জরিপ' },
    { id: 'rs',   short: 'আর.এস',  full: 'আর এস জরিপ' },
    { id: 'bs',   short: 'বি.এস',  full: 'বি এস / সিটি জরিপ (নতুন)' },
    { id: 'dag',  short: 'অন্য',   full: 'অন্য / সাধারণ দাগ' }
  ],

  survey: 'bs',

  renderSurveyPick() {
    const box = document.getElementById('cad-survey-pick');
    if (!box) return;
    box.innerHTML = this.SURVEYS.map(s => {
      const L = CadCore.layerPreset(s.id);
      return `<button type="button" class="cad-pill${s.id === this.survey ? ' active' : ''}"
                title="${s.full}" onclick="CadApp.setSurvey('${s.id}')">
        <span class="cad-pill-dot" style="background:${L.color}"></span>${s.short}</button>`;
    }).join('');
    const lbl = document.getElementById('cad-survey-now');
    if (lbl) {
      const s = this.SURVEYS.find(x => x.id === this.survey);
      lbl.textContent = s ? s.full : '';
    }
  },

  setSurvey(id) {
    this.survey = id;
    this.renderSurveyPick();
    if (CadView.state) { CadView.setLayer(id); this.renderLayers(); }
  },

  /* ==================== নকশার উৎস ====================
     নকশা নানা জায়গায় থাকে — নিজস্ব আর্কাইভ, সরকারি পোর্টাল, গুগল ড্রাইভ,
     অফিসের সার্ভার। সব উৎস এক তালিকায়, আর নিজেও নতুন উৎস যোগ করা যায়।
     ==================================================== */

  renderSources() {
    const box = document.getElementById('cad-sources');
    if (!box || typeof MouzaMultiSource === 'undefined') return;
    box.innerHTML = MouzaMultiSource.all().map(s => `
      <button type="button" class="cad-src${s.direct ? '' : ' ext'}"
              onclick="CadApp.useSource('${s.id}')" title="${s.note}">
        <span class="cad-src-ic" style="background:${s.color}1a;color:${s.color}">
          <i class="bi ${s.icon}"></i></span>
        <span class="cad-src-body">
          <b>${s.name}${s.direct ? '' : ' <i class="bi bi-box-arrow-up-right"></i>'}</b>
          <small>${s.note}</small>
        </span>
        ${s.custom ? `<span class="cad-src-x" title="বাদ দিন"
           onclick="event.stopPropagation();CadApp.delSource('${s.id}')">
           <i class="bi bi-x-lg"></i></span>` : ''}
      </button>`).join('');
  },

  useSource(id) {
    const s = MouzaMultiSource.get(id);
    if (!s) return;
    if (s.kind === 'portal') {
      window.open(s.url, '_blank', 'noopener');
      this.status('<b>' + s.name + '</b> নতুন ট্যাবে খোলা হয়েছে। '
        + 'সেখান থেকে নকশাটি নামিয়ে এখানে <b>“কম্পিউটার / ফোন থেকে”</b> দিয়ে আপলোড করুন — '
        + 'বাকি কাজ একই। (সরকারি সাইট লগইন/ক্যাপচা চায়, তাই সরাসরি আনা যায় না।)');
      return;
    }
    if (s.kind === 'upload') { this.choose('file'); return; }
    if (s.kind === 'archive') { this.choose('archive'); return; }
    if (s.kind === 'link') {
      const box = document.getElementById('cad-link-box');
      if (box) {
        box.style.display = '';
        const inp = document.getElementById('cad-link-url');
        if (inp) { if (s.custom && s.url) inp.value = s.url; inp.focus(); }
      }
      return;
    }
  },

  /** লিংক / ড্রাইভ থেকে নকশা আনা */
  async fetchLink() {
    const inp = document.getElementById('cad-link-url');
    const txt = inp ? inp.value : '';
    if (!String(txt).trim()) { this.status('নকশার লিংক বসান।', true); return; }
    this.prog(5, 'লিংক পড়া হচ্ছে…');
    try {
      const got = await MouzaMultiSource.fetchLink(txt, (p, m) => this.prog(p, m));
      const mime = MouzaMultiSource.sniff(got.bytes) || got.mime;
      const r = await KmzSource.toImage(got.bytes, mime, {
        onStage: (p, m) => this.prog(80 + p * 0.2, m), needBytes: false
      });
      this.prog(null);
      const box = document.getElementById('cad-link-box');
      if (box) box.style.display = 'none';
      await this.useImage(r, got.name);
    } catch (e) {
      this.prog(null);
      this.status(e.message, true);
    }
  },

  addSource() {
    const n = document.getElementById('cad-src-name');
    const u = document.getElementById('cad-src-url');
    const r = MouzaMultiSource.addCustom({ name: n ? n.value : '', url: u ? u.value : '' });
    if (!r.ok) { this.status(r.error, true); return; }
    if (n) n.value = ''; if (u) u.value = '';
    this.renderSources();
    this.status('উৎস যোগ হয়েছে — এই ব্রাউজারে সংরক্ষিত থাকবে।');
  },

  delSource(id) {
    MouzaMultiSource.removeCustom(id);
    this.renderSources();
    this.status('উৎসটি বাদ দেওয়া হয়েছে।');
  },

  choose(kind, target) {
    this._loadTarget = target || 1;
    if (kind === 'file') {
      const inp = document.getElementById('cad-file');
      if (inp) { inp.value = ''; inp.click(); }
    } else if (kind === 'archive') {
      // পুরনো KMZ টুলের আর্কাইভ বাছাই কাজে লাগাই
      AppController.openToolModal('kmz-export');
      AppController.kmzChoose('archive');
      this.status('আর্কাইভ থেকে নকশা নামিয়ে "CAD এ পাঠান" চাপুন।');
    } else if (kind === 'blank') {
      this.started = true;
      this.show('work');
      setTimeout(() => {
        this.sizeCanvas();
        this._initView();
        this.status('খালি পাতায় আঁকা শুরু করুন — আগে স্কেল বসিয়ে নিন।');
      }, 60);
    }
  },

  loadFile(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onerror = () => this.status('ফাইলটি পড়া গেল না।', true);
    reader.onload = async () => {
      this.prog(5, 'ফাইল পড়া হচ্ছে…');
      try {
        const bytes = new Uint8Array(reader.result);
        const r = await KmzSource.toImage(bytes, f.type, {
          onStage: (p, m) => this.prog(p, m)
        });
        this.prog(null);
        await this.useImage(r, f.name);
      } catch (e) {
        this.prog(null);
        this.status(e.message, true);
      }
    };
    reader.readAsArrayBuffer(f);
  },

  /** ছবিটি কাজের ক্যানভাসে বসানো */
  async useImage(r, name) {
    const canvas = r.canvas || r.img;
    const info = {
      canvas: canvas.getContext ? canvas : this._toCanvas(canvas),
      bytes: r.bytes || null,
      name: name || 'নকশা',
      width: r.width, height: r.height,
      dpi: r.pdfScale ? Math.round(72 * r.pdfScale) : null
    };

    const sv = this.SURVEYS.find(x => x.id === this.survey) || this.SURVEYS[3];
    info.survey = this.survey;

    if (this._loadTarget === 2) {
      this.src2 = info;
      this.started = true; this.show('work');
      setTimeout(() => {
        this.sizeCanvas();
        this._initView();
        CadView.addRaster(info.canvas, sv.short + ' নকশা', { opacity: 0.45 });
        CadView.setLayer(this.survey);
        CadView.state.traceCache = {};
        this.renderRasters(); this.renderLayers(); this.renderSteps();
        this.status('দ্বিতীয় নকশা (' + sv.full + ') যোগ হয়েছে। চলতি লেয়ার এখন '
          + CadCore.layerPreset(this.survey).name + ' — এখন ডিজিটাইজ করলে দাগগুলো ঐ লেয়ারেই যাবে। '
          + 'দুই নকশা এক জায়গায় বসাতে ভূ-স্থানাঙ্ক ব্যবহার করুন।');
      }, 60);
      return;
    }

    this.src = info;
    this.started = true;
    this.show('work');
    setTimeout(() => {
      this.sizeCanvas();
      this._initView();
      CadView.state.rasters = [];
      CadView.addRaster(info.canvas, sv.short + ' নকশা', { opacity: 0.6 });
      CadView.setLayer(this.survey);
      CadView.state.traceCache = {};
      CadView.fit();
      this.renderRasters(); this.renderLayers(); this.renderSteps();
      this.status(sv.full + ' — নকশা প্রস্তুত (' + CadCore.bn(r.width) + '×' + CadCore.bn(r.height)
        + ' পিক্সেল)। দাগগুলো ' + CadCore.layerPreset(this.survey).name
        + ' লেয়ারে যাবে। এবার স্কেল বসান, তারপর ডিজিটাইজ করুন।');
    }, 60);
  },

  _toCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
  },

  _initView() {
    const c = document.getElementById('cad-canvas');
    if (!c) return;
    if (!c._cadInit) {
      c._cadInit = true;
      CadView.init(c, {
        doc: this.doc,
        onChange: () => { this.renderFeatures(); this.renderStats(); },
        onStatus: m => this.status(m),
        onScaleAsk: (px, pts) => this.askScale(px, pts),
        onGcp: ip => this.geoImgPick(ip)
      });
    } else {
      CadView.state.canvas = c;
      CadView.state.doc = this.doc;
      CadView.draw();
    }
    // আপলোডের আগে বাছা জরিপটিই চলতি লেয়ার — ক্যানভাস দেরিতে তৈরি হলেও
    if (this.survey) CadView.state.activeLayer = this.survey;
    this.renderFeatures();
    this.renderStats();
  },

  /* ==================== টুল ==================== */

  tool(t) {
    CadView.setTool(t);
    document.querySelectorAll('#cad-tools .cad-tool').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tool') === t);
    });
  },

  layer(id) {
    CadView.setLayer(id);
    this.renderLayers();
  },

  toggleShow(key, el) {
    const s = CadView.state;
    if (!s) return;
    s.show[key] = !s.show[key];
    if (el) el.classList.toggle('active', s.show[key]);
    CadView.draw();
  },

  fit() { CadView.fit(); },
  undo() { CadView.undo(); },
  redo() { CadView.redo(); },
  del() { CadView.deleteSelected(); },
  selectAll() {
    CadView.selectAll();
    this.renderFeatures(); this.renderStats();
    this.status(CadCore.bn(CadView.state.selection.length) + 'টি দাগ বাছা হয়েছে'
      + (this.doc.ftPerPx > 0 ? ' — মোট ' + CadCore.satakText(CadView.selectionArea()) : ''));
  },

  /** একাধিক বাছাই চালু/বন্ধ */
  toggleMulti() {
    const on = CadView.setMultiSelect(!CadView.state.multiSelect);
    this.renderMultiBtn();
    this.renderFeatures();
    return on;
  },

  renderMultiBtn() {
    const on = CadView.state && CadView.state.multiSelect;
    ['cad-multi-btn', 'cad-multi-btn2'].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      b.classList.toggle('active', !!on);
      b.innerHTML = '<i class="bi bi-' + (on ? 'check2-square' : 'square') + '"></i> একাধিক বাছাই'
        + (on ? ' চালু' : '');
    });
    document.querySelectorAll('#cad-tools .cad-tool').forEach(t => {
      if (t.getAttribute('data-tool') === 'select') t.classList.toggle('multi', !!on);
    });
  },

  clearSelection() {
    CadView.state.selection = [];
    CadView.draw();
    this.renderFeatures(); this.renderStats();
    this.status('তালিকা খালি করা হয়েছে');
  },

  /** বাছা দাগগুলো অন্য লেয়ারে সরানো */
  moveSel(layerId) {
    const n = CadView.moveToLayer(layerId);
    this.renderLayers(); this.renderFeatures(); this.renderStats();
    this.status(n ? CadCore.bn(n) + 'টি দাগ ' + CadCore.layerPreset(layerId).name
      + ' লেয়ারে সরানো হয়েছে' : 'আগে দাগ বাছুন।', !n);
  },

  /** বাছা দাগগুলোর সারসংক্ষেপ ও কাজের বোতাম */
  renderSelected() {
    const box = document.getElementById('cad-selected');
    if (!box) return;
    const s = CadView.state;
    const ids = s ? s.selection : [];
    if (!ids.length) {
      box.innerHTML = '<div class="cad-empty-mini">কোনো দাগ বাছা হয়নি। ক্যানভাসে দাগে ক্লিক করুন, '
        + 'অথবা ফাঁকা জায়গা থেকে ঘের টেনে একসাথে অনেকগুলো নিন।</div>';
      return;
    }
    const feats = ids.map(id => CadCore.feature(this.doc, id)).filter(Boolean);
    const total = CadView.selectionArea();
    const dags = feats.map(f => f.dag ? CadCore.bn(f.dag) : '—');
    const shown = dags.slice(0, 24).join(', ') + (dags.length > 24 ? ' …' : '');

    box.innerHTML = `
      <div class="cad-sel-head">
        <b>${CadCore.bn(feats.length)}</b>টি দাগ বাছা
        ${this.doc.ftPerPx > 0 ? '<span>মোট ' + CadCore.satakText(total) + '</span>' : ''}
        <button type="button" class="cad-sel-x" title="তালিকা খালি করুন"
                onclick="CadApp.clearSelection()"><i class="bi bi-x-lg"></i></button>
      </div>
      <div class="cad-sel-dags">${shown}</div>
      <div class="cad-sel-acts">
        <button type="button" class="cad-mini" onclick="CadApp.isolate()">
          <i class="bi bi-eye"></i> কেবল এগুলো</button>
        <button type="button" class="cad-mini" onclick="CadApp.zoomSel()">
          <i class="bi bi-zoom-in"></i> কাছে দেখুন</button>
        <button type="button" class="cad-mini hot" onclick="DesignApp.openFromSelection()">
          <i class="bi bi-bounding-box-circles"></i> ডিজাইনে খুলুন</button>
        <button type="button" class="cad-mini danger" onclick="CadApp.del()">
          <i class="bi bi-trash"></i> মুছুন</button>
      </div>
      <div class="cad-sel-move">
        <span>লেয়ার বদলান:</span>
        ${this.doc.layers.filter(L => ['cs','sa','rs','bs','dag','prop','road','water'].includes(L.id))
          .map(L => `<button type="button" class="cad-chip" title="${L.name}"
             onclick="CadApp.moveSel('${L.id}')">
             <span style="background:${L.color}"></span>${L.name.replace(/\s*লাইন$/,'')}</button>`).join('')}
      </div>`;
  },

  zoomSel() {
    const s = CadView.state;
    if (!s.selection.length) return;
    const pts = [].concat(...s.selection
      .map(id => CadCore.feature(this.doc, id)).filter(Boolean).map(f => f.pts));
    CadView.zoomTo(pts, 0.7);
  },

  /** কাঁটা ও অতিরিক্ত কোণা পরিষ্কার */
  cleanup(dropSlivers) {
    if (!this.doc.features.length) { this.status('আগে দাগ আঁকুন বা ডিজিটাইজ করুন।', true); return; }
    const sel = CadView.state.selection.length;
    const r = CadView.cleanupGeometry({ dropSlivers: !!dropSlivers });
    this.renderFeatures(); this.renderStats();
    const where = sel ? 'নির্বাচিত ' + CadCore.bn(sel) + 'টি দাগে' : 'সব দাগে';
    this.status(where + ' পরিষ্কার হয়েছে — '
      + CadCore.bn(r.changed) + 'টির কোণা সারানো হয়েছে'
      + (r.removed ? ', ' + CadCore.bn(r.removed) + 'টি ফালি বাদ দেওয়া হয়েছে' : '')
      + '। ফল পছন্দ না হলে ফেরত (Ctrl+Z) চাপুন।');
  },

  /* ==================== দাগ নম্বর ধরে কাজ ====================
     ক্লায়েন্ট খতিয়ান নিয়ে আসেন — "২৪১, ২৪২, ২৪৩"। শুধু সেই দাগগুলো
     নিয়েই শিট, ক্ষেত্রফল ও রপ্তানি করা যায়।
     ======================================================== */

  findDags() {
    const inp = document.getElementById('cad-dag-find');
    const q = inp ? inp.value : '';
    if (!String(q).trim()) { this.status('দাগ নম্বর লিখুন — কমা দিয়ে একাধিকও দিতে পারেন।', true); return; }

    const r = CadCore.findByDag(this.doc, q);
    if (!r.found.length) {
      this.status('এই দাগ নম্বর পাওয়া যায়নি: ' + r.missing.map(m => CadCore.bn(m)).join(', ')
        + '। দাগ নম্বর বসানো আছে কি? ডানের তালিকায় দেখে নিন।', true);
      return;
    }

    CadView.state.selection = r.found.map(f => f.id);
    CadView.zoomTo([].concat(...r.found.map(f => f.pts)), 0.7);
    CadView.draw();
    this.renderFeatures(); this.renderStats();

    const total = r.found.reduce((s, f) => s + CadCore.measure(this.doc, f).sqft, 0);
    let msg = CadCore.bn(r.found.length) + 'টি দাগ পাওয়া গেছে';
    if (this.doc.ftPerPx > 0) msg += ' — মোট ' + CadCore.satakText(total);
    if (r.missing.length) msg += ' · পাওয়া যায়নি: ' + r.missing.map(m => CadCore.bn(m)).join(', ');
    msg += '। "কেবল এগুলো" চাপলে বাকি সব লুকিয়ে যাবে — তখন শিট ও রপ্তানিতে শুধু এগুলোই যাবে।';
    this.status(msg);
  },

  /** কেবল নির্বাচিত দাগ রেখে বাকি লুকান */
  isolate() {
    const n = CadView.isolate();
    if (!n) { this.status('আগে দাগ বাছুন বা দাগ নম্বর দিয়ে খুঁজুন।', true); return; }
    this.renderFeatures(); this.renderStats();
    const total = this.doc.features.filter(f => !f.hidden)
      .reduce((s, f) => s + CadCore.measure(this.doc, f).sqft, 0);
    this.status('কেবল ' + CadCore.bn(n) + 'টি দাগ দেখানো হচ্ছে'
      + (this.doc.ftPerPx > 0 ? ' — মোট ' + CadCore.satakText(total) : '')
      + '। শিট, KMZ ও তফসিল — সবেতেই এখন শুধু এগুলোই যাবে। '
      + '"সব দেখান" চাপলে আগের অবস্থায় ফিরবে।');
  },

  showAllFeatures() {
    const n = CadView.showAllFeatures();
    this.renderFeatures(); this.renderStats();
    this.status(n ? CadCore.bn(n) + 'টি লুকানো দাগ আবার দেখানো হচ্ছে' : 'সব দাগই দেখা যাচ্ছে');
  },

  /** সন্দেহজনক সরু দাগ বেছে দেখান — মোছার সিদ্ধান্ত ব্যবহারকারীর */
  pickThin() {
    const el = document.getElementById('cad-thin-lim');
    const lim = el ? (CadCore.num(el.value) || 20) / 100 : 0.2;
    const n = CadView.selectThin(lim);
    this.tool('select');
    this.renderFeatures(); this.renderStats();
    if (!n) { this.status('এই সীমায় সরু দাগ পাওয়া যায়নি — সীমা বাড়িয়ে দেখুন।'); return; }
    // প্রথমটিতে জুম করে দেখাই যাতে যাচাই করা যায়
    const f = CadCore.feature(this.doc, CadView.state.selection[0]);
    if (f) CadView.zoomTo(f.pts, 0.25);
    this.status(CadCore.bn(n) + 'টি সরু দাগ বেছে দেওয়া হয়েছে — দেখে নিন। '
      + 'সবগুলো ঠিকই মনে হলে Delete চাপুন; কোনোটি আসল দাগ হলে Shift+ক্লিক করে বাদ দিন। '
      + 'আইল বা নালা সত্যিই সরু হয়, তাই নিজে থেকে মুছি না।');
  },

  /** নির্বাচিত কোণা মুছুন */
  delVertex() {
    if (!CadView.deleteVertex()) return;
    this.renderFeatures(); this.renderStats();
  },

  /** সব মুছে নতুন করে শুরু */
  reset() {
    if (this.doc.features.length &&
        !confirm('আঁকা সব দাগ মুছে নতুন করে শুরু করবেন? সংরক্ষণ না করলে কাজটি ফিরবে না।')) return;
    this.doc = CadCore.newDoc();
    this.src = null; this.src2 = null;
    this.geo = { open: false, imgPts: [], mapPts: [], awaiting: 'img' };
    this.started = false;
    if (CadView.state) {
      CadView.state.rasters = [];
      CadView.state.traceCache = {};
      CadView.setDoc(this.doc);
    }
    this.show('start');
    this.renderMeta(); this.renderLayers();
    this.status(null);
  },

  /* ==================== স্কেল ==================== */

  _fillScaleOptions() {
    const sel = document.getElementById('cad-scale-preset');
    if (!sel || sel._filled) return;
    sel._filled = true;
    sel.innerHTML = CadCore.SCALES.map(s =>
      `<option value="${s.inch}">${s.label} — ${s.note}</option>`).join('');
    sel.value = String(this.doc.meta.scaleInch || 120);
  },

  /** চেনা দূরত্ব দিয়ে স্কেল বসানো */
  /**
   * মাপার আগেই “কত চেইন” ঠিক করে রাখা
   * ★ কেন
   *   আগে দুই প্রান্তে ক্লিক করার **পরে** ঘর খুলত, তখন ব্যবহারকারী ভাবতেন
   *   “কত লিখব?” — মাপকাঠির দিকে আবার তাকাতে হতো। এখন আগে বলে রাখুন
   *   ০–১০ চেইন না ০–৫ চেইন মাপবেন; তারপর দুই দাগে ক্লিক করলেই স্কেল বসে যায়।
   */
  scalePreset: null,

  setScalePreset(amt, unit) {
    if (amt == null) { this.scalePreset = null; }
    else this.scalePreset = { amt: Number(amt), unit: unit || 'chain' };
    document.querySelectorAll('#cad-scale-presets .cad-mini').forEach(b => {
      b.classList.toggle('hot', !!this.scalePreset
        && Number(b.dataset.amt) === this.scalePreset.amt
        && b.dataset.unit === this.scalePreset.unit);
    });
    const p = this.scalePreset;
    this.tool('scale');
    this.status(p
      ? 'ঠিক আছে — এখন নকশার মাপকাঠিতে <b>০</b> দাগে আর <b>'
        + CadCore.bn(String(p.amt)) + ' ' + CadCore.lengthUnit(p.unit).name
        + '</b> দাগে ক্লিক করুন। স্কেল আপনাআপনি বসে যাবে।'
      : 'দুই প্রান্তে ক্লিক করুন — তারপর মাপটি লিখতে বলা হবে।');
  },

  askScale(px, pts) {
    // আগেই বলে রাখা থাকলে ঘর না খুলে সরাসরি বসিয়ে দিই
    if (this.scalePreset) {
      const u = CadCore.lengthUnit(this.scalePreset.unit);
      const ft = this.scalePreset.amt * u.ft;
      if (ft > 0 && px > 0) {
        this.doc.ftPerPx = ft / px;
        CadView.draw();
        this.renderFeatures(); this.renderStats(); this.renderSteps();
        this.status('স্কেল বসানো হয়েছে — <b>' + CadCore.bn(String(this.scalePreset.amt))
          + ' ' + u.name + '</b> মাপা হয়েছে। এখন সব দাগের ক্ষেত্রফল বেরোবে। '
          + 'ভুল হলে আবার মেপে নিন।');
        return;
      }
    }
    const box = document.getElementById('cad-scale-ask');
    if (!box) return;
    this._fillUnitOptions();
    box.style.display = '';
    box.dataset.px = String(px);
    const info = document.getElementById('cad-scale-px');
    if (info) info.textContent = CadCore.bn(px.toFixed(1)) + ' পিক্সেল';
    this.scaleUnitChanged();
    const inp = document.getElementById('cad-scale-amt');
    if (inp) { inp.value = ''; inp.focus(); }
  },

  /** একক বদলালে ইঞ্চির ঘর ও ইঙ্গিত হালনাগাদ */
  scaleUnitChanged() {
    const sel = document.getElementById('cad-scale-unit');
    const inWrap = document.getElementById('cad-scale-in-wrap');
    const note = document.getElementById('cad-scale-unit-note');
    const u = CadCore.lengthUnit(sel ? sel.value : 'chain');
    if (inWrap) inWrap.style.display = u.id === 'foot' ? '' : 'none';
    if (note) note.textContent = u.note || '';
  },

  _fillUnitOptions() {
    const sel = document.getElementById('cad-scale-unit');
    if (!sel || sel._filled) return;
    sel._filled = true;
    sel.innerHTML = CadCore.LENGTH_UNITS
      .map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    sel.value = 'chain';                        // স্কেল-দণ্ড চেইনেই আঁকা থাকে
  },

  /**
   * চেনা দূরত্ব → স্কেল
   *
   * ★ সবচেয়ে নির্ভুল পথ: নকশার নিজের স্কেল-দণ্ড
   *   নকশায় ছাপা স্কেল-দণ্ডের দুই প্রান্তে (যেমন ০ থেকে ১০ চেইন) ক্লিক করে
   *   "১০ চেইন" লিখে দিলে পিক্সেল↔মাটির সম্পর্ক সরাসরি বেরিয়ে আসে —
   *   স্ক্যানের DPI জানার দরকারই পড়ে না। উল্টোদিকে, ছাপা স্কেল
   *   ("১৬\" = ১ মাইল") থেকে DPI যাচাইও হয়ে যায়।
   */
  applyKnownScale() {
    const box = document.getElementById('cad-scale-ask');
    const px = parseFloat(box && box.dataset.px);
    const amtInp = document.getElementById('cad-scale-amt');
    const unitSel = document.getElementById('cad-scale-unit');
    const inInp = document.getElementById('cad-scale-in');

    const unit = unitSel ? unitSel.value : 'foot';
    let total = CadCore.toFeet(amtInp ? amtInp.value : '', unit);
    // ফুট বাছলে সাথে ইঞ্চিও দেওয়া যায় (৫৯'-১" ধরনের মাপ)
    if (unit === 'foot') {
      const inch = CadCore.num(inInp ? inInp.value : '');
      if (isFinite(inch)) total = (isFinite(total) ? total : 0) + inch / 12;
    }

    if (!(px > 0) || !(total > 0)) { this.status('দূরত্ব ঠিকভাবে লিখুন।', true); return; }
    this.doc.ftPerPx = total / px;
    if (box) box.style.display = 'none';
    this.renderStats(); this.renderFeatures();
    CadView.draw();

    const u = CadCore.lengthUnit(unit);
    let msg = 'স্কেল বসেছে — ' + CadCore.bn(CadCore.num(amtInp.value)) + ' ' + u.name
      + ' = ' + CadCore.bn(px.toFixed(1)) + ' পিক্সেল · ১ পিক্সেল = '
      + CadCore.bn(this.doc.ftPerPx.toFixed(4)) + ' ফুট';

    /* যাচাই — নকশায় ছাপা স্কেল ধরে স্ক্যানের DPI কত হওয়া উচিত */
    const sc = this.doc.meta.scaleInch;
    if (sc > 0) {
      const dpi = CadCore.dpiFrom(this.doc.ftPerPx, sc);
      if (dpi > 0) {
        const sane = dpi >= 100 && dpi <= 1200;
        msg += ' · নকশার স্কেল ' + CadCore.bn(sc) + '" = ১ মাইল ধরলে স্ক্যান '
          + CadCore.bn(Math.round(dpi)) + ' DPI';
        msg += sane ? ' — মিলে যাচ্ছে ✓'
          : ' — ⚠️ সংখ্যাটি অস্বাভাবিক, স্কেল-দণ্ড ঠিক জায়গায় মাপা হয়েছে কি?'
            + ' নয়তো "নকশার স্কেল" ঠিক বাছা হয়নি।';
        const d = document.getElementById('cad-scale-dpi');
        if (d && !d.value) d.value = String(Math.round(dpi));
      }
    }
    this.status(msg);
  },

  cancelScale() {
    const box = document.getElementById('cad-scale-ask');
    if (box) box.style.display = 'none';
  },

  /** মৌজা স্কেল + স্ক্যানের DPI দিয়ে */
  applyPresetScale() {
    const sel = document.getElementById('cad-scale-preset');
    const dpiInp = document.getElementById('cad-scale-dpi');
    const inch = CadCore.num(sel ? sel.value : '') || 120;
    const dpi = CadCore.num(dpiInp ? dpiInp.value : '') || (this.src && this.src.dpi) || 0;
    if (!(dpi > 0)) {
      this.status('স্ক্যানের DPI জানা না থাকলে "চেনা দূরত্ব" পদ্ধতি ব্যবহার করুন — সেটাই নির্ভরযোগ্য।', true);
      return;
    }
    this.doc.meta.scaleInch = inch;
    this.doc.ftPerPx = CadCore.ftPerPxFromScale(inch, dpi);
    this.renderStats(); this.renderFeatures(); this.renderMeta();
    CadView.draw();
    this.status('স্কেল বসেছে — ' + CadCore.bn(inch) + '" = ১ মাইল, ' + CadCore.bn(dpi)
      + ' DPI · ১ পিক্সেল = ' + CadCore.bn(this.doc.ftPerPx.toFixed(4)) + ' ফুট');
  },

  /* ==================== স্বয়ংক্রিয় ডিজিটাইজ ==================== */

  async autoDigitize() {
    const s = CadView.state;
    const r = s && (s.rasters.find(x => x.visible) || s.rasters[0]);
    if (!r) { this.status('আগে নকশার ছবি দিন।', true); return; }

    const sens = document.getElementById('cad-auto-sens');
    const minEl = document.getElementById('cad-auto-min');
    const k = sens ? (0.06 + (100 - Number(sens.value)) / 100 * 0.22) : 0.16;
    const minSatak = minEl ? (CadCore.num(minEl.value) || 0) : 0;

    // ন্যূনতম আয়তন শতাংশ → কাজের পিক্সেলে
    let minPix = 0;
    if (minSatak > 0 && this.doc.ftPerPx > 0) {
      const sqft = minSatak * CadCore.SQFT_PER_SATAK;
      const areaPxFull = sqft / (this.doc.ftPerPx * this.doc.ftPerPx);
      const scale2 = (r.img.width * r.img.height) / CadTrace.WORK_PIXELS;
      minPix = Math.max(40, Math.round(areaPxFull / Math.max(1, scale2)));
    }

    this.prog(2, 'শুরু হচ্ছে…');
    try {
      const src = r.img.getContext ? r.img : this._toCanvas(r.img);
      const res = await CadTrace.traceAll(src, {
        k, minSatakPx: minPix || undefined,
        onProgress: (p, m) => this.prog(p, m)
      });
      this.prog(null);

      if (!res.polys.length) {
        this.status('কোনো বন্ধ দাগ পাওয়া গেল না। সংবেদনশীলতা বাড়িয়ে আবার চেষ্টা করুন, '
          + 'অথবা "এক ক্লিকে দাগ" টুল দিয়ে একটি একটি করে নিন।', true);
        return;
      }

      CadView._pushUndo();
      const layerId = CadView.state.activeLayer;
      for (const poly of res.polys) {
        CadCore.addFeature(this.doc, CadCore.newFeature(this.doc, layerId, poly, {}));
      }
      CadView.state.selection = [];
      CadView.draw();
      this.renderFeatures(); this.renderStats(); this.renderLayers();

      const extra = res.stats.dropped
        ? ' (' + CadCore.bn(res.stats.dropped) + 'টি বাদ পড়েছে — সীমা ছাড়িয়ে গেছে)' : '';
      this.status(CadCore.bn(res.polys.length) + 'টি দাগ ডিজিটাল হয়েছে' + extra
        + '। এবার দাগ নম্বর বসান — ডানের "দাগ" ট্যাবে তালিকা ধরে লিখুন।');
    } catch (e) {
      this.prog(null);
      this.status('স্বয়ংক্রিয় ডিজিটাইজে সমস্যা: ' + e.message, true);
    }
  },

  /* ==================== প্যানেল ==================== */

  setTab(t) {
    this.tab = t;
    ['layers', 'dags', 'sheet', 'export'].forEach(k => {
      const p = document.getElementById('cad-tab-' + k);
      if (p) p.style.display = k === t ? '' : 'none';
      const b = document.getElementById('cad-tabbtn-' + k);
      if (b) b.classList.toggle('active', k === t);
    });
    if (t === 'dags') this.renderFeatures();
    if (t === 'export') this.renderExport();
  },

  renderLayers() {
    const box = document.getElementById('cad-layers');
    if (!box) return;
    const active = CadView.state ? CadView.state.activeLayer : 'dag';
    box.innerHTML = this.doc.layers.map(L => {
      const n = this.doc.features.filter(f => f.layer === L.id).length;
      return `<div class="cad-layer${L.id === active ? ' active' : ''}">
        <button type="button" class="cad-lyr-eye" title="দেখাও/লুকাও"
                onclick="CadApp.layerVis('${L.id}')">
          <i class="bi bi-${L.visible ? 'eye' : 'eye-slash'}"></i></button>
        <button type="button" class="cad-lyr-main" onclick="CadApp.layer('${L.id}')">
          <span class="cad-lyr-swatch" style="background:${L.color}"></span>
          <span class="cad-lyr-name">${L.name}</span>
          <span class="cad-lyr-n">${n ? CadCore.bn(n) : ''}</span>
        </button>
        <input type="color" class="cad-lyr-color" value="${L.color}"
               title="রঙ বদলান" onchange="CadApp.layerColor('${L.id}', this.value)">
      </div>`;
    }).join('');
  },

  layerVis(id) {
    const L = CadCore.layer(this.doc, id);
    if (!L) return;
    L.visible = !L.visible;
    CadView.draw();
    this.renderLayers();
  },

  layerColor(id, hex) {
    const L = CadCore.layer(this.doc, id);
    if (!L) return;
    L.color = hex;
    CadView.draw();
    this.renderLayers();
  },

  renderRasters() {
    const box = document.getElementById('cad-rasters');
    if (!box || !CadView.state) return;
    const rs = CadView.state.rasters;
    box.innerHTML = rs.length ? rs.map((r, i) => `
      <div class="cad-raster">
        <button type="button" class="cad-lyr-eye" onclick="CadApp.rasterVis(${i})">
          <i class="bi bi-${r.visible ? 'eye' : 'eye-slash'}"></i></button>
        <span class="cad-raster-name">${r.name}</span>
        <input type="range" min="0" max="100" value="${Math.round(r.opacity * 100)}"
               title="ঘনত্ব" oninput="CadApp.rasterOpacity(${i}, this.value)">
        <button type="button" class="cad-lyr-eye" title="সরান"
                onclick="CadApp.rasterDel(${i})"><i class="bi bi-x-lg"></i></button>
      </div>`).join('')
      : '<div class="cad-empty-mini">কোনো নকশার ছবি নেই</div>';
  },

  rasterVis(i) {
    const r = CadView.state.rasters[i];
    if (!r) return;
    r.visible = !r.visible;
    CadView.draw(); this.renderRasters();
  },

  rasterOpacity(i, v) {
    const r = CadView.state.rasters[i];
    if (!r) return;
    r.opacity = Number(v) / 100;
    CadView.draw();
  },

  rasterDel(i) {
    CadView.removeRaster(i);
    this.renderRasters();
  },

  /* ---------------- দাগের তালিকা ---------------- */

  /**
   * উপরের বারে "ডিজাইনে খুলুন" — দাগ বাছা হলেই ফুটে ওঠে
   * ★ কেন উপরে
   *   আগে বোতামটি ছিল ডানের "দাগ" ট্যাবে, অনেক নিচে স্ক্রল করে — ব্যবহারকারী
   *   দাগ বেছে বসে থাকতেন, পরের কাজটা কোথায় সেটাই চোখে পড়ত না।
   */
  syncSelBtn() {
    const b = document.getElementById('cad-sel-go');
    if (!b) return;
    const n = (CadView.state && CadView.state.selection) ? CadView.state.selection.length : 0;
    b.style.display = n ? '' : 'none';
    if (!n) return;
    const lbl = b.querySelector('span');
    if (lbl) lbl.textContent = CadCore.bn(n) + 'টি দাগ — ডিজাইনে খুলুন';
    b.title = 'বাছাই করা ' + CadCore.bn(n) + 'টি দাগ আলাদা পর্দায় খুলুন — '
      + 'দাগ নম্বর, দিক, খতিয়ান, শিট, পেন্টাগ্রাফ ও ভাগ-বণ্টন সব এক জায়গায়';
  },

  renderFeatures() {
    this.syncSelBtn();
    const box = document.getElementById('cad-dag-list');
    if (!box) return;
    const feats = this.doc.features.filter(f => f.closed);
    if (!feats.length) {
      box.innerHTML = '<div class="cad-empty-mini">এখনো কোনো দাগ আঁকা হয়নি।</div>';
      return;
    }
    const sel = CadView.state ? CadView.state.selection : [];
    const hasScale = this.doc.ftPerPx > 0;

    box.innerHTML = feats.map(f => {
      const L = CadCore.layer(this.doc, f.layer) || CadCore.layerPreset(f.layer);
      const m = CadCore.measure(this.doc, f);
      const on = sel.includes(f.id);
      return `<div class="cad-dag${on ? ' sel' : ''}" onclick="CadApp.pickFeature('${f.id}', event)">
        <span class="cad-dag-dot" style="background:${L.color}"></span>
        <input class="cad-dag-no" value="${(f.dag || '').replace(/"/g, '&quot;')}"
               placeholder="দাগ নং" onclick="event.stopPropagation()"
               onchange="CadApp.setField('${f.id}','dag',this.value)">
        <span class="cad-dag-area">${hasScale ? CadCore.satakText(m.sqft) : CadCore.bn(f.pts.length) + ' কোণা'}</span>
        <button type="button" class="cad-dag-x" title="মুছুন"
                onclick="event.stopPropagation();CadApp.delFeature('${f.id}')">
          <i class="bi bi-trash"></i></button>
      </div>`;
    }).join('');
  },

  pickFeature(id, ev) {
    const s = CadView.state;
    if (!s) return;
    if (ev && ev.shiftKey) {
      const i = s.selection.indexOf(id);
      if (i >= 0) s.selection.splice(i, 1); else s.selection.push(id);
    } else {
      s.selection = [id];
      const f = CadCore.feature(this.doc, id);
      if (f) CadView.zoomTo(f.pts, 0.55);
    }
    CadView.draw();
    this.renderFeatures();
    this.renderDetail();
  },

  setField(id, field, val) {
    const f = CadCore.feature(this.doc, id);
    if (!f) return;
    if (field === 'manualArea') {
      const v = CadCore.num(val);
      f.manualArea = (val === '' || !isFinite(v)) ? null : v;
    } else {
      f[field] = val;
    }
    CadView.draw();
    this.renderFeatures();
    this.renderStats();
  },

  delFeature(id) {
    CadView._pushUndo();
    CadCore.removeFeature(this.doc, id);
    const s = CadView.state;
    if (s) s.selection = s.selection.filter(x => x !== id);
    CadView.draw();
    this.renderFeatures(); this.renderStats();
  },

  renderDetail() {
    const box = document.getElementById('cad-detail');
    if (!box) return;
    const s = CadView.state;
    const ids = s ? s.selection : [];
    if (ids.length !== 1) {
      box.innerHTML = ids.length > 1
        ? `<div class="cad-empty-mini">${CadCore.bn(ids.length)}টি দাগ নির্বাচিত</div>` : '';
      return;
    }
    const f = CadCore.feature(this.doc, ids[0]);
    if (!f) { box.innerHTML = ''; return; }
    const m = CadCore.measure(this.doc, f);
    const u = m.units;
    const hasScale = this.doc.ftPerPx > 0;

    box.innerHTML = `
      <div class="cad-detail-grid">
        <label>দাগ নং<input value="${(f.dag || '').replace(/"/g, '&quot;')}"
          onchange="CadApp.setField('${f.id}','dag',this.value)"></label>
        <label>খতিয়ান<input value="${(f.khotian || '').replace(/"/g, '&quot;')}"
          onchange="CadApp.setField('${f.id}','khotian',this.value)"></label>
        <label class="wide">মালিক<input value="${(f.owner || '').replace(/"/g, '&quot;')}"
          onchange="CadApp.setField('${f.id}','owner',this.value)"></label>
        <label class="wide">লেয়ার
          <select onchange="CadApp.setField('${f.id}','layer',this.value);CadApp.renderLayers()">
            ${this.doc.layers.map(L => `<option value="${L.id}"${L.id === f.layer ? ' selected' : ''}>${L.name}</option>`).join('')}
          </select></label>
        <label class="wide">নির্দিষ্ট ক্ষেত্রফল (শতাংশ) — খতিয়ানের মাপ বসাতে চাইলে
          <input placeholder="স্বয়ংক্রিয়" value="${f.manualArea == null ? '' : f.manualArea}"
            onchange="CadApp.setField('${f.id}','manualArea',this.value)"></label>
      </div>
      ${hasScale ? `<div class="cad-detail-nums">
        <div><b>${CadCore.bn(u.satak.toFixed(2))}</b><span>শতাংশ</span></div>
        <div><b>${CadCore.bn(u.katha.toFixed(3))}</b><span>কাঠা</span></div>
        <div><b>${CadCore.bn(u.sqft.toFixed(0))}</b><span>বর্গফুট</span></div>
        <div><b>${CadCore.bn(m.feet.toFixed(1))}</b><span>ফুট পরিসীমা</span></div>
      </div>
      <div class="cad-sides">${m.sides.map((sd, i) =>
        `<span>${CadCore.bn(i + 1)}. ${CadCore.ftIn(sd.feet)}</span>`).join('')}</div>`
      : '<div class="cad-empty-mini">ক্ষেত্রফল দেখতে আগে স্কেল বসান।</div>'}
      <div class="cad-detail-btns">
        <button type="button" class="cad-mini" onclick="CadApp.zoomFeature('${f.id}')">
          <i class="bi bi-zoom-in"></i> কাছে দেখুন</button>
        <button type="button" class="cad-mini" onclick="CadApp.toggleFeat('${f.id}','showDims')">
          <i class="bi bi-rulers"></i> মাপ ${f.showDims ? 'লুকান' : 'দেখান'}</button>
        <button type="button" class="cad-mini danger" onclick="CadApp.delFeature('${f.id}')">
          <i class="bi bi-trash"></i> মুছুন</button>
      </div>`;
  },

  toggleFeat(id, key) {
    const f = CadCore.feature(this.doc, id);
    if (!f) return;
    f[key] = !f[key];
    CadView.draw();
    this.renderDetail();
  },

  zoomFeature(id) {
    const f = CadCore.feature(this.doc, id);
    if (f) CadView.zoomTo(f.pts, 0.5);
  },

  renderStats() {
    const el = document.getElementById('cad-stats');
    if (!el) return;
    const closed = this.doc.features.filter(f => f.closed);
    const hasScale = this.doc.ftPerPx > 0;
    let total = 0;
    for (const f of closed) total += CadCore.measure(this.doc, f).sqft;
    el.innerHTML = `<span><b>${CadCore.bn(closed.length)}</b> দাগ</span>`
      + (hasScale ? `<span>মোট <b>${CadCore.satakText(total)}</b></span>` : '<span class="warn">স্কেল বসানো হয়নি</span>')
      + (CadGeo.hasGeo(this.doc)
          ? `<span class="ok">ভূ-স্থানাঙ্ক ±${CadCore.bn(this.doc.geo.rmse.toFixed(1))} মি</span>`
          : '')
      + (CadView.state && CadView.state.selection.length
          ? `<span class="sel">${CadCore.bn(CadView.state.selection.length)}টি নির্বাচিত — শুধু এগুলোর মাপ দেখানো হচ্ছে</span>`
          : '');
    this.renderDetail();
    this.renderSelected();
    this.renderSteps();
  },

  /* ---------------- শিটের তথ্য ---------------- */

  renderMeta() {
    const M = this.doc.meta;
    const set = (id, v) => { const e = document.getElementById(id); if (e && document.activeElement !== e) e.value = v || ''; };
    set('cad-m-district', M.district); set('cad-m-upazila', M.upazila);
    set('cad-m-mouza', M.mouza); set('cad-m-jl', M.jl);
    set('cad-m-surveyor', M.surveyorName); set('cad-m-reg', M.surveyorReg);
    set('cad-m-edu', M.surveyorEdu); set('cad-m-sphone', M.surveyorPhone);
    set('cad-m-firm', M.firmName); set('cad-m-faddr', M.firmAddress);
    set('cad-m-fphone', M.firmPhone);
    set('cad-m-date', M.reportDate); set('cad-m-note', M.reportNote);
    set('cad-m-foot', M.footNote);
    const t = document.getElementById('cad-m-type');
    if (t) t.value = M.sheetType || 'demarcation';
    const sc = document.getElementById('cad-scale-preset');
    if (sc) sc.value = String(M.scaleInch || 120);
    this._pentaVis();
  },

  meta(key, val) {
    this.doc.meta[key] = val;
    if (key === 'sheetType') this._pentaVis();
    if (key === 'scaleInch') this.doc.meta.scaleInch = CadCore.num(val) || 120;
  },

  _pentaVis() {
    const box = document.getElementById('cad-penta-cfg');
    if (box) box.style.display = this.doc.meta.sheetType === 'pentagraph' ? '' : 'none';
    const sels = ['cad-penta-base', 'cad-penta-over'];
    for (const id of sels) {
      const s = document.getElementById(id);
      if (!s || s._filled) continue;
      s._filled = true;
      s.innerHTML = this.doc.layers.map(L => `<option value="${L.id}">${L.name}</option>`).join('');
      s.value = id.endsWith('base') ? 'cs' : 'bs';
    }
  },

  /* ==================== ভূ-স্থানাঙ্ক ==================== */

  geoOpen() {
    const p = document.getElementById('cad-geo-panel');
    if (!p) return;
    this.geo.open = true;
    p.style.display = '';
    this.tool('gcp');
    setTimeout(() => {
      const c = document.getElementById('cad-geo-map');
      if (!c) return;
      const r = c.parentElement.getBoundingClientRect();
      c.width = Math.max(280, Math.round(r.width));
      c.height = Math.max(240, Math.round(r.height));
      if (!c._cadInit) {
        c._cadInit = true;
        KmzMap.init(c, { onPick: g => this.geoMapPick(g) });
      } else { KmzMap.state.canvas = c; KmzMap.draw(); }
      this.geoRender();
    }, 60);
    this.status('নকশায় একটি চেনা জায়গায় ক্লিক করুন, তারপর ডানের স্যাটেলাইটে ঠিক সেই জায়গায় ক্লিক করুন।');
  },

  geoClose() {
    const p = document.getElementById('cad-geo-panel');
    if (p) p.style.display = 'none';
    this.geo.open = false;
    this.tool('pan');
  },

  geoImgPick(ip) {
    if (!this.geo.open) return;
    if (this.geo.imgPts.length > this.geo.mapPts.length) {
      this.geo.imgPts[this.geo.imgPts.length - 1] = ip;      // শেষটি বদলে দিই
    } else {
      this.geo.imgPts.push(ip);
    }
    this.geoRender();
    this.status('এবার ডানের স্যাটেলাইটে ঠিক ঐ জায়গাটি ক্লিক করুন।');
  },

  geoMapPick(g) {
    if (!this.geo.open) return;
    if (this.geo.mapPts.length >= this.geo.imgPts.length) {
      this.status('আগে নকশায় একটি বিন্দু বসান।', true);
      return;
    }
    this.geo.mapPts.push({ lat: g.lat, lng: g.lng });
    this.geoRender();
    this.geoSolve();
  },

  geoUndo() {
    if (this.geo.mapPts.length >= this.geo.imgPts.length) this.geo.mapPts.pop();
    else this.geo.imgPts.pop();
    this.geoRender();
    this.geoSolve();
  },

  geoRender() {
    const n = Math.min(this.geo.imgPts.length, this.geo.mapPts.length);
    if (KmzMap.state) {
      KmzMap.setMarkers(this.geo.mapPts.map((p, i) => ({
        lat: p.lat, lng: p.lng, n: CadCore.bn(i + 1), current: i === this.geo.mapPts.length - 1
      })));
    }
    const el = document.getElementById('cad-geo-info');
    if (el) {
      const g = this.doc.geo;
      el.innerHTML = `<span>জোড়া: <b>${CadCore.bn(n)}</b></span>`
        + (g && g.rmse != null
            ? `<span class="${g.rmse < 8 ? 'ok' : 'warn'}">ত্রুটি ±${CadCore.bn(g.rmse.toFixed(1))} মিটার (${KmzExport.quality(g.rmse).label})</span>`
            : '<span class="warn">অন্তত ২ জোড়া লাগবে</span>');
    }
    CadView.draw();
  },

  geoSolve() {
    const n = Math.min(this.geo.imgPts.length, this.geo.mapPts.length);
    if (n < 2) return;
    const pts = [];
    for (let i = 0; i < n; i++) {
      pts.push({ px: this.geo.imgPts[i].x, py: this.geo.imgPts[i].y,
                 lat: this.geo.mapPts[i].lat, lng: this.geo.mapPts[i].lng });
    }
    try {
      CadGeo.calibrate(this.doc, pts);
      this.geoRender();
      this.renderStats(); this.renderFeatures();
      CadView.draw();
    } catch (e) {
      this.status(e.message, true);
    }
  },

  async geoSearch() {
    const inp = document.getElementById('cad-geo-search');
    if (!inp || !inp.value.trim()) return;
    this.status('জায়গা খোঁজা হচ্ছে…');
    try {
      const hits = await KmzGeo.search(inp.value.trim());
      if (!hits.length) { this.status('এই নামে কিছু পাওয়া গেল না।', true); return; }
      KmzMap.setCenter(hits[0].lat, hits[0].lng, 16);
      this.status(hits[0].name);
    } catch (e) {
      this.status('খোঁজায় সমস্যা: ' + e.message, true);
    }
  },

  geoMyLocation() {
    KmzGeo.myLocation().then(p => {
      KmzMap.setCenter(p.lat, p.lng, 17);
      this.status('আপনার অবস্থানে আনা হয়েছে।');
    }).catch(e => this.status(e.message, true));
  },

  geoLayer(i) { KmzMap.setLayer(Number(i)); },

  /* ==================== রপ্তানি ==================== */

  renderExport() {
    const el = document.getElementById('cad-export-state');
    if (!el) return;
    const hasScale = this.doc.ftPerPx > 0;
    const hasGeo = CadGeo.hasGeo(this.doc);
    const n = this.doc.features.length;
    const row = (ok, txt) =>
      `<div class="cad-chk ${ok ? 'ok' : 'no'}"><i class="bi bi-${ok ? 'check-circle-fill' : 'circle'}"></i>${txt}</div>`;
    el.innerHTML =
      row(n > 0, CadCore.bn(n) + 'টি দাগ ডিজিটাল হয়েছে') +
      row(hasScale, 'স্কেল বসানো — ক্ষেত্রফল ও মাপ পাওয়া যাবে') +
      row(hasGeo, 'ভূ-স্থানাঙ্ক বসানো — গুগল আর্থ/ম্যাপে বসবে');
  },

  async exportSheet(kind) {
    if (!this.doc.features.length) { this.status('আগে অন্তত একটি দাগ আঁকুন।', true); return; }
    const opt = {};
    if (this.doc.meta.sheetType === 'pentagraph') {
      const b = document.getElementById('cad-penta-base');
      const o = document.getElementById('cad-penta-over');
      opt.pentagraph = { base: b ? b.value : 'cs', over: o ? o.value : 'bs' };
    }
    this.prog(20, 'শিট তৈরি হচ্ছে…');
    try {
      if (kind === 'print') await CadSheet.print(this.doc, opt);
      else await CadSheet.downloadPng(this.doc, opt);
      this.prog(null);
      this.status(kind === 'print' ? 'ছাপার জানালা খোলা হয়েছে।' : 'শিট PNG নামানো হয়েছে।');
    } catch (e) {
      this.prog(null);
      this.status('শিট তৈরিতে সমস্যা: ' + e.message, true);
    }
  },

  exportGeo(kind) {
    if (!CadGeo.hasGeo(this.doc)) {
      this.status('গুগল আর্থে বসাতে হলে আগে "ভূ-স্থানাঙ্ক" ধাপে নকশাটি স্যাটেলাইটের সাথে মেলাতে হবে।', true);
      this.geoOpen();
      return;
    }
    const base = CadGeo.fileBase(this.doc);
    try {
      if (kind === 'kmz') {
        const withImg = document.getElementById('cad-kmz-img');
        const o = {};
        if (withImg && withImg.checked && this.src && this.src.bytes) {
          o.imageBytes = this.src.bytes;
          o.imageName = this.src.name;
          o.imageWidth = this.src.width;
          o.imageHeight = this.src.height;
          o.imageOpacity = 0.6;
        }
        const r = CadGeo.buildKmz(this.doc, o);
        CadGeo.download(r.bytes, base + '.kmz', 'application/vnd.google-earth.kmz');
        this.status('KMZ নামানো হয়েছে — Google Earth এ খুলুন। প্রতিটি দাগে ক্লিক করলে নম্বর ও ক্ষেত্রফল দেখাবে।');
      } else if (kind === 'kml') {
        const kml = CadGeo.buildKml(this.doc, {});
        CadGeo.download(kml, base + '.kml', 'application/vnd.google-earth.kml+xml');
        this.status('KML নামানো হয়েছে — Google My Maps এ Import করুন (mymaps.google.com)।');
      } else if (kind === 'geojson') {
        CadGeo.download(CadGeo.buildGeoJson(this.doc), base + '.geojson', 'application/geo+json');
        this.status('GeoJSON নামানো হয়েছে — QGIS/ArcGIS এ খুলবে।');
      }
    } catch (e) {
      this.status('রপ্তানিতে সমস্যা: ' + e.message, true);
    }
  },

  exportCsv() {
    if (!this.doc.features.length) { this.status('আগে দাগ আঁকুন।', true); return; }
    CadGeo.download(CadGeo.buildCsv(this.doc), CadGeo.fileBase(this.doc) + '-তফসিল.csv',
                    'text/csv;charset=utf-8');
    this.status('তফসিল CSV নামানো হয়েছে — Excel এ খুলবে।');
  },

  /**
   * নকশার ছবির ছোট কপি — সংরক্ষণের সাথে যায়, তাই পরে খুললে পটভূমিতে
   * নকশাটি ফিরে আসে। মূল ৬০ মেগাপিক্সেল ছবি রাখলে ফাইল বিশাল হতো, তাই
   * ~২ মেগাপিক্সেলে নামিয়ে JPEG করা হয় (সাধারণত ৩০০–৬০০ KB)।
   */
  _previewImage() {
    const s = CadView.state;
    const r = s && (s.rasters.find(x => x.visible) || s.rasters[0]);
    if (!r || !r.img) return null;
    const W = r.img.width, H = r.img.height;
    const k = Math.min(1, Math.sqrt(2e6 / (W * H)));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * k));
    c.height = Math.max(1, Math.round(H * k));
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(r.img, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.72), size: { w: W, h: H } };
  },

  saveProject() {
    if (!this.doc.features.length) { this.status('সংরক্ষণের মতো কিছু নেই — আগে দাগ আঁকুন।', true); return; }
    const withImg = document.getElementById('cad-save-img');
    let img = null;
    try { if (!withImg || withImg.checked) img = this._previewImage(); } catch (_) {}
    const json = CadCore.toJson(this.doc, img ? { image: img.data, imageSize: img.size } : {});
    const sv = this.SURVEYS.find(x => x.id === this.survey);
    const name = CadGeo.fileBase(this.doc) + (sv ? '-' + sv.id : '') + '.jaygajomi.json';
    CadGeo.download(json, name, 'application/json');
    this.status('সংরক্ষিত হয়েছে (' + Math.round(json.length / 1024) + ' KB)'
      + (img ? ' — নকশার ছবিও সাথে আছে, পরে খুললেই পটভূমিতে দেখাবে।' : ' — ছবি ছাড়া।')
      + ' পেন্টাগ্রাফ করতে সি.এস ও বি.এস আলাদা ফাইলে রেখে পরে "যোগ করুন" দিয়ে মিলিয়ে নিন।');
  },

  /** সংরক্ষিত ছবি (dataURL) → আন্ডারলে */
  async _restoreImage(doc) {
    if (!doc._image) return false;
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('ছবি পড়া গেল না'));
        im.src = doc._image;
      });
      const c = document.createElement('canvas');
      // মূল মাপে ফিরিয়ে আনি, নইলে দাগগুলোর সাথে মিলবে না
      const w = (doc._imageSize && doc._imageSize.w) || img.width;
      const h = (doc._imageSize && doc._imageSize.h) || img.height;
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, w, h);
      this.src = { canvas: c, bytes: null, name: 'সংরক্ষিত নকশা', width: w, height: h, dpi: null };
      CadView.state.rasters = [];
      CadView.addRaster(c, 'সংরক্ষিত নকশা', { opacity: 0.55 });
      CadView.state.traceCache = {};
      return true;
    } catch (_) { return false; }
  },

  loadProject(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        this.doc = CadCore.fromJson(rd.result);
        this.started = true;
        this.show('work');
        await new Promise(r => setTimeout(r, 60));
        this.sizeCanvas();
        this._initView();
        CadView.setDoc(this.doc);
        if (this.doc.geo && this.doc.geo.points) {
          this.geo.imgPts = this.doc.geo.points.map(p => ({ x: p.px, y: p.py }));
          this.geo.mapPts = this.doc.geo.points.map(p => ({ lat: p.lat, lng: p.lng }));
        }
        const hadImg = await this._restoreImage(this.doc);
        CadView.fit();
        this.renderMeta(); this.renderLayers(); this.renderFeatures();
        this.renderStats(); this.renderRasters(); this.renderSurveyPick();
        this.status('কাজটি ফিরে এসেছে — ' + CadCore.bn(this.doc.features.length) + 'টি দাগ'
          + (this.doc.ftPerPx > 0 ? ', স্কেল বসানো আছে' : ', স্কেল বসানো নেই')
          + (CadGeo.hasGeo(this.doc) ? ', ভূ-স্থানাঙ্কও আছে' : '')
          + (hadImg ? '। নকশার ছবিও ফিরেছে।' : '। ছবি ছাড়া সংরক্ষিত ছিল — চাইলে নকশাটি আবার আপলোড করুন।'));
      } catch (e) {
        this.status('ফাইলটি পড়া গেল না: ' + e.message, true);
      }
    };
    rd.readAsText(f);
  },

  /**
   * আগের সংরক্ষিত ডিজিটাল নকশা **এই কাজের সাথে জুড়ে দেওয়া**
   *
   * পেন্টাগ্রাফের আসল কর্মপ্রণালী: আজ সি.এস নকশা ডিজিটাইজ করে সেভ,
   * কাল বি.এস নকশা ডিজিটাইজ করে সেভ — তারপর একটি খুলে অন্যটি "যোগ করুন"।
   * দুই ফাইলেরই ভূ-স্থানাঙ্ক থাকলে অক্ষাংশ-দ্রাঘিমাংশ ধরে নিখুঁতভাবে বসে।
   */
  mergeProject(input) {
    const f = input && input.files && input.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const src = CadCore.fromJson(rd.result);
        if (!src.features.length) { this.status('ঐ ফাইলে কোনো দাগ নেই।', true); return; }

        let mapPt = null, how = '';
        if (CadGeo.hasGeo(src) && CadGeo.hasGeo(this.doc)) {
          const chk = CadGeo.alignCheck(src, this.doc);
          mapPt = CadGeo.reprojector(src, this.doc);
          how = 'ভূ-স্থানাঙ্ক ধরে বসানো হয়েছে';
          if (!chk.ok) how += ' (⚠️ দুই নকশার কেন্দ্র '
            + CadCore.bn(chk.km.toFixed(1)) + ' কিমি দূরে — একই মৌজার নকশা কি?)';
        } else if (!CadGeo.hasGeo(this.doc) && !CadGeo.hasGeo(src)) {
          mapPt = p => ({ x: p.x, y: p.y });
          how = '⚠️ কোনোটিতেই ভূ-স্থানাঙ্ক নেই — হুবহু একই পিক্সেলে বসানো হয়েছে। '
              + 'দুই নকশা একই স্ক্যান থেকে না হলে জায়গা মিলবে না; "বাছুন" টুলে ধরে টেনে সরিয়ে নিন।';
        } else {
          this.status('জুড়তে দুই ফাইলেরই ভূ-স্থানাঙ্ক লাগবে — যেটিতে নেই সেটির নকশা খুলে '
            + '"গুগল" ধাপে স্যাটেলাইটের সাথে মিলিয়ে আবার সংরক্ষণ করুন। '
            + 'এটিই দুই জরিপের নকশা এক জায়গায় বসানোর নির্ভরযোগ্য পথ।', true);
          return;
        }

        CadView._pushUndo();
        const before = this.doc.features.length;
        const r = CadCore.mergeInto(this.doc, src, { mapPt });
        if (!(this.doc.ftPerPx > 0) && src.ftPerPx > 0) this.doc.ftPerPx = src.ftPerPx;

        CadView.state.selection = [];
        CadView.draw();
        this.renderLayers(); this.renderFeatures(); this.renderStats();
        this.status(CadCore.bn(r.added) + 'টি দাগ যোগ হয়েছে (মোট এখন '
          + CadCore.bn(this.doc.features.length) + ') — লেয়ার: '
          + r.layers.map(id => CadCore.layerPreset(id).name).join(', ')
          + '। ' + how + '। এবার শিট ট্যাবে ধরন "পেন্টাগ্রাফ" করে মিলকরণ টেবিল দেখুন।');
      } catch (e) {
        this.status('ফাইলটি জোড়া গেল না: ' + e.message, true);
      }
    };
    rd.readAsText(f);
  },

  /* ---------------- পেন্টাগ্রাফ প্রিভিউ ---------------- */

  previewPentagraph() {
    const b = document.getElementById('cad-penta-base');
    const o = document.getElementById('cad-penta-over');
    const box = document.getElementById('cad-penta-preview');
    if (!box) return;
    if (!(this.doc.ftPerPx > 0)) {
      box.innerHTML = '<div class="cad-empty-mini">আগে স্কেল বসান।</div>';
      return;
    }
    const rows = CadOverlay.pentagraph(this.doc, b ? b.value : 'cs', o ? o.value : 'bs', {});
    if (!rows.length) {
      box.innerHTML = '<div class="cad-empty-mini">দুই লেয়ারে দাগ আঁকা থাকলে তবেই মিলকরণ হবে।</div>';
      return;
    }
    box.innerHTML = '<table class="cad-penta-tbl"><tr><th>পুরনো দাগ</th><th>পরিমাণ</th>'
      + '<th>নতুন দাগ</th><th>পরিমাণ</th></tr>'
      + rows.map(r => {
          const first = `<td rowspan="${r.items.length + 1}"><b>${CadCore.bn(r.dag)}</b></td>`
            + `<td rowspan="${r.items.length + 1}">${CadCore.bn(r.satak.toFixed(2))}</td>`;
          const items = r.items.map((it, i) =>
            `<tr>${i === 0 ? first : ''}<td>${CadCore.bn(it.dag)}</td>`
            + `<td>${CadOverlay.itemText(it, { bare: true })}</td></tr>`).join('');
          const tot = `<tr class="tot"><td>মোট</td><td>${CadCore.bn(r.total.toFixed(2))}</td></tr>`;
          return (r.items.length ? items : `<tr>${first}<td>—</td><td>—</td></tr>`) + tot;
        }).join('')
      + '</table>';
  },

  /* ---------------- KMZ টুল থেকে নকশা আনা ---------------- */

  /** পুরনো KMZ টুলে যে নকশা লোড করা আছে, সেটিই CAD এ আনা */
  importFromKmz() {
    const k = AppController.kmz;
    if (!k || !k.img) { this.status('KMZ টুলে কোনো নকশা লোড করা নেই।', true); return; }
    this._loadTarget = 1;
    AppController.openToolModal('survey-cad');
    this.useImage({
      canvas: k.img, img: k.img, bytes: k.imgBytes,
      width: k.img.width, height: k.img.height
    }, k.imgName || 'মৌজা নকশা');
  }
};

/* ==========================================================================
   AppController এ যুক্ত করা — টুল খোলার সময় CadApp চালু হবে
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function () {
  if (typeof AppController === 'undefined') return;

  const origOpen = AppController.openToolModal.bind(AppController);
  AppController.openToolModal = function (toolId) {
    origOpen(toolId);
    if (toolId === 'survey-cad') {
      const t = document.getElementById('modal-title-text');
      const i = document.getElementById('modal-title-icon');
      if (t) t.innerText = 'ডিজিটাল সার্ভে — GIS ডিজিটাইজেশন ও প্লট';
      if (i) i.className = 'bi bi-vector-pen text-primary';
      CadApp.init();
    }
  };

  // পর্দার মাপ বদলালে ক্যানভাস আবার বসানো
  let rz = null;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const v = document.getElementById('view-survey-cad');
      if (v && v.style.display !== 'none' && CadApp.started) {
        CadApp.sizeCanvas();
        if (CadView.state) CadView.draw();
      }
    }, 180);
  });
});

if (typeof module !== 'undefined' && module.exports) module.exports = CadApp;
