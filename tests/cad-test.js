/* CAD মডিউলের গণিত যাচাই — Node এ */
const path = require('path').join(__dirname, '..', 'js') + require('path').sep;
global.CadCore = require(path + 'cad-core.js');
global.CadTrace = require(path + 'cad-trace.js');
global.CadOverlay = require(path + 'cad-overlay.js');
global.CadNotes = require(path + 'cad-notes.js');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
};
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);

console.log('\n=== ১. স্কেল ও একক ===');
ok('120" = 1 mile → 44 ft per map inch', near(CadCore.feetPerMapInch(120), 44));
ok('16" = 1 mile → RF 1:3960', near(CadCore.rfDenominator(16), 3960));
ok('64" = 1 mile → RF 1:990', near(CadCore.rfDenominator(64), 990));
ok('120" @ 300dpi → ft/px', near(CadCore.ftPerPxFromScale(120, 300), 44 / 300));
ok('scaleInchFrom inverse', near(CadCore.scaleInchFrom(44 / 300, 300), 120, 1e-9));
ok('1 শতাংশ = 435.6 sqft', near(CadCore.areaUnits(435.6).satak, 1));
ok('1 একর = 100 শতাংশ', near(CadCore.areaUnits(43560).satak, 100));

console.log('\n=== ২. ফুট-ইঞ্চি লেখা ===');
ok("59.0833 ft → 59'-1\"", CadCore.ftIn(59 + 1 / 12, { english: true }) === "59'-1\"", CadCore.ftIn(59 + 1 / 12, { english: true }));
ok("53 ft → 53' (ইঞ্চি ০ হলে বাদ)", CadCore.ftIn(53, { english: true }) === "53'", CadCore.ftIn(53, { english: true }));
ok('11.99 ইঞ্চি → পরের ফুটে ওঠে', CadCore.ftIn(52.9999, { english: true }) === "53'", CadCore.ftIn(52.9999, { english: true }));
ok('বাংলা অঙ্ক ছাড়া ভাঙে না', typeof CadCore.ftIn(10.5) === 'string');

console.log('\n=== ৩. জ্যামিতি ===');
const sq = [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
ok('বর্গের ক্ষেত্রফল ১০০', near(CadCore.area(sq), 100));
ok('বর্গের পরিসীমা ৪০', near(CadCore.perimeter(sq, true), 40));
ok('বর্গের কেন্দ্র (৫,৫)', near(CadCore.centroid(sq).x, 5) && near(CadCore.centroid(sq).y, 5));
ok('ভেতরের বিন্দু চেনা', CadCore.pointInPolygon({x:5,y:5}, sq));
ok('বাইরের বিন্দু চেনা', !CadCore.pointInPolygon({x:15,y:5}, sq));

// L-আকৃতি — ভরকেন্দ্র বাইরে পড়ে, labelPoint ভেতরে হওয়া চাই
const L = [{x:0,y:0},{x:10,y:0},{x:10,y:3},{x:3,y:3},{x:3,y:10},{x:0,y:10}];
const lp = CadCore.labelPoint(L);
ok('L-আকৃতিতে লেবেল ভেতরে বসে', CadCore.pointInPolygon(lp, L),
   JSON.stringify(lp));

// সরলীকরণ
const noisy = [];
for (let i = 0; i <= 40; i++) noisy.push({ x: i, y: (i % 2) * 0.2 });
const simp = CadCore.simplifyDP(noisy, 0.5);
ok('DP সরলীকরণ বিন্দু কমায়', simp.length < 6, simp.length + ' বিন্দু');

const wob = [{x:0,y:0},{x:5,y:0.05},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
const st = CadCore.straighten(wob, 8, true);
ok('প্রায়-সরল ভাঁজ মোছে', st.length === 4, st.length + ' বিন্দু');

console.log('\n=== ৪. স্ন্যাপ ===');
const feats = [{ id: 'a', pts: sq, closed: true }];
const snapV = CadCore.snap({ x: 10.5, y: 0.4 }, feats, { tol: 2 });
ok('কোণায় স্ন্যাপ', snapV.kind === 'vertex' && near(snapV.x, 10) && near(snapV.y, 0));
const snapE = CadCore.snap({ x: 5, y: 0.6 }, feats, { tol: 2 });
ok('কিনারায় স্ন্যাপ', snapE.kind === 'edge' && near(snapE.y, 0));
const snapN = CadCore.snap({ x: 50, y: 50 }, feats, { tol: 2 });
ok('দূরে হলে স্ন্যাপ নয়', snapN.kind === null);

console.log('\n=== ৫. marching squares (রিং টানা) ===');
// ৮×৮ ছবিতে ৪×৪ ভরা বর্গ (২,২)–(৫,৫)
const W = 8, H = 8;
const mask = new Uint8Array(W * H);
for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) mask[y * W + x] = 1;
const ring = CadTrace.traceRing((x, y) => mask[y * W + x] === 1, W, H, 2, 2);
ok('বর্গের ৪টি কোণা', ring.length === 4, JSON.stringify(ring));
ok('রিং এর ক্ষেত্রফল ১৬', near(CadCore.area(ring), 16), CadCore.area(ring));

// L আকৃতির রাস্টার — অবতল কোণ ঠিক ধরা পড়ে?
const mask2 = new Uint8Array(W * H);
for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) mask2[y * W + x] = 1;
for (let y = 4; y <= 5; y++) for (let x = 4; x <= 5; x++) mask2[y * W + x] = 0;   // নিচ-ডান কোণা কাটা
const ring2 = CadTrace.traceRing((x, y) => mask2[y * W + x] === 1, W, H, 2, 2);
ok('L আকৃতির ৬ কোণা', ring2.length === 6, ring2.length + ': ' + JSON.stringify(ring2));
ok('L আকৃতির ক্ষেত্রফল ১২', near(CadCore.area(ring2), 12), CadCore.area(ring2));

console.log('\n=== ৬. খোপ ভাগ (regions) — সীমানা ভাগাভাগি ===');
/* ১১×৭ ছবি: মাঝে একটি খাড়া কালির রেখা, দুই পাশে দুটি খোপ।
   চারদিকে কালির বেড়া, বাইরে ১ পিক্সেল ফাঁকা। */
const RW = 13, RH = 9;
const ink = new Uint8Array(RW * RH);
const put = (x, y) => { ink[y * RW + x] = 1; };
for (let x = 1; x <= 11; x++) { put(x, 1); put(x, 7); }
for (let y = 1; y <= 7; y++) { put(1, y); put(11, y); put(6, y); }
const reg = CadTrace.regions(ink, RW, RH);
// বাইরের ফাঁকা + দুটি খোপ = ৩
ok('তিনটি খোপ (বাইরে + দুই দাগ)', reg.count === 3, 'পাওয়া গেছে ' + reg.count);
const border = CadTrace.borderLabels(reg.labels, RW, RH);
const inner = [];
for (let id = 0; id < reg.count; id++) if (!border.has(id)) inner.push(id);
ok('ভেতরের খোপ দুটি', inner.length === 2, JSON.stringify(inner));

