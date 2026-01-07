# Employee Activity Monitor Agent

A lightweight Windows agent that tracks employee activity and sends data to the ActivityTrack dashboard.

## One-Click Installation (Recommended)

1. **Double-click `setup.bat`** - That's it!

The installer will automatically:
- Install Python if not present
- Install all required packages
- Configure auto-start on Windows login
- Launch the agent

## Manual Installation

If one-click doesn't work:

1. Install Python 3.8+ from [python.org](https://python.org) (check "Add to PATH")
2. Open Command Prompt in this folder
3. Run: `pip install -r requirements.txt`
4. Edit `config.json` and add your API key
5. Run: `python employee_agent.py`

## Configuration

Edit `config.json` to customize:

| Option | Default | Description |
|--------|---------|-------------|
| `api_key` | (required) | Employee's unique API key |
| `api_url` | (preset) | Backend API URL |
| `activity_interval` | 30 | Seconds between activity logs |
| `screenshot_interval` | 600 | Seconds between screenshots (10 min) |
| `idle_threshold` | 300 | Seconds before marked idle (5 min) |
| `screenshot_quality` | 60 | JPEG quality (1-100) |

## Getting the API Key

1. Log into the admin dashboard
2. Go to **Agent Download** page
3. Select the employee and download the personalized installer (API key pre-configured!)

Or manually:
1. Go to **Employees** page
2. Click on the employee
3. Copy the API key from the detail page

## System Tray

The agent runs in the system tray (bottom-right corner):
- **Green icon**: Running normally
- **Right-click menu**:
  - Pause/Resume: Temporarily stop tracking
  - Exit: Stop the agent

## Troubleshooting

### "Python not found"
Install from python.org and ensure "Add to PATH" is checked during installation.

### "Cannot create startup task"
Run `setup.bat` as Administrator (right-click > Run as administrator).

### "Network error"
Check internet connection and verify the API key in config.json.

### Agent not appearing in system tray
- Check Task Manager for python.exe
- Run from Command Prompt to see error messages

## Uninstallation

1. Right-click the system tray icon and select "Exit"
2. Open Task Scheduler and delete "EmployeeMonitorAgent" task
3. Delete the agent folder

---

For support, contact your IT administrator.
