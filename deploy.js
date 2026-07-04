#!/usr/bin/env node
import 'dotenv/config';
import * as ftp from 'basic-ftp';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN  = process.argv.includes('--dry-run');
const DIST_DIR = path.join(__dirname, 'dist');

const {
  FTP_HOST,
  FTP_USER,
  FTP_PASSWORD,
  FTP_PORT        = '21',
  FTP_SECURE      = 'false',
  FTP_REMOTE_PATH,
} = process.env;

const required = { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_PATH };
const missing  = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error('Missing env vars: ' + missing.join(', '));
  process.exit(1);
}

// --- build ---

console.log('Building...');
try {
  execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
} catch {
  console.error('Build failed. Deploy aborted.');
  process.exit(1);
}

// --- upload dist/ ---

async function uploadDir(client, localDir, remoteDir) {
  await client.ensureDir(remoteDir);

  const entries = fs.readdirSync(localDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const e of entries) {
    const localPath  = path.join(localDir, e.name);
    const remotePath = `${remoteDir}/${e.name}`;
    if (e.isDirectory()) {
      await uploadDir(client, localPath, remotePath);
      await client.cd(remoteDir);
    } else {
      await client.uploadFrom(localPath, e.name);
      console.log(`  upload  ${remotePath}`);
    }
  }
}

function walkDry(localDir, remoteDir) {
  for (const e of fs.readdirSync(localDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const remotePath = `${remoteDir}/${e.name}`;
    if (e.isDirectory()) {
      console.log(`  mkdir   ${remotePath}`);
      walkDry(path.join(localDir, e.name), remotePath);
    } else {
      console.log(`  upload  ${remotePath}`);
    }
  }
}

console.log(`\nHost:        ${FTP_HOST}:${FTP_PORT}`);
console.log(`Remote path: ${FTP_REMOTE_PATH}`);
console.log('');

if (DRY_RUN) {
  walkDry(DIST_DIR, FTP_REMOTE_PATH);
  console.log('\nDry run complete. No files were uploaded.');
  process.exit(0);
}

const client = new ftp.Client();
client.ftp.verbose = false;

try {
  await client.access({
    host:     FTP_HOST,
    port:     Number(FTP_PORT),
    user:     FTP_USER,
    password: FTP_PASSWORD,
    secure:   FTP_SECURE === 'true',
  });
  await uploadDir(client, DIST_DIR, FTP_REMOTE_PATH);
  console.log('\nDeploy complete.');
} catch (err) {
  console.error('Deploy failed:', err.message);
  process.exitCode = 1;
} finally {
  client.close();
}
