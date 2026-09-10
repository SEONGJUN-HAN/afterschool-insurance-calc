// 근로복지공단 노무제공자 보험료 모의계산기의 "방과후 학교강사" 계산 로직이
// 마지막 확인 시점(known-rates.json)과 달라졌는지 점검하는 공용 로직.
// - api/check.mjs          : Vercel 서울 리전(icn1)에서 실시간 점검 (페이지 배너용)
// - scripts/check-rates.mjs : 관리자 PC에서 수동 점검 (rate-status.json 갱신용)
//
// 주의: comwel.or.kr은 해외 IP를 지역 단위로 차단한다. 2026-09-10 Globalping으로 확인한 결과
// 미국·일본의 클라우드/가정용 회선은 모두 HTTP 400, 한국 리전의 AWS·Azure·GCP·Oracle·Vultr는
// 모두 200이었다. 그래서 이 코드는 반드시 한국 IP에서 실행되어야 한다.

import { createHash } from "node:crypto";

export const EI_URL = "https://www.comwel.or.kr/comwel/bohumcal2.jsp"; // 고용보험 모의계산기
export const AI_URL = "https://www.comwel.or.kr/comwel/bohumcal4.jsp"; // 산재보험 모의계산기

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

async function fetchHtml(url, label, log) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  log(`[진단] ${label} 응답 상태: ${res.status}, 본문 길이: ${text.length}자`);
  if (!res.ok) {
    log(`[진단] ${label} 응답 앞부분 500자:\n${text.slice(0, 500)}`);
    throw new Error(`${label} 요청 실패 (HTTP ${res.status})`);
  }
  return text;
}

function parseOrDiagnose(html, label, log, parse) {
  try {
    return parse();
  } catch (err) {
    log(`[진단] ${label} 응답 앞부분 1000자:\n${html.slice(0, 1000)}`);
    throw err;
  }
}

// 한국 시각 "YYYY-MM-DD HH:mm" (실행 환경의 시간대와 무관하게)
export function nowKst() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ");
}

// 공식 계산기에서 지금 실제로 보이는 값 — 요율표를 갱신한 뒤 known-rates.json에 옮겨 적는 값과 같은 형식
export async function observeRates({ log = () => {} } = {}) {
  const eiHtml = await fetchHtml(EI_URL, "고용보험 계산기", log);
  const ei = parseOrDiagnose(eiHtml, "고용보험 계산기", log, () => ({
    eiLatestPeriod: newestSelectValue(eiHtml, "year"),
    eiHash: sha256(extractBetween(eiHtml, 'case "afterschool":', 'case "quick":')),
  }));

  const aiHtml = await fetchHtml(AI_URL, "산재보험 계산기", log);
  const ai = parseOrDiagnose(aiHtml, "산재보험 계산기", log, () => ({
    aiLatestPeriod: newestSelectValue(aiHtml, "targetYear"),
    aiHash: sha256(extractBetween(aiHtml, "'after-school-instructor'", "'tour-guide-interpreter'")),
  }));

  return { ...ei, ...ai };
}

export function compareRates(known, observed) {
  const issues = [];
  if (observed.eiLatestPeriod !== known.eiLatestPeriod) {
    issues.push(`고용보험 모의계산기에 새 적용 기간(${observed.eiLatestPeriod})이 추가되었습니다. 이 계산기는 ${known.eiLatestPeriod}까지 반영되어 있습니다.`);
  }
  if (observed.eiHash !== known.eiHash) {
    issues.push("고용보험 모의계산기의 방과후 학교강사 계산 기준이 이 계산기에 반영된 내용과 달라졌습니다.");
  }
  if (observed.aiLatestPeriod !== known.aiLatestPeriod) {
    issues.push(`산재보험 모의계산기에 새 적용 기간(${observed.aiLatestPeriod})이 추가되었습니다. 이 계산기는 ${known.aiLatestPeriod}까지 반영되어 있습니다.`);
  }
  if (observed.aiHash !== known.aiHash) {
    issues.push("산재보험 모의계산기의 방과후 학교강사 계산 기준이 이 계산기에 반영된 내용과 달라졌습니다.");
  }
  return issues;
}

// status: "ok" | "changed" | "check_failed"
// check_failed는 접속 실패 등 점검 자체가 안 된 경우 — "요율이 바뀌었다"는 뜻이 아니므로 changed와 구분한다.
export async function checkRates(known, { log = () => {} } = {}) {
  const checkedAt = nowKst();
  try {
    const observed = await observeRates({ log });
    const issues = compareRates(known, observed);
    return { status: issues.length === 0 ? "ok" : "changed", checkedAt, issues, observed };
  } catch (err) {
    return {
      status: "check_failed",
      checkedAt,
      issues: [`점검 자체가 실패했습니다: ${err.message} — 요율이 바뀐 것은 아닐 수 있습니다. 공식 계산기를 직접 확인해 주세요.`],
      error: err,
    };
  }
}
