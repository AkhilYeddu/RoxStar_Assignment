import mongoose from 'mongoose';

let mongoMemoryServer = null;

export const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (uri) {
    try {
      console.log(`[Database] Connecting to MongoDB at ${uri.replace(/\/\/.*@/, '//<credentials>@')}...`);
      await mongoose.connect(uri);
      console.log('[Database] Connected to configured MongoDB successfully.');
      return;
    } catch (err) {
      console.warn('[Database] Failed to connect to configured MONGO_URI:', err.message);
      console.log('[Database] Falling back to in-memory MongoDB for local development...');
    }
  }

  // Fallback to in-memory Mongo for zero-friction local development & testing
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongoMemoryServer = await MongoMemoryServer.create();
    const memUri = mongoMemoryServer.getUri();
    await mongoose.connect(memUri);
    console.log(`[Database] Connected to in-memory MongoDB instance at ${memUri}`);
  } catch (memErr) {
    console.error('[Database] Failed to start in-memory MongoDB:', memErr.message);
    throw memErr;
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
  console.log('[Database] Disconnected from MongoDB.');
};
