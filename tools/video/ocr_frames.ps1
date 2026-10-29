# OCR every PNG in a folder with Windows' built-in OCR (Windows.Media.Ocr, no install). Windows PowerShell 5.1 only.
#   powershell -NoProfile -File tools/video/ocr_frames.ps1 <png_dir> <out.jsonl>
# One JSON object per line: {"frame": "f03000", "y": 123, "x": 4, "h": 18, "text": "..."} (crop pixels, top to bottom).
param([Parameter(Mandatory)] [string] $Dir, [Parameter(Mandatory)] [string] $Out)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type] $type) {
    $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
$sb = New-Object System.Text.StringBuilder
$files = Get-ChildItem -LiteralPath $Dir -Filter *.png | Sort-Object Name
foreach ($f in $files) {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
    foreach ($line in $res.Lines) {
        $r = @($line.Words)[0].BoundingRect
        $o = [ordered]@{ frame = $f.BaseName; y = [int]$r.Y; x = [int]$r.X; h = [int]$r.Height; text = $line.Text }
        [void]$sb.AppendLine(($o | ConvertTo-Json -Compress))
    }
    $stream.Dispose()
}
[System.IO.File]::WriteAllText($Out, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
"$($files.Count) frames -> $Out"
