import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets `next dev` be opened through an ngrok tunnel. Without this, Next
  // blocks the tunnel's requests for dev-only resources (JS chunks, HMR),
  // the page never hydrates, and forms fall back to a plain HTML submit.
  // Dev-only — has no effect on production builds.
  allowedDevOrigins: ["*.ngrok-free.dev", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
};

export default nextConfig;