const rings = inner.map(id => {
  let first = -1;
  for (let i = 0; i < reg.labels.length; i++) if (reg.labels[i] === id) { first = i; break; }
  return CadTrace.traceRing((x, y) => reg.labels[y * RW + x] === id, RW, RH,
                            first % RW, (first / RW) | 0);
});
ok('দুটি রিংই বন্ধ বহুভুজ', rings.every(r => r.length >= 4), rings.map(r => r.length).join(','));

// watershed এর পর দুই খোপ মাঝের কালির রেখা ভাগ করে নেয় → সীমানা এক হওয়া চাই
const b0 = CadCore.bbox(rings[0]), b1 = CadCore.bbox(rings[1]);
const leftRight = b0.x < b1.x ? [b0, b1] : [b1, b0];
ok('দুই দাগের সীমানায় ফাঁক নেই',
   near(leftRight[0].x + leftRight[0].w, leftRight[1].x, 0.001),
   'বাঁ শেষ ' + (leftRight[0].x + leftRight[0].w) + ' · ডান শুরু ' + leftRight[1].x);

console.log('\n=== ৭. ত্রিভুজায়ন ও ছেদ ===');
const tris = CadOverlay.triangulate(sq);
ok('বর্গ → ২ ত্রিভুজ', tris.length === 2, tris.length);
ok('ত্রিভুজের মোট ক্ষেত্রফল = বর্গের',
   near(tris.reduce((s, t) => s + CadCore.area(t), 0), 100, 1e-6));

const triL = CadOverlay.triangulate(L);
ok('L → ৪ ত্রিভুজ', triL.length === 4, triL.length);
ok('L ত্রিভুজের মোট ক্ষেত্রফল = ৫১',
   near(triL.reduce((s, t) => s + CadCore.area(t), 0), CadCore.area(L), 1e-6),
   triL.reduce((s, t) => s + CadCore.area(t), 0) + ' বনাম ' + CadCore.area(L));

const sqB = [{x:5,y:5},{x:15,y:5},{x:15,y:15},{x:5,y:15}];
ok('দুই বর্গের ছেদ ২৫', near(CadOverlay.intersectArea(sq, sqB), 25, 1e-6),
   CadOverlay.intersectArea(sq, sqB));
ok('না ছোঁয়া বহুভুজের ছেদ ০',
   CadOverlay.intersectArea(sq, [{x:50,y:50},{x:60,y:50},{x:60,y:60}]) === 0);
ok('পুরো ভেতরে থাকলে ছেদ = ছোটটির ক্ষেত্রফল',
   near(CadOverlay.intersectArea([{x:2,y:2},{x:4,y:2},{x:4,y:4},{x:2,y:4}], sq), 4, 1e-6));
// অবতল ছাঁচ
ok('অবতল বহুভুজের সাথে ছেদ',
   near(CadOverlay.intersectArea(sq, L), CadCore.area(L), 1e-6),
   CadOverlay.intersectArea(sq, L) + ' বনাম ' + CadCore.area(L));

console.log('\n=== ৮. রেখা দিয়ে ভাগ ===');
const cut = CadOverlay.splitByLine(sq, {x:5,y:-1}, {x:5,y:11});
ok('বর্গ দুই ভাগে ৫০/৫০', cut && near(CadCore.area(cut.left), 50) && near(CadCore.area(cut.right), 50),
   cut ? CadCore.area(cut.left) + '/' + CadCore.area(cut.right) : 'null');
const frac = CadOverlay.splitByFraction(sq, 0.3, 0);
ok('অনুপাতে ভাগ ৩০%', frac && near(CadCore.area(frac.left) / 100, 0.3, 0.002),
   frac ? (CadCore.area(frac.left) / 100).toFixed(4) : 'null');

console.log('\n=== ৯. নথি ও মাপ ===');
const doc = CadCore.newDoc();
doc.ftPerPx = 2;                            // ১ পিক্সেল = ২ ফুট
const f1 = CadCore.addFeature(doc, CadCore.newFeature(doc, 'bs', sq, { dag: '১৩৬৯' }));
const m = CadCore.measure(doc, f1);
ok('ক্ষেত্রফল ১০০px² × ৪ = ৪০০ sqft', near(m.sqft, 400));
ok('শতাংশে ০.৯১৮', near(m.units.satak, 400 / 435.6, 1e-9));
ok('পরিসীমা ৮০ ফুট', near(m.feet, 80));
ok('৪টি বাহু', m.sides.length === 4);
ok('প্রতি বাহু ২০ ফুট', m.sides.every(s => near(s.feet, 20)));
f1.manualArea = 5;                          // খতিয়ানের মাপ বসানো
ok('নির্দিষ্ট ক্ষেত্রফল অগ্রাধিকার পায়',
   near(CadCore.measure(doc, f1).sqft, 5 * 435.6) && CadCore.measure(doc, f1).isManual);
f1.manualArea = null;

console.log('\n=== ১০. পেন্টাগ্রাফ ===');
const doc2 = CadCore.newDoc();
doc2.ftPerPx = Math.sqrt(435.6);            // ১ px² = ১ শতাংশ (হিসাব সহজ হয়)
// সি.এস দাগ: ১০×১০ = ১০০ শতাংশ
CadCore.addFeature(doc2, CadCore.newFeature(doc2, 'cs',
  [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}], { dag: '২৩১' }));
// বি.এস দাগ ক: পুরোটাই ভেতরে (৪×৫ = ২০)
CadCore.addFeature(doc2, CadCore.newFeature(doc2, 'bs',
  [{x:1,y:1},{x:5,y:1},{x:5,y:6},{x:1,y:6}], { dag: '২৪১' }));
// বি.এস দাগ খ: অর্ধেক বাইরে (মোট ৪×৪=১৬, ভেতরে ২×৪=৮)
CadCore.addFeature(doc2, CadCore.newFeature(doc2, 'bs',
  [{x:8,y:2},{x:12,y:2},{x:12,y:6},{x:8,y:6}], { dag: '২৪২' }));
const rows = CadOverlay.pentagraph(doc2, 'cs', 'bs', {});
ok('একটি সি.এস সারি', rows.length === 1, rows.length);
const r0 = rows[0];
ok('সি.এস দাগ ১০০ শতাংশ', near(r0.satak, 100, 1e-6), r0.satak);
ok('দুটি বি.এস দাগ মিলেছে', r0.items.length === 2, r0.items.length);
const it241 = r0.items.find(i => i.dag === '২৪১');
const it242 = r0.items.find(i => i.dag === '২৪২');
ok('২৪১ পুরোটাই ভেতরে (২০)', near(it241.part, 20, 1e-6) && !it241.partial,
   it241.part + ' partial=' + it241.partial);
ok('২৪২ আংশিক — মোট ১৬ এর ৮', near(it242.whole, 16, 1e-6) && near(it242.part, 8, 1e-6) && it242.partial,
   it242.whole + ' এর ' + it242.part);
