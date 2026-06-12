const https = require('https');

const callShiprocket = ({ method = 'POST', path, token, body }) => {
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'apiv2.shiprocket.in',
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `Shiprocket request failed (${res.statusCode})`));
          }
        });
      }
    );

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
};

const getAuthToken = async () => {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error('Shiprocket credentials are not configured');
  }

  const response = await callShiprocket({
    path: '/v1/external/auth/login',
    body: { email, password }
  });

  return response.token;
};

const createShipment = async ({ orderId, orderDate, billing, shipping, items, paymentMethod = 'Prepaid' }) => {
  const token = await getAuthToken();

  return callShiprocket({
    path: '/v1/external/orders/create/adhoc',
    token,
    body: {
      order_id: orderId,
      order_date: orderDate,
      pickup_location: 'Primary',
      billing_customer_name: billing.name,
      billing_last_name: billing.lastName || '',
      billing_address: billing.address,
      billing_city: billing.city,
      billing_pincode: billing.pincode,
      billing_state: billing.state,
      billing_country: billing.country || 'India',
      billing_email: billing.email,
      billing_phone: billing.phone,
      shipping_is_billing: shipping ? 0 : 1,
      shipping_customer_name: shipping?.name,
      shipping_last_name: shipping?.lastName || '',
      shipping_address: shipping?.address,
      shipping_city: shipping?.city,
      shipping_pincode: shipping?.pincode,
      shipping_state: shipping?.state,
      shipping_country: shipping?.country || 'India',
      shipping_email: shipping?.email,
      shipping_phone: shipping?.phone,
      order_items: items,
      payment_method: paymentMethod,
      sub_total: items.reduce((total, item) => total + item.selling_price * item.units, 0)
    }
  });
};

module.exports = {
  getAuthToken,
  createShipment
};
