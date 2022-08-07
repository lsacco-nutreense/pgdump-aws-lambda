const nconf = require('nconf');
const utils = require('../lib/utils');
const uploadS3 = require('../lib/upload-s3');
const pgdump = require('../lib/pgdump');
const decorateWithIamToken = require('../lib/iam');
const encryption = require('../lib/encryption');
const paramStore = require('../lib/parameter-store');

const DEFAULT_CONFIG = require('../lib/config');

nconf.file(`${ __dirname }/../config.json`);

async function backup(config) {
  const key = utils.generateBackupPath(
    nconf.get('db:name'),
    nconf.get('s3:root')
  );
  const s3Config = { S3_BUCKET: nconf.get('s3:bucket'), S3_REGION: nconf.get('region') };

  // spawn the pg_dump process
  let stream = await pgdump(config);

  const encryptionKey = await paramStore.getEncryptionKey();
  if (encryptionKey && encryption.validateKey(encryptionKey)) {
    // if encryption is enabled, we generate an IV and store it in a separate file
    const iv = encryption.generateIv();
    const ivKey = `${ key }.iv`;

    await uploadS3(iv.toString('hex'), s3Config, ivKey);
    stream = encryption.encrypt(stream, encryptionKey, iv);
  }
  // stream the backup to S3
  return uploadS3(stream, s3Config, key);
}

async function main(event) {
  const baseConfig = { ...DEFAULT_CONFIG, ...event };
  const config = event.USE_IAM_AUTH === true ? decorateWithIamToken(baseConfig) : baseConfig;
  try {
    return await backup(config);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

exports.main = main;
