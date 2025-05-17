#!/usr/bin/env node

// IMPORTS
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const {
  createAgentCard,
  initialize,
  addSkill,
  searchAgents,
  searchSkills,
  importSkill,
  registerAgent
} = require('../lib/');

// Function to display help information
function displayHelp () {
  console.log(`
Agent-to-Agent Manager (AAM) - A utility for working with A2A protocol agents

Usage: aam <command> [options]

Commands:
  init                      Initialize the project with necessary templates and directories
  create-agent [options]    Create an agent card in .well-known/agent.json
  add-skill [options]       Add a skill to an agent card
  import-skill <skill-id>   Import a skill from registry to agent card
  search-agents <query>     Search for agents in the registry
  search-skills <query>     Search for skills in the registry
  register-agent            Register an agent in the registry
  help                      Display this help information

Examples:
  aam init
  aam create-agent --name "My Agent" --description "A custom A2A agent" --url "https://example.com/a2a"
  aam add-skill --id "custom-skill" --name "Custom Skill" --description "A custom skill"
  aam import-skill text-generation
  aam search-agents chatbot
  aam search-skills image
  aam register-agent
  `);
}

// Function to parse skill arguments
function parseSkillFromArgs (args) {
  const skill = {
    id: args['id'],
    name: args['name'],
    description: args['description'],
    inputModes: args['input-modes'] ? args['input-modes'].split(',') : ['text'],
    outputModes: args['output-modes'] ? args['output-modes'].split(',') : ['text']
  };

  // Add examples if provided
  if (args['example-input'] && args['example-output']) {
    skill.examples = [
      {
        input: { text: args['example-input'] },
        output: { text: args['example-output'] }
      }
    ];
  }

  return skill;
}

// MAIN
const command = argv._[0];

switch (command) {
  case 'init':
    const initResult = initialize();
    if (initResult.success) {
      console.log('Successfully initialized AAM project with A2A templates and directories');
    } else {
      console.error('Error initializing project:', initResult.error);
    }
    break;

  case 'create-agent':
    const createOptions = {
      name: argv.name,
      description: argv.description,
      url: argv.url,
      providerName: argv['provider-name'],
      providerUrl: argv['provider-url'],
      version: argv.version
    };

    const createResult = createAgentCard(createOptions);
    if (createResult.success) {
      console.log(`Successfully created agent card at: ${createResult.path}`);
      console.log('Agent card details:');
      console.log(JSON.stringify(createResult.agentCard, null, 2));
    } else {
      console.error('Error creating agent card:', createResult.error);
    }
    break;

  case 'add-skill':
    // Parse skill from arguments
    const skill = parseSkillFromArgs(argv);

    if (!skill.id || !skill.name || !skill.description) {
      console.error('Error: Skill must have id, name, and description');
      console.error('Example: aam add-skill --id "custom-skill" --name "Custom Skill" --description "A custom skill"');
      process.exit(1);
    }

    const agentCardPath = argv.card || '.well-known/agent.json';
    const addResult = addSkill(skill, agentCardPath);

    if (addResult.success) {
      console.log(`Successfully added skill "${skill.id}" to agent card`);
    } else {
      console.error('Error adding skill:', addResult.error);
    }
    break;

  case 'import-skill':
    const skillId = argv._[1];

    if (!skillId) {
      console.error('Error: Skill ID is required');
      console.error('Example: aam import-skill text-generation');
      process.exit(1);
    }

    const importCardPath = argv.card || '.well-known/agent.json';
    const importRegistryPath = argv.registry;
    const importResult = importSkill(skillId, importCardPath, importRegistryPath);

    if (importResult.success) {
      console.log(`Successfully imported skill "${skillId}" to agent card`);
    } else {
      console.error('Error importing skill:', importResult.error);
    }
    break;

  case 'search-agents':
    const agentQuery = argv._[1];

    if (!agentQuery) {
      console.error('Error: Search query is required');
      console.error('Example: aam search-agents chatbot');
      process.exit(1);
    }

    const agentSearchRegistryPath = argv.registry;
    const agentSearchResult = searchAgents(agentQuery, agentSearchRegistryPath);

    if (agentSearchResult.success) {
      console.log(`Found ${agentSearchResult.results.length} agents matching "${agentQuery}":`);
      agentSearchResult.results.forEach(agent => {
        console.log(`\n- ${agent.name}`);
        console.log(`  ${agent.description}`);
        console.log(`  URL: ${agent.url}`);
        console.log(`  Skills: ${agent.skills ? agent.skills.length : 0}`);
      });
    } else {
      console.error('Error searching agents:', agentSearchResult.error);
    }
    break;

  case 'search-skills':
    const skillQuery = argv._[1];

    if (!skillQuery) {
      console.error('Error: Search query is required');
      console.error('Example: aam search-skills image');
      process.exit(1);
    }

    const skillSearchRegistryPath = argv.registry;
    const skillSearchResult = searchSkills(skillQuery, skillSearchRegistryPath);

    if (skillSearchResult.success) {
      console.log(`Found ${skillSearchResult.results.length} skills matching "${skillQuery}":`);
      skillSearchResult.results.forEach(skill => {
        console.log(`\n- ${skill.name} (${skill.id})`);
        console.log(`  ${skill.description}`);
        console.log(`  Input Modes: ${skill.inputModes ? skill.inputModes.join(', ') : 'N/A'}`);
        console.log(`  Output Modes: ${skill.outputModes ? skill.outputModes.join(', ') : 'N/A'}`);
      });
    } else {
      console.error('Error searching skills:', skillSearchResult.error);
    }
    break;

  case 'register-agent':
    const registerCardPath = argv.card || '.well-known/agent.json';
    const registerRegistryPath = argv.registry;
    const registerResult = registerAgent(registerCardPath, registerRegistryPath);

    if (registerResult.success) {
      console.log('Successfully registered agent in registry');
    } else {
      console.error('Error registering agent:', registerResult.error);
    }
    break;

  case 'help':
    displayHelp();
    break;

  default:
    console.error('Unknown command:', command);
    displayHelp();
    process.exit(1);
}
