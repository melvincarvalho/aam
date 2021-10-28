<div align="center">
  <h1>Autonomous Agent Manager</h1>
</div>

<div align="center">  
A library and framework to create composable autonomous agents
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


## Features

&nbsp;&nbsp;✓&nbsp; Create autonomous agents  
&nbsp;&nbsp;✓&nbsp; Composable Skills  
&nbsp;&nbsp;✓&nbsp; Agent Registry  
&nbsp;&nbsp;✓&nbsp; Skills Registry  
&nbsp;&nbsp;✓&nbsp; Search agents and skills  

## Getting Started
### Install with npm

```
sudo npm -g install aam
```

### Create an agent

Display instructions to create an agent with a given name

```
aam create <name>
```

### Install an agent

Instructions to install an agent, from the agent [registry](registry.json)

```
aam install <agent>
```

### Skills

Instructions to install composable [skills](https://github.com/topics/aam-skill), from the skill [registry](skills.json)

```
aam skill <skill>
```

### Search

Search via nick for the JSON in the agent [registry](registry.json)

```
aam search <nick>
```



## License

MIT

