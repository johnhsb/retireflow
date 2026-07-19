// ============================================================
// UI 렌더링 & 상태 관리
// ============================================================

const DEFAULTS = {
  birthYear: 1967,
  dependents: 1,
  baseYear: 2027,
  startYear: 2028,
  endYear: 2040,
  inflation: 2.7,

  dcPrincipal: 0,
  dcGain: 0,
  dcMonthly: 0,
  dcReturnRate: 0,
  dcStartYear: 2028,
  dcStartMonth: 1,
  serviceYears: 1,

  personalMonthly: 0,
  personalBalance: 0,
  personalNonDeductiblePrincipal: 0,
  personalReturnRate: 0,
  personalStartYear: 2028,
  personalStartMonth: 1,

  npsEnabled: false,
  npsNormal63: 0,
  npsAdjustYears: 0,

  workEnabled: false,
  workStartYear: 2028,
  workStartMonth: 1,
  workEndYear: 2028,
  workEndMonth: 12,
  workSalary: 0,

  unempEnabled: false,
  unempMonths: 0,
  unempMonthly: 0,

  voluntaryMaxYears: 3,

  gongsigaStart: 0,

  downsizeEnabled: false,
  downsizeYear: 2028,
  downsizeTargetGongsiga: 0
};

let state = Object.assign({}, DEFAULTS);
let currentResults = [];
let selectedYear = state.startYear;

