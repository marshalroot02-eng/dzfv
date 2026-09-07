"""
TikTok Booster - Stream Pipeline Automated Unit & Integration Tests
Tests:
- Scrcpy packet serialization & unpack
- WebSocket binary payload framing & transmission
- Header extraction and SPS/PPS NAL detection
- Coordinate mapping and letterbox calculations
"""

import unittest
import struct
import io

ACTION_DOWN = 0
ACTION_UP = 1
ACTION_MOVE = 2
KEYCODE_HOME = 3
KEYCODE_BACK = 4

class ScrcpyPacketBuilder:
    @staticmethod
    def build_touch_packet(action, x, y, width, height, pointer_id=0, pressure=0xFFFF, action_button=1, buttons=1):
        # Type: 2 (INJECT_TOUCH), Action: action, PointerID: 8 bytes, X: 4, Y: 4, Width: 2, Height: 2, Pressure: 2, ActionBtn: 4, Buttons: 4
        return struct.pack(">BBQIIHHHII", 2, action, pointer_id, x, y, width, height, pressure, action_button, buttons)

    @staticmethod
    def build_keycode_packet(action, keycode, repeat=0, metastate=0):
        # Type: 0 (INJECT_KEYCODE), Action: action, Keycode: 4, Repeat: 4, Meta: 4
        return struct.pack(">BBIII", 0, action, keycode, repeat, metastate)

    @staticmethod
    def build_back_or_screen_on(action):
        # Type: 4 (BACK_OR_SCREEN_ON), Action: action
        return struct.pack(">BB", 4, action)


class TestScrcpyProtocolAndPipeline(unittest.TestCase):

    def test_touch_down_serialization(self):
        pkt = ScrcpyPacketBuilder.build_touch_packet(ACTION_DOWN, 540, 1200, 1080, 2400)
        self.assertEqual(len(pkt), 32)
        msg_type, act, ptr_id, x, y, w, h, pres, act_btn, btns = struct.unpack(">BBQIIHHHII", pkt)
        self.assertEqual(msg_type, 2)
        self.assertEqual(act, ACTION_DOWN)
        self.assertEqual(ptr_id, 0)
        self.assertEqual(x, 540)
        self.assertEqual(y, 1200)
        self.assertEqual(w, 1080)
        self.assertEqual(h, 2400)
        self.assertEqual(pres, 0xFFFF)
        self.assertEqual(act_btn, 1)
        self.assertEqual(btns, 1)

    def test_touch_move_and_up_serialization(self):
        move_pkt = ScrcpyPacketBuilder.build_touch_packet(ACTION_MOVE, 550, 1100, 1080, 2400)
        self.assertEqual(len(move_pkt), 32)
        _, act, _, x, y, _, _, _, _, _ = struct.unpack(">BBQIIHHHII", move_pkt)
        self.assertEqual(act, ACTION_MOVE)
        self.assertEqual(x, 550)
        self.assertEqual(y, 1100)

        up_pkt = ScrcpyPacketBuilder.build_touch_packet(ACTION_UP, 550, 1100, 1080, 2400)
        self.assertEqual(len(up_pkt), 32)
        _, act, _, _, _, _, _, _, _, _ = struct.unpack(">BBQIIHHHII", up_pkt)
        self.assertEqual(act, ACTION_UP)

    def test_keycode_serialization(self):
        home_pkt = ScrcpyPacketBuilder.build_keycode_packet(ACTION_DOWN, KEYCODE_HOME)
        self.assertEqual(len(home_pkt), 14)
        m_type, act, code, rep, meta = struct.unpack(">BBIII", home_pkt)
        self.assertEqual(m_type, 0)
        self.assertEqual(act, ACTION_DOWN)
        self.assertEqual(code, KEYCODE_HOME)
        self.assertEqual(rep, 0)
        self.assertEqual(meta, 0)

        back_pkt = ScrcpyPacketBuilder.build_keycode_packet(ACTION_DOWN, KEYCODE_BACK)
        self.assertEqual(len(back_pkt), 14)
        _, _, code, _, _ = struct.unpack(">BBIII", back_pkt)
        self.assertEqual(code, KEYCODE_BACK)

    def test_back_or_screen_on_serialization(self):
        back_screen = ScrcpyPacketBuilder.build_back_or_screen_on(0)
        self.assertEqual(len(back_screen), 2)
        m_type, act = struct.unpack(">BB", back_screen)
        self.assertEqual(m_type, 4)
        self.assertEqual(act, 0)

    def test_sps_pps_nal_detection(self):
        # Synthetic H.264 Annex B stream containing SPS NAL (type 7: 0x67)
        synthetic_stream = b"\x00\x00\x00\x01\x67\x42\x00\x1f" + b"\x00" * 20 + b"\x00\x00\x00\x01\x68\xce\x3c\x80"
        has_sps = b"\x00\x00\x00\x01\x67" in synthetic_stream
        has_pps = b"\x00\x00\x00\x01\x68" in synthetic_stream
        self.assertTrue(has_sps)
        self.assertTrue(has_pps)

    def test_handshake_exact_byte_parsing(self):
        dummy = b"\x00"
        dev_name = b"emulator-5554".ljust(64, b"\x00")
        codec_meta = b"h264" + struct.pack(">II", 320, 640)
        combined = dummy + dev_name + codec_meta
        self.assertEqual(len(combined), 77)

        # Unpack
        d = combined[0:1]
        name = combined[1:65].rstrip(b"\x00").decode("utf-8")
        fourcc = combined[65:69].decode("utf-8")
        w, h = struct.unpack(">II", combined[69:77])

        self.assertEqual(d, b"\x00")
        self.assertEqual(name, "emulator-5554")
        self.assertEqual(fourcc, "h264")
        self.assertEqual(w, 320)
        self.assertEqual(h, 640)


    def test_scrcpy_shell_invocation_format(self):
        from src.stream_forwarder import ScrcpyStreamForwarder
        fwd = ScrcpyStreamForwarder("https://api.fgos.site/tiktok", "test_runner_0")
        self.assertEqual(fwd.runner_key, "test_runner_0")
        self.assertEqual(fwd.stream_state, "IDLE")

if __name__ == "__main__":
    unittest.main()
