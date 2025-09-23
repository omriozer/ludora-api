// Test Video Access Control System
// Run this script to test the video access control functionality

import { checkVideoAccess, getVideoAccessDetails } from './services/videoAccessControl.js';
import db from './models/index.js';

// Test data
const testCases = [
  {
    name: 'User with valid purchase',
    userId: 'test-user-1',
    userEmail: 'test@example.com',
    videoId: 'test-video-1'
  },
  {
    name: 'User with active subscription',
    userId: 'test-user-2',
    userEmail: 'subscription@example.com',
    videoId: 'test-video-2'
  },
  {
    name: 'Content creator accessing own video',
    userId: 'creator-1',
    userEmail: 'creator@example.com',
    videoId: 'creator-video-1'
  },
  {
    name: 'User without access',
    userId: 'no-access-user',
    userEmail: 'noAccess@example.com',
    videoId: 'restricted-video'
  }
];

async function runTests() {
  console.log('🧪 Testing Video Access Control System\n');
  
  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`   User: ${testCase.userId} (${testCase.userEmail})`);
    console.log(`   Video: ${testCase.videoId}`);
    
    try {
      const result = await checkVideoAccess(testCase.userId, testCase.videoId, testCase.userEmail);
      
      console.log(`   ✅ Access Result:`, {
        hasAccess: result.hasAccess,
        reason: result.reason,
        message: result.message
      });
      
      if (result.hasAccess) {
        console.log(`   🎥 Access Type: ${result.accessType || 'unknown'}`);
        if (result.accessUntil) {
          console.log(`   ⏰ Valid Until: ${result.accessUntil}`);
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error:`, error.message);
    }
    
    console.log('   ' + '─'.repeat(50));
  }
  
  console.log('\n🏁 Testing Complete');
}

// Database model tests
async function testDatabaseModels() {
  console.log('\n🗄️  Testing Database Models\n');
  
  try {
    // Test Product model
    const productCount = await db.Product.count();
    console.log(`📦 Products in database: ${productCount}`);
    
    // Test Purchase model
    const purchaseCount = await db.Purchase.count();
    console.log(`💰 Purchases in database: ${purchaseCount}`);
    
    // Test SubscriptionPlan model
    const planCount = await db.SubscriptionPlan.count();
    console.log(`📋 Subscription plans: ${planCount}`);
    
    // Test SubscriptionHistory model
    const subscriptionCount = await db.SubscriptionHistory.count();
    console.log(`📈 Subscription history records: ${subscriptionCount}`);
    
    // Show sample subscription plan benefits
    const samplePlan = await db.SubscriptionPlan.findOne({
      where: { is_active: true }
    });
    
    if (samplePlan) {
      console.log(`\n📋 Sample Subscription Plan:`, {
        name: samplePlan.name,
        benefits: samplePlan.benefits
      });
    }
    
  } catch (error) {
    console.log('❌ Database model test error:', error.message);
  }
}

// API endpoint tests
function generateCurlCommands() {
  console.log('\n📡 API Testing Commands (using curl)\n');
  
  const baseUrl = 'http://localhost:3003';
  
  console.log('1. Upload a video:');
  console.log(`curl -X POST -F "file=@test-video.mp4" -H "Authorization: Bearer YOUR_JWT_TOKEN" ${baseUrl}/api/videos/upload`);
  
  console.log('\n2. Check video access:');
  console.log(`curl -H "Authorization: Bearer YOUR_JWT_TOKEN" ${baseUrl}/api/videos/VIDEO_ID/access`);
  
  console.log('\n3. Stream video:');
  console.log(`curl -H "Authorization: Bearer YOUR_JWT_TOKEN" -H "Range: bytes=0-1023" ${baseUrl}/api/videos/VIDEO_ID/stream`);
  
  console.log('\n4. Get video info:');
  console.log(`curl -H "Authorization: Bearer YOUR_JWT_TOKEN" ${baseUrl}/api/videos/VIDEO_ID/info`);
  
  console.log('\n5. Test with browser (HTML):');
  console.log(`
<!DOCTYPE html>
<html>
<head>
    <title>Video Stream Test</title>
</head>
<body>
    <h1>Video Streaming Test</h1>
    <video controls width="800">
        <source src="${baseUrl}/api/videos/YOUR_VIDEO_ID/stream" type="video/mp4">
        Your browser does not support the video tag.
    </video>
    
    <script>
        // Set authorization header for video requests
        // Note: This is a simple example. In production, you'd handle auth differently
        const video = document.querySelector('video');
        
        video.addEventListener('loadstart', () => {
            console.log('Video load started');
        });
        
        video.addEventListener('progress', () => {
            console.log('Video buffering...');
        });
        
        video.addEventListener('seeking', () => {
            console.log('Video seeking - demonstrates HTTP Range requests');
        });
    </script>
</body>
</html>
  `);
}

// Main execution
async function main() {
  console.log('🎬 Ludora Video Streaming System Test Suite');
  console.log('=' .repeat(60));
  
  // Test database models
  await testDatabaseModels();
  
  // Test access control
  await runTests();
  
  // Show curl commands for manual testing
  generateCurlCommands();
  
  // Close database connection
  await db.sequelize.close();
}

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}

export { runTests, testDatabaseModels };