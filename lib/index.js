const REGISTRY_FILE = '../registry.json'
const SKILLS_FILE = '../skills.json'

/**
 * 
 * @param {string} term 
 * @returns object
 */
function aam_search(term) {
  const registry = require(REGISTRY_FILE)
  var ret = null
  registry.forEach(el => {
    if (el.nick === term) {
      ret = el
    }
  })
  return ret
}

/**
 * 
 * @param {string} term 
 * @returns object
 */
function aam_skill(term) {
  const registry = require(SKILLS_FILE)
  var ret = null
  registry.forEach(el => {
    if (el.nick === term || el.nick === 'skill-' + term) {
      ret = el
    }
  })
  return ret
}

exports.aam_search = aam_search
exports.aam_skill = aam_skill