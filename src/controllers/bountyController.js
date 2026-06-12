const Bounty = require('../models/Bounty');
const { createBountyIssue, closeIssue } = require('../services/githubService');
const { sendSuccess, sendError, asyncHandler } = require('../utils/responseHelper');

const createBounty = asyncHandler(async (req, res) => {
  const { title, description, rewardAmount, startsAt, dueAt, techStack = [] } = req.body;

  if (!title || !description || rewardAmount === undefined || !startsAt || !dueAt) {
    return sendError(res, 'title, description, rewardAmount, startsAt and dueAt are required', 400);
  }

  const bounty = await Bounty.create({
    creator: req.user._id,
    title,
    description,
    techStack,
    reward: {
      amount: Number(rewardAmount),
      currency: req.body.currency || 'INR'
    },
    timeline: {
      startsAt: new Date(startsAt),
      dueAt: new Date(dueAt)
    }
  });

  if ((process.env.ENABLE_GITHUB_BOUNTIES || 'true') === 'true') {
    try {
      const issue = await createBountyIssue({
        title: `[CreatorOS Bounty] ${title}`,
        body: `${description}\n\nReward: ${bounty.reward.amount} ${bounty.reward.currency}`
      });

      bounty.submission = {
        repositoryUrl: issue.html_url
      };
      await bounty.save();
    } catch (error) {
      // Non-blocking integration path.
    }
  }

  return sendSuccess(res, { bounty }, 'Bounty created', 201);
});

const listBounties = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const bounties = await Bounty.find(filter)
    .populate('creator', 'fullName username')
    .sort({ createdAt: -1 })
    .limit(100);

  return sendSuccess(res, { bounties, count: bounties.length }, 'Bounties listed');
});

const applyToBounty = asyncHandler(async (req, res) => {
  const { proposal } = req.body;
  const bounty = await Bounty.findById(req.params.bountyId);

  if (!bounty) {
    return sendError(res, 'Bounty not found', 404);
  }

  if (bounty.status !== 'open') {
    return sendError(res, 'Bounty is not open for applications', 400);
  }

  const alreadyApplied = bounty.applicants.some(
    (entry) => entry.user.toString() === req.user._id.toString()
  );

  if (alreadyApplied) {
    return sendError(res, 'You already applied to this bounty', 409);
  }

  bounty.applicants.push({
    user: req.user._id,
    proposal
  });

  await bounty.save();
  return sendSuccess(res, { bounty }, 'Applied to bounty');
});

const closeBounty = asyncHandler(async (req, res) => {
  const bounty = await Bounty.findById(req.params.bountyId);
  if (!bounty) {
    return sendError(res, 'Bounty not found', 404);
  }

  if (bounty.creator.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 'Not authorized to close this bounty', 403);
  }

  bounty.status = 'completed';
  await bounty.save();

  if (bounty.submission?.repositoryUrl) {
    const issueNumber = Number(String(bounty.submission.repositoryUrl).split('/').pop());
    if (!Number.isNaN(issueNumber)) {
      try {
        await closeIssue(issueNumber);
      } catch (error) {
        // Non-blocking integration path.
      }
    }
  }

  return sendSuccess(res, { bounty }, 'Bounty closed');
});

module.exports = {
  createBounty,
  listBounties,
  applyToBounty,
  closeBounty
};
