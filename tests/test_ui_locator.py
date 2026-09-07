"""
Unit Test Suite for UI Hierarchy Locator and Login Screen Verification
Tests parsing of actual Android 14 TikTok UI hierarchies:
- Splash & Onboarding
- Sign up modal -> Switch to Log in
- Login options ("Use phone / email / username")
- Credential input screen ("Email / Username", Password)
- Authenticated user feed
"""

import re
import unittest
from unittest.mock import MagicMock
from src.adb_controller import ADBController
from src.config import AppConfig

# Sample UI XML 1: Splash / Sign up screen
SAMPLE_SIGNUP_XML = """<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.zhiliaoapp.musically" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][1080,2400]">
    <node index="0" text="Sign up for TikTok" resource-id="com.zhiliaoapp.musically:id/title" class="android.widget.TextView" package="com.zhiliaoapp.musically" content-desc="" bounds="[100,200][980,300]" />
    <node index="1" text="Use phone / email / username" resource-id="com.zhiliaoapp.musically:id/btn_phone_email" class="android.widget.Button" package="com.zhiliaoapp.musically" content-desc="" bounds="[80,600][1000,720]" />
    <node index="2" text="Already have an account? Log in" resource-id="com.zhiliaoapp.musically:id/tv_login_switch" class="android.widget.TextView" package="com.zhiliaoapp.musically" content-desc="" bounds="[200,2200][880,2300]" />
  </node>
</hierarchy>
"""

# Sample UI XML 2: Login Credentials screen
SAMPLE_LOGIN_FORM_XML = """<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.zhiliaoapp.musically" bounds="[0,0][1080,2400]">
    <node index="0" text="Log in to TikTok" resource-id="com.zhiliaoapp.musically:id/header_title" class="android.widget.TextView" bounds="[100,150][980,250]" />
    <node index="1" text="Email / Username" resource-id="com.zhiliaoapp.musically:id/tab_email" class="android.widget.TextView" bounds="[540,300][1000,400]" />
    <node index="2" text="Email or username" resource-id="com.zhiliaoapp.musically:id/email_input" class="android.widget.EditText" bounds="[100,500][980,620]" />
    <node index="3" text="Password" resource-id="com.zhiliaoapp.musically:id/password_input" class="android.widget.EditText" bounds="[100,680][980,800]" />
    <node index="4" text="Log in" resource-id="com.zhiliaoapp.musically:id/login_btn" class="android.widget.Button" bounds="[100,860][980,980]" />
  </node>
</hierarchy>
"""

# Sample UI XML 3: Authenticated Feed
SAMPLE_AUTHENTICATED_FEED_XML = """<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.zhiliaoapp.musically" bounds="[0,0][1080,2400]">
    <node index="0" text="Following" resource-id="com.zhiliaoapp.musically:id/tab_following" class="android.widget.TextView" bounds="[300,100][500,200]" />
    <node index="1" text="For You" resource-id="com.zhiliaoapp.musically:id/tab_foryou" class="android.widget.TextView" bounds="[580,100][780,200]" />
    <node index="2" text="Home" resource-id="com.zhiliaoapp.musically:id/nav_home" class="android.widget.TextView" bounds="[0,2250][216,2400]" />
    <node index="3" text="Friends" resource-id="com.zhiliaoapp.musically:id/nav_friends" class="android.widget.TextView" bounds="[216,2250][432,2400]" />
    <node index="4" text="Inbox" resource-id="com.zhiliaoapp.musically:id/nav_inbox" class="android.widget.TextView" bounds="[648,2250][864,2400]" />
    <node index="5" text="Profile" resource-id="com.zhiliaoapp.musically:id/nav_profile" class="android.widget.TextView" bounds="[864,2250][1080,2400]" />
  </node>
</hierarchy>
"""

class TestUILocator(unittest.TestCase):
    def setUp(self):
        self.config = AppConfig()
        self.adb = ADBController(self.config)

    def test_find_element_center_coordinates(self):
        self.adb.dump_ui_hierarchy = MagicMock(return_value=SAMPLE_LOGIN_FORM_XML)
        
        coords = self.adb.find_element(text="Use phone / email / username")
        self.assertIsNone(coords)

        # Find "Email / Username" tab bounds [540,300][1000,400] -> center (770, 350)
        coords = self.adb.find_element(text="Email / Username")
        self.assertIsNotNone(coords)
        self.assertEqual(coords, (770, 350))

        # Find "Log in" button bounds [100,860][980,980] -> center (540, 920)
        coords = self.adb.find_element(text="Log in")
        self.assertIsNotNone(coords)
        self.assertEqual(coords, (540, 920))

    def test_login_screen_detection(self):
        # Signup screen has login indicators
        self.adb.dump_ui_hierarchy = MagicMock(return_value=SAMPLE_SIGNUP_XML)
        self.assertTrue(self.adb.is_login_or_signup_screen())
        self.assertFalse(self.adb.is_authenticated_user_feed())

        # Login form screen has login indicators
        self.adb.dump_ui_hierarchy = MagicMock(return_value=SAMPLE_LOGIN_FORM_XML)
        self.assertTrue(self.adb.is_login_or_signup_screen())
        self.assertFalse(self.adb.is_authenticated_user_feed())

        # Authenticated feed screen does NOT have login indicators and HAS navigation
        self.adb.dump_ui_hierarchy = MagicMock(return_value=SAMPLE_AUTHENTICATED_FEED_XML)
        self.assertFalse(self.adb.is_login_or_signup_screen())
        self.assertTrue(self.adb.is_authenticated_user_feed())

if __name__ == "__main__":
    unittest.main()
