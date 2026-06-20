require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Product = require('./src/models/Product');
const Transaction = require('./src/models/Transaction');
const Wallet = require('./src/models/Wallet');

const Report = require('./src/models/Report');

async function clearDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    await Product.deleteMany({});
    console.log('Products deleted');
    await Transaction.deleteMany({});
    console.log('Transactions deleted');

    await Report.deleteMany({});
    console.log('Reports deleted');
    const nonAdminUsers = await User.find({ role: { $ne: 'admin' } });
    const nonAdminIds = nonAdminUsers.map(u => u._id);
    await Wallet.deleteMany({ user: { $in: nonAdminIds } });
    console.log('Wallets deleted');
    await User.deleteMany({ role: { $ne: 'admin' } });
    console.log('Non-admin users deleted');
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
clearDB();
