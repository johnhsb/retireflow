// ============================================================
// 은퇴자산 현금흐름 시뮬레이터 - 계산 엔진
// 모든 금액 단위: 만원 (10,000 KRW)
// ============================================================

function pensionIncomeDeduction(x) {
  if (x <= 350) return x;
  if (x <= 700) return 350 + (x - 350) * 0.4;
  if (x <= 1400) return 490 + (x - 700) * 0.2;
  return Math.min(900, 630 + (x - 1400) * 0.1); // 근거: 소득세법 제47조의2 — 연금소득공제 한도 900만원
}

function earnedIncomeDeduction(x) {
  if (x <= 0) return 0;
  if (x <= 500) return x * 0.7;
  if (x <= 1500) return 350 + (x - 500) * 0.4;
  if (x <= 4500) return 950 + (x - 1500) * 0.15;
  if (x <= 10000) return 1425 + (x - 4500) * 0.05;
  return 1725 + (x - 10000) * 0.02;
}

function globalTax(base) {
  if (base <= 0) return 0;
  if (base <= 1400) return base * 0.06;
  if (base <= 5000) return base * 0.15 - 126;
  if (base <= 8800) return base * 0.24 - 576;
  if (base <= 15000) return base * 0.35 - 1544;
  if (base <= 30000) return base * 0.38 - 1994;
  if (base <= 50000) return base * 0.40 - 2594;
  if (base <= 100000) return base * 0.42 - 3594;
  return base * 0.45 - 6594; // 근거: 소득세법 제55조 — 과세표준 10억원 초과 구간(45%, 누진공제 6,594만원)
}

function propertyTaxCalc(gongsiga, fairRatio) {
  const base = gongsiga * fairRatio;
  let prop;
  if (base <= 6000) prop = base * 0.001;
  else if (base <= 15000) prop = 6 + (base - 6000) * 0.0015;
  else if (base <= 30000) prop = 19.5 + (base - 15000) * 0.0025;
  else prop = 63 + (base - 30000) * 0.004;
  const city = base * 0.0014;
  const edu = prop * 0.2;
  return { prop, city, edu, total: prop + city + edu };
}

// 근거: 소득세법 시행령 [별표3] 근속연수공제
function serviceDeduction(years) {
  if (years <= 5) return years * 100;
  if (years <= 10) return 500 + (years - 5) * 200;
  if (years <= 20) return 1500 + (years - 10) * 250;
  return 4000 + (years - 20) * 300;
}

// ------------------------------------------------------------
// 국민연금 노령연금 정상수령(지급개시) 연령 — 출생연도별 단계적 상향
// 근거: 국민연금법 부칙(법률 제15267호) 제8조 — 1953년생부터 5년 단위로 1세씩 상향, 2033년 65세로 완성
// ------------------------------------------------------------
function npsNormalAge(birthYear) {
  if (birthYear <= 1952) return 60;
  if (birthYear <= 1956) return 61;
  if (birthYear <= 1960) return 62;
  if (birthYear <= 1964) return 63;
  if (birthYear <= 1968) return 64;
  return 65;
}

// ------------------------------------------------------------
// 건강보험 지역가입자 재산보험료 부과점수표 (국민건강보험법 시행령 별표4, 1~14등급 확인된 구간)
// x: 재산보험료 부과표준(만원) = 재산세 과세표준 - 기본공제(1억원, 2024.2월 개정)
// 14등급(6,930만원) 초과 구간은 보건복지부 공식 예시(재산과표 1.1억원=11,000만원 -> 465점, 19등급)로
// 보정한 로그 근사 곡선을 사용합니다 (고액 구간일수록 실제 등급표와 다소 오차가 있을 수 있음)
// ------------------------------------------------------------
const PROPERTY_SCORE_TABLE = [
  [450, 22], [900, 44], [1350, 66], [1800, 97], [2250, 122], [2700, 146],
  [3150, 171], [3600, 195], [4050, 219], [4500, 244], [5020, 268], [5590, 294],
  [6220, 320], [6930, 344]
];
function propertyScore(x) {
  if (x <= 0) return 0;
  for (const [upper, score] of PROPERTY_SCORE_TABLE) {
    if (x <= upper) return score;
  }
  // 고액구간 로그 근사 (앵커: 6,930만원=344점 실측, 11,000만원=465점 정부예시)
  const b = (465 - 344) / (Math.log(11000) - Math.log(6930));
  const a = 344 - b * Math.log(6930);
  return a + b * Math.log(x);
}
// 월 재산보험료(만원) 자동계산: 공시가격 -> 재산세 과세표준 -> 기본공제 -> 점수 -> 점수당금액
function propertyInsurancePremium(gongsiga, fairRatio) {
  const propTaxBase = gongsiga * fairRatio;
  const nhisBase = Math.max(0, propTaxBase - 10000); // 기본공제 1억원 (2024.2월 개정, 주택부채공제는 별도 미반영)
  const POINT_VALUE_WON = 211.5; // 2026년 기준 점수당 금액(원)
  const score = propertyScore(nhisBase);
  return score * POINT_VALUE_WON / 10000; // 만원 단위로 환산
}

