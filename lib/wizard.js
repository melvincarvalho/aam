import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

import {
  listInstalled,
  addFromRepo,
  removeInstalled,
  signSkill,
  verifySkill,
  getSkillsDir
} from './index.js';

/**
 * Display banner
 */
function displayBanner() {
  console.log(
    chalk.cyan(
      figlet.textSync('AAM', {
        font: 'Standard',
        horizontalLayout: 'default'
      })
    )
  );
  console.log(chalk.gray('Agent-to-Agent Manager - Interactive Wizard'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log();
}

/**
 * Check if user has an agent identity
 */
function hasAgentIdentity() {
  try {
    const privkey = execSync('git config nostr.privkey', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    return privkey.length === 64;
  } catch {
    return false;
  }
}

/**
 * Get agent pubkey
 */
function getAgentPubkey() {
  try {
    const didFile = path.join(process.cwd(), 'agent.did.json');
    if (fs.existsSync(didFile)) {
      const did = JSON.parse(fs.readFileSync(didFile, 'utf8'));
      return did.id.replace('did:nostr:', '');
    }
  } catch {}
  return null;
}

/**
 * Start the interactive wizard
 */
export async function startWizard() {
  // Check for interactive terminal
  if (!process.stdin.isTTY) {
    console.error(chalk.red('Error: Interactive mode required.'));
    console.error('The wizard needs a terminal with TTY support.');
    console.error('');
    console.error('For non-interactive usage, use CLI commands directly:');
    console.error('  aam skills <owner/repo>     Install a skill');
    console.error('  aam skills list             List installed skills');
    console.error('  aam skills sign <name>      Sign a skill');
    console.error('  aam --help                  Show all commands');
    process.exit(1);
  }

  displayBanner();

  // Check identity status
  const hasIdentity = hasAgentIdentity();
  const pubkey = getAgentPubkey();

  if (hasIdentity && pubkey) {
    console.log(chalk.green('✓ Agent identity found'));
    console.log(chalk.gray(`  Pubkey: ${pubkey.substring(0, 16)}...`));
  } else {
    console.log(chalk.yellow('⚠ No agent identity found'));
    console.log(chalk.gray('  Run: npx --yes create-agent@latest'));
  }
  console.log();

  await mainMenu(hasIdentity);
}

/**
 * Main menu
 */
async function mainMenu(hasIdentity) {
  const choices = [
    { name: '📦 Browse & install skills', value: 'install' },
    { name: '📋 List installed skills', value: 'list' },
  ];

  if (hasIdentity) {
    choices.push({ name: '✍️  Sign a skill', value: 'sign' });
  }

  choices.push(
    { name: '🔍 Verify a skill', value: 'verify' },
    { name: '🗑️  Remove a skill', value: 'remove' },
    new inquirer.Separator(),
    { name: 'Exit', value: 'exit' }
  );

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices
    }
  ]);

  switch (action) {
    case 'install':
      await installSkillFlow();
      break;
    case 'list':
      await listInstalledFlow();
      break;
    case 'sign':
      await signSkillFlow();
      break;
    case 'verify':
      await verifySkillFlow();
      break;
    case 'remove':
      await removeInstalledFlow();
      break;
    case 'exit':
      console.log(chalk.cyan('Goodbye!'));
      return;
  }

  // Return to main menu
  console.log();
  await mainMenu(hasIdentity);
}

/**
 * Install skill flow
 */
async function installSkillFlow() {
  console.log(chalk.cyan('\n── Install Skill ──\n'));

  const { repoInput } = await inquirer.prompt([
    {
      type: 'input',
      name: 'repoInput',
      message: 'Enter GitHub repo (owner/repo):',
      default: 'anthropics/skills',
      validate: input => {
        if (!input.includes('/')) return 'Format: owner/repo';
        return true;
      }
    }
  ]);

  const { installGlobal } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'installGlobal',
      message: 'Install globally (~/.claude/skills)?',
      default: false
    }
  ]);

  const spinner = ora(`Installing ${repoInput}...`).start();

  try {
    const result = await addFromRepo(repoInput, { global: installGlobal });
    if (result.success) {
      spinner.succeed(`Installed "${result.name}" to ${result.path}`);
    } else {
      spinner.fail(result.error);
    }
  } catch (err) {
    spinner.fail(err.message);
  }
}

/**
 * List skills flow
 */
async function listInstalledFlow() {
  console.log(chalk.cyan('\n── Installed Skills ──\n'));

  const { location } = await inquirer.prompt([
    {
      type: 'list',
      name: 'location',
      message: 'Which skills?',
      choices: [
        { name: 'Local (./.claude/skills)', value: 'local' },
        { name: 'Global (~/.claude/skills)', value: 'global' },
        { name: 'Both', value: 'both' }
      ]
    }
  ]);

  if (location === 'local' || location === 'both') {
    console.log(chalk.yellow('\nLocal skills:'));
    const localResult = listInstalled({ global: false });
    displaySkillsList(localResult);
  }

  if (location === 'global' || location === 'both') {
    console.log(chalk.yellow('\nGlobal skills:'));
    const globalResult = listInstalled({ global: true });
    displaySkillsList(globalResult);
  }
}

