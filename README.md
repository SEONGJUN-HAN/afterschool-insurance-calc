# 방과후강사 보험료 일괄계산기

방과후 학교강사 여러 명의 고용보험·산재보험료를 한 번에 계산하는 정적 웹페이지입니다. 근로복지공단 [노무제공자 보험료 모의계산기](https://www.comwel.or.kr/comwel/bohumcal2.jsp)의 방과후 학교강사 기준을 그대로 반영했습니다.

## 사용법

`index.html`을 그대로 열면 됩니다. GitHub Pages로 배포하면 로그인 없이 링크로 누구나 열 수 있습니다.

1. 이 저장소를 GitHub에 올린다.
2. 저장소 **Settings → Pages → Build and deployment → Source: Deploy from a branch**, 브랜치는 `main`, 폴더는 `/ (root)`로 설정한다.
3. 몇 분 뒤 `https://<계정명>.github.io/<저장소명>/` 주소로 접속할 수 있다.

## 요율 점검

### 왜 GitHub Actions로는 안 되나

comwel.or.kr은 **해외 IP를 지역 단위로 차단**합니다. 2026-09-10에 [Globalping](https://globalping.io)으로 여러 나라의 서버에서 고용보험 계산기에 접속해 확인한 결과는 다음과 같습니다.

| 접속 위치 | 결과 |
|---|---|
| 미국 Azure(GitHub Actions와 같은 환경)·미국 AWS·일본 AWS·일본 가정용 회선 | HTTP 400 |
| 한국 리전 AWS(서울)·Azure(한국 중부)·GCP(서울)·Oracle(서울·춘천)·Vultr(서울) | HTTP 200 |

즉 클라우드라서 막히는 것이 아니라 해외라서 막히는 것이므로, **한국 리전에서 실행되는 서버리스 함수**로 해결할 수 있습니다.

### 실시간 자동 점검 (Vercel 서울 리전)

`api/check.mjs`는 Vercel의 서울 리전(`vercel.json`의 `"regions": ["icn1"]`)에서 실행되는 함수입니다. 호출되면 근로복지공단 고용보험·산재보험 모의계산기를 직접 조회해 `known-rates.json`과 비교한 결과를 돌려줍니다. `index.html`은 페이지를 열 때마다 이 결과를 받아 맨 위 배너에 "최신 요율로 확인됨 · 마지막 점검: 2026-09-10 15:02" 형태로 보여줍니다. 결과는 Vercel CDN에 1시간 캐시되므로 공단 사이트에는 많아야 시간당 한 번 요청이 갑니다.

**최초 설정(한 번만):**

1. [vercel.com](https://vercel.com)에 GitHub 계정으로 가입(Hobby 무료 플랜, 카드 등록 불필요)한다.
2. **Add New → Project**에서 이 저장소를 Import한다. Framework Preset은 **Other**, 나머지 설정은 그대로 두고 **Deploy**한다.
3. 배포가 끝나면 `https://<프로젝트명>.vercel.app/api/check`를 열어 `"status":"ok"`, `"region":"icn1"`이 나오는지 확인한다.
4. `index.html`의 `LIVE_CHECK_URL`에 그 주소를 넣고 커밋·푸시한다.

현재 연결된 주소: <https://afterschool-insurance-calc.vercel.app/api/check> (해시가 붙은 개별 배포 주소는 Vercel 로그인 보호가 걸려 있어 페이지에서 쓸 수 없으므로 반드시 이 운영 주소를 쓴다)

이후에는 `main`에 푸시할 때마다 Vercel이 자동으로 다시 배포하므로 `known-rates.json`을 고치면 점검 기준도 자동으로 따라갑니다.

### 수동 점검 (관리자 PC, 예비용)

실시간 점검 서버가 응답하지 않으면 페이지는 대신 `rate-status.json`(관리자가 마지막으로 수동 점검한 결과)을 보여줍니다. 또 요율표를 갱신한 뒤 `known-rates.json`에 넣을 새 기준값을 얻을 때도 이 방법을 씁니다. 반드시 한국 IP에서 실행해야 합니다.

**실행 방법:** `scripts/check-and-publish.cmd`를 더블클릭한다. (내부적으로 `check-and-publish.ps1`을 실행함)

이 스크립트는:

1. 저장소를 최신화하고
2. `scripts/check-rates.mjs`로 근로복지공단 고용보험·산재보험 모의계산기 페이지를 직접 조회해 방과후 학교강사 관련 로직·적용기간을 `known-rates.json`의 마지막 확인값과 비교하고
3. 결과를 `rate-status.json`에 적어 커밋·푸시합니다(→ 몇 분 뒤 Pages에 반영).

서버나 백그라운드 서비스를 켜둘 필요가 없습니다 — 실행하고 창을 닫으면 끝입니다.

실시간 점검 API와 `rate-status.json`의 `status`는 세 가지입니다:

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
- `rate-status.json` — 가장 최근 수동 점검 결과 (실시간 점검 서버가 응답하지 않을 때 배너에 표시)
- `lib/rate-check.mjs` — 요율 점검 공용 로직 (실시간·수동 점검이 함께 사용)
- `api/check.mjs`, `vercel.json` — Vercel 서울 리전 실시간 점검 API
- `scripts/check-rates.mjs` — 수동 요율 점검 스크립트
- `scripts/check-and-publish.ps1` / `.cmd` — 위 스크립트를 실행하고 결과를 커밋·푸시까지 하는 더블클릭용 실행기
