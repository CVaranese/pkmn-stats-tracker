# Run tests/index.html in headless Edge and print the result.
# Starts `python -m http.server 8765` from the repo root if nothing answers there.
# Prints "PASS n/n", "FAIL (k)" with each failing test and its detail, or "CRASH" with the error.
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

# a fresh Edge profile each run, so nothing comes from its cache
$profileDir = Join-Path $env:TEMP ("edge-rs-" + [guid]::NewGuid())
# through cmd: PowerShell 5.1 loses Edge's stdout and turns its stderr into errors
$dom = cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless=new --disable-gpu --user-data-dir=`"$profileDir`" --virtual-time-budget=15000 --dump-dom $base/tests/index.html 2>nul"
Remove-Item $profileDir -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
$dom = $dom -join "`n"
$title = if ($dom -match "<title>([^<]*)</title>") { $Matches[1] } else { "NO TITLE (page didn't load?)" }
Add-Type -AssemblyName System.Web
$out = if ($dom -match '(?s)id="out"[^>]*>(.*?)</') { [System.Web.HttpUtility]::HtmlDecode($Matches[1]) } else { "" }
$lines = $out -split "`n"
$title
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
