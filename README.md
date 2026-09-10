# 방과후강사 보험료 일괄계산기

방과후 학교강사 여러 명의 고용보험·산재보험료를 한 번에 계산하는 정적 웹페이지입니다. 근로복지공단 [노무제공자 보험료 모의계산기](https://www.comwel.or.kr/comwel/bohumcal2.jsp)의 방과후 학교강사 기준을 그대로 반영했습니다.

## 사용법

`index.html`을 그대로 열면 됩니다. GitHub Pages로 배포하면 로그인 없이 링크로 누구나 열 수 있습니다.

1. 이 저장소를 GitHub에 올린다.
2. 저장소 **Settings → Pages → Build and deployment → Source: Deploy from a branch**, 브랜치는 `main`, 폴더는 `/ (root)`로 설정한다.
3. 몇 분 뒤 `https://<계정명>.github.io/<저장소명>/` 주소로 접속할 수 있다.

## 요율 자동 점검

`.github/workflows/check-rates.yml`이 **매달 1일**(및 저장소의 Actions 탭에서 수동 실행 `workflow_dispatch`)에 `scripts/check-rates.mjs`를 실행합니다. 이 스크립트는:

- 근로복지공단 고용보험·산재보험 모의계산기 페이지를 서버 쪽에서 직접 조회해(브라우저가 아니므로 CORS 제약 없음) 방과후 학교강사 관련 로직과 적용기간 목록을 가져오고
- `known-rates.json`에 기록된 마지막 확인값과 비교해
- 다르면 `rate-status.json`에 `upToDate: false`와 함께 무엇이 달라졌는지 적어 커밋(→ Pages에 즉시 반영)하고, 저장소에 Issue를 등록합니다.

`index.html`은 페이지가 열릴 때마다 같은 저장소의 `rate-status.json`을 읽어(동일 출처라 CORS 문제 없음) 맨 위에 상태 배너로 보여줍니다. 즉, **이 계산기를 쓰는 모든 사람이 페이지를 열 때 최신 여부를 바로 볼 수 있습니다.**

### 요율이 바뀌었을 때 갱신하는 법

1. Issue에 적힌 내용, 또는 `index.html` 안의 "셀프체크" 표에 걸린 근로복지공단 공식 표 링크로 실제 변경 내용을 확인한다.
2. `index.html`의 `EI`, `AI` 상수(공제율·요율·상한액)를 새 값으로 고친다.
3. 터미널에서 `node scripts/check-rates.mjs`를 한 번 더 실행한다.
4. 콘솔 맨 아래 출력되는 `eiLatestPeriod` / `eiHash` / `aiLatestPeriod` / `aiHash` 값을 `known-rates.json`에 그대로 옮겨 적고 `verifiedAt`을 오늘 날짜로 바꾼다.
5. 커밋 후 푸시하면 다음 자동 점검부터 새 기준으로 비교합니다.

## 파일 구성

- `index.html` — 계산기 페이지 (수정할 필요가 없는 한 이 파일만 열면 됨)
- `known-rates.json` — 마지막으로 사람이 확인·반영한 요율의 "기준값"
- `rate-status.json` — 가장 최근 자동 점검 결과 (Actions가 매달 갱신)
- `scripts/check-rates.mjs` — 자동 점검 스크립트
- `.github/workflows/check-rates.yml` — 매달 1일 자동 실행 설정
