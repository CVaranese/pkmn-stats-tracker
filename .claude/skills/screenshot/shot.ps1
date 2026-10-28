# Screenshot the locally served site with headless Edge.
# Starts `python -m http.server 8765` from the repo root if nothing answers there.
# Prints the PNG path on the last line.
param(
  [string]$Replays = "",          # comma-separated replay ids from the league's site/<league>/games/ (1 = One game tab, 2+ = Playoffs tab)
  [ValidateSet("dark", "light")][string]$Theme = "dark",
  [int]$Width = 1400,
  [int]$Height = 2200,
  [string]$Page = "site/ppppp/", # path under the repo root, e.g. "site/" (league list), "site/scl/", "tests/"
  [string]$Query = "",            # extra query string, e.g. "online"
  [string]$Name = "shot",
  [string]$OutDir = "$env:TEMP\rs-shots"
)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$base = "http://127.0.0.1:8765"

function Test-Server {
  try { Invoke-WebRequest "$base/site/" -UseBasicParsing -TimeoutSec 2 | Out-Null; $true } catch { $false }
}
if (-not (Test-Server)) {
  Start-Process python -ArgumentList "-m", "http.server", "8765", "--bind", "127.0.0.1" -WorkingDirectory $root -WindowStyle Hidden
  for ($i = 0; $i -lt 20 -and -not (Test-Server); $i++) { Start-Sleep -Milliseconds 250 }
  if (-not (Test-Server)) { throw "Local server didn't start on 8765" }
}

$qs = @()
if ($Replays) { $qs += "r=$Replays" }
if ($Query) { $qs += $Query }
$url = "$base/$Page" + $(if ($qs) { "?" + ($qs -join "&") } else { "" })

New-Item -ItemType Directory -Force $OutDir | Out-Null
$png = Join-Path $OutDir "$Name-$Theme-$Width.png"
if (Test-Path $png) { Remove-Item $png -Force -Confirm:$false }
# Blink's preferredColorScheme: 0 = dark, 1 = light
$scheme = if ($Theme -eq "dark") { 0 } else { 1 }
# a fresh Edge profile each run, so nothing comes from its cache
$profileDir = Join-Path $env:TEMP ("edge-rs-" + [guid]::NewGuid())
# through cmd: PowerShell 5.1 turns Edge's "bytes written" stderr line into an error
cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless=new --disable-gpu --hide-scrollbars --user-data-dir=`"$profileDir`" --blink-settings=preferredColorScheme=$scheme --window-size=$Width,$Height --virtual-time-budget=15000 --screenshot=`"$png`" `"$url`" >nul 2>nul"
for ($i = 0; $i -lt 20 -and -not (Test-Path $png); $i++) { Start-Sleep -Milliseconds 250 }
Remove-Item $profileDir -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
if (-not (Test-Path $png)) { throw "No screenshot written for $url" }
"url: $url"
$png
