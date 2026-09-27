import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  async redirects() {
    return [
      { source: "/welcome", destination: "/start", permanent: true },
      { source: "/career", destination: "/me", permanent: true },
      { source: "/resumes", destination: "/me/resumes", permanent: true },
      {
        source: "/resumes/imports/:id",
        destination: "/me/imports/:id",
        permanent: true,
      },
      {
        source: "/resumes/:id",
        destination: "/me/resumes/:id",
        permanent: true,
      },
      { source: "/applications", destination: "/pipeline", permanent: true },
      {
        source: "/applications/:id",
        destination: "/pipeline?focus=:id",
        permanent: true,
      },
      { source: "/jobs", destination: "/discover", permanent: true },
      {
        source: "/jobs/:id",
        destination: "/discover?focus=:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