ok('মোট ২৮', near(r0.total, 28, 1e-6), r0.total);
ok('আংশিকের লেখা "১৬.০০ এর ৮.০০"',
   CadOverlay.itemText(it242, { bare: true }).indexOf(' এর ') > 0,
   CadOverlay.itemText(it242, { bare: true }));

console.log('\n=== ১১. ঝালাই (weld) ===');
const pA = [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
const pB = [{x:10.4,y:0.3},{x:20,y:0},{x:20,y:10},{x:9.7,y:9.8}];
CadTrace.weld([pA, pB], 1.0);
ok('ভাগ করা কোণা এক বিন্দুতে মিলেছে',
   near(pA[1].x, pB[0].x, 1e-9) && near(pA[1].y, pB[0].y, 1e-9),
   JSON.stringify(pA[1]) + ' বনাম ' + JSON.stringify(pB[0]));

console.log('\n=== ১২. সংরক্ষণ ও ফেরত ===');
const json = CadCore.toJson(doc2);
const back = CadCore.fromJson(json);
ok('ফিচার সংখ্যা ঠিক', back.features.length === doc2.features.length);
ok('ftPerPx ঠিক', near(back.ftPerPx, doc2.ftPerPx));
ok('দাগ নম্বর ঠিক', back.features[0].dag === '২৩১');
ok('_seq সংঘর্ষ এড়ায়',
   CadCore.newFeature(back, 'cs', sq, {}).id !== back.features[0].id);

console.log('\n=== ১৩. ছোট বাহু মুছে কোণা ফেরানো ===');
// স্ক্যান থেকে রেখা টানলে কোণায় সিঁড়ির ধাপ পড়ে — সেটি সারানো হয় কি না
const stair = [{x:0,y:0},{x:98,y:0},{x:100,y:2},{x:100,y:100},{x:2,y:100},{x:0,y:98}];
const fixedRing = CadCore.collapseShortEdges(stair, 8, true);
ok('৬ কোণা → ৪ কোণা', fixedRing.length === 4, fixedRing.length + ' কোণা');
ok('কোণা (১০০,০) ফিরে এসেছে', fixedRing.some(p => near(p.x,100,0.01) && near(p.y,0,0.01)));
ok('কোণা (০,১০০) ফিরে এসেছে', fixedRing.some(p => near(p.x,0,0.01) && near(p.y,100,0.01)));
ok('ক্ষেত্রফল প্রায় ১০০০০', near(CadCore.area(fixedRing), 10000, 1), CadCore.area(fixedRing));
ok('লম্বা বাহু অক্ষত থাকে', CadCore.collapseShortEdges(sq, 2, true).length === 4);
ok('৩ কোণার নিচে নামে না',
   CadCore.collapseShortEdges([{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}], 99, true).length >= 3);
// প্রায় সমান্তরাল রেখার ছেদ বহু দূরে — তখন মাঝবিন্দু নেওয়া হয়, ছিটকে যায় না
const par = [{x:0,y:0},{x:50,y:0},{x:51,y:0.2},{x:100,y:0.4},{x:100,y:50},{x:0,y:50}];
const pf = CadCore.collapseShortEdges(par, 3, true);
ok('সমান্তরাল হলেও কোণা ছিটকে যায় না',
   pf.every(q => q.x >= -5 && q.x <= 105 && q.y >= -5 && q.y <= 55), JSON.stringify(pf));

console.log('\n=== ১৪. ভাগ করা সীমানার চাবি (একই মাপ দুবার নয়) ===');
const kA = CadCore.sideKey({x:10,y:0}, {x:10,y:10}, 2);
const kB = CadCore.sideKey({x:10,y:10}, {x:10,y:0}, 2);   // উল্টো দিক
ok('দুই দিক থেকে একই চাবি', kA === kB, kA + ' বনাম ' + kB);
const kC = CadCore.sideKey({x:10.4,y:0.3}, {x:10,y:10}, 2);
ok('সামান্য এদিক-ওদিকেও একই চাবি', kA === kC, kA + ' বনাম ' + kC);
ok('আলাদা বাহুর আলাদা চাবি', kA !== CadCore.sideKey({x:40,y:0}, {x:40,y:10}, 2));

console.log('\n=== ১৫. লেখা বনাম সীমানা (structureMask) ===');
/* একটি বড় আয়তক্ষেত্র (দাগের সীমানা) + পাশে বিচ্ছিন্ন ছোট বর্গ — দাগ নম্বরের
   অঙ্কের ভেতরের ফাঁকার নকল। অনুপাত বাস্তবের মতোই রাখা হয়েছে: আসল নকশায়
   একটি অঙ্কের বিস্তার সীমানার জালের ১–৩%, এখানে ~৬%। ছোটটির ভেতরের ফাঁকা
   যেন দাগ হিসেবে ধরা না পড়ে। */
const SW = 200, SH = 120;
const sink = new Uint8Array(SW * SH);
const sput = (x, y) => { sink[y * SW + x] = 1; };
for (let x = 4; x <= 150; x++) { sput(x, 4); sput(x, 110); }
for (let y = 4; y <= 110; y++) { sput(4, y); sput(150, y); }
for (let x = 170; x <= 178; x++) { sput(x, 20); sput(x, 28); }
for (let y = 20; y <= 28; y++) { sput(170, y); sput(178, y); }

const smask = CadTrace.structureMask(sink, SW, SH, {});
ok('বড় আয়তক্ষেত্র = সীমানা', smask[4 * SW + 80] === 1);
ok('ছোট বিচ্ছিন্ন বর্গ = সীমানা নয়', smask[20 * SW + 174] === 0);

const sreg = CadTrace.regions(sink, SW, SH, smask);
const sborder = CadTrace.borderLabels(sreg.labels, SW, SH);
let realDag = 0, textHole = 0;
for (let id = 0; id < sreg.count; id++) {
  if (sborder.has(id)) continue;
  if (sreg.touch[id]) realDag++; else textHole++;
}
ok('একটি আসল দাগ পাওয়া গেছে', realDag === 1, realDag + 'টি');
ok('একটি লেখার ফাঁকা বাদ পড়েছে', textHole === 1, textHole + 'টি');

console.log('\n=== ১৬. কাঁটা (spike) ছাঁটা ===');
/* ভাঙা রেখার ফাঁক দিয়ে ঢুকে ফিরে আসা কাঁটা — বর্গের উপরের বাহু থেকে
   একটি সরু সূচ উপরে উঠে গেছে। */
const spiky = [{x:0,y:0},{x:40,y:0},{x:41,y:-60},{x:42,y:0},{x:100,y:0},
               {x:100,y:100},{x:0,y:100}];
const desp = CadCore.despike(spiky, 18, true);
ok('কাঁটার ডগা বাদ পড়েছে', desp.length === 6, desp.length + ' কোণা');
ok('কাঁটার ডগা (৪১,-৬০) আর নেই', !desp.some(p => near(p.y, -60, 0.001)));
ok('বর্গের চার কোণা অটুট',
   [[0,0],[100,0],[100,100],[0,100]].every(c =>
     desp.some(p => near(p.x,c[0],0.001) && near(p.y,c[1],0.001))));
ok('সাধারণ বর্গে কিছুই বাদ যায় না', CadCore.despike(sq, 18, true).length === 4);
// ধারালো কিন্তু বৈধ কোণা (৩০°) রাখা হয়
const sharp = [{x:0,y:0},{x:100,y:0},{x:100,y:58},{x:0,y:0.1}];
ok('৩০° এর বৈধ কোণা রাখা হয়', CadCore.despike(sharp, 18, true).length === 4,
   CadCore.despike(sharp, 18, true).length + ' কোণা');

console.log('\n=== ১৬ক. চিমটি (pinch) খোলা — ফাঁক দিয়ে ঢোকা উপদ্বীপ ===');
/* বড় বর্গ, যার ডান বাহু থেকে একটি সরু উপদ্বীপ বেরিয়ে গেছে।
   উপদ্বীপের মুখ মাত্র ২ পিক্সেল চওড়া — ভাঙা কালির রেখার ফাঁক। */
const peninsula = [
  {x:0,y:0}, {x:100,y:0}, {x:100,y:40},          // বর্গের ডান বাহু
  {x:160,y:41}, {x:160,y:47}, {x:100,y:42},      // ← সরু উপদ্বীপ (মুখ ৪০→৪২)
  {x:100,y:100}, {x:0,y:100}
];
const unp = CadCore.unpinch(peninsula, 5, true);
// ফাঁকের মুখের দুই বিন্দুই থাকে (এখন পাশাপাশি) — পরের ধাপে জোড়া লাগে
ok('উপদ্বীপ বাদ পড়েছে', unp.length === 6, unp.length + ' কোণা');
ok('উপদ্বীপের ডগা (১৬০,·) আর নেই', !unp.some(p => near(p.x, 160, 1)));
ok('পরের ধাপে মুখের দুই বিন্দু জোড়া লেগে ৫ কোণা',
   CadCore.collapseShortEdges(unp, 6, true).length === 5,
   CadCore.collapseShortEdges(unp, 6, true).length + ' কোণা');
ok('মূল বর্গের ক্ষেত্রফল প্রায় অটুট',
   near(CadCore.area(unp), 10000, 250), CadCore.area(unp));
ok('স্বাভাবিক বর্গে কিছুই বদলায় না', CadCore.unpinch(sq, 5, true).length === 4);
// L-আকৃতির বৈধ অবতল কোণা কাটা পড়ে না
ok('বৈধ L-আকৃতি অটুট থাকে', CadCore.unpinch(L, 2, true).length === 6,
   CadCore.unpinch(L, 2, true).length + ' কোণা');
ok('খোলা রেখায় প্রযোজ্য নয়', CadCore.unpinch(peninsula, 5, false).length === peninsula.length);

console.log('\n=== ১৭. ফালি (sliver) চেনা ===');
ok('বর্গ ফালি নয়', !CadCore.isSliver(sq));
ok('সুতোর মতো লম্বা টুকরো ফালি',
   CadCore.isSliver([{x:0,y:0},{x:200,y:0},{x:200,y:1.2},{x:0,y:1.0}]));
ok('স্বাভাবিক লম্বা দাগ ফালি নয় (৮:১)',
   !CadCore.isSliver([{x:0,y:0},{x:200,y:0},{x:200,y:25},{x:0,y:25}]));
ok('বৃত্তাকারতার সীমা বদলানো যায়',
   CadCore.isSliver([{x:0,y:0},{x:200,y:0},{x:200,y:25},{x:0,y:25}], 0.5));

console.log('\n=== ১৮. স্ন্যাপে নিজের বিন্দু বাদ দেওয়া ===');
/* কোণা টানার সময় যে বিন্দুগুলো সরছে, সেগুলোতে স্ন্যাপ করা চলবে না —
   নইলে কোণা নিজের জায়গায় আটকে থাকত। */
const dragF = { id: 'd1', pts: [{x:0,y:0},{x:10,y:0},{x:10,y:10}], closed: true };
const held = dragF.pts[1];
const snapSelf = CadCore.snap({x:10.2,y:0.2}, [dragF], { tol: 3 });
ok('বাদ না দিলে নিজের কোণাতেই স্ন্যাপ করে', snapSelf.kind === 'vertex');
const snapSkip = CadCore.snap({x:10.2,y:0.2}, [dragF], { tol: 3, skipPts: [held] });
ok('skipPts দিলে ঐ কোণা এড়িয়ে যায়', snapSkip.x !== 10 || snapSkip.y !== 0,
   JSON.stringify(snapSkip));

console.log('\n=== ১৯. দাগ নম্বর ধরে খোঁজা ===');
const fdoc = CadCore.newDoc();
fdoc.ftPerPx = 1;
[['২৪১',[[0,0],[10,0],[10,10],[0,10]]],
 ['২৪২',[[10,0],[20,0],[20,10],[10,10]]],
 ['৫৫২/১',[[0,10],[10,10],[10,20],[0,20]]],
 ['',    [[10,10],[20,10],[20,20],[10,20]]]].forEach(([dag, p]) =>
  CadCore.addFeature(fdoc, CadCore.newFeature(fdoc, 'bs', p.map(q=>({x:q[0],y:q[1]})), { dag })));

ok('বাংলা অঙ্কে মেলে', CadCore.findByDag(fdoc, '২৪১').found.length === 1);
ok('ইংরেজি অঙ্কেও একই দাগ মেলে', CadCore.findByDag(fdoc, '241').found.length === 1);
ok('কমা দিয়ে একাধিক', CadCore.findByDag(fdoc, '২৪১, ২৪২').found.length === 2);
ok('ফাঁকা দিয়ে আলাদা করলেও চলে', CadCore.findByDag(fdoc, '241 242').found.length === 2);
ok('উপ-দাগ (৫৫২/১) মেলে', CadCore.findByDag(fdoc, '৫৫২/১').found.length === 1);
ok('মূল নম্বর দিলে উপ-দাগও আসে', CadCore.findByDag(fdoc, '552').found.length === 1);
ok('না থাকলে missing এ জানায়',
   CadCore.findByDag(fdoc, '২৪১, ৯৯৯').missing.length === 1,
   JSON.stringify(CadCore.findByDag(fdoc, '২৪১, ৯৯৯').missing));
ok('খালি লেখায় কিছুই আসে না', CadCore.findByDag(fdoc, '   ').found.length === 0);

console.log('\n=== ২০. কেবল কিছু দাগ নিয়ে কাজ (hidden) ===');
ok('শুরুতে সব সক্রিয়', CadCore.activeFeatures(fdoc).length === 4);
fdoc.features[1].hidden = true;
fdoc.features[3].hidden = true;
ok('লুকানো দাগ বাদ পড়ে', CadCore.activeFeatures(fdoc).length === 2);
ok('hasHidden জানায়', CadCore.hasHidden(fdoc));
ok('লেয়ার লুকালেও বাদ পড়ে', (() => {
  CadCore.layer(fdoc, 'bs').visible = false;
  const n = CadCore.activeFeatures(fdoc).length;
  CadCore.layer(fdoc, 'bs').visible = true;
  return n === 0;
})());
fdoc.features.forEach(f => f.hidden = false);
ok('আবার সব সক্রিয়', CadCore.activeFeatures(fdoc).length === 4 && !CadCore.hasHidden(fdoc));

console.log('\n=== ২১. দুই জরিপের নকশা জোড়া (mergeInto) ===');
const dst = CadCore.newDoc();
dst.ftPerPx = 1;
CadCore.addFeature(dst, CadCore.newFeature(dst, 'cs',
  [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}], { dag: '২৩১' }));

