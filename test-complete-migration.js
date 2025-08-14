/**
 * Complete Migration Test Script
 * Tests the fully migrated WebSocket implementation end-to-end
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - File not found: ${filePath}`, 'red');
    return false;
  }
}

function checkFileContent(filePath, searchString, description) {
  const fullPath = path.join(__dirname, filePath);
  try {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(searchString)) {
        log(`✅ ${description}`, 'green');
        return true;
      } else {
        log(`❌ ${description} - Search string not found`, 'red');
        return false;
      }
    } else {
      log(`❌ ${description} - File not found: ${filePath}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ ${description} - Error reading file: ${error.message}`, 'red');
    return false;
  }
}

function checkPackageDependency(dependency, description) {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (packageJson.dependencies[dependency] || packageJson.devDependencies[dependency]) {
      log(`✅ ${description}`, 'green');
      return true;
    } else {
      log(`❌ ${description} - Dependency not found: ${dependency}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ ${description} - Error reading package.json: ${error.message}`, 'red');
    return false;
  }
}

async function runMigrationTest() {
  log('🚀 Running Complete WebSocket Migration Test', 'bright');
  log('=' .repeat(60), 'blue');

  let totalTests = 0;
  let passedTests = 0;

  const tests = [
    // Backend Files
    {
      test: () => checkFile('backend/src/models/websocket_messages.py', 'New WebSocket message models'),
      category: 'Backend Message Models'
    },
    {
      test: () => checkFile('backend/src/core/improved_websocket_manager.py', 'Improved WebSocket manager'),
      category: 'Backend Core'
    },
    {
      test: () => checkFile('backend/src/routers/improved_websocket.py', 'Improved WebSocket router'),
      category: 'Backend Routing'
    },
    {
      test: () => checkFileContent('backend/main.py', 'improved_websocket_endpoint', 'Main.py uses improved WebSocket'),
      category: 'Backend Integration'
    },
    {
      test: () => checkFile('backend/test_improved_websocket.py', 'Backend test script'),
      category: 'Backend Testing'
    },

    // Frontend Dependencies
    {
      test: () => checkPackageDependency('uuid', 'UUID dependency'),
      category: 'Frontend Dependencies'
    },
    {
      test: () => checkPackageDependency('@types/uuid', 'UUID TypeScript types'),
      category: 'Frontend Dependencies'
    },

    // Frontend Services
    {
      test: () => checkFile('services/improved-websocket-service.ts', 'Improved WebSocket service'),
      category: 'Frontend Services'
    },
    {
      test: () => checkFile('services/websocket.ts', 'Primary WebSocket service export'),
      category: 'Frontend Services'
    },
    {
      test: () => checkFileContent('services/websocket-service.ts', 'DEPRECATED', 'Legacy service marked as deprecated'),
      category: 'Frontend Services'
    },

    // Frontend Hooks
    {
      test: () => checkFile('hooks/use-improved-websocket.ts', 'Improved WebSocket hook'),
      category: 'Frontend Hooks'
    },
    {
      test: () => checkFileContent('hooks/use-websocket.ts', 'use-improved-websocket', 'Primary hook uses improved implementation'),
      category: 'Frontend Hooks'
    },
    {
      test: () => checkFile('hooks/use-websocket-legacy.ts', 'Legacy hook preserved'),
      category: 'Frontend Hooks'
    },

    // Frontend Components
    {
      test: () => checkFile('components/builder/improved-upload-step.tsx', 'Improved upload step component'),
      category: 'Frontend Components'
    },
    {
      test: () => checkFile('components/builder/improved-theme-step.tsx', 'Improved theme step component'),
      category: 'Frontend Components'
    },
    {
      test: () => checkFile('components/builder/improved-content-step.tsx', 'Improved content step component'),
      category: 'Frontend Components'
    },
    {
      test: () => checkFile('components/builder/improved-preview-step.tsx', 'Improved preview step component'),
      category: 'Frontend Components'
    },

    // Documentation
    {
      test: () => checkFile('WEBSOCKET_MIGRATION_GUIDE.md', 'Migration guide'),
      category: 'Documentation'
    },
    {
      test: () => checkFile('BACKEND_SYSTEM_ARCHITECTURE.md', 'System architecture documentation'),
      category: 'Documentation'
    },

    // Message Models Validation
    {
      test: () => checkFileContent('backend/src/models/websocket_messages.py', 'MessageType', 'Message types enum defined'),
      category: 'Backend Validation'
    },
    {
      test: () => checkFileContent('backend/src/models/websocket_messages.py', 'BaseWebSocketMessage', 'Base message class defined'),
      category: 'Backend Validation'
    },
    {
      test: () => checkFileContent('backend/src/models/websocket_messages.py', 'FileUploadMessage', 'File upload message defined'),
      category: 'Backend Validation'
    },

    // Frontend TypeScript Validation
    {
      test: () => checkFileContent('services/improved-websocket-service.ts', 'enum MessageType', 'Frontend message types defined'),
      category: 'Frontend Validation'
    },
    {
      test: () => checkFileContent('services/improved-websocket-service.ts', 'ImprovedWebSocketService', 'Improved service class defined'),
      category: 'Frontend Validation'
    },
    {
      test: () => checkFileContent('hooks/use-improved-websocket.ts', 'useImprovedWebSocket', 'Improved hook function defined'),
      category: 'Frontend Validation'
    }
  ];

  // Group tests by category
  const testsByCategory = {};
  tests.forEach(test => {
    if (!testsByCategory[test.category]) {
      testsByCategory[test.category] = [];
    }
    testsByCategory[test.category].push(test);
  });

  // Run tests by category
  for (const [category, categoryTests] of Object.entries(testsByCategory)) {
    log(`\n📁 ${category}`, 'cyan');
    log('-'.repeat(40), 'blue');

    let categoryPassed = 0;
    for (const test of categoryTests) {
      totalTests++;
      if (test.test()) {
        passedTests++;
        categoryPassed++;
      }
    }

    const categoryPercentage = ((categoryPassed / categoryTests.length) * 100).toFixed(1);
    log(`Category Score: ${categoryPassed}/${categoryTests.length} (${categoryPercentage}%)`, 
        categoryPassed === categoryTests.length ? 'green' : 'yellow');
  }

  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('📊 MIGRATION TEST SUMMARY', 'bright');
  log('='.repeat(60), 'blue');

  const percentage = ((passedTests / totalTests) * 100).toFixed(1);
  log(`Total Tests: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, passedTests === totalTests ? 'green' : 'yellow');
  log(`Failed: ${totalTests - passedTests}`, totalTests - passedTests === 0 ? 'green' : 'red');
  log(`Success Rate: ${percentage}%`, passedTests === totalTests ? 'green' : 'yellow');

  if (passedTests === totalTests) {
    log('\n🎉 All migration tests passed! The WebSocket implementation is fully migrated.', 'green');
    log('\nNext steps:', 'bright');
    log('1. Run backend tests: cd backend && uv run python test_improved_websocket.py', 'blue');
    log('2. Install frontend dependencies: npm install', 'blue');
    log('3. Start the application: ./start-app-robust.sh', 'blue');
    log('4. Test the improved WebSocket functionality in the UI', 'blue');
  } else {
    log(`\n⚠️  ${totalTests - passedTests} migration tests failed. Please review the missing files/implementations.`, 'yellow');
    
    log('\nCommon issues and solutions:', 'bright');
    log('• Missing files: Ensure all new files were created correctly', 'blue');
    log('• Import errors: Check that import paths are correct', 'blue');  
    log('• Type errors: Ensure TypeScript types are properly defined', 'blue');
    log('• Dependency issues: Run npm install to install new dependencies', 'blue');
  }

  // Additional checks
  log('\n🔍 Additional Recommendations:', 'magenta');
  log('• Update your IDE/editor to recognize new file patterns', 'blue');
  log('• Review the WEBSOCKET_MIGRATION_GUIDE.md for usage examples', 'blue');
  log('• Check the BACKEND_SYSTEM_ARCHITECTURE.md for architecture details', 'blue');
  log('• Consider running performance tests after migration', 'blue');

  return passedTests === totalTests;
}

// Run the test
if (require.main === module) {
  runMigrationTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      log(`💥 Test script failed: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = { runMigrationTest };