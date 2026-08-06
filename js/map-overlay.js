/* ==========================================================================
   LAND PRO - MAP PANTOGRAPH & COMPARATIVE OVERLAY TOOL
   Dual Image Superimpose, Transparency Slider, & Image Cleaner
   ========================================================================== */

class MapPantograph {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.imgBase = null;
    this.imgTop = null;

    this.opacity = 0.5;
    this.brightness = 100;
    this.contrast = 100;

    this.renderUI();
    this.attachEvents();
  }

  renderUI() {
    this.container.innerHTML = `
      <div class="pantograph-wrapper">
        <div class="canvas-toolbar">
          <label class="btn-secondary" style="cursor:pointer">
            <i class="bi bi-image"></i> ম্যাপ ১ (বেস)
            <input type="file" id="panto-img1-input" accept="image/*" style="display:none">
          </label>

          <label class="btn-secondary" style="cursor:pointer">
            <i class="bi bi-layers"></i> ম্যাপ ২ (ওভারলে)
            <input type="file" id="panto-img2-input" accept="image/*" style="display:none">
          </label>

          <div style="display:flex;align-items:center;gap:10px;margin-left:auto">
            <span style="font-size:0.85rem;font-weight:600">স্বচ্ছতা (Opacity):</span>
            <input type="range" id="panto-opacity-slider" min="0" max="1" step="0.05" value="0.5" style="width:120px">
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:12px">
          <div style="flex:1">
            <label class="form-label">উজ্জ্বলতা (Brightness):</label>
            <input type="range" id="panto-brightness-slider" min="50" max="150" value="100" class="form-control">
          </div>
          <div style="flex:1">
            <label class="form-label">কনট্রাস্ট (Contrast):</label>
            <input type="range" id="panto-contrast-slider" min="50" max="200" value="100" class="form-control">
          </div>
        </div>

        <div class="pantograph-stage" style="position:relative;width:100%;height:450px;background:#1e293b;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center">
          <div id="panto-placeholder" style="color:#94a3b8;text-align:center">
            <i class="bi bi-images" style="font-size:3rem"></i>
            <p>তুলনা করতে দুটি ম্যাপের ছবি আপলোড করুন</p>
          </div>
          <img id="panto-base-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none">
          <img id="panto-top-img" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none">
        </div>
      </div>
    `;
  }

  attachEvents() {
    const img1Input = document.getElementById('panto-img1-input');
    const img2Input = document.getElementById('panto-img2-input');
    const opacitySlider = document.getElementById('panto-opacity-slider');
    const brightSlider = document.getElementById('panto-brightness-slider');
    const contrastSlider = document.getElementById('panto-contrast-slider');

    const baseImg = document.getElementById('panto-base-img');
    const topImg = document.getElementById('panto-top-img');
    const placeholder = document.getElementById('panto-placeholder');

    if (img1Input) {
      img1Input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          baseImg.src = URL.createObjectURL(file);
          baseImg.style.display = 'block';
          if (placeholder) placeholder.style.display = 'none';
        }
      });
    }

    if (img2Input) {
      img2Input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          topImg.src = URL.createObjectURL(file);
          topImg.style.display = 'block';
          topImg.style.opacity = this.opacity;
          if (placeholder) placeholder.style.display = 'none';
        }
      });
    }

    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        this.opacity = e.target.value;
        if (topImg) topImg.style.opacity = this.opacity;
      });
    }

    const applyFilters = () => {
      const filterStr = `brightness(${this.brightness}%) contrast(${this.contrast}%)`;
      if (baseImg) baseImg.style.filter = filterStr;
      if (topImg) topImg.style.filter = filterStr;
    };

    if (brightSlider) {
      brightSlider.addEventListener('input', (e) => {
        this.brightness = e.target.value;
        applyFilters();
      });
    }

    if (contrastSlider) {
      contrastSlider.addEventListener('input', (e) => {
        this.contrast = e.target.value;
        applyFilters();
      });
    }
  }
}
