# Run tests/audit.html (every saved league game) in headless Edge: prints PASS or FAIL (n), the FAIL lines, and how
# many "worth a look" lines there are (-All prints them too). Starts the local server like run-tests.ps1.
param([switch]$All)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$base = "http://127.0.0.1:8765"
function Test-Server {
  try { Invoke-WebRequest "$base/tests/" -UseBasicParsing -TimeoutSec 2 | Out-Null; $true } catch { $false }
}
if (-not (Test-Server)) {
  Start-Process python -ArgumentList "-m", "http.server", "8765", "--bind", "127.0.0.1" -WorkingDirectory $root -WindowStyle Hidden
  for ($i = 0; $i -lt 20 -and -not (Test-Server); $i++) { Start-Sleep -Milliseconds 250 }
  if (-not (Test-Server)) { throw "Local server didn't start on 8765" }
}
$profileDir = Join-Path $env:TEMP ("edge-rs-" + [guid]::NewGuid())
$dom = cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless=new --disable-gpu --user-data-dir=`"$profileDir`" --virtual-time-budget=60000 --dump-dom $base/tests/audit.html 2>nul"
Remove-Item $profileDir -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
$dom = $dom -join "`n"
$title = if ($dom -match "<title>([^<]*)</title>") { $Matches[1] } else { "NO TITLE (page didn't load?)" }
Add-Type -AssemblyName System.Web
$out = if ($dom -match '(?s)id="out"[^>]*>(.*?)</pre>') { [System.Web.HttpUtility]::HtmlDecode($Matches[1]) } else { "" }
$lines = $out -split "`n"
$title
$lines | Where-Object { $_ -like "FAIL *" -or $_ -like "CRASH*" }
$look = $lines | Where-Object { $_ -notlike "FAIL *" -and $_ -notlike "ROWS *" -and $_ -notlike "TOTAL *" -and $_ }
($lines | Where-Object { $_ -like "TOTAL *" })
"$($look.Count) lines worth a look" + $(if ($All) { "" } else { " (-All to list them)" })
if ($All) { $look }
