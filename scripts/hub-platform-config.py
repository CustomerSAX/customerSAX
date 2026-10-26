"""Build the shared secret Hub transport document without printing credentials."""
import json
import sys
from pathlib import Path
from urllib.parse import urlparse


def build(service, api_key, tenants=None):
    url = service["status"]["url"]
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("Hub must have an HTTPS origin")
    variables = service["spec"]["template"]["spec"]["containers"][0]["env"]
    tenant = next(item["value"] for item in variables if item["name"] == "TENANT_ID")
    if len(api_key) < 16 or any(c.isspace() for c in api_key):
        raise ValueError("Invalid Hub execution key")
    mapping = tenants if tenants is not None else {tenant: tenant}
    if not isinstance(mapping, dict) or not mapping or not all(isinstance(k, str) and k and isinstance(v, str) and v for k, v in mapping.items()):
        raise ValueError("Explicit client-to-tenant registration is required")
    return {"url": url.rstrip("/"), "apiKey": api_key, "tenants": mapping, "privateHub": False}


if __name__ == "__main__":
    service_file, key_file, output_file = sys.argv[1:4]
    result = build(json.loads(Path(service_file).read_text()), Path(key_file).read_text().strip())
    Path(output_file).write_text(json.dumps(result))
    Path(output_file).chmod(0o600)
