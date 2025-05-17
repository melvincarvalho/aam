#!/usr/bin/env node

import { initialize, createAgentCard } from './lib/index.js';

// Simple test of the ES module functions
console.log('Testing AAM as an ES module:');

const init = initialize();
if (init.success) {
  console.log('✅ Initialize function works');
} else {
  console.error('❌ Initialize function failed:', init.error);
}

const agentOptions = {
  name: 'Test ES Module Agent',
  description: 'An agent created to test ES modules',
  url: 'https://example.com/test-esm'
};

const create = createAgentCard(agentOptions);
if (create.success) {
  console.log('✅ CreateAgentCard function works');
  console.log('Agent card created at:', create.path);
} else {
  console.error('❌ CreateAgentCard function failed:', create.error);
}

console.log('ES module test completed'); 