function fmt(n) {
  return n.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// ------------------------------------------------------------
// 사이드바 정의 (아코디언 섹션 + 필드)
// ------------------------------------------------------------
const SECTIONS = [
  {
    idx: '01', title: '기본 정보', open: true,
    fields: [
      { key: 'birthYear', label: '생년(년)', type: 'number', min: 1950, max: 1990, step: 1,
        help: '만 나이 계산과 국민연금 수령 개시 연령 판정의 기준이 됩니다.' },
      { key: 'dependents', label: '인적공제 대상자 수(본인 포함)', type: 'range', min: 1, max: 6, step: 1, unit: '명',
        help: '종합소득세 계산 시 적용되는 인적공제 대상자 수입니다(본인 포함).\n근거: 소득세법 제50조(인적공제)\n산출: 종합소득금액 - (150만원 × 인원수) - 경로우대공제 = 과세표준\n경로우대공제(소득세법 제51조): 본인이 만 70세 이상인 해에는 100만원이 자동으로 추가공제됩니다. 배우자 등 다른 인적공제 대상자는 생년 정보를 입력받지 않아 이 공제에는 반영되지 않습니다.' },
      { key: 'startYear', label: '시뮬레이션 시작연도', type: 'number', min: 2020, max: 2050, step: 1,
        help: '현금흐름을 계산할 기간의 시작연도입니다.' },
      { key: 'endYear', label: '시뮬레이션 종료연도', type: 'number', min: 2020, max: 2060, step: 1,
        help: '현금흐름을 계산할 기간의 종료연도입니다. 시작연도보다 빠르면 계산되지 않습니다.' },
      { key: 'inflation', label: '물가상승률', type: 'range', min: 0, max: 6, step: 0.1, unit: '%',
        help: '국민연금의 매년 자동 인상분과 미래 공시가격 추정에 사용되는 연평균 물가상승률입니다.' },
      { key: 'gongsigaStart', label: '주택 공시가격 — 재산세·건보료 산정용', type: 'number', unit: '만원',
        help: '재산세·종합부동산세·건강보험 재산분 계산의 공통 기준입니다.\n[재산세] 근거: 지방세법 제110·111조 / 산출: 공시가격×45%(과세표준) → 구간별 세율(6천만원 이하 0.1%~3억 초과 0.4%) + 도시지역분·지방교육세 가산\n[종부세] 근거: 종합부동산세법 제8·9조 / 산출: (공시가격-12억원)×60%×0.6% 근사 계산. 실제는 0.5~2.7% 누진세율과 고령자·장기보유 세액공제(최대 80%)가 있어 코드 값보다 실제 부담이 낮을 수 있습니다.\n[건보 재산분] 근거: 국민건강보험법 시행령 제42조 별표4 / 산출: 공시가격×45%-1억원(기본공제) → 재산등급 점수표(60등급) → 점수당 211.5원(2026년)\n※ 공시가 9억원 이하 1세대1주택 재산세 특례세율(0.05~0.35%)은 미반영되어 실제보다 다소 높게 산정될 수 있습니다.' },
      { key: 'baseYear', label: '공시가격 기준연도', type: 'number', min: 2020, max: 2040, step: 1,
        help: '위 주택 공시가격이 어느 연도 기준 금액인지 지정합니다. 이후 연도의 공시가격은 물가상승률로 추정합니다. 근속연수·연금개시 시점 등 다른 계산과는 무관합니다.' }
    ]
  },
  {
    idx: '02', title: 'DC 퇴직연금',
    fields: [
      { key: 'dcPrincipal', label: 'DC 원금(회사입금분)', type: 'number', unit: '만원',
        help: '회사가 납입한 원금(이연퇴직소득) 부분입니다. 근속연수·연금 실제 수령연차에 따라 감면되는 퇴직소득세로 과세됩니다.\n근거: 소득세법 제22조·제129조, 시행령 제42조의2(근속연수공제)·제42조의3(환산급여공제)\n산출: (원금-근속연수공제)×12/근속연수=환산급여 → 환산급여공제(구간별 100%/60%/55%/45%/35%, 3억원 초과 구간 포함) 차감 → 종합소득세율표 적용 → 연분연승 역산 → 수령연차 10년 이하 70%(30%감면)/10년 초과 60%(40%감면)를 곱해 최종 세액 산정' },
      { key: 'dcGain', label: 'DC 운용수익', type: 'number', unit: '만원',
        help: '원금을 초과해 발생한 운용수익 부분입니다.\n근거: 소득세법 제20조의3(연금소득)·제47조의2(연금소득공제)·제64조의4·제129조(원천징수세율)\n산출: 한도이내 사적연금소득(이 항목+개인연금 과세대상분, 국민연금 제외) 합계가 연 1,500만원 이하면 연령별 저율(55~69세 5.5%/70~79세 4.4%/80세이상 3.3%, 지방세 포함)로, 1,500만원 초과면 전액 16.5%로 분리과세한 세액과 종합과세 세액을 비교해 더 낮은 쪽을 자동 적용합니다. 종합과세 선택 시 연금소득공제(최대 900만원 한도)를 차감한 금액이 과세대상입니다.' },
      { key: 'dcStartYear', label: 'DC 수령개시 연도', type: 'number', min: 2020, max: 2060,
        help: 'DC퇴직연금 수령을 시작하는 시점입니다.\n근거: 소득세법 시행령 제40조의2(연금수령한도)\n산출: 연금수령한도 = 연초잔고 ÷ (11-연금수령연차) × 120% (11년차부터 한도 없음). 한도 초과분은 감면 없는 세율이 적용됩니다.' },
      { key: 'dcStartMonth', label: 'DC 수령개시 월', type: 'number', min: 1, max: 12,
        help: 'DC퇴직연금 수령을 시작하는 월입니다.' },
      { key: 'dcMonthly', label: 'DC 월 수령액(목표)', type: 'range', min: 0, max: 1000, step: 10, unit: '만원',
        help: '매월 인출을 희망하는 금액입니다. 계좌 잔고가 부족해지면 인출 가능한 만큼만 자동으로 축소됩니다.' },
      { key: 'dcReturnRate', label: 'DC 계좌 연 운용수익률', type: 'range', min: -5, max: 10, step: 0.1, unit: '%',
        help: '잔고에 매월 복리로 반영되는 예상 운용수익률입니다.' },
      { key: 'serviceYears', label: '근속연수', type: 'range', min: 1, max: 45, step: 1, unit: '년',
        help: '퇴직소득세 근속연수공제 계산에 사용됩니다. 근속연수가 길수록 공제액이 커져 세금 부담이 줄어듭니다.\n근거: 소득세법 시행령 [별표3] 근속연수공제\n산출: 5년 이하 100만원×연수 / 10년 이하 500만원+5년초과분×200만원 / 20년 이하 1,500만원+10년초과분×250만원 / 20년 초과 4,000만원+20년초과분×300만원\n이연퇴직소득세 감면율(30%/40%)은 연금 실제 수령연차 10년초과 시점부터 자동 전환됩니다.' }
    ]
  },
  {
    idx: '03', title: '개인연금',
    fields: [
      { key: 'personalBalance', label: '개인연금 계좌 초기잔고', type: 'number', unit: '만원',
        help: '연금 개시 시점의 계좌 잔고 전체(세액공제 받지 않은 원금 포함 총액)입니다.' },
      { key: 'personalNonDeductiblePrincipal', label: '위 잔고 중 세액공제 받지 않은 원금', type: 'number', unit: '만원',
        help: '연금저축·IRP 세액공제 한도(연 900만원, 2026년 기준)를 초과해 납입했거나 세액공제를 받지 않은 원금입니다. 해당 없으면 0으로 두세요.\n근거: 소득세법 시행령 제40조의3(연금계좌 인출순서)\n산출: 인출 시 이 금액이 가장 먼저(비과세로) 소진되고, 그 다음부터 세액공제받은 원금+운용수익이 인출되어 연금소득세(한도이내 저율/한도초과 16.5%) 대상이 됩니다. 전체 잔고보다 큰 값을 입력하면 전체 잔고로 제한됩니다.' },
      { key: 'personalStartYear', label: '개인연금 수령개시 연도', type: 'number', min: 2020, max: 2060,
        help: '개인연금 수령을 시작하는 연도입니다.\n근거: 소득세법 시행령 제40조의2(연금수령한도) — DC퇴직연금과 동일한 산식이 적용됩니다.\n산출: 연금수령한도 = 연초잔고 ÷ (11-연금수령연차) × 120%' },
      { key: 'personalStartMonth', label: '개인연금 수령개시 월', type: 'number', min: 1, max: 12,
        help: '개인연금 수령을 시작하는 월입니다.' },
      { key: 'personalMonthly', label: '개인연금 월수령액(목표)', type: 'range', min: 0, max: 500, step: 10, unit: '만원',
        help: '매월 인출을 희망하는 금액입니다. 계좌 잔고가 부족해지면 인출 가능한 만큼만 자동으로 축소됩니다.' },
      { key: 'personalReturnRate', label: '개인연금 계좌 연 운용수익률', type: 'range', min: -5, max: 10, step: 0.1, unit: '%',
        help: '잔고에 매월 복리로 반영되는 예상 운용수익률입니다.' }
    ]
  },
  {
    idx: '04', title: '국민연금',
    fields: [
      { key: 'npsEnabled', label: '국민연금 반영', type: 'checkbox',
        help: '체크하지 않으면 국민연금은 현금흐름 계산에서 제외됩니다.' },
      { key: 'npsNormal63', label: '정상수령 나이 월 예상액', type: 'range', min: 0, max: 400, step: 1, unit: '만원',
        note: (s) => `${s.birthYear}년생 정상수령 나이: 만 ${npsNormalAge(s.birthYear)}세`,
        help: '국민연금공단에서 안내받은 정상수령 나이(생년에 따라 만 61~65세, 좌측 생년 입력값 기준 자동 판정) 시점의 예상 월 수령액입니다. 이 금액은 수령 개시 시점의 명목 금액으로 간주되어 이후 매년 물가상승률만큼 자동 인상됩니다. 국민연금공단 조회 화면에서 "오늘 기준 현재가치"로 안내받은 금액을 그대로 입력하면 실제보다 낮게 계산될 수 있습니다.\n근거: 국민연금법 제51조(급여액의 조정) — 매년 전국소비자물가변동률을 반영해 연금액을 인상\n산출: 수령개시 이후 (1+물가상승률)^경과연수를 곱해 자동 인상' },
      { key: 'npsAdjustYears', label: '조기(-)/연기(+) 연수 (조기 최대-5, 연기 최대+5)', type: 'range', min: -5, max: 5, step: 1, unit: '년',
        help: '조기수령은 1년당 6% 감액(최대 5년, -30%), 연기수령은 1년당 7.2% 가산(최대 5년, +36%)되며, 위 정상수령액에 적용됩니다.\n근거: 국민연금법 제61조(조기노령연금)·제62조(연기연금)' }
    ]
  },
  {
    idx: '05', title: '재취업 · 실업급여',
    fields: [
      { key: 'workEnabled', label: '재취업 반영', type: 'checkbox',
        help: '체크하지 않으면 재취업 기간의 근로소득이 반영되지 않습니다.' },
      { key: 'workStartYear', label: '재취업 시작 연도', type: 'number', min: 2020, max: 2060,
        help: '재취업 근무 시작 연도입니다. 임의계속가입 자격(12개월 이상 재직) 판정에도 사용됩니다.' },
      { key: 'workStartMonth', label: '재취업 시작 월', type: 'number', min: 1, max: 12,
        help: '재취업 근무 시작 월입니다.' },
      { key: 'workEndYear', label: '재취업 종료 연도', type: 'number', min: 2020, max: 2060,
        help: '재취업 근무 종료 연도입니다. 이 다음 달부터 실업급여·임의계속가입이 시작될 수 있습니다.' },
      { key: 'workEndMonth', label: '재취업 종료 월', type: 'number', min: 1, max: 12,
        help: '재취업 근무 종료 월입니다.' },
      { key: 'workSalary', label: '재취업 연봉', type: 'range', min: 0, max: 12000, step: 100, unit: '만원',
        help: '세전 연봉(총급여) 기준으로 입력하세요.\n근거: 소득세법 제47조(근로소득공제)\n산출: 500만원 이하 70% / 1,500만원 이하 350만원+초과분의 40% / 4,500만원 이하 950만원+초과분의 15% / 1억원 이하 1,425만원+초과분의 5% / 1억원 초과 1,725만원+초과분의 2% 공제 후 종합과세\n참고: 근로소득세액공제(소득세법 제59조, 총급여 구간별 연 20만~74만원)는 월별 현금흐름에 미치는 영향이 작아 이 시뮬레이터에는 반영하지 않았습니다. 실제로는 이 금액만큼 재취업 기간 소득세가 더 낮아질 수 있습니다.' },
      { key: 'unempEnabled', label: '실업급여 반영 (재취업 종료월 다음달부터 자동)', type: 'checkbox',
        help: '재취업을 반영한 경우에만 의미가 있으며, 재취업 종료월 다음 달부터 자동으로 지급이 시작됩니다.' },
      { key: 'unempMonths', label: '실업급여 수령 개월수 (법정 최대 270일=9개월)', type: 'range', min: 0, max: 9, step: 1, unit: '개월',
        help: '법정 실업급여(구직급여) 최대 수령기간은 270일(9개월)입니다. 고용센터에서 안내받은 실제 소정급여일수를 기준으로 입력하세요.\n근거: 고용보험법 제50조(소정급여일수) — 실제 일수는 연령·피보험기간에 따라 120~270일로 차등 적용되므로, 정확한 일수는 고용센터 안내를 따르세요.' },
      { key: 'unempMonthly', label: '실업급여 월액', type: 'range', min: 0, max: 300, step: 5, unit: '만원',
        help: '고용센터에서 안내받은(또는 예상되는) 실업급여 월액입니다.' }
    ]
  },
  {
    idx: '06', title: '건강보험 · 임의계속가입',
    fields: [
      { key: 'voluntaryMaxYears', label: '임의계속가입 활용기간 (재취업 1년↑ 시 자동적용, 법정최대 3년)', type: 'range', min: 0, max: 3, step: 1, unit: '년',
        help: '재취업 기간이 1년(12개월) 이상이어야 임의계속가입 자격이 발생합니다. 1년 미만이면 이 값을 설정해도 적용되지 않고 퇴사 즉시 지역가입자로 전환됩니다.\n근거: 국민건강보험법 제110조(임의계속가입자)\n산출: 퇴직 전 12개월 평균 보수월액 × 직장가입자 본인부담률(3.595%). 사용자 분담분 없이 본인이 전액 납부하지만, 산정 자체는 재직 당시 본인부담 수준과 동일하게 유지되어 지역가입자 전환 대비 부담이 완화됩니다.' }
    ]
  },
  {
    idx: '07', title: '주택 다운사이징',
    fields: [
      { key: 'downsizeEnabled', label: '다운사이징 반영 (재산세·건보료에만 반영, 양도차익/양도세는 현금흐름에 미포함)', type: 'checkbox',
        help: '매도 시 발생하는 양도차익·양도소득세는 1회성 거액이라 월별 현금흐름 왜곡을 피하기 위해 의도적으로 제외했습니다. 재산세·종합부동산세·건강보험 재산분에만 반영됩니다.' },
      { key: 'downsizeYear', label: '다운사이징 연도', type: 'number', min: 2020, max: 2060,
        help: '이 연도부터 낮아진 공시가격 기준으로 재산세·종부세·건강보험 재산분이 재계산됩니다.' },
      { key: 'downsizeTargetGongsiga', label: '다운사이징 후 공시가격', type: 'number', unit: '만원',
        help: '다운사이징 후 주택의 공시가격입니다.' }
    ]
  }
];

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';
  SECTIONS.forEach((sec, si) => {
    const secEl = document.createElement('div');
    secEl.className = 'acc-section' + (sec.open ? ' open' : '');

    const headRow = document.createElement('div');
    headRow.className = 'acc-head-row';
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'acc-head';
    head.innerHTML = `<span class="idx">${sec.idx}</span>${sec.title}<span class="chev">▸</span>`;
    head.onclick = () => { secEl.classList.toggle('open'); };
    const secResetBtn = document.createElement('button');
    secResetBtn.type = 'button';
    secResetBtn.className = 'sec-reset-btn';
    secResetBtn.id = 'secreset_' + si;
    secResetBtn.textContent = '초기화';
    secResetBtn.style.display = 'none';
    secResetBtn.onclick = () => resetSection(sec);
    headRow.appendChild(head);
    headRow.appendChild(secResetBtn);

    const body = document.createElement('div');
    body.className = 'acc-body';

    sec.fields.forEach(f => {
      const field = document.createElement('div');
      const infoBtn = f.help ? `<button type="button" class="info-icon" id="h_${f.key}" aria-label="설명 보기">ⓘ</button>` : '';
      const resetBtn = `<button type="button" class="reset-icon" id="r_${f.key}" style="display:none" aria-label="기본값으로 되돌리기" title="기본값으로 되돌리기">↺</button>`;
      if (f.type === 'checkbox') {
        field.className = 'checkbox-row';
        field.innerHTML = `<input type="checkbox" id="f_${f.key}" ${state[f.key] ? 'checked' : ''}><span>${f.label}</span>${infoBtn}${resetBtn}`;
      } else if (f.type === 'range') {
        field.className = 'field';
        const noteHtml = f.note ? `<div class="field-note" id="n_${f.key}">${f.note(state)}</div>` : '';
        field.innerHTML = `<label>${f.label}${infoBtn}${resetBtn} <span class="val" id="v_${f.key}">${state[f.key]}${f.unit || ''}</span></label>
          ${noteHtml}
          <input type="range" id="f_${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${state[f.key]}">`;
      } else {
        field.className = 'field';
        field.innerHTML = `<label>${f.label}${infoBtn}${resetBtn}${f.unit ? ' <span class="val">(' + f.unit + ')</span>' : ''}</label>
          <input type="${f.type}" id="f_${f.key}" value="${state[f.key]}" ${f.min !== undefined ? 'min=' + f.min : ''} ${f.max !== undefined ? 'max=' + f.max : ''}>`;
      }
      body.appendChild(field);
    });

    secEl.appendChild(headRow);
    secEl.appendChild(body);
    sidebar.appendChild(secEl);
  });

  // 이벤트 바인딩
  SECTIONS.forEach(sec => sec.fields.forEach(f => {
    const el = document.getElementById('f_' + f.key);
    el.addEventListener('input', () => {
      let v;
      if (f.type === 'checkbox') v = el.checked;
      else if (f.type === 'range' || f.type === 'number') v = parseFloat(el.value);
      else v = el.value;
      state[f.key] = v;
      if (f.type === 'range') {
        document.getElementById('v_' + f.key).textContent = v + (f.unit || '');
      }
      updateFieldNotes();
      updateResetUI();
      recalc();
    });
    const resetBtn = document.getElementById('r_' + f.key);
    resetBtn.addEventListener('click', () => resetField(f));
  }));

  bindInfoIcons();
  updateFieldNotes();
  updateResetUI();
}

