import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { seedInitialDrafts } from './seed.js';
import { initSocket } from './socket/roomSocket.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedInitialDrafts();

    const httpServer = http.createServer(app);
    initSocket(httpServer);

    const server = httpServer.listen(PORT, () => {
      console.log(`[Roxstar Backend] Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      console.log(`[Roxstar Backend] Health check: http://localhost:${PORT}/health`);
      console.log(`[Roxstar Backend] Draft API: http://localhost:${PORT}/api/drafts`);
      console.log(`[Roxstar Backend] Room API: http://localhost:${PORT}/api/rooms`);
      console.log(`[Roxstar Backend] Socket.IO server initialized`);
    });

    const shutdown = async () => {
      console.log('\n[Roxstar Backend] Shutting down gracefully...');
      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[Roxstar Backend] Startup error:', err);
    process.exit(1);
  }
};

startServer();
