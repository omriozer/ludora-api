import admin from 'firebase-admin';
import dotenv from 'dotenv';
import SecretsService from '../services/SecretsService.js';
import { luderror } from '../lib/ludlog.js';
import { isProd, getEnv } from '../src/utils/environment.js';

try {
  // Load environment-specific .env file
  const env = getEnv();
  const envFile = isProd() ? '.env' : `.env.${env}`;
  dotenv.config({ path: envFile });

  // Get Firebase service account from secrets service (environment variable)
  const secretsService = new SecretsService();
  const serviceAccount = secretsService.getFirebaseServiceAccount();

  if (!serviceAccount) {
    luderror.auth('❌ Firebase service account not found');
  } else {
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

  }
} catch (error) {
  luderror.auth('❌ Firebase initialization error:', error);
  // Don't exit the process, let the server continue without Firebase
}

export { admin };