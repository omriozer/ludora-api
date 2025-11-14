import admin from 'firebase-admin';
import dotenv from 'dotenv';
import SecretsService from '../services/SecretsService.js';
import { clog, cerror } from '../lib/utils.js';

try {
  // Load environment-specific .env file
  const env = process.env.ENVIRONMENT || 'development';
  const envFile = env === 'production' ? '.env' : `.env.${env}`;
  dotenv.config({ path: envFile });

  // Get Firebase service account from secrets service (environment variable)
  const secretsService = new SecretsService();
  const serviceAccount = secretsService.getFirebaseServiceAccount();

  if (!serviceAccount) {
    clog('⚠️ Firebase service account not configured - Firebase features will be disabled');
  } else {
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    clog('✅ Firebase Admin SDK initialized successfully');
  }
} catch (error) {
  cerror('❌ Firebase initialization error:', error);
  // Don't exit the process, let the server continue without Firebase
}

export { admin };