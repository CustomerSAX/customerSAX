import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("hub_platform", Path(__file__).with_name("hub-platform-config.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class HubPlatformConfigTest(unittest.TestCase):
    def service(self, url="https://hub.example.test"):
        return {"status": {"url": url}, "spec": {"template": {"spec": {"containers": [{"env": [{"name": "TENANT_ID", "value": "tenant-a"}]}]}}}}

    def test_bootstraps_only_the_explicit_hub_tenant(self):
        result = module.build(self.service(), "synthetic-execution-key")
        self.assertEqual(result["tenants"], {"tenant-a": "tenant-a"})
        self.assertFalse(result["privateHub"])
        self.assertNotIn("providerCredentials", result)

    def test_supports_registered_clients_with_different_hub_ids(self):
        result = module.build(self.service(), "synthetic-execution-key", {"client-a": "tenant-a"})
        self.assertEqual(result["tenants"], {"client-a": "tenant-a"})

    def test_rejects_unsafe_origins(self):
        for url in ["http://hub.test", "https://user:secret@hub.test", "https://hub.test/path", "https://hub.test/?token=secret"]:
            with self.assertRaises(ValueError):
                module.build(self.service(url), "synthetic-execution-key")

    def test_rejects_bad_platform_keys_and_registrations(self):
        for key in ["", "short", "synthetic key with spaces"]:
            with self.assertRaises(ValueError):
                module.build(self.service(), key)
        with self.assertRaises(ValueError):
            module.build(self.service(), "synthetic-execution-key", {})


if __name__ == "__main__":
    unittest.main()
