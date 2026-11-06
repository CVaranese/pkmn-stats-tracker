# Rewrite tests/snapshot.json from tests/snapshot.html (every saved league game through parser.js now), then print
# git's summary of what changed. Only on purpose: a kill / damage rule change, or new games added to the library.
# Review the diff (git diff tests/snapshot.json) before committing it. Starts the local server like run-tests.ps1.
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
$dom = cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless=new --disable-gpu --user-data-dir=`"$profileDir`" --virtual-time-budget=60000 --dump-dom $base/tests/snapshot.html 2>nul"
Remove-Item $profileDir -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
$dom = $dom -join "`n"
$title = if ($dom -match "<title>([^<]*)</title>") { $Matches[1] } else { "NO TITLE (page didn't load?)" }
$title
if ($title -notlike "DONE*") { exit 1 }
Add-Type -AssemblyName System.Web
$json = [System.Web.HttpUtility]::HtmlDecode(([regex]::Match($dom, '(?s)id="out"[^>]*>(.*?)</pre>')).Groups[1].Value)
# UTF-8 without a BOM, \n line ends
[System.IO.File]::WriteAllText((Join-Path $root "tests\snapshot.json"), ($json -replace "`r`n", "`n"), (New-Object System.Text.UTF8Encoding $false))
git -C $root diff --stat -- tests/snapshot.json
