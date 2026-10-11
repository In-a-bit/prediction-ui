import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import dotenv from "dotenv";

const root = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(root, "../..");
const envPath = resolve(uiRoot, "../prediction-go/.env");

dotenv.config({ path: envPath });

const apiUrl = (
  process.env.MESH_API_URL || "https://integration-api.meshconnect.com"
).replace(/\/$/, "");
const clientId = process.env.MESH_CLIENT_ID ?? "";
const apiKey = process.env.MESH_API_KEY ?? "";
const port = Number(process.env.MESH_TEST_PORT || 2030);

if (!clientId || !apiKey) {
  throw new Error("MESH_CLIENT_ID and MESH_API_KEY are required");
}

const html = readFileSync(join(root, "index.html"), "utf8");

function toCurl(url, headers, body) {
  const headerFlags = Object.entries(headers)
    .map(([k, v]) => `  --header '${k}: ${v}'`)
    .join(" \\\n");
  return [
    `curl --location '${url}' \\`,
    headerFlags + " \\",
    `  --data '${body}'`,
  ].join("\n");
}

async function mintLinkToken() {
  const url = `${apiUrl}/api/v1/linktoken`;
  const headers = {
    "Content-Type": "application/json",
    "X-Client-Id": clientId,
    "X-Client-Secret": apiKey,
  };
  const body = JSON.stringify({
    userId: "user_123",
    transferOptions: {
      transferType: "deposit",
      fundingOptions: { enabled: true },
      toAddresses: [
        {
          networkId: "7436e9d0-ba42-4d2b-b4c0-8e4e606b2c12",
          symbol: "USDC",
          address: "0x5f63b4A02c40Ca3311F173262166d80Ce387827C",
        },
      ],
    },
  });

  console.log("\n[mesh] linktoken request:\n" + toCurl(url, headers, body));

  const mintRes = await fetch(url, { method: "POST", headers, body });
  const raw = await mintRes.text();
  console.log(`[mesh] linktoken response: HTTP ${mintRes.status}\n${raw || "(empty body)"}\n`);

  let mintBody;
  try {
    mintBody = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`linktoken failed (${mintRes.status}): ${raw}`);
  }
  const linkToken = mintBody.content?.linkToken ?? mintBody.linkToken;
  if (!linkToken) {
    throw new Error(`linktoken failed (${mintRes.status}): ${JSON.stringify(mintBody)}`);
  }
  return linkToken;
}

const bundle = await new Promise((resolveBundle, reject) => {
  const child = spawn(
    "npx",
    [
      "esbuild",
      join(root, "main.js"),
      "--bundle",
      "--format=esm",
      "--platform=browser",
    ],
    { cwd: uiRoot, stdio: ["ignore", "pipe", "inherit"] },
  );
  const chunks = [];
  child.stdout.on("data", (d) => chunks.push(d));
  child.on("error", reject);
  child.on("close", (code) => {
    if (code !== 0) reject(new Error(`esbuild exited ${code}`));
    else resolveBundle(Buffer.concat(chunks));
  });
});

const noStore = { "Cache-Control": "no-store" };

const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...noStore });
    res.end(html);
    return;
  }
  if (req.url === "/link-token") {
    void mintLinkToken()
      .then((linkToken) => {
        res.writeHead(200, { "Content-Type": "application/json", ...noStore });
        res.end(JSON.stringify({ linkToken }));
      })
      .catch((err) => {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8", ...noStore });
        res.end(String(err));
      });
    return;
  }
  if (req.url === "/main.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", ...noStore });
    res.end(bundle);
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
const url = `http://localhost:${port}`;
console.log(`Mesh Link test: ${url}`);
console.log("Sandbox login: Mesh / Pass123  OTP 123456");
spawn("open", [url], { stdio: "ignore", detached: true }).unref();
