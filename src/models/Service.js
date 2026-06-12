const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 180
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    deliveryMode: {
      type: String,
      enum: ['one_time', 'subscription', 'milestone'],
      default: 'one_time'
    },
    pricing: {
      baseAmount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'INR', uppercase: true },
      billingCycleDays: { type: Number, default: 30, min: 1 }
    },
    availability: {
      active: { type: Boolean, default: true },
      turnaroundDays: { type: Number, default: 3, min: 1 },
      slotsPerWeek: { type: Number, default: 5, min: 1 }
    },
    aiConfig: {
      promptTemplate: { type: String, trim: true },
      enabled: { type: Boolean, default: false }
    },
    metrics: {
      totalRequests: { type: Number, default: 0 },
      completedRequests: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Service', serviceSchema);