const src = CadCore.newDoc();
src.ftPerPx = 1;
[['২৪১',[[1000,1000],[1050,1000],[1050,1050],[1000,1050]]],
 ['২৪২',[[1050,1000],[1100,1000],[1100,1050],[1050,1050]]]].forEach(([dag,p]) =>
  CadCore.addFeature(src, CadCore.newFeature(src, 'bs', p.map(q=>({x:q[0],y:q[1]})), { dag })));

// আলাদা স্থানাঙ্ক → ১০০০ বিয়োগ করে ২ দিয়ে ভাগ করলে dst এর ঘরে বসে
const mres = CadCore.mergeInto(dst, src, { mapPt: p => ({ x: (p.x-1000)/2, y: (p.y-1000)/2 }) });
ok('দুটি দাগ যোগ হয়েছে', mres.added === 2, mres.added + 'টি');
ok('মোট এখন ৩টি', dst.features.length === 3);
ok('দাগ নম্বর অটুট', dst.features.map(f=>f.dag).join(',') === '২৩১,২৪১,২৪২',
   dst.features.map(f=>f.dag).join(','));
ok('লেয়ার ঠিক এসেছে', dst.features[1].layer === 'bs' && dst.features[2].layer === 'bs');
ok('id সংঘর্ষ হয়নি', new Set(dst.features.map(f=>f.id)).size === 3);
ok('স্থানাঙ্ক রূপান্তরিত হয়ে ভেতরে বসেছে',
   dst.features.slice(1).every(f =>
     CadCore.pointInPolygon(CadCore.labelPoint(f.pts), dst.features[0].pts)),
   JSON.stringify(dst.features[1].pts));
