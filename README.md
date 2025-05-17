<div align="center">
  <h1>Agent-to-Agent Manager (AAM)</h1>
</div>

<div align="center">  
A tool for creating and managing agents conforming to the Agent-to-Agent (A2A) protocol
</div>

---

<div align="center">
<h4>Getting Started</h4>
</div>
  
---

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/aam)](https://npmjs.com/package/aam)
[![npm](https://img.shields.io/npm/dw/aam.svg)](https://npmjs.com/package/aam)
[![Github Stars](https://img.shields.io/github/stars/melvincarvalho/aam.svg)](https://github.com/melvincarvalho/aam/)

## ⚡️ Features

&nbsp;&nbsp;✓&nbsp; Create A2A-compliant agent cards in `.well-known/agent.json`  
&nbsp;&nbsp;✓&nbsp; Manage agent skills according to A2A protocol  
&nbsp;&nbsp;✓&nbsp; Search for agents in registries  
&nbsp;&nbsp;✓&nbsp; Search for skills in registries  
&nbsp;&nbsp;✓&nbsp; Import skills from registries to agent cards  
&nbsp;&nbsp;✓&nbsp; Register agents in curated registries

## 📖 About A2A Protocol

The Agent-to-Agent (A2A) protocol is designed to enable AI agents to discover and collaborate with each other. The protocol standardizes how agents describe themselves and their capabilities through "Agent Cards" which are hosted at a well-known location (typically `.well-known/agent.json`).

Learn more about the A2A protocol at [Google's A2A Protocol Documentation](https://google.github.io/A2A/topics/agent-discovery/).

## ✍️ Getting Started

---

### Install with npm

```
npm install -g aam
```

---

### Initialize the project

Create the necessary templates and directories:

```
aam init
```

---

### Create an agent card

Create an A2A-compliant agent card in `.well-known/agent.json`:

```
aam create-agent --name "My Agent" --description "A custom A2A agent" --url "https://example.com/a2a"
```

Optional parameters:

- `--provider-name`: Name of the agent provider
- `--provider-url`: URL of the agent provider
- `--version`: Version of the agent

---

### Add a skill to an agent

Add a custom skill to your agent card:

```
aam add-skill --id "custom-skill" --name "Custom Skill" --description "A custom skill" --input-modes "text" --output-modes "text"
```

Optional parameters:

- `--example-input`: Example input for the skill
- `--example-output`: Example output for the skill
- `--card`: Path to the agent card (default: `.well-known/agent.json`)

---

### Import a skill from registry

Import a skill from the registry to your agent card:

```
aam import-skill text-generation
```

Optional parameters:

- `--card`: Path to the agent card (default: `.well-known/agent.json`)
- `--registry`: Path to the skills registry (default: built-in registry)

---

### Search for agents in registry

Search for agents in the registry:

```
aam search-agents chatbot
```

Optional parameters:

- `--registry`: Path to the agents registry (default: built-in registry)

---

### Search for skills in registry

Search for skills in the registry:

```
aam search-skills image
```

Optional parameters:

- `--registry`: Path to the skills registry (default: built-in registry)

---

### Register an agent in registry

Register your agent in the registry:

```
aam register-agent
```

Optional parameters:

- `--card`: Path to the agent card (default: `.well-known/agent.json`)
- `--registry`: Path to the agents registry (default: built-in registry)

---

### Display help information

Display help information about all commands:

```
aam help
```

---

## 🔍 Agent Discovery

The A2A protocol provides several strategies for discovering agents:

1. **Well-Known URI**: Agents host their card at `.well-known/agent.json` following RFC 8615.
2. **Curated Registries**: Agents can be registered in and discovered via centralized registries.
3. **Direct Configuration**: Agents can be configured with direct knowledge of each other.

AAM supports all these discovery methods and makes it easy to generate compliant agent cards.

## 📝 Example Agent Card

Here's an example of an agent card in A2A protocol format:

```json
{
  "name": "Text Generation Agent",
  "description": "An agent that can generate text content using AI",
  "url": "https://example.com/agents/text-generation",
  "version": "1.0.0",
  "provider": {
    "name": "Example AI",
    "url": "https://example.ai"
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
  "skills": [
    {
      "id": "text-generation",
      "name": "Text Generation",
      "description": "Generate text content based on prompts",
      "inputModes": ["text"],
      "outputModes": ["text"],
      "examples": [
        {
          "input": { "text": "Write a short poem about the moon" },
          "output": {
            "text": "Silver orb in night's embrace,\nCasting light on Earth's dark face.\nAncient witness, timeless grace,\nGuiding dreamers through space."
          }
        }
      ]
    }
  ]
}
```

## 📝 Example Skill Format

Here's an example of a skill in A2A protocol format:

```json
{
  "id": "language-translation",
  "name": "Language Translation",
  "description": "Translate text between languages",
  "inputModes": ["text"],
  "outputModes": ["text"],
  "parameters": {
    "targetLanguage": {
      "type": "string",
      "required": true,
      "description": "The language code to translate to"
    }
  },
  "examples": [
    {
      "input": {
        "text": "Hello, world!",
        "parameters": {
          "targetLanguage": "fr"
        }
      },
      "output": { "text": "Bonjour, monde!" }
    }
  ]
}
```

## ⚖️ License

This project is under the MIT License. See the [LICENSE](https://github.com/melvincarvalho/aam/blob/gh-pages/LICENSE) file for the full license text.
