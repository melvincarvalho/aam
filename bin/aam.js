#!/usr/bin/env node

// IMPORTS
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import minimist from 'minimist';
import {
  createAgentCard,
  initialize,
  addSkill,
  searchAgents,
  searchSkills,
  importSkill,
  registerAgent,
  addFromRepo,
  listInstalled,
  removeInstalled,
  fetchRemoteRegistry,
  getSkillsDir
} from '../lib/index.js';
import { startWizard } from '../lib/wizard.js';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse arguments
const argv = minimist(process.argv.slice(2));

// Function to display help information
function displayHelp () {
  console.log(`
Agent-to-Agent Manager (AAM) - A utility for working with A2A protocol agents

Usage: aam <command> [options]

Skill Commands:
  skill <owner/repo>        Install a skill from GitHub
  skill list                List installed skills
  skill remove <name>       Remove an installed skill
  skill search              Browse available skills from registry

Agent Commands:
  init                      Initialize agent card in .well-known/agent.json
  create-agent [options]    Create an agent card with options
  register-agent            Register agent in the registry
  search-agents <query>     Search for agents in the registry

Other Commands:
  wizard                    Start interactive wizard with guided UI
  help                      Display this help information

Examples:
  aam skills anthropics/skills                # Install skill from GitHub
  aam skills https://github.com/user/repo     # Install from full URL
  aam skills list                             # Show installed skills
  aam skills remove my-skill                  # Uninstall a skill
  aam skills search                           # Browse available skills

  aam init
  aam wizard
  aam create-agent --name "My Agent" --description "A custom agent"
  aam search-agents chatbot
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

// Skill subcommand handler
function handleSkillCommand(subcommand, args) {
  // If subcommand contains '/' or starts with 'http', treat as implicit add
  if (subcommand && (subcommand.includes('/') || subcommand.startsWith('http'))) {
    const repoArg = subcommand;
    console.log(`Installing skill from ${repoArg}...`);
    addFromRepo(repoArg, { force: argv.force, full: argv.full }).then(installResult => {
      if (installResult.success) {
        console.log(`\n✓ Successfully installed "${installResult.skill.name}"`);
        console.log(`  Location: ${installResult.path}`);
        if (installResult.skill.description) {
          console.log(`  Description: ${installResult.skill.description}`);
        }
        if (installResult.skill.installMode) {
          console.log(`  Mode: ${installResult.skill.installMode}`);
        }
      } else {
        console.error('Error:', installResult.error);
        process.exit(1);
      }
    });
    return;
  }

  switch (subcommand) {
    case 'list':
    case 'ls':
      const listResult = listInstalled();

      if (listResult.success) {
        if (listResult.skills.length === 0) {
          console.log('No skills installed.');
          console.log('\nInstall skills with: aam skills <owner/repo>');
        } else {
          console.log(`Installed skills (${listResult.skills.length}):\n`);
          listResult.skills.forEach(skill => {
            console.log(`  ${skill.name}${skill.version ? ` v${skill.version}` : ''}`);
            if (skill.description) {
              console.log(`    ${skill.description}`);
            }
            if (skill.source) {
              console.log(`    Source: ${skill.source}`);
            }
            console.log();
          });
          console.log(`Skills directory: ${getSkillsDir()}`);
        }
      } else {
        console.error('Error:', listResult.error);
        process.exit(1);
      }
      break;

    case 'remove':
    case 'rm':
      const removeArg = args[0];

      if (!removeArg) {
        console.error('Error: Skill name is required');
        console.error('Example: aam skills remove skill-git');
        process.exit(1);
      }

      const removeResult = removeInstalled(removeArg);

      if (removeResult.success) {
        console.log(`✓ Successfully removed "${removeArg}"`);
      } else {
        console.error('Error:', removeResult.error);
        process.exit(1);
      }
      break;

    case 'remote':
    case 'search':
      console.log('Fetching skills from remote registry...');
      fetchRemoteRegistry('skills').then(remoteResult => {
        if (remoteResult.success) {
          const items = remoteResult.data;
          console.log(`\nAvailable skills (${items.length}):\n`);

          items.forEach(item => {
            const name = item.nick || item.name || item.id;
            console.log(`  ${name}`);
            if (item.description) {
              console.log(`    ${item.description}`);
            }
            if (item.repository) {
              console.log(`    Repository: ${item.repository}`);
            }
            console.log();
          });

          console.log(`Install with: aam skills <repository>`);
        } else {
          console.error('Error:', remoteResult.error);
          process.exit(1);
        }
      });
      break;

    default:
      console.log('Usage: aam skills <command>');
      console.log('');
      console.log('Commands:');
      console.log('  aam skills <owner/repo>    Install a skill from GitHub');
      console.log('  aam skills list            List installed skills');
      console.log('  aam skills remove <name>   Remove an installed skill');
      console.log('  aam skills search          Browse available skills');
      console.log('');
      console.log('Examples:');
      console.log('  aam skills anthropics/skills');
      console.log('  aam skills list');
      console.log('  aam skills remove my-skill');
      break;
  }
}

// MAIN
const command = argv._[0];

switch (command) {
  case 'skills':
    handleSkillCommand(argv._[1], argv._.slice(2));
    break;

  // Legacy commands (keep for backwards compatibility)
  case 'add':
    const repoArg = argv._[1];

    if (!repoArg) {
      console.error('Error: Repository is required');
      console.error('Example: aam skills <owner/repo>');
      process.exit(1);
    }

    console.log('Note: Use "aam skills <repo>" instead');
    console.log(`Installing skill from ${repoArg}...`);
    addFromRepo(repoArg, { force: argv.force, full: argv.full }).then(installResult => {
      if (installResult.success) {
        console.log(`\n✓ Successfully installed "${installResult.skill.name}"`);
        console.log(`  Location: ${installResult.path}`);
        if (installResult.skill.description) {
          console.log(`  Description: ${installResult.skill.description}`);
        }
      } else {
        console.error('Error:', installResult.error);
        process.exit(1);
      }
    });
    break;

  case 'list':
    console.log('Note: Use "aam skills list" instead');
    handleSkillCommand('list', []);
    break;

  case 'remove':
    console.log('Note: Use "aam skills remove" instead');
    handleSkillCommand('remove', argv._.slice(1));
    break;

  case 'remote':
    const remoteType = argv._[1] || 'skills';
    console.log(`Note: Use "aam skills search" or "aam agent search" instead`);

    console.log(`Fetching ${remoteType} from remote registry...`);
    fetchRemoteRegistry(remoteType).then(remoteResult => {
      if (remoteResult.success) {
        const items = remoteResult.data;
        console.log(`\nAvailable ${remoteType} (${items.length}):\n`);

        items.forEach(item => {
          const name = item.nick || item.name || item.id;
          console.log(`  ${name}`);
          if (item.description) {
            console.log(`    ${item.description}`);
          }
          if (item.repository) {
            console.log(`    Repository: ${item.repository}`);
          }
          console.log();
        });

        console.log(`Install with: aam skills <repository>`);
      } else {
        console.error('Error:', remoteResult.error);
        process.exit(1);
      }
    });
    break;

  case 'wizard':
    // Start the interactive wizard
    startWizard();
    break;

  case 'init':
    console.log('Initializing AAM project in current directory...');
    const initResult = initialize();
    if (initResult.success) {
      console.log('Successfully initialized AAM project with A2A templates and directories');
      console.log('Created:');
      console.log('  - templates/agent-card.json');
      console.log('  - templates/agent-skill.json');
      console.log('  - registry/agents.json');
      console.log('  - registry/skills.json');
    } else {
      console.error('Error initializing project:', initResult.error);
      console.error('TIP: If you are experiencing permission errors, try:');
      console.error('1. Running the command in a directory where you have write permissions');
      console.error('2. Using a non-root user for npm operations');
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
      console.error('TIP: Make sure you have run `aam init` in this directory first');
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

    const agentCardPath = argv.card || path.join(process.cwd(), '.well-known/agent.json');

    // Verify the agent card exists
    if (!fs.existsSync(agentCardPath)) {
      console.error(`Error: Agent card not found at ${agentCardPath}`);
      console.error('TIP: Make sure you have created an agent card using `aam create-agent` first');
      process.exit(1);
    }

    const addResult = addSkill(skill, agentCardPath);

    if (addResult.success) {
      console.log(`Successfully added skill "${skill.id}" to agent card at ${agentCardPath}`);
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

    const importCardPath = argv.card || path.join(process.cwd(), '.well-known/agent.json');

    // Verify the agent card exists
    if (!fs.existsSync(importCardPath)) {
      console.error(`Error: Agent card not found at ${importCardPath}`);
      console.error('TIP: Make sure you have created an agent card using `aam create-agent` first');
      process.exit(1);
    }

    let importRegistryPath = null;
    if (argv.registry) {
      importRegistryPath = path.resolve(argv.registry);
      if (!fs.existsSync(importRegistryPath)) {
        console.error(`Error: Skills registry not found at ${importRegistryPath}`);
        process.exit(1);
      }
    }

    const importResult = importSkill(skillId, importCardPath, importRegistryPath);

    if (importResult.success) {
      console.log(`Successfully imported skill "${skillId}" to agent card at ${importCardPath}`);
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

    let agentSearchRegistryPath = null;
    if (argv.registry) {
      agentSearchRegistryPath = path.resolve(argv.registry);
      if (!fs.existsSync(agentSearchRegistryPath)) {
        console.error(`Error: Agents registry not found at ${agentSearchRegistryPath}`);
        process.exit(1);
      }
    }

    const agentSearchResult = searchAgents(agentQuery, agentSearchRegistryPath);

    if (agentSearchResult.success) {
      console.log(`Found ${agentSearchResult.results.length} agents matching "${agentQuery}":`);
      if (agentSearchResult.results.length === 0) {
        console.log('No results found.');
      } else {
        agentSearchResult.results.forEach(agent => {
          console.log(`\n- ${agent.name}`);
          console.log(`  ${agent.description}`);
          console.log(`  URL: ${agent.url}`);
          console.log(`  Skills: ${agent.skills ? agent.skills.length : 0}`);
        });
      }
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

    let skillSearchRegistryPath = null;
    if (argv.registry) {
      skillSearchRegistryPath = path.resolve(argv.registry);
      if (!fs.existsSync(skillSearchRegistryPath)) {
        console.error(`Error: Skills registry not found at ${skillSearchRegistryPath}`);
        process.exit(1);
      }
    }

    const skillSearchResult = searchSkills(skillQuery, skillSearchRegistryPath);

    if (skillSearchResult.success) {
      console.log(`Found ${skillSearchResult.results.length} skills matching "${skillQuery}":`);
      if (skillSearchResult.results.length === 0) {
        console.log('No results found.');
      } else {
        skillSearchResult.results.forEach(skill => {
          console.log(`\n- ${skill.name} (${skill.id})`);
          console.log(`  ${skill.description}`);
          console.log(`  Input Modes: ${skill.inputModes ? skill.inputModes.join(', ') : 'N/A'}`);
          console.log(`  Output Modes: ${skill.outputModes ? skill.outputModes.join(', ') : 'N/A'}`);
        });
      }
    } else {
      console.error('Error searching skills:', skillSearchResult.error);
    }
    break;

  case 'register-agent':
    const registerCardPath = argv.card || path.join(process.cwd(), '.well-known/agent.json');

    // Verify the agent card exists
    if (!fs.existsSync(registerCardPath)) {
      console.error(`Error: Agent card not found at ${registerCardPath}`);
      console.error('TIP: Make sure you have created an agent card using `aam create-agent` first');
      process.exit(1);
    }

    let registerRegistryPath = null;
    if (argv.registry) {
      registerRegistryPath = path.resolve(argv.registry);
    } else {
      registerRegistryPath = path.join(process.cwd(), 'registry/agents.json');
    }

    const registerResult = registerAgent(registerCardPath, registerRegistryPath);

    if (registerResult.success) {
      console.log(`Successfully registered agent from ${registerCardPath} in registry at ${registerRegistryPath}`);
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
