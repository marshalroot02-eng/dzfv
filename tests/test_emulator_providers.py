import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.config import AppConfig
from src.emulator_provider import (
    EmulatorProvider,
    AVDProvider,
    LDPlayerProvider,
    create_emulator_provider
)
from src.adb_controller import ADBController
from src.vpn_service import VPNService

class TestEmulatorProviders(unittest.TestCase):
    """Automated Unit & Integration Test Suite for Emulator Provider Abstraction."""

    def test_default_provider_is_avd(self):
        """Phase 4/10: When EMULATOR_PROVIDER is unspecified, it MUST default to AVDProvider."""
        with patch.dict(os.environ, {}, clear=True):
            cfg = AppConfig()
            self.assertEqual(cfg.emulator_provider, "avd")
            provider = create_emulator_provider(cfg)
            self.assertIsInstance(provider, AVDProvider)
            self.assertEqual(provider.get_provider_name(), "avd")

    def test_explicit_avd_provider(self):
        """Phase 10: Explicit EMULATOR_PROVIDER=avd selects AVDProvider."""
        with patch.dict(os.environ, {"EMULATOR_PROVIDER": "avd"}):
            cfg = AppConfig()
            self.assertEqual(cfg.emulator_provider, "avd")
            provider = create_emulator_provider(cfg)
            self.assertIsInstance(provider, AVDProvider)
            self.assertEqual(provider.get_provider_name(), "avd")

    def test_explicit_ldplayer_provider(self):
        """Phase 10: Explicit EMULATOR_PROVIDER=ldplayer selects LDPlayerProvider."""
        with patch.dict(os.environ, {"EMULATOR_PROVIDER": "ldplayer"}):
            cfg = AppConfig()
            self.assertEqual(cfg.emulator_provider, "ldplayer")
            provider = create_emulator_provider(cfg)
            self.assertIsInstance(provider, LDPlayerProvider)
            self.assertEqual(provider.get_provider_name(), "ldplayer")

    def test_invalid_provider_raises_error(self):
        """Phase 10: Invalid provider values must fail with a descriptive ValueError."""
        with patch.dict(os.environ, {"EMULATOR_PROVIDER": "bluestacks_invalid"}):
            cfg = AppConfig()
            with self.assertRaises(ValueError) as ctx:
                create_emulator_provider(cfg)
            self.assertIn("Unsupported EMULATOR_PROVIDER", str(ctx.exception))
            self.assertIn("avd", str(ctx.exception))
            self.assertIn("ldplayer", str(ctx.exception))

    def test_ldplayer_dynamic_adb_target(self):
        """Phase 3/10: LDPlayer dynamically determines ADB target port/host from config."""
        with patch.dict(os.environ, {
            "EMULATOR_PROVIDER": "ldplayer",
            "LDPLAYER_ADB_HOST": "127.0.0.1",
            "LDPLAYER_INSTANCE": "2",
            "LDPLAYER_ADB_PORT": "5559"
        }):
            cfg = AppConfig()
            self.assertEqual(cfg.ldplayer_instance, 2)
            self.assertEqual(cfg.ldplayer_adb_port, 5559)
            
            provider = create_emulator_provider(cfg)
            self.assertIsInstance(provider, LDPlayerProvider)
            
            with patch("subprocess.run") as mock_subproc:
                mock_subproc.return_value = MagicMock(stdout="List of devices attached\n127.0.0.1:5559\tdevice\n", returncode=0)
                target = provider.get_adb_target()
                self.assertEqual(target, "127.0.0.1:5559")

    def test_adb_target_propagation_to_adb_controller(self):
        """Phase 7: ADBController operates identically using the provider's resolved target."""
        with patch.dict(os.environ, {"EMULATOR_PROVIDER": "ldplayer", "ADB_DEVICE_ID": "127.0.0.1:5555"}):
            cfg = AppConfig()
            provider = create_emulator_provider(cfg)
            target = provider.get_adb_target()
            cfg.adb_device_id = target
            
            adb = ADBController(cfg)
            self.assertEqual(adb.device_id, "127.0.0.1:5555")
            
            # Verify command includes '-s 127.0.0.1:5555'
            with patch("subprocess.run") as mock_subproc:
                mock_subproc.return_value = MagicMock(stdout="test_output\n", returncode=0)
                adb.shell("echo hello")
                args, kwargs = mock_subproc.call_args
                cmd = args[0]
                self.assertIn("-s", cmd)
                self.assertIn("127.0.0.1:5555", cmd)
                self.assertIn("shell", cmd)

    def test_vpn_service_independence(self):
        """Phase 9: VPNService remains completely independent of emulator selection."""
        with patch.dict(os.environ, {"EMULATOR_PROVIDER": "ldplayer", "VPN_PROVIDER": "pia"}):
            cfg = AppConfig()
            vpn = VPNService(cfg)
            self.assertEqual(vpn.config.vpn_provider, "pia")
            self.assertEqual(vpn.config.emulator_provider, "ldplayer")

    def test_ldplayer_environment_validation_on_non_windows(self):
        """Phase 6: Incompatible runner detection for LDPlayer without Windows."""
        with patch.dict(os.environ, {"EMULATOR_PROVIDER": "ldplayer", "ALLOW_LDPLAYER_NON_WINDOWS": "false"}):
            with patch("os.name", "posix"):
                cfg = AppConfig()
                provider = create_emulator_provider(cfg)
                self.assertFalse(provider._validate_environment())
                with self.assertRaises(RuntimeError) as ctx:
                    provider.start()
                self.assertIn("requires a Windows runner host", str(ctx.exception))

if __name__ == "__main__":
    unittest.main()
