# Employee Monitoring Agent

A lightweight Windows agent that monitors employee activity and sends data to the admin dashboard.

## Features

- **Activity Tracking**: Logs the currently active application every 30 seconds
- **Idle Detection**: Detects when the user is idle (no keyboard/mouse activity for 5 minutes)
- **Screenshot Capture**: Takes compressed screenshots every 10 minutes
- **System Tray**: Runs quietly in the background with a system tray icon

## Requirements

- Windows 10/11
- Python 3.8 or higher
- Internet connection

## Installation

### 1. Install Python

Download and install Python from [python.org](https://www.python.org/downloads/).

> ⚠️ **Important**: Check "Add Python to PATH" during installation!

### 2. Install the Agent

1. Copy the entire `agent` folder to the employee's computer (e.g., `C:\EmployeeMonitor\`)
2. Open Command Prompt as Administrator
3. Navigate to the agent folder:
   ```
   cd C:\EmployeeMonitor
   ```
4. Run the installer:
   ```
   install.bat
   ```

### 3. Configure the Agent

1. Open `config.json` in a text editor
2. Replace `YOUR_EMPLOYEE_API_KEY_HERE` with the employee's API key from the admin dashboard
3. Save the file

### 4. Get the API Key

1. Log into the admin dashboard
2. Go to **Employees** page
3. Click on the employee's name
4. Copy the **API Key** shown on the detail page
5. Paste it into `config.json`

## Running the Agent

### Manual Start

```
python employee_agent.py
```

### Run at Windows Startup (Recommended)

1. Press `Win + R`
2. Type `shell:startup` and press Enter
3. Right-click in the folder and select **New > Shortcut**
4. Browse to `python.exe` (usually in `C:\Users\[Username]\AppData\Local\Programs\Python\Python3X\python.exe`)
5. Add the path to the script after python.exe:
   ```
   "C:\Users\[Username]\AppData\Local\Programs\Python\Python3X\python.exe" "C:\EmployeeMonitor\employee_agent.py"
   ```
6. Name the shortcut "Employee Monitor"

## Configuration Options

Edit `config.json` to customize behavior:

| Setting | Default | Description |
|---------|---------|-------------|
| `api_key` | (required) | Employee's unique API key |
| `api_url` | (preset) | Backend API URL |
| `activity_interval` | 30 | Seconds between activity logs |
| `screenshot_interval` | 600 | Seconds between screenshots (600 = 10 min) |
| `idle_threshold` | 300 | Seconds of inactivity before marked as idle (300 = 5 min) |
| `screenshot_quality` | 60 | JPEG quality (1-100, lower = smaller files) |

## System Tray

The agent runs in the system tray (bottom-right of the taskbar):

- **Green icon**: Agent is active
- **Yellow icon**: Agent is paused
- **Right-click menu**:
  - **Pause/Resume**: Temporarily stop/start monitoring
  - **Exit**: Close the agent

## Troubleshooting

### "Invalid API key" error
- Make sure you copied the full API key from the admin dashboard
- Check that there are no extra spaces in the config.json file

### "Python is not installed" error
- Install Python from python.org
- Make sure to check "Add Python to PATH" during installation
- Restart Command Prompt after installing

### Agent not appearing in system tray
- Check if the agent is running in Task Manager (python.exe)
- Try running from Command Prompt to see error messages

### Screenshots not uploading
- Check internet connection
- Ensure the employee has permissions in the admin dashboard

## Security Notes

- The agent only **sends** data, it never receives commands
- API keys are stored locally in config.json
- Screenshots are compressed before upload to save bandwidth
- All communication uses HTTPS

## Uninstallation

1. Right-click the system tray icon and select "Exit"
2. Remove any startup shortcuts
3. Delete the agent folder

---

For support, contact your IT administrator.
