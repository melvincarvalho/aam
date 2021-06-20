const REGISTRY_FILE = '../registry.json'

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

exports.aam_search = aam_search