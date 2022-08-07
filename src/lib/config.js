const path = require('path');
const nconf = require('nconf');

nconf.file(`${ __dirname }/../config.json`);
// default config that is overridden by the Lambda event
module.exports = {
  S3_REGION: nconf.get('region'),
  PGDUMP_PATH: path.join(__dirname, '../../bin/postgres-13.3'),
  // maximum time allowed to connect to postgres before a timeout occurs
  PGCONNECT_TIMEOUT: 15,
  USE_IAM_AUTH: false
};