// 필드 하나를 기본값으로 되돌림
function resetField(f) {
  state[f.key] = DEFAULTS[f.key];
  const el = document.getElementById('f_' + f.key);
  if (f.type === 'checkbox') el.checked = state[f.key];
  else el.value = state[f.key];
  if (f.type === 'range') {
    document.getElementById('v_' + f.key).textContent = state[f.key] + (f.unit || '');
  }
  updateFieldNotes();
  updateResetUI();
  recalc();
}

// 섹션 내 모든 필드를 기본값으로 되돌림
function resetSection(sec) {
  sec.fields.forEach(f => resetField(f));
}

// 기본값과 다른 필드에만 되돌리기 아이콘을 표시하고, 변경된 필드가 있는 섹션에만 섹션 초기화 버튼을 표시
function updateResetUI() {
  SECTIONS.forEach((sec, si) => {
    let sectionChanged = false;
    sec.fields.forEach(f => {
      const changed = state[f.key] !== DEFAULTS[f.key];
      if (changed) sectionChanged = true;
      const btn = document.getElementById('r_' + f.key);
      if (btn) btn.style.display = changed ? 'inline-flex' : 'none';
    });
    const secBtn = document.getElementById('secreset_' + si);
    if (secBtn) secBtn.style.display = sectionChanged ? 'inline-block' : 'none';
  });
}

function updateFieldNotes() {
  SECTIONS.forEach(sec => sec.fields.forEach(f => {
    if (!f.note) return;
    const el = document.getElementById('n_' + f.key);
    if (el) el.textContent = f.note(state);
  }));
}

// ------------------------------------------------------------
// 항목별 설명(help) 팝오버
// ------------------------------------------------------------
let activeInfoKey = null;
function bindInfoIcons() {
  SECTIONS.forEach(sec => sec.fields.forEach(f => {
    if (!f.help) return;
    const icon = document.getElementById('h_' + f.key);
    if (!icon) return;
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeInfoKey === f.key) { hideInfoPopover(); return; }
      showInfoPopover(icon, f.label, f.help);
      activeInfoKey = f.key;
    });
  }));
}

function showInfoPopover(anchor, title, text) {
  const pop = document.getElementById('infoPopover');
  pop.innerHTML = '';
  const t = document.createElement('div');
  t.className = 'info-popover-title';
  t.textContent = title.replace(/\s*—.*$/, '');
  const b = document.createElement('div');
  b.className = 'info-popover-body';
  b.textContent = text;
  pop.appendChild(t);
  pop.appendChild(b);
  pop.style.display = 'block';

  const rect = anchor.getBoundingClientRect();
  const popWidth = 300;
  let left = rect.left;
  if (left + popWidth > window.innerWidth - 12) left = window.innerWidth - popWidth - 12;
  pop.style.left = Math.max(12, left) + 'px';

  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < 160) {
    pop.style.top = 'auto';
    pop.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
  } else {
    pop.style.bottom = 'auto';
    pop.style.top = (rect.bottom + 6) + 'px';
  }
}

function hideInfoPopover() {
  const pop = document.getElementById('infoPopover');
  if (!pop) return;
  pop.style.display = 'none';
  activeInfoKey = null;
}

