const mongoose = require('mongoose');

const walletLedgerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    source: {
      type: String,
      enum: ['topup', 'purchase', 'payout', 'refund', 'transfer_in', 'transfer_out'],
      required: true
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
    referenceTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    availableBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    lockedBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true
    },
    ledger: {
      type: [walletLedgerSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

walletSchema.methods.addEntry = function addEntry(entry) {
  this.ledger.unshift(entry);
  if (this.ledger.length > 200) {
    this.ledger = this.ledger.slice(0, 200);
  }
};

module.exports = mongoose.model('Wallet', walletSchema);