ok('নতুন লেয়ার নথিতে যোগ হয়েছে', !!CadCore.layer(dst, 'bs'));

console.log('\n=== ২২. ছবিসহ সংরক্ষণ ও ফেরত ===');
const withImg = CadCore.toJson(dst, { image: 'data:image/jpeg;base64,AAAA', imageSize: { w: 900, h: 600 } });
const backImg = CadCore.fromJson(withImg);
ok('ছবি সংরক্ষিত হয়েছে', backImg._image === 'data:image/jpeg;base64,AAAA');
ok('ছবির আসল মাপও রাখা আছে',
   backImg._imageSize && backImg._imageSize.w === 900 && backImg._imageSize.h === 600);
ok('ছবি ছাড়া সংরক্ষণেও ভাঙে না', CadCore.fromJson(CadCore.toJson(dst))._image === null);
ok('hidden অবস্থাও সংরক্ষিত হয়', (() => {
  dst.features[1].hidden = true;
  const b = CadCore.fromJson(CadCore.toJson(dst));
  dst.features[1].hidden = false;
  return b.features[1].hidden === true;
})());

console.log('\n=== ২৩. চেইন-লিংক একক (নকশার স্কেল-দণ্ড) ===');
ok('১ চেইন = ৬৬ ফুট', near(CadCore.toFeet(1, 'chain'), 66));
ok('১০ চেইন = ৬৬০ ফুট', near(CadCore.toFeet(10, 'chain'), 660));
ok('১০০ লিংক = ১ চেইন', near(CadCore.toFeet(100, 'link'), CadCore.toFeet(1, 'chain')));
ok('৮০ চেইন = ১ মাইল', near(CadCore.toFeet(80, 'chain'), 5280));
ok('বাংলা অঙ্কেও একক কাজ করে', near(CadCore.toFeet('১০', 'chain'), 660));
ok('১ হাত = ১৮ ইঞ্চি', near(CadCore.toFeet(1, 'hat'), CadCore.toFeet(18, 'inch')));
ok('১ গজ = ৩ ফুট', near(CadCore.toFeet(1, 'yard'), 3));
ok('১ মিটার = ৩.২৮০৮ ফুট', near(CadCore.toFeet(1, 'meter'), 3.280839895));
ok('অজানা একক ফুট ধরে নেয়', near(CadCore.toFeet(5, 'নেই'), 5));

console.log('\n=== ২৪. স্কেল-দণ্ড মেপে DPI যাচাই ===');
/* নমুনা নকশা: ছাপা স্কেল ১৬" = ১ মাইল, স্ক্যান ২৭৮ DPI।
   স্কেল-দণ্ডে ০→১০ চেইন মাপলে যা পাওয়া উচিত। */
const ftPerPx16 = CadCore.feetPerMapInch(16) / 278;
ok('১৬" = ১ মাইল → ৩৩০ ফুট প্রতি ইঞ্চি', near(CadCore.feetPerMapInch(16), 330));
ok('মাপা স্কেল থেকে DPI ফেরত আসে', near(CadCore.dpiFrom(ftPerPx16, 16), 278, 1e-6),
   CadCore.dpiFrom(ftPerPx16, 16));
ok('DPI ↔ স্কেল দুই দিকেই মেলে', near(CadCore.scaleInchFrom(ftPerPx16, 278), 16, 1e-9));
const barPx = 660 / ftPerPx16;
ok('১০ চেইন ≈ ৫৫৬ পিক্সেল হওয়া উচিত', Math.round(barPx) === 556, Math.round(barPx));
ok('ঐ মাপ থেকে ftPerPx হুবহু ফেরে',
   near(CadCore.toFeet(10, 'chain') / barPx, ftPerPx16, 1e-12));
/* ভুল মাপ দিলে DPI স্বাভাবিক সীমার (১০০–১২০০) বাইরে চলে যায় —
   এভাবেই ব্যবহারকারীকে সতর্ক করা হয়। */
const sane = d => d >= 100 && d <= 1200;
ok('খুব কম পিক্সেল মাপলে DPI অস্বাভাবিক কম',
   !sane(CadCore.dpiFrom(CadCore.toFeet(10, 'chain') / 60, 16)),
   Math.round(CadCore.dpiFrom(CadCore.toFeet(10, 'chain') / 60, 16)) + ' DPI');
ok('খুব বেশি পিক্সেল মাপলে DPI অস্বাভাবিক বেশি',
   !sane(CadCore.dpiFrom(CadCore.toFeet(10, 'chain') / 9000, 16)),
   Math.round(CadCore.dpiFrom(CadCore.toFeet(10, 'chain') / 9000, 16)) + ' DPI');
ok('ঠিক মাপে DPI স্বাভাবিক সীমায় থাকে', sane(CadCore.dpiFrom(ftPerPx16, 16)));

