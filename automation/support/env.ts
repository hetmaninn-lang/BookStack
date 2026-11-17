import { existsSync } from 'node:fs';
import path from 'node:path';

// Local runs read the same .env file that Docker Compose uses.
const envFile = path.resolve(__dirname, '..', '..', '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set (see .env.example)`);
  }
  return value;
}

export interface Account {
  name: string;
  email: string;
  password: string;
}

export const baseURL = process.env.BOOKSTACK_URL ?? 'http://localhost:6875';
export const mailpitURL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export const accounts = {
  admin: {
    name: 'Admin',
    email: required('BOOKSTACK_ADMIN_EMAIL'),
    password: required('BOOKSTACK_ADMIN_PASSWORD'),
  },
  editor: {
    name: 'QA Editor',
    email: required('BOOKSTACK_EDITOR_EMAIL'),
    password: required('BOOKSTACK_EDITOR_PASSWORD'),
  },
  viewer: {
    name: 'QA Viewer',
    email: required('BOOKSTACK_VIEWER_EMAIL'),
    password: required('BOOKSTACK_VIEWER_PASSWORD'),
  },
} satisfies Record<string, Account>;

const authDir = path.resolve(__dirname, '..', '.auth');

export const paths = {
  authDir,
  adminSession: path.join(authDir, 'admin.json'),
  apiToken: path.join(authDir, 'api-token.json'),
  seed: path.join(authDir, 'seed.json'),
};
