import express from "express";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { attachSockets } from "./sockets";
import { loadQuestions } from "./questions";

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_DIST = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { serveClient: false });

attachSockets(io, loadQuestions());

if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false }));
  // Single-page app: every other GET (/, /r/ABCD, ...) gets index.html.
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(resolve(CLIENT_DIST, "index.html"));
  });
}

httpServer.listen(PORT, () => {
  console.log(`LOROTA server listening on http://localhost:${PORT}`);
});
