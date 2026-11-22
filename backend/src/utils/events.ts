import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer): void {
  ioInstance = io;
}

export function emitQueueUpdated(data?: any): void {
  if (ioInstance) {
    ioInstance.emit('queue:updated', data || { timestamp: new Date().toISOString() });
  }
}

export function emitBarberUpdated(barberId: string, data?: any): void {
  if (ioInstance) {
    ioInstance.to(`barber:${barberId}`).emit('barber:updated', data);
    ioInstance.emit('queue:updated', { barberId, timestamp: new Date().toISOString() });
  }
}
