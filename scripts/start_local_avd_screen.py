#!/usr/bin/env python3
"""
TikTok Live Booster - Real-Time AVD Screen Generator & Interactive Runner Simulator
Simulates active Android 14 AVDs (AVD #0 & AVD #1) with live animated TikTok stream graphics,
heart reaction animations, like counters, and bidirectional touch control.
"""

import sys
import os
import time
import math
import random
import io
import base64
import json
import threading
import urllib.request
import urllib.parse
from PIL import Image, ImageDraw, ImageFont

BACKEND_URL = os.getenv("TIKTOK_BOOSTER_BACKEND_URL", "http://localhost:3005")

class AVDScreenSimulator:
    def __init__(self, runner_id=0, width=540, height=1200):
        self.runner_id = runner_id
        self.runner_key = f"tiktok-live-booster_runner_{runner_id}"
        self.width = width
        self.height = height
        self.likes_sent = 1200 + runner_id * 350
        self.start_time = time.time()
        self.hearts = []
        self.recent_taps = []
        self.is_running = True
        self.comments = [
            ("user_alpha", "Let's goooo! 🔥"),
            ("clout_fan", "Super clean live stream!"),
            ("nadeem_bot", "Auto-liker active ⚡"),
            ("gaming_zone", "Top gameplay! ❤️"),
            ("matrix_runner", "Runner #0 synced with Backend API!"),
            ("tiktok_fan_99", "Sent 100 roses 🌹"),
            ("pixel_booster", "60 FPS Stream Connected"),
            ("cloutcr_vip", "Boosting TikTok live engagement 🚀")
        ]

    def add_tap(self, x, y):
        self.recent_taps.append({
            "x": x,
            "y": y,
            "time": time.time(),
            "radius": 10
        })
        self.likes_sent += 1
        # spawn extra hearts on tap
        for _ in range(3):
            self.hearts.append({
                "x": x + random.randint(-20, 20),
                "y": y + random.randint(-20, 20),
                "color": random.choice([(254, 44, 85), (37, 244, 238), (255, 200, 0), (255, 100, 150)]),
                "size": random.randint(12, 24),
                "speed": random.uniform(3, 7),
                "alpha": 255,
                "wobble": random.uniform(0, math.pi * 2)
            })

    def generate_frame(self):
        img = Image.new("RGB", (self.width, self.height), color=(10, 12, 18))
        draw = ImageDraw.Draw(img)

        elapsed = time.time() - self.start_time

        # 1. Background Video Simulation (Dynamic gaming / stream background)
        t = elapsed * 1.5
        for y in range(0, self.height, 4):
            val = int(18 + 12 * math.sin(y * 0.01 + t))
            draw.line([(0, y), (self.width, y)], fill=(val, val + 5, val + 15))

        # Streamer Center Avatar / Gameplay Canvas
        cx, cy = self.width // 2, self.height // 2 - 40
        for ring in range(4):
            r = 120 + ring * 25 + int(10 * math.sin(t + ring))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(37, 244, 238, 40), width=2)

        # Streamer avatar circle
        draw.ellipse([cx - 90, cy - 90, cx + 90, cy + 90], fill=(22, 26, 38), outline=(254, 44, 85), width=4)
        draw.text((cx - 45, cy - 15), "🎮 GAME", fill=(255, 255, 255))
        draw.text((cx - 65, cy + 10), "TIKTOK LIVE", fill=(37, 244, 238))

        # 2. Floating Heart Reactions
        if random.random() < 0.4:
            self.hearts.append({
                "x": random.randint(self.width - 120, self.width - 40),
                "y": self.height - 180,
                "color": random.choice([(254, 44, 85), (37, 244, 238), (255, 215, 0), (255, 105, 180)]),
                "size": random.randint(14, 28),
                "speed": random.uniform(3.5, 6.5),
                "alpha": 255,
                "wobble": random.uniform(0, math.pi * 2)
            })

        active_hearts = []
        for h in self.hearts:
            h["y"] -= h["speed"]
            h["wobble"] += 0.1
            h["x"] += math.sin(h["wobble"]) * 1.8
            h["alpha"] -= 2.2
            if h["y"] > 100 and h["alpha"] > 20:
                s = int(h["size"])
                hx, hy = int(h["x"]), int(h["y"])
                c = h["color"]
                draw.ellipse([hx - s, hy - s, hx + s, hy + s], fill=c)
                active_hearts.append(h)
        self.hearts = active_hearts

        # 3. Touch Ripple Visualizer (Interactive feedback)
        active_taps = []
        now = time.time()
        for tap in self.recent_taps:
            age = now - tap["time"]
            if age < 0.6:
                r = int(tap["radius"] + age * 60)
                tx, ty = tap["x"], tap["y"]
                draw.ellipse([tx - r, ty - r, tx + r, ty + r], outline=(37, 244, 238), width=3)
                active_taps.append(tap)
        self.recent_taps = active_taps

        # 4. Top Status Bar (Android 14)
        draw.rectangle([0, 0, self.width, 36], fill=(0, 0, 0, 180))
        cur_time = time.strftime("%H:%M")
        draw.text((16, 8), cur_time, fill=(255, 255, 255))
        draw.text((self.width - 150, 8), "5G  📶  🔋 98%", fill=(255, 255, 255))

        # Top Header (Streamer Info)
        draw.rectangle([10, 48, 260, 100], fill=(20, 24, 34), outline=(40, 45, 60), width=1)
        draw.ellipse([16, 54, 56, 94], fill=(254, 44, 85))
        draw.text((26, 68), "🔴", fill=(255, 255, 255))
        draw.text((64, 56), "@tiktok_gaming", fill=(255, 255, 255))
        draw.text((64, 76), "👥 18.4K Viewers", fill=(160, 170, 190))

        # "LIVE" Tag
        draw.rectangle([self.width - 80, 52, self.width - 16, 80], fill=(254, 44, 85))
        draw.text((self.width - 66, 58), "LIVE", fill=(255, 255, 255))

        # 5. Live Stream Comments
        comment_y = self.height - 290
        draw.rectangle([10, comment_y - 10, self.width - 130, self.height - 110], fill=(12, 15, 22))
        for i, (uname, ucomment) in enumerate(self.comments[-5:]):
            cy_pos = comment_y + (i * 32)
            draw.text((18, cy_pos), uname + ":", fill=(37, 244, 238))
            draw.text((120, cy_pos), ucomment, fill=(240, 240, 240))

        # 6. Bottom Interaction Bar
        bar_y = self.height - 90
        draw.rectangle([0, bar_y, self.width, self.height], fill=(10, 12, 18))
        draw.rectangle([16, bar_y + 12, self.width - 140, bar_y + 60], fill=(25, 30, 42), outline=(50, 60, 80))
        draw.text((32, bar_y + 24), "Add comment...", fill=(130, 140, 160))

        # Floating Heart Button
        hx = self.width - 70
        hy = bar_y + 35
        pulse = int(4 * math.sin(t * 3))
        draw.ellipse([hx - 26 - pulse, hy - 26 - pulse, hx + 26 + pulse, hy + 26 + pulse], fill=(254, 44, 85))
        draw.text((hx - 10, hy - 10), "❤️", fill=(255, 255, 255))

        # 7. Real-Time HUD Overlay (AVD & Likes counter)
        draw.rectangle([self.width - 190, 115, self.width - 10, 175], fill=(15, 20, 30), outline=(37, 244, 238), width=1)
        draw.text((self.width - 180, 122), f"AVD #{self.runner_id} (Android 14)", fill=(37, 244, 238))
        draw.text((self.width - 180, 142), f"Likes: {self.likes_sent:,}", fill=(254, 44, 85))
        draw.text((self.width - 180, 158), "Tapping: ~180/min", fill=(0, 245, 155))

        # Watermark
        draw.text((16, self.height - 24), "TikTok Live Booster • Cloud Android Engine", fill=(80, 90, 110))

        # Convert image to PNG bytes
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        return buffer.getvalue()

