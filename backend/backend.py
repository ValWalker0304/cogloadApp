import time
import threading
import queue
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import statistics
from enum import Enum
from collections import deque
import math

import socket
import json


# --- WATCH CONFIGURATION (HARDCODED FOR TESTING) ---
WATCH_IP = '10.208.35.238' 
WATCH_PORT = 8080          
LISTENER_PORT = 8081      


try:
    from pynput import keyboard, mouse
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False

class AlertType(Enum):
    FOCUS_DROP = "focus_drop"
    BREAK_SUGGESTION = "break_suggestion"

class UserResponse(Enum):
    SNOOZE = "snooze"
    DISMISS = "dismiss"
    TAKE_BREAK = "take_break"

@dataclass
class Alert:
    id: str
    type: AlertType
    message: str
    timestamp: datetime
    intensity: float
    duration_ms: int
    pattern: List[int]
    
@dataclass
class UserInteraction:
    timestamp: datetime
    keystroke_count: int
    mouse_movement_distance: float
    mouse_click_count: int
    idle_time: float
    
@dataclass
class SystemState:
    monitoring_active: bool = False
    auto_start_enabled: bool = False
    snooze_feature_enabled: bool = True
    current_alert: Optional[Alert] = None
    last_break_time: Optional[datetime] = None
    focus_level: float = 0.8
    is_snoozed: bool = False
    snooze_until: Optional[datetime] = None
    paired_devices: List[str] = None
    
    def __post_init__(self):
        if self.paired_devices is None:
            self.paired_devices = []

class InputMonitor:
    def __init__(self):
        self.keystroke_count = 0
        self.mouse_distance = 0.0
        self.mouse_clicks = 0
        self.last_activity = time.time()
        self.last_mouse_pos = None
        self.keyboard_listener = None
        self.mouse_listener = None
        
    def start(self):
        if not PYNPUT_AVAILABLE:
            return False
            
        try:
            self.keyboard_listener = keyboard.Listener(on_press=self._on_key_press)
            self.mouse_listener = mouse.Listener(
                on_move=self._on_mouse_move,
                on_click=self._on_mouse_click
            )
            self.keyboard_listener.start()
            self.mouse_listener.start()
            return True
        except:
            return False
    
    def stop(self):
        if self.keyboard_listener:
            self.keyboard_listener.stop()
        if self.mouse_listener:
            self.mouse_listener.stop()
    
    def _on_key_press(self, key):
        self.keystroke_count += 1
        self.last_activity = time.time()
    
    def _on_mouse_move(self, x, y):
        current_pos = (x, y)
        if self.last_mouse_pos:
            dx = current_pos[0] - self.last_mouse_pos[0]
            dy = current_pos[1] - self.last_mouse_pos[1]
            self.mouse_distance += math.sqrt(dx*dx + dy*dy)
            self.last_activity = time.time()
        self.last_mouse_pos = current_pos
    
    def _on_mouse_click(self, x, y, button, pressed):
        if pressed:
            self.mouse_clicks += 1
            self.last_activity = time.time()
    
    def get_and_reset_metrics(self) -> UserInteraction:
        now = time.time()
        interaction = UserInteraction(
            timestamp=datetime.now(),
            keystroke_count=self.keystroke_count,
            mouse_movement_distance=self.mouse_distance,
            mouse_click_count=self.mouse_clicks,
            idle_time=now - self.last_activity
        )
        self.keystroke_count = 0
        self.mouse_distance = 0.0
        self.mouse_clicks = 0
        return interaction

