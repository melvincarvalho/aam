const fs = require('fs');
const path = require('path');
const os = require('os');

// File paths
const AGENT_CARD_TEMPLATE = path.join(__dirname, '../templates/agent-card.json');
const AGENT_SKILLS_TEMPLATE = path.join(__dirname, '../templates/agent-skill.json');
const DEFAULT_REGISTRY = path.join(__dirname, '../registry/agents.json');
const DEFAULT_SKILLS_REGISTRY = path.join(__dirname, '../registry/skills.json');

/**
 * Create an agent card in .well-known/agent.json format
 * @param {Object} options - Options for creating the agent card
 * @returns {Object} - Created agent card
 */
function createAgentCard (options = {}) {
  try {
    // Create template if it doesn't exist
    if (!fs.existsSync(AGENT_CARD_TEMPLATE)) {
      throw new Error('Agent card template not found. You may need to run `aam init` first.');
    }

    // Read template
    const template = JSON.parse(fs.readFileSync(AGENT_CARD_TEMPLATE, 'utf8'));

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
function initialize () {
  try {
    // Create templates directory
    const templatesDir = path.join(__dirname, '../templates');
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    // Create registry directory
    const registryDir = path.join(__dirname, '../registry');
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
        "pushNotifications": false
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

    fs.writeFileSync(AGENT_CARD_TEMPLATE, JSON.stringify(agentCardTemplate, null, 2), 'utf8');

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

    fs.writeFileSync(AGENT_SKILLS_TEMPLATE, JSON.stringify(agentSkillTemplate, null, 2), 'utf8');

    // Create default registry
    if (!fs.existsSync(DEFAULT_REGISTRY)) {
      fs.writeFileSync(DEFAULT_REGISTRY, JSON.stringify([], null, 2), 'utf8');
    }

    // Create default skills registry
    if (!fs.existsSync(DEFAULT_SKILLS_REGISTRY)) {
      fs.writeFileSync(DEFAULT_SKILLS_REGISTRY, JSON.stringify([], null, 2), 'utf8');
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
function addSkill (skill, agentCardPath = '.well-known/agent.json') {
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
function searchAgents (query, registryPath = DEFAULT_REGISTRY) {
  try {
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
function searchSkills (query, registryPath = DEFAULT_SKILLS_REGISTRY) {
  try {
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
function importSkill (skillId, agentCardPath = '.well-known/agent.json', registryPath = DEFAULT_SKILLS_REGISTRY) {
  try {
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
function registerAgent (agentCardPath = '.well-known/agent.json', registryPath = DEFAULT_REGISTRY) {
  try {
    // Ensure agent card exists
    if (!fs.existsSync(agentCardPath)) {
      throw new Error(`Agent card not found at ${agentCardPath}`);
    }

    // Read agent card
    const agentCard = JSON.parse(fs.readFileSync(agentCardPath, 'utf8'));

    // Ensure registry exists
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

// Export functions
module.exports = {
  createAgentCard,
  initialize,
  addSkill,
  searchAgents,
  searchSkills,
  importSkill,
  registerAgent
};