document.addEventListener('click', (e) => {
  const pop = document.getElementById('infoPopover');
  if (pop && pop.style.display === 'block' && !pop.contains(e.target) && !e.target.classList.contains('info-icon')) {
    hideInfoPopover();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideInfoPopover(); });

// ------------------------------------------------------------
// 타임라인
// ------------------------------------------------------------
function renderTimeline(results) {
  const el = document.getElementById('timeline');
  el.innerHTML = '';
  const total = results.length;
  results.forEach(r => {
    const seg = document.createElement('div');
    let phase = 'phase-region', label = '지역가입';
    if (r.isWorking) { phase = 'phase-work'; label = '재취업'; }
    else if (r.isVoluntary) { phase = 'phase-voluntary'; label = '임의계속'; }
    if (r.isSaleYear) { phase = 'phase-downsize'; label = '다운사이징'; }
    if (r.npsAnnual > 0) { phase = 'phase-nps'; label = '국민연금'; }
    seg.className = 'tl-seg ' + phase;
    seg.style.flex = '1';
    seg.title = `${r.year} (만 ${r.age}세) · ${label}`;
    seg.innerHTML = `<b>${r.age}</b>${label}`;
    el.appendChild(seg);
  });
}

// ------------------------------------------------------------
// KPI 카드
// ------------------------------------------------------------
function renderKPI(results) {
  const el = document.getElementById('kpiRow');
  const totalTax = results.reduce((s, r) => s + r.totalTaxAll, 0);
  const totalNet = results.reduce((s, r) => s + r.netIncome, 0);
  const avgAnnualTax = totalTax / results.length;
  const minNet = Math.min(...results.map(r => r.netIncome));
  const minYear = results.find(r => r.netIncome === minNet);

  const dcDep = results.dcDepletedAt;
  const persDep = results.personalDepletedAt;
  const dcLast = results[results.length - 1];
  const depletionCards = `
    <div class="kpi ${dcDep ? 'kpi-alert' : ''}">
      <div class="label">DC퇴직연금 소진 시점</div>
      <div class="value">${dcDep ? dcDep.year + '.' + dcDep.month : '미소진'}<small>${dcDep ? '' : ' (기간 내)'}</small></div>
      <div class="sub">기간 종료 시점 잔고 ${fmt(dcLast.dcBalanceEnd)}만원</div>
    </div>
    <div class="kpi ${persDep ? 'kpi-alert' : ''}">
      <div class="label">개인연금 소진 시점</div>
      <div class="value">${persDep ? persDep.year + '.' + persDep.month : '미소진'}<small>${persDep ? '' : ' (기간 내)'}</small></div>
      <div class="sub">기간 종료 시점 잔고 ${fmt(dcLast.personalBalanceEnd)}만원</div>
    </div>`;

  el.innerHTML = `
    <div class="kpi">
      <div class="label">시뮬레이션 기간 총 세금·공과금</div>
      <div class="value">${fmt(totalTax)}<small> 만원</small></div>
      <div class="sub">${results[0].year}~${results[results.length - 1].year} (${results.length}년)</div>
    </div>
    <div class="kpi">
      <div class="label">연평균 세금·공과금</div>
      <div class="value">${fmt(avgAnnualTax)}<small> 만원</small></div>
    </div>
    <div class="kpi">
      <div class="label">기간 합계 세후 순수입</div>
      <div class="value">${fmt(totalNet)}<small> 만원</small></div>
    </div>
    <div class="kpi">
      <div class="label">순수입 최저 연도</div>
      <div class="value">${fmt(minNet)}<small> 만원</small></div>
      <div class="sub">${minYear ? minYear.year + '년 (만 ' + minYear.age + '세)' : '-'}</div>
    </div>
    ${depletionCards}
  `;
}

// ------------------------------------------------------------
// 연도별 차트 (Canvas)
// ------------------------------------------------------------
function renderChart(results) {
  const canvas = document.getElementById('annualChart');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.parentElement.clientWidth - 44;
  const cssH = 280;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const series = buildFullMonthlySeries(results, state); // 월별 {year, month, income, expense, net, ...}
  const n = series.length;
  if (n === 0) return;

  const padL = 60, padR = 10, padT = 14, padB = 28;
  const plotW = cssW - padL - padR;
  const plotH = cssH - padT - padB;
  const xStep = plotW / n;

  const excessYears = new Set(results.filter(r => r.dcExcess > 1 || r.personalExcess > 1).map(r => r.year));

  const incomes = series.map(m => m.income);
  const expenses = series.map(m => m.expense);
  const nets = series.map(m => m.net);

  // 수입(바깥, 넓은 막대)과 지출(안쪽, 좁은 막대)을 같은 기준선(0)에서 겹쳐 그림.
  // 지출이 수입보다 크면 좁은 지출 막대가 넓은 수입 막대 위로 삐져나와 적자를 바로 보여줌.
  const barValues = [...incomes, ...expenses];
  const sortedBars = [...barValues].sort((a, b) => a - b);
  const p90Bar = sortedBars.length ? sortedBars[Math.floor(sortedBars.length * 0.9)] : 0;
  let maxTop = Math.min(Math.max(...barValues, 0), Math.max(p90Bar * 1.4, 10));
  maxTop = Math.max(maxTop, 10);

  // 순현금흐름이 적자인 달만을 위한 하단 여백(막대 스케일을 짓누르지 않도록 상한 적용)
  const deficits = nets.map(v => Math.max(0, -v));
  let maxBottom = Math.min(Math.max(...deficits, 0), maxTop * 1.5);

  const pxPerUnit = plotH / (maxTop + maxBottom);
  const zeroY = padT + maxTop * pxPerUnit;

  // 한도초과 과세 연도 배경 강조 (축·막대보다 먼저 그려 뒤에 깔리도록)
  // 막대 그래프 영역(padT~padT+plotH)보다 위아래로 더 크게 그려 바깥쪽까지 음영이 확장되도록 함
  series.forEach((m, i) => {
    if (!excessYears.has(m.year)) return;
    ctx.fillStyle = 'rgba(139,150,160,0.18)';
    ctx.fillRect(padL + xStep * i, 0, xStep, cssH);
  });

  ctx.strokeStyle = '#DCD5C4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  ctx.font = '10px monospace';
  [0.5, 1].forEach(frac => {
    const val = maxTop * frac;
    const y = zeroY - val * pxPerUnit;
    ctx.fillStyle = '#8B96A0';
    ctx.fillText(fmt(val), 4, y + 3);
    ctx.strokeStyle = '#EAE5D8';
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
  });
  ctx.strokeStyle = '#B9C2C9';
  ctx.beginPath(); ctx.moveTo(padL, zeroY); ctx.lineTo(padL + plotW, zeroY); ctx.stroke();
  ctx.fillStyle = '#5B6B77';
  ctx.fillText('0', 4, zeroY + 3);
  if (maxBottom > 0) {
    const y = zeroY + maxBottom * pxPerUnit;
    ctx.fillStyle = '#8B96A0';
    ctx.fillText('-' + fmt(maxBottom), 4, y + 3);
    ctx.strokeStyle = '#EAE5D8';
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
  }

  const bwOuter = Math.max(1, xStep * 0.62);
  const bwInner = Math.max(0.6, xStep * 0.34);

  series.forEach((m, i) => {
    const cx = padL + xStep * i + xStep / 2;
    const incH = Math.min(Math.max(m.income, 0), maxTop) * pxPerUnit;
    const expH = Math.min(Math.max(m.expense, 0), maxTop) * pxPerUnit;
    ctx.fillStyle = '#2FA88A';
    ctx.fillRect(cx - bwOuter / 2, zeroY - incH, bwOuter, incH);
    ctx.fillStyle = '#D9853F';
    ctx.fillRect(cx - bwInner / 2, zeroY - expH, bwInner, expH);

    // 매년 1월마다 연도 라벨
    if (m.month === 1 || i === 0) {
      ctx.strokeStyle = '#EAE5D8';
      ctx.beginPath(); ctx.moveTo(cx - xStep / 2, padT); ctx.lineTo(cx - xStep / 2, padT + plotH); ctx.stroke();
      ctx.fillStyle = '#8B96A0';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.year, cx, padT + plotH + 16);
      ctx.textAlign = 'left';
    }
  });

  // 순현금흐름 라인 (월별) - 적자인 달은 0 기준선 아래(예약된 여백)로 자연스럽게 내려감
  ctx.strokeStyle = '#3D7AB8';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  series.forEach((m, i) => {
    const cx = padL + xStep * i + xStep / 2;
    const v = Math.max(-maxBottom, Math.min(maxTop, m.net));
    const y = zeroY - v * pxPerUnit;
    if (i === 0) ctx.moveTo(cx, y); else ctx.lineTo(cx, y);
  });
  ctx.stroke();

  // 호버 인터랙션을 위한 좌표 정보 저장
  chartGeom = { padL, padT, plotW, plotH, xStep, series, cssW, cssH };
  setupChartHover();
}

