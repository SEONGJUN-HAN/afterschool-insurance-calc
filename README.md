# 방과후강사 보험료 일괄계산기

방과후 학교강사 여러 명의 고용보험·산재보험료를 한 번에 계산하는 정적 웹페이지입니다. 근로복지공단 [노무제공자 보험료 모의계산기](https://www.comwel.or.kr/comwel/bohumcal2.jsp)의 방과후 학교강사 기준을 그대로 반영했습니다.

## 사용법

`index.html`을 그대로 열면 됩니다. GitHub Pages로 배포하면 로그인 없이 링크로 누구나 열 수 있습니다.

1. 이 저장소를 GitHub에 올린다.
2. 저장소 **Settings → Pages → Build and deployment → Source: Deploy from a branch**, 브랜치는 `main`, 폴더는 `/ (root)`로 설정한다.
3. 몇 분 뒤 `https://<계정명>.github.io/<저장소명>/` 주소로 접속할 수 있다.

## 요율 점검 (수동, 필요할 때만)

comwel.or.kr은 해외/클라우드 데이터센터 IP에서의 접속을 방화벽 단에서 막고 있어(GitHub Actions 클라우드 러너로 시도하면 HTTP 400), **완전 자동화(예: 매달 자동 실행)는 불가능합니다.** 그래서 한국 IP를 쓰는 관리자의 PC에서 필요할 때 직접 실행하는 방식을 씁니다.

**실행 방법:** `scripts/check-and-publish.cmd`를 더블클릭한다. (내부적으로 `check-and-publish.ps1`을 실행함)

이 스크립트는:

1. 저장소를 최신화하고
2. `scripts/check-rates.mjs`로 근로복지공단 고용보험·산재보험 모의계산기 페이지를 직접 조회해 방과후 학교강사 관련 로직·적용기간을 `known-rates.json`의 마지막 확인값과 비교하고
3. 결과를 `rate-status.json`에 적어 커밋·푸시합니다(→ 몇 분 뒤 Pages에 반영).

서버나 백그라운드 서비스를 켜둘 필요가 없습니다 — 실행하고 창을 닫으면 끝입니다.

`index.html`은 페이지가 열릴 때마다 같은 저장소의 `rate-status.json`을 읽어(동일 출처라 CORS 문제 없음) 맨 위에 상태 배너로 보여줍니다. 즉, **관리자가 한 번 점검해두면, 이 계산기를 쓰는 모든 사람이 페이지를 열 때 최신 여부를 바로 볼 수 있습니다.** `rate-status.json`의 `status`는 세 가지입니다:

- `"ok"` — 최신 요율로 확인됨
- `"changed"` — 요율이 실제로 바뀐 것을 확인함 (아래 갱신 절차 필요)
- `"check_failed"` — 점검 자체가 실패함(접속 실패 등). 요율이 바뀐 것은 아닐 수 있음

### 요율이 바뀌었을 때(`status: "changed"`) 갱신하는 법

1. 점검 실행 시 콘솔에 출력된 내용, 또는 `index.html` 안의 "셀프체크" 표에 걸린 근로복지공단 공식 표 링크로 실제 변경 내용을 확인한다.
2. `index.html`의 `EI`, `AI` 상수(공제율·요율·상한액)를 새 값으로 고친다.
3. `scripts/check-and-publish.cmd`를 한 번 더 실행한다.
4. 콘솔 맨 아래 출력되는 `eiLatestPeriod` / `eiHash` / `aiLatestPeriod` / `aiHash` 값을 `known-rates.json`에 그대로 옮겨 적고 `verifiedAt`을 오늘 날짜로 바꾼다.
5. 커밋 후 푸시하면 다음 점검부터 새 기준으로 비교합니다.

## 파일 구성

- `index.html` — 계산기 페이지 (수정할 필요가 없는 한 이 파일만 열면 됨)
- `known-rates.json` — 마지막으로 사람이 확인·반영한 요율의 "기준값"
- `rate-status.json` — 가장 최근 점검 결과 (점검 스크립트 실행 시 갱신)
- `scripts/check-rates.mjs` — 요율 점검 스크립트
- `scripts/check-and-publish.ps1` / `.cmd` — 위 스크립트를 실행하고 결과를 커밋·푸시까지 하는 더블클릭용 실행기
