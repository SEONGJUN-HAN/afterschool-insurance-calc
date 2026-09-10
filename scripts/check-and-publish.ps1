# 방과후강사 보험료율 점검 + 게시
#
# 필요할 때(예: 새 학기 시작 즈음, 또는 오랜만에 계산기를 쓰기 전) 이 스크립트를
# 실행하면 근로복지공단 계산기를 직접 점검하고, 결과를 커밋·푸시해 GitHub Pages에
# 곧바로 반영합니다. 서버나 백그라운드 서비스를 켜둘 필요가 없습니다 — 이 창을
# 닫으면 그걸로 끝입니다.
#
# 반드시 한국 IP에서 실행해야 합니다(comwel.or.kr이 해외/클라우드 IP를 차단함).

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "1) 저장소 최신화..." -ForegroundColor Cyan
git pull

Write-Host "`n2) 근로복지공단 요율 점검 중..." -ForegroundColor Cyan
node scripts/check-rates.mjs

$status = Get-Content rate-status.json -Raw | ConvertFrom-Json

Write-Host "`n3) 변경 사항 커밋..." -ForegroundColor Cyan
git add rate-status.json
git diff --cached --quiet
$hasChange = ($LASTEXITCODE -ne 0)
if ($hasChange) {
    git commit -m "chore: 요율 점검 결과 갱신 ($(Get-Date -Format yyyy-MM-dd))"
    git push
    Write-Host "결과를 커밋·푸시했습니다 (몇 분 뒤 페이지에 반영됩니다)." -ForegroundColor Green
} else {
    Write-Host "이전 점검 결과와 동일해 커밋할 내용이 없습니다." -ForegroundColor Yellow
}

Write-Host ""
switch ($status.status) {
    "ok" {
        Write-Host "결과: 최신 요율로 확인되었습니다." -ForegroundColor Green
    }
    "changed" {
        Write-Host "결과: 요율 변경이 감지되었습니다!" -ForegroundColor Red
        $status.issues | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
        Write-Host "index.html의 EI/AI 요율표와 known-rates.json을 갱신해 주세요." -ForegroundColor Red
    }
    "check_failed" {
        Write-Host "결과: 점검 자체가 실패했습니다 (요율이 바뀐 것은 아닐 수 있음)" -ForegroundColor DarkYellow
        $status.issues | ForEach-Object { Write-Host " - $_" -ForegroundColor DarkYellow }
    }
    default {
        Write-Host "알 수 없는 상태입니다: $($status.status)" -ForegroundColor DarkYellow
    }
}

Write-Host ""
Read-Host "확인했으면 Enter를 눌러 창을 닫으세요"
