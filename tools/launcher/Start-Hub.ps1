<#
.SYNOPSIS
  Launches THE HUB (Creative Headquarters) in the default browser.

.DESCRIPTION
  The hub reads dashboard.json and state/vault_manifest.json over fetch(), which
  file:// cannot serve. This starts a loopback-only static server on the repo
  root, waits for it to answer, then opens http://localhost:<port>/hub/.

  Re-running is safe: an already-running hub server is reused, not duplicated.

.EXAMPLE
  .\Start-Hub.ps1
.EXAMPLE
  .\Start-Hub.ps1 -Stop        # shut the background server down
#>
[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)][int]$Port = 8765,
  [ValidateRange(1, 50)][int]$PortSearch = 10,
  [switch]$Stop,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $Root 'hub\index.html'))) {
  throw "Could not find hub\index.html under '$Root'. Keep Start-Hub.ps1 in tools\launcher\."
}

$Ports = $Port..($Port + $PortSearch - 1)

function Test-PortInUse([int]$p) {
  $client = New-Object System.Net.Sockets.TcpClient
  try { $client.Connect('127.0.0.1', $p); return $true }
  catch { return $false }
  finally { $client.Dispose() }
}

# True only when the listener on $p is actually serving this repo's hub.
function Test-HubServer([int]$p) {
  if (-not (Test-PortInUse $p)) { return $false }
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$p/hub/index.html" -UseBasicParsing -TimeoutSec 3
    return ($r.StatusCode -eq 200 -and $r.Content -match 'Studio Headless OS')
  } catch { return $false }
}

if ($Stop) {
  $killed = 0
  foreach ($p in $Ports) {
    if (-not (Test-HubServer $p)) { continue }
    $owners = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
              Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $owners) {
      try { Stop-Process -Id $procId -Force -ErrorAction Stop; $killed++ } catch {}
    }
  }
  if ($killed) { "Stopped $killed hub server process(es)." } else { "No hub server was running." }
  return
}

$target = 0
foreach ($p in $Ports) { if (Test-HubServer $p) { $target = $p; break } }

if (-not $target) {
  $free = 0
  foreach ($p in $Ports) { if (-not (Test-PortInUse $p)) { $free = $p; break } }
  if (-not $free) { throw "Ports $Port-$($Ports[-1]) are all in use. Pass -Port with a free one." }

  # python.exe, not pythonw.exe: http.server logs every request to stderr, and
  # under pythonw stderr is None, which throws and drops each connection.
  # -WindowStyle Hidden keeps its console off-screen.
  $py = Get-Command python.exe -ErrorAction SilentlyContinue
  if (-not $py) { $py = Get-Command python3.exe -ErrorAction SilentlyContinue }
  if (-not $py) { throw "Python was not found on PATH. Install Python 3, or serve the repo root yourself and open http://localhost:$Port/hub/." }

  Start-Process -FilePath $py.Source -WindowStyle Hidden -WorkingDirectory $Root `
    -ArgumentList @('-m', 'http.server', "$free", '--bind', '127.0.0.1', '--directory', $Root)

  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if (Test-HubServer $free) { $target = $free; break }
    Start-Sleep -Milliseconds 250
  }
  if (-not $target) { throw "Server on port $free did not come up within 15s." }
}

$url = "http://localhost:$target/hub/"
if (-not $NoBrowser) { Start-Process $url }
"THE HUB is live at $url"