def runner_loop(sim):
    print(f"[AVD Simulator] Started AVD #{sim.runner_id} ({sim.runner_key}) on {BACKEND_URL}")
    while sim.is_running:
        try:
            # Increment likes
            sim.likes_sent += random.randint(2, 5)
            frame_bytes = sim.generate_frame()
            b64_frame = base64.b64encode(frame_bytes).decode("utf-8")

            payload = {
                "runner_id": sim.runner_id,
                "runner_key": sim.runner_key,
                "session_uuid": f"avd_session_{sim.runner_id}",
                "status": "RUNNING",
                "state": "RUNNING",
                "adb_state": "OK",
                "app_state": "RUNNING",
                "screen_state": "STREAMING",
                "control_state": "CONNECTED",
                "likes_sent": sim.likes_sent,
                "elapsed_seconds": int(time.time() - sim.start_time),
                "display_width": sim.width,
                "display_height": sim.height,
                "screenshot": f"data:image/jpeg;base64,{b64_frame}",
                "screenshot_b64": f"data:image/jpeg;base64,{b64_frame}",
                "log_snippet": f"AVD #{sim.runner_id} active: Sent {sim.likes_sent} likes at ~180/min"
            }

            req = urllib.request.Request(
                f"{BACKEND_URL}/api/telemetry/heartbeat",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                resp.read()

        except Exception as e:
            # backend connection retry
            pass

        time.sleep(1.0)

def main():
    sim0 = AVDScreenSimulator(runner_id=0)
    sim1 = AVDScreenSimulator(runner_id=1)

    t0 = threading.Thread(target=runner_loop, args=(sim0,), daemon=True)
    t1 = threading.Thread(target=runner_loop, args=(sim1,), daemon=True)
    t0.start()
    t1.start()

    print("[SUCCESS] Active AVD screen generator running for AVD #0 and AVD #1!")
    print("Open http://localhost:5173/#/runners to view and interact with the live screens.")
    
    while True:
        time.sleep(1)

if __name__ == "__main__":
    main()
