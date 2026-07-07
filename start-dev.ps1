$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$hostName = "127.0.0.1"
$port = 5173
$url = "http://${hostName}:${port}/"
$outLog = Join-Path $projectRoot "vite.out.log"
$errLog = Join-Path $projectRoot "vite.err.log"
$pidFile = Join-Path $projectRoot ".vite-dev.pid"

function Test-TrimrateServer {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Get-NodeCommand {
    $candidates = @(
        "C:\Program Files\nodejs\node.exe",
        (Join-Path $env:LOCALAPPDATA "Programs\nodejs\node.exe")
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    $fromPath = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }

    throw "Could not find node.exe. Install Node.js or add it to PATH."
}

if (Test-TrimrateServer) {
    Write-Host "TrimRate is already available at $url"
    exit 0
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    $name = if ($process) { $process.ProcessName } else { "PID $($listener.OwningProcess)" }
    throw "Port $port is already in use by $name, but $url is not responding."
}

$node = Get-NodeCommand
$viteScript = Join-Path $projectRoot "node_modules\vite\bin\vite.js"
if (-not (Test-Path -LiteralPath $viteScript)) {
    throw "Could not find Vite at $viteScript. Run npm install first."
}

$arguments = @($viteScript, "--host", $hostName, "--port", "$port", "--strictPort")

Write-Host "Starting TrimRate dev server at $url"
$process = Start-Process `
    -FilePath $node `
    -ArgumentList $arguments `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru

Set-Content -LiteralPath $pidFile -Value $process.Id

$deadline = (Get-Date).AddSeconds(20)
do {
    Start-Sleep -Milliseconds 500
    if (Test-TrimrateServer) {
        Write-Host "TrimRate is ready at $url"
        exit 0
    }

    if ($process.HasExited) {
        $tail = ""
        if (Test-Path -LiteralPath $errLog) {
            $tail = (Get-Content -LiteralPath $errLog -Tail 20) -join [Environment]::NewLine
        }
        throw "Vite exited before becoming ready. Check vite.err.log. $tail"
    }
} while ((Get-Date) -lt $deadline)

throw "Timed out waiting for TrimRate at $url. Check vite.out.log and vite.err.log."
