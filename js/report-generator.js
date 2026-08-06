/* ==========================================================================
   LAND PRO — সার্ভে প্রতিবেদন (A4 প্রিন্ট)

   অন্য সব সনদের মতোই `#print-report-container` + `css/print.css` এর
   `.pr-*` স্টাইল ব্যবহার করে। আগে নতুন উইন্ডো খোলা হতো — তাতে A4
   মাপ ঠিক হতো না এবং পপআপ ব্লকারে আটকে যেত।
   ========================================================================== */

const ReportGenerator = {

  generateSurveyReport(data) {
    const {
      surveyorName = '',
      surveyorPhone = '',
      clientName = '',
      mouzaName = '',
      khotianNo = '',
      dagNo = '',
      district = '',
      areaSatak = '',
      areaSqFt = '',
      areaKatha = '',
      areaBigha = '',
      sides = [],
      diagonals = [],
      kathaBasis = null,
      plotImgData = null
    } = data;

    let container = document.getElementById('print-report-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'print-report-container';
      document.body.appendChild(container);
    }

    const dash = n => '.'.repeat(n);
    const val = (v, n) => (v && String(v).trim()) ? v : dash(n || 22);
    const dateBn = toBn(new Date().toLocaleDateString('en-GB').replace(/\//g, '-'));

    // ---- বাহু ও কর্ণের মাপ — এক লাইনে, জায়গা বাঁচাতে ----
    let measureTable = '';
    if (sides.length) {
      const parts = sides.map((s, i) =>
        `<span><b>বাহু ${toBn(i + 1)}:</b> ${toBn(Number(s).toFixed(2))}</span>`
      ).concat(diagonals.map((d, i) =>
        `<span><b>কর্ণ ${toBn(i + 1)}:</b> ${toBn(Number(d).toFixed(2))}</span>`
      ));

      measureTable = `
        <div class="pr-assets">
          <h3>মাঠে গৃহীত মাপ (ফুট)</h3>
          <div class="pr-inline">${parts.join('')}</div>
        </div>`;
    }

    const basisLine = kathaBasis
      ? `<span><b>১ কাঠা:</b> ${toBn(kathaBasis.satakPerKatha.toFixed(4))} শতক</span>
         <span><b>১ বিঘা:</b> ${toBn(kathaBasis.satakPerBigha.toFixed(4))} শতক</span>` : '';

    container.innerHTML = `
      <div class="pr-head">
        <h1>ভূমি পরিমাপ প্রতিবেদন</h1>
        <div class="pr-sub">জমির জ্যামিতিক নকশা ও ক্ষেত্রফল বিবরণী</div>
      </div>

      <div class="pr-meta">
        <div>
          <b>জমি মালিকের নাম:</b> ${val(clientName, 26)}<br>
          <b>মৌজা ও জেএল নং:</b> ${val(mouzaName, 26)}<br>
          <b>জেলা / উপজেলা:</b> ${val(district, 26)}
        </div>
        <div style="text-align:right">
          <b>খতিয়ান নং:</b> ${val(khotianNo, 14)}<br>
          <b>দাগ নং:</b> ${val(dagNo, 14)}<br>
          <b>তারিখ:</b> ${dateBn}
        </div>
      </div>

      <div class="pr-assets">
        <h3>ক্ষেত্রফলের বিবরণ</h3>
        <div class="pr-assets-grid">
          <span><b>শতক:</b> ${areaSatak || dash(8)}</span>
          <span><b>কাঠা:</b> ${areaKatha || dash(8)}</span>
          <span><b>বিঘা:</b> ${areaBigha || dash(8)}</span>
          <span><b>বর্গফুট:</b> ${areaSqFt || dash(8)}</span>
          ${basisLine}
        </div>
      </div>

      ${plotImgData ? `
        <div class="pr-plot">
          <h3>জমির জ্যামিতিক নকশা</h3>
          <img src="${plotImgData}" alt="জমির নকশা">
        </div>` : ''}

      ${measureTable}

      <div class="pr-note">
        সতর্কীকরণ: এই প্রতিবেদন একটি স্বয়ংক্রিয় ক্যালকুলেটর দ্বারা প্রস্তুত।
        মাঠের প্রকৃত মাপ ও মৌজা ম্যাপের সাথে মিলিয়ে যাচাই করে নিন।
        দলিল বা মামলার কাজে ব্যবহারের আগে সনদপ্রাপ্ত আমিন দ্বারা নিশ্চিত করুন।
      </div>

      <div class="pr-sign">
        <div>জমি মালিকের স্বাক্ষর</div>
        <div>${surveyorName ? surveyorName : 'আমিন / সার্ভেয়ার'}${surveyorPhone ? '<br><span style="font-size:8pt">ফোন: ' + surveyorPhone + '</span>' : ''}</div>
        <div>তারিখ ও সীলমোহর</div>
      </div>

      <div class="pr-foot">Land Info — ফ্রি ডিজিটাল ভূমি সার্ভিস · জমি পরিমাপ ক্যালকুলেটর</div>
    `;

    window.print();
  }
};
