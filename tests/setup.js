import { jest } from '@jest/globals';
import 'jest-extended';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '..', 'test.env') });

// Set test timeout for all tests
jest.setTimeout(10000);

// Mock external services at module level
const mockFirebaseAuth = {
  verifyIdToken: jest.fn().mockResolvedValue({
    uid: 'test-uid',
    email: 'test@example.com',
  }),
  getUser: jest.fn().mockResolvedValue({
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
  }),
};

const mockFirebaseCredential = {
  cert: jest.fn().mockReturnValue({}),
};

const mockS3Instance = {
  upload: jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({
      Location: 'https://test-bucket.s3.amazonaws.com/test-file.jpg',
    }),
  }),
  deleteObject: jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({}),
  }),
};

const mockTransporter = {
  sendMail: jest.fn().mockResolvedValue({
    messageId: 'test-message-id',
    accepted: ['test@example.com'],
    rejected: [],
  }),
};

// Setup mocks
jest.mock('firebase-admin', () => ({
  credential: mockFirebaseCredential,
  initializeApp: jest.fn(),
  auth: jest.fn().mockReturnValue(mockFirebaseAuth),
}));

jest.mock('aws-sdk', () => ({
  S3: jest.fn().mockImplementation(() => mockS3Instance),
  config: {
    update: jest.fn(),
  },
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue(mockTransporter),
}));

// Global test utilities
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.mockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  display_name: 'Test User',
  role: 'user',
};

global.mockAdminUser = {
  id: 'admin-user-1', 
  email: 'admin@example.com',
  display_name: 'Admin User',
  role: 'admin',
};

global.mockFirebaseToken = 'mock-firebase-token';
global.mockJWTToken = 'mock-jwt-token';

// Console suppression for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (!args[0]?.includes?.('deprecated') && 
        !args[0]?.includes?.('Warning')) {
      originalConsoleError(...args);
    }
  };
  
  console.warn = (...args) => {
    if (!args[0]?.includes?.('deprecated')) {
      originalConsoleWarn(...args);
    }
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});