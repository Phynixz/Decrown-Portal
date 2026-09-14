const test = require('node:test');
const assert = require('node:assert/strict');

const { validateName, validateEmail, validatePhone, isTokenExpired } = require('../utils/validation');

test('validateName accepts valid names and rejects malformed ones', () => {
  assert.equal(validateName('Jane Doe'), true);
  assert.equal(validateName('J3n3 Doe'), false);
  assert.equal(validateName('  '), false);
});

test('validateEmail and validatePhone enforce expected formats', () => {
  assert.equal(validateEmail('user@example.com'), true);
  assert.equal(validateEmail('bad-email'), false);
  assert.equal(validatePhone('08012345678'), true);
  assert.equal(validatePhone('123'), false);
});

test('isTokenExpired detects expired JWT payloads', () => {
  const expiredToken = 'eyJhbGciOiJub25lIn0.eyJleHAiOjE3MDAwMDAwMDB9.';
  assert.equal(isTokenExpired(expiredToken), true);

  const freshToken = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQ3OTQ0ODQwMDB9.';
  assert.equal(isTokenExpired(freshToken), false);
});
