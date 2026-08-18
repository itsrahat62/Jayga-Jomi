/* বাকি টুলগুলোর গণিত যাচাই — ভাগ-বণ্টন · ক্ষেত্রফল · ম্যাপ জয়েন্ট */
const path = require('path').join(__dirname, '..', 'js') + require('path').sep;
global.CadCore = require(path + 'cad-core.js');
global.CadOverlay = require(path + 'cad-overlay.js');
const CadDivide = require(path + 'cad-divide.js');
const { AreaSolver, MapJoint } = require(path + 'land-extra.js');

let pass = 0, fail = 0;
const ok = (n, c, e) => {
  if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (e ? '  → ' + e : '')); }
};
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-6 : t);
const sq = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
const doc = { ftPerPx: 1 };

console.log('\n=== ১. ভাগ-বণ্টন: হিস্যা স্বাভাবিকীকরণ ===');
ok('২:১:১ → ০.৫/০.২৫/০.২৫', (() => {
  const n = CadDivide.normalize([{value:2},{value:1},{value:1}], 'ratio');
  return near(n.weights[0], .5) && near(n.weights[1], .25);
})());
ok('৮+৮ আনা = ১৬, সতর্কতা নেই', CadDivide.normalize([{value:8},{value:8}], 'ana').warn === null);
ok('১২ আনা হলে সতর্ক করে', !!CadDivide.normalize([{value:8},{value:4}], 'ana').warn);
ok('খালি তালিকায় সতর্ক', !!CadDivide.normalize([], 'ratio').warn);

console.log('\n=== ২. ভাগ-বণ্টন: ক্ষেত্রফল ===');
let r = CadDivide.divide(doc, sq, [{name:'ক',value:2},{name:'খ',value:1},{name:'গ',value:1}],
                         { mode:'ratio', angle:0 });
ok('তিন ভাগ', r.parts.length === 3);
ok('৫০০০ / ২৫০০ / ২৫০০', r.parts.every((p,i) => near(p.areaPx, [5000,2500,2500][i], 10)),
   r.parts.map(p => Math.round(p.areaPx)).join('/'));
ok('যোগফল অটুট', near(r.sumSqft, 10000, 2), r.sumSqft.toFixed(1));
ok('হেরফের ০.৫% এর কম', r.maxErrorPct < 0.5, r.maxErrorPct.toFixed(4) + '%');

const L = [{x:0,y:0},{x:100,y:0},{x:100,y:30},{x:30,y:30},{x:30,y:100},{x:0,y:100}];
r = CadDivide.divide(doc, L, [{value:1},{value:1}], { angle:0 });
ok('অবতল L আকৃতিও সমান ভাগ হয়', Math.abs(r.parts[0].areaPx - r.parts[1].areaPx) < 40,
   r.parts.map(p => Math.round(p.areaPx)).join('/'));
ok('L এর যোগফল অটুট', near(r.sumSqft, CadCore.area(L), 5));

console.log('\n=== ৩. ভাগ-বণ্টন: কোণ ও আকৃতি ===');
const r0 = CadDivide.divide(doc, sq, [{value:1},{value:1}], { angle:0 });
const r90 = CadDivide.divide(doc, sq, [{value:1},{value:1}], { angle:Math.PI/2 });
ok('কোণ বদলালে কাটার দিকও বদলায়',
   Math.abs(CadCore.bbox(r0.parts[0].pts).w - CadCore.bbox(r90.parts[0].pts).w) > 10);
ok('দুই কোণেই ক্ষেত্রফল ঠিক',
   near(r0.parts[0].areaPx, 5000, 5) && near(r90.parts[0].areaPx, 5000, 5));
const wide = [{x:0,y:0},{x:200,y:0},{x:200,y:50},{x:0,y:50}];
ok('সেরা কোণ = লম্বা বাহু বরাবর',
   near(Math.abs(CadDivide.suggestAngle(wide)) % Math.PI, 0, 0.01));

