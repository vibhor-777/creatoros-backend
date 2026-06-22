const mongoose = require('mongoose');

const blockedIpSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    reason: {
      type: String,
      trim: true,
      default: 'No reason provided'
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: { createdAt: 'blockedAt', updatedAt: false }
  }
);

module.exports = mongoose.model('BlockedIp', blockedIpSchema);
