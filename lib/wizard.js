import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  initialize,
  createAgentCard,
  addSkill,
  importSkill,
  searchAgents,
  searchSkills,
  registerAgent
} from './index.js';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Display a fancy title banner
 * @param {string} text Text to display in banner
 */
function displayBanner (text) {
  console.log(
    chalk.cyan(
      figlet.textSync(text, {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
      })
    )
  );
  console.log(chalk.cyan('='.repeat(60)));
  console.log(chalk.cyan('Agent-to-Agent Manager (AAM) Interactive Wizard'));
  console.log(chalk.cyan('='.repeat(60)));
  console.log();
}

/**
 * Display success message
 * @param {string} message Success message
 */
function showSuccess (message) {
  console.log(chalk.green('✓ SUCCESS: ') + message);
}

/**
 * Display error message
 * @param {string} message Error message
 */
function showError (message) {
  console.log(chalk.red('✗ ERROR: ') + message);
}

/**
 * Display info message
 * @param {string} message Info message
 */
function showInfo (message) {
  console.log(chalk.blue('ℹ INFO: ') + message);
}

/**
 * Start the interactive wizard
 */
export async function startWizard () {
  displayBanner('AAM');

  // Check if we're in an initialized directory
  const hasTemplates = fs.existsSync(path.join(process.cwd(), 'templates'));
  const hasRegistry = fs.existsSync(path.join(process.cwd(), 'registry'));
  const hasWellKnown = fs.existsSync(path.join(process.cwd(), '.well-known'));

  if (!hasTemplates || !hasRegistry) {
    showInfo('This directory is not initialized for AAM.');

    const { shouldInit } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldInit',
        message: 'Do you want to initialize AAM in this directory?',
        default: true
      }
    ]);

    if (shouldInit) {
      const spinner = ora('Initializing AAM in this directory...').start();
      const result = initialize();

      if (result.success) {
        spinner.succeed('Successfully initialized AAM with templates and directories');
      } else {
        spinner.fail(`Failed to initialize: ${result.error}`);
        return;
      }
    } else {
      showInfo('Please navigate to an initialized AAM directory or initialize one first.');
      return;
    }
  }

  // Check if agent card exists
  const agentCardPath = path.join(process.cwd(), '.well-known/agent.json');
  const hasExistingCard = fs.existsSync(agentCardPath);

  let action;

  if (hasExistingCard) {
    // Read agent card to display info
    const agentCard = JSON.parse(fs.readFileSync(agentCardPath, 'utf8'));
    showInfo(`Found existing agent card: ${chalk.yellow(agentCard.name)}`);

    const { mainAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mainAction',
        message: 'What would you like to do?',
        choices: [
          { name: 'Manage agent card', value: 'manageAgent' },
          { name: 'Manage skills', value: 'manageSkills' },
          { name: 'Search registry', value: 'searchRegistry' },
          { name: 'Register agent to registry', value: 'registerAgent' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    action = mainAction;
  } else {
    const { initialAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'initialAction',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create a new agent card', value: 'manageAgent' },
          { name: 'Search registry', value: 'searchRegistry' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    action = initialAction;
  }

  switch (action) {
    case 'manageAgent':
      await manageAgentCard(hasExistingCard);
      break;
    case 'manageSkills':
      await manageSkills();
      break;
    case 'searchRegistry':
      await searchRegistry();
      break;
    case 'registerAgent':
      await registerAgentToRegistry();
      break;
    case 'exit':
      showInfo('Exiting. Goodbye!');
      break;
  }
}

/**
 * Manage agent card creation or updates
 * @param {boolean} hasExistingCard Whether an agent card already exists
 */
async function manageAgentCard (hasExistingCard) {
  console.log(chalk.cyan('\n== Agent Card Management =='));

  let existingCard = null;
  const agentCardPath = path.join(process.cwd(), '.well-known/agent.json');

  if (hasExistingCard) {
    existingCard = JSON.parse(fs.readFileSync(agentCardPath, 'utf8'));

    console.log(chalk.yellow('\nCurrent Agent Card Details:'));
    console.log(chalk.yellow(`Name: ${existingCard.name}`));
    console.log(chalk.yellow(`Description: ${existingCard.description}`));
    console.log(chalk.yellow(`URL: ${existingCard.url}`));
    console.log(chalk.yellow(`Provider: ${existingCard.provider?.name || 'N/A'}`));
    console.log(chalk.yellow(`Skills: ${existingCard.skills?.length || 0}`));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Update this agent card', value: 'update' },
          { name: 'Create a new agent card (will overwrite current)', value: 'create' },
          { name: 'Go back to main menu', value: 'back' }
        ]
      }
    ]);

    if (action === 'back') {
      await startWizard();
      return;
    }
  }

  await createOrUpdateAgentCard(existingCard);
}

