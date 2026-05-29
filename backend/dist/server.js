import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socket.js';
dotenv.config();
const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '127.0.0.1';
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
    console.log(`Zombie Run backend listening on http://${host}:${port}`);
    console.log(`Allowing frontend origin: ${frontendOrigin}`);
});
