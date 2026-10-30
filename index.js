import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { JSONFilePreset } from "lowdb/node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// init LowDB
const db = await JSONFilePreset(path.join(__dirname, "db.json"), { entries: [] });
await db.write();

app.use(express.static(path.join(__dirname, "public")));

// broadcast latest entries to every connected client
function broadcastEntries() {
  io.emit("entries", db.data.entries);
}

io.on("connection", (socket) => {
  console.log(`connected: ${socket.id}`);

  // send current data to the newly connected client
  socket.emit("entries", db.data.entries);

  // client emits a new entry
  socket.on("new-entry", async (payload, callback) => {
    const { date, mood, note } = payload || {};

    if (!date || !mood) {
      if (typeof callback === "function") {
        callback({ ok: false, error: "date and mood are required" });
      }
      return;
    }

    const entry = {
      id: crypto.randomUUID(),
      date,
      mood,
      note: note || "",
      createdAt: new Date().toISOString(),
    };

    db.data.entries.push(entry);
    await db.write();

    broadcastEntries();

    if (typeof callback === "function") {
      callback({ ok: true, entry });
    }
  });

  socket.on("disconnect", () => {
    console.log(`disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