/**
 * Create or update an agent card
 * @param {object} existingCard Existing agent card data if updating
 */
async function createOrUpdateAgentCard (existingCard) {
  const isUpdate = !!existingCard;

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Agent name:',
      default: existingCard?.name || 'My Agent',
      validate: input => input.trim() !== '' ? true : 'Name is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Agent description:',
      default: existingCard?.description || 'An A2A protocol agent',
      validate: input => input.trim() !== '' ? true : 'Description is required'
    },
    {
      type: 'input',
      name: 'url',
      message: 'Agent URL:',
      default: existingCard?.url || 'https://example.com/a2a',
      validate: input => {
        try {
          new URL(input);
          return true;
        } catch (e) {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'providerName',
      message: 'Provider name:',
      default: existingCard?.provider?.name || 'My Organization'
    },
    {
      type: 'input',
      name: 'providerUrl',
      message: 'Provider URL:',
      default: existingCard?.provider?.url || 'https://example.com',
      validate: input => {
        try {
          new URL(input);
          return true;
        } catch (e) {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'version',
      message: 'Agent version:',
      default: existingCard?.version || '1.0.0',
      validate: input => /^\d+\.\d+\.\d+$/.test(input) ? true : 'Please use semantic versioning (e.g., 1.0.0)'
    },
    {
      type: 'confirm',
      name: 'streamingCapability',
      message: 'Enable streaming capability?',
      default: existingCard?.capabilities?.streaming !== undefined ? existingCard.capabilities.streaming : true
    },
    {
      type: 'confirm',
      name: 'multiTurnCapability',
      message: 'Enable multi-turn conversation capability?',
      default: existingCard?.capabilities?.multiTurn !== undefined ? existingCard.capabilities.multiTurn : true
    }
  ]);

  const spinner = ora(`${isUpdate ? 'Updating' : 'Creating'} agent card...`).start();

  const createOptions = {
    name: answers.name,
    description: answers.description,
    url: answers.url,
    providerName: answers.providerName,
    providerUrl: answers.providerUrl,
    version: answers.version
  };

  // Save existing skills if updating
  const existingSkills = existingCard?.skills || [];

  const result = createAgentCard(createOptions);

  if (result.success) {
    // Update the capabilities
    const agentCardPath = path.join(process.cwd(), '.well-known/agent.json');
    const updatedCard = JSON.parse(fs.readFileSync(agentCardPath, 'utf8'));

    updatedCard.capabilities = {
      streaming: answers.streamingCapability,
      pushNotifications: false, // Default for now
      multiTurn: answers.multiTurnCapability
    };

    // Restore existing skills if updating
    if (isUpdate) {
      updatedCard.skills = existingSkills;
    }

    // Write back the updated card
    fs.writeFileSync(agentCardPath, JSON.stringify(updatedCard, null, 2), 'utf8');

    spinner.succeed(`Agent card successfully ${isUpdate ? 'updated' : 'created'} at ${agentCardPath}`);

    const { nextAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'nextAction',
        message: 'What would you like to do next?',
        choices: [
          { name: 'Manage skills', value: 'skills' },
          { name: 'Return to main menu', value: 'main' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    if (nextAction === 'skills') {
      await manageSkills();
    } else if (nextAction === 'main') {
      await startWizard();
    } else {
      showInfo('Exiting. Goodbye!');
    }
  } else {
    spinner.fail(`Failed to ${isUpdate ? 'update' : 'create'} agent card: ${result.error}`);
    await startWizard();
  }
}

/**
 * Manage skills for an agent
 */
async function manageSkills () {
  console.log(chalk.cyan('\n== Skills Management =='));

  const agentCardPath = path.join(process.cwd(), '.well-known/agent.json');

  if (!fs.existsSync(agentCardPath)) {
    showError('Agent card not found. Create an agent card first.');
    await startWizard();
    return;
  }

  const agentCard = JSON.parse(fs.readFileSync(agentCardPath, 'utf8'));
  const skills = agentCard.skills || [];

  if (skills.length === 0) {
    showInfo('This agent has no skills yet.');
  } else {
    console.log(chalk.yellow('\nCurrent Skills:'));
    skills.forEach((skill, index) => {
      console.log(chalk.yellow(`${index + 1}. ${skill.name} (${skill.id})`));
      console.log(chalk.gray(`   ${skill.description}`));
      console.log(chalk.gray(`   Input: ${skill.inputModes.join(', ')}`));
      console.log(chalk.gray(`   Output: ${skill.outputModes.join(', ')}`));
      if (index < skills.length - 1) console.log(); // Add line between skills
    });
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Add a new skill', value: 'add' },
        { name: 'Import a skill from registry', value: 'import' },
        { name: 'Return to main menu', value: 'main' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);

  switch (action) {
    case 'add':
      await addNewSkill(agentCardPath);
      break;
    case 'import':
      await importSkillFromRegistry(agentCardPath);
      break;
    case 'main':
      await startWizard();
      break;
    case 'exit':
      showInfo('Exiting. Goodbye!');
      break;
  }
}

/**
 * Add a new skill to an agent
 * @param {string} agentCardPath Path to the agent card
 */
async function addNewSkill (agentCardPath) {
  console.log(chalk.cyan('\n== Add New Skill =='));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'id',
      message: 'Skill ID (lowercase, no spaces):',
      validate: input => {
        if (input.trim() === '') return 'ID is required';
        if (!/^[a-z0-9-]+$/.test(input)) return 'ID must only contain lowercase letters, numbers, and hyphens';
        return true;
      }
    },
    {
      type: 'input',
      name: 'name',
      message: 'Skill name:',
      validate: input => input.trim() !== '' ? true : 'Name is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Skill description:',
      validate: input => input.trim() !== '' ? true : 'Description is required'
    },
    {
      type: 'checkbox',
      name: 'inputModes',
      message: 'Input modes (select at least one):',
      choices: ['text', 'image', 'audio', 'video', 'json'],
      default: ['text'],
      validate: input => input.length > 0 ? true : 'Select at least one input mode'
    },
    {
      type: 'checkbox',
      name: 'outputModes',
      message: 'Output modes (select at least one):',
      choices: ['text', 'image', 'audio', 'video', 'json'],
      default: ['text'],
      validate: input => input.length > 0 ? true : 'Select at least one output mode'
    },
    {
      type: 'confirm',
      name: 'hasExample',
      message: 'Add an example for this skill?',
      default: true
    }
  ]);

  let examples = [];

  if (answers.hasExample) {
    const exampleAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: 'Example input:',
        validate: input => input.trim() !== '' ? true : 'Example input is required'
      },
      {
        type: 'input',
        name: 'output',
        message: 'Example output:',
        validate: input => input.trim() !== '' ? true : 'Example output is required'
      }
    ]);

    examples = [
      {
        input: { text: exampleAnswers.input },
        output: { text: exampleAnswers.output }
      }
    ];
  }

  const skill = {
    id: answers.id,
    name: answers.name,
    description: answers.description,
    inputModes: answers.inputModes,
    outputModes: answers.outputModes
  };

  if (examples.length > 0) {
    skill.examples = examples;
  }

  const spinner = ora('Adding skill...').start();
  const result = addSkill(skill, agentCardPath);

  if (result.success) {
    spinner.succeed(`Skill "${answers.name}" successfully added to agent card`);
  } else {
    spinner.fail(`Failed to add skill: ${result.error}`);
  }

  const { nextAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'nextAction',
      message: 'What would you like to do next?',
      choices: [
        { name: 'Add another skill', value: 'add' },
        { name: 'Return to skills management', value: 'skills' },
        { name: 'Return to main menu', value: 'main' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);

  switch (nextAction) {
    case 'add':
      await addNewSkill(agentCardPath);
      break;
    case 'skills':
      await manageSkills();
      break;
    case 'main':
      await startWizard();
      break;
    case 'exit':
      showInfo('Exiting. Goodbye!');
      break;
  }
}

/**
 * Import a skill from the registry
 * @param {string} agentCardPath Path to the agent card
 */
async function importSkillFromRegistry (agentCardPath) {
  console.log(chalk.cyan('\n== Import Skill from Registry =='));

  // First, show available skills from registry
  const skillsRegistryPath = path.join(process.cwd(), 'registry/skills.json');

  if (!fs.existsSync(skillsRegistryPath)) {
    showError('Skills registry not found. Initialize the project first.');
    await startWizard();
    return;
  }

  const registry = JSON.parse(fs.readFileSync(skillsRegistryPath, 'utf8'));

  if (registry.length === 0) {
    showInfo('The skills registry is empty. Add skills to the registry first.');
    await startWizard();
    return;
  }

  // Display available skills
  console.log(chalk.yellow('\nAvailable Skills in Registry:'));
  registry.forEach((skill, index) => {
    console.log(chalk.yellow(`${index + 1}. ${skill.name} (${skill.id})`));
    console.log(chalk.gray(`   ${skill.description}`));
  });

  const { skillChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'skillChoice',
      message: 'Select a skill to import:',
      choices: registry.map((skill, index) => ({
        name: `${skill.name} (${skill.id})`,
        value: skill.id
      }))
    }
  ]);

  const spinner = ora(`Importing skill "${skillChoice}"...`).start();
  const result = importSkill(skillChoice, agentCardPath);

  if (result.success) {
    spinner.succeed(`Skill "${skillChoice}" successfully imported to agent card`);
  } else {
    spinner.fail(`Failed to import skill: ${result.error}`);
  }

  const { nextAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'nextAction',
      message: 'What would you like to do next?',
      choices: [
        { name: 'Import another skill', value: 'import' },
        { name: 'Return to skills management', value: 'skills' },
        { name: 'Return to main menu', value: 'main' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);

  switch (nextAction) {
    case 'import':
      await importSkillFromRegistry(agentCardPath);
      break;
    case 'skills':
      await manageSkills();
      break;
    case 'main':
      await startWizard();
      break;
    case 'exit':
      showInfo('Exiting. Goodbye!');
      break;
  }
}

/**
 * Search the registry for agents or skills
 */
async function searchRegistry () {
  console.log(chalk.cyan('\n== Search Registry =='));

  const { searchType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'searchType',
      message: 'What would you like to search for?',
      choices: [
        { name: 'Search for Agents', value: 'agents' },
        { name: 'Search for Skills', value: 'skills' }
      ]
    }
  ]);

  const { query } = await inquirer.prompt([
    {
      type: 'input',
      name: 'query',
      message: `Enter search query for ${searchType}:`,
      validate: input => input.trim() !== '' ? true : 'Search query is required'
    }
  ]);

  const spinner = ora(`Searching for ${searchType} matching "${query}"...`).start();

  let result;
  if (searchType === 'agents') {
    result = searchAgents(query);
  } else {
    result = searchSkills(query);
  }

  if (result.success) {
    spinner.succeed(`Found ${result.results.length} ${searchType} matching "${query}"`);

    if (result.results.length === 0) {
      showInfo('No results found.');
    } else {
      console.log(chalk.yellow('\nSearch Results:'));

      if (searchType === 'agents') {
        result.results.forEach((agent, index) => {
          console.log(chalk.yellow(`${index + 1}. ${agent.name}`));
          console.log(chalk.gray(`   ${agent.description}`));
          console.log(chalk.gray(`   URL: ${agent.url}`));
          console.log(chalk.gray(`   Skills: ${agent.skills ? agent.skills.length : 0}`));
          if (index < result.results.length - 1) console.log(); // Add line between agents
        });
      } else {
        result.results.forEach((skill, index) => {
          console.log(chalk.yellow(`${index + 1}. ${skill.name} (${skill.id})`));
          console.log(chalk.gray(`   ${skill.description}`));
          console.log(chalk.gray(`   Input: ${skill.inputModes.join(', ')}`));
          console.log(chalk.gray(`   Output: ${skill.outputModes.join(', ')}`));
          if (index < result.results.length - 1) console.log(); // Add line between skills
        });
      }
    }
  } else {
    spinner.fail(`Failed to search registry: ${result.error}`);
  }

  const { nextAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'nextAction',
      message: 'What would you like to do next?',
      choices: [
        { name: 'Search again', value: 'search' },
        { name: 'Return to main menu', value: 'main' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);

  switch (nextAction) {
    case 'search':
      await searchRegistry();
      break;
    case 'main':
      await startWizard();
      break;
    case 'exit':
      showInfo('Exiting. Goodbye!');
      break;
  }
}

/**
 * Register the agent to the registry
 */
async function registerAgentToRegistry () {
  console.log(chalk.cyan('\n== Register Agent to Registry =='));

  const agentCardPath = path.join(process.cwd(), '.well-known/agent.json');

  if (!fs.existsSync(agentCardPath)) {
    showError('Agent card not found. Create an agent card first.');
    await startWizard();
    return;
  }

  const agentCard = JSON.parse(fs.readFileSync(agentCardPath, 'utf8'));

  console.log(chalk.yellow(`\nRegistering agent: ${agentCard.name}`));
  console.log(chalk.gray(`Description: ${agentCard.description}`));
  console.log(chalk.gray(`URL: ${agentCard.url}`));
  console.log(chalk.gray(`Skills: ${agentCard.skills?.length || 0}`));

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to register this agent to the registry?',
      default: true
    }
  ]);

  if (confirm) {
    const spinner = ora('Registering agent...').start();
    const result = registerAgent(agentCardPath);

    if (result.success) {
      spinner.succeed('Agent successfully registered to registry');
    } else {
      spinner.fail(`Failed to register agent: ${result.error}`);
    }
  } else {
    showInfo('Registration cancelled.');
  }

  const { nextAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'nextAction',
      message: 'What would you like to do next?',
      choices: [
        { name: 'Return to main menu', value: 'main' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);

  if (nextAction === 'main') {
    await startWizard();
  } else {
    showInfo('Exiting. Goodbye!');
  }
} 