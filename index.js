var fs = require('fs-extra');
var path = require('path');
var spawn = require('child_process').spawn;
var pump = require('pump');
var hyperquest = require('hyperquest');
var zlib = require('zlib');
var unzip = require('unzip');
var csvToVrt = require('csv-to-vrt');
var UploadStream = require('./lib/UploadStream');
var checkHash = require('./lib/checkHash');

var zipReg = /.zip$/i;
var csvReg = /(?:txt|csv)$/i;
var restrictedReg = /\.\.|\//;


function retrieve(program, callback){

  var scratchSpace = 'retriever-scratch' + Math.random()*1e17;
  fs.mkdirSync(scratchSpace);


  function wrappedCb(err, count){
    fs.remove(scratchSpace, function(e){
      if(err||e){
        if(callback) return callback(err||e);
        throw err||e;
      }

      if(callback) callback(err, count);
    });
  }


  var stringMatch = typeof program.match === 'string';
  var regMatch = typeof program.match === 'object';
  var restrictedFound = 0;

  var uploadStream;

  var data;

  try{
    data = JSON.parse(fs.readFileSync(program.file));
  }catch(err){
    return wrappedCb(err);
  }

  var recordCount = data.length;
  var processed = 0;


  function recordCallback(err){
    if(err) return wrappedCb(err);
    if(++processed === recordCount) wrappedCb(null, recordCount);
  }


  if(program.bucket) uploadStream = new UploadStream(program.bucket, program.profile);

  data.forEach(function(record){

    //Don't allow to traverse to other folders via data.json
    if(restrictedReg.test(record.name)){
      restrictedFound = 1;
      return wrappedCb(new Error('Invalid record name. Must not contain ".." or "/".'));
    }

    if(restrictedFound) return;

    //If the record is filtered, remove it from the count
    if(stringMatch && record.name.indexOf(program.match) === -1 ||
       regMatch && !program.match.test(record.name)
    ){
       if(--recordCount === processed){
         return wrappedCb(null, recordCount);
       }
       return recordCount;
    }

    var request = hyperquest(record.url);

    checkHash(request, record.hash, function(hashIsEqual, remoteHash){
      if(hashIsEqual) return;
      request.unpipe();
      request.emit('error', new Error('The hash from ' + record.name + ' did not match the downloaded file\'s hash.\nRecord hash: ' + record.hash +'\nRemote hash: ' + remoteHash +'\n'));
    });

    request.on('error', recordCallback);

    if(zipReg.test(record.url)){
      //unzip stream can't be pumped
      request.pipe(unzip.Extract({path: path.join(scratchSpace, record.name)}))
       .on('close', function(){

        var unzipped = path.join(scratchSpace, record.name, record.file);

        if(csvReg.test(record.file)){
          csvToVrt(unzipped, record.sourceSrs, function(err, vrt){
            if(err) return recordCallback(err);
            handleStream(spawnOgr(vrt), record, recordCallback);
          });
        }else{
          handleStream(spawnOgr(unzipped), record, recordCallback);
        }
      })
      .on('error', recordCallback);
    }else{
      if(csvReg.test(record.file)){
        var csv = path.join(scratchSpace, record.file);
        var csvStream = fs.createWriteStream(csv);

        pump(request, csvStream, function(err){
          if(err) return recordCallback(err);

          csvToVrt(csv, record.sourceSrs, function(err, vrt){
            if(err) return recordCallback(err);
            handleStream(spawnOgr(vrt), record, recordCallback);
          });
        });

      }else{
        handleStream(spawnOgr(null, request), record, recordCallback);
      }
    }
  });


  function spawnOgr(file, stream){
    var child;

    if(stream){
      child = spawn('ogr2ogr', ['-f', 'CSV', '-t_srs', 'WGS84', '-lco', 'GEOMETRY=AS_XY', '/vsistdout/', '/vsistdin/']);
      pump(stream, child.stdin);
    }else{
      child = spawn('ogr2ogr', ['-f', 'CSV', '-t_srs', 'WGS84', '-lco', 'GEOMETRY=AS_XY', '/vsistdout/', file]);
    }
    return child.stdout;
  }


  function handleStream(stream, record, cb){
    if(!cb) cb = function(err){if(err) wrappedCb(err)}

    var endfile = path.join(program.directory, record.name + '.csv.gz');
    var zipStream = zlib.createGzip();
    var destStream;

    if(program.bucket){
      destStream = uploadStream.stream(endfile);
    }else{
      destStream = fs.createWriteStream(endfile);
    }

    pump(stream, zipStream, destStream, function(err){
      if(err) return cb(err);
      cb();
    });
  }


}

module.exports = retrieve;