console.log('\n=== ২৫. টপোলজি অটুট রেখে সরলীকরণ (সবচেয়ে জরুরি) ===');
/* ★ যে বাগটা ধরা পড়েছিল
     প্রতিটি দাগ আলাদাভাবে সরলীকরণ করলে ভাগ করা সীমানার দুই পাশ দুইভাবে
     ছাঁটা হয় — দাগ একে অন্যের ভেতর ঢুকে যায়। আসল নকশায় ৫৯৭ জোড়া
     ওভারল্যাপ করছিল। simplifyTopology আর্ক ধরে **একবারই** ছাঁটে, তাই
     দুই পাশ হুবহু একই রেখা পায়।

   এখানে হাতে বানানো নকশা: দুটি দাগ পাশাপাশি, মাঝের সীমানায় কাঁপুনি আছে। */
const jag = [];                                   // মাঝের সীমানা (উপর → নিচ)
for (let y = 0; y <= 40; y++) jag.push({ x: 20 + (y % 2), y });

// বাঁ দাগ: (0,0) → মাঝের সীমানা → (0,40)
const leftRing = [{x:0,y:0}];
for (let x = 1; x < 20; x++) leftRing.push({x, y:0});
for (const p of jag) leftRing.push({x:p.x, y:p.y});
for (let x = 19; x >= 1; x--) leftRing.push({x, y:40});
leftRing.push({x:0,y:40});
for (let y = 39; y >= 1; y--) leftRing.push({x:0, y});

// ডান দাগ: মাঝের সীমানা (উল্টো ক্রমে) → (40,·)
const rightRing = [];
for (let i = jag.length - 1; i >= 0; i--) rightRing.push({x:jag[i].x, y:jag[i].y});
for (let x = 21; x <= 40; x++) rightRing.push({x, y:0});
for (let y = 1; y <= 40; y++) rightRing.push({x:40, y});
for (let x = 39; x >= 21; x--) rightRing.push({x, y:40});

const areaBefore = CadCore.area(leftRing) + CadCore.area(rightRing);

// ক. প্রতিটি রিং আলাদাভাবে সরলীকরণ — এভাবেই বাগ হতো
const indep = [leftRing, rightRing].map(r => CadCore.simplifyRing(r.slice(), 1.6));
const indepOverlap = CadOverlay.intersectArea(indep[0], indep[1]);

// খ. টপোলজি ধরে সরলীকরণ
const topo = CadTrace.simplifyTopology([leftRing, rightRing],
                                       { eps: 1.6, straighten: 7, minEdge: 5 });
ok('দুটি রিংই ফেরত এসেছে', topo.length === 2, topo.length + 'টি');
const topoOverlap = topo.length === 2 ? CadOverlay.intersectArea(topo[0], topo[1]) : -1;

ok('আলাদা সরলীকরণে ওভারল্যাপ হয়', indepOverlap > 0.5, indepOverlap.toFixed(3));
ok('টপোলজি ধরে করলে ওভারল্যাপ ০', topoOverlap < 1e-6, topoOverlap.toFixed(6));
ok('মোট ক্ষেত্রফল প্রায় অটুট',
   Math.abs((CadCore.area(topo[0]) + CadCore.area(topo[1])) - areaBefore) < areaBefore * 0.03,
   (CadCore.area(topo[0]) + CadCore.area(topo[1])).toFixed(1) + ' বনাম ' + areaBefore.toFixed(1));
ok('কাঁপুনি ছাঁটাই হয়েছে (বিন্দু কমেছে)',
   topo[0].length < leftRing.length && topo[1].length < rightRing.length,
   topo[0].length + '/' + leftRing.length + ' ও ' + topo[1].length + '/' + rightRing.length);
// ভাগ করা সীমানার বিন্দুগুলো দুই রিং-এ হুবহু এক
const key = p => p.x.toFixed(6) + ',' + p.y.toFixed(6);
const setA = new Set(topo[0].map(key));
const sharedPts = topo[1].filter(p => setA.has(key(p))).length;
ok('ভাগ করা সীমানার বিন্দু দুই দাগে হুবহু এক', sharedPts >= 2, sharedPts + 'টি বিন্দু');

console.log('\n=== ২৬. খোলা রেখার প্রান্ত স্থির থাকে ===');
/* আর্কের প্রান্ত = জংশন। collapseShortEdges প্রান্ত সরালে ঐ জংশনে মেলা
   অন্য আর্কগুলো আর মিলবে না — আসল নকশায় এ কারণেই ৫০ জোড়া ওভারল্যাপ ছিল। */
/* প্রান্তে ছোট বাহু (০,০)→(১,০) ও (৫৯,১)→(৬০,১), আর **ভেতরে** ছোট বাহু
   (২০,০)→(২২,০) — প্রান্তেরগুলো অটুট থাকবে, ভেতরেরটি ছাঁটা হবে। */
const openArc = [{x:0,y:0},{x:1,y:0},{x:20,y:0},{x:22,y:0},{x:40,y:1},{x:59,y:1},{x:60,y:1}];
const col = CadCore.collapseShortEdges(openArc, 6, false);
ok('প্রথম প্রান্ত নড়েনি', col[0].x === 0 && col[0].y === 0, JSON.stringify(col[0]));
ok('শেষ প্রান্ত নড়েনি',
   col[col.length-1].x === 60 && col[col.length-1].y === 1, JSON.stringify(col[col.length-1]));
ok('প্রান্তের ছোট বাহু অটুট থাকে',
   col.some(p => p.x === 1 && p.y === 0) && col.some(p => p.x === 59 && p.y === 1),
   JSON.stringify(col));
ok('ভেতরের ছোট বাহু ছাঁটা হয়', col.length < openArc.length,
   col.length + '/' + openArc.length);
ok('(২০,০) ও (২২,০) মিলে একটি হয়েছে',
   !(col.some(p => p.x === 20 && p.y === 0) && col.some(p => p.x === 22 && p.y === 0)));
// বন্ধ রিং-এ আগের মতোই সব কোণা ছাঁটার সুযোগ থাকে
ok('বন্ধ রিং-এ নিয়ম বদলায়নি',
   CadCore.collapseShortEdges(stair, 8, true).length === 4);


