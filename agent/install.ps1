# ============================================
# Employee Monitor Agent - One-Click Installer
# ============================================
# This script automatically:
# 1. Checks/installs Python
# 2. Installs required packages
# 3. Creates a Windows startup task
# 4. Launches the agent
# ============================================

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host $msg -ForegroundColor Red }

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Employee Monitor Agent - One-Click Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check/Install Python
Write-Info "[Step 1/4] Checking Python installation..."

$pythonCmd = $null
$pythonPaths = @("python", "python3", "py")

foreach ($cmd in $pythonPaths) {
    try {
        $version = & $cmd --version 2>&1
        if ($version -match "Python 3\.(\d+)") {
            $minorVersion = [int]$Matches[1]
            if ($minorVersion -ge 8) {
                $pythonCmd = $cmd
                Write-Success "  Found: $version"
                break
            }
        }
    } catch {}
}

if (-not $pythonCmd) {
    Write-Warn "  Python 3.8+ not found. Installing Python..."
    
    # Check if winget is available
    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    
    if ($hasWinget) {
        Write-Info "  Installing Python via winget..."
        winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Wait for installation
        Start-Sleep -Seconds 5
        $pythonCmd = "python"
    } else {
        # Download Python installer directly
        Write-Info "  Downloading Python installer..."
        $pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
        $installerPath = "$env:TEMP\python-installer.exe"
        
        try {
            Invoke-WebRequest -Uri $pythonUrl -OutFile $installerPath -UseBasicParsing
            
            Write-Info "  Running Python installer (this may take a few minutes)..."
            Start-Process -FilePath $installerPath -ArgumentList "/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_test=0" -Wait
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            
            Remove-Item $installerPath -ErrorAction SilentlyContinue
            $pythonCmd = "python"
            
            Write-Success "  Python installed successfully!"
        } catch {
            Write-Err "  Failed to install Python automatically."
            Write-Err "  Please install Python 3.8+ manually from https://python.org"
            Write-Host ""
            Write-Host "Press any key to exit..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
    }
    
    # Verify installation
    try {
        $version = & $pythonCmd --version 2>&1
        Write-Success "  Installed: $version"
    } catch {
        Write-Err "  Python installation failed. Please install manually."
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Step 2: Install Python packages
Write-Host ""
Write-Info "[Step 2/4] Installing Python packages..."

try {
    # First upgrade pip
    Write-Info "  Upgrading pip..."
    & $pythonCmd -m pip install --upgrade pip 2>&1 | Out-Null
    
    # Install packages with visible output
    Write-Info "  Installing dependencies (this may take a minute)..."
    $pipResult = & $pythonCmd -m pip install -r requirements.txt 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "  Package installation failed!"
        Write-Err "  Error details:"
        $pipResult | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        throw "pip install failed"
    }
    
    Write-Success "  All packages installed successfully!"
} catch {
    Write-Err "  Failed to install packages"
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "  Troubleshooting Tips:" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Warn "  1. Try running as Administrator"
    Write-Warn "  2. Check your internet connection"
    Write-Warn "  3. If error persists, try: pip install pywin32 pynput Pillow pystray psutil requests"
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Step 3: Verify config.json
Write-Host ""
Write-Info "[Step 3/4] Checking configuration..."

$configPath = Join-Path $scriptDir "config.json"
if (Test-Path $configPath) {
    $config = Get-Content $configPath | ConvertFrom-Json
    if ($config.api_key -eq "YOUR_EMPLOYEE_API_KEY_HERE") {
        Write-Warn "  Warning: API key not configured!"
        Write-Warn "  Please edit config.json and add the employee's API key."
    } else {
        Write-Success "  Configuration found with API key set!"
    }
} else {
    Write-Err "  config.json not found!"
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Step 4: Create startup task
Write-Host ""
Write-Info "[Step 4/4] Setting up auto-start..."

$taskName = "EmployeeMonitorAgent"
$pythonPath = (Get-Command $pythonCmd -ErrorAction SilentlyContinue).Source
if (-not $pythonPath) {
    $pythonPath = $pythonCmd
}

# Use pythonw for silent background execution
$pythonwPath = $pythonPath -replace "python\.exe$", "pythonw.exe"
if (-not (Test-Path $pythonwPath)) {
    $pythonwPath = $pythonPath
}

$agentScript = Join-Path $scriptDir "employee_agent.py"

# Remove existing task if present
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Info "  Removed existing startup task"
}

# Create new scheduled task
try {
    $action = New-ScheduledTaskAction -Execute $pythonwPath -Argument "`"$agentScript`"" -WorkingDirectory $scriptDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    Write-Success "  Agent will start automatically on login!"
} catch {
    Write-Warn "  Could not create startup task (requires admin for some systems)"
    Write-Warn "  You can manually add to startup folder if needed"
}

# Launch the agent now
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

$launchNow = Read-Host "Start the agent now? (Y/n)"
if ($launchNow -ne "n" -and $launchNow -ne "N") {
    Write-Info "Launching Employee Monitor Agent..."
    Start-Process -FilePath $pythonCmd -ArgumentList "`"$agentScript`"" -WorkingDirectory $scriptDir
    Write-Success "Agent is now running in the system tray!"
}

Write-Host ""
Write-Host "The agent will run in the background and start automatically on login."
Write-Host "Look for the green icon in the system tray (bottom-right corner)."
Write-Host ""
Write-Host "Press any key to close this window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
