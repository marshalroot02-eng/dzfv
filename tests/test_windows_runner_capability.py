import os
import sys
import platform
import subprocess
import requests

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import AppConfig
from src.emulator_provider import LDPlayerProvider, create_emulator_provider

def run_windows_capability_audit():
    print("=" * 70)
    print("   GITHUB-HOSTED WINDOWS RUNNER CAPABILITY & LDPLAYER AUDIT")
    print("=" * 70)

    # 1. Runner OS & Environment
    os_name = platform.system()
    os_release = platform.release()
    os_version = platform.version()
    print(f"\n[1] Runner Host Environment:")
    print(f"    - OS: {os_name} {os_release} (Version: {os_version})")
    print(f"    - Architecture: {platform.machine()}")
    print(f"    - Python: {platform.python_version()}")

    # 2. Config & Provider Creation
    os.environ["EMULATOR_PROVIDER"] = "ldplayer"
    config = AppConfig()
    provider = create_emulator_provider(config)
    print(f"\n[2] Provider Initialization:")
    print(f"    - Selected Provider: {provider.get_provider_name()}")
    print(f"    - ADB Target: {provider.get_adb_target()}")
    print(f"    - Instance Index: {config.ldplayer_instance}")

    # 3. Virtualization Capability
    vtx_status = "UNKNOWN"
    if os_name == "Windows":
        try:
            ps_cmd = "(Get-CimInstance Win32_Processor | Select-Object -First 1).VirtualizationFirmwareEnabled"
            res = subprocess.check_output(["powershell", "-Command", ps_cmd], text=True).strip()
            vtx_status = "ENABLED (True)" if res.lower() == "true" else "DISABLED / NOT EXPOSED (False)"
        except Exception as e:
            vtx_status = f"Check failed ({e})"
    print(f"\n[3] Hardware Virtualization Check (VT-x / AMD-V):")
    print(f"    - Status: {vtx_status}")

    # 4. LDPlayer 9 Installation Check
    ld_paths = [
        r"C:\LDPlayer\LDPlayer9\ldconsole.exe",
        r"C:\leidian\LDPlayer9\ldconsole.exe",
        r"C:\Program Files\LDPlayer\LDPlayer9\ldconsole.exe",
        r"C:\Program Files (x86)\LDPlayer\LDPlayer9\ldconsole.exe"
    ]
    found_ld_path = None
    for p in ld_paths:
        if os.path.exists(p):
            found_ld_path = p
            break

    print(f"\n[4] LDPlayer Software Detection:")
    if found_ld_path:
        print(f"    - Status: [PASS] Found at {found_ld_path}")
    else:
        print(f"    - Status: [FAIL] LDPlayer 9 executable not found in standard paths.")

    # 5. ADB Platform Tools Detection
    adb_available = False
    try:
        adb_out = subprocess.check_output(["adb", "version"], stderr=subprocess.STDOUT, text=True)
        print(f"\n[5] ADB Tooling:")
        print(f"    - Status: [PASS] ADB is installed and in PATH.")
        print(f"    - Version: {adb_out.splitlines()[0] if adb_out else 'Unknown'}")
        adb_available = True
    except Exception as e:
        print(f"\n[5] ADB Tooling:")
        print(f"    - Status: [FAIL] ADB is not available in system PATH ({e}).")

    # 6. Host Public IP & Network Status
    print(f"\n[6] Network & Egress Diagnostic:")
    try:
        ip_info = requests.get("https://ipinfo.io/json", timeout=5).json()
        print(f"    - Host Public IP: {ip_info.get('ip')}")
        print(f"    - Host ISP/Org:   {ip_info.get('org')}")
        print(f"    - Location:       {ip_info.get('city')}, {ip_info.get('country')}")
    except Exception as e:
        print(f"    - Host Public IP: Failed to query ({e})")

    # 7. Summary & Verdict
    print(f"\n" + "=" * 70)
    print("                     DIAGNOSTIC TEST SUMMARY")
    print("=" * 70)
    tests = {
        "1. Host OS Compatibility": "PASS (Windows detected)" if os_name == "Windows" else "FAIL (Linux requires Windows runner)",
        "2. LDPlayerProvider Initialization": "PASS (Target: 127.0.0.1:5555)",
        "3. Nested CPU Virtualization (VT-x)": "PASS" if "ENABLED" in vtx_status else "FAIL (Hypervisor driver requires VT-x)",
        "4. LDPlayer 9 Executable Installed": "PASS" if found_ld_path else "FAIL (LDPlayer 9 not installed on host)",
        "5. Android SDK / ADB in PATH": "PASS" if adb_available else "FAIL (adb.exe missing)"
    }
    for t, res in tests.items():
        print(f"  {t:45}: {res}")
    print("=" * 70)

if __name__ == "__main__":
    run_windows_capability_audit()
