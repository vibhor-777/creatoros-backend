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

    // Seed Student User
    const studentEmail = 'student@studio-z.in';
    const STUDENT_PASS = 'student@12345';
    const existingStudent = await User.findOne({ email: studentEmail });
    if (!existingStudent) {
      console.log("[SEED] Seeding Student user account...");
      const studentUser = new User({
        fullName: 'StudioZ Demo Student',
        username: 'demostudent',
        email: studentEmail,
        password: STUDENT_PASS,
        role: 'student',
        eduVerified: true,
        verificationStatus: 'verified',
        verificationMethod: 'email'
      });

      const wallet = await Wallet.create({ user: studentUser._id });
      studentUser.wallet = wallet._id;
      await studentUser.save();
      console.log("[SEED] Student user created successfully.");
    } else {
      // Sync student password & role
      existingStudent.role = 'student';
      existingStudent.eduVerified = true;
      existingStudent.verificationStatus = 'verified';
      existingStudent.password = await bcrypt.hash(STUDENT_PASS, 12);
      existingStudent.markModified('password');

      await User.updateOne(
        { _id: existingStudent._id },
        {
          $set: {
            role: 'student',
            eduVerified: true,
            verificationStatus: 'verified',
            password: existingStudent.password
          }
        }
      );
      console.log("[SEED] Student credentials synced.");
    }
  } catch (err) {
    console.error("[SEED] Failed to seed Admin/Student users:", err.message);
  }
};

const connectDB = async () => {
  try {
    const dbURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    try {
      if (!dbURI) {
        throw new Error("Database URI string missing in Env Variables");
      }
      console.log("[DB] Attempting connection to MongoDB Atlas...");
      const conn = await mongoose.connect(dbURI, { serverSelectionTimeoutMS: 5000 });
      console.log(`MongoDB Connected Safely: ${conn.connection.host}`);
      await seedAdminUser();
      return;
    } catch (err) {
      console.warn(`[DB] Database connection failed: ${err.message}. Starting in-memory database fallback...`);
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      console.log(`[DB] In-Memory MongoDB Server started on URI: ${mongoUri}`);
      const conn = await mongoose.connect(mongoUri);
      console.log(`MongoDB Connected Safely (In-Memory): ${conn.connection.host}`);
      await seedAdminUser();
    }
  } catch (error) {
    console.error(`Database Connection Initialization Failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
