const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

function readBackendPort() {
  if (process.env.PORT) {
    return Number(process.env.PORT);
  }

  const envPath = path.join(__dirname, "..", "backend", ".env");

  if (!fs.existsSync(envPath)) {
    return 4000;
  }

  const match = fs.readFileSync(envPath, "utf8").match(/^PORT=(\d+)$/m);

  return match ? Number(match[1]) : 4000;
}

function canConnect(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const port = readBackendPort();

  if (await canConnect(port)) {
    console.log(`[dev:backend] Port ${port} is already in use. Reusing the existing backend process.`);
    setInterval(() => undefined, 60_000);
    return;
  }

  const child = spawn("npm", ["run", "dev"], {
    cwd: path.join(__dirname, "..", "backend"),
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

void main();
