/* ==========================================================================
   tool-groups.js — কাছাকাছি কাজের টুলগুলো এক কার্ডে, ভেতরে ট্যাব
   --------------------------------------------------------------------------
   ★ কেন
     আগে ২৫টি কার্ড ছিল। তার মধ্যে পাঁচটি ছিল রূপান্তরের (একক, আনা-গন্ডা,
     হিস্যা, অনুপাত, সূত্র), চারটি খতিয়ানের, তিনটি ক্ষেত্রফলের — নাম দেখে
     কোনটায় ঢুকতে হবে বোঝা যেত না, একই কাজ কয়েক জায়গায় ছিল।
     এখন একটি কার্ড = একটি কাজ; ভেতরে ট্যাব দিয়ে ধরনগুলো।

   ★ কীভাবে
     পুরোনো ভিউ ও তাদের init কোড **অপরিবর্তিত** — কেবল উপরে একটি ট্যাব-বার
     বসে। তাই `openToolModal('ana-gonda')` এর মতো পুরোনো লিংকও কাজ করে,
     আর নিজে থেকেই ঠিক ট্যাবটি সক্রিয় দেখায়।
   ========================================================================== */

const ToolGroups = {

  GROUPS: {
    'zomi-area': {
      title: 'জমির ক্ষেত্রফল', icon: 'bi-bounding-box',
      tabs: [
        { id: 'canvas-measure', name: 'বাহু থেকে ক্ষেত্রফল', icon: 'bi-pentagon' },
        { id: 'area-unknown',   name: 'অজানা বাহু',          icon: 'bi-question-square' },
        { id: 'print-studio',   name: 'প্রতিবেদন ছাপুন',      icon: 'bi-printer' }
      ]
    },
    'zomi-hisab': {
      title: 'একক, হিস্যা ও সূত্র', icon: 'bi-arrow-left-right',
      tabs: [
        { id: 'unit-converter', name: 'একক বদল',    icon: 'bi-arrow-repeat' },
        { id: 'ana-gonda',      name: 'আনা-গন্ডা',  icon: 'bi-diagram-2' },
        { id: 'hissa-calc',     name: 'হিস্যা',      icon: 'bi-percent' },
        { id: 'ratio',          name: 'অনুপাত',      icon: 'bi-sliders' },
        { id: 'land-formula',   name: 'সূত্র',       icon: 'bi-book' }
      ]
    },
    'khotian': {
      title: 'খতিয়ান, অংশ ও তফসিল', icon: 'bi-table',
      tabs: [
        { id: 'khotian-porcha',   name: 'পর্চার হিসাব',     icon: 'bi-table' },
        { id: 'khotian-analyzer', name: 'মালিকের হিস্যা',   icon: 'bi-people' },
        { id: 'dag-portion',      name: 'দাগের অংশ',        icon: 'bi-pie-chart' },
        { id: 'tofasil',          name: 'তফসিল বণ্টন',      icon: 'bi-file-text' }
      ]
    }
  },

  /** এই টুলটি কোন গ্রুপে — না থাকলে null */
  of(toolId) {
    for (const gid in this.GROUPS) {
      if (this.GROUPS[gid].tabs.some(t => t.id === toolId)) {
        return { id: gid, group: this.GROUPS[gid] };
      }
    }
    return null;
  },

  render(toolId) {
    const bar = document.getElementById('group-tabs');
    if (!bar) return false;
    const g = this.of(toolId);
    if (!g) { bar.style.display = 'none'; bar.innerHTML = ''; return false; }

    bar.style.display = '';
    bar.innerHTML = g.group.tabs.map(t =>
      '<button type="button" class="grp-tab' + (t.id === toolId ? ' active' : '') + '"'
      + ' onclick="AppController.openToolModal(\'' + t.id + '\')">'
      + '<i class="bi ' + t.icon + '"></i> ' + t.name + '</button>').join('');

    // শিরোনাম গ্রুপের নামে — ভেতরে কোথায় আছি সেটি ট্যাবেই দেখা যায়
    const tt = document.getElementById('modal-title-text');
    const ic = document.getElementById('modal-title-icon');
    if (tt) tt.innerText = g.group.title;
    if (ic) ic.className = 'bi ' + g.group.icon + ' text-primary';
    return true;
  }
};

document.addEventListener('DOMContentLoaded', function () {
  if (typeof AppController === 'undefined') return;
  const orig = AppController.openToolModal.bind(AppController);
  AppController.openToolModal = function (toolId) {
    orig(toolId);
    // শিরোনাম বসানোর সব কোডের **পরে** চালাতে হয়, নইলে গ্রুপের নাম চাপা পড়ে
    setTimeout(() => ToolGroups.render(toolId), 0);
  };
});

if (typeof module !== 'undefined' && module.exports) module.exports = ToolGroups;
