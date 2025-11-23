import admin from 'firebase-admin';
import dotenv from 'dotenv';
import SecretsService from '../services/SecretsService.js';
import { error } from '../lib/errorLogger.js';

try {
  // Load environment-specific .env file
  const env = process.env.ENVIRONMENT || 'development';
  const envFile = env === 'production' ? '.env' : `.env.${env}`;
  dotenv.config({ path: envFile });

  // Get Firebase service account from secrets service (environment variable)
  const secretsService = new SecretsService();
  const serviceAccount = secretsService.getFirebaseServiceAccount();

  if (!serviceAccount) {

  } else {
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

  }
} catch (error) {
  error.auth('❌ Firebase initialization error:', error);
  // Don't exit the process, let the server continue without Firebase
}

export { admin };