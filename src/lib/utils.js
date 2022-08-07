const moment = require('moment');
const path = require('path');

module.exports = {
  generateBackupPath(databaseName, rootPath, now = null) {
    // eslint-disable-next-line no-param-reassign
    now = now || moment().utc();
    const timestamp = moment(now).format('DD-MMM-YYYY@HH:mm:ss');
    const day = moment(now).format('YYYY-MM-DD');
    const filename = `${ databaseName }-${ timestamp }.backup`;
    const key = path.join(rootPath || '', day, filename);
    return key;
  }
};
