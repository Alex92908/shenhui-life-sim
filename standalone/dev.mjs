// `npm run dev`: API server (auto-restarts on server changes) + Vite dev
// server with hot reload. Open http://localhost:5173
import { spawn } from "node:child_process";

const procs = [
  spawn("npx", ["tsx", "watch", "server.ts"], { stdio: "inherit" }),
  spawn("npx", ["vite"], { stdio: "inherit" }),
];
const stop = () => {
  for (const p of procs) p.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const p of procs) p.on("exit", (code) => code && stop());
