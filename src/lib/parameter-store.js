const nconf = require('nconf');
const aws = require('aws-sdk');

nconf.file(`${ __dirname }/../config.json`);

const paramStore = new aws.SSM({
  region: nconf.get('region')
});

async function getDBPassword() {
  const param = await paramStore.getParameter({
    Name: nconf.get('db:password'),
    WithDecryption: true
  })
    .promise();
  return param.Parameter.Value;
}

async function getEncryptionKey() {
  const param = await paramStore.getParameter({
    Name: nconf.get('encryptionKey'),
    WithDecryption: true
  })
    .promise();
  return param.Parameter.Value;
}

module.exports = {
  getDBPassword,
  getEncryptionKey
};