function retirementEffectiveRate(principal, years, pensionYearsOver10) {
  if (!years || years <= 0 || !principal || principal <= 0) return { full: 0, reduced: 0 };
  const svcDed = serviceDeduction(years);
  const hwansan = Math.max(0, (principal - svcDed)) * 12 / years;
  // 근거: 소득세법 시행령 제42조의3(환산급여공제)
  let hwansanDed;
  if (hwansan <= 800) hwansanDed = hwansan;
  else if (hwansan <= 7000) hwansanDed = 800 + (hwansan - 800) * 0.6;
  else if (hwansan <= 10000) hwansanDed = 4520 + (hwansan - 7000) * 0.55;
  else if (hwansan <= 30000) hwansanDed = 6170 + (hwansan - 10000) * 0.45;
  else hwansanDed = 15170 + (hwansan - 30000) * 0.35;
  const taxBase = Math.max(0, hwansan - hwansanDed);
  const hwansanTax = globalTax(taxBase);
  const finalTax = hwansanTax * years / 12;
  const fullRate = principal > 0 ? finalTax / principal : 0;
  const reduction = pensionYearsOver10 ? 0.6 : 0.7; // 실제 납부비율(=100%-감면율). 수령연차 10년 이하 70%납부(30%감면), 10년초과 60%납부(40%감면)
  return { full: fullRate, reduced: fullRate * reduction };
}

// ------------------------------------------------------------
// 연금수령한도 = 연금계좌 평가액(연초) / (11 - 연금수령연차) x 120%
// 연금수령연차 11년차 이상은 한도 없음(무제한)
// ------------------------------------------------------------
function pensionWithdrawalLimit(balanceAtYearStart, pensionYear) {
  if (pensionYear <= 0) return 0; // 아직 개시 전
  if (pensionYear >= 11) return Infinity;
  const denom = 11 - pensionYear;
  return (balanceAtYearStart / denom) * 1.2;
}

function midx(year, month) { return year * 12 + (month - 1); }

function referenceEndIdx(params) {
  if (params.workEnabled) return midx(params.workEndYear, params.workEndMonth);
  return midx(params.baseYear, 12);
}

function isEmployedMonth(year, month, params) {
  if (!params.workEnabled) return false;
  const idx = midx(year, month);
  const s = midx(params.workStartYear, params.workStartMonth);
  const e = midx(params.workEndYear, params.workEndMonth);
  return idx >= s && idx <= e;
}

function employmentDurationMonths(params) {
  if (!params.workEnabled) return 0;
  const s = midx(params.workStartYear, params.workStartMonth);
  const e = midx(params.workEndYear, params.workEndMonth);
  return Math.max(0, e - s + 1);
}

// 임의계속가입 자격: 재취업 기간이 1년(12개월) 이상이었던 경우에만 자동 적용 (수동 on/off 없음, 실제 제도 요건 반영)
function isVoluntaryMonth(year, month, params) {
  if (!params.workEnabled) return false;
  if (employmentDurationMonths(params) < 12) return false;
  const idx = midx(year, month);
  const endIdx = referenceEndIdx(params);
  const voluntaryEndIdx = endIdx + params.voluntaryMaxYears * 12;
  return idx > endIdx && idx <= voluntaryEndIdx;
}

