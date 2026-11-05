const { spawn } = require("child_process");

console.log("=======================================================");
console.log(" 🚀 STARTING NEXT.JS + WEBSOCKET SECURE CHAT SUITE");
console.log("=======================================================");

// 1. Launch Zero-Knowledge E2EE WebSocket Relay Server (Port 3001)
const wsProcess = spawn("node", ["ws-server.js"], {
  stdio: "inherit",
  shell: true,
});

// 2. Launch Next.js Dev Server (Port 3000)
const nextProcess = spawn("npx", ["next", "dev", "-p", "3000"], {
  stdio: "inherit",
  shell: true,
});

const cleanup = () => {
  console.log("\nStopping all services...");
  try {
    wsProcess.kill();
  } catch {}
  try {
    nextProcess.kill();
  } catch {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