function breakdownStr(pairs) {
  return pairs.filter(([, v]) => v > 0.5).map(([label, v]) => `${label} ${fmt(v)}`).join(' · ');
}

let chartGeom = null;
let chartHoverBound = false;
function setupChartHover() {
  const canvas = document.getElementById('annualChart');
  const wrap = canvas.parentElement;
  const tooltip = document.getElementById('chartTooltip');
  const crosshair = document.getElementById('chartCrosshair');
  if (chartHoverBound) return;
  chartHoverBound = true;

  canvas.addEventListener('mousemove', (e) => {
    if (!chartGeom) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { padL, plotW, xStep, series } = chartGeom;
    if (x < padL || x > padL + plotW) { hideHover(); return; }
    let idx = Math.floor((x - padL) / xStep);
    idx = Math.max(0, Math.min(series.length - 1, idx));
    const m = series[idx];
    const cx = padL + xStep * idx + xStep / 2;

    crosshair.style.left = cx + 'px';
    crosshair.classList.add('show');

    const incBreak = breakdownStr([
      ['DC퇴직연금', m.dc], ['개인연금', m.personal], ['국민연금', m.nps],
      ['근로소득', m.earned], ['실업급여', m.unemployment]
    ]);
    const expBreak = breakdownStr([
      ['퇴직소득세', m.taxRetire], ['종합/분리소득세', m.taxIncome],
      ['건강보험', m.nhis], ['재산세', m.propTax], ['종부세', m.jongbu]
    ]);

    const yr = currentResults.find(r => r.year === m.year);
    let alertLine = '';
    if (yr) {
      const parts = [];
      if (yr.dcExcess > 1) parts.push(`DC퇴직연금 ${fmt(yr.dcExcess)}만원 초과(한도 ${fmt(yr.dcLimit)}만원)`);
      if (yr.personalExcess > 1) parts.push(`개인연금 ${fmt(yr.personalExcess)}만원 초과(한도 ${fmt(yr.personalLimit)}만원)`);
      if (parts.length) {
        alertLine = `<div class="tt-alert">⚠ ${m.year}년 한도초과 과세 — ${parts.join(' / ')}<br>초과분은 감면 없는 세율(퇴직소득세 전체세율 또는 16.5% 기타소득세) 적용</div>`;
      }
    }

    tooltip.innerHTML = `<div class="tt-title">${m.year}년 ${m.month}월</div>` +
      `수입 ${fmt(m.income)}만원${incBreak ? `<br><span class="tt-sub">${incBreak}</span>` : ''}<br>` +
      `지출 ${fmt(m.expense)}만원${expBreak ? `<br><span class="tt-sub">${expBreak}</span>` : ''}<br>` +
      `<b>순현금흐름 ${fmt(m.net)}만원</b>` + alertLine;
    tooltip.style.left = cx + 'px';
    tooltip.style.top = '0px';
    tooltip.classList.add('show');
  });

  canvas.addEventListener('mouseleave', hideHover);

  function hideHover() {
    tooltip.classList.remove('show');
    crosshair.classList.remove('show');
  }
}

// ------------------------------------------------------------
// 월별 테이블
// ------------------------------------------------------------
function renderMonthlyTable(results) {
  const sel = document.getElementById('yearSelect');
  sel.innerHTML = results.map(r => `<option value="${r.year}">${r.year} (만 ${r.age}세)</option>`).join('');
  if (!results.find(r => r.year === selectedYear)) selectedYear = results[0].year;
  sel.value = selectedYear;

  const yearResult = results.find(r => r.year === selectedYear);
  document.getElementById('monthlyTitle').textContent = `월별 현금흐름 · ${selectedYear}년 (만 ${yearResult.age}세)`;

  const months = buildMonthly(yearResult, state);
  const table = document.getElementById('monthlyTable');

  let badge = '';
  const badgeMap = { '직장': 'work', '임의계속': 'voluntary', '지역': 'region' };
  badge = `<span class="badge ${badgeMap[yearResult.nhisType]}">${yearResult.nhisType}가입자 (연중 최다월)</span>`;

  let html = `<thead><tr>
    <th>항목 ${badge}</th>
    ${months.map(m => `<th>${m.month}월</th>`).join('')}
    <th>합계</th>
  </tr></thead><tbody>`;

  const statusLabel = { work: '직장', voluntary: '임의계속', region: '지역' };
  const statusClass = { work: 'work', voluntary: 'voluntary', region: 'region' };
  html += `<tr><td>건보 가입유형</td>${months.map(m => `<td><span class="badge ${statusClass[m.nhisStatus]}" style="margin:0;">${statusLabel[m.nhisStatus]}</span></td>`).join('')}<td>-</td></tr>`;

  const rowsDef = [
    ['DC퇴직연금', 'dc'], ['개인연금', 'personal'],
    ['국민연금', 'nps'],
    ['근로소득', 'earned'], ['실업급여', 'unemployment']
  ];
  rowsDef.forEach(([label, key]) => {
    const vals = months.map(m => m[key]);
    if (vals.every(v => v === 0)) return;
    html += `<tr><td>${label}</td>${vals.map(v => `<td class="num">${v ? fmt(v) : '-'}</td>`).join('')}<td class="num">${fmt(vals.reduce((a, b) => a + b, 0))}</td></tr>`;
  });
  html += `<tr><td><b>수입 합계</b></td>${months.map(m => `<td class="num pos-strong">${fmt(m.income)}</td>`).join('')}<td class="num pos-strong">${fmt(months.reduce((a, m) => a + m.income, 0))}</td></tr>`;

  const expDef = [
    ['퇴직소득세+지방세', 'taxRetire'], ['종합/분리소득세+지방세', 'taxIncome'],
    ['건강보험+장기요양', 'nhis'], ['재산세', 'propTax'], ['종부세', 'jongbu']
  ];
  expDef.forEach(([label, key]) => {
    const vals = months.map(m => m[key]);
    if (vals.every(v => v === 0)) return;
    html += `<tr><td>${label}</td>${vals.map(v => `<td class="num neg">${v ? '-' + fmt(v) : '-'}</td>`).join('')}<td class="num neg">-${fmt(vals.reduce((a, b) => a + b, 0))}</td></tr>`;
  });
  html += `<tr><td><b>지출 합계</b></td>${months.map(m => `<td class="num neg">-${fmt(m.expense)}</td>`).join('')}<td class="num neg">-${fmt(months.reduce((a, m) => a + m.expense, 0))}</td></tr>`;

  html += `</tbody><tfoot><tr><td>순현금흐름</td>${months.map(m => `<td class="num">${fmt(m.net)}</td>`).join('')}<td class="num">${fmt(months.reduce((a, m) => a + m.net, 0))}</td></tr></tfoot>`;

  table.innerHTML = html;

  // 연금수령한도 안내 배너
  const limitBanner = document.getElementById('pensionLimitBanner');
  const dcOver = yearResult.dcExcess > 1;
  const persOver = yearResult.personalExcess > 1;
  if (dcOver || persOver) {
    limitBanner.style.display = 'flex';
    limitBanner.className = 'target-banner short';
    const parts = [];
    if (dcOver) parts.push(`DC퇴직연금 한도 ${fmt(yearResult.dcLimit)}만원 대비 ${fmt(yearResult.dcExcess)}만원 초과(${yearResult.dcPensionYear}년차)`);
    if (persOver) parts.push(`개인연금 한도 ${fmt(yearResult.personalLimit)}만원 대비 ${fmt(yearResult.personalExcess)}만원 초과(${yearResult.personalPensionYear}년차)`);
    limitBanner.innerHTML = `<b>⚠ 연금수령한도 초과</b>&nbsp;— ${parts.join(' / ')} → 초과분은 감면 없는 세율(퇴직소득세 전체세율 또는 16.5% 기타소득세) 적용 중`;
  } else if (yearResult.dcPensionYear > 0 || yearResult.personalPensionYear > 0) {
    limitBanner.style.display = 'flex';
    limitBanner.className = 'target-banner ok';
    const dcTxt = yearResult.dcPensionYear > 0 ? `DC 한도 ${yearResult.dcLimit === Infinity ? '무제한(11년차+)' : fmt(yearResult.dcLimit) + '만원'}` : '';
    const persTxt = yearResult.personalPensionYear > 0 ? `개인연금 한도 ${yearResult.personalLimit === Infinity ? '무제한(11년차+)' : fmt(yearResult.personalLimit) + '만원'}` : '';
    limitBanner.innerHTML = `<b>연금수령한도 이내</b>&nbsp;— ${[dcTxt, persTxt].filter(Boolean).join(' / ')}`;
  } else {
    limitBanner.style.display = 'none';
  }

  // 목표소득 대비 안내 배너
}

