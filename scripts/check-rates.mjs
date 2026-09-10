// 근로복지공단 노무제공자 보험료 모의계산기의 "방과후 학교강사" 계산 로직이
// 마지막 확인 시점(known-rates.json)과 달라졌는지 점검한다.
//
// 주의: comwel.or.kr은 해외/클라우드 데이터센터 IP에서의 접속을 방화벽 단에서
// 차단하는 것으로 확인됨(GitHub Actions 클라우드 러너에서 실행 시 HTTP 400).
// 그래서 이 스크립트는 한국 IP를 쓰는 사용자의 PC에서 직접 실행해야 한다.
// (scripts/check-and-publish.cmd 를 더블클릭하면 됨)

import { readFileSync, writeFileSync } from "node:fs";
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

async function fetchHtml(url, label) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  const text = await res.text();
  console.log(`[진단] ${label} 응답 상태: ${res.status}, 본문 길이: ${text.length}자`);
  if (!res.ok) {
    console.log(`[진단] ${label} 응답 앞부분 500자:\n${text.slice(0, 500)}`);
    throw new Error(`${label} 요청 실패 (HTTP ${res.status})`);
  }
  return text;
}

function writeStatus(status) {
  writeFileSync("rate-status.json", JSON.stringify(status, null, 2) + "\n");
  console.log(JSON.stringify(status, null, 2));
}

async function main() {
  const known = JSON.parse(readFileSync("known-rates.json", "utf8"));
  const issues = [];
  const today = new Date().toISOString().slice(0, 10);

  const eiHtml = await fetchHtml(EI_URL, "고용보험 계산기");
  let eiLatestPeriod, eiHash;
  try {
    eiLatestPeriod = newestSelectValue(eiHtml, "year");
    eiHash = sha256(extractBetween(eiHtml, 'case "afterschool":', 'case "quick":'));
  } catch (err) {
    console.log(`[진단] 고용보험 계산기 응답 앞부분 1000자:\n${eiHtml.slice(0, 1000)}`);
    throw err;
  }

  const aiHtml = await fetchHtml(AI_URL, "산재보험 계산기");
  let aiLatestPeriod, aiHash;
  try {
    aiLatestPeriod = newestSelectValue(aiHtml, "targetYear");
    aiHash = sha256(extractBetween(aiHtml, "'after-school-instructor'", "'tour-guide-interpreter'"));
  } catch (err) {
    console.log(`[진단] 산재보험 계산기 응답 앞부분 1000자:\n${aiHtml.slice(0, 1000)}`);
    throw err;
  }

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

  writeStatus({ status: issues.length === 0 ? "ok" : "changed", checkedAt: today, issues });

  // index.html의 요율표를 새 값으로 갱신했다면, 아래 값을 known-rates.json에 그대로 복사해 넣어
  // (verifiedAt은 오늘 날짜로) 기준선을 새로 잡아 주세요. 이후부터 이 값과 다시 비교합니다.
  console.log("\n[참고] 방금 확인한 실제 값 (요율표를 갱신한 뒤 known-rates.json 갱신용):");
  console.log(JSON.stringify({ eiLatestPeriod, eiHash, aiLatestPeriod, aiHash }, null, 2));
}

main().catch((err) => {
  const today = new Date().toISOString().slice(0, 10);
  // 접속 실패 등 점검 자체가 안 된 경우 — "요율이 바뀌었다"는 뜻이 아니므로
  // status를 changed와 구분해서 기록한다(index.html이 배너 문구를 다르게 보여줌).
  writeStatus({
    status: "check_failed",
    checkedAt: today,
    issues: [`점검 자체가 실패했습니다: ${err.message} — 요율이 바뀐 것은 아닐 수 있습니다. 공식 계산기를 직접 확인해 주세요.`],
  });
  console.error(err);
});
