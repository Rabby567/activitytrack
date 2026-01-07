#!/usr/bin/env python3
"""
Employee Activity Monitoring Agent
Protected agent with anti-tampering features.
Requires admin approval to close or uninstall.
"""

import json
import time
import threading
import io
import os
import sys
import atexit
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
        self.current_app = ""
        self.icon = None
        self.pending_request_id = None
        self.close_approved = False
        
        # Register cleanup to restart on unexpected exit
        atexit.register(self.on_unexpected_exit)
        
    def load_config(self, config_path):
        """Load configuration from JSON file."""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(script_dir, config_path)
        try:
            with open(full_path, 'r') as f:
                config = json.load(f)
            self.api_key = config.get('api_key', '')
            self.api_url = config.get('api_url', '')
            self.activity_interval = config.get('activity_interval', 30)
            self.screenshot_interval = config.get('screenshot_interval', 600)
            self.idle_threshold = config.get('idle_threshold', 300)
            self.screenshot_quality = config.get('screenshot_quality', 60)
        except FileNotFoundError:
            print(f"Config file not found: {full_path}")
            sys.exit(1)
        except json.JSONDecodeError:
            print(f"Invalid JSON in config file: {full_path}")
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
        if not self.api_key:
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
        if not self.api_key:
            return
            
        try:
            screenshot = ImageGrab.grab()
            buffer = io.BytesIO()
            screenshot.save(buffer, format='JPEG', quality=self.screenshot_quality)
            buffer.seek(0)
            
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
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Screenshot uploaded")
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Screenshot failed: {response.status_code}")
        except Exception as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Screenshot error: {e}")
    
    def activity_loop(self):
        """Main loop for activity logging."""
        while self.is_running:
            self.log_activity()
            time.sleep(self.activity_interval)
    
    def screenshot_loop(self):
        """Main loop for screenshot capture."""
        while self.is_running:
            self.capture_screenshot()
            time.sleep(self.screenshot_interval)
    
    def request_close_permission(self):
        """Request permission from admin to close the agent."""
        if self.pending_request_id:
            print("Close request already pending...")
            self.check_permission_status()
            return
        
        try:
            response = requests.post(
                f"{self.api_url}/agent-request",
                headers={
                    'x-api-key': self.api_key,
                    'Content-Type': 'application/json'
                },
                json={'request_type': 'close'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.pending_request_id = data.get('request_id')
                print(f"Close request submitted. Waiting for admin approval...")
                print(f"Request ID: {self.pending_request_id}")
                # Start polling for approval
                threading.Thread(target=self.poll_for_approval, daemon=True).start()
            else:
                print(f"Failed to submit close request: {response.status_code}")
        except Exception as e:
            print(f"Error requesting close permission: {e}")
    
    def poll_for_approval(self):
        """Poll the server to check if close request was approved."""
        while self.pending_request_id and self.is_running:
            try:
                response = requests.get(
                    f"{self.api_url}/check-permission?request_id={self.pending_request_id}",
                    headers={'x-api-key': self.api_key},
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status')
                    
                    if status == 'approved':
                        print("Close request APPROVED by admin!")
                        self.close_approved = True
                        self.pending_request_id = None
                        self.stop()
                        return
                    elif status == 'denied':
                        reason = data.get('reason', 'No reason provided')
                        print(f"Close request DENIED: {reason}")
                        self.pending_request_id = None
                        return
                    # Still pending, continue polling
            except Exception as e:
                print(f"Error checking permission: {e}")
            
            time.sleep(5)  # Poll every 5 seconds
    
    def check_permission_status(self):
        """Check current permission request status."""
        if not self.pending_request_id:
            print("No pending request")
            return
        print(f"Checking status of request {self.pending_request_id}...")
    
    def on_unexpected_exit(self):
        """Called on unexpected exit - schedule restart."""
        if not self.close_approved and self.is_running:
            # Restart the agent
            script_path = os.path.abspath(__file__)
            os.system(f'start "" pythonw "{script_path}"')
    
    def create_tray_icon(self):
        """Create system tray icon with limited menu (no exit option)."""
        icon_image = Image.new('RGB', (64, 64), color='green')
        
        menu = pystray.Menu(
            pystray.MenuItem('Status: Active', lambda: None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Request Close (Requires Approval)', self.on_request_close)
        )
        
        self.icon = pystray.Icon(
            'EmployeeMonitor',
            icon_image,
            'Employee Monitor (Protected)',
            menu
        )
        return self.icon
    
    def on_request_close(self):
        """Handle close request from tray menu."""
        self.request_close_permission()
    
    def stop(self):
        """Stop the agent (only after approval)."""
        if not self.close_approved:
            print("Cannot stop without admin approval")
            return
        
        self.is_running = False
        if self.icon:
            self.icon.stop()
    
    def start(self):
        """Start the agent."""
        print("=" * 50)
        print("  Employee Monitor Agent (Protected)")
        print("=" * 50)
        print(f"API URL: {self.api_url}")
        print(f"Activity interval: {self.activity_interval}s")
        print(f"Screenshot interval: {self.screenshot_interval}s")
        print("NOTE: This agent requires admin approval to close")
        print("=" * 50)
        
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
