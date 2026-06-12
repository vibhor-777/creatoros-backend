const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Fallback support: Dono me se jo bhi key mile, use connect karo
    const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!dbURI) {
      console.error("CRITICAL ERROR: Database URI string missing in Env Variables!");
      process.exit(1); 
    }

    const conn = await mongoose.connect(dbURI);
    console.log(`MongoDB Connected Safely: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database Connection Initialization Failed: ${error.message}`);
    process.exit(1); // Production ko clean exit do taaki log generate ho sakein
  }
};

module.exports = connectDB;
