const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
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
      minlength: 3,
      maxlength: 160
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    tags: {
      type: [String],
      default: []
    },
    phase: {
      type: String,
      enum: ['digital-vault', 'creator-bazaar', 'ai-saas', 'physical-goods'],
      default: 'digital-vault'
    },
    productType: {
      type: String,
      enum: ['digital', 'physical', 'subscription'],
      default: 'digital'
    },
    pricing: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'INR', uppercase: true },
      discountPercent: { type: Number, default: 0, min: 0, max: 100 }
    },
    inventory: {
      stock: { type: Number, default: 9999, min: 0 },
      sku: { type: String, trim: true },
      isUnlimited: { type: Boolean, default: true }
    },
    media: {
      coverImage: { type: String, trim: true },
      gallery: { type: [String], default: [] },
      demoVideoUrl: { type: String, trim: true }
    },
    files: {
      originalFilePath: { type: String, trim: true, select: false },
      watermarkedFilePath: { type: String, trim: true, select: false },
      fileData: { type: String, select: false },
      watermarkedFileData: { type: String, select: false },
      fileName: { type: String, trim: true },
      mimeType: { type: String, trim: true },
      checksum: { type: String, trim: true }
    },
    moderation: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      reason: { type: String, trim: true },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date }
    },
    metrics: {
      purchases: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
      rating: { type: Number, default: 0, min: 0, max: 5 }
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

productSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    if (ret.files) {
      delete ret.files.originalFilePath;
      delete ret.files.watermarkedFilePath;
      delete ret.files.fileData;
      delete ret.files.watermarkedFileData;
    }
    return ret;
  }
});

productSchema.set('toObject', {
  transform: (doc, ret, options) => {
    if (ret.files) {
      delete ret.files.originalFilePath;
      delete ret.files.watermarkedFilePath;
      delete ret.files.fileData;
      delete ret.files.watermarkedFileData;
    }
    return ret;
  }
});

productSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Product', productSchema);
