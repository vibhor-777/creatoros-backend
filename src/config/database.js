const mongoose = require('mongoose');

const connectDatabase = async () => {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error('MONGODB_URI is required');
  }

  const connection = await mongoose.connect(mongodbUri, {
    autoIndex: process.env.NODE_ENV !== 'production',
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000
  });

  return connection;
};

module.exports = { connectDatabase };
