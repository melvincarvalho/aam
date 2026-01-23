import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { execSync } from 'child_process';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skills directories - Claude Code compatibility
const GLOBAL_CLAUDE_HOME = path.join(os.homedir(), '.claude');
const GLOBAL_SKILLS_DIR = path.join(GLOBAL_CLAUDE_HOME, 'skills');

// Local (project-level) skills directory
const LOCAL_SKILLS_DIR = '.claude/skills';

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
  let owner, repoName, fullRepo, skillName;

  if (repo.includes('://')) {
    // Full URL: https://github.com/owner/repo or https://github.com/owner/repo.git
    const match = repo.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (match) {
      owner = match[1];
      repoName = match[2];
      fullRepo = `${owner}/${repoName}`;
    } else {
      throw new Error('Invalid GitHub URL');
    }
  } else {
    // Short form: owner/repo
    const parts = repo.split('/');
    if (parts.length !== 2) {
      throw new Error('Invalid repo format. Use owner/repo or full GitHub URL');
    }
    owner = parts[0];
    repoName = parts[1];
    fullRepo = repo;
  }

  // Use owner-repo format to avoid collisions (e.g., anthropics-skills, vercel-skills)
  skillName = `${owner}-${repoName}`;

  return { owner, repoName, fullRepo, skillName };
}

/**
 * Fetch SKILL.md from GitHub raw content
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @returns {Promise<string|null>} - SKILL.md content or null
 */
async function fetchSkillMd(owner, repo) {
  // Try main branch first, then master
  const branches = ['main', 'master'];

  for (const branch of branches) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/SKILL.md`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      // Continue to next branch
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

    // Parse repo string
    const { owner, repoName, fullRepo, skillName } = parseRepo(repo);
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
      source: `https://github.com/${fullRepo}`
    };

    // Try light mode first: just fetch SKILL.md (like skills.sh)
    if (!options.full) {
      console.log(`Fetching SKILL.md from ${fullRepo}...`);
      const skillMd = await fetchSkillMd(owner, repoName);

      if (skillMd) {
        // Create skill directory and save SKILL.md
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMd);

        // Extract description from SKILL.md (first non-heading paragraph)
        const lines = skillMd.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('```')) {
            skillInfo.description = trimmed.slice(0, 200);
            break;
          }
        }

        skillInfo.hasSkillMd = true;
        skillInfo.installMode = 'light';

        // Save install metadata
        const metaFile = path.join(targetDir, '.aam-meta.json');
        fs.writeFileSync(metaFile, JSON.stringify({
          ...skillInfo,
          installedAt: new Date().toISOString()
        }, null, 2));

        return { success: true, skill: skillInfo, path: targetDir };
      }

      console.log('No SKILL.md found, falling back to full clone...');
    }

    // Full mode: clone the entire repository
    const repoUrl = `https://github.com/${fullRepo}.git`;
    console.log(`Cloning ${repoUrl}...`);
    execSync(`git clone --depth 1 ${repoUrl} ${targetDir}`, { stdio: 'inherit' });

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
    const metaFile = path.join(targetDir, '.aam-meta.json');
    fs.writeFileSync(metaFile, JSON.stringify({
      ...skillInfo,
      installedAt: new Date().toISOString()
    }, null, 2));

    return { success: true, skill: skillInfo, path: targetDir };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * List installed skills
 * @returns {Object} - List of installed skills
 */
export function listInstalled(options = {}) {
  try {
    const isGlobal = options.global || false;
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
      const metaFile = path.join(skillPath, '.aam-meta.json');
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