console.log('\n=== ২৭. কোণার ডিগ্রি ===');
/* বলয়ের দিক (ঘড়ির কাঁটা / উল্টো) যাই হোক, ভেতরের কোণই বেরোতে হবে।
   একবার উল্টো নিয়মে সব কোণা ২৭০° দেখাচ্ছিল — তাই দু'দিকেই যাচাই। */
{
  const sqA = [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
  const sqB = sqA.slice().reverse();
  const A = CadCore.angles(sqA), B = CadCore.angles(sqB);
  ok('বর্গের চার কোণাই ৯০°', A.every(a => near(a.deg, 90, 1e-6)),
     A.map(a => a.deg.toFixed(1)).join('/'));
  ok('উল্টোদিকের বলয়েও ৯০°', B.every(a => near(a.deg, 90, 1e-6)),
     B.map(a => a.deg.toFixed(1)).join('/'));

  const tri = [{x:0,y:0},{x:10,y:0},{x:0,y:10}];
  const T = CadCore.angles(tri);
  ok('ত্রিভুজের কোণের যোগফল ১৮০°',
     near(T.reduce((s2,a) => s2 + a.deg, 0), 180, 1e-6));
  ok('সমকোণী ত্রিভুজে একটি ৯০°', T.some(a => near(a.deg, 90, 1e-6)));

  /* L-আকৃতি — ভেতরের দিকে ঢোকা কোণাটি ২৭০° (reflex) */
  const L = [{x:0,y:0},{x:20,y:0},{x:20,y:10},{x:10,y:10},{x:10,y:20},{x:0,y:20}];
  const LA = CadCore.angles(L);
  ok('L-আকৃতিতে ঠিক একটি reflex কোণা',
     LA.filter(a => a.deg > 180).length === 1,
     LA.map(a => Math.round(a.deg)).join('/'));
  ok('reflex কোণাটি ২৭০°',
     near(LA.find(a => a.deg > 180).deg, 270, 1e-6));
  ok('বহুভুজের কোণের যোগফল = (n−2)×১৮০',
     near(LA.reduce((s2,a) => s2 + a.deg, 0), (L.length - 2) * 180, 1e-6),
     LA.reduce((s2,a) => s2 + a.deg, 0).toFixed(3));

  /* দ্বিখণ্ডক ভেতরের দিকে তাক করে — লেখাটি যেন দাগের ভেতরে বসে */
  const c0 = A[0];
  ok('দ্বিখণ্ডক জমির ভেতরের দিকে',
     c0.bisector.x > 0 && c0.bisector.y > 0, JSON.stringify(c0.bisector));
  ok('দ্বিখণ্ডক একক দৈর্ঘ্যের',
     near(Math.hypot(c0.bisector.x, c0.bisector.y), 1, 1e-9));
  ok('তিনের কম বিন্দুতে কোণ নেই',
     CadCore.angles([{x:0,y:0},{x:1,y:1}]).length === 0);
}

console.log('\n=== ২৮. ফেরত ও আবার (undo / redo) ===');
{
  const CadView = require(path + 'cad-view.js');
  CadView.draw = function () {};
  CadView._status = function () {};
  const d = CadCore.newDoc();
  CadView.state = { doc: d, selection: [], draft: [], show: {} };
  CadView._undoStack.length = 0; CadView._redoStack.length = 0;

  const mk = x => CadCore.addFeature(d, CadCore.newFeature(d, 'bs',
    [{x:x,y:0},{x:x+10,y:0},{x:x+10,y:10},{x:x,y:10}], {}));
  CadView._pushUndo(); mk(0);
  CadView._pushUndo(); mk(20);
  ok('দুটি দাগ আছে', d.features.length === 2);

  CadView.undo();
  ok('একবার ফেরতে একটি দাগ', d.features.length === 1, d.features.length);
  CadView.undo();
  ok('দুবার ফেরতে শূন্য', d.features.length === 0, d.features.length);
  ok('আর ফেরত নেই', CadView._undoStack.length === 0);

  CadView.redo();
  ok('আবার করলে একটি ফিরে আসে', d.features.length === 1, d.features.length);
  CadView.redo();
  ok('দুবার আবার করলে দুটি', d.features.length === 2, d.features.length);
  CadView.redo();
  ok('সামনে আর কিছু নেই — সংখ্যা বদলায় না', d.features.length === 2);

  /* ফেরত নেওয়ার পর নতুন কাজ করলে সামনের ধাপগুলো বাতিল —
     নইলে redo অসংলগ্ন অবস্থায় ফিরিয়ে দিত */
  CadView.undo();
  CadView._pushUndo(); mk(40);
  ok('নতুন কাজে redo তালিকা মুছে যায়', CadView._redoStack.length === 0);

  CadView._undoStack.length = 0;
  for (let i = 0; i < 60; i++) CadView._pushUndo();
  ok('ইতিহাস ৪০ ধাপে সীমিত', CadView._undoStack.length === 40, CadView._undoStack.length);

  CadView.setDoc(CadCore.newDoc());
  ok('নতুন নকশায় ইতিহাস মুছে যায়',
     CadView._undoStack.length === 0 && CadView._redoStack.length === 0);
}


console.log('\n=== ২৯. লেখা, চিহ্ন ও বৃত্ত ===');
{
  const d = CadCore.newDoc();
  d.ftPerPx = 0.5;
  const t1 = CadNotes.add(d, 'text', 100, 100, { text: 'রাস্তা' });
  const p1 = CadNotes.add(d, 'pin', 200, 150, { text: 'টিউবওয়েল' });
  const c1 = CadNotes.add(d, 'circle', 300, 300, { r: 40, text: 'কুয়া' });
  ok('তিনটি নোট বসলো', d.notes.length === 3);
  ok('আইডি আলাদা', new Set([t1.id, p1.id, c1.id]).size === 3);

  /* নোট কখনো দাগের তালিকায় ঢোকে না — ঢুকলে মোট ক্ষেত্রফল ভুল হতো */
  ok('দাগের তালিকায় যায় না', d.features.length === 0);
  ok('activeFeatures এও নেই', CadCore.activeFeatures(d).length === 0);

  /* বৃত্তের ক্ষেত্রফল: r=৪০px, ০.৫ ft/px → ২০ft ব্যাসার্ধ */
  ok('বৃত্তের ক্ষেত্রফল পাই×র²',
     near(CadNotes.circleSqft(d, c1), Math.PI * 400, 1e-6),
     CadNotes.circleSqft(d, c1).toFixed(4));
  ok('স্কেল না বসলে ক্ষেত্রফল শূন্য',
     CadNotes.circleSqft(Object.assign({}, d, { ftPerPx: 0 }), c1) === 0);
  ok('লেখার কোনো ক্ষেত্রফল নেই', CadNotes.circleSqft(d, t1) === 0);

  /* হিট — কোন নোটে ক্লিক পড়ল */
  ok('লেখার উপরে ক্লিক ধরে',
     (CadNotes.hit(d, { x: 102, y: 101 }, 6) || {}).id === t1.id);
  ok('ফাঁকা জায়গায় কিছু নেই',
     CadNotes.hit(d, { x: 600, y: 600 }, 6) === null);
  ok('বৃত্তের গায়ে ক্লিক ধরে',
     (CadNotes.hit(d, { x: 340, y: 300 }, 6) || {}).id === c1.id);
  ok('বৃত্তের ভেতরেও ধরে',
     (CadNotes.hit(d, { x: 310, y: 305 }, 6) || {}).id === c1.id);

  /* লুকানো নোট ধরা পড়বে না */
  p1.hidden = true;
  ok('লুকানো নোট হিট হয় না',
     CadNotes.hit(d, { x: 200, y: 150 }, 6) === null);
  ok('visible() এ নেই', CadNotes.visible(d).length === 2);
  p1.hidden = false;

  CadNotes.move(t1, 10, -5);
  ok('সরানো যায়', t1.x === 110 && t1.y === 95);

  const ring = CadNotes.circlePts(c1, 48);
  ok('বৃত্ত → ৪৮ বাহুর বহুভুজ', ring.length === 48);
  ok('সব বিন্দু পরিধিতে',
     ring.every(q => near(Math.hypot(q.x - c1.x, q.y - c1.y), c1.r, 1e-9)));
  ok('বহুভুজের ক্ষেত্রফল প্রায় বৃত্তের সমান',
     Math.abs(Math.abs(CadCore.signedArea(ring)) - Math.PI * c1.r * c1.r)
       / (Math.PI * c1.r * c1.r) < 0.006);

  ok('মুছে ফেলা যায়', CadNotes.remove(d, p1.id) === true && d.notes.length === 2);
  ok('না থাকলে false', CadNotes.remove(d, 'nope') === false);

  /* সংরক্ষণ → খোলা রাউন্ডট্রিপ */
  const back = CadCore.fromJson(CadCore.toJson(d));
  ok('সংরক্ষণে নোট টিকে থাকে', back.notes.length === 2, back.notes.length);
  ok('লেখা অটুট', back.notes[0].text === 'রাস্তা');
  ok('বৃত্তের ব্যাসার্ধ অটুট',
     back.notes[1].r === 40 && back.notes[1].kind === 'circle');
  const nn = CadNotes.add(back, 'text', 0, 0, {});
  ok('পুরোনো আইডি ফিরে আসে না',
     !back.notes.slice(0, -1).some(x => x.id === nn.id), nn.id);

  /* পুরোনো ফাইলে notes নেই — তবু ভাঙবে না */
  const oldFile = CadCore.fromJson(JSON.stringify({ v: 2, features: [], ftPerPx: 1 }));
  ok('পুরোনো ফাইলেও খোলে', Array.isArray(oldFile.notes) && oldFile.notes.length === 0);
}

console.log('\n=== ৩০. নোটও undo/redo মানে ===');
{
  const CadView = require(path + 'cad-view.js');
  CadView.draw = function () {}; CadView._status = function () {};
  const d = CadCore.newDoc();
  CadView.state = { doc: d, selection: [], draft: [], show: {} };
  CadView._undoStack.length = 0; CadView._redoStack.length = 0;

  CadView._pushUndo();
  CadNotes.add(d, 'text', 5, 5, { text: 'ক' });
  CadView._pushUndo();
  CadCore.addFeature(d, CadCore.newFeature(d, 'bs',
    [{x:0,y:0},{x:9,y:0},{x:9,y:9}], {}));
  ok('একটি নোট ও একটি দাগ',
     d.notes.length === 1 && d.features.length === 1);

  CadView.undo();
  ok('ফেরতে দাগ গেল, নোট থাকলো',
     d.features.length === 0 && d.notes.length === 1);
  CadView.undo();
  ok('আরেকবার ফেরতে নোটও গেল', d.notes.length === 0);
  CadView.redo(); CadView.redo();
  ok('দুবার আবার করলে দুটোই ফেরে',
     d.notes.length === 1 && d.features.length === 1);
}


console.log('\n=== ৩১. রাবার — কোণা মোছা ===');
{
  const CadView = require(path + 'cad-view.js');
  CadView.draw = function () {}; CadView._status = function () {};
  const d = CadCore.newDoc();
  d.ftPerPx = 0.5;
  CadView.state = { doc: d, selection: [], draft: [], show: {},
                    scale: 1, off: { x: 0, y: 0 }, tool: 'erase' };

  /* দুটি দাগ একটি সীমানা ভাগ করে নেয় — (৩০০,২০০) দুই দাগেই আছে */
  const A = CadCore.addFeature(d, CadCore.newFeature(d, 'bs',
    [{x:100,y:100},{x:300,y:100},{x:300,y:200},{x:300,y:300},{x:100,y:300}], {dag:'১'}));
  const B = CadCore.addFeature(d, CadCore.newFeature(d, 'bs',
    [{x:300,y:100},{x:500,y:100},{x:500,y:300},{x:300,y:300},{x:300,y:200}], {dag:'২'}));

  ok('শুরুতে দুটোই ৫ কোণার', A.pts.length === 5 && B.pts.length === 5);

  /* ভাগ করা কোণায় রাবার — দুই দাগ থেকেই যেতে হবে, নইলে মাঝে ফাঁক */
  ok('কোণার বাইরে চাপে কিছু হয় না',
     CadView.eraseVertexAt({ x: 700, y: 700 }) === false);
  ok('ভাগ করা কোণা মোছে', CadView.eraseVertexAt({ x: 300, y: 200 }) === true);
  ok('দুই দাগ থেকেই গেছে', A.pts.length === 4 && B.pts.length === 4,
     A.pts.length + '/' + B.pts.length);

  const key = q => q.x.toFixed(4) + ',' + q.y.toFixed(4);
  const setA = new Set(A.pts.map(key));
  ok('সীমানা এখনো হুবহু মেলে',
     B.pts.filter(q => setA.has(key(q))).length >= 2);

  /* ত্রিভুজের নিচে নামানো যাবে না */
  CadView.eraseVertexAt({ x: 300, y: 100 });
  ok('A এখন ৩ কোণার', A.pts.length === 3, A.pts.length);
  const n3 = A.pts.length;
  ok('৩ কোণায় আর মোছে না', CadView.eraseVertexAt({ x: 100, y: 100 }) === false);
  ok('সংখ্যা বদলায়নি', A.pts.length === n3);

  /* একটানা মোছার সময় পুরো টানটা এক ধাপে ফেরত যায় —
     নইলে ২০টি কোণা মুছলে ২০ বার Ctrl+Z চাপতে হতো */
  const d2 = CadCore.newDoc();
  CadView.state = { doc: d2, selection: [], draft: [], show: {},
                    scale: 1, off: { x: 0, y: 0 }, tool: 'erase' };
  const C = CadCore.addFeature(d2, CadCore.newFeature(d2, 'bs',
    [{x:0,y:0},{x:50,y:0},{x:100,y:0},{x:150,y:0},{x:150,y:100},{x:0,y:100}], {}));
  CadView._undoStack.length = 0; CadView._redoStack.length = 0;
  CadView._erasing = { pushed: false, count: 0 };
  CadView.eraseVertexAt({ x: 50, y: 0 });
  CadView.eraseVertexAt({ x: 100, y: 0 });
  CadView._erasing = null;
  ok('একটানে দুটি কোণা গেল', C.pts.length === 4, C.pts.length);
  ok('ইতিহাসে এক ধাপই জমেছে', CadView._undoStack.length === 1,
     CadView._undoStack.length);
  CadView.undo();
  ok('এক Ctrl+Z তে পুরোটা ফেরে',
     CadCore.feature(d2, C.id).pts.length === 6,
     CadCore.feature(d2, C.id).pts.length);
}

console.log('\n──────────────────────────────');
console.log(`  পাস ${pass} · ব্যর্থ ${fail}`);
console.log('──────────────────────────────\n');
process.exit(fail ? 1 : 0);
