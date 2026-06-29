const User = require('../models/User');
const FinancialAid = require('../models/FinancialAid');
const emailService = require('../services/emailService');

// Apply for Financial Aid
exports.applyFinancialAid = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.financialAidStatus === 'applied') {
      return res.status(400).json({ message: 'You already have a pending financial aid application.' });
    }

    if (user.financialAidStatus === 'approved' && user.financialAidExpiry && user.financialAidExpiry > new Date()) {
      return res.status(400).json({ message: 'You currently have active financial aid access.' });
    }

    // Check count of applications to prevent gaming
    const appCount = await FinancialAid.countDocuments({ user: user._id });
    if (appCount >= 3) {
      return res.status(400).json({ message: 'Maximum application limit (3 times) exceeded to prevent platform abuse.' });
    }

    const { fullName, monthlyIncome, howHelpful, whyAfford, targetPlan = 'Core' } = req.body;
    if (!fullName || !monthlyIncome || !howHelpful || !whyAfford) {
      return res.status(400).json({ message: 'Please provide all required application details.' });
    }

    const newAid = new FinancialAid({
      user: user._id,
      fullName,
      monthlyIncome: Number(monthlyIncome),
      howHelpful,
      whyAfford,
      targetPlan,
      status: 'applied'
    });

    await newAid.save();

    user.financialAidStatus = 'applied';
    await user.save();

    // Alert admin via email
    await emailService.notifyAdminNewFinancialAid(newAid, user);

    res.status(201).json({ message: 'Financial aid application submitted successfully for review.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all applications (Admin only)
exports.getApplications = async (req, res) => {
  try {
    const list = await FinancialAid.find().populate('user', 'fullName username email').sort({ createdAt: -1 });
    
    // Inject previous applications count for admin audit
    const enrichedList = await Promise.all(list.map(async (item) => {
      const count = await FinancialAid.countDocuments({ user: item.user?._id });
      return {
        ...item.toObject(),
        applicationCount: count
      };
    }));

    res.json(enrichedList);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Resolve application (Admin only)
exports.resolveApplication = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body; // status is 'approved' or 'denied'
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ message: 'Invalid resolution status' });
    }

    const aid = await FinancialAid.findById(req.params.id).populate('user');
    if (!aid) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (aid.status !== 'applied') {
      return res.status(400).json({ message: 'Application has already been resolved.' });
    }

    const user = aid.user;
    if (!user) {
      return res.status(404).json({ message: 'Applicant user account not found.' });
    }

    aid.status = status;
    if (status === 'denied') {
      aid.rejectionReason = rejectionReason || 'Does not meet program criteria.';
      user.financialAidStatus = 'denied';
    } else {
      // Grant 30 days target subscription access
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      user.subscriptionTier = aid.targetPlan || 'Core';
      user.subscriptionExpiresAt = expiry;
      user.financialAidStatus = 'approved';
      user.financialAidExpiry = expiry;
    }

    await aid.save();
    await user.save();

    // Notify user
    await emailService.notifyUserFinancialAidResult(user, status === 'approved', aid.rejectionReason);

    res.json({ message: `Application ${status} successfully. User notified.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
