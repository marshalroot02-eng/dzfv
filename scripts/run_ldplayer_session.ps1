# TikTok Booster LDPlayer 9 Windows Session Runner
# Runs on GitHub-hosted windows-latest or Windows runner environments.

$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   TikTok Live Booster - LDPlayer 9 Runner Engine" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Environment & Virtualization Capability Audit
$osInfo = Get-CimInstance Win32_OperatingSystem
$cpuInfo = Get-CimInstance Win32_Processor | Select-Object -First 1
$vtxEnabled = $cpuInfo.VirtualizationFirmwareEnabled
$arch = $env:PROCESSOR_ARCHITECTURE

Write-Host "[1/6] Runner Host Environment:" -ForegroundColor Yellow
Write-Host "  - OS: $($osInfo.Caption) ($arch)"
Write-Host "  - CPU: $($cpuInfo.Name)"
Write-Host "  - Virtualization Firmware Enabled: $vtxEnabled"

if (-not $vtxEnabled) {
    Write-Host "  [!] WARNING: Nested CPU hardware virtualization (VT-x/AMD-V) is not exposed on this Windows runner." -ForegroundColor DarkYellow
    Write-Host "  [!] Note: LDPlayer requires VT-x kernel drivers to boot. VirtualBox hypervisor may fail." -ForegroundColor DarkYellow
}

# 2. Automated Android SDK Platform-Tools (ADB) Setup
Write-Host "`n[2/6] Verifying / Setting Up Android SDK Platform-Tools (ADB)..." -ForegroundColor Yellow
$adbCmd = Get-Command adb -ErrorAction SilentlyContinue

if (-not $adbCmd) {
    $candidateAdbPaths = @(
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "C:\Program Files\Android\platform-tools\adb.exe",
        "C:\LDPlayer\LDPlayer9\adb.exe",
        "C:\leidian\LDPlayer9\adb.exe",
        "$env:TEMP\platform-tools\platform-tools\adb.exe",
        "$env:TEMP\platform-tools\adb.exe"
    )
    foreach ($path in $candidateAdbPaths) {
        if (Test-Path $path) {
            $adbDir = Split-Path $path -Parent
            $env:PATH = "$adbDir;$env:PATH"
            $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
            break
        }
    }
}

