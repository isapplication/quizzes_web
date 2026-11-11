import type { NextConfig } from "next";

// In production one domain serves everything (CloudFront + load balancer):
//   /                → this web app
//   /api/v1/...      → Quiz API
//   /live/{PIN}/...  → the game server that owns the PIN
// In development the web app forwards the Quiz API paths, so the Quizplayo session cookie
// is first-party on http://localhost:7100. Live games connect to the address the API returns.
const api = process.env.ISQUIZ_API_URL ?? "http://localhost:8100";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      // Quizplayo's public key, for schools' own systems to check the requests Quizplayo signs.
      { source: "/.well-known/jwks.json", destination: `${api}/.well-known/jwks.json` },
    ];
  },
};

export default nextConfig;
