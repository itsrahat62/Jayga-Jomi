/* ==========================================================================
   mouza-sources.js — মৌজা মূল্য PDF এর নিজস্ব উৎস (Google Drive / R2 / নিজের সার্ভার)
   --------------------------------------------------------------------------
   এই ফাইলটাই ভবিষ্যতে বদলাতে হবে — টুলের আর কোনো কোড ছুঁতে হবে না।

   কাজের নিয়ম:
     • এখানে কোনো অফিসের ফাইল থাকলে → সেটাই দেখানো হবে (নিজস্ব উৎস)
     • না থাকলে → amarvumi এর API থেকে যে লিংক আসে সেটা দেখানো হবে

   কীভাবে যোগ করবেন:
     ১. টুলে গিয়ে বিভাগ → জেলা → অফিস → বছর বেছে নিন
     ২. ফলাফলের নিচে "কনফিগ কোড কপি" বোতামে ক্লিক করুন
     ৩. কপি হওয়া লাইনটা নিচের OFFICES এর ভেতরে বসিয়ে দিন
     ৪. Google Drive এ ফাইলটা আপলোড করে "Anyone with the link" করুন
     ৫. লিংক থেকে শুধু আইডিটুকু নিন:
          https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBd/view?usp=sharing
                                          ^^^^^^^^^^^^^^^^^^^^  ← এই অংশটুকু

   তিন রকম মান বসানো যায় (যেটা সুবিধা):
     "1BxiMVs0XRA5nFMdKvBd"                          → Google Drive আইডি
     "https://drive.google.com/file/d/xxx/preview"   → পুরো Drive লিংক
     "https://cdn.example.com/mouza/2025/dhaka.pdf"  → নিজের সার্ভারের ফাইল
   ========================================================================== */

const MouzaSources = {

  /**
   * officeId → { বছর: লিংক-বা-আইডি }
   * officeId হলো amarvumi এর ২৪ অক্ষরের আইডি (টুল থেকে কপি করা যায়)।
   */
  OFFICES: {
    // উদাহরণ (মন্তব্য তুলে দিলেই সক্রিয় হবে):
    //
    // "63819a100c2ba5e6beec9a80": {              // সাব-রেজিস্ট্রারের কার্যালয়, পল্লবী — ঢাকা
    //   "2025": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs",
    //   "2024": "1CyjNWt1YSB6oGNeLwCeCakhnVVrquMct"
    // },
  },

  /**
   * পুরো বছরের জন্য এক ধাক্কায় নিজের হোস্টিং ব্যবহার করতে চাইলে এখানে
   * একটা প্যাটার্ন দিন। {officeId} ও {year} বসে যাবে।
   * OFFICES এ আলাদা করে কিছু দেওয়া না থাকলে তবেই এটা কাজ করবে।
   *
   * উদাহরণ: "https://cdn.example.com/mouza/{year}/{officeId}.pdf"
   */
  PATTERN: {
    // "2025": "https://cdn.example.com/mouza/2025/{officeId}.pdf",
  },

  /* ----------------------------------------------------------------------
     নিচের অংশ সাধারণত বদলাতে হবে না
     ---------------------------------------------------------------------- */

  /** Google Drive আইডি দেখতে যেমন হয় — অক্ষর/সংখ্যা/হাইফেন/আন্ডারস্কোর, ২০+ লম্বা */
  DRIVE_ID_RE: /^[A-Za-z0-9_-]{20,}$/,

  /**
   * কাঁচা মান (আইডি বা লিংক) থেকে ব্রাউজারে দেখানোর মতো URL বানায়।
   * @returns {{view:string, open:string, kind:'drive'|'direct'}|null}
   */
  normalize(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const v = raw.trim();
    if (!v) return null;

    // ১. শুধু Drive আইডি দেওয়া হয়েছে
    if (this.DRIVE_ID_RE.test(v) && !v.includes('/') && !v.includes('.')) {
      return {
        view: `https://drive.google.com/file/d/${v}/preview`,
        open: `https://drive.google.com/file/d/${v}/view`,
        kind: 'drive'
      };
    }

    // ২. পুরো Drive লিংক দেওয়া হয়েছে — আইডি বের করে preview বানাই
    const m = v.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^#]*id=)([A-Za-z0-9_-]+)/);
    if (m) {
      return {
        view: `https://drive.google.com/file/d/${m[1]}/preview`,
        open: `https://drive.google.com/file/d/${m[1]}/view`,
        kind: 'drive'
      };
    }

    // ৩. সাধারণ লিংক — যেমনটা আছে তেমনই
    return { view: v, open: v, kind: 'direct' };
  },

  /**
   * এই অফিস+বছরের জন্য নিজস্ব ফাইল আছে কি না।
   * আগে OFFICES দেখে, না পেলে PATTERN দেখে।
   */
  lookup(officeId, year) {
    if (!officeId || !year) return null;
    const y = String(year);

    const byOffice = this.OFFICES[officeId];
    if (byOffice && byOffice[y]) return this.normalize(byOffice[y]);

    const pat = this.PATTERN[y];
    if (pat) {
      return this.normalize(
        pat.replace(/\{officeId\}/g, officeId).replace(/\{year\}/g, y)
      );
    }
    return null;
  },

  /** কনফিগে বসানোর মতো একটা কোড-স্নিপেট বানায় (কপি বোতামের জন্য) */
  snippetFor(officeId, officeName, year) {
    return [
      `"${officeId}": {`,
      `  // ${officeName || ''}`,
      `  "${year}": "এখানে Google Drive আইডি বসান"`,
      `},`
    ].join('\n');
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = MouzaSources;
