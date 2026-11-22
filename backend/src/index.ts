import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { config } from './config.js';
import { setSocketIO } from './utils/events.js';
import { runtimePool } from './db/pool.js';
import { StaffService } from './services/staffService.js';

const server = http.createServer(app);

// Socket.IO Setup
export const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || origin === config.CORS_ORIGIN || config.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by Socket.IO CORS`));
      }
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

setSocketIO(io);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Rooms join handler (e.g. salon, barber:1, queue:publicId)
  socket.on('join_room', (room: string) => {
    if (typeof room === 'string' && room.trim().length > 0) {
      socket.join(room);
      console.log(`[Socket.IO] Socket ${socket.id} joined room ${room}`);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (reason: ${reason})`);
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(config.PORT, () => {
    console.log(`[Velora Backend] Server listening on port ${config.PORT} (${config.NODE_ENV})`);
    console.log(`[Velora Backend] Salon timezone: ${config.SALON_TIMEZONE}`);
    if (runtimePool) {
      StaffService.closeStaleEntries()
        .then((n) => n > 0 && console.log(`[Velora Backend] Closed ${n} stale entries from previous days`))
        .catch((err) => console.warn('[Velora Backend] Stale-entry cleanup failed:', err.message));
    }
  });
}

export { server };