console.log('\n=== ৪. বাহুর মাপ থেকে আকৃতি ===');
const tri = CadDivide.fromSides([30,40,50], null, 1);
ok('৩-৪-৫ ত্রিভুজ, ক্ষেত্রফল ৬০০', tri && near(CadCore.area(tri), 600, 1));
ok('অসম্ভব ত্রিভুজ বাতিল', CadDivide.fromSides([1,1,10], null, 1) === null);
const rect = CadDivide.fromSides([100,80,100,80], null, 1);
ok('কর্ণ ছাড়া চতুর্ভুজে ৪টি আলাদা কোণা', rect && CadCore.dedupe(rect, 1e-6).length === 4);
ok('আয়তক্ষেত্রের ক্ষেত্রফল ৮০০০', rect && near(CadCore.area(rect), 8000, 1),
   rect ? CadCore.area(rect).toFixed(1) : '-');
const trap = CadDivide.fromSides([120,60,80,70], null, 1);
ok('ট্রাপিজিয়ামের ১ম ও ৩য় বাহু মেলে', trap &&
   near(CadCore.dist(trap[0],trap[1]), 120, 0.5) && near(CadCore.dist(trap[2],trap[3]), 80, 0.5));
ok('বিকৃত আকৃতিতে ভাগ ব্যর্থ বলে জানায', (() => {
  const bad = CadDivide.divide(doc, [{x:0,y:0},{x:100,y:0},{x:100,y:80},{x:100,y:80}],
                               [{value:1},{value:1},{value:1}], { angle:0 });
  return bad.ok === false || bad.parts.every(p => p.areaPx > 0);
})());

console.log('\n=== ৫. ক্ষেত্রফল: হেরন ও চতুর্ভুজ ===');
ok('৩-৪-৫ ত্রিভুজ = ৬', near(AreaSolver.triangle(3,4,5), 6));
ok('অসম্ভব ত্রিভুজ null', AreaSolver.triangle(1,1,10) === null);
ok('কর্ণসহ বর্গ = ১০০', near(AreaSolver.quadWithDiagonal(10,10,10,10,Math.sqrt(200)), 100));
ok('ব্রহ্মগুপ্ত: বর্গের সর্বোচ্চ = ১০০', near(AreaSolver.quadMax(10,10,10,10), 100));
ok('সর্বোচ্চ ≥ প্রকৃত', AreaSolver.quadMax(10,10,10,10) >= AreaSolver.quadWithDiagonal(10,10,10,10,14));
ok('অসম্ভব চতুর্ভুজ null', AreaSolver.quadMax(1,1,1,100) === null);

console.log('\n=== ৬. অজানা বাহু ===');
let u = AreaSolver.triangleUnknownSide(30, 40, 600);
ok('সমকোণী ফিরে আসে (৫০)', u && u.sides.some(s => near(s, 50, 1e-6)),
   u ? u.sides.map(s => s.toFixed(2)).join('/') : 'null');
ok('সর্বোচ্চ ক্ষেত্রফল = ab/2', u && near(u.maxArea, 600));
u = AreaSolver.triangleUnknownSide(30, 40, 500);
ok('সর্বোচ্চ না হলে দুটি উত্তর', u && u.sides.length === 2);
ok('দুটি উত্তরই ঐ ক্ষেত্রফল দেয়',
   u && u.sides.every(s => near(AreaSolver.triangle(30,40,s), 500, 1e-6)));
ok('অসম্ভব ক্ষেত্রফল বাতিল', AreaSolver.triangleUnknownSide(30,40,700) === null);
ok('চতুর্ভুজের ৪র্থ বাহু = ১০', (() => {
  const q = AreaSolver.quadUnknownSide(10, 10, Math.sqrt(200), 10, 100);
  return q && q.sides.some(s => near(s, 10, 1e-6));
})());
ok('আয়তক্ষেত্র: ক্ষেত্রফল ÷ দৈর্ঘ্য', near(AreaSolver.rect(20,0,200).wid, 10));
ok('আয়তক্ষেত্রে দুটি মান লাগে', AreaSolver.rect(20,0,0) === null);
ok('৪৩৫.৬ বর্গফুট = ১ শতাংশ', near(AreaSolver.units(435.6).satak, 1));

console.log('\n=== ৭. ম্যাপ জয়েন্ট ===');
const rot = Math.PI/2, sc = 2;
const mk = p => ({ x: sc*(Math.cos(rot)*p.x - Math.sin(rot)*p.y) + 100,
                   y: sc*(Math.sin(rot)*p.x + Math.cos(rot)*p.y) + 50 });
