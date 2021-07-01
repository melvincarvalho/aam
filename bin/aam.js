#!/usr/bin/env node

// IMPORTS
// var fs = require('fs')
var argv = require('minimist')(process.argv.slice(2))
const { aam_search } = require('../lib/')

// MODEL
globalThis.data = {
  command: 'search',
  term: 'aam',
  defaultCreate: 'template'
}
// console.log('data', data, argv)

// INIT
data.command = argv._[0] || data.command
data.term = argv._[1] || data.term

// MAIN
if (data.command === 'search') {
  let res = aam_search(data.term)
  console.log(res)
} else if (data.command === 'install') {
  let res = aam_search(data.term)
  console.log('git clone ' + res?.repository)
} else if (data.command === 'create') {
  let res = aam_search(data.defaultCreate)
  console.log('git clone ' + res?.repository)
} else {
  console.log('command not found')
}
