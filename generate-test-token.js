import jwt from 'jsonwebtoken';

// JWT secret from environment variable that the server uses
const JWT_SECRET = "0U7D/jJRu3/GvhTXspEJRmay1Qkz366GwK2CHqTYp/M=";

// Real user data for testing
const testUser = {
  id: 'real-user-omri',
  email: 'ozeromri@gmail.com',
  full_name: 'Omri Ozer'
};

// Generate JWT token with 1 hour expiration
const token = jwt.sign(
  {
    userId: testUser.id,
    email: testUser.email,
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour from now
  },
  JWT_SECRET
);

console.log('Generated JWT token:');
console.log(token);
console.log('\nYou can use this token in the Authorization header as:');
console.log(`Bearer ${token}`);