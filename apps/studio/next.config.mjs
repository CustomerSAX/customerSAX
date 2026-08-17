/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" is required for Docker/GCP deployments.
  // On Windows it requires Developer Mode (symlink permissions).
  // Set NEXT_STANDALONE=1 in CI / Docker builds to enable it locally.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined
};

export default nextConfig;
