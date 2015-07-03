#!/usr/bin/env node

'use strict';

var program = require('commander');
var retriever = require('./index');

program
  .version('0.0.1')
  .option('-b, --bucket <bucket>', 'An S3 bucket where the data should be loaded.')
  .option('-p, --profile <profile>', 'The aws profile in ~/.aws/credentials. Will also respect environmental variables.', 'default')
  .option('-d, --directory <directory>', 'A directory where the data should be loaded, either relative to the current folder or the passed S3 bucket.', '.')
  .option('-f --file <file>', 'The json data file that contains the collected data endpoints.')
  .option('-m --match <match>', 'A string or regular expression that the names from the <file> must contain or match', '')
  .option('-q --quiet', 'Suppress logging.', false)
  .parse(process.argv);

retriever(program, function(errs, retrieved){
  console.log('Fetched %d source%s and placed %s in %s%s',
    retrieved,
    retrieved === 1 ? '' : 's',
    retrieved === 1 ? 'it' : 'them',
    program.bucket ? program.bucket + '/' : '',
    program.directory
  );
});
