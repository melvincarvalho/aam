import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { finalizeEvent, verifyEvent, getPublicKey } from 'nostr-tools/pure';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

// Skill signature event kind (31337 = "elite" - memorable for trusted agents)
const SKILL_SIG_KIND = 31337;

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skills directories - Claude Code compatibility
const GLOBAL_CLAUDE_HOME = path.join(os.homedir(), '.claude');
const GLOBAL_SKILLS_DIR = path.join(GLOBAL_CLAUDE_HOME, 'skills');

// Local (project-level) skills directory
const LOCAL_SKILLS_DIR = '.claude/skills';

// Agents directories
const GLOBAL_AGENTS_DIR = path.join(GLOBAL_CLAUDE_HOME, 'agents');
const LOCAL_AGENTS_DIR = '.claude/agents';

/**
 * Get skills directory based on global flag
 * @param {boolean} global - Whether to use global directory
 * @returns {string} - Path to skills directory
 */
function getSkillsDirectory(global = false) {
  if (global) {
    return GLOBAL_SKILLS_DIR;
  }
  return path.join(process.cwd(), LOCAL_SKILLS_DIR);
}

/**
 * Get agents directory based on global flag
 * @param {boolean} global - Whether to use global directory
 * @returns {string} - Path to agents directory
 */
function getAgentsDirectory(global = false) {
  if (global) {
    return GLOBAL_AGENTS_DIR;
  }
  return path.join(process.cwd(), LOCAL_AGENTS_DIR);
}

/**
 * Ensure agents directory exists
 * @param {boolean} global - Whether to use global directory
 */
function ensureAgentsDir(global = false) {
  const agentsDir = getAgentsDirectory(global);
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }
}

// Remote registry URL
const REMOTE_REGISTRY_URL = 'https://raw.githubusercontent.com/melvincarvalho/aam/gh-pages/skills.json';
const REMOTE_AGENTS_URL = 'https://raw.githubusercontent.com/melvincarvalho/aam/gh-pages/registry.json';

// File paths - these will now be in user's current working directory
const TEMPLATE_DIR = 'templates';
const REGISTRY_DIR = 'registry';
const AGENT_CARD_TEMPLATE = path.join(TEMPLATE_DIR, 'agent-card.json');
const AGENT_SKILLS_TEMPLATE = path.join(TEMPLATE_DIR, 'agent-skill.json');
const DEFAULT_REGISTRY = path.join(REGISTRY_DIR, 'agents.json');
const DEFAULT_SKILLS_REGISTRY = path.join(REGISTRY_DIR, 'skills.json');

// Keep package templates for reference (read-only)
const PACKAGE_TEMPLATE_DIR = path.join(__dirname, '../templates');
const PACKAGE_AGENT_CARD_TEMPLATE = path.join(PACKAGE_TEMPLATE_DIR, 'agent-card.json');
const PACKAGE_AGENT_SKILLS_TEMPLATE = path.join(PACKAGE_TEMPLATE_DIR, 'agent-skill.json');

/**
 * Create an agent card in .well-known/agent.json format
 * @param {Object} options - Options for creating the agent card
 * @returns {Object} - Created agent card
 */
