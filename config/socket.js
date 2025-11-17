const socketIO = require('socket.io');
let io;

require('dotenv').config();
const origin = process.env.CLIENT_URL || 'http://localhost:3000';

function configureSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: origin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
}

module.exports = { configureSocket, getIO };