if (-not $adbCmd) {
    Write-Host "  ADB not found in PATH. Downloading official Android platform-tools..." -ForegroundColor Yellow
    try {
        $adbZip = "$env:TEMP\platform-tools.zip"
        $adbDest = "$env:TEMP\platform-tools"
        Invoke-WebRequest -Uri "https://dl.google.com/android/repository/platform-tools-latest-windows.zip" -OutFile $adbZip -UseBasicParsing
        Expand-Archive -Path $adbZip -DestinationPath $adbDest -Force
        $extractedAdb = "$adbDest\platform-tools"
        if (Test-Path "$extractedAdb\adb.exe") {
            $env:PATH = "$extractedAdb;$env:PATH"
            $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
            Write-Host "  [+] Android platform-tools installed to $extractedAdb" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [-] Failed to download platform-tools: $_" -ForegroundColor Red
    }
}

if ($adbCmd) {
    $verOut = & adb version | Select-Object -First 1
    Write-Host "  - ADB Status: [READY] $verOut" -ForegroundColor Green
} else {
    Write-Host "  - ADB Status: [MISSING]" -ForegroundColor Red
}

# 3. Locate or Install LDPlayer 9
Write-Host "`n[3/6] Verifying LDPlayer 9 Installation..." -ForegroundColor Yellow
$ldPaths = @(
    "C:\LDPlayer\LDPlayer9\ldconsole.exe",
    "C:\LDPlayer\LDPlayer9\dnconsole.exe",
    "C:\leidian\LDPlayer9\ldconsole.exe",
    "C:\leidian\LDPlayer9\dnconsole.exe",
    "C:\Program Files\LDPlayer\LDPlayer9\ldconsole.exe",
    "C:\Program Files (x86)\LDPlayer\LDPlayer9\ldconsole.exe",
    "D:\LDPlayer\LDPlayer9\ldconsole.exe"
)

$foundLd = $null
foreach ($p in $ldPaths) {
    if (Test-Path $p) {
        $foundLd = $p
        break
    }
}

if (-not $foundLd) {
    Write-Host "  LDPlayer 9 not found. Downloading full installer (760MB) via curl.exe..." -ForegroundColor Yellow
    $installerPath = "$env:TEMP\LDPlayer9_Installer.exe"
    try {
        & curl.exe -fSL --retry 3 --connect-timeout 30 -o $installerPath "https://encdn.ldmnq.com/download/package/LDPlayer9.exe"
        if (Test-Path $installerPath) {
            $item = Get-Item $installerPath
            $sizeMb = [math]::Round($item.Length / 1MB, 2)
            Write-Host "  [+] Downloaded LDPlayer 9 installer ($sizeMb MB) to $installerPath" -ForegroundColor Green
            # 1. First try direct 7-Zip extraction (fastest, 100% silent, zero popups)
            $sevenZip = if (Test-Path "C:\Program Files\7-Zip\7z.exe") { "C:\Program Files\7-Zip\7z.exe" } else { "7z.exe" }
            Write-Host "  Attempting direct 7-Zip extraction with $sevenZip..." -ForegroundColor Yellow
            try {
                & $sevenZip x -y "-oC:\LDPlayer\LDPlayer9" $installerPath | Out-Null
            } catch {
                Write-Host "  7-Zip direct extraction notice: $_" -ForegroundColor DarkYellow
            }

            # 2. If not extracted by 7-zip, run installer with NSIS /S /D switches
            foreach ($p in $ldPaths) {
                if (Test-Path $p) {
                    $foundLd = $p
                    break
                }
            }

            if (-not $foundLd) {
                Write-Host "  Executing NSIS silent installer: $installerPath /S /D=C:\LDPlayer\LDPlayer9..." -ForegroundColor Yellow
                $proc = Start-Process -FilePath $installerPath -ArgumentList "/S", "/D=C:\LDPlayer\LDPlayer9" -PassThru -NoNewWindow
                $exited = $proc.WaitForExit(120000)
                Write-Host "  Installer process finished (Exited: $exited, ExitCode: $($proc.ExitCode))" -ForegroundColor Cyan
            }

            Start-Sleep -Seconds 5

            # Inspect output directories recursively
            if (Test-Path "C:\LDPlayer") {
                $allFiles = Get-ChildItem "C:\LDPlayer" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 20 | ForEach-Object { $_.FullName }
                Write-Host "  [+] Found files under C:\LDPlayer:" -ForegroundColor Green
                foreach ($f in $allFiles) {
                    Write-Host "      $f" -ForegroundColor Green
                }
            }

            foreach ($p in $ldPaths) {
                if (Test-Path $p) {
                    $foundLd = $p
                    break
                }
            }

            if (-not $foundLd) {
                $foundLd = Get-ChildItem -Path @("C:\LDPlayer", "C:\leidian", "$env:ProgramFiles\LDPlayer", "$env:TEMP") -Filter "*console.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName -First 1
            }
        }
    } catch {
        Write-Host "  [-] Automated LDPlayer download notice: $_" -ForegroundColor DarkYellow
    }
}

$instanceId = if ($env:RUNNER_INDEX) { [int]$env:RUNNER_INDEX } else { 0 }
$targetPort = 5555 + ($instanceId * 2)
$targetEndpoint = "127.0.0.1:$targetPort"

if ($foundLd) {
    Write-Host "  - LDPlayer 9 Console: [FOUND] $foundLd" -ForegroundColor Green
    Write-Host "  - Launching LDPlayer instance $instanceId..." -ForegroundColor Yellow
    try {
        & $foundLd launch --index $instanceId
        Write-Host "  - Launch command sent to LDPlayer instance $instanceId." -ForegroundColor Green
    } catch {
        Write-Host "  - Warning launching instance: $_" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  - LDPlayer 9: [NOT AVAILABLE ON THIS RUNNER]" -ForegroundColor Red
    Write-Host "    Reason: Automated installation on standard cloud Windows VM requires elevated hypervisor drivers or graphics." -ForegroundColor DarkYellow
}

# 4. Wait for LDPlayer Boot & ADB Device State
Write-Host "`n[4/6] Verifying ADB Connection & Boot Completion ($targetEndpoint)..." -ForegroundColor Yellow
$bootSuccess = $false

if ($adbCmd) {
    & adb start-server
    $maxAttempts = 15
    for ($i = 1; $i -le $maxAttempts; $i++) {
        & adb connect $targetEndpoint | Out-Null
        $devices = & adb devices
        if ($devices -match "$targetEndpoint\s+device" -or $devices -match "emulator-\d+\s+device") {
            $bootCheck = & adb -s $targetEndpoint shell getprop sys.boot_completed 2>$null
            if ($bootCheck -eq "1") {
                Write-Host "  [+] LDPlayer instance is booted and ready via ADB ($targetEndpoint)!" -ForegroundColor Green
                $bootSuccess = $true
                break
            }
        }
        Write-Host "  Waiting for LDPlayer boot (attempt $i/$maxAttempts)..."
        Start-Sleep -Seconds 5
    }
}

# 5. Host & Android Network Egress Diagnostic
Write-Host "`n[5/6] Network Egress Verification:" -ForegroundColor Yellow
try {
    $hostIp = (Invoke-RestMethod -Uri "https://ipinfo.io/json" -TimeoutSec 5).ip
    Write-Host "  - Host Public IP: $hostIp"
} catch {
    Write-Host "  - Host Public IP: Query failed ($($_))"
}

if ($bootSuccess) {
    try {
        $androidIp = (& adb -s $targetEndpoint shell "curl -s https://ipinfo.io/ip" 2>$null).Trim()
        Write-Host "  - LDPlayer Android Public IP: $androidIp"
        if ($hostIp -and $androidIp -and $hostIp -eq $androidIp) {
            Write-Host "  - Egress Route: Direct Host Match" -ForegroundColor Green
        }
    } catch {
        Write-Host "  - LDPlayer Android Public IP: Query failed"
    }
}

# 6. Launch Shared Python Orchestrator Engine
Write-Host "`n[6/6] Launching Shared Booster Orchestrator..." -ForegroundColor Green
$env:EMULATOR_PROVIDER = "ldplayer"
$env:LDPLAYER_INSTANCE = "$instanceId"
$env:LDPLAYER_ADB_PORT = "$targetPort"

if (-not $bootSuccess) {
    Write-Host "`n[!] LDPlayer instance did not boot or ADB did not connect." -ForegroundColor Red
    Write-Host "    Running capability diagnostic and exiting cleanly..." -ForegroundColor Yellow
}

python -m src.main --emulator-provider ldplayer

$exitCode = $LASTEXITCODE
Write-Host "Runner session finished with exit code: $exitCode" -ForegroundColor Cyan
exit $exitCode