function isUnemploymentMonth(year, month, params) {
  if (!params.unempEnabled) return false;
  const idx = midx(year, month);
  const endIdx = referenceEndIdx(params);
  return idx > endIdx && idx <= endIdx + params.unempMonths;
}

// ------------------------------------------------------------
// 연금계좌 잔고 12개월 인출 시뮬레이션
// balanceStart: 해당연도 1월 시작 시점 잔고
// monthlyTargets: 12개월 각각의 인출 희망액 배열(개시 전 월은 0)
// annualReturnRate: 연 운용수익률(%)
// 매월: 잔고에 월복리 수익 적용 -> 인출(잔고 한도 내) -> 잔고 차감
// ------------------------------------------------------------
function walkAccount(balanceStart, monthlyTargets, annualReturnRate) {
  const monthlyReturn = Math.pow(1 + (annualReturnRate || 0) / 100, 1 / 12) - 1;
  let balance = Math.max(0, balanceStart);
  const monthlyActual = [];
  let depletedMonth = null; // 0~11, 그 달에 목표액을 다 못 채웠으면 기록
  for (let m = 0; m < 12; m++) {
    const target = monthlyTargets[m];
    const actual = Math.min(target, Math.max(0, balance));
    balance -= actual;                 // 1) 먼저 인출
    balance *= (1 + monthlyReturn);    // 2) 인출 후 남은 잔액에만 그 달 수익률 적용
    monthlyActual.push(actual);
    if (depletedMonth === null && target > 0 && actual < target - 1e-6) depletedMonth = m;
  }
  return {
    monthlyActual,
    balanceEnd: Math.max(0, balance),
    annualActual: monthlyActual.reduce((a, b) => a + b, 0),
    depletedMonth
  };
}

// 특정 연도의 12개월 중 개시일(startYear/startMonth) 이후부터 amount, 이전은 0
function buildStartGatedTargets(year, startYear, startMonth, amount) {
  const startIdx = midx(startYear || year, startMonth || 1);
  const arr = [];
  for (let m = 1; m <= 12; m++) arr.push(midx(year, m) >= startIdx ? amount : 0);
  return arr;
}

// ------------------------------------------------------------
// 계좌 내 재원(tier)별 인출 배분 (소득세법 시행령 제40조의3 인출순서)
// tierStarts: 인출 우선순위 순서(앞부터 먼저 소진)의 연초 잔고 배열
// walk: walkAccount()로 계산된 총액 기준 결과(annualActual, balanceEnd) — 인출 가능액 자체는 그대로 사용
// limit: 해당 연도 연금수령한도(Infinity 가능)
// limitedFromIndex: 이 인덱스 이상인 tier부터 한도 적용대상(그 이전 tier는 비과세·한도무관, 예: 세액공제 안 받은 원금)
// 운용손익은 인출 역순(마지막 tier부터)으로 흡수 — 손실도 마지막 tier가 먼저 부담
// ------------------------------------------------------------
function allocateTiers(tierStarts, walk, limit, limitedFromIndex) {
  const totalStart = tierStarts.reduce((a, b) => a + b, 0);
  const annualActual = walk.annualActual;

  let remaining = annualActual;
  const withdrawn = tierStarts.map(() => 0);
  for (let i = 0; i < tierStarts.length; i++) {
    const take = Math.min(remaining, tierStarts[i]);
    withdrawn[i] = take;
    remaining -= take;
    if (remaining <= 1e-9) break;
  }

  const totalReturn = walk.balanceEnd - (totalStart - annualActual);
  const tierEnds = tierStarts.map((s, i) => s - withdrawn[i]);
  let retLeft = totalReturn;
  for (let i = tierEnds.length - 1; i >= 0 && retLeft !== 0; i--) {
    const newVal = tierEnds[i] + retLeft;
    if (newVal < 0) { retLeft = newVal; tierEnds[i] = 0; }
    else { tierEnds[i] = newVal; retLeft = 0; }
  }

  let limitLeft = limit;
  const within = tierStarts.map(() => 0);
  const excess = tierStarts.map(() => 0);
  tierStarts.forEach((_, i) => {
    if (i < limitedFromIndex) { within[i] = withdrawn[i]; return; }
    const w = Math.min(withdrawn[i], Math.max(0, limitLeft));
    within[i] = w;
    excess[i] = withdrawn[i] - w;
    limitLeft -= w;
  });

  return { withdrawn, tierEnds, within, excess };
}

