const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Transform } = require('stream');
const nconf = require('nconf');
const paramStore = require('./parameter-store');

nconf.file(`${ __dirname }/../config.json`);

function spawnPgDump(pgdumpDir, args, env) {
  const pgDumpPath = path.join(
    pgdumpDir,
    'pg_dump'
  );
  if (!fs.existsSync(pgDumpPath)) {
    throw new Error(`pg_dump not found at ${ pgDumpPath }`);
  }

  return spawn(pgDumpPath, args, {
    env
  });
}

function buildArgs(config) {
  let args = [ '-Fc', '-Z1' ];
  const extraArgs = config.PGDUMP_ARGS;
  const dbHost = nconf.get('db:host');
  const dbPort = nconf.get('db:port') || 5432;
  const dbName = nconf.get('db:name');
  const dbUser = nconf.get('db:user');
  const dbSchema = nconf.get('db:schema');

  if (dbHost) {
    const arg = `-h${ dbHost }`;
    args.push(arg);
  }
  if (dbPort) {
    const arg = `-p${ dbPort }`;
    args.push(arg);
  }
  if (dbName) {
    const arg = `-d${ dbName }`;
    args.push(arg);
  }
  if (dbUser) {
    const arg = `-U${ dbUser }`;
    args.push(arg);
  }
  if (dbSchema) {
    const arg = `-n${ dbSchema }`;
    args.push(arg);
  }

  if (typeof extraArgs === 'string') {
    const splitArgs = extraArgs.split(' ');
    args = args.concat(splitArgs);
  } else if (Array.isArray(extraArgs)) {
    args = args.concat(extraArgs);
  }

  return args;
}

async function pgdump(config, pgDumpSpawnFn = spawnPgDump) {
  const pwd = await paramStore.getDBPassword();
  return new Promise((resolve, reject) => {
    let headerChecked = false;
    let stderr = '';

    // spawn pg_dump process
    const args = buildArgs(config);
    const env = { ...config, LD_LIBRARY_PATH: config.PGDUMP_PATH, PGPASSWORD: pwd };
    const process = pgDumpSpawnFn(config.PGDUMP_PATH, args, env);

    // hook into the process
    process.stderr.on('data', (data) => {
      stderr += data.toString('utf8');
    });

    process.on('close', (code) => {
      // reject our promise if pg_dump had a non-zero exit
      if (code !== 0) {
        return reject(
          new Error(`pg_dump process failed: ${ stderr }`)
        );
      }
      // check that pgdump actually gave us some data
      if (!headerChecked) {
        return reject(
          new Error('pg_dump gave us an unexpected response')
        );
      }
      return null;
    });

    // watch the pg_dump stdout stream so we can check it's valid
    const transformer = new Transform({
      transform(chunk, enc, callback) {
        this.push(chunk);
        // if stdout begins with 'PGDMP' then the backup has begun otherwise, we abort
        if (!headerChecked) {
          headerChecked = true;
          if (chunk.toString('utf8').startsWith('PGDMP')) {
            resolve(transformer);
          } else {
            reject(
              new Error('pg_dump gave us an unexpected response')
            );
          }
        }
        callback();
      }
    });

    // pipe pg_dump to transformer
    process.stdout.pipe(transformer);
  });
}

module.exports = pgdump;
