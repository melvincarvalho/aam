#!/usr/bin/env node

// IMPORTS
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
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
  updateSkill,
  updateAllSkills,
  fetchRemoteRegistry,
  searchRemote,
  getSkillsDir,
  addAgentFromRepo,
  listInstalledAgents,
  removeInstalledAgent,
  updateAgent,
  updateAllAgents,
  getAgentsDir,
  signSkill,
  signAgent,
  verifySkill,
  verifyAgent,
  getPubkeyFromPrivkey
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
  skill[s] <owner/repo>[@version]  Install a skill (local by default)
  skill[s] list                    List installed skills (shows ✓/⚠/✗ signature status)
  skill[s] update [name]           Update all or specific skill
  skill[s] remove <name>           Remove an installed skill
  skill[s] sign <name>             Sign a skill (kind 31337 Nostr event)
  skill[s] verify <name>           Verify a skill signature
  skill[s] search                  Browse available skills from registry

Agent Commands:
  agent[s] <owner/repo>[@version]  Install an agent (local by default)
  agent[s] list                    List installed agents (shows ✓/⚠/✗ signature status)
  agent[s] update [name]           Update all or specific agent
  agent[s] remove <name>           Remove an installed agent
  agent[s] sign <name>             Sign an agent (kind 31337 Nostr event)
  agent[s] verify <name>           Verify an agent signature
  agent[s] search                  Browse available agents from registry

Search:
  search <query>              Search both skills and agents in registries

A2A Commands:
  init                      Initialize agent card in .well-known/agent.json
  create-agent [options]    Create an agent card with options
  register-agent            Register agent in the registry

Other Commands:
  wizard                    Start interactive wizard with guided UI
  help                      Display this help information

Options:
  -g, --global              Use global directory (~/.claude/skills/)
  --force                   Overwrite existing skill/agent
  --full                    Clone full repo instead of just SKILL.md/agent.md
  --verify                  Verify signature after install

Signature Legend:
  ✓  Verified signature
  ⚠  Unsigned (no signature)
  ✗  Invalid signature