// ------------------------------------------------------------
// 연도 단위 계산
// dcPrincipalStart/dcGainStart, personalNonDeductibleStart/personalTaxableStart:
// 해당 연도 1월 시작 시점 재원별(tier) 잔고 (연도간 이어짐)
// ------------------------------------------------------------
function calcYear(year, params, dcPrincipalStart, dcGainStart, personalNonDeductibleStart, personalTaxableStart) {
  const age = year - params.birthYear;
  const infl = params.inflation / 100;

  // ---- DC퇴직연금 잔고 인출 시뮬레이션 (개시 연/월 반영) ----
  const dcTargets = buildStartGatedTargets(year, params.dcStartYear, params.dcStartMonth, params.dcMonthly);
  const dcBalanceStart = dcPrincipalStart + dcGainStart;
  const dcWalk = walkAccount(dcBalanceStart, dcTargets, params.dcReturnRate);
  const dcAnnual = dcWalk.annualActual;

  // 연금수령한도 (DC퇴직연금): 한도 = 연초잔고/(11-연금수령연차) x 120%
  const dcPensionYear = (year >= params.dcStartYear) ? (year - params.dcStartYear + 1) : 0;
  const dcLimit = pensionWithdrawalLimit(dcBalanceStart, dcPensionYear);

  // 인출순서: 이연퇴직소득(원금) 먼저 소진 -> 운용수익 나중 (비례배분 아님, 소득세법 시행령 제40조의3)
  const dcAlloc = allocateTiers([dcPrincipalStart, dcGainStart], dcWalk, dcLimit, 0);
  const dcPrincipalBalanceEnd = dcAlloc.tierEnds[0];
  const dcGainBalanceEnd = dcAlloc.tierEnds[1];
  const dcExcess = dcAlloc.excess[0] + dcAlloc.excess[1];
  const principalPart = dcAlloc.within[0];      // 한도이내 원금: 이연퇴직소득세 감면세율 적용대상
  const gainPart = dcAlloc.within[1];           // 한도이내 운용수익: 연금소득세(종합/분리) 대상
  const dcExcessPrincipal = dcAlloc.excess[0];  // 한도초과 원금: 감면 없는 전체 퇴직소득세율
  const dcExcessGain = dcAlloc.excess[1];       // 한도초과 운용수익: 16.5% 기타소득세

  // ---- 개인연금 잔고 인출 시뮬레이션 (개시 연/월 + 목표충당 추가인출 반영) ----
  const personalMonthlyTarget = params.personalMonthly;
  const personalTargets = buildStartGatedTargets(year, params.personalStartYear, params.personalStartMonth, personalMonthlyTarget);
  const personalBalanceStart = personalNonDeductibleStart + personalTaxableStart;
  const personalWalk = walkAccount(personalBalanceStart, personalTargets, params.personalReturnRate);
  const personalAnnual = personalWalk.annualActual;

  // 연금수령한도 (개인연금저축)
  const personalPensionYear = (year >= params.personalStartYear) ? (year - params.personalStartYear + 1) : 0;
  const personalLimit = pensionWithdrawalLimit(personalBalanceStart, personalPensionYear);

  // 인출순서: 세액공제 받지 않은 원금(비과세, 한도 미적용) 먼저 -> 세액공제받은 원금+운용수익(한도 적용) 나중
  const personalAlloc = allocateTiers([personalNonDeductibleStart, personalTaxableStart], personalWalk, personalLimit, 1);
  const personalNonDeductibleBalanceEnd = personalAlloc.tierEnds[0];
  const personalTaxableBalanceEnd = personalAlloc.tierEnds[1];
  const personalExcess = personalAlloc.excess[1];       // 비과세 tier(index 0)는 한도 미적용이라 항상 excess 0
  const personalWithinLimit = personalAlloc.within[1];  // 한도이내분만 정상 연금소득세/종합과세 판단 대상

  // ---- 국민연금 (조기수령 -5~0 / 연기수령 0~+5, 출생연도별 정상수령연령 기준) ----
  let npsMonthlyFull = 0;
  const npsAdjustYears = params.npsAdjustYears || 0;
  const npsNormAge = npsNormalAge(params.birthYear);
  const npsStartAge = npsNormAge + npsAdjustYears;
  if (params.npsEnabled && age >= npsStartAge) {
    const yrsSinceStart = age - npsStartAge;
    const adjustFactor = npsAdjustYears >= 0
      ? 1 + 0.072 * npsAdjustYears   // 연기수령: 연 7.2% 가산
      : 1 - 0.06 * Math.abs(npsAdjustYears); // 조기수령: 연 6% 감액
    const npsBase = params.npsNormal63 * Math.max(0, adjustFactor);
    npsMonthlyFull = npsBase * Math.pow(1 + infl, yrsSinceStart);
  }
  // 조기노령연금 지급정지: 정상수령나이 도달 전(조기수령 중)에 소득 있는 업무(재취업)에 종사하는 달은 국민연금 전액 지급정지
  // 근거: 국민연금법 제63조 — 정상수령나이 이후의 소득활동에 따른 감액(제63조의2, 최대 50%)은 별도이며 미반영
  const npsEarlySuspendApplies = npsAdjustYears < 0 && age < npsNormAge;

  const monthlyWage = params.workEnabled ? params.workSalary / 12 : 0;
  let earnedAnnual = 0, unemploymentAnnual = 0, npsAnnual = 0;
  const monthStatus = [];
  const monthEarned = [];
  const monthUnemp = [];
  const monthNps = [];
  for (let m = 1; m <= 12; m++) {
    const employed = isEmployedMonth(year, m, params);
    const voluntary = isVoluntaryMonth(year, m, params);
    const unemp = isUnemploymentMonth(year, m, params);
    const e = employed ? params.workSalary / 12 : 0;
    const u = unemp ? params.unempMonthly : 0;
    const n = (npsEarlySuspendApplies && employed) ? 0 : npsMonthlyFull;
    monthEarned.push(e);
    monthUnemp.push(u);
    monthNps.push(n);
    monthStatus.push(employed ? 'work' : (voluntary ? 'voluntary' : 'region'));
    earnedAnnual += e;
    unemploymentAnnual += u;
    npsAnnual += n;
  }
  const isWorking = earnedAnnual > 0;

  const effRateObj = retirementEffectiveRate(params.dcPrincipal, params.serviceYears, dcPensionYear > 10);
  const taxRetire = principalPart * effRateObj.reduced + dcExcessPrincipal * effRateObj.full;
  const taxRetireLocal = taxRetire * 0.1;

  // 연금수령한도 초과분(운용수익분+개인연금분) - 16.5% 기타소득세(분리과세, 종합/분리 선택대상 아님)
  const excessOtherBase = dcExcessGain + personalExcess;
  const excessOtherTax = excessOtherBase * 0.165;
  const excessOtherTaxLocal = excessOtherTax * 0.1;

  // 한도이내 사적연금(퇴직연금 운용수익+개인연금, 국민연금 등 공적연금 제외)만 1500만원 판정·분리과세 선택 대상
  const privatePensionTotal = gainPart + personalWithinLimit;
  const privateTotal = privatePensionTotal + npsAnnual; // 종합과세 전액 선택 시에는 공적+사적 합산
  const ded = pensionIncomeDeduction(privateTotal);
  const pensionIncome = Math.max(0, privateTotal - ded);

  const earnedDed = earnedIncomeDeduction(earnedAnnual);
  const earnedIncome = Math.max(0, earnedAnnual - earnedDed);

  const combinedBase = Math.max(0, pensionIncome + earnedIncome - 150 * params.dependents);
  const taxGlobalAll = globalTax(combinedBase);

  // 사적연금 분리과세 대안세율: 1500만원 이하 확정기간형 기준 연령별 저율(55~69세 5.5%, 70~79세 4.4%, 80세이상 3.3%),
  // 1500만원 초과분은 16.5%(2023년 개정, 지방세 포함)
  const sepRate = privatePensionTotal <= 1500
    ? (age >= 80 ? 0.033 : age >= 70 ? 0.044 : 0.055)
    : 0.165;
  const sepTax = privatePensionTotal * sepRate;

  // 분리과세 선택 시에도 국민연금(공적연금)은 항상 종합과세 대상이라 근로소득과 합산
  const npsDed = pensionIncomeDeduction(npsAnnual);
  const npsIncome = Math.max(0, npsAnnual - npsDed);
  const altGlobalBase = Math.max(0, npsIncome + earnedIncome - 150 * params.dependents);
  const taxAlt = globalTax(altGlobalBase) + sepTax;

  const chosenGlobal = taxGlobalAll <= taxAlt;
  const taxIncomeFinal = chosenGlobal ? taxGlobalAll : taxAlt;
  const taxIncomeLocal = taxIncomeFinal * 0.1;
  const totalIncomeTax = taxRetire + taxRetireLocal + taxIncomeFinal + taxIncomeLocal + excessOtherTax + excessOtherTaxLocal;

  let gongsiga;
  if (params.downsizeEnabled && year >= params.downsizeYear) {
    gongsiga = params.downsizeTargetGongsiga * Math.pow(1 + infl, year - params.downsizeYear);
  } else {
    gongsiga = params.gongsigaStart * Math.pow(1 + infl, year - params.baseYear);
  }

  // 건강보험료 지역가입자 소득보험료: 부과대상 연금소득은 공적연금(국민연금)만 해당하고 사적연금(DC운용수익·개인연금)은 제외되며,
  // 소득세 종합/분리과세 선택과 무관하게 항상 반영됨. 연금소득공제 적용 전 총액 기준, 2024.9월 개편으로 반영비율 50%
  // 근거: 국민건강보험법 시행령 제41조 [별표3]
  const nhisPensionBase = npsAnnual * 0.5;
  const incomeForNhis = Math.max(0, nhisPensionBase - 336);
  const monthlyIncomePremium = incomeForNhis / 12 * 0.0719; // 2026년 건강보험료율 7.19%
  const approxPropertyPremium = propertyInsurancePremium(gongsiga, 0.45);
  const regionMonthTotal = (monthlyIncomePremium + approxPropertyPremium) * 1.1314; // 장기요양 13.14%
  const workMonthTotal = (monthlyWage * 0.03595) * 1.1314; // 직장가입자 본인부담 3.595%(=7.19%/2)

  const monthNhis = monthStatus.map(s => (s === 'work' || s === 'voluntary') ? workMonthTotal : regionMonthTotal);
  const nhisAnnual = monthNhis.reduce((a, b) => a + b, 0);

  const counts = { work: 0, voluntary: 0, region: 0 };
  monthStatus.forEach(s => counts[s]++);
  const nhisType = { work: '직장', voluntary: '임의계속', region: '지역' }[
    Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b)
  ];

  const propTax = propertyTaxCalc(gongsiga, 0.45);
  const jongbuThreshold = 120000; // 12억원 — 2023.1.1 이후 1세대1주택자 종부세 기본공제(구법 11억원에서 상향)
  const jongbu = gongsiga <= jongbuThreshold ? 0 : (gongsiga - jongbuThreshold) * 0.6 * 0.006; // 종부세 공정시장가액비율 60%(재산세 1주택 특례 45%와는 별개 값)

  const isSaleYear = params.downsizeEnabled && year === params.downsizeYear; // 참고용 플래그(현금흐름에는 미반영)

  const totalTaxAll = totalIncomeTax + nhisAnnual + propTax.total + jongbu;
  const grossIncome = dcAnnual + personalAnnual + npsAnnual + earnedAnnual + unemploymentAnnual;
  const netIncome = grossIncome - totalTaxAll;

  return {
    year, age,
    dcAnnual, personalAnnual, npsAnnual, earned: earnedAnnual, unemployment: unemploymentAnnual,
    principalPart, gainPart,
    taxRetire: taxRetire + taxRetireLocal,
    taxIncome: taxIncomeFinal + taxIncomeLocal,
    excessOtherTax: excessOtherTax + excessOtherTaxLocal,
    dcLimit, dcExcess, personalLimit, personalExcess, dcPensionYear, personalPensionYear,
    chosenGlobal,
    nhisAnnual, nhisType,
    propTax: propTax.total, jongbu,
    gongsiga,
    isWorking, isVoluntary: nhisType === '임의계속', isSaleYear,
    totalTaxAll, grossIncome, netIncome,
    dcPrincipalBalanceEnd, dcGainBalanceEnd, personalNonDeductibleBalanceEnd, personalTaxableBalanceEnd,
    dcBalanceEnd: dcPrincipalBalanceEnd + dcGainBalanceEnd,
    personalBalanceEnd: personalNonDeductibleBalanceEnd + personalTaxableBalanceEnd,
    dcDepletedMonth: dcWalk.depletedMonth, personalDepletedMonth: personalWalk.depletedMonth,
    _monthStatus: monthStatus, _monthEarned: monthEarned, _monthUnemp: monthUnemp, _monthNhis: monthNhis,
    _monthDc: dcWalk.monthlyActual, _monthPersonal: personalWalk.monthlyActual, _monthNps: monthNps
  };
}