function displaySkillsList(result) {
  if (!result.success) {
    console.log(chalk.gray('  Error: ' + result.error));
    return;
  }

  if (result.skills.length === 0) {
    console.log(chalk.gray('  No skills installed'));
    return;
  }

  for (const skill of result.skills) {
    const status = skill.signature === 'verified' ? chalk.green('✓') :
                   skill.signature === 'unsigned' ? chalk.yellow('⚠') :
                   chalk.red('✗');
    console.log(`  ${status} ${skill.name} ${chalk.gray(skill.version || '')}`);
    if (skill.signature === 'verified') {
      console.log(chalk.gray(`    Signed by: ${skill.pubkey?.substring(0, 16)}...`));
    }
  }
}

/**
 * Sign skill flow
 */
async function signSkillFlow() {
  console.log(chalk.cyan('\n── Sign Skill ──\n'));

  // Get installed skills
  const localSkills = listInstalled({ global: false });
  const skills = localSkills.success ? localSkills.skills : [];

  if (skills.length === 0) {
    console.log(chalk.yellow('No skills installed to sign.'));
    return;
  }

  const { skillName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'skillName',
      message: 'Select skill to sign:',
      choices: skills.map(s => ({
        name: `${s.name} ${s.signature === 'verified' ? chalk.green('(signed)') : chalk.yellow('(unsigned)')}`,
        value: s.name
      }))
    }
  ]);

  const { repo } = await inquirer.prompt([
    {
      type: 'input',
      name: 'repo',
      message: 'GitHub repo for this skill (owner/repo):',
      validate: input => input.includes('/') ? true : 'Format: owner/repo'
    }
  ]);

  // Get privkey
  let privkey;
  try {
    privkey = execSync('git config nostr.privkey', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    console.log(chalk.red('No private key found. Run: npx --yes create-agent@latest'));
    return;
  }

  const skillPath = path.join(getSkillsDir(false), skillName);
  const spinner = ora('Signing skill...').start();

  const result = signSkill(skillPath, privkey, { repo });

  if (result.success) {
    spinner.succeed(`Signed "${skillName}"`);
    console.log(chalk.gray(`  Pubkey: ${result.pubkey}`));
    console.log(chalk.gray(`  Hash: ${result.hash}`));
  } else {
    spinner.fail(result.error);
  }
}

/**
 * Verify skill flow
 */
async function verifySkillFlow() {
  console.log(chalk.cyan('\n── Verify Skill ──\n'));

  const localSkills = listInstalled({ global: false });
  const skills = localSkills.success ? localSkills.skills : [];

  if (skills.length === 0) {
    console.log(chalk.yellow('No skills installed to verify.'));
    return;
  }

  const { skillName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'skillName',
      message: 'Select skill to verify:',
      choices: skills.map(s => s.name)
    }
  ]);

  const skillPath = path.join(getSkillsDir(false), skillName);
  const spinner = ora('Verifying...').start();

  const result = verifySkill(skillPath);

  if (result.success) {
    if (result.verified) {
      spinner.succeed('Signature verified');
      console.log(chalk.gray(`  Signed by: ${result.pubkey}`));
      console.log(chalk.gray(`  Signed at: ${result.signedAt}`));
      console.log(chalk.gray(`  Hash: ${result.hash}`));
    } else if (result.unsigned) {
      spinner.warn('Skill is unsigned');
    } else {
      spinner.fail(result.error);
    }
  } else {
    spinner.fail(result.error);
  }
}

/**
 * Remove skill flow
 */
async function removeInstalledFlow() {
  console.log(chalk.cyan('\n── Remove Skill ──\n'));

  const localSkills = listInstalled({ global: false });
  const skills = localSkills.success ? localSkills.skills : [];

  if (skills.length === 0) {
    console.log(chalk.yellow('No skills installed to remove.'));
    return;
  }

  const { skillName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'skillName',
      message: 'Select skill to remove:',
      choices: skills.map(s => s.name)
    }
  ]);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to remove "${skillName}"?`,
      default: false
    }
  ]);

  if (!confirm) {
    console.log(chalk.gray('Cancelled.'));
    return;
  }

  const spinner = ora('Removing...').start();
  const result = removeInstalled(skillName, { global: false });

  if (result.success) {
    spinner.succeed(`Removed "${skillName}"`);
  } else {
    spinner.fail(result.error);
  }
}
