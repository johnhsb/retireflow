# 은퇴자산 현금흐름 시뮬레이터

한국 세법·건강보험료 산정방식을 반영한 은퇴 후 월별 현금흐름 시뮬레이션 도구입니다.
브라우저에서 바로 열리는 독립형 HTML/JavaScript 애플리케이션입니다.
모든 계산은 브라우저 안에서만 처리되며, 입력한 정보는 외부 서버로 전송되거나 저장되지 않습니다.

## 기능
- DC퇴직연금 · 개인연금 (계좌 잔고·운용수익률·수령한도·소진시점 반영)
- 국민연금 (조기/연기수령)
- 재취업 · 실업급여 (연/월 단위 정밀 반영)
- 건강보험료 (직장/지역/임의계속가입 자동 전환, 재산분 자동계산)
- 재산세 · 종합부동산세 · 주택 다운사이징 · 주택연금(역모기지)
- 월별 현금흐름 차트 및 상세 테이블
- 설정 저장/불러오기(JSON), 엑셀 다운로드, 인쇄용 리포트

## 온라인에서 바로 사용하기
- https://johnhsb.github.io/retireflow/

## 사용 방법
`retirement_simulator_bundled.html` 파일을 브라우저로 열면 바로 사용할 수 있습니다.
(`index.html`, `engine.js`, `ui.js`를 함께 두고 index.html을 열어도 동일하게 동작합니다.)

파일을 내려받으려면 아래 raw 링크를 우클릭(모바일은 길게 누르기) 후 "다른 이름으로 링크 저장"을 선택하세요.
- https://raw.githubusercontent.com/johnhsb/retireflow/main/retirement_simulator_bundled.html
- https://raw.githubusercontent.com/johnhsb/retireflow/main/index.html

## 처음 사용하시는 분은
입력 항목별 설명과 전제사항을 정리한 [사용 가이드](GUIDE.md)를 참고하세요.

## 사용문의
johnhsb@outlook.kr (현수복)
