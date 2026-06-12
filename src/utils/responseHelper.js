const sendSuccess = (res, data, message = 'Success', statusCode = 200, meta = undefined) => {
  const payload = {
    success: true,
    message,
    data
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

const sendError = (res, message = 'Something went wrong', statusCode = 500, errors = undefined) => {
  const payload = {
    success: false,
    message
  };

  if (errors !== undefined) {
    payload.errors = errors;
  }

  return res.status(statusCode).json(payload);
};

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendSuccess,
  sendError,
  asyncHandler
};
