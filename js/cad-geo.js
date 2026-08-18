/* ==========================================================================
   cad-geo.js — ভূ-স্থানাঙ্ক ও গুগল আর্থ/ম্যাপে রপ্তানি
   --------------------------------------------------------------------------
   এখানেই "ডিজিটাল নকশা গুগল ম্যাপে বসানো" কাজটি হয়।

   ★ ছবির ওভারলে নয়, **ভেক্টর দাগ**
     আগের KMZ টুল নকশার ছবিটাই স্যাটেলাইটের উপর বসাত (GroundOverlay)।
     এখানে প্রতিটি দাগ আলাদা **Polygon** হিসেবে যায় — তাই Google Earth এ
     দাগে ক্লিক করলে নম্বর ও ক্ষেত্রফল দেখা যায়, দাগ ধরে খোঁজা যায়,
     এবং Google My Maps / QGIS / ArcGIS সবখানে খোলে।

   ★ রূপান্তরের গণিত
     KmzExport.solveTransform() — ২ বিন্দুতে similarity, ৩+ এ affine
     (least-squares)। এখানে তার উল্টো দিকটাও লাগে (ভূ→পিক্সেল), তাই
     ম্যাট্রিক্স উল্টে নেওয়া হয়।
   ========================================================================== */

const CadGeo = {

  /* ==================== ১. ক্যালিব্রেশন ==================== */

  /**
   * নিয়ন্ত্রণ বিন্দু থেকে রূপান্তর বসানো
   * @param {object} doc
   * @param {Array<{px,py,lat,lng}>} points
   */
  calibrate(doc, points) {
    if (!points || points.length < 2) throw new Error('অন্তত ২টি নিয়ন্ত্রণ বিন্দু লাগবে');
    const t = KmzExport.solveTransform(points);
    doc.geo = {
      mode: t.mode,
      params: t.params,
      latRef: t.latRef, lngRef: t.lngRef,
      rmse: t.rmse, maxError: t.maxError,
      scale: t.scale, rotationDeg: t.rotationDeg,
      residuals: t.residuals,
      points: points.map(p => ({ px: p.px, py: p.py, lat: p.lat, lng: p.lng }))
    };

    // ভূ-স্থানাঙ্ক থেকেই ফুট/পিক্সেল বেরোয় — স্কেল বসানো না থাকলে বসিয়ে দিই
    if (!(doc.ftPerPx > 0) && t.scale > 0) {
      doc.ftPerPx = t.scale * 3.280839895;                 // মিটার/পিক্সেল → ফুট/পিক্সেল
    }
    return doc.geo;
  },

  hasGeo(doc) { return !!(doc && doc.geo && doc.geo.params); },

  /** পিক্সেল → {lat, lng} */
  toGeo(doc, p) {
    const g = doc.geo;
    if (!g || !g.params) return null;
    const { a, b, c, d, e, f } = g.params;
    const x = p.x, y = -p.y;
    const E = a * x + b * y + c;
    const N = d * x + e * y + f;
    return {
      lng: g.lngRef + E / KmzExport.metersPerDegLng(g.latRef),
      lat: g.latRef + N / KmzExport.metersPerDegLat(g.latRef)
    };
  },

  /** {lat, lng} → পিক্সেল (ম্যাট্রিক্স উল্টে) */
  toPixel(doc, ll) {
    const g = doc.geo;
    if (!g || !g.params) return null;
    const { a, b, c, d, e, f } = g.params;
    const E = (ll.lng - g.lngRef) * KmzExport.metersPerDegLng(g.latRef);
    const N = (ll.lat - g.latRef) * KmzExport.metersPerDegLat(g.latRef);
    const det = a * e - b * d;
    if (Math.abs(det) < 1e-12) return null;
    const x = ((E - c) * e - (N - f) * b) / det;
    const y = (a * (N - f) - d * (E - c)) / det;
    return { x, y: -y };
  },

  /** ফিচারের সব বিন্দু ভূ-স্থানাঙ্কে */
  featureGeo(doc, f) {
    return (f.pts || []).map(p => this.toGeo(doc, p)).filter(Boolean);
  },

  /**
   * এক নথির পিক্সেল → আরেক নথির পিক্সেল (ভূ-স্থানাঙ্কের মাঝপথে)
   *
   * আলাদা আলাদা ডিজিটাইজ করা সি.এস ও বি.এস নকশা একসাথে বসাতে লাগে।
   * দুটোরই ক্যালিব্রেশন থাকলে এটিই নিখুঁত পথ — কারণ অক্ষাংশ-দ্রাঘিমাংশ
   * দুই নকশার **সাধারণ ভাষা**।
   *
   * @returns {function(pt):({x,y}|null)} — না মিললে null
   */
  reprojector(srcDoc, dstDoc) {
    if (!this.hasGeo(srcDoc) || !this.hasGeo(dstDoc)) return null;
    return p => {
      const ll = this.toGeo(srcDoc, p);
      if (!ll) return null;
      return this.toPixel(dstDoc, ll);
    };
  },

  /** দুই নথির ক্যালিব্রেশন কতটা মেলে — জুড়ে দেওয়ার আগে সতর্কতা */
  alignCheck(srcDoc, dstDoc) {
    if (!this.hasGeo(srcDoc) || !this.hasGeo(dstDoc)) return { ok: false, reason: 'geo' };
    const a = srcDoc.geo, b = dstDoc.geo;
    const km = Math.hypot(
      (a.latRef - b.latRef) * 111.32,
      (a.lngRef - b.lngRef) * 111.32 * Math.cos(a.latRef * Math.PI / 180)
    );
    return {
      ok: km < 8,                                  // একই মৌজার দুই নকশা কাছাকাছিই হবে
      km,
      rmse: Math.max(a.rmse || 0, b.rmse || 0)
    };
  },

  /* ==================== ২. ভূ-পৃষ্ঠে প্রকৃত ক্ষেত্রফল ==================== */

  R_EARTH: 6378137,

  /**
   * গোলকীয় বহুভুজের ক্ষেত্রফল (বর্গমিটার)
   * পিক্সেল-ভিত্তিক ক্ষেত্রফলের সাথে মিলিয়ে দেখলে ক্যালিব্রেশন কতটা
   * ভালো হয়েছে বোঝা যায়।
   */
  geoAreaM2(ring) {
    if (!ring || ring.length < 3) return 0;
    const rad = Math.PI / 180;
    let s = 0;
    for (let i = 0, n = ring.length; i < n; i++) {
      const p1 = ring[i], p2 = ring[(i + 1) % n];
      s += (p2.lng - p1.lng) * rad *
           (2 + Math.sin(p1.lat * rad) + Math.sin(p2.lat * rad));
    }
    return Math.abs(s * this.R_EARTH * this.R_EARTH / 2);
  },

  /** ভূ-ক্ষেত্রফল বনাম নকশার ক্ষেত্রফল — যাচাই */
  crossCheck(doc, f) {
    const m = CadCore.measure(doc, f);
    if (!this.hasGeo(doc)) return { ok: false };
    const ring = this.featureGeo(doc, f);
    const m2 = this.geoAreaM2(ring);
    const sqft = m2 * 10.7639;
    return {
      ok: true,
      planSqft: m.sqft,
      geoSqft: sqft,
      diffPct: m.sqft > 0 ? (sqft - m.sqft) / m.sqft * 100 : 0
    };
  },

  /* ==================== ৩. KML ==================== */

  esc(s) { return KmzExport.esc(s); },

  /** #rrggbb → KML এর aabbggrr */
  kmlColor(hex, alpha) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    const rgb = m ? m[1] : 'dc2626';
    const r = rgb.slice(0, 2), g = rgb.slice(2, 4), b = rgb.slice(4, 6);
    const a = Math.round(Math.min(1, Math.max(0, alpha == null ? 1 : alpha)) * 255)
      .toString(16).padStart(2, '0');
    return (a + b + g + r).toLowerCase();
  },

  /**
   * পুরো নথি → KML
   * @param {object} doc
   * @param {object} opt { imageName, imageCorners, fillOpacity, lineWidthScale }
   */
  buildKml(doc, opt) {
    const o = opt || {};
    if (!this.hasGeo(doc)) throw new Error('আগে নকশাটি স্যাটেলাইটের সাথে মেলাতে হবে');
    const M = doc.meta || {};
    const title = [M.mouza, M.upazila, M.district].filter(Boolean).join(', ')
      || 'ডিজিটাল সার্ভে';

    /* --- স্টাইল --- */
    const styles = doc.layers.map(L => {
      const lineW = Math.max(1, (L.width || 1.5) * (o.lineWidthScale || 1.4));
      const fillOn = L.fill ? 1 : 0;
      return `    <Style id="ly-${this.esc(L.id)}">
      <LineStyle><color>${this.kmlColor(L.color, 1)}</color><width>${lineW.toFixed(1)}</width></LineStyle>
      <PolyStyle><color>${this.kmlColor(L.color, o.fillOpacity == null ? 0.22 : o.fillOpacity)}</color><fill>${fillOn}</fill><outline>1</outline></PolyStyle>
      <BalloonStyle><text><![CDATA[<h3>$[name]</h3>$[description]]]></text></BalloonStyle>
    </Style>`;
    }).join('\n');

    /* --- লেয়ার ধরে ফোল্ডার --- */
    const folders = [];
    for (const L of doc.layers) {
      const feats = CadCore.activeFeatures(doc)
        .filter(f => f.layer === L.id && f.pts && f.pts.length >= 2);
      if (!feats.length) continue;

      const marks = feats.map(f => {
        const ring = this.featureGeo(doc, f);
        if (ring.length < 2) return '';
        const m = CadCore.measure(doc, f);
        const u = m.units;

        const coordsArr = ring.map(p => `${p.lng.toFixed(9)},${p.lat.toFixed(9)},0`);
        if (f.closed && ring.length >= 3) coordsArr.push(coordsArr[0]);
        const coords = coordsArr.join(' ');

        const name = f.dag ? ('দাগ ' + CadCore.bn(f.dag)) : (L.name);
        const rows = [];
        if (f.dag) rows.push(['দাগ নং', CadCore.bn(f.dag)]);
        if (f.khotian) rows.push(['খতিয়ান', CadCore.bn(f.khotian)]);
        if (f.owner) rows.push(['মালিক', f.owner]);
        if (doc.ftPerPx > 0 && m.sqft > 0) {
          rows.push(['ক্ষেত্রফল', CadCore.satakText(m.sqft)]);
          rows.push(['', CadCore.bn(u.katha.toFixed(3)) + ' কাঠা · '
                       + CadCore.bn(u.sqft.toFixed(0)) + ' বর্গফুট']);
        }
        if (M.mouza) rows.push(['মৌজা', M.mouza]);
        if (M.jl) rows.push(['জে.এল. নং', CadCore.bn(M.jl)]);
        rows.push(['জরিপ', L.name]);
        if (f.note) rows.push(['মন্তব্য', f.note]);

        const desc = '<![CDATA[<table style="font-family:sans-serif;font-size:13px">'
          + rows.map(r => `<tr><td style="padding:2px 8px 2px 0;color:#666">${this.esc(r[0])}</td>`
                        + `<td style="padding:2px 0"><b>${this.esc(r[1])}</b></td></tr>`).join('')
          + '</table>]]>';

        const geom = (f.closed && ring.length >= 3)
          ? `<Polygon><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode>
          <outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs>
        </Polygon>`
          : `<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode>
          <coordinates>${coords}</coordinates></LineString>`;

        return `      <Placemark>
        <name>${this.esc(name)}</name>
        <description>${desc}</description>
        <styleUrl>#ly-${this.esc(L.id)}</styleUrl>
        ${geom}
      </Placemark>`;
      }).filter(Boolean).join('\n');

      folders.push(`    <Folder>
      <name>${this.esc(L.name)}</name>
      <open>1</open>
${marks}
    </Folder>`);
    }

    /* --- দাগ নম্বরের লেবেল (আলাদা ফোল্ডার — বন্ধ করা যায়) --- */
    const labelMarks = CadCore.activeFeatures(doc)
      .filter(f => f.dag && f.closed && f.pts.length >= 3)
      .map(f => {
        const lp = CadCore.labelPoint(f.pts);
        const g = this.toGeo(doc, lp);
        if (!g) return '';
        return `      <Placemark>
        <name>${this.esc(CadCore.bn(f.dag))}</name>
        <styleUrl>#dagLabel</styleUrl>
        <Point><altitudeMode>clampToGround</altitudeMode><coordinates>${g.lng.toFixed(9)},${g.lat.toFixed(9)},0</coordinates></Point>
      </Placemark>`;
      }).filter(Boolean).join('\n');

    const labelFolder = labelMarks ? `    <Folder>
      <name>দাগ নম্বর</name>
      <open>0</open>
${labelMarks}
    </Folder>` : '';

    /* --- লেখা, চিহ্ন ও বৃত্ত (আলাদা ফোল্ডার) ---
       বৃত্ত KML-এ সরাসরি নেই, তাই ৪৮ বাহুর বহুভুজে পরিণত করি —
       গুগল আর্থে চোখে বৃত্তই দেখায়। */
    const noteMarks = (typeof CadNotes === 'undefined' ? [] : CadNotes.visible(doc))
      .map(n => {
        if (n.kind === 'circle') {
          const ring = CadNotes.circlePts(n, 48).map(p => this.toGeo(doc, p));
          if (ring.some(g => !g)) return '';
          const cs = ring.map(g => `${g.lng.toFixed(9)},${g.lat.toFixed(9)},0`);
          cs.push(cs[0]);
          const a = CadNotes.circleSqft(doc, n);
          return `      <Placemark>
        <name>${this.esc(n.text || 'বৃত্ত')}</name>
        <description><![CDATA[${a > 0 ? this.esc(CadCore.satakText(a)) : ''}]]></description>
        <styleUrl>#noteCircle</styleUrl>
        <Polygon><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode>
          <outerBoundaryIs><LinearRing><coordinates>${cs.join(' ')}</coordinates></LinearRing></outerBoundaryIs>
        </Polygon>
      </Placemark>`;
        }
        const g = this.toGeo(doc, n);
        if (!g) return '';
        return `      <Placemark>
        <name>${this.esc(n.text || (n.kind === 'pin' ? 'চিহ্ন' : 'লেখা'))}</name>
        <styleUrl>#${n.kind === 'pin' ? 'notePin' : 'noteText'}</styleUrl>
        <Point><altitudeMode>clampToGround</altitudeMode><coordinates>${g.lng.toFixed(9)},${g.lat.toFixed(9)},0</coordinates></Point>
      </Placemark>`;
      }).filter(Boolean).join('\n');

    const noteFolder = noteMarks ? `    <Folder>
      <name>লেখা ও চিহ্ন</name>
      <open>1</open>
${noteMarks}
    </Folder>` : '';

    /* --- নকশার ছবি (ঐচ্ছিক আন্ডারলে) --- */
    let overlay = '';
    if (o.imageName && o.imageCorners && o.imageCorners.length === 4) {
      const cc = o.imageCorners.map(p => `${p.lng.toFixed(10)},${p.lat.toFixed(10)},0`).join(' ');
      const alpha = Math.round((o.imageOpacity == null ? 0.6 : o.imageOpacity) * 255)
        .toString(16).padStart(2, '0');
      overlay = `    <GroundOverlay>
      <name>মৌজা নকশা (ছবি)</name>
      <visibility>0</visibility>
      <color>${alpha}ffffff</color>
      <drawOrder>0</drawOrder>
      <Icon><href>${this.esc(o.imageName)}</href></Icon>
      <gx:LatLonQuad><coordinates>${cc}</coordinates></gx:LatLonQuad>
    </GroundOverlay>`;
    }

    const info = [
      M.district && 'জেলা: ' + M.district,
      M.upazila && 'উপজেলা: ' + M.upazila,
      M.mouza && 'মৌজা: ' + M.mouza,
      M.jl && 'জে.এল. নং: ' + CadCore.bn(M.jl),
      'স্কেল: ' + CadCore.bn(M.scaleInch || 120) + '" = ১ মাইল',
      doc.geo.rmse != null && 'ক্যালিব্রেশন ত্রুটি: ±' + CadCore.bn(doc.geo.rmse.toFixed(1)) + ' মিটার'
    ].filter(Boolean).join('<br>');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${this.esc(title)}</name>
    <description><![CDATA[${info}]]></description>
    <open>1</open>
${styles}
    <Style id="dagLabel">
      <IconStyle><scale>0.5</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle>
      <LabelStyle><scale>0.9</scale><color>ff1e40af</color></LabelStyle>
    </Style>
    <Style id="noteText">
      <IconStyle><scale>0</scale></IconStyle>
      <LabelStyle><scale>1.0</scale><color>ff0953b4</color></LabelStyle>
    </Style>
    <Style id="notePin">
      <IconStyle><scale>0.9</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle>
      <LabelStyle><scale>0.9</scale><color>ff0953b4</color></LabelStyle>
    </Style>
    <Style id="noteCircle">
      <LineStyle><color>ff0953b4</color><width>2</width></LineStyle>
      <PolyStyle><color>2b0953b4</color></PolyStyle>
    </Style>
${overlay}
${folders.join('\n')}
${labelFolder}
${noteFolder}
  </Document>
</kml>`;
  },

  /* ==================== ৪. KMZ ==================== */

  /**
   * KMZ বাইট — ঐচ্ছিকভাবে নকশার ছবিসহ
   * @param {object} doc
   * @param {object} opt { imageBytes, imageName, imageWidth, imageHeight }
   */
  buildKmz(doc, opt) {
    const o = opt || {};
    const files = [];
    let kmlOpt = { fillOpacity: o.fillOpacity, lineWidthScale: o.lineWidthScale };

    if (o.imageBytes && o.imageBytes.length && o.imageWidth > 0 && o.imageHeight > 0) {
      const name = KmzExport.safeName(o.imageName || 'mouza.jpg');
      const corners = [
        this.toGeo(doc, { x: 0, y: o.imageHeight }),
        this.toGeo(doc, { x: o.imageWidth, y: o.imageHeight }),
        this.toGeo(doc, { x: o.imageWidth, y: 0 }),
        this.toGeo(doc, { x: 0, y: 0 })
      ];
      if (corners.every(Boolean)) {
        kmlOpt = Object.assign(kmlOpt, {
          imageName: name, imageCorners: corners, imageOpacity: o.imageOpacity
        });
        files.push({ name, data: o.imageBytes });
      }
    }

    const kml = this.buildKml(doc, kmlOpt);
    files.unshift({ name: 'doc.kml', data: KmzExport.utf8(kml) });
    return { bytes: KmzExport.zip(files), kml };
  },

  /* ==================== ৫. GeoJSON ==================== */

  buildGeoJson(doc) {
    if (!this.hasGeo(doc)) throw new Error('আগে নকশাটি স্যাটেলাইটের সাথে মেলাতে হবে');
    const M = doc.meta || {};
    const features = [];

    for (const f of CadCore.activeFeatures(doc)) {
      const ring = this.featureGeo(doc, f);
      if (ring.length < 2) continue;
      const L = CadCore.layer(doc, f.layer) || CadCore.layerPreset(f.layer);
      const m = CadCore.measure(doc, f);
      const coords = ring.map(p => [Number(p.lng.toFixed(9)), Number(p.lat.toFixed(9))]);

      let geometry;
      if (f.closed && coords.length >= 3) {
        coords.push(coords[0]);
        geometry = { type: 'Polygon', coordinates: [coords] };
      } else {
        geometry = { type: 'LineString', coordinates: coords };
      }

      features.push({
        type: 'Feature',
        geometry,
        properties: {
          dag: f.dag || null,
          khotian: f.khotian || null,
          owner: f.owner || null,
          layer: L.id,
          layer_name: L.name,
          survey: L.en || L.name,
          area_sqft: m.sqft ? Number(m.sqft.toFixed(2)) : null,
          area_satak: m.sqft ? Number((m.sqft / CadCore.SQFT_PER_SATAK).toFixed(4)) : null,
          area_katha: m.sqft ? Number(m.units.katha.toFixed(4)) : null,
          area_m2: m.sqft ? Number((m.sqft / 10.7639).toFixed(2)) : null,
          perimeter_ft: m.feet ? Number(m.feet.toFixed(2)) : null,
          district: M.district || null,
          upazila: M.upazila || null,
          mouza: M.mouza || null,
          jl: M.jl || null,
          note: f.note || null
        }
      });
    }

    return JSON.stringify({
      type: 'FeatureCollection',
      name: [M.mouza, M.upazila, M.district].filter(Boolean).join(' - ') || 'survey',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features
    }, null, 1);
  },

  /* ==================== ৬. CSV তফসিল ==================== */

  buildCsv(doc) {
    const M = doc.meta || {};
    const head = ['দাগ নং', 'খতিয়ান', 'জরিপ', 'ক্ষেত্রফল (শতাংশ)', 'ক্ষেত্রফল (কাঠা)',
                  'ক্ষেত্রফল (বর্গফুট)', 'পরিসীমা (ফুট)', 'কোণা', 'অক্ষাংশ', 'দ্রাঘিমাংশ'];
    const rows = [head];
    for (const f of CadCore.activeFeatures(doc)) {
      if (!f.closed) continue;
      const L = CadCore.layer(doc, f.layer) || CadCore.layerPreset(f.layer);
      const m = CadCore.measure(doc, f);
      let lat = '', lng = '';
      if (this.hasGeo(doc)) {
        const g = this.toGeo(doc, CadCore.labelPoint(f.pts));
        if (g) { lat = g.lat.toFixed(7); lng = g.lng.toFixed(7); }
      }
      rows.push([
        f.dag || '', f.khotian || '', L.name,
        m.sqft ? (m.sqft / CadCore.SQFT_PER_SATAK).toFixed(2) : '',
        m.sqft ? m.units.katha.toFixed(3) : '',
        m.sqft ? m.sqft.toFixed(0) : '',
        m.feet ? m.feet.toFixed(1) : '',
        f.pts.length, lat, lng
      ]);
    }
    const meta = [
      ['জেলা', M.district || ''], ['উপজেলা', M.upazila || ''],
      ['মৌজা', M.mouza || ''], ['জে.এল. নং', M.jl || ''],
      ['স্কেল', (M.scaleInch || 120) + '" = 1 mile'], []
    ];
    const esc = v => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return '﻿' + meta.concat(rows).map(r => r.map(esc).join(',')).join('\r\n');
  },

  /* ==================== ৭. ডাউনলোড ==================== */

  download(data, filename, mime) {
    const blob = (data instanceof Blob) ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  },

  fileBase(doc) {
    const M = doc.meta || {};
    const s = [M.mouza, M.upazila].filter(Boolean).join('-') || 'survey';
    return s.replace(/[^\wঀ-৿.\-]+/g, '_').slice(0, 60);
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = CadGeo;
