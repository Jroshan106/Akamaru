import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const children = [
  spawn(
    process.execPath,
    [
      require.resolve("ts-node-dev/lib/bin.js"),
      "--respawn",
      "--transpile-only",
      "src/server.ts",
    ],
    { cwd: new URL("../server/", import.meta.url), stdio: "inherit" },
  ),
  spawn(
    process.execPath,
    [
      path.join(
        path.dirname(require.resolve("vite/package.json")),
        "bin/vite.js",
      ),
    ],
    { cwd: new URL("../client/", import.meta.url), stdio: "inherit" },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
  process.exitCode = code;
}
children.forEach((child) => {
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code) => stop(code || 0));
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