function renderFootnote() {
  document.getElementById('footnote').innerHTML = `
    본 도구는 한국 세법·건강보험료 산정방식을 근사화한 추정치를 제공하며, 실제 신고·부과액과 차이가 있을 수 있습니다.
    좌측의 모든 금액·나이·기간·주택가격은 사용자별로 자유롭게 입력해 자신의 시나리오에 맞게 사용할 수 있도록 설계되어 있습니다(예시값은 참고용 기본값일 뿐입니다).
    재산세·종합부동산세 계산은 <b>1세대1주택자</b> 특례(재산세 공정시장가액비율 45%, 종부세 공정시장가액비율 60%·기본공제 12억원)를 기준으로 하며, 다주택자에는 적용되지 않습니다.
    주택 다운사이징은 <b>재산세·종합부동산세·건강보험 재산분에만 반영</b>됩니다. 매도 시 발생하는 양도차익·양도소득세는 1회성 거액이라 월별 현금흐름 왜곡을 피하기 위해 의도적으로 제외했습니다(다운사이징 연도부터 낮아진 공시가격 기준으로 세금·건보료만 계속 반영).
    건강보험료 재산분(지역가입자)은 <b>공시가격 → 재산세 과세표준(45%) → 기본공제 1억원(2024.2월 개정) → 재산등급 점수표(60등급) → 점수당 금액(211.5원, 2026년 기준)</b> 순으로 자동 계산됩니다. 1~14등급은 시행령상 확인된 정확한 구간이며, 그 이상 고액 구간은 보건복지부 공식 예시로 보정한 근사 곡선을 사용해 소폭 오차가 있을 수 있습니다. 주택담보대출 등 부채공제는 반영하지 않았습니다.
    건강보험료 소득분(지역가입자)은 <b>공적연금(국민연금)소득만 대상</b>이며 사적연금(DC퇴직연금·개인연금)은 제외됩니다. 소득세 종합/분리과세 선택과 무관하게 항상 반영되고, 연 336만원을 공제한 뒤 50%만 소득으로 인정(2024.9월 개편)해 보험료율을 곱합니다.
    건강보험료율은 2026년 확정치 기준입니다: 직장가입자 7.19%(본인부담 3.595%), 지역가입자 소득분 7.19%, 장기요양보험료 건보료의 13.14%.
    세율·공제율·건보료율은 2024~2026년 기준 세법을 반영했으며, 향후 법 개정 시 달라질 수 있습니다.
    재산세는 7월/9월, 종부세는 12월에 발생하는 것으로 가정해 월별로 배분했습니다.
    DC퇴직연금·개인연금은 계좌 잔고에서 매월 인출하며, 잔고에는 입력한 연 운용수익률이 매월 복리로 적용됩니다. 잔고가 소진되면 그 이후 월수령액은 0으로 자동 반영됩니다.
    인출 시 세금 성격이 다른 재원은 비례배분이 아니라 <b>법정 순서(소득세법 시행령 제40조의3)</b>대로 소진됩니다: DC퇴직연금은 원금(이연퇴직소득)이 먼저, 운용수익이 나중에 인출되며, 개인연금은 세액공제 받지 않은 원금(비과세)이 먼저, 세액공제받은 원금+운용수익이 나중에 인출됩니다.
    DC퇴직연금 원금(이연퇴직소득) 부분의 이연퇴직소득세 감면율은 연금 실제 수령연차 10년 이하 30%, 10년 초과 40%이며, 별도 입력 없이 수령연차에 따라 자동으로 전환 적용됩니다.
    한도이내 사적연금소득(DC 운용수익+개인연금 과세대상분, 국민연금 제외)이 연 1,500만원 이하면 연령별 저율(55~69세 5.5%/70~79세 4.4%/80세이상 3.3%)로 분리과세되지만, 1,500만원을 단 1원이라도 초과하면 이 저율 혜택이 수령액 전체에서 사라지고 전액을 기준으로 16.5% 분리과세와 종합과세(6.6~49.5%) 중 유리한 쪽을 선택합니다.
    종합소득세 계산 시 본인이 만 70세 이상인 해에는 <b>경로우대공제 100만원</b>이 인적공제(150만원×인원수)에 더해 자동 반영됩니다(배우자 등 다른 인적공제 대상자의 경로우대는 생년 정보가 없어 미반영).
    재취업 근로소득에 적용되는 <b>근로소득세액공제(총급여 구간별 연 20만~74만원)</b>는 월별 현금흐름에 미치는 영향이 작아 반영하지 않았습니다. 실제로는 재취업 기간 소득세가 이 금액만큼 더 낮아질 수 있습니다.
    각 입력 항목의 ⓘ 아이콘을 클릭하면 해당 항목의 상세 설명과 전제사항을 확인할 수 있습니다.
    정확한 세액·보험료는 세무사·국민건강보험공단·국민연금공단 상담을 통해 확인하시기 바랍니다.
    <div style="margin-top:10px;">© 2026 현수복. All rights reserved.</div>
  `;
}

// ------------------------------------------------------------
// 재계산 & 렌더 전체
// ------------------------------------------------------------
function recalc() {
  currentResults = runSimulation(state);
  if (!currentResults || currentResults.length === 0) {
    document.getElementById('kpiRow').innerHTML = '';
    document.getElementById('timeline').innerHTML = '';
    document.getElementById('monthlyTable').innerHTML = '';
    document.getElementById('monthlyTitle').textContent = '월별 현금흐름';
    document.getElementById('footnote').innerHTML =
      '<b style="color:var(--negative);">⚠ 시뮬레이션 시작연도가 종료연도보다 늦어 계산할 수 없습니다. 기본정보의 연도 설정을 확인해주세요.</b>';
    return;
  }
  renderTimeline(currentResults);
  renderKPI(currentResults);
  renderChart(currentResults);
  renderMonthlyTable(currentResults);
  renderFootnote();
}

document.getElementById('prevYear').onclick = () => {
  const idx = currentResults.findIndex(r => r.year === selectedYear);
  if (idx > 0) { selectedYear = currentResults[idx - 1].year; renderMonthlyTable(currentResults); }
};
document.getElementById('nextYear').onclick = () => {
  const idx = currentResults.findIndex(r => r.year === selectedYear);
  if (idx < currentResults.length - 1) { selectedYear = currentResults[idx + 1].year; renderMonthlyTable(currentResults); }
};
document.getElementById('yearSelect').onchange = (e) => {
  selectedYear = parseInt(e.target.value);
  renderMonthlyTable(currentResults);
};
window.addEventListener('resize', () => renderChart(currentResults));

