# Run tests/index.html in headless Edge and print the result.
# Starts `python -m http.server <Port>` from the repo root if nothing answers there; stops when the port serves another
# checkout (another worktree's server), which would test that checkout's code: pass a free -Port.
# Prints "PASS n/n", "FAIL (k)" with each failing test and its detail, or "CRASH" with the error.
param([int]$Port = 8765)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$base = "http://127.0.0.1:$Port"

function Test-Server {
  try { Invoke-WebRequest "$base/tests/" -UseBasicParsing -TimeoutSec 2 | Out-Null; $true } catch { $false }
}
if (-not (Test-Server)) {
  Start-Process python -ArgumentList "-m", "http.server", "$Port", "--bind", "127.0.0.1" -WorkingDirectory $root -WindowStyle Hidden
  for ($i = 0; $i -lt 20 -and -not (Test-Server); $i++) { Start-Sleep -Milliseconds 250 }
  if (-not (Test-Server)) { throw "Local server didn't start on $Port" }
}
$served = (Invoke-WebRequest "$base/tests/tests.js" -UseBasicParsing).RawContentStream.ToArray()
if ([Convert]::ToBase64String($served) -ne [Convert]::ToBase64String([IO.File]::ReadAllBytes("$root\tests\tests.js"))) { throw "Port $Port serves another checkout. Run again with a free -Port." }

Add-Type -AssemblyName System.Web
# tests/index.html: the parser and pure code; tests/bets_ui.html: the Gambling tab against a store kept in memory
foreach ($page in "index.html", "bets_ui.html") {
  # a fresh Edge profile each run, so nothing comes from its cache
  $profileDir = Join-Path $env:TEMP ("edge-rs-" + [guid]::NewGuid())
  # through cmd: PowerShell 5.1 loses Edge's stdout and turns its stderr into errors
  $dom = cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless=new --disable-gpu --user-data-dir=`"$profileDir`" --virtual-time-budget=30000 --dump-dom $base/tests/$page 2>nul"
  Remove-Item $profileDir -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
  $dom = $dom -join "`n"
  $title = if ($dom -match "<title>([^<]*)</title>") { $Matches[1] } else { "NO TITLE (page didn't load?)" }
  $out = if ($dom -match '(?s)id="out"[^>]*>(.*?)</') { [System.Web.HttpUtility]::HtmlDecode($Matches[1]) } else { "" }
  $lines = $out -split "`n"
  "${page}: $title"
  if ($lines.Count) { $lines[0] }                       # "n/m passed" or the crash message
  if ($title -ne "PASS") {
    # failing tests and their indented detail lines
    $show = $false
    foreach ($l in $lines) {
      if ($l -like "FAIL *") { $show = $true; $l }
      elseif ($l -like "PASS *") { $show = $false }
      elseif ($show) { $l }
    }
    if ($title -eq "CRASH") { $out }
  }
}
