import http from "http";
import { INTERNAL_SECRET, INTERNAL_PORT } from "../config/env.js";
import { handleIncomingChat } from "./conversationManager.js";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Body quá lớn"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function startInternalServer() {
  if (!INTERNAL_SECRET) {
    console.warn("INTERNAL_SECRET chưa được cấu hình — tính năng giao tiếp Mia<->Mie sẽ bị tắt.");
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/internal/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method !== "POST" || req.url !== "/internal/chat") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }

      if (!INTERNAL_SECRET || req.headers["x-internal-secret"] !== INTERNAL_SECRET) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden" }));
        return;
      }

      let payload;
      try {
        const raw = await readBody(req);
        payload = JSON.parse(raw || "{}");
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
      }

      try {
        const result = await handleIncomingChat(payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        const status = err.status || 500;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Internal error" }));
      }
    } catch (err) {
      // Không bao giờ để lỗi HTTP server làm crash toàn bộ process/bot Discord.
      console.error("INTERNAL_SERVER_ERROR:", err);
      try {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal error" }));
      } catch {
        /* response có thể đã gửi rồi, bỏ qua */
      }
    }
  });

  server.on("error", err => console.error("INTERNAL_SERVER_LISTEN_ERROR:", err));

  server.listen(INTERNAL_PORT, () => {
    console.log(`Internal family-chat server listening on port ${INTERNAL_PORT}`);
  });

  return server;
}
