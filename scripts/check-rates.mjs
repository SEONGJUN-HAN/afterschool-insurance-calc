// 관리자 PC에서 수동으로 요율을 점검해 rate-status.json에 기록한다.
// (scripts/check-and-publish.cmd 를 더블클릭하면 이 스크립트를 실행하고 결과를 커밋·푸시까지 함)
//
// 평소에는 Vercel 서울 리전의 api/check.mjs가 페이지를 열 때마다 실시간으로 점검하므로
// 이 스크립트는 (1) 요율표를 갱신한 뒤 known-rates.json에 넣을 새 기준값을 얻을 때,
// (2) 실시간 점검 서버가 멈췄을 때 페이지가 대신 보여줄 결과 파일을 갱신할 때 쓴다.
// comwel.or.kr이 해외 IP를 차단하므로 반드시 한국 IP에서 실행해야 한다.

import { readFileSync, writeFileSync } from "node:fs";
import { checkRates } from "../lib/rate-check.mjs";

const known = JSON.parse(readFileSync("known-rates.json", "utf8"));
const result = await checkRates(known, { log: console.log });

const status = { status: result.status, checkedAt: result.checkedAt, issues: result.issues };
writeFileSync("rate-status.json", JSON.stringify(status, null, 2) + "\n");
console.log(JSON.stringify(status, null, 2));

if (result.observed) {
  // index.html의 요율표를 새 값으로 갱신했다면, 아래 값을 known-rates.json에 그대로 복사해 넣어
  // (verifiedAt은 오늘 날짜로) 기준선을 새로 잡아 주세요. 이후부터 이 값과 다시 비교합니다.
  console.log("\n[참고] 방금 확인한 실제 값 (요율표를 갱신한 뒤 known-rates.json 갱신용):");
  console.log(JSON.stringify(result.observed, null, 2));
}
if (result.error) console.error(result.error);
