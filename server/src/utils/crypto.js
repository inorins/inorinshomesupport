import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

export function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(plaintext, salt, SCRYPT_KEYLEN, SCRYPT_OPTS, (err, key) => {
      if (err) reject(err);
      else resolve(`scrypt$${salt}$${key.toString('hex')}`);
    });
  });
}

export function verifyPassword(plaintext, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return Promise.resolve(false);
  const parts = stored.split('$');
  const salt = parts[1];
  const storedHex = parts[2];
  if (!salt || !storedHex) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    crypto.scrypt(plaintext, salt, SCRYPT_KEYLEN, SCRYPT_OPTS, (err, key) => {
      if (err) { reject(err); return; }
      try {
        const storedBuf = Buffer.from(storedHex, 'hex');
        if (storedBuf.length !== key.length) { resolve(false); return; }
        resolve(crypto.timingSafeEqual(storedBuf, key));
      } catch { resolve(false); }
    });
  });
}