// ------------------------------------------------------------
// 설정 저장 / 불러오기 (JSON)
// ------------------------------------------------------------
document.getElementById('btnSave').onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `retirement_sim_settings_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

document.getElementById('btnLoad').onclick = () => document.getElementById('fileLoad').click();
document.getElementById('fileLoad').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const loaded = JSON.parse(ev.target.result);
      Object.assign(state, loaded);
      renderSidebar();
      recalc();
      alert('설정을 불러왔습니다.');
    } catch (err) {
      alert('파일을 읽는 중 오류가 발생했습니다. 올바른 설정 파일인지 확인해주세요.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

// ------------------------------------------------------------
// 엑셀 다운로드 (SheetJS)
// ------------------------------------------------------------
document.getElementById('btnExcel').onclick = () => {
  if (!currentResults || currentResults.length === 0) {
    alert('시뮬레이션 결과가 없어 엑셀을 생성할 수 없습니다. 연도 설정을 확인해주세요.');
    return;
  }
  const rnd = (n) => Math.round(n || 0);
  const annualCols = [
    '연도', '나이', 'DC퇴직연금', '개인연금', '국민연금', '근로소득', '실업급여',
    '퇴직소득세', '종합/분리소득세', '한도초과세', '건강보험+장기요양', '건보가입유형',
    '재산세', '종부세', '총세금공과금', '총수입', '세후순수입',
    'DC잔고(연말)', '개인연금잔고(연말)'
  ];
  const annualRows = currentResults.map(r => [
    r.year, r.age, rnd(r.dcAnnual), rnd(r.personalAnnual), rnd(r.npsAnnual), rnd(r.earned), rnd(r.unemployment),
    rnd(r.taxRetire), rnd(r.taxIncome), rnd(r.excessOtherTax), rnd(r.nhisAnnual), r.nhisType,
    rnd(r.propTax), rnd(r.jongbu), rnd(r.totalTaxAll), rnd(r.grossIncome), rnd(r.netIncome),
    rnd(r.dcBalanceEnd), rnd(r.personalBalanceEnd)
  ]);
  const wsAnnual = XLSX.utils.aoa_to_sheet([annualCols, ...annualRows]);

  const monthlyCols = ['연도', '월', 'DC퇴직연금', '개인연금', '국민연금', '근로소득', '실업급여',
    '퇴직소득세', '종합소득세', '건강보험', '재산세', '종부세', '건보유형', '수입합계', '지출합계', '순현금흐름'];
  const series = buildFullMonthlySeries(currentResults, state);
  const monthlyRows = series.map(m => [
    m.year, m.month, rnd(m.dc), rnd(m.personal), rnd(m.nps), rnd(m.earned), rnd(m.unemployment),
    rnd(m.taxRetire), rnd(m.taxIncome), rnd(m.nhis), rnd(m.propTax), rnd(m.jongbu), m.nhisStatus,
    rnd(m.income), rnd(m.expense), rnd(m.net)
  ]);
  const wsMonthly = XLSX.utils.aoa_to_sheet([monthlyCols, ...monthlyRows]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsAnnual, '연도별 요약');
  XLSX.utils.book_append_sheet(wb, wsMonthly, '월별 현금흐름');
  XLSX.writeFile(wb, `retirement_simulation_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ------------------------------------------------------------
// 리포트 인쇄
// ------------------------------------------------------------
document.getElementById('btnReport').onclick = () => { buildReport(); window.print(); };