export function createAgentCard (options = {}) {
  try {
    // Look for template in user's directory first, then fall back to package template
    let templatePath = path.join(process.cwd(), AGENT_CARD_TEMPLATE);

    if (!fs.existsSync(templatePath)) {
      // If template doesn't exist in current directory, check if it exists in package
      if (fs.existsSync(PACKAGE_AGENT_CARD_TEMPLATE)) {
        // Copy from package to current directory
        const templatesDir = path.join(process.cwd(), TEMPLATE_DIR);
        if (!fs.existsSync(templatesDir)) {
          fs.mkdirSync(templatesDir, { recursive: true });
        }
        fs.copyFileSync(PACKAGE_AGENT_CARD_TEMPLATE, templatePath);
      } else {
        throw new Error('Agent card template not found. You may need to run `aam init` first.');
      }
    }

    // Read template
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    // Apply options to template
    const agentCard = {
      ...template,
      name: options.name || template.name,
      description: options.description || template.description,
      url: options.url || template.url,
      provider: {
        ...(template.provider || {}),
        name: options.providerName || (template.provider ? template.provider.name : ''),
        url: options.providerUrl || (template.provider ? template.provider.url : '')
      },
      version: options.version || template.version,
      skills: template.skills || []
    };

    // Ensure .well-known directory exists
    const wellKnownDir = path.join(process.cwd(), '.well-known');
    if (!fs.existsSync(wellKnownDir)) {
      fs.mkdirSync(wellKnownDir, { recursive: true });
    }

    // Write agent card
    const agentCardPath = path.join(wellKnownDir, 'agent.json');
    fs.writeFileSync(agentCardPath, JSON.stringify(agentCard, null, 2), 'utf8');

    return { success: true, path: agentCardPath, agentCard };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the project with necessary templates and directories
 */
export function initialize () {
  try {
    // Create templates directory in current working directory
    const templatesDir = path.join(process.cwd(), TEMPLATE_DIR);
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    // Create registry directory in current working directory
    const registryDir = path.join(process.cwd(), REGISTRY_DIR);
    if (!fs.existsSync(registryDir)) {
      fs.mkdirSync(registryDir, { recursive: true });
    }

    // Create agent card template
    const agentCardTemplate = {
      "name": "Example Agent",
      "description": "An example agent created with AAM",
      "url": "https://example.com/a2a",
      "version": "1.0.0",
      "provider": {
        "name": "Example Provider",
        "url": "https://example.com"
      },
      "capabilities": {
        "streaming": true,
        "pushNotifications": false,
        "multiTurn": true
      },
      "authentication": {
        "schemes": [
          {
            "type": "Bearer",
            "description": "JWT token authentication"
          }
        ]
      },
      "skills": []
    };

    const agentCardTemplatePath = path.join(process.cwd(), AGENT_CARD_TEMPLATE);
    fs.writeFileSync(agentCardTemplatePath, JSON.stringify(agentCardTemplate, null, 2), 'utf8');

    // Create agent skill template
    const agentSkillTemplate = {
      "id": "example-skill",
      "name": "Example Skill",
      "description": "An example skill for demonstration",
      "inputModes": ["text"],
      "outputModes": ["text"],
      "examples": [
        {
          "input": { "text": "Example input" },
          "output": { "text": "Example output" }
        }
      ]
    };

    const agentSkillTemplatePath = path.join(process.cwd(), AGENT_SKILLS_TEMPLATE);
    fs.writeFileSync(agentSkillTemplatePath, JSON.stringify(agentSkillTemplate, null, 2), 'utf8');

    // Create default registry
    const agentsRegistryPath = path.join(process.cwd(), DEFAULT_REGISTRY);
    if (!fs.existsSync(agentsRegistryPath)) {
      fs.writeFileSync(agentsRegistryPath, JSON.stringify([], null, 2), 'utf8');
    }

    // Create default skills registry
    const skillsRegistryPath = path.join(process.cwd(), DEFAULT_SKILLS_REGISTRY);
    if (!fs.existsSync(skillsRegistryPath)) {
      fs.writeFileSync(skillsRegistryPath, JSON.stringify([], null, 2), 'utf8');
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Add a skill to an agent card
 * @param {Object} skill - Skill to add
 * @param {string} agentCardPath - Path to agent card (default: .well-known/agent.json)
 * @returns {Object} - Result of operation
 */
export function addSkill (skill, agentCardPath = '.well-known/agent.json') {
  try {
    // Validate skill
    if (!skill.id || !skill.name || !skill.description) {
      throw new Error('Skill must have id, name, and description');
    }

    // Ensure agent card exists
    if (!fs.existsSync(agentCardPath)) {
      throw new Error(`Agent card not found at ${agentCardPath}`);
    }

    // Read agent card
    const agentCard = JSON.parse(fs.readFileSync(agentCardPath, 'utf8'));

    // Check if skill already exists
    const existingSkillIndex = agentCard.skills.findIndex(s => s.id === skill.id);

    if (existingSkillIndex !== -1) {
      // Update existing skill
      agentCard.skills[existingSkillIndex] = {
        ...agentCard.skills[existingSkillIndex],
        ...skill
      };
    } else {
      // Add new skill
      agentCard.skills.push(skill);
    }

    // Write updated agent card
    fs.writeFileSync(agentCardPath, JSON.stringify(agentCard, null, 2), 'utf8');

    return { success: true, agentCard };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Search for agents in the registry
 * @param {string} query - Search query
 * @param {string} registryPath - Path to registry file
 * @returns {Object} - Search results
 */
export function searchAgents (query, registryPath) {
  try {
    // If registryPath is not provided, look in current directory first
    if (!registryPath) {
      const localRegistryPath = path.join(process.cwd(), DEFAULT_REGISTRY);
      if (fs.existsSync(localRegistryPath)) {
        registryPath = localRegistryPath;
      } else {
        // Fall back to package registry if it exists
        const packageRegistryPath = path.join(__dirname, '../', DEFAULT_REGISTRY);
        if (fs.existsSync(packageRegistryPath)) {
          registryPath = packageRegistryPath;
        } else {
          throw new Error(`Registry not found. You may need to run \`aam init\` first.`);
        }
      }
    }

    // Ensure registry exists
    if (!fs.existsSync(registryPath)) {
      throw new Error(`Registry not found at ${registryPath}`);
    }

    // Read registry
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    // Perform search
    const results = registry.filter(agent => {
      const searchableText = [
        agent.name,
        agent.description,
        agent.provider?.name,
        ...(agent.skills || []).map(skill => `${skill.name} ${skill.description}`)
      ].join(' ').toLowerCase();

      return searchableText.includes(query.toLowerCase());
    });

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Search for skills in the skills registry
 * @param {string} query - Search query
 * @param {string} registryPath - Path to skills registry file
 * @returns {Object} - Search results
 */
export function searchSkills (query, registryPath) {
  try {
    // If registryPath is not provided, look in current directory first
    if (!registryPath) {
      const localRegistryPath = path.join(process.cwd(), DEFAULT_SKILLS_REGISTRY);
      if (fs.existsSync(localRegistryPath)) {
        registryPath = localRegistryPath;
      } else {
        // Fall back to package registry if it exists
        const packageRegistryPath = path.join(__dirname, '../', DEFAULT_SKILLS_REGISTRY);
        if (fs.existsSync(packageRegistryPath)) {
          registryPath = packageRegistryPath;
        } else {
          throw new Error(`Skills registry not found. You may need to run \`aam init\` first.`);
        }
      }
    }

    // Ensure registry exists
    if (!fs.existsSync(registryPath)) {
      throw new Error(`Skills registry not found at ${registryPath}`);
    }

    // Read registry
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    // Perform search
    const results = registry.filter(skill => {
      const searchableText = [
        skill.id,
        skill.name,
        skill.description
      ].join(' ').toLowerCase();

      return searchableText.includes(query.toLowerCase());
    });

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import a skill from registry to agent card
 * @param {string} skillId - ID of skill to import
 * @param {string} agentCardPath - Path to agent card (default: .well-known/agent.json)
 * @param {string} registryPath - Path to skills registry file
 * @returns {Object} - Result of operation
 */
export function importSkill (skillId, agentCardPath = '.well-known/agent.json', registryPath) {
  try {
    // If registryPath is not provided, look in current directory first
    if (!registryPath) {
      const localRegistryPath = path.join(process.cwd(), DEFAULT_SKILLS_REGISTRY);
      if (fs.existsSync(localRegistryPath)) {
        registryPath = localRegistryPath;
      } else {
        // Fall back to package registry if it exists
        const packageRegistryPath = path.join(__dirname, '../', DEFAULT_SKILLS_REGISTRY);
        if (fs.existsSync(packageRegistryPath)) {
          registryPath = packageRegistryPath;
        } else {
          throw new Error(`Skills registry not found. You may need to run \`aam init\` first.`);
        }
      }
    }

    // Ensure registry exists
    if (!fs.existsSync(registryPath)) {
      throw new Error(`Skills registry not found at ${registryPath}`);
    }

    // Read registry
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    // Find skill
    const skill = registry.find(s => s.id === skillId);

    if (!skill) {
      throw new Error(`Skill with ID "${skillId}" not found in registry`);
    }

    // Add skill to agent card
    return addSkill(skill, agentCardPath);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Register an agent in the registry
 * @param {string} agentCardPath - Path to agent card
 * @param {string} registryPath - Path to registry file
 * @returns {Object} - Result of operation
 */
export function registerAgent (agentCardPath = '.well-known/agent.json', registryPath) {
  try {
    // Ensure agent card exists
    if (!fs.existsSync(agentCardPath)) {
      throw new Error(`Agent card not found at ${agentCardPath}`);
    }

    // Read agent card
    const agentCard = JSON.parse(fs.readFileSync(agentCardPath, 'utf8'));

    // If registryPath is not provided, use local directory
    if (!registryPath) {
      registryPath = path.join(process.cwd(), DEFAULT_REGISTRY);
    }

    // Ensure registry exists or create it
    if (!fs.existsSync(registryPath)) {
      // Create registry directory if it doesn't exist
      const registryDir = path.dirname(registryPath);
      if (!fs.existsSync(registryDir)) {
        fs.mkdirSync(registryDir, { recursive: true });
      }

      // Create empty registry
      fs.writeFileSync(registryPath, JSON.stringify([], null, 2), 'utf8');
    }

    // Read registry
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    // Check if agent already exists
    const existingAgentIndex = registry.findIndex(a => a.url === agentCard.url);

    if (existingAgentIndex !== -1) {
      // Update existing agent
      registry[existingAgentIndex] = agentCard;
    } else {
      // Add new agent
      registry.push(agentCard);
    }

    // Write updated registry
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Ensure skills directory exists
 * @param {boolean} global - Whether to use global directory
 */
function ensureSkillsDir(global = false) {
  const skillsDir = getSkillsDirectory(global);
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
}

/**
 * Parse repo string into components
 * @param {string} repo - GitHub repo in format "owner/repo" or full URL
 * @returns {Object} - Parsed repo info
 */
function parseRepo(repo) {
  let owner, repoName, fullRepo, skillName, version;

  // Extract version if present (e.g., owner/repo@1.0.0)
  let repoWithoutVersion = repo;
  if (repo.includes('@') && !repo.startsWith('http')) {
    const atIndex = repo.lastIndexOf('@');
    repoWithoutVersion = repo.slice(0, atIndex);
    version = repo.slice(atIndex + 1);
  }

  if (repoWithoutVersion.includes('://')) {
    // Full URL: https://github.com/owner/repo or https://github.com/owner/repo.git
    const match = repoWithoutVersion.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (match) {
      owner = match[1];
      repoName = match[2];
      fullRepo = `${owner}/${repoName}`;
    } else {
      throw new Error('Invalid GitHub URL');
    }
  } else {
    // Short form: owner/repo
    const parts = repoWithoutVersion.split('/');
    if (parts.length !== 2) {
      throw new Error('Invalid repo format. Use owner/repo or full GitHub URL');
    }
    owner = parts[0];
    repoName = parts[1];
    fullRepo = repoWithoutVersion;
  }

  // Use owner-repo format to avoid collisions (e.g., anthropics-skills, vercel-skills)
  skillName = `${owner}-${repoName}`;

  return { owner, repoName, fullRepo, skillName, version };
}

/**
 * Fetch SKILL.md from GitHub raw content
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @param {string} version - Optional version/tag/branch
 * @returns {Promise<string|null>} - SKILL.md content or null
 */
async function fetchSkillMd(owner, repo, version) {
  // If version specified, try that first (could be tag or branch)
  // Otherwise try main, then master
  const refs = version ? [version, 'main', 'master'] : ['main', 'master'];

  for (const ref of refs) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/SKILL.md`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        return { content: await response.text(), ref };
      }
    } catch (e) {
      // Continue to next ref
    }
  }

  return null;
}

/**
 * Fetch agent.md from GitHub raw content
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @param {string} version - Optional version/tag/branch
 * @returns {Promise<string|null>} - agent.md content or null
 */
async function fetchAgentMd(owner, repo, version) {
  const refs = version ? [version, 'main', 'master'] : ['main', 'master'];

  for (const ref of refs) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/agent.md`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        return { content: await response.text(), ref };
      }
    } catch (e) {
      // Continue to next ref
    }
  }

  return null;
}

/**
 * Add (install) a skill from a GitHub repository
 * @param {string} repo - GitHub repo in format "owner/repo" or full URL
 * @param {Object} options - Installation options (force, full)
 * @returns {Object} - Result of operation
 */
export async function addFromRepo(repo, options = {}) {
  try {
    const isGlobal = options.global || false;
    ensureSkillsDir(isGlobal);

    // Parse repo string (now includes version)
    const { owner, repoName, fullRepo, skillName, version } = parseRepo(repo);
    const skillsDir = getSkillsDirectory(isGlobal);
    const targetDir = path.join(skillsDir, skillName);

    // Check if already installed
    if (fs.existsSync(targetDir)) {
      if (options.force) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } else {
        return { success: false, error: `Skill "${skillName}" already installed. Use --force to reinstall.` };
      }
    }

    let skillInfo = {
      name: skillName,
      repo: fullRepo,
      source: `https://github.com/${fullRepo}`,
      version: version || 'latest'
    };

    // Try light mode first: just fetch SKILL.md (like skills.sh)
    if (!options.full) {
      console.log(`Fetching SKILL.md from ${fullRepo}${version ? `@${version}` : ''}...`);
      const result = await fetchSkillMd(owner, repoName, version);

      if (result) {
        // Create skill directory and save SKILL.md
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, 'SKILL.md'), result.content);

        // Extract description from SKILL.md (first non-heading paragraph)
        const lines = result.content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
            skillInfo.description = trimmed.slice(0, 200);
            break;
          }
        }

        skillInfo.hasSkillMd = true;
        skillInfo.installMode = 'light';
        skillInfo.resolvedRef = result.ref;

        // Save install metadata
        const metaFile = path.join(targetDir, '.aam.json');
        fs.writeFileSync(metaFile, JSON.stringify({
          ...skillInfo,
          dependencies: [], // Placeholder - see https://github.com/melvincarvalho/aam/issues/1
          installedAt: new Date().toISOString()
        }, null, 2));

        return { success: true, skill: skillInfo, path: targetDir };
      }

      console.log('No SKILL.md found, falling back to full clone...');
    }

    // Full mode: clone the entire repository
    const repoUrl = `https://github.com/${fullRepo}.git`;
    console.log(`Cloning ${repoUrl}${version ? ` at ${version}` : ''}...`);

    if (version) {
      // Clone specific tag/branch
      execSync(`git clone --depth 1 --branch ${version} ${repoUrl} ${targetDir}`, { stdio: 'inherit' });
    } else {
      execSync(`git clone --depth 1 ${repoUrl} ${targetDir}`, { stdio: 'inherit' });
    }

    // Check for SKILL.md or package.json
    const skillMdPath = path.join(targetDir, 'SKILL.md');
    const packageJson = path.join(targetDir, 'package.json');

    if (fs.existsSync(packageJson)) {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      skillInfo.name = pkg.name || repoName;
      skillInfo.version = pkg.version;
      skillInfo.description = pkg.description;
    }

    if (fs.existsSync(skillMdPath)) {
      skillInfo.hasSkillMd = true;
    }

    skillInfo.installMode = 'full';

    // Run npm install if package.json exists
    if (fs.existsSync(packageJson)) {
      console.log('Installing dependencies...');
      execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
    }

    // Save install metadata
    const metaFile = path.join(targetDir, '.aam.json');
    fs.writeFileSync(metaFile, JSON.stringify({
      ...skillInfo,
      dependencies: [], // Placeholder - see https://github.com/melvincarvalho/aam/issues/1
      installedAt: new Date().toISOString()
    }, null, 2));

    return { success: true, skill: skillInfo, path: targetDir };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List installed skills
 * @param {Object} options - Options (global, checkSignatures)
 * @returns {Object} - List of installed skills
 */
export function listInstalled(options = {}) {
  try {
    const isGlobal = options.global || false;
    const checkSigs = options.checkSignatures !== false; // default true
    const skillsDir = getSkillsDirectory(isGlobal);
    ensureSkillsDir(isGlobal);

    if (!fs.existsSync(skillsDir)) {
      return { success: true, skills: [], path: skillsDir, global: isGlobal };
    }

    const dirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const skills = dirs.map(dir => {
      const skillPath = path.join(skillsDir, dir);
      const metaFile = path.join(skillPath, '.aam.json');
      const packageFile = path.join(skillPath, 'package.json');

      let info = { name: dir, path: skillPath };

      if (fs.existsSync(metaFile)) {
        info = { ...info, ...JSON.parse(fs.readFileSync(metaFile, 'utf8')) };
      } else if (fs.existsSync(packageFile)) {
        const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
        info.name = pkg.name || dir;
        info.version = pkg.version;
        info.description = pkg.description;
      }

      // Check signature status
      if (checkSigs) {
        const sigResult = verifySkill(skillPath, {});
        if (sigResult.success && sigResult.verified) {
          info.signatureStatus = 'verified';
          info.signedBy = sigResult.pubkey;
        } else if (sigResult.unsigned) {
          info.signatureStatus = 'unsigned';
        } else {
          info.signatureStatus = 'invalid';
          info.signatureError = sigResult.error;
        }
      }

      return info;
    });

    return { success: true, skills, path: skillsDir, global: isGlobal };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove an installed skill
 * @param {string} name - Name of skill to remove
 * @returns {Object} - Result of operation
 */
export function removeInstalled(name, options = {}) {
  try {
    const isGlobal = options.global || false;
    const skillsDir = getSkillsDirectory(isGlobal);
    ensureSkillsDir(isGlobal);

    const skillPath = path.join(skillsDir, name);

    if (!fs.existsSync(skillPath)) {
      // If not found in specified location, hint where it might be
      const otherDir = getSkillsDirectory(!isGlobal);
      const otherPath = path.join(otherDir, name);
      if (fs.existsSync(otherPath)) {
        const hint = isGlobal ? 'Try without -g flag' : 'Try with -g flag';
        return { success: false, error: `Skill "${name}" not found in ${isGlobal ? 'global' : 'local'} skills. ${hint}` };
      }
      return { success: false, error: `Skill "${name}" not found` };
    }

    fs.rmSync(skillPath, { recursive: true, force: true });

    return { success: true, removed: name, global: isGlobal };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if a skill has updates available
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @param {string} currentRef - Current installed ref
 * @returns {Promise<Object>} - Update info
 */
async function checkSkillUpdates(owner, repo, currentRef) {
  try {
    // Get latest commit SHA from main/master
    for (const branch of ['main', 'master']) {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (response.ok) {
        const data = await response.json();
        const latestSha = data.sha.substring(0, 7);
        const hasUpdate = currentRef !== branch && currentRef !== latestSha;
        return {
          hasUpdate,
          latestRef: branch,
          latestSha,
          currentRef
        };
      }
    }
    return { hasUpdate: false, error: 'Could not check for updates' };
  } catch (error) {
    return { hasUpdate: false, error: error.message };
  }
}

/**
 * Update a single installed skill
 * @param {string} name - Skill name
 * @param {Object} options - Update options
 * @returns {Promise<Object>} - Update result
 */
export async function updateSkill(name, options = {}) {
  try {
    const isGlobal = options.global || false;
    const skillsDir = getSkillsDirectory(isGlobal);
    const skillPath = path.join(skillsDir, name);
    const metaFile = path.join(skillPath, '.aam.json');

    if (!fs.existsSync(skillPath)) {
      return { success: false, error: `Skill "${name}" not found` };
    }

    if (!fs.existsSync(metaFile)) {
      return { success: false, error: `No .aam.json found for "${name}" - cannot update` };
    }

    const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));

    if (!meta.repo) {
      return { success: false, error: `No repo info for "${name}" - cannot update` };
    }

    // Check for updates
    const [owner, repoName] = meta.repo.split('/');
    const updateInfo = await checkSkillUpdates(owner, repoName, meta.resolvedRef || 'unknown');

    if (!updateInfo.hasUpdate) {
      return { success: true, updated: false, name, message: 'Already up to date' };
    }

    // Re-install with force
    console.log(`Updating ${name}...`);
    const result = await addFromRepo(meta.repo, { force: true, global: isGlobal });

    if (result.success) {
      return { success: true, updated: true, name, from: meta.resolvedRef, to: updateInfo.latestRef };
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update all installed skills
 * @param {Object} options - Update options
 * @returns {Promise<Object>} - Update results
 */
export async function updateAllSkills(options = {}) {
  const isGlobal = options.global || false;
  const listResult = listInstalled({ global: isGlobal });

  if (!listResult.success) {
    return listResult;
  }

  const results = [];
  for (const skill of listResult.skills) {
    const result = await updateSkill(skill.name, { global: isGlobal });
    results.push(result);
  }

  const updated = results.filter(r => r.updated).length;
  const upToDate = results.filter(r => r.success && !r.updated).length;
  const failed = results.filter(r => !r.success).length;

  return {
    success: true,
    results,
    summary: { updated, upToDate, failed, total: results.length }
  };
}

/**
 * Update a single installed agent
 * @param {string} name - Agent name
 * @param {Object} options - Update options
 * @returns {Promise<Object>} - Update result
 */
export async function updateAgent(name, options = {}) {
  try {
    const isGlobal = options.global || false;
    const agentsDir = getAgentsDirectory(isGlobal);
    const agentPath = path.join(agentsDir, `${name}.md`);
    const metaPath = path.join(agentsDir, `.${name}.aam.json`);

    if (!fs.existsSync(agentPath)) {
      return { success: false, error: `Agent "${name}" not found` };
    }

    // For agents, metadata is stored differently - check if we have repo info
    // Try to extract from a sidecar meta file or the agent content itself
    let meta = {};
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }

    if (!meta.repo) {
      return { success: false, error: `No repo info for "${name}" - cannot update` };
    }

    // Check for updates
    const [owner, repoName] = meta.repo.split('/');
    const updateInfo = await checkSkillUpdates(owner, repoName, meta.resolvedRef || 'unknown');

    if (!updateInfo.hasUpdate) {
      return { success: true, updated: false, name, message: 'Already up to date' };
    }

    // Re-install with force
    console.log(`Updating ${name}...`);
    const result = await addAgentFromRepo(meta.repo, { force: true, global: isGlobal });

    if (result.success) {
      return { success: true, updated: true, name, from: meta.resolvedRef, to: updateInfo.latestRef };
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update all installed agents
 * @param {Object} options - Update options
 * @returns {Promise<Object>} - Update results
 */
export async function updateAllAgents(options = {}) {
  const isGlobal = options.global || false;
  const listResult = listInstalledAgents({ global: isGlobal });

  if (!listResult.success) {
    return listResult;
  }

  const results = [];
  for (const agent of listResult.agents) {
    const result = await updateAgent(agent.name, { global: isGlobal });
    results.push(result);
  }

  const updated = results.filter(r => r.updated).length;
  const upToDate = results.filter(r => r.success && !r.updated).length;
  const failed = results.filter(r => !r.success).length;

  return {
    success: true,
    results,
    summary: { updated, upToDate, failed, total: results.length }
  };
}

/**
 * Fetch remote registry
 * @param {string} type - 'skills' or 'agents'
 * @returns {Object} - Registry data
 */
export async function fetchRemoteRegistry(type = 'skills') {
  try {
    const url = type === 'agents' ? REMOTE_AGENTS_URL : REMOTE_REGISTRY_URL;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch registry: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Search remote registries for skills and agents
 * @param {string} query - Search query
 * @param {Object} options - Search options (type: 'all', 'skills', 'agents')
 * @returns {Object} - Search results
 */
export async function searchRemote(query, options = {}) {
  try {
    const type = options.type || 'all';
    const results = { skills: [], agents: [] };
    const queryLower = query.toLowerCase();

    // Search skills
    if (type === 'all' || type === 'skills') {
      const skillsResult = await fetchRemoteRegistry('skills');
      if (skillsResult.success) {
        results.skills = skillsResult.data.filter(item => {
          const searchableText = [
            item.nick || '',
            item.name || '',
            item.id || '',
            item.description || '',
            item.repository || ''
          ].join(' ').toLowerCase();
          return searchableText.includes(queryLower);
        });
      }
    }

    // Search agents
    if (type === 'all' || type === 'agents') {
      const agentsResult = await fetchRemoteRegistry('agents');
      if (agentsResult.success) {
        results.agents = agentsResult.data.filter(item => {
          const searchableText = [
            item.nick || '',
            item.name || '',
            item.id || '',
            item.description || '',
            item.repository || ''
          ].join(' ').toLowerCase();
          return searchableText.includes(queryLower);
        });
      }
    }

    return {
      success: true,
      query,
      results,
      total: results.skills.length + results.agents.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get Claude home directory path
 * @returns {string} - Path to Claude home
 */
export function getClaudeHome() {
  return CLAUDE_HOME;
}

/**
 * Get skills directory path
 * @param {boolean} global - Whether to get global directory
 * @returns {string} - Path to skills directory
 */
export function getSkillsDir(global = false) {
  return getSkillsDirectory(global);
}

/**
 * Get agents directory path
 * @param {boolean} global - Whether to get global directory
 * @returns {string} - Path to agents directory
 */
export function getAgentsDir(global = false) {
  return getAgentsDirectory(global);
}

/**
 * Add (install) an agent from a GitHub repository
 * @param {string} repo - GitHub repo in format "owner/repo" or full URL
 * @param {Object} options - Installation options (force, full, global)
 * @returns {Object} - Result of operation
 */
export async function addAgentFromRepo(repo, options = {}) {
  try {
    const isGlobal = options.global || false;
    ensureAgentsDir(isGlobal);

    // Parse repo string (now includes version)
    const { owner, repoName, fullRepo, skillName: agentName, version } = parseRepo(repo);
    const agentsDir = getAgentsDirectory(isGlobal);
    const targetPath = path.join(agentsDir, `${agentName}.md`);

    // Check if already installed
    if (fs.existsSync(targetPath)) {
      if (options.force) {
        fs.unlinkSync(targetPath);
      } else {
        return { success: false, error: `Agent "${agentName}" already installed. Use --force to reinstall.` };
      }
    }

    let agentInfo = {
      name: agentName,
      repo: fullRepo,
      source: `https://github.com/${fullRepo}`,
      version: version || 'latest'
    };

    // Try light mode first: just fetch agent.md
    if (!options.full) {
      console.log(`Fetching agent.md from ${fullRepo}${version ? `@${version}` : ''}...`);
      const agentMd = await fetchAgentMd(owner, repoName, version);

      if (agentMd) {
        // Save agent.md directly to agents directory
        fs.writeFileSync(targetPath, agentMd.content);

        // Extract name and description from frontmatter
        const frontmatterMatch = agentMd.content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];
          const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
          const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
          if (nameMatch) agentInfo.displayName = nameMatch[1].trim();
          if (descMatch) agentInfo.description = descMatch[1].trim();
        }

        agentInfo.installMode = 'light';
        agentInfo.resolvedRef = agentMd.ref;

        // Save metadata sidecar file
        const metaPath = path.join(agentsDir, `.${agentName}.aam.json`);
        fs.writeFileSync(metaPath, JSON.stringify({
          ...agentInfo,
          dependencies: [], // Placeholder - see https://github.com/melvincarvalho/aam/issues/1
          installedAt: new Date().toISOString()
        }, null, 2));

        return { success: true, agent: agentInfo, path: targetPath };
      }

      console.log('No agent.md found, falling back to full clone...');
    }

    // Full mode: clone and look for agent files
    const tempDir = path.join(os.tmpdir(), `aam-agent-${Date.now()}`);
    const repoUrl = `https://github.com/${fullRepo}.git`;
    console.log(`Cloning ${repoUrl}${version ? ` at ${version}` : ''}...`);

    if (version) {
      execSync(`git clone --depth 1 --branch ${version} ${repoUrl} ${tempDir}`, { stdio: 'inherit' });
    } else {
      execSync(`git clone --depth 1 ${repoUrl} ${tempDir}`, { stdio: 'inherit' });
    }

    // Look for agent.md in various locations
    const possiblePaths = [
      path.join(tempDir, 'agent.md'),
      path.join(tempDir, 'agents', repoName, 'agent.md'),
      path.join(tempDir, 'agents', 'agent.md'),
    ];

    let agentContent = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        agentContent = fs.readFileSync(p, 'utf8');
        break;
      }
    }

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    if (!agentContent) {
      return { success: false, error: `No agent.md found in ${fullRepo}` };
    }

    // Save agent.md
    fs.writeFileSync(targetPath, agentContent);

    // Extract metadata from frontmatter
    const frontmatterMatch = agentContent.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (nameMatch) agentInfo.displayName = nameMatch[1].trim();
      if (descMatch) agentInfo.description = descMatch[1].trim();
    }

    agentInfo.installMode = 'full';
    agentInfo.resolvedRef = version || 'main';

    // Save metadata sidecar file
    const metaPath = path.join(agentsDir, `.${agentName}.aam.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      ...agentInfo,
      dependencies: [], // Placeholder - see https://github.com/melvincarvalho/aam/issues/1
      installedAt: new Date().toISOString()
    }, null, 2));

    return { success: true, agent: agentInfo, path: targetPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List installed agents
 * @param {Object} options - Options (global, checkSignatures)
 * @returns {Object} - List of installed agents
 */
export function listInstalledAgents(options = {}) {
  try {
    const isGlobal = options.global || false;
    const checkSigs = options.checkSignatures !== false; // default true
    const agentsDir = getAgentsDirectory(isGlobal);
    ensureAgentsDir(isGlobal);

    if (!fs.existsSync(agentsDir)) {
      return { success: true, agents: [], path: agentsDir, global: isGlobal };
    }

    const files = fs.readdirSync(agentsDir)
      .filter(f => f.endsWith('.md'));

    const agents = files.map(file => {
      const filePath = path.join(agentsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const name = file.replace('.md', '');

      let info = { name, path: filePath };

      // Extract metadata from frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const displayNameMatch = frontmatter.match(/^name:\s*(.+)$/m);
        const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
        const toolsMatch = frontmatter.match(/^tools:\s*(.+)$/m);
        const modelMatch = frontmatter.match(/^model:\s*(.+)$/m);

        if (displayNameMatch) info.displayName = displayNameMatch[1].trim();
        if (descMatch) info.description = descMatch[1].trim();
        if (toolsMatch) info.tools = toolsMatch[1].trim();
        if (modelMatch) info.model = modelMatch[1].trim();
      }

      // Check signature status
      if (checkSigs) {
        const sigResult = verifyAgent(filePath, {});
        if (sigResult.success && sigResult.verified) {
          info.signatureStatus = 'verified';
          info.signedBy = sigResult.pubkey;
        } else if (sigResult.unsigned) {
          info.signatureStatus = 'unsigned';
        } else {
          info.signatureStatus = 'invalid';
          info.signatureError = sigResult.error;
        }
      }

      return info;
    });

    return { success: true, agents, path: agentsDir, global: isGlobal };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove an installed agent
 * @param {string} name - Name of agent to remove
 * @param {Object} options - Options (global)
 * @returns {Object} - Result of operation
 */
export function removeInstalledAgent(name, options = {}) {
  try {
    const isGlobal = options.global || false;
    const agentsDir = getAgentsDirectory(isGlobal);
    ensureAgentsDir(isGlobal);

    // Try with and without .md extension
    let agentPath = path.join(agentsDir, name.endsWith('.md') ? name : `${name}.md`);

    if (!fs.existsSync(agentPath)) {
      // Check other location
      const otherDir = getAgentsDirectory(!isGlobal);
      const otherPath = path.join(otherDir, name.endsWith('.md') ? name : `${name}.md`);
      if (fs.existsSync(otherPath)) {
        const hint = isGlobal ? 'Try without -g flag' : 'Try with -g flag';
        return { success: false, error: `Agent "${name}" not found in ${isGlobal ? 'global' : 'local'} agents. ${hint}` };
      }
      return { success: false, error: `Agent "${name}" not found` };
    }

    fs.unlinkSync(agentPath);

    return { success: true, removed: name, global: isGlobal };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// SIGNING & VERIFICATION (Nostr Event-based)
// =============================================================================

/**
 * Hash file content using SHA256
 * @param {string} content - File content
 * @returns {string} - Hex hash
 */
function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Create a Nostr event for signing a skill/agent
 * @param {Object} options - Signing options
 * @returns {Object} - Unsigned event template
 */
function createSignatureEvent(options) {
  const { repo, hash, type = 'skill', version } = options;

  const tags = [
    ['d', repo],                    // Makes it replaceable per repo
    ['t', type],                    // skill or agent
    ['hash', `sha256:${hash}`],     // Content hash
    ['repo', `https://github.com/${repo}`]
  ];

  if (version) {
    tags.push(['v', version]);
  }

  return {
    kind: SKILL_SIG_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: ''
  };
}

/**
 * Find all nested SKILL.md files in a directory
 * @param {string} dir - Directory to search
 * @param {number} maxDepth - Maximum depth to search (default 3)
 * @returns {string[]} - Array of paths to SKILL.md files
 */
function findNestedSkills(dir, maxDepth = 3) {
  const results = [];

  function search(currentDir, depth) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          // Check for SKILL.md in this directory
          const skillMd = path.join(fullPath, 'SKILL.md');
          if (fs.existsSync(skillMd)) {
            results.push(skillMd);
          }
          // Continue searching deeper
          search(fullPath, depth + 1);
        }
      }
    } catch (err) {
      // Ignore permission errors
    }
  }

  search(dir, 0);
  return results;
}

/**
 * Sign a skill with a private key
 * @param {string} skillPath - Path to skill directory or SKILL.md
 * @param {string} privkey - Hex private key
 * @param {Object} options - Additional options (repo, version)
 * @returns {Object} - Result with signed event
 */
export function signSkill(skillPath, privkey, options = {}) {
  try {
    // Find SKILL.md
    let skillMdPath = skillPath;
    if (fs.statSync(skillPath).isDirectory()) {
      skillMdPath = path.join(skillPath, 'SKILL.md');
    }

    if (!fs.existsSync(skillMdPath)) {
      // Look for nested SKILL.md files in subdirectories
      if (fs.statSync(skillPath).isDirectory()) {
        const nestedSkills = findNestedSkills(skillPath);
        if (nestedSkills.length === 1) {
          // Only one skill found, use it
          skillMdPath = nestedSkills[0];
        } else if (nestedSkills.length > 1) {
          // Multiple skills found, list them
          const skillNames = nestedSkills.map(p => {
            const rel = path.relative(skillPath, path.dirname(p));
            return rel || path.basename(path.dirname(p));
          });
          return {
            success: false,
            error: `Multiple skills found. Please specify which skill to sign:\n  ${skillNames.join('\n  ')}\n\nUsage: aam skills sign <installed-name>/<skill-name> --repo <owner/repo>`
          };
        } else {
          return { success: false, error: 'SKILL.md not found' };
        }
      } else {
        return { success: false, error: 'SKILL.md not found' };
      }
    }

    // Read and hash content
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const hash = hashContent(content);

    // Get repo from .aam.json or options
    let repo = options.repo;
    const metaPath = path.join(path.dirname(skillMdPath), '.aam.json');
    if (!repo && fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      repo = meta.repo;
    }

    if (!repo) {
      return { success: false, error: 'Repository not specified. Use --repo owner/repo' };
    }

    // Create and sign event
    const eventTemplate = createSignatureEvent({
      repo,
      hash,
      type: 'skill',
      version: options.version
    });

    const privkeyBytes = hexToBytes(privkey);
    const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);

    // Save signature file
    const sigPath = path.join(path.dirname(skillMdPath), '.aam.sig');
    fs.writeFileSync(sigPath, JSON.stringify(signedEvent, null, 2));

    return {
      success: true,
      event: signedEvent,
      path: sigPath,
      pubkey: signedEvent.pubkey,
      hash
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Sign an agent with a private key
 * @param {string} agentPath - Path to agent.md
 * @param {string} privkey - Hex private key
 * @param {Object} options - Additional options (repo, version)
 * @returns {Object} - Result with signed event
 */
export function signAgent(agentPath, privkey, options = {}) {
  try {
    if (!fs.existsSync(agentPath)) {
      return { success: false, error: 'agent.md not found' };
    }

    // Read and hash content
    const content = fs.readFileSync(agentPath, 'utf8');
    const hash = hashContent(content);

    // Get repo from sidecar meta or options
    let repo = options.repo;
    const name = path.basename(agentPath, '.md');
    const metaPath = path.join(path.dirname(agentPath), `.${name}.aam.json`);
    if (!repo && fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      repo = meta.repo;
    }

    if (!repo) {
      return { success: false, error: 'Repository not specified. Use --repo owner/repo' };
    }

    // Create and sign event
    const eventTemplate = createSignatureEvent({
      repo,
      hash,
      type: 'agent',
      version: options.version
    });

    const privkeyBytes = hexToBytes(privkey);
    const signedEvent = finalizeEvent(eventTemplate, privkeyBytes);

    // Save signature file (sidecar to agent.md)
    const sigPath = path.join(path.dirname(agentPath), `.${name}.aam.sig`);
    fs.writeFileSync(sigPath, JSON.stringify(signedEvent, null, 2));

    return {
      success: true,
      event: signedEvent,
      path: sigPath,
      pubkey: signedEvent.pubkey,
      hash
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Verify a skill signature
 * @param {string} skillPath - Path to skill directory or SKILL.md
 * @param {Object} options - Verification options (expectedPubkey)
 * @returns {Object} - Verification result
 */
export function verifySkill(skillPath, options = {}) {
  try {
    // Find SKILL.md and .aam.sig
    let skillMdPath = skillPath;
    if (fs.statSync(skillPath).isDirectory()) {
      skillMdPath = path.join(skillPath, 'SKILL.md');
    }

    const sigPath = path.join(path.dirname(skillMdPath), '.aam.sig');

    if (!fs.existsSync(skillMdPath)) {
      return { success: false, verified: false, error: 'SKILL.md not found' };
    }

    if (!fs.existsSync(sigPath)) {
      return { success: true, verified: false, unsigned: true, message: 'No signature found' };
    }

    // Read content and signature
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const hash = hashContent(content);
    const event = JSON.parse(fs.readFileSync(sigPath, 'utf8'));

    // Verify Nostr event signature
    const validSig = verifyEvent(event);
    if (!validSig) {
      return { success: true, verified: false, error: 'Invalid event signature' };
    }

    // Verify content hash matches
    const hashTag = event.tags.find(t => t[0] === 'hash');
    if (!hashTag || hashTag[1] !== `sha256:${hash}`) {
      return { success: true, verified: false, error: 'Content hash mismatch - file may have been modified' };
    }

    // Optionally verify expected pubkey
    if (options.expectedPubkey && event.pubkey !== options.expectedPubkey) {
      return { success: true, verified: false, error: `Signed by ${event.pubkey}, expected ${options.expectedPubkey}` };
    }

    return {
      success: true,
      verified: true,
      pubkey: event.pubkey,
      hash,
      signedAt: new Date(event.created_at * 1000).toISOString(),
      event
    };
  } catch (error) {
    return { success: false, verified: false, error: error.message };
  }
}

/**
 * Verify an agent signature
 * @param {string} agentPath - Path to agent.md
 * @param {Object} options - Verification options (expectedPubkey)
 * @returns {Object} - Verification result
 */
export function verifyAgent(agentPath, options = {}) {
  try {
    if (!fs.existsSync(agentPath)) {
      return { success: false, verified: false, error: 'agent.md not found' };
    }

    const name = path.basename(agentPath, '.md');
    const sigPath = path.join(path.dirname(agentPath), `.${name}.aam.sig`);

    if (!fs.existsSync(sigPath)) {
      return { success: true, verified: false, unsigned: true, message: 'No signature found' };
    }

    // Read content and signature
    const content = fs.readFileSync(agentPath, 'utf8');
    const hash = hashContent(content);
    const event = JSON.parse(fs.readFileSync(sigPath, 'utf8'));

    // Verify Nostr event signature
    const validSig = verifyEvent(event);
    if (!validSig) {
      return { success: true, verified: false, error: 'Invalid event signature' };
    }

    // Verify content hash matches
    const hashTag = event.tags.find(t => t[0] === 'hash');
    if (!hashTag || hashTag[1] !== `sha256:${hash}`) {
      return { success: true, verified: false, error: 'Content hash mismatch - file may have been modified' };
    }

    // Optionally verify expected pubkey
    if (options.expectedPubkey && event.pubkey !== options.expectedPubkey) {
      return { success: true, verified: false, error: `Signed by ${event.pubkey}, expected ${options.expectedPubkey}` };
    }

    return {
      success: true,
      verified: true,
      pubkey: event.pubkey,
      hash,
      signedAt: new Date(event.created_at * 1000).toISOString(),
      event
    };
  } catch (error) {
    return { success: false, verified: false, error: error.message };
  }
}

/**
 * Get public key from private key
 * @param {string} privkey - Hex private key
 * @returns {string} - Hex public key
 */
export function getPubkeyFromPrivkey(privkey) {
  return getPublicKey(hexToBytes(privkey));
}