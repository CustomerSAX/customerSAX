# Existing production resources are adopted conditionally by the GitHub Actions
# provision job before `terraform apply`. Do not add native import blocks here:
# they are unconditional and fail in fresh environments where the resource does
# not exist yet.
