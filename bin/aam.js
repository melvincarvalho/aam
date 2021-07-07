#!/usr/bin/env node

// IMPORTS
// var fs = require('fs')
var argv = require('minimist')(process.argv.slice(2))
const { aam_search, aam_skill } = require('../lib/')

// MODEL
globalThis.data = {
  command: 'search',
  term: 'aam',
  defaultCreate: 'template',
  directory: 'template'
}
// console.log('data', data, argv)

// INIT
data.command = argv._[0] || data.command

// MAIN
if (data.command === 'search') {
  let res = aam_search(data.term)
  data.term = argv._[1] || data.term
  console.log(res)
} else if (data.command === 'install') {
  data.term = argv._[1] || data.term
  data.directory = argv._[2] || data.directory
  const res = aam_search(data.term)
  console.log(res)
  console.log('run:')
  console.log('git clone ' + res?.repository + ' ' + (argv._[2] || ''))
  console.log('cd ' + (argv._[2] || data.term))
  console.log('npm install')
  console.log('npm run')
} else if (data.command === 'skill') {
  data.term = argv._[1] || data.term
  data.directory = argv._[2] || data.directory
  const res = aam_skill(data.term)
  // console.log(res)
  console.log('run:')
  console.log('curl ' + res?.install)
} else if (data.command === 'create') {
  let res = aam_search(data.defaultCreate)
  data.directory = argv._[1] || data.directory
  console.log('run:')
  console.log('git clone --depth 1 ' + res?.repository + ' ' + (argv._[1] || ''))
  console.log('cd ' + data.directory)
  console.log('rm -rf .git')
} else {
  console.log('command not found')
}
