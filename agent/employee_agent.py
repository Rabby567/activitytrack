"""
Employee Monitoring Agent for Windows
Tracks active applications, idle status, and captures periodic screenshots.
"""

import json
import time
import threading
import requests
import io
import os
import sys
from datetime import datetime
from PIL import ImageGrab
import win32gui
from pynput import mouse, keyboard
import pystray
from PIL import Image

# Load configuration
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')

def load_config():
    with open(CONFIG_PATH, 'r') as f:
        return json.load(f)

config = load_config()

API_KEY = config['api_key']
API_URL = config['api_url']
ACTIVITY_INTERVAL = config.get('activity_interval', 30)
SCREENSHOT_INTERVAL = config.get('screenshot_interval', 600)
IDLE_THRESHOLD = config.get('idle_threshold', 300)
SCREENSHOT_QUALITY = config.get('screenshot_quality', 60)

# Global state
last_activity_time = time.time()
is_running = True
is_paused = False
current_status = "working"

def update_activity():
    """Called on any user activity to reset idle timer."""
    global last_activity_time, current_status
    last_activity_time = time.time()
    current_status = "working"

def on_mouse_activity(x, y, button=None, pressed=None):
    update_activity()

def on_keyboard_activity(key):
    update_activity()

def get_active_window():
    """Get the title of the currently active window."""
    try:
        hwnd = win32gui.GetForegroundWindow()
        title = win32gui.GetWindowText(hwnd)
        return title if title else "Unknown"
    except Exception:
        return "Unknown"

def check_idle_status():
    """Check if user is idle based on last activity time."""
    global current_status
    idle_seconds = time.time() - last_activity_time
    if idle_seconds > IDLE_THRESHOLD:
        current_status = "idle"
    else:
        current_status = "working"
    return current_status

def log_activity():
    """Send activity log to the server."""
    if is_paused:
        return
    
    try:
        status = check_idle_status()
        app_name = get_active_window()
        
        response = requests.post(
            f"{API_URL}/log-activity",
            headers={
                "x-api-key": API_KEY,
                "Content-Type": "application/json"
            },
            json={
                "app_name": app_name,
                "status": status,
                "duration_seconds": ACTIVITY_INTERVAL
            },
            timeout=10
        )
        
        if response.status_code == 200:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Activity logged: {app_name} ({status})")
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Failed to log activity: {response.status_code}")
    
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Error logging activity: {e}")

def capture_screenshot():
    """Capture and upload a screenshot."""
    if is_paused:
        return
    
    try:
        # Capture screenshot
        screenshot = ImageGrab.grab()
        
        # Compress to JPEG
        buffer = io.BytesIO()
        screenshot.save(buffer, format='JPEG', quality=SCREENSHOT_QUALITY)
        buffer.seek(0)
        
        # Upload
        response = requests.post(
            f"{API_URL}/upload-screenshot",
            headers={
                "x-api-key": API_KEY
            },
            files={
                "screenshot": ("screenshot.jpg", buffer, "image/jpeg")
            },
            timeout=30
        )
        
        if response.status_code == 200:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Screenshot uploaded successfully")
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Failed to upload screenshot: {response.status_code}")
    
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Error capturing screenshot: {e}")

def activity_loop():
    """Background loop for activity logging."""
    while is_running:
        if not is_paused:
            log_activity()
        time.sleep(ACTIVITY_INTERVAL)

def screenshot_loop():
    """Background loop for screenshot capture."""
    while is_running:
        if not is_paused:
            capture_screenshot()
        time.sleep(SCREENSHOT_INTERVAL)

def create_tray_icon():
    """Create system tray icon with menu."""
    global is_paused, is_running
    
    # Create a simple icon (green circle)
    def create_image():
        img = Image.new('RGB', (64, 64), color=(0, 128, 0) if not is_paused else (128, 128, 0))
        return img
    
    def on_pause(icon, item):
        global is_paused
        is_paused = not is_paused
        icon.icon = create_image()
        icon.title = "Employee Monitor (Paused)" if is_paused else "Employee Monitor (Active)"
    
    def on_exit(icon, item):
        global is_running
        is_running = False
        icon.stop()
    
    menu = pystray.Menu(
        pystray.MenuItem("Pause/Resume", on_pause),
        pystray.MenuItem("Exit", on_exit)
    )
    
    icon = pystray.Icon(
        "employee_monitor",
        create_image(),
        "Employee Monitor (Active)",
        menu
    )
    
    return icon

def start_listeners():
    """Start keyboard and mouse listeners."""
    mouse_listener = mouse.Listener(on_move=on_mouse_activity, on_click=on_mouse_activity)
    keyboard_listener = keyboard.Listener(on_press=on_keyboard_activity)
    
    mouse_listener.start()
    keyboard_listener.start()
    
    return mouse_listener, keyboard_listener

def main():
    print("=" * 50)
    print("Employee Monitoring Agent")
    print("=" * 50)
    print(f"API URL: {API_URL}")
    print(f"Activity Interval: {ACTIVITY_INTERVAL}s")
    print(f"Screenshot Interval: {SCREENSHOT_INTERVAL}s")
    print(f"Idle Threshold: {IDLE_THRESHOLD}s")
    print("=" * 50)
    print("Starting monitoring...")
    print("Look for the green icon in your system tray.")
    print("=" * 50)
    
    # Validate API key first
    try:
        response = requests.post(
            f"{API_URL}/log-activity",
            headers={
                "x-api-key": API_KEY,
                "Content-Type": "application/json"
            },
            json={
                "app_name": "Agent Started",
                "status": "working",
                "duration_seconds": 0
            },
            timeout=10
        )
        
        if response.status_code == 401:
            print("ERROR: Invalid API key. Please check your config.json file.")
            input("Press Enter to exit...")
            sys.exit(1)
        elif response.status_code == 200:
            print("API key validated successfully!")
    except Exception as e:
        print(f"WARNING: Could not validate API key: {e}")
        print("Continuing anyway...")
    
    # Start activity listeners
    mouse_listener, keyboard_listener = start_listeners()
    
    # Start background threads
    activity_thread = threading.Thread(target=activity_loop, daemon=True)
    screenshot_thread = threading.Thread(target=screenshot_loop, daemon=True)
    
    activity_thread.start()
    screenshot_thread.start()
    
    # Create and run system tray icon (this blocks)
    icon = create_tray_icon()
    icon.run()
    
    # Cleanup
    mouse_listener.stop()
    keyboard_listener.stop()
    print("Agent stopped.")

if __name__ == "__main__":
    main()
