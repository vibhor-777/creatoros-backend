const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Product = require('./src/models/Product');
const Transaction = require('./src/models/Transaction');
const User = require('./src/models/User');
const Wallet = require('./src/models/Wallet');

const cleanup = async () => {
  try {
    const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!dbURI) {
      console.error("CRITICAL ERROR: Database URI string missing in Env Variables!");
      process.exit(1);
    }

    console.log("Connecting to MongoDB for database cleanup...");
    await mongoose.connect(dbURI);
    console.log("Connected to MongoDB successfully.");

    // 1. Delete all products
    const productRes = await Product.deleteMany({});
    console.log(`[SUCCESS] Deleted ${productRes.deletedCount} mock products.`);

    // 2. Delete all transactions
    const transactionRes = await Transaction.deleteMany({});
    console.log(`[SUCCESS] Deleted ${transactionRes.deletedCount} mock transactions.`);

    // 3. Keep admin accounts, delete all other creators/students
    const admins = await User.find({ role: 'admin' });
    const adminIds = admins.map(admin => admin._id);
    console.log(`[INFO] Found ${admins.length} Admin account(s). Keeping them.`);

    const userRes = await User.deleteMany({ _id: { $nin: adminIds } });
    console.log(`[SUCCESS] Deleted ${userRes.deletedCount} non-admin users.`);

    // 4. Delete wallets of non-admin users
    const walletRes = await Wallet.deleteMany({ user: { $nin: adminIds } });
    console.log(`[SUCCESS] Deleted ${walletRes.deletedCount} non-admin wallets.`);

    console.log("\n=================================================");
    console.log("Database clean-up finished. All collections reset.");
    console.log("=================================================");
    process.exit(0);
  } catch (error) {
    console.error("Clean-up execution failed:", error.message);
    process.exit(1);
  }
};

cleanup();
