const mongoose = require('mongoose');

const bountySchema = new mongoose.Schema(
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
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    techStack: {
      type: [String],
      default: []
    },
    reward: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'INR', uppercase: true }
    },
    timeline: {
      startsAt: { type: Date, required: true },
      dueAt: { type: Date, required: true }
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'submitted', 'completed', 'cancelled'],
      default: 'open',
      index: true
    },
    applicants: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        proposal: { type: String, trim: true, maxlength: 1500 },
        appliedAt: { type: Date, default: Date.now },
        status: {
          type: String,
          enum: ['applied', 'accepted', 'rejected'],
          default: 'applied'
        }
      }
    ],
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    submission: {
      repositoryUrl: { type: String, trim: true },
      notes: { type: String, trim: true },
      submittedAt: { type: Date }
    }
  },
  {
    timestamps: true
  }
);

bountySchema.path('timeline.dueAt').validate(function validateDueAt(dueAt) {
  return this.timeline.startsAt < dueAt;
}, 'Due date should be after start date');

module.exports = mongoose.model('Bounty', bountySchema);
