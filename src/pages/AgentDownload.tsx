import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileCode, Settings, FileText, Terminal, User, Zap, Copy, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import JSZip from 'jszip';
import { useState } from 'react';
import { toast } from 'sonner';
import { useEmployees } from '@/hooks/useEmployees';

// Agent file contents generator
const getAgentFiles = (apiKey?: string) => ({
  'employee_agent.py': `#!/usr/bin/env python3
"""
Employee Activity Monitoring Agent
Tracks active applications, idle status, and captures screenshots.
"""

import json
import time
import threading
import io
import os
import sys
from datetime import datetime

import requests
import win32gui
from pynput import mouse, keyboard
from PIL import ImageGrab
import pystray
from PIL import Image

class EmployeeAgent:
    def __init__(self, config_path='config.json'):
        self.load_config(config_path)
        self.last_activity_time = time.time()
        self.is_idle = False
        self.is_running = True
        self.is_paused = False
        self.current_app = ""
        self.icon = None
        
    def load_config(self, config_path):
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
            self.api_key = config.get('api_key', '')
            self.api_url = config.get('api_url', '')
            self.activity_interval = config.get('activity_interval', 30)
            self.screenshot_interval = config.get('screenshot_interval', 600)
            self.idle_threshold = config.get('idle_threshold', 300)
            self.screenshot_quality = config.get('screenshot_quality', 60)
        except FileNotFoundError:
            print(f"Config file not found: {config_path}")
            sys.exit(1)
        except json.JSONDecodeError:
            print(f"Invalid JSON in config file: {config_path}")
            sys.exit(1)
    
    def get_active_window(self):
        """Get the title of the currently active window."""
        try:
            hwnd = win32gui.GetForegroundWindow()
            title = win32gui.GetWindowText(hwnd)
            return title if title else "Unknown"
        except Exception:
            return "Unknown"
    
    def on_activity(self, *args):
        """Called when keyboard or mouse activity is detected."""
        self.last_activity_time = time.time()
        if self.is_idle:
            self.is_idle = False
    
    def check_idle_status(self):
        """Check if user has been idle for too long."""
        idle_time = time.time() - self.last_activity_time
        if idle_time > self.idle_threshold:
            self.is_idle = True
        return self.is_idle
    
    def log_activity(self):
        """Send activity log to the server."""
        if self.is_paused or not self.api_key:
            return
            
        self.current_app = self.get_active_window()
        status = "idle" if self.check_idle_status() else "working"
        
        try:
            response = requests.post(
                f"{self.api_url}/log-activity",
                headers={
                    'x-api-key': self.api_key,
                    'Content-Type': 'application/json'
                },
                json={
                    'app_name': self.current_app,
                    'status': status,
                    'duration_seconds': self.activity_interval
                },
                timeout=10
            )
            if response.status_code == 200:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Logged: {self.current_app[:30]} ({status})")
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Failed to log activity: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Network error: {e}")
    
    def capture_screenshot(self):
        """Capture and upload a screenshot."""
        if self.is_paused or not self.api_key:
            return
            
        try:
            # Capture screenshot
            screenshot = ImageGrab.grab()
            
            # Compress to JPEG
            buffer = io.BytesIO()
            screenshot.save(buffer, format='JPEG', quality=self.screenshot_quality)
            buffer.seek(0)
            
            # Upload
            response = requests.post(
                f"{self.api_url}/upload-screenshot",
                headers={
                    'x-api-key': self.api_key
                },
                files={
                    'screenshot': ('screenshot.jpg', buffer, 'image/jpeg')
                },
                timeout=30
            )
            
            if response.status_code == 200:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Screenshot uploaded successfully")
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Failed to upload screenshot: {response.status_code}")
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Screenshot error: {e}")
    
    def activity_loop(self):
        """Main loop for activity logging."""
        while self.is_running:
            if not self.is_paused:
                self.log_activity()
            time.sleep(self.activity_interval)
    
    def screenshot_loop(self):
        """Main loop for screenshot capture."""
        while self.is_running:
            if not self.is_paused:
                self.capture_screenshot()
            time.sleep(self.screenshot_interval)
    
    def create_tray_icon(self):
        """Create system tray icon."""
        # Create a simple icon
        icon_image = Image.new('RGB', (64, 64), color='green')
        
        menu = pystray.Menu(
            pystray.MenuItem('Status: Running', lambda: None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Pause', self.toggle_pause),
            pystray.MenuItem('Exit', self.stop)
        )
        
        self.icon = pystray.Icon(
            'EmployeeMonitor',
            icon_image,
            'Employee Monitor',
            menu
        )
        return self.icon
    
    def toggle_pause(self):
        """Toggle pause state."""
        self.is_paused = not self.is_paused
        status = "Paused" if self.is_paused else "Running"
        print(f"Agent {status}")
    
    def stop(self):
        """Stop the agent."""
        self.is_running = False
        if self.icon:
            self.icon.stop()
    
    def start(self):
        """Start the agent."""
        print("Starting Employee Monitor Agent...")
        print(f"API URL: {self.api_url}")
        print(f"Activity interval: {self.activity_interval}s")
        print(f"Screenshot interval: {self.screenshot_interval}s")
        print(f"Idle threshold: {self.idle_threshold}s")
        print("-" * 40)
        
        # Start input listeners
        mouse_listener = mouse.Listener(on_move=self.on_activity, on_click=self.on_activity)
        keyboard_listener = keyboard.Listener(on_press=self.on_activity)
        mouse_listener.start()
        keyboard_listener.start()
        
        # Start activity logging thread
        activity_thread = threading.Thread(target=self.activity_loop, daemon=True)
        activity_thread.start()
        
        # Start screenshot thread
        screenshot_thread = threading.Thread(target=self.screenshot_loop, daemon=True)
        screenshot_thread.start()
        
        # Create and run system tray icon (blocks)
        icon = self.create_tray_icon()
        icon.run()


if __name__ == '__main__':
    agent = EmployeeAgent()
    agent.start()
`,
  'config.json': `{
  "api_key": "${apiKey || 'YOUR_EMPLOYEE_API_KEY_HERE'}",
  "api_url": "https://pwtejgeeeitbhtpljnzi.supabase.co/functions/v1",
  "activity_interval": 30,
  "screenshot_interval": 600,
  "idle_threshold": 300,
  "screenshot_quality": 60
}`,
  'requirements.txt': `requests>=2.28.0
pywin32>=306
pynput>=1.7.6
Pillow>=9.0.0
pystray>=0.19.4
psutil>=5.9.0`,
  'setup.bat': `@echo off
:: ============================================
:: Employee Monitor Agent - One-Click Setup
:: ============================================
:: Double-click this file to install the agent
:: ============================================

echo.
echo Starting one-click installation...
echo.

:: Run PowerShell installer with bypass policy
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"

:: If PowerShell fails, show message
if errorlevel 1 (
    echo.
    echo ============================================
    echo   Installation encountered an issue
    echo ============================================
    echo.
    echo If you see an error, try running as Administrator:
    echo   Right-click setup.bat ^> Run as administrator
    echo.
    pause
)
`,
  'install.ps1': `# ============================================
# Employee Monitor Agent - One-Click Installer
# ============================================

$ErrorActionPreference = "Stop"

function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host $msg -ForegroundColor Red }

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
        if ($version -match "Python 3\\.([0-9]+)") {
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
    
    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    
    if ($hasWinget) {
        Write-Info "  Installing Python via winget..."
        winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Start-Sleep -Seconds 5
        $pythonCmd = "python"
    } else {
        Write-Info "  Downloading Python installer..."
        $pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
        $installerPath = "$env:TEMP\\python-installer.exe"
        
        try {
            Invoke-WebRequest -Uri $pythonUrl -OutFile $installerPath -UseBasicParsing
            Write-Info "  Running Python installer (this may take a few minutes)..."
            Start-Process -FilePath $installerPath -ArgumentList "/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_test=0" -Wait
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Remove-Item $installerPath -ErrorAction SilentlyContinue
            $pythonCmd = "python"
            Write-Success "  Python installed successfully!"
        } catch {
            Write-Err "  Failed to install Python. Please install manually from https://python.org"
            Write-Host "Press any key to exit..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
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

# Step 3: Verify config
Write-Host ""
Write-Info "[Step 3/4] Checking configuration..."

$configPath = Join-Path $scriptDir "config.json"
if (Test-Path $configPath) {
    $config = Get-Content $configPath | ConvertFrom-Json
    if ($config.api_key -eq "YOUR_EMPLOYEE_API_KEY_HERE") {
        Write-Warn "  Warning: API key not configured!"
    } else {
        Write-Success "  Configuration found with API key set!"
    }
} else {
    Write-Err "  config.json not found!"
    exit 1
}

# Step 4: Create startup task
Write-Host ""
Write-Info "[Step 4/4] Setting up auto-start..."

$taskName = "EmployeeMonitorAgent"
$pythonPath = (Get-Command $pythonCmd -ErrorAction SilentlyContinue).Source
if (-not $pythonPath) { $pythonPath = $pythonCmd }

$pythonwPath = $pythonPath -replace "python\\.exe$", "pythonw.exe"
if (-not (Test-Path $pythonwPath)) { $pythonwPath = $pythonPath }

$agentScript = Join-Path $scriptDir "employee_agent.py"

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

try {
    $action = New-ScheduledTaskAction -Execute $pythonwPath -Argument "\`"$agentScript\`"" -WorkingDirectory $scriptDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null
    Write-Success "  Agent will start automatically on login!"
} catch {
    Write-Warn "  Could not create startup task"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

$launchNow = Read-Host "Start the agent now? (Y/n)"
if ($launchNow -ne "n" -and $launchNow -ne "N") {
    Write-Info "Launching Employee Monitor Agent..."
    Start-Process -FilePath $pythonCmd -ArgumentList "\`"$agentScript\`"" -WorkingDirectory $scriptDir
    Write-Success "Agent is now running in the system tray!"
}

Write-Host ""
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
`,
  'README.md': `# Employee Activity Monitor Agent

A lightweight Windows agent that tracks employee activity and sends data to the ActivityTrack dashboard.

## One-Click Installation (Recommended)

1. **Double-click \`setup.bat\`** - That's it!

The installer will automatically:
- Install Python if not present
- Install all required packages
- Configure auto-start on Windows login
- Launch the agent

## Manual Installation

If one-click doesn't work:

1. Install Python 3.8+ from [python.org](https://python.org)
2. Open Command Prompt in this folder
3. Run: \`pip install -r requirements.txt\`
4. Run: \`python employee_agent.py\`

## Configuration

Edit \`config.json\` to customize:

| Option | Default | Description |
|--------|---------|-------------|
| \`api_key\` | (required) | Employee's unique API key |
| \`activity_interval\` | 30 | Seconds between activity logs |
| \`screenshot_interval\` | 600 | Seconds between screenshots |
| \`idle_threshold\` | 300 | Seconds before marked idle |

## System Tray

The agent runs in the system tray (bottom-right corner):
- **Green icon**: Running normally
- **Right-click**: Pause/Resume or Exit

## Troubleshooting

**"Python not found"**: Install from python.org, ensure "Add to PATH" is checked.

**"Cannot create startup task"**: Run setup.bat as Administrator.

**"Network error"**: Check internet connection and verify API key.
`
});

