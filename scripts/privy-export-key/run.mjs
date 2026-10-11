import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(root, "../..");
const envPath = resolve(uiRoot, "../prediction-go/.env");
const privyPkg = join(
  uiRoot,
  "node_modules/@inabit-com/dpm-sdk/node_modules/@privy-io/react-auth",
);

dotenv.config({ path: envPath });

const appId = (process.env.PRIVY_APP_ID ?? "").trim();
const port = Number(process.env.PRIVY_EXPORT_PORT || 2041);
if (!appId) throw new Error("PRIVY_APP_ID is required in prediction-go/.env");
if (!existsSync(privyPkg)) {
  throw new Error("Install prediction-ui deps first (needs @privy-io/react-auth).");
}

if (!existsSync(join(root, "node_modules/@hpke/core"))) {
  await new Promise((resolveInstall, reject) => {
    const child = spawn("npm", ["install"], { cwd: root, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`npm install exited ${code}`));
      else resolveInstall();
    });
  });
}

const html = readFileSync(join(root, "index.html"), "utf8").replaceAll(
  "{{APP_ID}}",
  appId,
);

const bundle = await new Promise((resolveBundle, reject) => {
  const child = spawn(
    "npx",
    [
      "esbuild",
      join(root, "main.jsx"),
      "--bundle",
      "--format=esm",
      "--platform=browser",
      "--jsx=automatic",
      `--alias:@privy-io/react-auth=${privyPkg}`,
      `--define:process.env.NODE_ENV="production"`,
    ],
    { cwd: uiRoot, stdio: ["ignore", "pipe", "inherit"] },
  );
  const chunks = [];
  child.stdout.on("data", (chunk) => chunks.push(chunk));
  child.on("error", reject);
  child.on("close", (code) => {
    if (code !== 0) reject(new Error(`esbuild exited ${code}`));
    else resolveBundle(Buffer.concat(chunks));
  });
});

const noStore = { "Cache-Control": "no-store" };
const server = createServer((req, res) => {
  const path = req.url?.split("?")[0];
  if (path === "/" || path === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...noStore });
    res.end(html);
    return;
  }
  if (path === "/main.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", ...noStore });
    res.end(bundle);
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
const url = `http://127.0.0.1:${port}`;
console.log(`Privy key export: ${url}`);
console.log("Log in with the email on the wallet. The key stays in this browser tab.");
spawn("open", [url], { stdio: "ignore", detached: true }).unref();
