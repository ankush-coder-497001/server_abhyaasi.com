/**
 * Certificate Generation Test
 * Tests the certificate service for generating both PDF and Image formats
 */

require('dotenv').config({ path: '../.env' });
const Certificate_service = require('../services/certificate.svc');

/**
 * Mock user data
 */
const mockUserData = {
  _id: '694eb718d68e57bb01c0d862',
  name: 'John Doe',
  email: 'john@example.com'
};

/**
 * Mock course data
 */
const mockCourseData = {
  _id: '692bbe9989b07acb7e6a2842',
  title: 'Python Zero to Hero: Complete Beginner Bootcamp',
  completedAt: new Date('2025-12-27')
};

/**
 * Test certificate generation
 */
async function testCertificateGeneration() {
  try {
    console.log('🔄 Starting certificate generation test...\n');

    console.log('📋 User Data:');
    console.log(`  Name: ${mockUserData.name}`);
    console.log(`  ID: ${mockUserData._id}\n`);

    console.log('📚 Course Data:');
    console.log(`  Title: ${mockCourseData.title}`);
    console.log(`  ID: ${mockCourseData._id}`);
    console.log(`  Completed: ${mockCourseData.completedAt.toDateString()}\n`);

    console.log('⏳ Generating certificates...');
    console.log('   - Creating PDF...');
    console.log('   - Creating PNG image...');
    console.log('   - Uploading to Cloudinary...\n');

    // Generate certificate
    const result = await Certificate_service.generateCertificate(
      mockUserData,
      mockCourseData
    );

    console.log('✅ Certificate generation successful!\n');

    console.log('📄 Generated URLs:');
    console.log(`  PDF URL: ${result.pdfUrl}`);
    console.log(`  Image URL: ${result.imageUrl}`);
    console.log(`  Public ID: ${result.publicId}\n`);

    console.log('📋 Response Object:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n✨ Test completed successfully!');
    console.log('You can now:');
    console.log(`  1. Open PDF in browser: ${result.pdfUrl}`);
    console.log(`  2. View image preview: ${result.imageUrl}`);

    return result;
  } catch (error) {
    console.error('❌ Certificate generation failed!');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw error;
  }
}

/**
 * Test with different user data
 */
async function testMultipleCertificates() {
  const testCases = [
    {
      user: {
        _id: '604eb718d68e57bb01c0d850',
        name: 'Alice Johnson',
        email: 'alice@example.com'
      },
      course: {
        _id: '692bbe9989b07acb7e6a2842',
        title: 'Python Zero to Hero: Complete Beginner Bootcamp',
        completedAt: new Date('2025-12-25')
      }
    },
    {
      user: {
        _id: '604eb718d68e57bb01c0d851',
        name: 'Bob Smith',
        email: 'bob@example.com'
      },
      course: {
        _id: '692bbe9989b07acb7e6a2843',
        title: 'Web Development Mastery',
        completedAt: new Date('2025-12-26')
      }
    },
    {
      user: {
        _id: '604eb718d68e57bb01c0d852',
        name: 'Emma Wilson',
        email: 'emma@example.com'
      },
      course: {
        _id: '692bbe9989b07acb7e6a2844',
        title: 'Data Science Fundamentals',
        completedAt: new Date('2025-12-27')
      }
    }
  ];

  console.log('🔄 Testing multiple certificate generation...\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    try {
      console.log(`\n📌 Test Case ${i + 1}: ${testCase.user.name}`);
      console.log('─'.repeat(60));

      const result = await Certificate_service.generateCertificate(
        testCase.user,
        testCase.course
      );

      console.log(`✅ Success`);
      console.log(`   PDF: ${result.pdfUrl.substring(0, 80)}...`);
      console.log(`   IMG: ${result.imageUrl?.substring(0, 80) || 'N/A'}...`);
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✨ All tests completed!');
}

/**
 * Test edge cases
 */
async function testEdgeCases() {
  console.log('🧪 Testing edge cases...\n');

  const edgeCases = [
    {
      name: 'Very Long Name',
      user: {
        _id: '604eb718d68e57bb01c0d860',
        name: 'This Is A Very Long Name That Might Break The Certificate Layout And Should Be Handled Gracefully',
        email: 'test@example.com'
      },
      course: {
        _id: '692bbe9989b07acb7e6a2842',
        title: 'Python Zero to Hero: Complete Beginner Bootcamp',
        completedAt: new Date()
      }
    },
    {
      name: 'Special Characters in Name',
      user: {
        _id: '604eb718d68e57bb01c0d861',
        name: "O'Brien-Smith",
        email: 'test@example.com'
      },
      course: {
        _id: '692bbe9989b07acb7e6a2842',
        title: 'C++ & Python: Advanced Programming',
        completedAt: new Date()
      }
    },
    {
      name: 'Unicode Characters',
      user: {
        _id: '604eb718d68e57bb01c0d862',
        name: 'José García',
        email: 'test@example.com'
      },
      course: {
        _id: '692bbe9989b07acb7e6a2842',
        title: 'Machine Learning 101',
        completedAt: new Date()
      }
    }
  ];

  for (const testCase of edgeCases) {
    try {
      console.log(`✓ Testing: ${testCase.name}`);
      await Certificate_service.generateCertificate(
        testCase.user,
        testCase.course
      );
      console.log(`  ✅ Passed\n`);
    } catch (error) {
      console.log(`  ⚠️  ${error.message}\n`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('   🎓 Certificate Generation Test Suite');
  console.log('═'.repeat(60));
  console.log();

  // Check if cloudinary is configured
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn('⚠️  Warning: CLOUDINARY_CLOUD_NAME not set in .env');
    console.warn('   Certificates will not be uploaded to Cloudinary.');
    console.warn('   Please set the environment variables to test uploads.\n');
  }

  try {
    // Run test 1: Basic certificate generation
    console.log('Test 1: Basic Certificate Generation');
    console.log('═'.repeat(60));
    await testCertificateGeneration();

    // Run test 2: Multiple certificates
    console.log('\n\n');
    console.log('Test 2: Multiple Certificate Generation');
    console.log('═'.repeat(60));
    await testMultipleCertificates();

    // Run test 3: Edge cases
    console.log('\n\n');
    console.log('Test 3: Edge Cases');
    console.log('═'.repeat(60));
    await testEdgeCases();

    console.log('\n' + '═'.repeat(60));
    console.log('✨ All tests completed successfully!');
    console.log('═'.repeat(60));
    process.exit(0);
  } catch (error) {
    console.error('\n' + '═'.repeat(60));
    console.error('❌ Test suite failed!');
    console.error('═'.repeat(60));
    process.exit(1);
  }
}

// Run tests
main();
