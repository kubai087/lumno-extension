// Short-lived JWTs for the addons.mozilla.org API, signed with the
// AMO_JWT_ISSUER / AMO_JWT_SECRET credentials from the developer hub.
// Run directly to print one.
const crypto = require('crypto');

function createAmoJwt() {
  const issuer = process.env.AMO_JWT_ISSUER;
  const secret = process.env.AMO_JWT_SECRET;
  if (!issuer || !secret) {
    throw new Error('Set AMO_JWT_ISSUER and AMO_JWT_SECRET.');
  }
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  // AMO rejects tokens that live longer than five minutes.
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    iss: issuer,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 60
  })}`;
  const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

module.exports = { createAmoJwt };

if (require.main === module) {
  try {
    process.stdout.write(createAmoJwt());
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