// 전체 기간 연도별 시뮬레이션 (재원별 잔고를 연도 간 이어서 추적)
function runSimulation(params) {
  const results = [];
  let dcPrincipalBalance = Math.max(0, params.dcPrincipal || 0);
  let dcGainBalance = Math.max(0, params.dcGain || 0);
  const personalTotalStart = Math.max(0, params.personalBalance || 0);
  let personalNonDeductibleBalance = Math.min(Math.max(0, params.personalNonDeductiblePrincipal || 0), personalTotalStart);
  let personalTaxableBalance = personalTotalStart - personalNonDeductibleBalance;
  let dcDepletedAt = null, personalDepletedAt = null;

  for (let year = params.startYear; year <= params.endYear; year++) {
    const r = calcYear(year, params, dcPrincipalBalance, dcGainBalance, personalNonDeductibleBalance, personalTaxableBalance);

    if (dcDepletedAt === null && r.dcDepletedMonth !== null) dcDepletedAt = { year, month: r.dcDepletedMonth + 1 };
    if (personalDepletedAt === null && r.personalDepletedMonth !== null) personalDepletedAt = { year, month: r.personalDepletedMonth + 1 };

    dcPrincipalBalance = r.dcPrincipalBalanceEnd;
    dcGainBalance = r.dcGainBalanceEnd;
    personalNonDeductibleBalance = r.personalNonDeductibleBalanceEnd;
    personalTaxableBalance = r.personalTaxableBalanceEnd;
    results.push(r);
  }
  results.dcDepletedAt = dcDepletedAt;
  results.personalDepletedAt = personalDepletedAt;
  return results;
}

