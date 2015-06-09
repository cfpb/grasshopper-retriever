var fs = require('fs-extra');
var path = require('path');
var spawn = require('child_process').spawn;
var hyperquest = require('hyperquest');
var zlib = require('zlib');
var unzip = require('unzip');
var csvToVrt = require('csv-to-vrt');
var UploadStream = require('./lib/UploadStream');
var checkHash = require('./lib/checkHash');

var zipReg = /.zip$/i;
var csvReg = /(?:txt|csv)$/i;
var restrictedReg = /\.\.|\//g;

var scratchSpace = 'retriever-scratch' + Date.now();


function retrieve(program, callback){

  //fs.mkdirSync(scratchSpace)

  function wrappedCb(){
    var args = arguments;
    var self = this;

    fs.remove(scratchSpace, function(err){
      if(err){
       if(callback) return callback(err);
       throw err;
      }

      if(callback) callback.apply(self, args);
    });
  }


  var stringMatch = typeof program.match === 'string';
  var regMatch = typeof program.match === 'object';
  
  var uploadStream;

  var data = JSON.parse(fs.readFileSync(program.file));
  var recordCount = data.length;
  var processed = 0;


  function recordCallback(err){
    if(err) return wrappedCb(err);
    if(++processed === recordCount) wrappedCb(null, recordCount);
  }


  if(program.bucket) uploadStream = UploadStream(program.bucket, program.profile) 


  data.forEach(function(record){

    //Don't allow to traverse to other folders via data.json
    if(restrictedReg.test(record.name)){
      throw new Error('Invalid record name. Must not contain ".." or "/".');
    }

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
    
    request.on('error', recordCallback);

    checkHash(request, record.hash, function(hashIsEqual, remoteHash){
      if(hashIsEqual) return; 
      request.unpipe();
      request.emit('error', new Error('The hash from ' + record.name + ' did not match the downloaded file\'s hash.\nRecord hash: ' + record.hash +'\nRemote hash: ' + remoteHash +'\n'));
    });

    if(zipReg.test(record.url)){
      request.pipe(unzip.Extract({path: path.join(scratchSpace, record.name)}))
        .on('close', function(){
          var unzipped = path.join(scratchSpace, record.name, record.file)

          if(csvReg.test(record.file)){
            csvToVrt(unzipped, record.sourceSrs, function(err, vrt){
              handleStream(spawnOgr(vrt), record, recordCallback);
            });
          }else{
            handleStream(spawnOgr(unzipped), record, recordCallback);
          }
        });
    }else{
      if(csvReg.test(record.file)){
        var csv = path.join(scratchSpace, record.file);
        fs.writeFile(csv, request, function(err){
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

module.exports = retrieve;
