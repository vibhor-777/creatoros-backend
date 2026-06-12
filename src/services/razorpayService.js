const crypto = require('crypto');
const Razorpay = require('razorpay');

let razorpayInstance;

const getClient = () => {
  if (razorpayInstance) {
    return razorpayInstance;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are not configured');
  }

  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });

  return razorpayInstance;
};

const createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
  const client = getClient();
  return client.orders.create({
    amount: Math.round(amount * 100),
    currency,
    receipt,
    notes
  });
};

const verifySignature = ({ orderId, paymentId, signature }) => {
  const webhookSecret = process.env.RAZORPAY_KEY_SECRET;
  const generated = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature));
};

module.exports = {
  createOrder,
  verifySignature
};
