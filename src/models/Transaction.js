const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      index: true
    },
    bounty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bounty',
      index: true
    },
    transactionType: {
      type: String,
      enum: ['product', 'service', 'bounty', 'wallet_topup', 'wallet_withdrawal', 'wallet_transfer'],
      required: true
    },
    paymentGateway: {
      type: String,
      enum: ['razorpay', 'wallet', 'manual'],
      default: 'razorpay'
    },
    gatewayOrderId: {
      type: String,
      trim: true,
      index: true
    },
    gatewayPaymentId: {
      type: String,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    },
    platformFee: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'on_hold', 'released', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true
    },
    holdReleaseAt: {
      type: Date
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    purchasedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);
