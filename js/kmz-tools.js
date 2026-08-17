/* kmz-tools.js — রঙ পিকার, BG toggle, Crop mask, Map autocomplete, Layer Switcher */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────
     ০. Layer Switcher — ম্যাপের কোণে ভাসমান বোতাম
     ────────────────────────────────────────────── */
  function injectLayerSwitcher() {
    const stage = document.querySelector('#kmz-s2 .kmz-stage');
    if (!stage || document.getElementById('kmz-layer-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'kmz-layer-panel';
    panel.style.cssText =
      'position:absolute;top:50px;right:10px;z-index:40;display:flex;flex-direction:column;gap:4px;';

    // Layer label
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:9px;color:#94a3b8;text-align:center;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;';
    lbl.textContent = 'LAYER';
    panel.appendChild(lbl);

    KmzMap.LAYERS.forEach((layer, i) => {
      const btn = document.createElement('button');
      btn.id = 'kmz-layer-' + i;
      btn.type = 'button';
      btn.title = layer.name;
      btn.innerHTML = '<i class="bi ' + layer.icon + '"></i>';
      btn.style.cssText =
        'width:36px;height:36px;border-radius:8px;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;font-size:15px;' +
        'transition:all 0.15s;border:1px solid rgba(255,255,255,0.15);' +
        (i === KmzMap._layerIdx
          ? 'background:rgba(99,102,241,0.85);color:#fff;border-color:#818cf8;'
          : 'background:rgba(15,23,42,0.85);color:#94a3b8;');
      btn.addEventListener('click', () => KmzMap.setLayer(i));
      panel.appendChild(btn);
    });

    stage.style.position = 'relative';
    stage.appendChild(panel);
  }

  /* ──────────────────────────────────────────────
     ১. Step-1 toolbar এ রঙ পিকার + BG টগল inject
     ────────────────────────────────────────────── */
  function injectToolbar() {
    const ctrls = document.querySelector('#kmz-s1 .kmz-ctrls');
    if (!ctrls || document.getElementById('kmz-color-pick')) return;

    // ── রঙ পিকার ──
    const colorLabel = document.createElement('label');
    colorLabel.id = 'kmz-color-label';
    colorLabel.title = 'লাইনের রঙ বাছুন';
    colorLabel.style.cssText =
      'position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'width:36px;height:36px;border-radius:8px;background:rgba(220,38,38,0.2);border:2px solid #dc2626;';
    colorLabel.innerHTML =
      '<i class="bi bi-palette" style="font-size:15px;color:#dc2626;pointer-events:none;"></i>';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.id = 'kmz-color-pick';
    colorInput.value = '#dc2626';
    colorInput.style.cssText =
      'opacity:0;position:absolute;inset:0;width:100%;height:100%;cursor:pointer;';
    colorInput.addEventListener('input', function () {
      AppController.kmzSetColorPick(this.value);
      colorLabel.style.borderColor = this.value;
      const icon = colorLabel.querySelector('i');
      if (icon) icon.style.color = this.value;
      colorLabel.style.background = this.value + '33';
    });
    colorLabel.appendChild(colorInput);

    // ── BG Transparent টগল ──
    const bgBtn = document.createElement('button');
    bgBtn.type = 'button';
    bgBtn.id = 'kmz-transp-btn';
    bgBtn.className = 'kmz-cbtn';
    bgBtn.title = 'Background সম্পূর্ণ transparent করুন (কাগজ বাদ)';
    bgBtn.style.cssText = 'font-size:10px;font-weight:800;padding:0 4px;letter-spacing:-0.5px;';
    bgBtn.textContent = 'BG';
    if (AppController.kmz && AppController.kmz.bgClear) {
      bgBtn.style.background = 'rgba(34,197,94,0.3)';
      bgBtn.style.color = '#22c55e';
      bgBtn.style.border = '2px solid #22c55e';
    }
    bgBtn.addEventListener('click', () => AppController.kmzToggleTransparent());

    // ── Crop টুল ──
    const cropBtn = document.createElement('button');
    cropBtn.type = 'button';
    cropBtn.id = 'kmz-crop-btn';
    cropBtn.className = 'kmz-cbtn';
    cropBtn.title = 'Legend/margin বাদ দিতে প্লট এলাকা নির্বাচন করুন';
    cropBtn.innerHTML = '<i class="bi bi-crop"></i>';
    cropBtn.addEventListener('click', () => AppController.kmzToggleCrop());

    // OCR বোতামের আগে ঢোকানো
    const ocrBtn = document.getElementById('kmz-ocr-btn');
    if (ocrBtn) {
      ctrls.insertBefore(colorLabel, ocrBtn);
      ctrls.insertBefore(bgBtn, ocrBtn);
      ctrls.insertBefore(cropBtn, ocrBtn);
    } else {
      ctrls.appendChild(colorLabel);
      ctrls.appendChild(bgBtn);
      ctrls.appendChild(cropBtn);
    }
  }

  /* ──────────────────────────────────────────────
     ২. Crop Overlay — ক্যানভাসের উপর ড্র্যাগ করে
        legend বাদ দেওয়া
     ────────────────────────────────────────────── */
  let cropOverlay = null;
  let cropRect = null;

  function buildCropOverlay(canvas) {
    if (cropOverlay) { cropOverlay.remove(); cropOverlay = null; }

    const wrap = canvas.parentElement;
    const rect = canvas.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();

    cropOverlay = document.createElement('div');
    cropOverlay.id = 'kmz-crop-overlay';
    cropOverlay.style.cssText =
      'position:absolute;inset:0;z-index:50;cursor:crosshair;' +
      'background:rgba(0,0,0,0.35);';

    const hint = document.createElement('div');
    hint.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'color:#fff;font-size:13px;font-weight:600;text-align:center;pointer-events:none;' +
      'text-shadow:0 2px 6px rgba(0,0,0,0.9);';
    hint.textContent = 'শুধু প্লট এলাকা ড্র্যাগ করে নির্বাচন করুন — legend/margin বাদ যাবে';
    cropOverlay.appendChild(hint);

    let selecting = null;
    const selBox = document.createElement('div');
    selBox.style.cssText =
      'position:absolute;border:2px dashed #22c55e;background:rgba(34,197,94,0.12);' +
      'pointer-events:none;display:none;';
    cropOverlay.appendChild(selBox);

    cropOverlay.addEventListener('mousedown', function (e) {
      const r = cropOverlay.getBoundingClientRect();
      selecting = { x0: e.clientX - r.left, y0: e.clientY - r.top };
      selBox.style.display = '';
      hint.style.display = 'none';
    });

    cropOverlay.addEventListener('mousemove', function (e) {
      if (!selecting) return;
      const r = cropOverlay.getBoundingClientRect();
      const x1 = e.clientX - r.left, y1 = e.clientY - r.top;
      const x = Math.min(selecting.x0, x1), y = Math.min(selecting.y0, y1);
      const w = Math.abs(x1 - selecting.x0), h = Math.abs(y1 - selecting.y0);
      selBox.style.left = x + 'px'; selBox.style.top = y + 'px';
      selBox.style.width = w + 'px'; selBox.style.height = h + 'px';
    });

    cropOverlay.addEventListener('mouseup', function (e) {
      if (!selecting) return;
      const r = cropOverlay.getBoundingClientRect();
      const x1 = e.clientX - r.left, y1 = e.clientY - r.top;
      const x = Math.min(selecting.x0, x1), y = Math.min(selecting.y0, y1);
      const w = Math.abs(x1 - selecting.x0), h = Math.abs(y1 - selecting.y0);
      selecting = null;

      if (w < 20 || h < 20) { cropOverlay.remove(); cropOverlay = null; return; }

      // ক্যানভাস কো-অর্ডিনেটে রূপান্তর
      const cRect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / cRect.width;
      const scaleY = canvas.height / cRect.height;
      const overlayRect = cropOverlay.getBoundingClientRect();
      const relX = (overlayRect.left - cRect.left);
      const relY = (overlayRect.top - cRect.top);
      cropRect = {
        x: Math.max(0, (x + relX) * scaleX),
        y: Math.max(0, (y + relY) * scaleY),
        w: w * scaleX, h: h * scaleY
      };
      cropOverlay.remove(); cropOverlay = null;

      // Crop প্রয়োগ
      AppController.kmzApplyCrop(cropRect);
    });

    wrap.style.position = 'relative';
    wrap.appendChild(cropOverlay);
  }

  /* ──────────────────────────────────────────────
     ৩. Map autocomplete (Nominatim)
     ────────────────────────────────────────────── */
  let _suggestTimer = null;

  window._kmzNominatimSuggest = async function (val) {
    const box = document.getElementById('kmz-goto-suggestions');
    if (!box) return;

    if (!val || val.trim().length < 2) { box.style.display = 'none'; return; }

    clearTimeout(_suggestTimer);
    _suggestTimer = setTimeout(async () => {
      try {
        const q = encodeURIComponent(val.trim() + ', Bangladesh');
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=7&accept-language=bn,en`,
          { headers: { 'Accept-Language': 'bn,en' } }
        );
        const data = await res.json();
        box.innerHTML = '';
        if (!data.length) { box.style.display = 'none'; return; }

        data.forEach(item => {
          const div = document.createElement('div');
          div.style.cssText =
            'padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.06);' +
            'color:#e2e8f0;font-size:13px;display:flex;align-items:flex-start;gap:10px;';
          div.innerHTML =
            '<i class="bi bi-geo-alt" style="color:#22c55e;margin-top:2px;flex-shrink:0;"></i>' +
            '<span>' + (item.display_name || item.name) + '</span>';
          div.addEventListener('mouseenter', () => div.style.background = 'rgba(255,255,255,0.08)');
          div.addEventListener('mouseleave', () => div.style.background = '');
          div.addEventListener('click', () => {
            const inp = document.getElementById('kmz-goto');
            if (inp) inp.value = item.display_name;
            box.style.display = 'none';
            if (KmzMap && KmzMap.setCenter) {
              KmzMap.setCenter(parseFloat(item.lat), parseFloat(item.lon), 14);
            }
          });
          box.appendChild(div);
        });
        box.style.display = '';

        // বাইরে ক্লিক করলে বন্ধ
        const close = (e) => {
          if (!box.contains(e.target) && e.target.id !== 'kmz-goto') {
            box.style.display = 'none';
            document.removeEventListener('click', close);
          }
        };
        document.addEventListener('click', close);
      } catch (_) { box.style.display = 'none'; }
    }, 350);
  };

  /* ──────────────────────────────────────────────
     ৪. AppController এ নতুন ফাংশন যোগ
     ────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    injectToolbar();

    // kmzStep পরে toolbar inject করার জন্য observe
    const orig = AppController.kmzStep.bind(AppController);
    AppController.kmzStep = function (n) {
      orig(n);
      if (n === 1) setTimeout(injectToolbar, 50);
      if (n === 2) setTimeout(injectLayerSwitcher, 50);
    };

    // রঙ পিকার থেকে color set
    AppController.kmzSetColorPick = function (hex) {
      this.kmz.color = hex || '#dc2626';
      this.kmzApplyFx();
    };

    // BG transparent টগল
    AppController.kmzToggleTransparent = function () {
      this.kmz.bgClear = !this.kmz.bgClear;
      const btn = document.getElementById('kmz-transp-btn');
      if (btn) {
        btn.style.background = this.kmz.bgClear ? 'rgba(34,197,94,0.3)' : '';
        btn.style.color = this.kmz.bgClear ? '#22c55e' : '';
        btn.style.border = this.kmz.bgClear ? '2px solid #22c55e' : '';
        btn.title = this.kmz.bgClear
          ? 'Background এখন TRANSPARENT (কাগজ বাদ) — আবার চাপলে সাদা হবে'
          : 'Background সম্পূর্ণ transparent করুন';
      }
      this.kmzApplyFx();
    };

    // Crop টুল টগল
    AppController.kmzToggleCrop = function () {
      if (cropOverlay) { cropOverlay.remove(); cropOverlay = null; return; }
      const canvas = document.getElementById('kmz-canvas-img');
      if (canvas) buildCropOverlay(canvas);
    };

    // Crop প্রয়োগ: ইমেজ থেকে নির্বাচিত অংশ কেটে নতুন img বানানো
    AppController.kmzApplyCrop = async function (rect) {
      const k = this.kmz;
      const srcImg = k.img;
      if (!srcImg) return;

      this.kmzStatus('Legend/margin বাদ দিয়ে শুধু প্লট এলাকা নেওয়া হচ্ছে…');

      try {
        // imageToCanvas coordinate-এ রূপান্তর
        const s = KmzImage.state;
        const scale = s ? s.scale : 1;
        const off = s ? s.off : { x: 0, y: 0 };

        const canvasX = (rect.x - off.x) / scale;
        const canvasY = (rect.y - off.y) / scale;

        const cropW = Math.round(Math.min(rect.w / scale, srcImg.width - canvasX));
        const cropH = Math.round(Math.min(rect.h / scale, srcImg.height - canvasY));
        const cropX = Math.round(Math.max(0, canvasX));
        const cropY = Math.round(Math.max(0, canvasY));

        if (cropW < 50 || cropH < 50) {
          this.kmzStatus('নির্বাচিত এলাকা খুব ছোট। আবার চেষ্টা করুন।'); return;
        }

        const c = document.createElement('canvas');
        c.width = cropW; c.height = cropH;
        c.getContext('2d').drawImage(srcImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const url = URL.createObjectURL(blob);
        const croppedImg = await new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => { URL.revokeObjectURL(url); res(im); };
          im.onerror = rej;
          im.src = url;
        });

        k.img = croppedImg;
        k.imgPts = []; k.geoPts = []; k.fx = null;
        await this.kmzApplyFx();
        this.kmzStatus('প্লট এলাকা কাটা হয়েছে — legend/margin বাদ। এখন পয়েন্ট বসান।');
      } catch (e) {
        console.warn('Crop error:', e);
        this.kmzStatus('Crop করতে সমস্যা হয়েছে।');
      }
    };

    // Map search autocomplete
    AppController.kmzGotoSuggest = function (val) {
      window._kmzNominatimSuggest(val);
    };

    // BG state সিঙ্ক
    if (AppController.kmz && AppController.kmz.bgClear) {
      setTimeout(() => AppController.kmzToggleTransparent && AppController.kmzToggleTransparent(), 100);
    }
  });

})();
