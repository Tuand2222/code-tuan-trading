export type BuildInfo = {
  commit: string;
  shortCommit: string;
  builtAt: string;
};

function clean(value: string | undefined) {
  return value?.trim() || "unknown";
}

export function getBuildInfo(): BuildInfo {
  const commit = clean(process.env.NEXT_PUBLIC_APP_COMMIT);
  return {
    commit,
    shortCommit: commit === "unknown" ? commit : commit.slice(0, 7),
    builtAt: clean(process.env.NEXT_PUBLIC_APP_BUILD_TIME),
  };
}
