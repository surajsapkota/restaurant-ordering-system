import http from "http";
import { Server } from "socket.io";
import app from "./app";

const PORT = Number(process.env.PORT) || 3000;

const httpServer = http.createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
});

httpServer.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Menu check: http://localhost:${PORT}/menu`);
});
