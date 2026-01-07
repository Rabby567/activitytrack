import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileCode, Settings, FileText, Terminal } from 'lucide-react';
import JSZip from 'jszip';
import { useState } from 'react';
import { toast } from 'sonner';

// Agent file contents
const agentFiles = {
  'employee_agent.py': `#!/usr/bin/env python3
"""
Employee Activity Monitoring Agent
Tracks active applications, idle status, and captures screenshots.
"""

import json
import time
import threading
import base64
import io
import os
import sys
from datetime import datetime

import requests
import pygetwindow as gw
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
            active_window = gw.getActiveWindow()
            if active_window:
                return active_window.title
        except Exception:
            pass
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
  "api_key": "YOUR_EMPLOYEE_API_KEY_HERE",
  "api_url": "https://pwtejgeeeitbhtpljnzi.supabase.co/functions/v1",
  "activity_interval": 30,
  "screenshot_interval": 600,
  "idle_threshold": 300,
  "screenshot_quality": 60
}`,
  'requirements.txt': `requests>=2.28.0
pygetwindow>=0.0.9
pynput>=1.7.6
Pillow>=9.0.0
pystray>=0.19.4`,
  'install.bat': `@echo off
echo ========================================
echo   Employee Monitor Agent Installer
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH.
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

echo Installing required packages...
pip install -r requirements.txt

if errorlevel 1 (
    echo ERROR: Failed to install packages.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit config.json and add your API key
echo 2. Run: python employee_agent.py
echo.
pause`,
  'README.md': `# Employee Activity Monitor Agent

A lightweight Windows agent that tracks employee activity and sends data to the ActivityTrack dashboard.

## Features

- **Active Window Tracking**: Monitors which application is currently in focus
- **Idle Detection**: Detects when the user is away from their computer
- **Screenshot Capture**: Takes periodic screenshots (every 10 minutes by default)
- **System Tray**: Runs quietly in the background with a system tray icon

## Requirements

- Windows 10/11
- Python 3.8 or higher
- Internet connection

## Installation

### Option 1: Quick Install (Recommended)

1. Double-click \`install.bat\`
2. Wait for dependencies to install
3. Edit \`config.json\` with your API key
4. Run \`python employee_agent.py\`

### Option 2: Manual Install

1. Install Python dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

2. Configure the agent by editing \`config.json\`:
   \`\`\`json
   {
     "api_key": "YOUR_EMPLOYEE_API_KEY_HERE",
     "api_url": "https://your-project.supabase.co/functions/v1",
     "activity_interval": 30,
     "screenshot_interval": 600,
     "idle_threshold": 300,
     "screenshot_quality": 60
   }
   \`\`\`

3. Run the agent:
   \`\`\`bash
   python employee_agent.py
   \`\`\`

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| \`api_key\` | Employee's unique API key (from admin dashboard) | Required |
| \`api_url\` | Backend API URL | Required |
| \`activity_interval\` | Seconds between activity logs | 30 |
| \`screenshot_interval\` | Seconds between screenshots | 600 (10 min) |
| \`idle_threshold\` | Seconds of inactivity before marked idle | 300 (5 min) |
| \`screenshot_quality\` | JPEG quality for screenshots (1-100) | 60 |

## Getting the API Key

1. Log into the ActivityTrack admin dashboard
2. Go to the Employees page
3. Find the employee and click on their row
4. Copy the API key from the employee details page

## Running at Startup (Optional)

To run the agent automatically when Windows starts:

1. Press \`Win + R\`, type \`shell:startup\`, press Enter
2. Create a shortcut to \`employee_agent.py\` in this folder
3. Right-click the shortcut > Properties > Change "Start in" to the agent folder

## System Tray Usage

Once running, the agent appears in the system tray (bottom-right corner):

- **Green icon**: Agent is running normally
- **Right-click menu**:
  - Pause/Resume: Temporarily stop tracking
  - Exit: Stop the agent completely

## Troubleshooting

### "Python is not recognized"
Install Python from [python.org](https://python.org) and check "Add to PATH" during installation.

### "Failed to install packages"
Run Command Prompt as Administrator and try again.

### "Network error"
Check your internet connection and verify the API URL in config.json.

### Screenshots not uploading
Verify your API key is correct and the employee exists in the system.

## Privacy Notice

This agent:
- Tracks active window titles
- Monitors keyboard/mouse activity (for idle detection only, no keylogging)
- Captures screenshots at configurable intervals
- Sends data only to your organization's ActivityTrack server

All data is transmitted securely over HTTPS.
`
};

export default function AgentDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadAgentZip = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('employee-agent');
      
      if (!folder) {
        throw new Error('Failed to create folder');
      }
      
      // Add all files to the ZIP
      Object.entries(agentFiles).forEach(([filename, content]) => {
        folder.file(filename, content);
      });
      
      // Generate the ZIP file
      const blob = await zip.generateAsync({ type: 'blob' });
      
      // Download the file
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'employee-agent.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Agent downloaded successfully!');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download agent files');
    } finally {
      setIsDownloading(false);
    }
  };

  const files = [
    { name: 'employee_agent.py', icon: FileCode, description: 'Main Python agent script' },
    { name: 'config.json', icon: Settings, description: 'Configuration file (API key, intervals)' },
    { name: 'requirements.txt', icon: FileText, description: 'Python dependencies' },
    { name: 'install.bat', icon: Terminal, description: 'Windows installer script' },
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
          {/* Download Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Download Agent
              </CardTitle>
              <CardDescription>
                Get the complete agent package as a ZIP file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={downloadAgentZip} 
                disabled={isDownloading}
                className="w-full"
                size="lg"
              >
                <Download className="mr-2 h-5 w-5" />
                {isDownloading ? 'Preparing download...' : 'Download Agent ZIP'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Contains Python agent, configuration, and installation scripts for Windows.
              </p>
            </CardContent>
          </Card>

          {/* Requirements Card */}
          <Card>
            <CardHeader>
              <CardTitle>System Requirements</CardTitle>
              <CardDescription>
                What's needed to run the agent
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
                  Python 3.8 or higher
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Internet connection
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Employee API key (from dashboard)
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Files List */}
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

        {/* Installation Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Installation Guide</CardTitle>
            <CardDescription>
              Steps to deploy the agent on employee computers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                <div>
                  <p className="font-medium">Download and extract</p>
                  <p className="text-muted-foreground">Download the ZIP file and extract it to the employee's computer (e.g., C:\EmployeeMonitor)</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                <div>
                  <p className="font-medium">Run the installer</p>
                  <p className="text-muted-foreground">Double-click install.bat to install Python dependencies</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                <div>
                  <p className="font-medium">Configure API key</p>
                  <p className="text-muted-foreground">Open config.json and replace YOUR_EMPLOYEE_API_KEY_HERE with the employee's API key from the Employees page</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">4</span>
                <div>
                  <p className="font-medium">Start the agent</p>
                  <p className="text-muted-foreground">Run python employee_agent.py - it will appear in the system tray</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
