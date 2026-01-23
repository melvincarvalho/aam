import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { execSync } from 'child_process';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// User's skills directory
const AAM_HOME = path.join(os.homedir(), '.aam');
const SKILLS_DIR = path.join(AAM_HOME, 'skills');

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
 * Ensure AAM home directory exists
 */
function ensureAamHome() {
  if (!fs.existsSync(AAM_HOME)) {
    fs.mkdirSync(AAM_HOME, { recursive: true });
  }
  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }
}

/**
 * Add (install) a skill from a GitHub repository
 * @param {string} repo - GitHub repo in format "owner/repo" or full URL
 * @param {Object} options - Installation options
 * @returns {Object} - Result of operation
 */
export function addFromRepo(repo, options = {}) {
  try {
    ensureAamHome();

    // Parse repo string
    let repoUrl = repo;
    let repoName = repo;

    if (!repo.includes('://')) {
      // Short form: owner/repo
      repoUrl = `https://github.com/${repo}.git`;
      repoName = repo.split('/').pop();
    } else {
      // Full URL
      repoName = repo.split('/').pop().replace('.git', '');
    }

    const targetDir = path.join(SKILLS_DIR, repoName);

    // Check if already installed
    if (fs.existsSync(targetDir)) {
      if (options.force) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      } else {
        return { success: false, error: `Skill "${repoName}" already installed. Use --force to reinstall.` };
      }
    }

    // Clone the repository
    console.log(`Cloning ${repoUrl}...`);
    execSync(`git clone --depth 1 ${repoUrl} ${targetDir}`, { stdio: 'inherit' });

    // Check for SKILL.md or package.json
    const skillMd = path.join(targetDir, 'SKILL.md');
    const packageJson = path.join(targetDir, 'package.json');

    let skillInfo = { name: repoName, repo: repo };

    if (fs.existsSync(packageJson)) {
      const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
      skillInfo.name = pkg.name || repoName;
      skillInfo.version = pkg.version;
      skillInfo.description = pkg.description;
    }

    if (fs.existsSync(skillMd)) {
      skillInfo.hasSkillMd = true;
    }

    // Run npm install if package.json exists
    if (fs.existsSync(packageJson)) {
      console.log('Installing dependencies...');
      execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
    }

    // Save install metadata
    const metaFile = path.join(targetDir, '.aam-meta.json');
    fs.writeFileSync(metaFile, JSON.stringify({
      ...skillInfo,
      installedAt: new Date().toISOString(),
      source: repoUrl
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
export function listInstalled() {
  try {
    ensureAamHome();

    if (!fs.existsSync(SKILLS_DIR)) {
      return { success: true, skills: [] };
    }

    const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const skills = dirs.map(dir => {
      const skillPath = path.join(SKILLS_DIR, dir);
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

    return { success: true, skills };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove an installed skill
 * @param {string} name - Name of skill to remove
 * @returns {Object} - Result of operation
 */
export function removeInstalled(name) {
  try {
    ensureAamHome();

    const skillPath = path.join(SKILLS_DIR, name);

    if (!fs.existsSync(skillPath)) {
      return { success: false, error: `Skill "${name}" not found` };
    }

    fs.rmSync(skillPath, { recursive: true, force: true });

    return { success: true, removed: name };
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
 * Get AAM home directory path
 * @returns {string} - Path to AAM home
 */
export function getAamHome() {
  return AAM_HOME;
}

/**
 * Get skills directory path
 * @returns {string} - Path to skills directory
 */
export function getSkillsDir() {
  return SKILLS_DIR;
}