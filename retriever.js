#!/usr/bin/env node

'use strict';

var program = require('commander');
var winston = require('winston');
var retriever = require('./index');

var logger = new winston.Logger({
    transports: [
      new (winston.transports.Console)()
    ]
  });

program
  .version('0.0.1')
  .option('-f --file <file>', 'The json data file that contains the collected data endpoints.')
  .option('-b, --bucket <bucket>', 'An S3 bucket where the data should be loaded.')
  .option('-d, --directory <directory>', 'A directory where the data should be loaded, either relative to the current folder or the passed S3 bucket.')
  .option('-p, --profile <profile>', 'The aws profile in ~/.aws/credentials. Will also respect environmental variables.', 'default')
  .option('-m --match <match>', 'A string or regular expression that the names from the <file> must contain or match')
  .option('-q --quiet', 'Suppress logging.', false)
  .parse(process.argv);

if(program.quiet){
  logger.remove(winston.transports.Console);
}

retriever(program, function(output){
  var retrieved = output.retrieved;
  var errs = output.errors;

  if(!program.bucket && !program.directory){
    logger.info('%d source%s still fresh, %d source%s need updates',
      retrieved.length,
      retrieved.length === 1 ? '' : 's',
      errs.length,
      errs.length ===1 ? '' : 's'
    );
  }else{
    logger.info('Fetched %d source%s and placed %s in %s%s',
      retrieved.length,
      retrieved.length === 1 ? '' : 's',
      retrieved.length === 1 ? 'it' : 'them',
      program.bucket ? program.bucket + '/' : '',
      program.directory ? program.directory : ''
    );
  }
});
