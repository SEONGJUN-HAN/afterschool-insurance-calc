// 근로복지공단 노무제공자 보험료 모의계산기의 "방과후 학교강사" 계산 로직이
// 마지막 확인 시점(known-rates.json)과 달라졌는지 매달 자동으로 점검한다.
// 브라우저가 아니라 이 스크립트(Node.js, GitHub Actions에서 실행)가 직접 comwel.or.kr에
// 접속하므로 브라우저의 동일-출처 정책(CORS)에 걸리지 않는다.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";

const EI_URL = "https://www.comwel.or.kr/comwel/bohumcal2.jsp"; // 고용보험 모의계산기
const AI_URL = "https://www.comwel.or.kr/comwel/bohumcal4.jsp"; // 산재보험 모의계산기

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error(`구간 시작 표식을 찾지 못함: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  if (end === -1) throw new Error(`구간 끝 표식을 찾지 못함: ${endMarker}`);
  return text.slice(start, end);
}

function periodSortKey(period) {
  // "2023" -> 20230, "2024-1" -> 20241, "2024-2" -> 20242 (표기 순서와 무관하게 최신값 비교)
  const m = period.match(/^(\d{4})(?:-(\d))?$/);
  if (!m) return -1;
  return parseInt(m[1], 10) * 10 + (m[2] ? parseInt(m[2], 10) : 0);
}

function newestSelectValue(html, selectId) {
  const selectMatch = html.match(new RegExp(`id=["']${selectId}["'][\\s\\S]*?</select>`));
  if (!selectMatch) throw new Error(`select #${selectId} 를 찾지 못함`);
  const values = [...selectMatch[0].matchAll(/value=["']([^"']+)["']/g)].map((m) => m[1]);
  if (!values.length) throw new Error(`select #${selectId} 안에 옵션이 없음`);
  return values.reduce((best, v) => (periodSortKey(v) > periodSortKey(best) ? v : best));
}

function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${value}\n`);
}

async function main() {
  const known = JSON.parse(readFileSync("known-rates.json", "utf8"));
  const issues = [];
  const today = new Date().toISOString().slice(0, 10);

  const eiHtml = await fetch(EI_URL).then((r) => r.text());
  const eiLatestPeriod = newestSelectValue(eiHtml, "year");
  const eiHash = sha256(extractBetween(eiHtml, 'case "afterschool":', 'case "quick":'));

  const aiHtml = await fetch(AI_URL).then((r) => r.text());
  const aiLatestPeriod = newestSelectValue(aiHtml, "targetYear");
  const aiHash = sha256(extractBetween(aiHtml, "'after-school-instructor'", "'tour-guide-interpreter'"));

  if (eiLatestPeriod !== known.eiLatestPeriod) {
    issues.push(`고용보험 계산기에 새 적용기간이 추가됨: ${eiLatestPeriod} (마지막 반영: ${known.eiLatestPeriod})`);
  }
  if (eiHash !== known.eiHash) {
    issues.push("고용보험 계산기의 방과후 학교강사 계산 로직 내용이 마지막 확인 시점과 달라짐");
  }
  if (aiLatestPeriod !== known.aiLatestPeriod) {
    issues.push(`산재보험 계산기에 새 적용기간이 추가됨: ${aiLatestPeriod} (마지막 반영: ${known.aiLatestPeriod})`);
  }
  if (aiHash !== known.aiHash) {
    issues.push("산재보험 계산기의 방과후 학교강사 계산 로직 내용이 마지막 확인 시점과 달라짐");
  }

  const status = { upToDate: issues.length === 0, checkedAt: today, issues };
  writeFileSync("rate-status.json", JSON.stringify(status, null, 2) + "\n");
  setOutput("changed", String(issues.length > 0));
  console.log(JSON.stringify(status, null, 2));

  // index.html의 요율표를 새 값으로 갱신했다면, 아래 값을 known-rates.json에 그대로 복사해 넣어
  // (verifiedAt은 오늘 날짜로) 기준선을 새로 잡아 주세요. 이후부터 이 값과 다시 비교합니다.
  console.log("\n[참고] 방금 확인한 실제 값 (요율표를 갱신한 뒤 known-rates.json 갱신용):");
  console.log(JSON.stringify({ eiLatestPeriod, eiHash, aiLatestPeriod, aiHash }, null, 2));
}

main().catch((err) => {
  const today = new Date().toISOString().slice(0, 10);
  const status = {
    upToDate: false,
    checkedAt: today,
    issues: [`자동 점검 스크립트 실행 중 오류가 발생했습니다: ${err.message} — 공식 계산기를 직접 확인해 주세요.`],
  };
  writeFileSync("rate-status.json", JSON.stringify(status, null, 2) + "\n");
  setOutput("changed", "true");
  console.error(err);
});
