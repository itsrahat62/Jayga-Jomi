/* ==========================================================================
   LAND PRO - INTERACTIVE CANVAS LAND MEASUREMENT ENGINE
   Polygon Drawing, Side Length Labelling, Point Dragging & Area Math
   ========================================================================== */

class LandCanvasEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.points = [];
    this.selectedPointIndex = -1;
    this.isDragging = false;
    
    this.gridSize = 20;
    this.showGrid = true;
    this.unitScale = 1; // 1 pixel = N feet

    this.initCanvas();
    this.attachEvents();
  }

  initCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width || 600;
    this.canvas.height = 400;
    this.resetQuadPoints();
  }

  resetQuadPoints() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    // Default Quadrilateral Shape in Center
    this.points = [
      { x: w * 0.25, y: h * 0.25 }, // Top-Left (North-West)
      { x: w * 0.75, y: h * 0.25 }, // Top-Right (North-East)
      { x: w * 0.80, y: h * 0.75 }, // Bottom-Right (South-East)
      { x: w * 0.20, y: h * 0.75 }  // Bottom-Left (South-West)
    ];
    this.render();
  }

  attachEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseup', () => this.handlePointerUp());
    this.canvas.addEventListener('touchstart', (e) => this.handlePointerDown(e.touches[0]));
    this.canvas.addEventListener('touchmove', (e) => this.handlePointerMove(e.touches[0]));
    this.canvas.addEventListener('touchend', () => this.handlePointerUp());

    window.addEventListener('resize', () => {
      if (!this.canvas) return;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.canvas.width = rect.width || 600;
      this.render();
    });
  }

  getCanvasCoords(evt) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

  handlePointerDown(evt) {
    const pos = this.getCanvasCoords(evt);
    // Find closest vertex point within 20px radius
    this.selectedPointIndex = this.points.findIndex(p => {
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });

    if (this.selectedPointIndex !== -1) {
      this.isDragging = true;
    }
  }

  handlePointerMove(evt) {
    if (!this.isDragging || this.selectedPointIndex === -1) return;
    const pos = this.getCanvasCoords(evt);
    
    // Boundary check
    pos.x = Math.max(10, Math.min(this.canvas.width - 10, pos.x));
    pos.y = Math.max(10, Math.min(this.canvas.height - 10, pos.y));

    this.points[this.selectedPointIndex] = pos;
    this.render();
    this.triggerAreaUpdate();
  }

  handlePointerUp() {
    this.isDragging = false;
    this.selectedPointIndex = -1;
  }

  // Draw Grid background
  drawGrid() {
    if (!this.showGrid) return;
    this.ctx.strokeStyle = document.documentElement.classList.contains('dark-theme') ? '#1f2937' : '#f1f5f9';
    this.ctx.lineWidth = 1;

    for (let x = 0; x < this.canvas.width; x += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += this.gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  // Render Polygon and Labels
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();

    if (this.points.length < 3) return;

    // Fill Polygon
    this.ctx.beginPath();
    this.ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      this.ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    this.ctx.closePath();

    this.ctx.fillStyle = 'rgba(79, 70, 229, 0.12)';
    this.ctx.fill();
    this.ctx.strokeStyle = '#4f46e5';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    const n = this.points.length;
    const dark = document.documentElement.classList.contains('dark-theme');

    // কোণা ১ থেকে সব কর্ণ (বহুভুজকে ত্রিভুজে ভাগ করে যেগুলো)
    if (n > 3) {
      this.ctx.save();
      this.ctx.setLineDash([6, 6]);
      this.ctx.strokeStyle = '#f59e0b';
      this.ctx.lineWidth = 2;
      for (let i = 2; i <= n - 2; i++) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.points[0].x, this.points[0].y);
        this.ctx.lineTo(this.points[i].x, this.points[i].y);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // কেন্দ্র — লেবেল বাইরের দিকে সরাতে লাগে
    const cx = this.points.reduce((a, p) => a + p.x, 0) / n;
    const cy = this.points.reduce((a, p) => a + p.y, 0) / n;

    this.ctx.font = 'bold 12px "Noto Sans Bengali", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.points.forEach((p, idx) => {
      const nextP = this.points[(idx + 1) % n];
      const distPx = Math.hypot(nextP.x - p.x, nextP.y - p.y);
      const distFt = (distPx * this.unitScale).toFixed(1);

      // মাঝবিন্দু, কেন্দ্র থেকে বাইরের দিকে সামান্য সরানো
      let mx = (p.x + nextP.x) / 2;
      let my = (p.y + nextP.y) / 2;
      const ox = mx - cx, oy = my - cy;
      const len = Math.hypot(ox, oy) || 1;
      mx += (ox / len) * 20;
      my += (oy / len) * 20;

      const label = `${toBn(distFt)} ফুট`;
      const wLbl = this.ctx.measureText(label).width + 12;

      this.ctx.fillStyle = dark ? 'rgba(31,41,55,0.95)' : 'rgba(255,255,255,0.95)';
      this.ctx.strokeStyle = dark ? '#4b5563' : '#cbd5e1';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.rect(mx - wLbl / 2, my - 10, wLbl, 20);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = dark ? '#f9fafb' : '#0f172a';
      this.ctx.fillText(label, mx, my);

      // কোণার হাতল ও নম্বর
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      this.ctx.fillStyle = (idx === this.selectedPointIndex) ? '#ef4444' : '#4f46e5';
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 10px "Noto Sans Bengali", sans-serif';
      this.ctx.fillText(toBn(idx + 1), p.x, p.y);
      this.ctx.font = 'bold 12px "Noto Sans Bengali", sans-serif';
    });
  }

  // Shoelace Formula for Area
  calculateAreaSqFt() {
    let area = 0;
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += this.points[i].x * this.points[j].y;
      area -= this.points[j].x * this.points[i].y;
    }
    area = Math.abs(area) / 2;
    // Scale to feet
    return area * (this.unitScale * this.unitScale);
  }

  triggerAreaUpdate() {
    const sqft = this.calculateAreaSqFt();
    if (window.onCanvasAreaChange) {
      window.onCanvasAreaChange(sqft);
    }
  }

  /* ========================================================================
     N-বাহু জ্যামিতি
     ========================================================================

     যেকোনো বহুভুজের আকৃতি নির্দিষ্ট করতে কেবল বাহুর মাপ যথেষ্ট নয় —
     N বাহুর জন্য (N−3) টি কর্ণ লাগে। প্রথম কোণা থেকে কর্ণ টেনে
     বহুভুজটিকে (N−2) টি ত্রিভুজে ভাগ করা হয়; ত্রিভুজ অনড় বলে
     পুরো আকৃতি নির্দিষ্ট হয়ে যায়।

       চতুর্ভুজ  → ৪ বাহু + ১ কর্ণ
       পঞ্চভুজ   → ৫ বাহু + ২ কর্ণ
       ষড়ভুজ    → ৬ বাহু + ৩ কর্ণ
     ======================================================================== */

  /**
   * দুই বৃত্তের ছেদবিন্দু। কোনো ছেদ না থাকলে null (ত্রিভুজ অসম্ভব)।
   * উপরের দিকের (বড় y) বিন্দুটি ফেরত দেয় যাতে বহুভুজ একই দিকে ঘোরে।
   */
  static circleIntersect(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return null;                 // একই কেন্দ্র
    if (d > r1 + r2 + 1e-9) return null;       // বৃত্ত দুটি আলাদা — মাপ মেলে না
    if (d < Math.abs(r1 - r2) - 1e-9) return null; // একটি অন্যটির ভেতরে

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h2 = r1 * r1 - a * a;
    const h = h2 > 0 ? Math.sqrt(h2) : 0;

    const bx = c1.x + (a * dx) / d;
    const by = c1.y + (a * dy) / d;
    // লম্ব দিক
    const px = -dy / d, py = dx / d;

    const s1 = { x: bx + h * px, y: by + h * py };
    const s2 = { x: bx - h * px, y: by - h * py };
    return s1.y >= s2.y ? s1 : s2;
  }

  /**
   * বাহু ও কর্ণ থেকে বহুভুজের প্রকৃত কোণাগুলো (ফুট এককে) হিসাব করে।
   *
   * @param {number[]} sides      N টি বাহু — বাহু i হলো কোণা i → i+1
   * @param {number[]} diagonals  (N−3) টি কর্ণ — কর্ণ i হলো কোণা ১ → i+3
   * @returns {{ok:boolean, points?:Array, error?:string, badAt?:number}}
   */
  static solvePolygon(sides, diagonals) {
    const s = sides.map(v => parseFloat(v) || 0);
    const dg = (diagonals || []).map(v => parseFloat(v) || 0);
    const n = s.length;

    if (n < 3) return { ok: false, error: 'অন্তত ৩টি বাহু দরকার।' };
    if (s.some(v => v <= 0)) return { ok: false, error: 'প্রতিটি বাহুর মাপ শূন্যের বেশি হতে হবে।' };
    if (n > 3 && dg.length < n - 3) return { ok: false, error: `${n} বাহুর জন্য ${n - 3}টি কর্ণের মাপ দরকার।` };
    if (dg.slice(0, Math.max(0, n - 3)).some(v => v <= 0)) {
      return { ok: false, error: 'প্রতিটি কর্ণের মাপ শূন্যের বেশি হতে হবে।' };
    }

    // কোণা ১ মূলবিন্দুতে, কোণা ২ x-অক্ষ বরাবর
    const pts = [{ x: 0, y: 0 }, { x: s[0], y: 0 }];

    for (let i = 2; i < n; i++) {
      const prev = pts[i - 1];
      const rPrev = s[i - 1];                                  // কোণা i → i+1
      // শেষ কোণার ক্ষেত্রে কোণা ১ পর্যন্ত দূরত্ব হলো শেষ বাহু
      const rFirst = (i < n - 1) ? dg[i - 2] : s[n - 1];
      const p = LandCanvasEngine.circleIntersect({ x: 0, y: 0 }, rFirst, prev, rPrev);
      if (!p) {
        const what = (i < n - 1) ? `কর্ণ ${i - 1}` : `শেষ বাহু (${n})`;
        return {
          ok: false, badAt: i,
          error: `${what} এর মাপ দিয়ে ত্রিভুজ তৈরি হয় না — দুই বাহুর যোগফল তৃতীয় বাহুর চেয়ে বড় হতে হবে। মাপগুলো যাচাই করুন।`
        };
      }
      pts.push(p);
    }
    return { ok: true, points: pts };
  }

  /** শোলেস সূত্রে ক্ষেত্রফল (ফুট এককের বিন্দু থেকে) */
  static polygonArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return Math.abs(a) / 2;
  }

  /**
   * ইনপুট থেকে আকৃতি আঁকে।
   * @returns {{ok:boolean, area?:number, error?:string, method?:string}}
   */
  setPolygonInputs(sides, diagonals, useAverage) {
    const n = sides.length;

    // চতুর্ভুজে কর্ণ না দিলে গড় পদ্ধতি (আনুমানিক — সতর্কতা UI-তে দেখানো হয়)
    if (useAverage && n === 4) {
      const [a, b, c, d] = sides.map(v => parseFloat(v) || 0);
      const L = (a + c) / 2, W = (b + d) / 2;
      if (L <= 0 || W <= 0) return { ok: false, error: 'বাহুর মাপ ঠিক নয়।' };
      this.fitPoints([
        { x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: W }, { x: 0, y: W }
      ]);
      this.diagCount = 0;
      this.render();
      this.triggerAreaUpdate();
      return { ok: true, area: L * W, method: 'average' };
    }

    const sol = LandCanvasEngine.solvePolygon(sides, diagonals);
    if (!sol.ok) return sol;

    this.fitPoints(sol.points);
    this.diagCount = Math.max(0, n - 3);
    this.render();
    this.triggerAreaUpdate();
    return { ok: true, area: LandCanvasEngine.polygonArea(sol.points), method: 'exact' };
  }

  /** ফুট এককের বিন্দুগুলো ক্যানভাসে ফিট করে বসায় */
  fitPoints(ptsFt) {
    const xs = ptsFt.map(p => p.x), ys = ptsFt.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const wFt = Math.max(maxX - minX, 1e-6);
    const hFt = Math.max(maxY - minY, 1e-6);

    const pad = 60;                                  // লেবেলের জন্য জায়গা
    const availW = Math.max(this.canvas.width - pad * 2, 50);
    const availH = Math.max(this.canvas.height - pad * 2, 50);
    const scale = Math.min(availW / wFt, availH / hFt);

    this.unitScale = 1 / scale;                      // ১ পিক্সেল = কত ফুট
    const offX = (this.canvas.width - wFt * scale) / 2;
    const offY = (this.canvas.height - hFt * scale) / 2;

    // ক্যানভাসে y নিচের দিকে বাড়ে, তাই উল্টে বসাই
    this.points = ptsFt.map(p => ({
      x: offX + (p.x - minX) * scale,
      y: this.canvas.height - offY - (p.y - minY) * scale
    }));
  }

  /** পুরনো নাম — চার বাহু + কর্ণ (আগের কোডের সাথে সামঞ্জস্যের জন্য) */
  setQuadInputs(north, east, south, west, diagonal) {
    return this.setPolygonInputs(
      [north, east, south, west], [diagonal], !(parseFloat(diagonal) > 0)
    );
  }

  exportImagePNG() {
    return this.canvas.toDataURL('image/png');
  }
}
