import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

type CachedMongoose = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var __mongooseCache: CachedMongoose | undefined;
}

const cache: CachedMongoose = global.__mongooseCache || {
  conn: null,
  promise: null
};

global.__mongooseCache = cache;

export async function connectToDatabase() {
  const mongoUri = MONGODB_URI;

  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI environment variable');
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(mongoUri, {
      bufferCommands: false,
      maxPoolSize: 10
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
