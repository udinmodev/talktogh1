/**
 * ZERO-KNOWLEDGE E2EE WEBSOCKET WIRE RELAY & PERSISTENCE SERVER
 *
 * Strict Security Principles:
 * - Pure relay and persistent storage of AES-256-GCM encrypted envelopes.
 * - ZERO plaintext inspection, ZERO text storage, ZERO decryption capability.
 * - Broadcasts encrypted events in real-time to connected clients with sub-millisecond latency.
 * - Persists zero-knowledge wire messages directly to data/wire-messages.json.
 */

const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.WS_PORT || 3001;
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "wire-messages.json");
const TMP_FILE = path.join(DATA_DIR, "wire-messages.tmp");

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[WS Server] Error creating data directory:", err.message);
  }
}

function persistWireMessage(wireMsg) {
  ensureDataDir();
  try {
    let list = [];
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      list = JSON.parse(raw);
    }
    const idx = list.findIndex((m) => m.id === wireMsg.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...wireMsg };
    } else {
      list.push(wireMsg);
    }
    fs.writeFileSync(TMP_FILE, JSON.stringify(list, null, 2), "utf-8");
    fs.renameSync(TMP_FILE, STORE_FILE);
  } catch (err) {
    console.error("[WS Server] Error persisting wire message:", err.message);
  }
}

function updateMessageFieldOnDisk(messageId, updater) {
  ensureDataDir();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const list = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
      const target = list.find((m) => m.id === messageId);
      if (target) {
        updater(target);
        fs.writeFileSync(TMP_FILE, JSON.stringify(list, null, 2), "utf-8");
        fs.renameSync(TMP_FILE, STORE_FILE);
      }
    }
  } catch (err) {
    console.error("[WS Server] Error updating message on disk:", err.message);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    let messageCount = 0;
    try {
      if (fs.existsSync(STORE_FILE)) {
        const list = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
        messageCount = list.length;
      }
    } catch {}

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        service: "wechat-ws-relay",
        port: PORT,
        activeClients: clients.size,
        persistedWireMessages: messageCount,
        storageType: "Persistent Disk (data/wire-messages.json)",
      })
    );
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

// Map of client sockets: ws -> { userId, connectedAt }
const clients = new Map();

wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  clients.set(ws, { userId: null, connectedAt: Date.now() });
  console.log(`[WS] Client connected from ${clientIp}. Total active: ${clients.size}`);

  // Send welcome handshake
  ws.send(
    JSON.stringify({
      type: "SYSTEM_HANDSHAKE",
      serverTime: Date.now(),
      protocol: "wechat-zk-v1",
      activeClients: clients.size,
      storage: "persistent-disk",
    })
  );

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());

      // 1. Client Identity Registration
      if (message.type === "REGISTER") {
        const clientInfo = clients.get(ws);
        if (clientInfo) {
          clientInfo.userId = message.userId;
          console.log(`[WS] Client registered as user: ${message.userId}`);
        }
        // Broadcast presence
        broadcastToOthers(ws, {
          type: "USER_PRESENCE",
          userId: message.userId,
          status: "online",
        });
        return;
      }

      // 2. Heartbeat Ping / Pong
      if (message.type === "PING") {
        ws.send(JSON.stringify({ type: "PONG", timestamp: Date.now() }));
        return;
      }

      // 3. Encrypted Wire Message Relay & Persistence
      if (message.type === "NEW_MESSAGE" && message.payload && message.messageId) {
        const ep = message.payload;
        const duration = message.disappearingDuration || null;
        const wireObj = {
          id: message.messageId,
          senderId: ep.senderId,
          recipientId: ep.recipientId,
          encryptedPayload: ep,
          timestamp: ep.timestamp || Date.now(),
          status: "delivered",
          disappearingDuration: duration,
          expiresAt: duration ? Date.now() + duration * 1000 : null,
          viewOnce: Boolean(message.viewOnce),
          isBurned: false,
          isPinned: false,
          securityType: message.securityType || "standard",
        };
        persistWireMessage(wireObj);
      }

      if (message.type === "TOGGLE_PIN" && message.messageId) {
        updateMessageFieldOnDisk(message.messageId, (m) => {
          m.isPinned = message.isPinned;
        });
      }

      if (message.type === "VIEW_ONCE_OPENED" && message.messageId) {
        updateMessageFieldOnDisk(message.messageId, (m) => {
          m.isBurned = true;
        });
      }

      if (message.type === "MESSAGE_STATUS_UPDATE" && message.messageId && message.status) {
        updateMessageFieldOnDisk(message.messageId, (m) => {
          m.status = message.status;
        });
      }

      if (message.type === "WIPE_ALL") {
        ensureDataDir();
        try {
          fs.writeFileSync(TMP_FILE, JSON.stringify([], null, 2), "utf-8");
          fs.renameSync(TMP_FILE, STORE_FILE);
        } catch {}
      }

      // Relay encrypted wire frame to all other connected peers
      broadcastToOthers(ws, message);
    } catch (err) {
      console.error("[WS] Error processing frame:", err.message);
    }
  });

  ws.on("close", () => {
    const info = clients.get(ws);
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total active: ${clients.size}`);

    if (info && info.userId) {
      broadcastToOthers(ws, {
        type: "USER_PRESENCE",
        userId: info.userId,
        status: "offline",
      });
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] Socket error:", err.message);
  });
});

function broadcastToOthers(senderWs, messageObj) {
  const serialized = JSON.stringify(messageObj);
  for (const [clientSocket] of clients.entries()) {
    if (clientSocket !== senderWs && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(serialized);
    }
  }
}

// Background Auto-Purge Daemon: Purges expired self-destructing messages every 15 seconds
setInterval(() => {
  ensureDataDir();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf-8");
      const list = JSON.parse(raw);
      const now = Date.now();
      const active = list.filter((m) => !m.expiresAt || m.expiresAt > now);
      if (active.length !== list.length) {
        fs.writeFileSync(TMP_FILE, JSON.stringify(active, null, 2), "utf-8");
        fs.renameSync(TMP_FILE, STORE_FILE);
        console.log(`[WS Server] Auto-purged ${list.length - active.length} expired message(s) from persistent disk.`);
      }
    }
  } catch {}
}, 15000);

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` 🔒 ZERO-KNOWLEDGE E2EE WEBSOCKET RELAY & STORE ONLINE`);
  console.log(` Listening on: ws://localhost:${PORT}`);
  console.log(` HTTP Health:  http://localhost:${PORT}/health`);
  console.log(` Storage:      data/wire-messages.json`);
  console.log(`=======================================================`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("[WS] Shutting down WebSocket server...");
  wss.close(() => {
    server.close(() => process.exit(0));
  });
});
