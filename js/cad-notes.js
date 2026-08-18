/* ==========================================================================
   cad-notes.js — নকশার উপরে লেখা, চিহ্ন ও বৃত্ত
   --------------------------------------------------------------------------
   ★ কেন আলাদা তালিকায় রাখা হলো
     "দাগ" (features) থেকে ক্ষেত্রফলের যোগ, পেন্টাগ্রাফ, তফসিল টেবিল —
     সবই বেরোয়। সেখানে "রাস্তা" লেখা বা একটি কুয়ার চিহ্ন ঢুকিয়ে দিলে
     মোট ক্ষেত্রফল ভুল হয়ে যেত। তাই নোটগুলো `doc.notes` — আলাদা তালিকা।
     আঁকা, শিট ও KMZ-তে দেখা যায়, কিন্তু কোনো হিসাবে যোগ হয় না।

   ★ ধরন
     text   — কেবল লেখা (রাস্তা, পুকুরপাড়, বাড়ি…)
     pin    — ছোট চিহ্ন + পাশে লেখা (টিউবওয়েল, খুঁটি, গাছ…)
     circle — বৃত্ত; r = পিক্সেলে ব্যাসার্ধ। কুয়া, পুকুর বা "এই এলাকা"
              বোঝাতে। ক্ষেত্রফল আলাদা করে দেখানো হয়, মোটে যোগ হয় না।

   স্থানাঙ্ক সবসময় **নকশার পিক্সেল** — দাগগুলোর মতোই। তাই জুম/প্যান/
   জোড়া লাগানো/ভূ-স্থানাঙ্ক — সব এক নিয়মে চলে।
   ========================================================================== */

const CadNotes = {

  KINDS: [
    { id: 'text',   name: 'লেখা',  icon: 'bi-fonts',      hint: 'নকশায় নাম বা মন্তব্য লিখুন' },
    { id: 'pin',    name: 'চিহ্ন', icon: 'bi-geo-alt-fill', hint: 'টিউবওয়েল, খুঁটি, গাছ — ছোট চিহ্ন' },
    { id: 'circle', name: 'বৃত্ত', icon: 'bi-circle',     hint: 'কুয়া বা গোল জায়গা — মাঝ থেকে টানুন' }
  ],

  ensure(doc) {
    if (!Array.isArray(doc.notes)) doc.notes = [];
    if (!doc._nseq) doc._nseq = 1;
    return doc.notes;
  },

  add(doc, kind, x, y, opts) {
    this.ensure(doc);
    const o = opts || {};
    const n = {
      id: 'n' + (doc._nseq++),
      kind: kind === 'pin' || kind === 'circle' ? kind : 'text',
      x: x, y: y,
      r: kind === 'circle' ? Math.max(1, Number(o.r) || 20) : 0,
      text: o.text == null ? '' : String(o.text),
      color: o.color || '#b45309',
      size: Number(o.size) || 14,          // পর্দার মাপে (annotative)
      hidden: o.hidden === true
    };
    doc.notes.push(n);
    return n;
  },

  remove(doc, id) {
    this.ensure(doc);
    const i = doc.notes.findIndex(n => n.id === id);
    if (i >= 0) { doc.notes.splice(i, 1); return true; }
    return false;
  },

  find(doc, id) {
    this.ensure(doc);
    return doc.notes.find(n => n.id === id) || null;
  },

  visible(doc) {
    this.ensure(doc);
    return doc.notes.filter(n => !n.hidden);
  },

  /**
   * কোন নোটে ক্লিক পড়ল
   * tol নকশার পিক্সেলে — ডাকার সময় পর্দার ৮-১০px কে scale দিয়ে ভাগ করে দিন,
   * তাহলে জুম যেখানেই থাকুক আঙুলের নিচে একই রকম লাগে।
   */
  hit(doc, pt, tol) {
    this.ensure(doc);
    const t = Math.max(1e-6, tol || 6);
    let best = null, bestD = Infinity;
    for (let i = doc.notes.length - 1; i >= 0; i--) {   // উপরেরটা আগে
      const n = doc.notes[i];
      if (n.hidden) continue;
      const d = Math.hypot(pt.x - n.x, pt.y - n.y);
      if (n.kind === 'circle') {
        // পরিধির কাছে, নাকি ভেতরে — দুটোই ধরি
        const dr = Math.abs(d - n.r);
        if (dr <= t && dr < bestD) { bestD = dr; best = n; }
        else if (d <= n.r && bestD === Infinity) { bestD = n.r; best = n; }
      } else if (d <= t * 2.2 && d < bestD) { bestD = d; best = n; }
    }
    return best;
  },

  move(note, dx, dy) {
    if (!note) return;
    note.x += dx; note.y += dy;
  },

  /** বৃত্তের ক্ষেত্রফল — বর্গফুটে (স্কেল না বসলে ০) */
  circleSqft(doc, note) {
    if (!note || note.kind !== 'circle' || !(doc.ftPerPx > 0)) return 0;
    const rft = note.r * doc.ftPerPx;
    return Math.PI * rft * rft;
  },

  /** বৃত্তকে বহুভুজে — KMZ ও শিটে আঁকতে লাগে */
  circlePts(note, seg) {
    const n = Math.max(12, seg || 48);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push({ x: note.x + Math.cos(a) * note.r, y: note.y + Math.sin(a) * note.r });
    }
    return out;
  },

  /** এক লাইনে পড়ার মতো বিবরণ — তালিকা ও status এ */
  describe(doc, n) {
    const k = this.KINDS.find(x => x.id === n.kind);
    const nm = (k ? k.name : 'নোট');
    if (n.kind === 'circle') {
      const a = this.circleSqft(doc, n);
      return nm + (n.text ? ' — ' + n.text : '')
        + (a > 0 ? ' (' + CadCore.satakText(a) + ')' : '');
    }
    return nm + (n.text ? ' — ' + n.text : ' (লেখা নেই)');
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CadNotes;
