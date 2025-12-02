import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  // Note: Header size limits are typically controlled by the deployment platform
  // (Vercel, Node.js server, etc.). We use cookie-based auth to avoid 431 errors
  // by reducing Authorization header size. The verifyUser function checks cookies first.
};

export default nextConfig;