function buildReport() {
  const el = document.getElementById('reportView');
  if (!currentResults || currentResults.length === 0) {
    el.innerHTML = '<h1>은퇴자산 현금흐름 시뮬레이션 리포트</h1><p>시뮬레이션 시작연도가 종료연도보다 늦어 리포트를 생성할 수 없습니다. 기본정보의 연도 설정을 확인해주세요.</p>';
    return;
  }
  const totalTax = currentResults.reduce((s, r) => s + r.totalTaxAll, 0);
  const totalNet = currentResults.reduce((s, r) => s + r.netIncome, 0);
  const avgTax = totalTax / currentResults.length;
  const minNet = Math.min(...currentResults.map(r => r.netIncome));
  const minYear = currentResults.find(r => r.netIncome === minNet);
  const dcDep = currentResults.dcDepletedAt;
  const persDep = currentResults.personalDepletedAt;
  const dcLast = currentResults[currentResults.length - 1];

  const yn = (b) => b ? '반영' : '미반영';

  let html = `
    <h1>은퇴자산 현금흐름 시뮬레이션 리포트</h1>
    <div class="rp-sub">생성일: ${new Date().toLocaleDateString('ko-KR')} · 시뮬레이션 기간: ${currentResults[0].year}~${currentResults[currentResults.length - 1].year}년 (총 ${currentResults.length}개년, 만 ${currentResults[0].age}~${currentResults[currentResults.length - 1].age}세)</div>

    <div class="rp-section-title">1. 시뮬레이션 설정 정보</div>
    <table class="rp-settings">
      <tr><th colspan="4">기본 정보</th></tr>
      <tr><td>생년</td><td>${state.birthYear}년</td><td>인적공제 대상자</td><td>${state.dependents}명</td></tr>
      <tr><td>공시가격 기준연도</td><td>${state.baseYear}년</td><td>물가상승률</td><td>${state.inflation}%</td></tr>
      <tr><td>주택 공시가격(기준연도)</td><td>${fmt(state.gongsigaStart)}만원</td><td>시뮬레이션 구간</td><td>${state.startYear}~${state.endYear}년</td></tr>

      <tr><th colspan="4">DC 퇴직연금</th></tr>
      <tr><td>원금(회사입금분)</td><td>${fmt(state.dcPrincipal)}만원</td><td>운용수익</td><td>${fmt(state.dcGain)}만원</td></tr>
      <tr><td>수령개시</td><td>${state.dcStartYear}년 ${state.dcStartMonth}월</td><td>월 수령액(목표)</td><td>${fmt(state.dcMonthly)}만원</td></tr>
      <tr><td>연 운용수익률</td><td>${state.dcReturnRate}%</td><td>근속연수</td><td>${state.serviceYears}년 (이연퇴직소득세 감면율은 수령연차 10년초과 시점부터 자동 전환)</td></tr>

      <tr><th colspan="4">개인연금</th></tr>
      <tr><td>초기잔고</td><td>${fmt(state.personalBalance)}만원</td><td>그 중 세액공제 미적용 원금</td><td>${fmt(state.personalNonDeductiblePrincipal)}만원</td></tr>
      <tr><td>수령개시</td><td>${state.personalStartYear}년 ${state.personalStartMonth}월</td><td>월 수령액(목표)</td><td>${fmt(state.personalMonthly)}만원</td></tr>
      <tr><td>연 운용수익률</td><td>${state.personalReturnRate}%</td><td></td><td></td></tr>

      <tr><th colspan="4">국민연금</th></tr>
      <tr><td>반영 여부</td><td>${yn(state.npsEnabled)}</td><td>정상수령(만 ${npsNormalAge(state.birthYear)}세) 월 예상액</td><td>${fmt(state.npsNormal63)}만원</td></tr>
      <tr><td>조기(-)/연기(+) 연수</td><td colspan="3">${state.npsAdjustYears}년</td></tr>

      <tr><th colspan="4">재취업 · 실업급여</th></tr>
      <tr><td>재취업 반영</td><td>${yn(state.workEnabled)}</td><td>재취업 기간</td><td>${state.workEnabled ? `${state.workStartYear}.${state.workStartMonth} ~ ${state.workEndYear}.${state.workEndMonth}` : '-'}</td></tr>
      <tr><td>재취업 연봉</td><td>${fmt(state.workSalary)}만원</td><td>실업급여</td><td>${state.unempEnabled ? `${state.unempMonths}개월 × 월 ${fmt(state.unempMonthly)}만원` : '미반영'}</td></tr>

      <tr><th colspan="4">건강보험 · 주택</th></tr>
      <tr><td>임의계속가입 활용기간</td><td>${state.voluntaryMaxYears}년(재취업 1년↑ 시 자동적용)</td><td>다운사이징</td><td>${state.downsizeEnabled ? `${state.downsizeYear}년, 공시가 ${fmt(state.downsizeTargetGongsiga)}만원으로 조정` : '미반영'}</td></tr>
    </table>

    <div class="rp-section-title">2. 요약 (Executive Summary)</div>
    <table>
      <tr><th>기간 합계 총세금·공과금</th><td>${fmt(totalTax)}만원</td><th>연평균 세금·공과금</th><td>${fmt(avgTax)}만원</td></tr>
      <tr><th>기간 합계 세후순수입</th><td>${fmt(totalNet)}만원</td><th>순수입 최저 연도</th><td>${fmt(minNet)}만원 (${minYear ? minYear.year + '년, 만 ' + minYear.age + '세' : '-'})</td></tr>
      <tr><th>DC퇴직연금 소진 시점</th><td>${dcDep ? dcDep.year + '년 ' + dcDep.month + '월' : '미소진 (기간 내)'}</td><th>DC퇴직연금 기간말 잔고</th><td>${fmt(dcLast.dcBalanceEnd)}만원</td></tr>
      <tr><th>개인연금 소진 시점</th><td>${persDep ? persDep.year + '년 ' + persDep.month + '월' : '미소진 (기간 내)'}</td><th>개인연금 기간말 잔고</th><td>${fmt(dcLast.personalBalanceEnd)}만원</td></tr>
    </table>

    <div class="rp-section-title">3. 연도별 현금흐름 상세</div>
    <table>
      <tr><th>연도</th><th>나이</th><th>DC연금</th><th>개인연금</th><th>국민연금</th><th>근로소득</th><th>실업급여</th><th>퇴직소득세</th><th>종합/분리세</th><th>건보+장기요양</th><th>건보유형</th><th>재산세</th><th>종부세</th><th>총세금</th><th>총수입</th><th>세후순수입</th></tr>
      ${currentResults.map(r => `<tr>
        <td>${r.year}</td><td>${r.age}</td><td>${fmt(r.dcAnnual)}</td><td>${fmt(r.personalAnnual)}</td><td>${fmt(r.npsAnnual)}</td>
        <td>${fmt(r.earned)}</td><td>${fmt(r.unemployment)}</td><td>${fmt(r.taxRetire)}</td><td>${fmt(r.taxIncome)}</td>
        <td>${fmt(r.nhisAnnual)}</td><td>${r.nhisType}</td><td>${fmt(r.propTax)}</td><td>${fmt(r.jongbu)}</td>
        <td>${fmt(r.totalTaxAll)}</td><td>${fmt(r.grossIncome)}</td><td>${fmt(r.netIncome)}</td>
      </tr>`).join('')}
      <tr style="font-weight:700;background:#f0f0ea;">
        <td colspan="2">합계</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.dcAnnual, 0))}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.personalAnnual, 0))}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.npsAnnual, 0))}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.earned, 0))}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.unemployment, 0))}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.taxRetire, 0))}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.taxIncome, 0))}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.nhisAnnual, 0))}</td>
        <td>-</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.propTax, 0))}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.jongbu, 0))}</td>
        <td>${fmt(totalTax)}</td>
        <td>${fmt(currentResults.reduce((s, r) => s + r.grossIncome, 0))}</td>
        <td>${fmt(totalNet)}</td>
      </tr>
    </table>

    <div class="rp-section-title">4. 전제조건 및 유의사항</div>
    <div class="rp-assumptions">
      <div>본 시뮬레이션은 한국 세법·건강보험료 산정방식을 근사화한 추정치이며, 실제 신고·부과액과 차이가 있을 수 있습니다.</div>
      <div>재산세·종합부동산세 계산은 1세대1주택자 특례(재산세 공정시장가액비율 45%, 종부세 공정시장가액비율 60%·기본공제 12억원)를 기준으로 하며, 다주택자에는 적용되지 않습니다.</div>
      <div>건강보험료 재산분(지역가입자)은 공시가격 → 재산세 과세표준(45%) → 기본공제 1억원(2024.2월 개정) → 재산등급 점수표(60등급) → 점수당 금액(211.5원, 2026년 기준) 순으로 자동 계산됩니다.</div>
      <div>건강보험료 소득분(지역가입자)은 공적연금(국민연금)소득만 대상이며 사적연금은 제외됩니다. 소득세 종합/분리과세 선택과 무관하게 항상 반영되고, 연 336만원 공제 후 50%만 소득으로 인정(2024.9월 개편)해 보험료율을 곱합니다.</div>
      <div>건강보험료율은 2026년 확정치 기준입니다: 직장가입자 7.19%(본인부담 3.595%), 지역가입자 소득분 7.19%, 장기요양보험료 건보료의 13.14%.</div>
      <div>연금수령한도(연초잔고÷(11-연금수령연차)×120%) 초과분은 감면 없는 세율(퇴직소득세 전체세율 또는 16.5% 기타소득세)이 적용됩니다.</div>
      <div>주택 다운사이징은 재산세·종합부동산세·건강보험 재산분에만 반영되며, 양도차익·양도소득세는 1회성 거액이라 현금흐름에서 제외했습니다.</div>
      <div>DC퇴직연금·개인연금은 계좌 잔고에서 매월 인출 후 남은 잔액에 운용수익률이 복리로 적용되며, 잔고 소진 시 이후 수령액은 0으로 반영됩니다.</div>
      <div>인출 재원은 비례배분이 아니라 법정 순서(소득세법 시행령 제40조의3)대로 소진됩니다: DC퇴직연금은 원금(이연퇴직소득)이 먼저·운용수익이 나중, 개인연금은 세액공제 받지 않은 원금(비과세)이 먼저·세액공제받은 원금+운용수익이 나중입니다.</div>
      <div>DC퇴직연금 원금(이연퇴직소득) 부분의 이연퇴직소득세 감면율은 연금 실제 수령연차 10년 이하 30%, 10년 초과 40%이며, 수령연차에 따라 자동 전환 적용됩니다.</div>
      <div>한도이내 사적연금소득(DC 운용수익+개인연금 과세대상분, 국민연금 제외)이 연 1,500만원 이하면 연령별 저율(55~69세 5.5%/70~79세 4.4%/80세이상 3.3%), 초과하면 전액 16.5%로 분리과세한 세액과 종합과세 세액 중 낮은 쪽이 자동 적용됩니다.</div>
      <div>종합소득세 계산 시 본인이 만 70세 이상인 해에는 경로우대공제 100만원이 인적공제에 더해 자동 반영됩니다(다른 인적공제 대상자의 경로우대는 생년 정보가 없어 미반영).</div>
      <div>재취업 근로소득에 적용되는 근로소득세액공제(총급여 구간별 연 20만~74만원)는 월별 현금흐름에 미치는 영향이 작아 반영하지 않았습니다. 실제로는 재취업 기간 소득세가 이 금액만큼 더 낮아질 수 있습니다.</div>
      <div>실업급여(구직급여) 최대 수령기간은 법정 270일(9개월) 기준입니다.</div>
      <div>정확한 세액·보험료는 세무사·국민건강보험공단·국민연금공단 상담을 통해 최종 확인하시기 바랍니다. 월별 상세 현금흐름은 엑셀 다운로드 기능으로 확인할 수 있습니다.</div>
    </div>
    <div style="margin-top:20px;padding-top:10px;border-top:1px solid #ccc;font-size:11px;color:#555;">© 2026 현수복. All rights reserved.</div>
  `;
  el.innerHTML = html;
}

renderSidebar();
recalc();
