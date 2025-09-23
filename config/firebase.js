import admin from 'firebase-admin';
import dotenv from 'dotenv';
import SecretsService from '../services/SecretsService.js';

try {
  // Load environment-specific .env file
  const env = process.env.ENVIRONMENT || 'development';
  const envFile = env === 'production' ? '.env' : `${env}.env`;
  dotenv.config({ path: envFile });

  // Get Firebase service account from secrets service (environment variable)
  const serviceAccount = SecretsService.getFirebaseServiceAccount();

  if (!serviceAccount) {
    console.warn('⚠️ Firebase service account not configured - Firebase features will be disabled');
  } else {
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  }
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  // Don't exit the process, let the server continue without Firebase
}

export { admin };