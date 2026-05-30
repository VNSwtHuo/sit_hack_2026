import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket.js';

dotenv.config();

const app = express();
// Allow any origin by default so two laptops on the same LAN (each reaching the
// host via its IP) can connect. Override with FRONTEND_ORIGIN to lock it down.
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? true;
const port = Number(process.env.PORT ?? 4000);
// Bind all interfaces by default so other devices on the network can reach it.
const host = process.env.HOST ?? '0.0.0.0';

app.use(cors({ origin: frontendOrigin, methods: ['GET', 'POST'], credentials: true }));
app.use(express.json());

app.get('/api/status', (_, res) => {
  res.json({ status: 'ok', backend: 'zombie-run', timestamp: Date.now() });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: frontendOrigin,
    methods: ['GET', 'POST'],
  },
});

registerSocketHandlers(io);

httpServer.listen(port, host, () => {
  console.log(`Zombie Run backend listening on ${host}:${port}`);
  console.log(
    frontendOrigin === true
      ? 'Allowing connections from any origin (LAN-friendly).'
      : `Allowing frontend origin: ${frontendOrigin}`,
  );
});
