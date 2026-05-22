const path = require('path');

// BankID has two environments:
//   test → appapi2.test.bankid.com   (use FPTestcert + phone configured to cavainternal.test.bankid.com)
//   prod → appapi2.bankid.com        (use production cert issued by a Swedish bank)
const ENVIRONMENTS = {
  test: 'https://appapi2.test.bankid.com/rp/v6.0',
  prod: 'https://appapi2.bankid.com/rp/v6.0',
};

const env = process.env.BANKID_ENV || 'test';

module.exports = {
  baseUrl: ENVIRONMENTS[env],
  certPath: path.resolve(process.env.BANKID_CERT_PATH || './certs/FPTestcert5_20240610.p12'),
  certPassphrase: process.env.BANKID_CERT_PASSPHRASE || 'qwerty123',
  isTest: env === 'test',
};
