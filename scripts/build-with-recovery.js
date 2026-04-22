const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const shouldUseDefaultNextDir =
  Boolean(process.env.VERCEL) || process.platform !== "win32";
const nextOutputDirName =
  process.env.NEXT_OUTPUT_DIR || (shouldUseDefaultNextDir ? ".next" : ".next-prod");
const nextDir = path.join(projectRoot, nextOutputDirName);
const traceFile = path.join(nextDir, "trace");
const MAX_BUILD_ATTEMPTS = 2;

const TRACE_LOCK_PATTERNS = [
  "EPERM: operation not permitted, open",
  `${nextOutputDirName}\\trace`,
  `${nextOutputDirName}/trace`,
];

function isTraceLockError(output) {
  const text = String(output || "");
  return TRACE_LOCK_PATTERNS.every((pattern) => text.includes(pattern));
}

function removePathIfPresent(targetPath) {
  try {
    fs.rmSync(targetPath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 150,
    });
  } catch (error) {
    console.warn(`[build-recovery] Cleanup skipped for ${targetPath}: ${error.message}`);
  }
}

function preflightCleanup() {
  removePathIfPresent(traceFile);
}

function fullNextCleanup() {
  removePathIfPresent(traceFile);
  removePathIfPresent(nextDir);
}

function runNextBuild(attempt = 1) {
  const child = spawn(process.execPath, [nextBin, "build"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NEXT_OUTPUT_DIR: nextOutputDirName,
    },
    stdio: ["inherit", "pipe", "pipe"],
  });

  let combinedOutput = "";

  const forward = (stream, target) => {
    stream.on("data", (chunk) => {
      const text = chunk.toString();
      combinedOutput += text;
      target.write(chunk);
    });
  };

  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    const shouldRetry =
      code !== 0 && attempt < MAX_BUILD_ATTEMPTS && isTraceLockError(combinedOutput);

    if (shouldRetry) {
      console.warn(
        `[build-recovery] Detected locked ${nextOutputDirName} trace file. Cleaning build output and retrying once...`
      );
      fullNextCleanup();
      runNextBuild(attempt + 1);
      return;
    }

    process.exit(code ?? 0);
  });
}

preflightCleanup();
runNextBuild();