const src = [{x:0,y:0},{x:10,y:0}];
let t = MapJoint.solve(src, src.map(mk));
ok('স্কেল ২ ফিরে আসে', t && near(t.scale, 2, 1e-9), t ? t.scale.toFixed(6) : 'null');
ok('ঘূর্ণন ৯০°', t && near(Math.abs(t.rotationDeg), 90, 1e-6));
ok('বিন্দু হুবহু বসে', t && near(t.apply(src[1]).x, mk(src[1]).x, 1e-9));
ok('ত্রুটি প্রায় শূন্য', t && t.rmse < 1e-9);
ok('একই বিন্দু দিলে বাতিল',
   MapJoint.solve([{x:1,y:1},{x:1,y:1}], [{x:0,y:0},{x:5,y:5}]) === null);
const src3 = [{x:0,y:0},{x:10,y:0},{x:0,y:10}];
const dst3 = src3.map(mk); dst3[2].x += 1;              // একটু গোলমাল
t = MapJoint.solve(src3, dst3);
ok('৩ জোড়ায় গড় নেওয়া হয়', t && t.pairs === 3 && t.rmse > 0 && t.rmse < 1,
   t ? t.rmse.toFixed(4) : '-');
ok('মিলের মান বলা হয়', MapJoint.quality(1).level === 'great' && MapJoint.quality(50).level === 'bad');
ok('চার কোণা বের হয়', t && MapJoint.corners(t, 100, 80).length === 4);
ok('সম্মিলিত ঘের', !!MapJoint.bounds([[{x:0,y:0},{x:10,y:10}],[{x:-5,y:3},{x:2,y:20}]]));

console.log('\n=== ৮. মৌজা নকশার একাধিক উৎস ===');
const MS = require(path + 'mouza-multi-source.js');
ok('ছয়টি বিল্ট-ইন উৎস', MS.BUILTIN.length === 6, MS.BUILTIN.length);
ok('তিনটি সরাসরি আনা যায়', MS.BUILTIN.filter(s => s.direct).length === 3);
ok('পোর্টালের ঠিকানা https', MS.BUILTIN.filter(s => s.kind === 'portal').every(s => /^https:/.test(s.url)));
ok('আইডি দিয়ে খোঁজা যায়', MS.get('archive').kind === 'archive' && MS.get('nope') === null);
ok('ড্রাইভ শেয়ার লিংক চেনে',
   MS.parseLink('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view').kind === 'drive');
