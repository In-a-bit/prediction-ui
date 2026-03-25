import { useEffect, useRef, useState } from "react";
import type { MagicLike } from "../allowance-relayer";
import { getOrDeriveClobCredentials } from "../clob-auth";

export function useClobWs(magic: MagicLike | null, enabled: boolean) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!magic || !enabled) return;

    let isMounted = true;
    let ws: WebSocket | null = null;

    async function initWs() {
      if (!magic) return;
      try {
        const credentials = await getOrDeriveClobCredentials(magic);
        if (!isMounted) return;

        const wsUrl = process.env.NEXT_PUBLIC_CLOB_WS_URL;
        if (!wsUrl) {
          console.error("NEXT_PUBLIC_CLOB_WS_URL is not set");
          return;
        }

        // Add the /ws/user path to the base URL
        const fullWsUrl = wsUrl.endsWith('/') ? `${wsUrl}ws/user` : `${wsUrl}/ws/user`;

        ws = new WebSocket(fullWsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          console.log("[Clob WS] Connected, sending auth...");
          setIsConnected(true);

          if (ws?.readyState === WebSocket.OPEN) {
            const authMsg = JSON.stringify({
              auth: {
                apiKey: credentials.apiKey,
                secret: credentials.secret,
                passphrase: credentials.passphrase
              },
              type: "user",
              markets: [],
            });
            console.log("[Clob WS] Sending auth message:", authMsg);
            ws.send(authMsg);
          }
        };

        ws.onmessage = (event) => {
          if (event.data === "PONG") {
            // keep-alive ping response
            return;
          }
          try {
            const data = JSON.parse(event.data);
            console.log("[Clob WS] User event received:", data);
          } catch (err) {
            console.error("[Clob WS] Failed to parse message:", event.data, err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          console.log("[Clob WS] Disconnected");
          setIsConnected(false);
        };

        ws.onerror = (error) => {
          console.error("[Clob WS] Error:", error);
        };
      } catch (err) {
        console.error("[Clob WS] Failed to initialize:", err);
      }
    }

    initWs();

    // Ping interval to keep the connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("PING");
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      if (ws) {
        ws.close();
      }
    };
  }, [magic, enabled]);

  return { isConnected };
}