class FocusAnalyzer:
    """
    FOCUS CALCULATION ALGORITHM:
    ===========================
    Calculates focus level (0.0 to 1.0) based on keyboard/mouse patterns:
    
    1. Collects data in 5-second windows
    2. Establishes user baselines after 50 seconds (10 windows)
    3. Score components:
       - Typing (40%): Compares current typing rate to baseline
       - Mouse (30%): Compares movement to baseline, checks variance
       - Activity (30%): Based on idle time between interactions
    4. Alert triggers when score < 0.6
    
    Adjust baseline sensitivity by changing the ratio thresholds.
    """
    def __init__(self):
        self.interactions = deque(maxlen=60)
        self.typing_baseline = None
        self.mouse_baseline = None
        
    def add_interaction(self, interaction: UserInteraction):
        self.interactions.append(interaction)
        if len(self.interactions) > 10 and self.typing_baseline is None:
            self._calculate_baselines()
    
    def _calculate_baselines(self):
        keystrokes = [i.keystroke_count for i in self.interactions]
        mouse_dist = [i.mouse_movement_distance for i in self.interactions]
        self.typing_baseline = statistics.mean(keystrokes)
        self.mouse_baseline = statistics.mean(mouse_dist)
    
    def calculate_focus_score(self) -> float:
        if len(self.interactions) < 5:
            return 0.8
            
        recent = list(self.interactions)[-5:]
        typing_score = self._analyze_typing_pattern(recent)
        mouse_score = self._analyze_mouse_pattern(recent)
        activity_score = self._analyze_activity_level(recent)
        
        focus_score = (typing_score * 0.4 + mouse_score * 0.3 + activity_score * 0.3)
        return max(0.0, min(1.0, focus_score))
    
    def _analyze_typing_pattern(self, interactions: List[UserInteraction]) -> float:
        keystrokes = [i.keystroke_count for i in interactions]
        if not self.typing_baseline or self.typing_baseline == 0:
            return 0.5
        ratio = statistics.mean(keystrokes) / self.typing_baseline
        if ratio > 0.8: return 0.9
        elif ratio > 0.5: return 0.7
        elif ratio > 0.2: return 0.4
        else: return 0.2
    
    def _analyze_mouse_pattern(self, interactions: List[UserInteraction]) -> float:
        distances = [i.mouse_movement_distance for i in interactions]
        if not self.mouse_baseline or self.mouse_baseline == 0:
            return 0.5
        ratio = statistics.mean(distances) / self.mouse_baseline
        variance = statistics.stdev(distances) if len(distances) > 1 else 0
        if ratio > 0.7 and variance > 10: return 0.8
        elif ratio > 0.3: return 0.5
        else: return 0.3
    
    def _analyze_activity_level(self, interactions: List[UserInteraction]) -> float:
        idle_times = [i.idle_time for i in interactions]
        avg_idle = statistics.mean(idle_times)
        if avg_idle < 2.0: return 0.9
        elif avg_idle < 5.0: return 0.6
        elif avg_idle < 10.0: return 0.3
        else: return 0.1

class AlertManager:
    def __init__(self):
        self.active_alerts = {}
        self.alert_queue = queue.Queue()
        self.response_queue = queue.Queue()
    
    def create_alert(self, alert_type: AlertType, focus_level: float) -> Alert:
        alert_id = f"alert_{int(time.time())}_{len(self.active_alerts)}"
        intensity = 1.0 - focus_level
        
        # BOGDAN/KAAN: Smartwatch uses pattern for vibration
        
        # TODO (Tiago): Adjust vibration patterns and messages here
        pattern = [150, 100, 150] if intensity < 0.4 else [200, 100, 200, 100, 200]
        
        messages = {
            AlertType.FOCUS_DROP: "Focus dropping. Consider a short break.",
            AlertType.BREAK_SUGGESTION: "Good time for a scheduled break."
        }
        
        alert = Alert(
            id=alert_id,
            type=alert_type,
            message=messages[alert_type],
            timestamp=datetime.now(),
            intensity=intensity,
            duration_ms=sum(pattern),
            pattern=pattern
        )
        
        self.active_alerts[alert_id] = alert
        self.alert_queue.put(alert)
        return alert
    
    def handle_response(self, alert_id: str, response: UserResponse) -> Dict[str, Any]:
        if alert_id not in self.active_alerts:
            return {"error": "Alert not found"}
        
        if response == UserResponse.SNOOZE:
            result = {"alert_id": alert_id, "response": "snoozed"}
        elif response == UserResponse.DISMISS:
            del self.active_alerts[alert_id]
            result = {"alert_id": alert_id, "response": "dismissed"}
        elif response == UserResponse.TAKE_BREAK:
            del self.active_alerts[alert_id]
            result = {"alert_id": alert_id, "response": "break_taken"}
        else:
            result = {"error": "Invalid response"}
        
        return result
    
    def get_pending_alerts(self) -> List[Dict]:
        # BOGDAN/KAAN: Smartwatch polls this endpoint for new alerts
        return [asdict(alert) for alert in self.active_alerts.values()]

