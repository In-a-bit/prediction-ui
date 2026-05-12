/**
 * Custom Node server: serves Next.js and proxies WebSocket upgrades so APP_API_KEY
 * is added as X-API-Key (never sent to the browser).
 *
 * Client connects to same-origin /api/ws-proxy/user and /api/ws-proxy/market only.
 */
const path = require("path");
const http = require("http");
const { parse } = require("url");

require("dotenv").config({ path: path.join(__dirname, ".env.local") });
require("dotenv").config({ path: path.join(__dirname, ".env") });

const next = require("next");
const httpProxy = require("http-proxy");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "2030", 10);

function wsTargetToHttp(url) {
  if (!url || !url.trim()) return "http://127.0.0.1:8088";
  return url.trim().replace(/^ws:\/\//i, "http://").replace(/^wss:\/\//i, "https://");
}

const userWsTarget =
  process.env.USER_WS_UPSTREAM?.trim() ||
  wsTargetToHttp(process.env.NEXT_PUBLIC_USER_WS_URL);
const publicWsTarget =
  process.env.PUBLIC_WS_UPSTREAM?.trim() ||
  wsTargetToHttp(process.env.NEXT_PUBLIC_PUBLIC_WS_URL);

const appApiKey = process.env.APP_API_KEY?.trim();

const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
});

proxy.on("proxyReqWs", (proxyReq) => {
  if (appApiKey) {
    proxyReq.setHeader("X-API-Key", appApiKey);
  }
});

proxy.on("error", (err, _req, socket) => {
  console.error("[ws-proxy] proxy error:", err);
  if (socket && !socket.destroyed) {
    socket.destroy();
  }
});

app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler();

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    void handle(req, res, parsedUrl);
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "", true);

    if (pathname === "/api/ws-proxy/user") {
      if (!appApiKey) {
        console.error("[ws-proxy] upgrade: APP_API_KEY missing for /api/ws-proxy/user");
        socket.destroy();
        return;
      }
      req.url = "/ws/user";
      proxy.ws(req, socket, head, { target: userWsTarget });
      return;
    }

    if (pathname === "/api/ws-proxy/market") {
      if (!appApiKey) {
        console.error("[ws-proxy] upgrade: APP_API_KEY missing for /api/ws-proxy/market");
        socket.destroy();
        return;
      }
      req.url = "/ws/market";
      proxy.ws(req, socket, head, { target: publicWsTarget });
      return;
    }

    // Dev HMR (e.g. /_next/webpack-hmr) and any other Next-managed WebSockets.
    void Promise.resolve(upgradeHandler(req, socket, head)).catch((err) => {
      console.error("[next] upgrade handler failed:", err);
      if (!socket.destroyed) {
        socket.destroy();
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port} (WS proxy → user ${userWsTarget}, market ${publicWsTarget})`);
  });
});
