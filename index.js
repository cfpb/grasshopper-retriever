#!/usr/bin/env node

'use strict';
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var hyperquest = require('hyperquest');
var rimraf = require('rimraf');
var zlib = require('zlib');
var unzip = require('unzip');
var csvToVrt = require('csv-to-vrt');
var uploadStream = require('./lib/uploadStream');
var checkHash = require('./lib/checkHash');

var zipReg = /.zip$/i;
var csvReg = /(?:txt|csv)$/i;
var restrictedReg = /\.\.|\//g;

var program;

if(require.main === module){
  program = require('commander');
  program
    .version('0.0.1')
    .option('-b, --bucket <bucket>', 'An S3 bucket where the data should be loaded.')
    .option('-p, --profile <profile>', 'The aws profile in ~/.aws/credentials. Will also respect environmental variables.', 'default')
    .option('-d, --directory <directory>', 'A directory where the data should be loaded, either relative to the current folder or the passed S3 bucket.', '.')
    .option('-f --file <file>', 'The json data file that contains the collected data endpoints. Defaults to data.json.', 'data.json')
    .option('-m --match <match>', 'A string or regular expression that the names from the <file> must contain or match', null)
    .parse(process.argv)
  run(program);
}

function run(program, callback){
  var stringMatch = typeof program.match === 'string';
  var regMatch = typeof program.match === 'object';

  var data = JSON.parse(fs.readFileSync(program.file));
  var recordCount = data.length;
  var processed = 0;

  function recordCallback(err){
    if(err){
     if(callback) return callback(err); 
     throw err;
    }

    if(++processed === recordCount){
      callback(null, recordCount);
    }
  }


  if(program.bucket) uploadStream.init(program.bucket, program.profile) 

  data.forEach(function(record){

    //Don't allow to traverse to other folders via data.json
    if(restrictedReg.test(record.name)){
      throw new Error('Invalid record name. Must not contain ".." or "/".');
    }

    //If the record is filtered, remove it from the count 
    if(stringMatch && record.name.indexOf(program.match) === -1 ||
       regMatch && !program.match.test(record.name)
    ){
       return --recordCount;
    }

    var request = hyperquest(record.url);
    
    request.on('error', recordCallback);

    checkHash(request, record.hash, function(hashIsEqual, remoteHash){
      if(hashIsEqual) return; 
      request.unpipe();
      request.emit('error', new Error('The hash from ' + record.name + ' did not match the downloaded file\'s hash.\nRecord hash: ' + record.hash +'\nRemote hash: ' + remoteHash +'\n'));
    });

    if(zipReg.test(record.url)){
      request.pipe(unzip.Extract({path: record.name}))
        .on('close', function(){
          var unzipped = path.join(record.name, record.file)

          function removeZipped(err, details){
            rimraf(record.name, function(e){
              recordCallback(e || err);
            });
          }

          if(csvReg.test(record.file)){
            csvToVrt(unzipped, record.sourceSrs, function(vrt){
              handleStream(spawnOgr(vrt), record, removeZipped);
            });
          }else{
            handleStream(spawnOgr(unzipped), record, removeZipped);
          }
        });
    }else{
      handleStream(spawnOgr(null, request), record, report)
    }
  });


  function report(err, details){
    console.log(err, details);
  }


  function spawnOgr(file, stream){
    var child; 
    if(stream){
      child = spawn('ogr2ogr', ['-f', 'CSV', '-t_srs', 'WGS84', -'lco', 'GEOMETRY=AS_XY', '/vsistdout/', '/vsistdin/'])
      stream.pipe(child.stdin);
    }else{
      child = spawn('ogr2ogr', ['-f', 'CSV', '-t_srs', 'WGS84', '-lco', 'GEOMETRY=AS_XY', '/vsistdout/', file])
    }
    return child.stdout;
  }


  function handleStream(stream, record, cb){
    if(!cb) cb = function(err){if(err) throw err;};

    var endfile = path.join(program.directory, record.name + '.csv.gz');
    var zipStream = zlib.createGzip();
    
    stream.on('error', function(err){
      this.unpipe();
      cb(err);
    })

    stream.pipe(zipStream);

    if(program.bucket){
      return uploadStream.stream(zipStream, endfile, cb);
    }

    zipStream.pipe(fs.createWriteStream(endfile))
      .on('finish', cb)
      .on('error', function(err){
        this.unpipe();
        cb(err); 
      })
  }


}