class FocusMonitoringSystem:
    def __init__(self):
        self.state = SystemState()
        self.input_monitor = InputMonitor()
        self.analyzer = FocusAnalyzer()
        self.alert_manager = AlertManager()
        self.monitoring_thread = None
        self.running = False
        
    def start_monitoring(self):
        if self.state.monitoring_active:
            return {"status": "already_running"}
        
        self.input_monitor.start()
        self.state.monitoring_active = True
        self.running = True
        
        # IVAN ADDED
        # Watch thread that will listen to the watch
        socket_thread = threading.Thread(target=self.listen_for_snooze, daemon=True)
        socket_thread.start()


        self.monitoring_thread = threading.Thread(target=self._monitoring_loop)
        self.monitoring_thread.daemon = True
        self.monitoring_thread.start()
        
        return {"status": "started"}
    
    def stop_monitoring(self):
        self.running = False
        self.state.monitoring_active = False
        self.input_monitor.stop()
        
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=2)
        
        return {"status": "stopped"}
    
    def _monitoring_loop(self):
        last_alert_time = datetime.now() - timedelta(minutes=5)
        
        while self.running:
            try:
                interaction = self.input_monitor.get_and_reset_metrics()
                self.analyzer.add_interaction(interaction)
                
                if len(self.analyzer.interactions) >= 5:
                    focus_level = self.analyzer.calculate_focus_score()
                    self.state.focus_level = focus_level
                    
                    if focus_level < 0.6:
                        current_time = datetime.now()
                        if current_time - last_alert_time > timedelta(minutes=2):
                            if not self.state.is_snoozed or current_time > self.state.snooze_until:
                                alert = self.alert_manager.create_alert(
                                    AlertType.FOCUS_DROP,
                                    focus_level
                                )
                                self.state.current_alert = alert
                                last_alert_time = current_time
                                self.state.is_snoozed = False

                                self.send_to_watch(load=95, vibrate=True, snooze=get_settings()["snooze_feature_enabled"])
                    
                    if focus_level > 0.8:
                        self.state.is_snoozed = False
                
                time.sleep(5)
                
            except Exception:
                time.sleep(10)
    
    def update_settings(self, settings: Dict[str, Any]):
        # IVAN: GUI calls this to update settings
        if "auto_start_enabled" in settings:
            self.state.auto_start_enabled = settings["auto_start_enabled"]
        if "snooze_feature_enabled" in settings:
            self.state.snooze_feature_enabled = settings["snooze_feature_enabled"]
        return {"status": "settings_updated"}
    
    # def pair_device(self, device_id: str):
    #     # BOGDAN/KAAN: Call this when smartwatch connects
    #     if device_id not in self.state.paired_devices:
    #         self.state.paired_devices.append(device_id)
    #     return {"status": "paired", "device_id": device_id}
    

    # IVAN ADDED FUNCTIONALITY FOR SENDING THINGS TO THE WATCH
    def send_to_watch(self, load, vibrate=False, snooze=True, snoozeTime=None):
        try:
            client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client.settimeout(2)
            client.connect((WATCH_IP, WATCH_PORT))
            data = json.dumps({"load": load, "vibrate": vibrate, "snooze": snooze, "snoozeTime": snoozeTime})
            client.sendall(f"{data}\n".encode('utf-8'))
            client.close()
            print(f"[Socket] Sent to watch: {data}")
        except Exception as e:
            print(f"[Socket] Send Error: {e}")

    def listen_for_snooze(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            server.bind(('0.0.0.0', LISTENER_PORT))
            server.listen(1)
            print(f"[Socket] Listening for SNOOZE on port {LISTENER_PORT}...")
            
            while self.running:
                try:
                    server.settimeout(1.0)
                    try:
                        client, addr = server.accept()
                    except socket.timeout:
                        continue
                        
                    msg = client.recv(1024).decode('utf-8').strip()
                    if msg == "SNOOZE":
                        print("\n>>> WATCH TRIGGERED SNOOZE <<<\n")
                        self.state.is_snoozed = True
                        self.state.snooze_until = datetime.now() + timedelta(minutes=5)
                        if self.state.current_alert:
                             self.alert_manager.handle_response(self.state.current_alert.id, UserResponse.SNOOZE)
                             
                    client.close()
                except Exception as e:
                    print(f"[Socket] Listener Error: {e}")
        finally:
            server.close()


from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

system = FocusMonitoringSystem()

"""
- Endpoints:
  * POST /api/system/start - Start monitoring button
  * POST /api/system/stop - Stop monitoring button
  * GET  /api/system/state - Display current status
  * GET  /api/settings - Show current settings
  * PUT  /api/settings - Update settings from GUI
  * GET  /api/data/focus-level - Display focus level graph
"""

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/api/system/start', methods=['POST'])
def start_system():
    # IVAN: Call this when user clicks Start button
    result = system.start_monitoring()
    return jsonify(result)

@app.route('/api/system/stop', methods=['POST'])
def stop_system():
    # IVAN: Call this when user clicks Stop button
    result = system.stop_monitoring()
    return jsonify(result)

@app.route('/api/system/state', methods=['GET'])
def get_system_state():
    # IVAN: Poll this to update GUI status display
    return jsonify(asdict(system.state))

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    # BOGDAN/KAAN: Smartwatch polls this endpoint for new alerts
    alerts = system.alert_manager.get_pending_alerts()
    return jsonify({"alerts": alerts})

@app.route('/api/alerts/<alert_id>/respond', methods=['POST'])
def respond_to_alert(alert_id):
    # BOGDAN/KAAN: Smartwatch calls this when user responds to alert
    data = request.json
    response_type = data.get('response', 'ignore')
    
    try:
        response = UserResponse(response_type)
        
        if response == UserResponse.SNOOZE:
            system.state.is_snoozed = True
            system.state.snooze_until = datetime.now() + timedelta(minutes=5)
        
        result = system.alert_manager.handle_response(alert_id, response)
        return jsonify(result)
    except ValueError:
        return jsonify({"error": "Invalid response type"}), 400

# @app.route('/api/devices/pair', methods=['POST'])
# def pair_device():
#     # BOGDAN/KAAN: Call this when smartwatch connects for the first time
#     data = request.json
#     device_id = data.get('device_id')
    
#     if not device_id:
#         return jsonify({"error": "device_id is required"}), 400
        
#     result = system.pair_device(device_id)
#     return jsonify(result)

# @app.route('/api/devices', methods=['GET'])
# def get_paired_devices():
#     return jsonify({"paired_devices": system.state.paired_devices})

@app.route('/api/settings', methods=['GET'])
def get_settings():
    # IVAN: Display these settings in GUI
    settings = {
        "auto_start_enabled": system.state.auto_start_enabled,
        "snooze_feature_enabled": system.state.snooze_feature_enabled
    }
    return jsonify(settings)

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    # IVAN: Call this when user changes settings in GUI
    data = request.json
    result = system.update_settings(data)
    return jsonify(result)

@app.route('/api/data/focus-level', methods=['GET'])
def get_focus_level():
    # IVAN: Use this for focus level visualization/graph
    return jsonify({
        "focus_level": system.state.focus_level,
        "is_low_focus": system.state.focus_level < 0.6
    })

@app.route('/api/wizard/trigger-alert', methods=['POST'])
def wizard_trigger_alert():
    # TIAGO: Use this for testing vibration patterns without waiting
    data = request.json
    alert_type = data.get('type', 'focus_drop')
    
    try:
        alert_type_enum = AlertType(alert_type)
        focus_level = data.get('focus_level', 0.3)
        alert = system.alert_manager.create_alert(alert_type_enum, focus_level)
        system.state.current_alert = alert
        
        return jsonify({
            "status": "alert_triggered",
            "alert": asdict(alert)
        })
    except ValueError:
        return jsonify({"error": "Invalid alert type"}), 400

if __name__ == '__main__':
    # TODO (Radu): Configure these deployment settings
    # For development: host='localhost', port=5000, debug=True
    # For production: host='0.0.0.0', port=80, debug=False
    app.run(host='0.0.0.0', port=5000, debug=False)