<#
.SYNOPSIS
  Creates a "Studio Hub" shortcut (Desktop + Start Menu) that launches THE HUB.

.DESCRIPTION
  Generates hub.ico from the hub's own palette, then writes .lnk files pointing
  at Start-Hub.ps1. Windows blocks programmatic taskbar pinning, so finish by
  right-clicking the shortcut and choosing "Pin to taskbar".

  The Start Menu copy carries a Ctrl+Alt+H hotkey.
#>
[CmdletBinding()]
param(
  [string]$Name = 'Studio Hub',
  [string]$Hotkey = 'CTRL+ALT+H',
  [switch]$NoHotkey
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Root      = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Launcher  = Join-Path $PSScriptRoot 'Start-Hub.ps1'
$IconPath  = Join-Path $PSScriptRoot 'hub.ico'
if (-not (Test-Path $Launcher)) { throw "Start-Hub.ps1 is missing from $PSScriptRoot." }

# ── Icon: hub palette (#0B0E17 field, #3EE0CF slashes, #F2A33C bar) ──────────
function New-HubBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  $s = $size / 256.0
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = 48 * $s; $d = $r * 2; $w = ($size - 1)
  $path.AddArc([single]0, [single]0, [single]$d, [single]$d, [single]180, [single]90)
  $path.AddArc([single]($w - $d), [single]0, [single]$d, [single]$d, [single]270, [single]90)
  $path.AddArc([single]($w - $d), [single]($w - $d), [single]$d, [single]$d, [single]0, [single]90)
  $path.AddArc([single]0, [single]($w - $d), [single]$d, [single]$d, [single]90, [single]90)
  $path.CloseFigure()

  $fill = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#121627'))
  $pen  = New-Object System.Drawing.Pen(([System.Drawing.ColorTranslator]::FromHtml('#232A45')), [single](8 * $s))
  $g.FillPath($fill, $path)
  $g.DrawPath($pen, $path)

  $cyan  = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#3EE0CF'))
  foreach ($a in 116, 176) {
    $pts = @(
      (New-Object System.Drawing.PointF(($a * $s),        (60 * $s))),
      (New-Object System.Drawing.PointF((($a + 38) * $s), (60 * $s))),
      (New-Object System.Drawing.PointF((($a - 8) * $s),  (172 * $s))),
      (New-Object System.Drawing.PointF((($a - 46) * $s), (172 * $s)))
    )
    $g.FillPolygon($cyan, [System.Drawing.PointF[]]$pts)
  }

  $amber = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#F2A33C'))
  $g.FillRectangle($amber, [single](64 * $s), [single](196 * $s), [single](128 * $s), [single](18 * $s))

  $g.Dispose()
  return $bmp
}

# PNG-compressed ICO (Vista+). One directory entry per size.
function Write-Ico([int[]]$sizes, [string]$path) {
  $pngs = @(foreach ($sz in $sizes) {
    $bmp = New-HubBitmap $sz
    $ms  = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    @{ Size = $sz; Bytes = $ms.ToArray() }
  })

  $fs = [System.IO.File]::Create($path)
  $bw = New-Object System.IO.BinaryWriter($fs)
  try {
    $bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$pngs.Count)
    $offset = 6 + (16 * $pngs.Count)
    foreach ($p in $pngs) {
      $dim = if ($p.Size -ge 256) { 0 } else { $p.Size }
      $bw.Write([Byte]$dim); $bw.Write([Byte]$dim); $bw.Write([Byte]0); $bw.Write([Byte]0)
      $bw.Write([UInt16]1); $bw.Write([UInt16]32)
      $bw.Write([UInt32]$p.Bytes.Length); $bw.Write([UInt32]$offset)
      $offset += $p.Bytes.Length
    }
    foreach ($p in $pngs) { $bw.Write($p.Bytes) }
  } finally { $bw.Dispose(); $fs.Dispose() }
}

Write-Ico @(256, 64, 48, 32, 16) $IconPath
"Icon written: $IconPath"

# ── Shortcuts ────────────────────────────────────────────────────────────────
$psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$psArgs = '-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $Launcher

$targets = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop'))  "$Name.lnk"),
  (Join-Path ([Environment]::GetFolderPath('Programs')) "$Name.lnk")
)

$shell = New-Object -ComObject WScript.Shell
foreach ($lnk in $targets) {
  $sc = $shell.CreateShortcut($lnk)
  $sc.TargetPath       = $psExe
  $sc.Arguments        = $psArgs
  $sc.WorkingDirectory = $Root
  $sc.IconLocation     = "$IconPath,0"
  $sc.Description      = 'Serve Creative Headquarters and open THE HUB'
  $sc.WindowStyle      = 7      # start minimized; the console self-closes
  if (-not $NoHotkey -and $lnk -like '*\Programs\*') { $sc.Hotkey = $Hotkey }
  $sc.Save()
  "Shortcut written: $lnk"
}

""
"Next step (Windows blocks scripted pinning):"
"  right-click the Desktop 'Studio Hub' icon -> Pin to taskbar"
if (-not $NoHotkey) { "Keyboard shortcut: $Hotkey" }
