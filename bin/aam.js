#!/usr/bin/env node

// IMPORTS
// var fs = require('fs')
var argv = require('minimist')(process.argv.slice(2))
const { aam_search } = require('../lib/')

// MODEL
globalThis.data = {
  term: 'aam'
}
// console.log('data', data, argv)

// INIT
data.term = argv._[0] || data.term

// MAIN
const res = aam_search(data.term)
console.log(res)