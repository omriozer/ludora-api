import crypto from 'crypto';

class SecretsService {
  constructor() {
    this.environment = process.env.ENVIRONMENT || 'development';
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    this.secrets = new Map();

    // Initialize with secure defaults
    this.loadSecrets();
  }

  // Load secrets from environment or external service
  loadSecrets() {
    try {
      // In development, load from environment variables
      if (this.environment === 'development') {
        this.loadFromEnvironment();
        return;
      }

      // In production, attempt to load from AWS Secrets Manager or similar
      // For now, fallback to environment variables with validation
      this.loadFromEnvironmentWithValidation();
    } catch (error) {
      console.error('❌ Failed to load secrets:', error.message);
      throw new Error('Critical security error: Cannot initialize without proper secrets');
    }
  }

  loadFromEnvironment() {
    const requiredSecrets = [
      'JWT_SECRET',
      'DB_PASSWORD',
      'FIREBASE_SERVICE_ACCOUNT'
    ];

    const optionalSecrets = [
      'AWS_SECRET_ACCESS_KEY',
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'EMAIL_PASSWORD'
    ];

    // Load required secrets
    for (const secret of requiredSecrets) {
      const value = process.env[secret];
      if (!value) {
        throw new Error(`Required secret ${secret} is not set`);
      }
      this.secrets.set(secret, value);
    }

    // Load optional secrets
    for (const secret of optionalSecrets) {
      const value = process.env[secret];
      if (value) {
        this.secrets.set(secret, value);
      }
    }

    console.log('✅ Secrets loaded from environment');
  }

  loadFromEnvironmentWithValidation() {
    // Enhanced validation for production
    const requiredSecrets = [
      { key: 'JWT_SECRET', minLength: 32 },
      { key: 'DB_PASSWORD', minLength: 12 },
      { key: 'FIREBASE_SERVICE_ACCOUNT', minLength: 100 }
    ];

    for (const { key, minLength } of requiredSecrets) {
      const value = process.env[key];
      if (!value) {
        throw new Error(`Production environment requires ${key} to be set`);
      }
      if (value.length < minLength) {
        throw new Error(`${key} does not meet minimum security requirements`);
      }
      this.secrets.set(key, value);
    }

    // Validate JWT secret strength
    const jwtSecret = this.secrets.get('JWT_SECRET');
    if (!this.isSecureSecret(jwtSecret)) {
      throw new Error('JWT_SECRET does not meet security requirements');
    }

    console.log('✅ Secrets loaded and validated for production');
  }

  // Check if a secret meets security requirements
  isSecureSecret(secret) {
    if (!secret || secret.length < 32) return false;

    // Check for common weak secrets
    const weakSecrets = [
      'default', 'secret', 'password', 'admin', 'ludora',
      '123456', 'qwerty', 'abc123'
    ];

    const lowerSecret = secret.toLowerCase();
    for (const weak of weakSecrets) {
      if (lowerSecret.includes(weak)) {
        return false;
      }
    }

    // Check for complexity (letters, numbers, special chars)
    const hasLetter = /[a-zA-Z]/.test(secret);
    const hasNumber = /\d/.test(secret);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(secret);

    return hasLetter && hasNumber && hasSpecial;
  }

  // Get a secret value
  get(key) {
    const value = this.secrets.get(key);
    if (!value) {
      console.warn(`⚠️ Secret ${key} not found`);
      return null;
    }
    return value;
  }

  // Check if a secret exists
  has(key) {
    return this.secrets.has(key);
  }

  // Generate a secure random secret
  generateSecureSecret(length = 64) {
    return crypto.randomBytes(length).toString('base64url');
  }

  // Encrypt sensitive data for storage
  encrypt(data) {
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY not available for data encryption');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      encrypted,
      tag: tag.toString('hex')
    };
  }

  // Decrypt sensitive data
  decrypt(encryptedData) {
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY not available for data decryption');
    }

    const { iv, encrypted, tag } = encryptedData;
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Firebase service account handling
  getFirebaseServiceAccount() {
    const serviceAccountData = this.get('FIREBASE_SERVICE_ACCOUNT');
    if (!serviceAccountData) {
      return null;
    }

    try {
      // If it's a file path, read from file (legacy support)
      if (serviceAccountData.startsWith('{')) {
        return JSON.parse(serviceAccountData);
      }

      // If it's base64 encoded JSON
      if (serviceAccountData.length > 100 && !serviceAccountData.includes('/')) {
        const decoded = Buffer.from(serviceAccountData, 'base64').toString('utf8');
        return JSON.parse(decoded);
      }

      throw new Error('Invalid Firebase service account format');
    } catch (error) {
      console.error('Failed to parse Firebase service account:', error);
      return null;
    }
  }

  // Validate all secrets are properly configured
  validateSecrets() {
    const requiredSecrets = ['JWT_SECRET', 'DB_PASSWORD'];
    const missing = [];

    for (const secret of requiredSecrets) {
      if (!this.has(secret)) {
        missing.push(secret);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }

    console.log('✅ All required secrets are present and validated');
    return true;
  }

  // Security audit - check for weak configurations
  auditSecrets() {
    const audit = {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      issues: [],
      warnings: []
    };

    // Check JWT secret strength
    const jwtSecret = this.get('JWT_SECRET');
    if (jwtSecret && !this.isSecureSecret(jwtSecret)) {
      audit.issues.push('JWT_SECRET does not meet security requirements');
    }

    // Check for development patterns in production
    if (this.environment !== 'development') {
      const secrets = Array.from(this.secrets.entries());
      for (const [key, value] of secrets) {
        if (value.includes('dev') || value.includes('test') || value.includes('localhost')) {
          audit.warnings.push(`${key} contains development patterns`);
        }
      }
    }

    return audit;
  }
}

export default new SecretsService();