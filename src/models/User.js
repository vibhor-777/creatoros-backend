const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { normalizeEmail } = require('../utils/emailValidator');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_]+$/
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      set: normalizeEmail
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: ['student', 'creator', 'admin'],
      default: 'student'
    },
    institution: {
      name: { type: String, trim: true },
      studentId: { type: String, trim: true },
      program: { type: String, trim: true },
      graduationYear: { type: Number }
    },
    eduVerified: {
      type: Boolean,
      default: false
    },
    // --- NEW: Verification system fields ---
    // --- STUDIO-Z BUSINESS MODEL ADDITIONS ---
    // 💎 Subscription Tiers (Day 1 Feature)
    subscriptionTier: { 
      type: String, 
      enum: ['Starter', 'Core', 'Elite', 'Nexus'], 
      default: 'Starter' 
    },
    subscriptionSource: {
      type: String,
      enum: ['organic', 'admin'],
      default: 'organic'
    },
    subscriptionPurchasedAt: {
      type: Date,
      default: null
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },
    isTrial: {
      type: Boolean,
      default: false
    },
    isPriceGrandfathered: {
      type: Boolean,
      default: false
    },
    financialAidStatus: {
      type: String,
      enum: ['none', 'applied', 'approved', 'denied'],
      default: 'none'
    },
    financialAidExpiry: {
      type: Date,
      default: null
    },
    
    // 💰 Phase 5 Prep: NeoBank Wallet Tracker & Escrow limits
    lifetimeEarnings: { 
      type: Number, 
      default: 0 
    },
    // --- Level System (Step 3A) ---
    level: {
      type: Number,
      default: 1
    },
    levelBadge: {
      type: String,
      default: '🌱'
    },
    // --- Referral System (Step 3C) ---
    referralCode: {
      type: String,
      unique: true,
      sparse: true
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    referralCount: {
      type: Number,
      default: 0
    },
    referralEarnings: {
      type: Number,
      default: 0
    },
    // --- Freelancer Profile (Step 3D) ---
    freelancerProfile: {
      isAvailable: { type: Boolean, default: false },
      skills: [{ type: String }],
      hourlyRateMin: { type: Number, default: 0 },
      hourlyRateMax: { type: Number, default: 0 },
      portfolioLinks: {
        github: { type: String, default: '' },
        behance: { type: String, default: '' },
        linkedin: { type: String, default: '' },
        website: { type: String, default: '' }
      },
      availableHoursPerWeek: { type: Number, default: 0 },
      bio: { type: String, default: '', maxlength: 1000 },
      responseTime: { type: Number, default: 0 } // in hours
    },
    // --- Custom Watermark (Step 3F) ---
    watermarkSettings: {
      logoUrl: { type: String, default: null },
      position: { type: String, enum: ['corner', 'center', 'diagonal'], default: 'diagonal' },
      opacity: { type: Number, default: 30 } // 10 to 60
    },
    // --- NEW: AI Usage Tracking ---
    aiOptimizerUsage: {
      count: { type: Number, default: 0 },
      lastUsedAt: { type: Date, default: null }
    },
    // --- END BUSINESS MODEL ADDITIONS ---
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified'
    },
    verificationMethod: {
      type: String,
      enum: ['email', 'id_card'],
      default: 'email'
    },
    idCardUrl: {
      type: String,
      trim: true,
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null
    },
    otpCode: {
      type: String,
      default: null
    },
    otpExpires: {
      type: Date,
      default: null
    },
    // --- END NEW fields ---
    preferredPayoutMethod: {
      type: String,
      enum: ['bank', 'upi'],
      default: 'bank'
    },
    bankAccount: {
      accountHolderName: { type: String, default: '' },
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' }
    },
    upiDetails: {
      upiId: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    avatarUrl: {
      type: String,
      trim: true
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet'
    },
    stats: {
      productsPublished: { type: Number, default: 0 },
      bountiesCompleted: { type: Number, default: 0 },
      servicesDelivered: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 5 }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
