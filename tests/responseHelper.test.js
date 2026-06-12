const { sendSuccess, sendError } = require('../src/utils/responseHelper');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    }
  };

  return res;
};

describe('responseHelper utility', () => {
  test('sendSuccess builds expected envelope', () => {
    const res = createMockRes();
    sendSuccess(res, { id: 1 }, 'Done', 201, { page: 1 });

    expect(res.statusCode).toBe(201);
    expect(res.payload).toEqual({
      success: true,
      message: 'Done',
      data: { id: 1 },
      meta: { page: 1 }
    });
  });

  test('sendError builds expected envelope', () => {
    const res = createMockRes();
    sendError(res, 'Bad Request', 400, { field: 'email' });

    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({
      success: false,
      message: 'Bad Request',
      errors: { field: 'email' }
    });
  });
});