ok('ড্রাইভ আইডি বের হয়',
   MS.parseLink('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view').id
   === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs');
ok('open?id= ধরনও চেনে',
   MS.parseLink('https://drive.google.com/open?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs').kind === 'drive');
ok('খালি আইডি বসালেও চলে', MS.parseLink('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs').kind === 'drive');
ok('সাধারণ URL চেনে', MS.parseLink('https://cdn.example.com/m.pdf').kind === 'direct');
ok('লিংক না হলে null', MS.parseLink('এটা লিংক নয়') === null && MS.parseLink('') === null);
ok('PDF চেনে', MS.sniff(new Uint8Array([0x25,0x50,0x44,0x46])) === 'application/pdf');
ok('JPEG চেনে', MS.sniff(new Uint8Array([0xFF,0xD8,0xFF,0xE0])) === 'image/jpeg');
ok('PNG চেনে', MS.sniff(new Uint8Array([0x89,0x50,0x4E,0x47])) === 'image/png');
ok('TIFF চেনে', MS.sniff(new Uint8Array([0x49,0x49,0x2A,0x00])) === 'image/tiff');
ok('অচেনা হলে খালি', MS.sniff(new Uint8Array([1,2,3,4])) === '');
ok('ভুল ঠিকানা যোগ হয় না', MS.addCustom({ name: 'x', url: 'ftp://a' }).ok === false);
ok('নাম ছাড়া যোগ হয় না', MS.addCustom({ name: '', url: 'https://a.com' }).ok === false);
ok('localStorage ছাড়াও ভাঙে না', Array.isArray(MS.custom()));


console.log('\n=== অর্ধেকের বেশি হিস্যা (রিগ্রেশন) ===');
/* ★ যে বাগটা ধরা পড়েছিল
   splitByFraction এর দ্বিভাজন সীমা ছিল কেন্দ্র থেকে ±span, আর রেখা দাগের
   বাইরে গেলে নিঃশর্তে lo = t করা হতো। ধনাত্মক পাশে বেরোলে বাঁ ভাগ = পুরো
   দাগ, অর্থাৎ বেশি — তখন hi নামানো উচিত ছিল। ফলে অনুসন্ধান বাইরে বেরিয়ে
   আর ফিরত না, আর best থেকে যেত প্রথম চেষ্টাটাই (ঠিক অর্ধেক)।
   **হিস্যা অর্ধেকের বেশি হলেই ভাগ সমান হয়ে যেত** — ১২:৪ আনা দিলেও ৮:৮।
   তিনজনের ক্ষেত্রে ধরা পড়েনি, কারণ ৮:৪:৪ এ প্রতিটি ধাপে ভগ্নাংশ ঠিক ০.৫। */
{
  const sq = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
  const A = CadCore.area(sq);

  [0.1, 0.25, 0.5, 0.667, 0.8, 0.9].forEach(f => {
    const c = CadOverlay.splitByFraction(sq, f, 0);
    ok('ভগ্নাংশ ' + f + ' ঠিক কাটে',
       c && Math.abs(CadCore.area(c.left) / A - f) < 0.002,
       c ? (CadCore.area(c.left) / A).toFixed(4) : 'null');
  });

  [0, 30, 45, 90, 135].forEach(d => {
    const c = CadOverlay.splitByFraction(sq, 0.75, d * Math.PI / 180);
    ok('০.৭৫ ভাগ ' + d + '° কোণেও ঠিক',
       c && Math.abs(CadCore.area(c.left) / A - 0.75) < 0.002,
       c ? (CadCore.area(c.left) / A).toFixed(4) : 'null');
  });

  /* অনিয়মিত (L) আকৃতিতেও */
  const L = [{x:0,y:0},{x:120,y:0},{x:120,y:60},{x:60,y:60},{x:60,y:120},{x:0,y:120}];
  const AL = CadCore.area(L);
  [0.25, 0.6, 0.85].forEach(f => {
    const c = CadOverlay.splitByFraction(L, f, 0.3);
    ok('L-আকৃতিতে ভগ্নাংশ ' + f,
       c && Math.abs(CadCore.area(c.left) / AL - f) < 0.003,
       c ? (CadCore.area(c.left) / AL).toFixed(4) : 'null');
  });

  /* পূর্ণ ভাগ-বণ্টনে — ১২:৪ আনা মানে তিন-চতুর্থাংশ ও এক-চতুর্থাংশ */
  const r = CadDivide.divide({ ftPerPx: 1 }, sq,
    [{name:'ক',value:'12'},{name:'খ',value:'4'}], { mode:'ana', angle:0 });
  ok('১২:৪ আনা → ৭৫% ও ২৫%',
     r.ok && Math.abs(r.parts[0].sqft / A - 0.75) < 0.002
          && Math.abs(r.parts[1].sqft / A - 0.25) < 0.002,
     r.ok ? r.parts.map(x => (x.sqft / A).toFixed(4)).join(' / ') : r.error);
  ok('১২:৪ এর যোগফল পুরো জমি',
     r.ok && Math.abs(r.parts.reduce((s2,x) => s2 + x.sqft, 0) - A) < A * 0.002);

  /* দুইয়ের বেশি অংশেও অর্ধেকের বেশি প্রথমে */
  const r3 = CadDivide.divide({ ftPerPx: 1 }, sq,
    [{name:'ক',value:'10'},{name:'খ',value:'3'},{name:'গ',value:'3'}], { mode:'ana', angle:0 });
  ok('১০:৩:৩ আনা ঠিক ভাগ হয়',
     r3.ok && Math.abs(r3.parts[0].sqft / A - 10/16) < 0.003
           && Math.abs(r3.parts[1].sqft / A - 3/16) < 0.003,
     r3.ok ? r3.parts.map(x => (x.sqft / A).toFixed(4)).join(' / ') : r3.error);

  /* একজনই সব — কাটার দরকার নেই */
  const r1 = CadDivide.divide({ ftPerPx: 1 }, sq, [{name:'ক',value:'16'}],
    { mode:'ana', angle:0 });
  ok('একজন হলে পুরোটাই তার',
     r1.ok && r1.parts.length === 1 && Math.abs(r1.parts[0].sqft - A) < 1);
}

console.log('\n──────────────────────────────');
console.log('  পাস ' + pass + ' · ব্যর্থ ' + fail);
console.log('──────────────────────────────\n');
process.exit(fail ? 1 : 0);