function buildMonthly(yearResult, params) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push({
      month: m,
      dc: yearResult._monthDc[m - 1],
      personal: yearResult._monthPersonal[m - 1],
      nps: yearResult._monthNps[m - 1],
      earned: yearResult._monthEarned[m - 1],
      unemployment: yearResult._monthUnemp[m - 1],
      taxRetire: yearResult.taxRetire / 12,
      taxIncome: yearResult.taxIncome / 12,
      nhis: yearResult._monthNhis[m - 1],
      nhisStatus: yearResult._monthStatus[m - 1],
      propTax: 0,
      jongbu: 0
    });
  }
  if (yearResult.propTax > 0) {
    months[6].propTax = yearResult.propTax * 0.5;
    months[8].propTax = yearResult.propTax * 0.5;
  }
  if (yearResult.jongbu > 0) months[11].jongbu = yearResult.jongbu;
  return months.map(r => {
    const income = r.dc + r.personal + r.nps + r.earned + r.unemployment;
    const expense = r.taxRetire + r.taxIncome + r.nhis + r.propTax + r.jongbu;
    return Object.assign(r, { income, expense, net: income - expense });
  });
}

function buildFullMonthlySeries(results, params) {
  const series = [];
  results.forEach(r => {
    const months = buildMonthly(r, params);
    months.forEach(m => series.push(Object.assign({ year: r.year }, m)));
  });
  return series;
}
