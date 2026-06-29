const mongoose = require('mongoose');

const financialAidSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    monthlyIncome: {
      type: Number,
      required: true
    },
    howHelpful: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    whyAfford: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['applied', 'approved', 'denied'],
      default: 'applied'
    },
    targetPlan: {
      type: String,
      enum: ['Starter', 'Core', 'Elite', 'Nexus'],
      default: 'Core'
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('FinancialAid', financialAidSchema);