Examples:
  aam skill anthropics/skills                 # Install to ./.claude/skills/
  aam skill anthropics/skills@v1.0.0          # Install specific version
  aam skill anthropics/skills --verify        # Install and verify signature
  aam skill -g anthropics/skills              # Install to ~/.claude/skills/
  aam agent user/code-reviewer                # Install to ./.claude/agents/
  aam agent -g user/code-reviewer             # Install to ~/.claude/agents/
  aam search git                              # Search for skills/agents matching "git"
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
    const isGlobal = argv.g || argv.global;
    const shouldVerify = argv.verify;
    console.log(`Installing skill from ${repoArg}${isGlobal ? ' (global)' : ''}...`);
    addFromRepo(repoArg, { force: argv.force, full: argv.full, global: isGlobal }).then(installResult => {
      if (installResult.success) {
        console.log(`\n✓ Successfully installed "${installResult.skill.name}"${isGlobal ? ' globally' : ''}`);
        console.log(`  Location: ${installResult.path}`);
        if (installResult.skill.description) {
          console.log(`  Description: ${installResult.skill.description}`);
        }
        if (installResult.skill.installMode) {
          console.log(`  Mode: ${installResult.skill.installMode}`);
        }

        // Verify signature if requested
        if (shouldVerify) {
          console.log(`\nVerifying signature...`);
          const verifyResult = verifySkill(installResult.path, {});
          if (verifyResult.success && verifyResult.verified) {
            console.log(`✓ Signature verified`);
            console.log(`  Signed by: ${verifyResult.pubkey}`);
          } else if (verifyResult.unsigned) {
            console.log(`⚠ No signature found (unsigned)`);
          } else {
            console.log(`✗ Verification failed: ${verifyResult.error}`);
          }
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
      const isGlobalList = argv.g || argv.global;
      const listResult = listInstalled({ global: isGlobalList });

      if (listResult.success) {
        const scopeLabel = isGlobalList ? 'Global' : 'Local';
        if (listResult.skills.length === 0) {
          console.log(`No ${scopeLabel.toLowerCase()} skills installed.`);
          console.log(`\nInstall skills with: aam skills${isGlobalList ? ' -g' : ''} <owner/repo>`);
        } else {
          console.log(`${scopeLabel} skills (${listResult.skills.length}):\n`);
          listResult.skills.forEach(skill => {
            // Signature status indicator
            let sigIcon = '';
            if (skill.signatureStatus === 'verified') {
              sigIcon = '✓ ';
            } else if (skill.signatureStatus === 'unsigned') {
              sigIcon = '⚠ ';
            } else if (skill.signatureStatus === 'invalid') {
              sigIcon = '✗ ';
            }
            console.log(`  ${sigIcon}${skill.name}${skill.version ? ` v${skill.version}` : ''}`);
            if (skill.description) {
              console.log(`    ${skill.description}`);
            }
            if (skill.source) {
              console.log(`    Source: ${skill.source}`);
            }
            if (skill.signedBy) {
              console.log(`    Signed by: ${skill.signedBy.slice(0, 16)}...`);
            }
            console.log();
          });
          console.log(`Skills directory: ${listResult.path}`);
          console.log(`Legend: ✓ verified  ⚠ unsigned  ✗ invalid`);
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

      const isGlobalRemove = argv.g || argv.global;
      const removeResult = removeInstalled(removeArg, { global: isGlobalRemove });

      if (removeResult.success) {
        console.log(`✓ Successfully removed "${removeArg}"${isGlobalRemove ? ' (global)' : ''}`);
      } else {
        console.error('Error:', removeResult.error);
        process.exit(1);
      }
      break;

    case 'update':
    case 'upgrade':
      const updateArg = args[0];
      const isGlobalUpdate = argv.g || argv.global;

      if (updateArg) {
        // Update specific skill
        console.log(`Checking for updates to ${updateArg}...`);
        updateSkill(updateArg, { global: isGlobalUpdate }).then(result => {
          if (result.success) {
            if (result.updated) {
              console.log(`✓ Updated "${updateArg}" (${result.from} → ${result.to})`);
            } else {
              console.log(`✓ "${updateArg}" is already up to date`);
            }
          } else {
            console.error('Error:', result.error);
            process.exit(1);
          }
        });
      } else {
        // Update all skills
        console.log(`Checking for updates to all ${isGlobalUpdate ? 'global' : 'local'} skills...`);
        updateAllSkills({ global: isGlobalUpdate }).then(result => {
          if (result.success) {
            const { updated, upToDate, failed, total } = result.summary;
            console.log(`\n${total} skills checked:`);
            if (updated > 0) console.log(`  ✓ ${updated} updated`);
            if (upToDate > 0) console.log(`  ✓ ${upToDate} already up to date`);
            if (failed > 0) console.log(`  ✗ ${failed} failed`);
          } else {
            console.error('Error:', result.error);
            process.exit(1);
          }
        });
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

    case 'sign':
      // Default to current directory if no argument
      const signSkillArg = args[0] || '.';
      let signPrivkey = argv.privkey || process.env.AAM_PRIVKEY;

      // Try git config if no privkey provided
      if (!signPrivkey) {
        try {
          signPrivkey = execSync('git config nostr.privkey', { encoding: 'utf8' }).trim();
        } catch {}
      }

      if (!signPrivkey) {
        console.error('Error: Private key required');
        console.error('Use --privkey <hex>, set AAM_PRIVKEY, or run: npm init agent');
        process.exit(1);
      }

      // Get repo - from flag, git remote, or prompt
      let signRepo = argv.repo;
      if (!signRepo) {
        try {
          const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
          // Parse GitHub URL: git@github.com:owner/repo.git or https://github.com/owner/repo.git
          const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
          if (match) signRepo = match[1];
        } catch {}
      }
      if (!signRepo) {
        const inquirer = (await import('inquirer')).default;
        const answer = await inquirer.prompt([{
          type: 'input',
          name: 'repo',
          message: 'GitHub repo (owner/repo):',
          validate: input => input.includes('/') || 'Format: owner/repo'
        }]);
        signRepo = answer.repo;
        console.log(`\nTip: Next time use: aam skill sign --repo ${signRepo}\n`);
      }

      // Find skill path
      const isGlobalSign = argv.g || argv.global;
      let signSkillPath = signSkillArg;
      if (!fs.existsSync(signSkillArg)) {
        const skillsDir = getSkillsDir(isGlobalSign);
        signSkillPath = path.join(skillsDir, signSkillArg);
      }

      const signResult = signSkill(signSkillPath, signPrivkey, {
        repo: signRepo,
        version: argv.version
      });

      if (signResult.success) {
        console.log(`✓ Skill signed successfully`);
        console.log(`  Pubkey: ${signResult.pubkey}`);
        console.log(`  Hash: ${signResult.hash}`);
        console.log(`  Signature: ${signResult.path}`);
      } else {
        console.error('Error:', signResult.error);
        process.exit(1);
      }
      break;

    case 'verify':
      const verifySkillArg = args[0];

      if (!verifySkillArg) {
        console.error('Error: Skill name or path required');
        console.error('Example: aam skill verify my-skill');
        process.exit(1);
      }

      // Find skill path
      const isGlobalVerify = argv.g || argv.global;
      let verifySkillPath = verifySkillArg;
      if (!fs.existsSync(verifySkillArg)) {
        const skillsDir = getSkillsDir(isGlobalVerify);
        verifySkillPath = path.join(skillsDir, verifySkillArg);
      }

      const verifyResult = verifySkill(verifySkillPath, {
        expectedPubkey: argv.pubkey
      });

      if (verifyResult.success) {
        if (verifyResult.verified) {
          console.log(`✓ Signature verified`);
          console.log(`  Signed by: ${verifyResult.pubkey}`);
          console.log(`  Signed at: ${verifyResult.signedAt}`);
          console.log(`  Hash: ${verifyResult.hash}`);
        } else if (verifyResult.unsigned) {
          console.log(`⚠ No signature found (unsigned)`);
        } else {
          console.log(`✗ Verification failed: ${verifyResult.error}`);
          process.exit(1);
        }
      } else {
        console.error('Error:', verifyResult.error);
        process.exit(1);
      }
      break;

    default:
      console.log('Usage: aam skills <command> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  aam skills <owner/repo>    Install a skill (local by default)');
      console.log('  aam skills list            List installed skills');
      console.log('  aam skills remove <name>   Remove an installed skill');
      console.log('  aam skills sign <name>     Sign a skill with your privkey');
      console.log('  aam skills verify <name>   Verify a skill signature');
      console.log('  aam skills search          Browse available skills');
      console.log('');
      console.log('Options:');
      console.log('  -g, --global               Install/list/remove globally (~/.claude/skills/)');
      console.log('  --force                    Overwrite existing skill');
      console.log('  --full                     Clone full repo instead of just SKILL.md');
      console.log('');
      console.log('Examples:');
      console.log('  aam skills anthropics/skills       # Install to ./.claude/skills/');
      console.log('  aam skills -g anthropics/skills    # Install to ~/.claude/skills/');
      console.log('  aam skills list                    # List local skills');
      console.log('  aam skills list -g                 # List global skills');
      console.log('  aam skills remove my-skill');
      break;
  }
}

// Agents subcommand handler
function handleAgentCommand(subcommand, args) {
  // If subcommand contains '/' or starts with 'http', treat as implicit add
  if (subcommand && (subcommand.includes('/') || subcommand.startsWith('http'))) {
    const repoArg = subcommand;
    const isGlobal = argv.g || argv.global;
    const shouldVerify = argv.verify;
    console.log(`Installing agent from ${repoArg}${isGlobal ? ' (global)' : ''}...`);
    addAgentFromRepo(repoArg, { force: argv.force, full: argv.full, global: isGlobal }).then(installResult => {
      if (installResult.success) {
        console.log(`\n✓ Successfully installed "${installResult.agent.name}"${isGlobal ? ' globally' : ''}`);
        console.log(`  Location: ${installResult.path}`);
        if (installResult.agent.description) {
          console.log(`  Description: ${installResult.agent.description}`);
        }
        if (installResult.agent.installMode) {
          console.log(`  Mode: ${installResult.agent.installMode}`);
        }

        // Verify signature if requested
        if (shouldVerify) {
          console.log(`\nVerifying signature...`);
          const verifyResult = verifyAgent(installResult.path, {});
          if (verifyResult.success && verifyResult.verified) {
            console.log(`✓ Signature verified`);
            console.log(`  Signed by: ${verifyResult.pubkey}`);
          } else if (verifyResult.unsigned) {
            console.log(`⚠ No signature found (unsigned)`);
          } else {
            console.log(`✗ Verification failed: ${verifyResult.error}`);
          }
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
      const isGlobalAgentList = argv.g || argv.global;
      const listAgentResult = listInstalledAgents({ global: isGlobalAgentList });

      if (listAgentResult.success) {
        const scopeLabel = isGlobalAgentList ? 'Global' : 'Local';
        if (listAgentResult.agents.length === 0) {
          console.log(`No ${scopeLabel.toLowerCase()} agents installed.`);
          console.log(`\nInstall agents with: aam agents${isGlobalAgentList ? ' -g' : ''} <owner/repo>`);
        } else {
          console.log(`${scopeLabel} agents (${listAgentResult.agents.length}):\n`);
          listAgentResult.agents.forEach(agent => {
            // Signature status indicator
            let sigIcon = '';
            if (agent.signatureStatus === 'verified') {
              sigIcon = '✓ ';
            } else if (agent.signatureStatus === 'unsigned') {
              sigIcon = '⚠ ';
            } else if (agent.signatureStatus === 'invalid') {
              sigIcon = '✗ ';
            }
            console.log(`  ${sigIcon}${agent.name}${agent.displayName ? ` (${agent.displayName})` : ''}`);
            if (agent.description) {
              console.log(`    ${agent.description}`);
            }
            if (agent.tools) {
              console.log(`    Tools: ${agent.tools}`);
            }
            if (agent.model) {
              console.log(`    Model: ${agent.model}`);
            }
            if (agent.signedBy) {
              console.log(`    Signed by: ${agent.signedBy.slice(0, 16)}...`);
            }
            console.log();
          });
          console.log(`Agents directory: ${listAgentResult.path}`);
          console.log(`Legend: ✓ verified  ⚠ unsigned  ✗ invalid`);
        }
      } else {
        console.error('Error:', listAgentResult.error);
        process.exit(1);
      }
      break;

    case 'remove':
    case 'rm':
      const removeArg = args[0];

      if (!removeArg) {
        console.error('Error: Agent name is required');
        console.error('Example: aam agents remove my-agent');
        process.exit(1);
      }

      const isGlobalRemove = argv.g || argv.global;
      const removeResult = removeInstalledAgent(removeArg, { global: isGlobalRemove });

      if (removeResult.success) {
        console.log(`✓ Successfully removed "${removeArg}"${isGlobalRemove ? ' (global)' : ''}`);
      } else {
        console.error('Error:', removeResult.error);
        process.exit(1);
      }
      break;

    case 'update':
    case 'upgrade':
      const updateAgentArg = args[0];
      const isGlobalAgentUpdate = argv.g || argv.global;

      if (updateAgentArg) {
        // Update specific agent
        console.log(`Checking for updates to ${updateAgentArg}...`);
        updateAgent(updateAgentArg, { global: isGlobalAgentUpdate }).then(result => {
          if (result.success) {
            if (result.updated) {
              console.log(`✓ Updated "${updateAgentArg}" (${result.from} → ${result.to})`);
            } else {
              console.log(`✓ "${updateAgentArg}" is already up to date`);
            }
          } else {
            console.error('Error:', result.error);
            process.exit(1);
          }
        });
      } else {
        // Update all agents
        console.log(`Checking for updates to all ${isGlobalAgentUpdate ? 'global' : 'local'} agents...`);
        updateAllAgents({ global: isGlobalAgentUpdate }).then(result => {
          if (result.success) {
            const { updated, upToDate, failed, total } = result.summary;
            console.log(`\n${total} agents checked:`);
            if (updated > 0) console.log(`  ✓ ${updated} updated`);
            if (upToDate > 0) console.log(`  ✓ ${upToDate} already up to date`);
            if (failed > 0) console.log(`  ✗ ${failed} failed`);
          } else {
            console.error('Error:', result.error);
            process.exit(1);
          }
        });
      }
      break;

    case 'remote':
    case 'search':
      console.log('Fetching agents from remote registry...');
      fetchRemoteRegistry('agents').then(remoteResult => {
        if (remoteResult.success) {
          const items = remoteResult.data;
          console.log(`\nAvailable agents (${items.length}):\n`);

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

          console.log(`Install with: aam agents <repository>`);
        } else {
          console.error('Error:', remoteResult.error);
          process.exit(1);
        }
      });
      break;

    case 'sign':
      // Default to current directory if no argument
      const signAgentArg = args[0] || '.';
      let signAgentPrivkey = argv.privkey || process.env.AAM_PRIVKEY;

      // Try git config if no privkey provided
      if (!signAgentPrivkey) {
        try {
          signAgentPrivkey = execSync('git config nostr.privkey', { encoding: 'utf8' }).trim();
        } catch {}
      }

      if (!signAgentPrivkey) {
        console.error('Error: Private key required');
        console.error('Use --privkey <hex>, set AAM_PRIVKEY, or run: npm init agent');
        process.exit(1);
      }

      // Get repo - from flag, git remote, or prompt
      let signAgentRepo = argv.repo;
      if (!signAgentRepo) {
        try {
          const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
          const match = remoteUrl.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
          if (match) signAgentRepo = match[1];
        } catch {}
      }
      if (!signAgentRepo) {
        const inquirer = (await import('inquirer')).default;
        const answer = await inquirer.prompt([{
          type: 'input',
          name: 'repo',
          message: 'GitHub repo (owner/repo):',
          validate: input => input.includes('/') || 'Format: owner/repo'
        }]);
        signAgentRepo = answer.repo;
        console.log(`\nTip: Next time use: aam agent sign --repo ${signAgentRepo}\n`);
      }

      // Find agent path
      const isGlobalAgentSign = argv.g || argv.global;
      let signAgentPath = signAgentArg;
      if (!fs.existsSync(signAgentArg)) {
        const agentsDir = getAgentsDir(isGlobalAgentSign);
        signAgentPath = path.join(agentsDir, signAgentArg.endsWith('.md') ? signAgentArg : `${signAgentArg}.md`);
      }

      const signAgentResult = signAgent(signAgentPath, signAgentPrivkey, {
        repo: signAgentRepo,
        version: argv.version
      });

      if (signAgentResult.success) {
        console.log(`✓ Agent signed successfully`);
        console.log(`  Pubkey: ${signAgentResult.pubkey}`);
        console.log(`  Hash: ${signAgentResult.hash}`);
        console.log(`  Signature: ${signAgentResult.path}`);
      } else {
        console.error('Error:', signAgentResult.error);
        process.exit(1);
      }
      break;

    case 'verify':
      const verifyAgentArg = args[0];

      if (!verifyAgentArg) {
        console.error('Error: Agent name or path required');
        console.error('Example: aam agent verify my-agent');
        process.exit(1);
      }

      // Find agent path
      const isGlobalAgentVerify = argv.g || argv.global;
      let verifyAgentPath = verifyAgentArg;
      if (!fs.existsSync(verifyAgentArg)) {
        const agentsDir = getAgentsDir(isGlobalAgentVerify);
        verifyAgentPath = path.join(agentsDir, verifyAgentArg.endsWith('.md') ? verifyAgentArg : `${verifyAgentArg}.md`);
      }

      const verifyAgentResult = verifyAgent(verifyAgentPath, {
        expectedPubkey: argv.pubkey
      });

      if (verifyAgentResult.success) {
        if (verifyAgentResult.verified) {
          console.log(`✓ Signature verified`);
          console.log(`  Signed by: ${verifyAgentResult.pubkey}`);
          console.log(`  Signed at: ${verifyAgentResult.signedAt}`);
          console.log(`  Hash: ${verifyAgentResult.hash}`);
        } else if (verifyAgentResult.unsigned) {
          console.log(`⚠ No signature found (unsigned)`);
        } else {
          console.log(`✗ Verification failed: ${verifyAgentResult.error}`);
          process.exit(1);
        }
      } else {
        console.error('Error:', verifyAgentResult.error);
        process.exit(1);
      }
      break;

    default:
      console.log('Usage: aam agents <command> [options]');
      console.log('');
      console.log('Commands:');
      console.log('  aam agents <owner/repo>    Install an agent (local by default)');
      console.log('  aam agents list            List installed agents');
      console.log('  aam agents remove <name>   Remove an installed agent');
      console.log('  aam agents sign <name>     Sign an agent with your privkey');
      console.log('  aam agents verify <name>   Verify an agent signature');
      console.log('  aam agents search          Browse available agents');
      console.log('');
      console.log('Options:');
      console.log('  -g, --global               Install/list/remove globally (~/.claude/agents/)');
      console.log('  --force                    Overwrite existing agent');
      console.log('  --full                     Clone full repo instead of just agent.md');
      console.log('');
      console.log('Examples:');
      console.log('  aam agents user/code-reviewer       # Install to ./.claude/agents/');
      console.log('  aam agents -g user/code-reviewer    # Install to ~/.claude/agents/');
      console.log('  aam agents list                     # List local agents');
      console.log('  aam agents list -g                  # List global agents');
      console.log('  aam agents remove my-agent');
      break;
  }
}

// MAIN
const command = argv._[0];

switch (command) {
  case 'skill':
  case 'skills':
    handleSkillCommand(argv._[1], argv._.slice(2));
    break;

  case 'agent':
  case 'agents':
    handleAgentCommand(argv._[1], argv._.slice(2));
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

  case 'search':
    const searchQuery = argv._[1];

    if (!searchQuery) {
      console.error('Error: Search query is required');
      console.error('Example: aam search git');
      process.exit(1);
    }

    console.log(`Searching for "${searchQuery}"...\n`);
    searchRemote(searchQuery).then(searchResult => {
      if (searchResult.success) {
        if (searchResult.total === 0) {
          console.log('No results found.');
        } else {
          // Show skills
          if (searchResult.results.skills.length > 0) {
            console.log(`Skills (${searchResult.results.skills.length}):\n`);
            searchResult.results.skills.forEach(item => {
              const name = item.nick || item.name || item.id;
              console.log(`  ${name}`);
              if (item.description) {
                console.log(`    ${item.description}`);
              }
              if (item.repository) {
                console.log(`    Install: aam skill ${item.repository}`);
              }
              console.log();
            });
          }

          // Show agents
          if (searchResult.results.agents.length > 0) {
            console.log(`Agents (${searchResult.results.agents.length}):\n`);
            searchResult.results.agents.forEach(item => {
              const name = item.nick || item.name || item.id;
              console.log(`  ${name}`);
              if (item.description) {
                console.log(`    ${item.description}`);
              }
              if (item.repository) {
                console.log(`    Install: aam agent ${item.repository}`);
              }
              console.log();
            });
          }

          console.log(`Found ${searchResult.total} result(s)`);
        }
      } else {
        console.error('Error:', searchResult.error);
        process.exit(1);
      }
    });
    break;

  case 'help':
    displayHelp();
    break;

  default:
    console.error('Unknown command:', command);
    displayHelp();
    process.exit(1);
}
