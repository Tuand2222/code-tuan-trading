import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function resolveBuildCommit() {
  const fromEnvironment = [
    process.env.GITHUB_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.SOURCE_VERSION,
    process.env.COMMIT_SHA,
  ].find((value) => value?.trim());

  if (fromEnvironment) return fromEnvironment.trim();

  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_COMMIT: resolveBuildCommit(),
    NEXT_PUBLIC_APP_BUILD_TIME: process.env.BUILD_TIME?.trim() || new Date().toISOString(),
  },
};

export default nextConfig;
