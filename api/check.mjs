// 실시간 요율 점검 API — Vercel 서울 리전(icn1)에서 실행된다(vercel.json의 regions).
// GitHub Actions 같은 해외 서버는 comwel.or.kr에 접속할 수 없지만(HTTP 400), 한국 리전의
// 이 함수는 접속할 수 있으므로 대신 공식 계산기를 조회해 known-rates.json과 비교한 결과를 돌려준다.
// index.html은 페이지를 열 때마다 이 결과를 받아 맨 위 배너에 보여준다.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkRates } from "../lib/rate-check.mjs";

export async function GET() {
  const known = JSON.parse(readFileSync(join(process.cwd(), "known-rates.json"), "utf8"));
  const result = await checkRates(known);
  const failed = result.status === "check_failed";
  return Response.json(
    {
      status: result.status,
      checkedAt: result.checkedAt,
      issues: result.issues,
      region: process.env.VERCEL_REGION || null,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        // Vercel CDN이 결과를 1시간 캐시하므로 comwel.or.kr에는 많아야 시간당 한 번 요청이 간다.
        // 점검 실패는 5분만 캐시해 금방 다시 시도하게 한다.
        "Cache-Control": failed ? "public, s-maxage=300" : "public, s-maxage=3600",
      },
    }
  );
}