export default function AgentDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { employees, loading } = useEmployees();

  const selectedEmployeeData = employees.find(e => e.id === selectedEmployee);

  const downloadAgentZip = async (withApiKey: boolean = false) => {
    setIsDownloading(true);
    try {
      const apiKey = withApiKey && selectedEmployeeData ? selectedEmployeeData.api_key : undefined;
      const agentFiles = getAgentFiles(apiKey);
      
      const zip = new JSZip();
      const folderName = selectedEmployeeData 
        ? `employee-agent-${selectedEmployeeData.name.replace(/\s+/g, '-').toLowerCase()}`
        : 'employee-agent';
      const folder = zip.folder(folderName);
      
      if (!folder) {
        throw new Error('Failed to create folder');
      }
      
      Object.entries(agentFiles).forEach(([filename, content]) => {
        folder.file(filename, content);
      });
      
      const blob = await zip.generateAsync({ type: 'blob' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(withApiKey 
        ? `Personalized installer for ${selectedEmployeeData?.name} downloaded!`
        : 'Agent downloaded successfully!'
      );
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download agent files');
    } finally {
      setIsDownloading(false);
    }
  };

  const copyApiKey = () => {
    if (selectedEmployeeData?.api_key) {
      navigator.clipboard.writeText(selectedEmployeeData.api_key);
      setCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const files = [
    { name: 'setup.bat', icon: Zap, description: 'One-click installer - double-click to install' },
    { name: 'employee_agent.py', icon: FileCode, description: 'Main Python agent script' },
    { name: 'config.json', icon: Settings, description: 'Configuration file (API key, intervals)' },
    { name: 'install.ps1', icon: Terminal, description: 'PowerShell installer script' },
    { name: 'requirements.txt', icon: FileText, description: 'Python dependencies' },
    { name: 'README.md', icon: FileText, description: 'Setup and usage instructions' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agent Download</h1>
          <p className="text-muted-foreground mt-1">
            Download the employee monitoring agent for Windows computers
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* One-Click Installer Card */}
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                One-Click Installer
              </CardTitle>
              <CardDescription>
                Download a personalized installer with API key pre-configured
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee-select">Select Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger id="employee-select">
                    <SelectValue placeholder="Choose an employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loading ? (
                      <SelectItem value="loading" disabled>Loading employees...</SelectItem>
                    ) : employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees found</SelectItem>
                    ) : (
                      employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {employee.name} ({employee.employee_code})
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedEmployeeData && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">API Key:</span>
                    <Button variant="ghost" size="sm" onClick={copyApiKey}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <code className="text-xs break-all block">
                    {selectedEmployeeData.api_key.slice(0, 8)}...{selectedEmployeeData.api_key.slice(-4)}
                  </code>
                </div>
              )}

              <Button 
                onClick={() => downloadAgentZip(true)} 
                disabled={isDownloading || !selectedEmployee}
                className="w-full"
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                {isDownloading ? 'Preparing...' : 'Download Personalized Installer'}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Just double-click <code>setup.bat</code> on the employee's PC - no manual configuration needed!
              </p>
            </CardContent>
          </Card>

          {/* Generic Download Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Generic Agent Package
              </CardTitle>
              <CardDescription>
                Download without pre-configured API key
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => downloadAgentZip(false)} 
                disabled={isDownloading}
                className="w-full"
                variant="outline"
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                {isDownloading ? 'Preparing...' : 'Download Generic Agent'}
              </Button>
              <p className="text-sm text-muted-foreground">
                API key must be manually added to <code>config.json</code> after installation.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Installation Steps - Updated */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              One-Click Installation Guide
            </CardTitle>
            <CardDescription>
              Deploying has never been easier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                <div>
                  <p className="font-medium">Select employee & download</p>
                  <p className="text-muted-foreground">Choose the employee above and download their personalized installer</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                <div>
                  <p className="font-medium">Extract & run</p>
                  <p className="text-muted-foreground">Extract the ZIP on the employee's PC and double-click <code className="bg-muted px-1 rounded">setup.bat</code></p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                <div>
                  <p className="font-medium">Done!</p>
                  <p className="text-muted-foreground">The installer handles Python, dependencies, auto-start, and launches the agent automatically</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Package Contents */}
        <Card>
          <CardHeader>
            <CardTitle>Package Contents</CardTitle>
            <CardDescription>
              Files included in the agent package
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {files.map((file) => (
                <div key={file.name} className="flex items-center gap-4 py-3">
                  <file.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>System Requirements</CardTitle>
            <CardDescription>
              The one-click installer handles most requirements automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Windows 10 or 11
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Python 3.8+ <span className="text-muted-foreground">(auto-installed if missing)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Internet connection
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
