const mongoose = require('mongoose');

const seedAdminUser = async () => {
  try {
    const User = require('../models/User');
    const Wallet = require('../models/Wallet');
    const bcrypt = require('bcryptjs');
    const adminEmail = 'admin@studio-z.in';
    const ADMIN_PASS = 'studio@1234554321';

    const existingAdmin = await User.findOne({ email: adminEmail }).select('+password');
    if (!existingAdmin) {
      console.log("[SEED] Seeding Admin user account...");
      const adminUser = new User({
        fullName: 'Studio-Z Admin Workspace',
        username: 'studiozadmin',
        email: adminEmail,
        password: ADMIN_PASS, // hashed by pre-save hook
        role: 'admin',
        eduVerified: true,
        verificationStatus: 'verified',
        verificationMethod: 'email'
      });

      const wallet = await Wallet.create({ user: adminUser._id });
      adminUser.wallet = wallet._id;
      await adminUser.save();
      console.log("[SEED] Admin user created successfully.");
    } else {
      // Always force-update role + re-hash password to ensure correct credentials
      existingAdmin.role = 'admin';
      existingAdmin.eduVerified = true;
      existingAdmin.verificationStatus = 'verified';

      // Directly hash and assign so isModified triggers reliably
      existingAdmin.password = await bcrypt.hash(ADMIN_PASS, 12);
      existingAdmin.markModified('password');

      // Use updateOne to bypass pre-save hook since we pre-hashed above
      await User.updateOne(
        { _id: existingAdmin._id },
        {
          $set: {
            role: 'admin',
            eduVerified: true,
            verificationStatus: 'verified',
            password: existingAdmin.password
          }
        }
      );
      console.log("[SEED] Admin credentials synced (password re-hashed).");
    }
  } catch (err) {
    console.error("[SEED] Failed to seed Admin user:", err.message);
  }
};

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

    // Auto seed admin user on connect
    await seedAdminUser();
  } catch (error) {
    console.error(`Database Connection Initialization Failed: ${error.message}`);
    process.exit(1); // Production ko clean exit do taaki log generate ho sakein
  }
};

module.exports = connectDB;
