import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // "standalone" is required for the Docker/Cloud Run build (see Dockerfile).
  // Kept opt-in (NEXT_STANDALONE=1) so local dev/build stay on the default
  // output, mirroring apps/studio's convention.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined
};

export default withMDX(config);
