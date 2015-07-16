var fs = require('fs-extra');
var util = require('util');
var path = require('path');
var url = require('url');
var spawn = require('child_process').spawn;
var winston = require('winston');
var pump = require('pump');
var eos = require('end-of-stream');
var request = require('request');
var ftp = require('ftp');
var zlib = require('zlib');
var unzip = require('unzip');
var csvToVrt = require('csv-to-vrt');
var centroidStream = require('centroid-stream');
var UploadStream = require('./lib/UploadStream');
var checkHash = require('./lib/checkHash');

var zipReg = /.zip$/i;
var csvReg = /(?:txt|csv)$/i;
var restrictedReg = /\.\.|\//;


function retrieve(program, callback){

  var errs = [];
  var scratchSpace = 'scratch/' + Math.random()*1e17;
  fs.mkdirsSync(scratchSpace);

  var logger = new winston.Logger({
    transports: [
      new (winston.transports.Console)()
    ]
  });

  if(program.quiet){
    logger.remove(winston.transports.Console);
  }


  function wrappedCb(err){
    if(err) errs.push(err);

    try{
      fs.removeSync(scratchSpace);
    }catch(e){
      if(e) errs.push(e);
    }

    if(errs.length){
      logger.error('Encountered %d error%s whilst retrieving.', errs.length, errs.length > 1 ? 's' : '');
      errs.forEach(function(v){
        logger.error(v);
      });
      if(!callback) throw errs.join('\n');
    }

    if(callback) callback(errs, processedRecords);
  }

  if(!program.file) return wrappedCb(new Error('Must provide a metadata file with the -f option.'));

  var stringMatch = typeof program.match === 'string';
  var regMatch = typeof program.match === 'object';

  var uploadStream;
  var data;

  try{
    data = JSON.parse(fs.readFileSync(program.file));
  }catch(err){
    return wrappedCb(err);
  }

  var recordCount = data.length;
  var processedRecords = [];

  function recordCallback(err, record){
    if(err){
      logger.error(err);
      errs.push(err);
      recordCount--;
    }else{
      processedRecords.push(record);
    }
    if(processedRecords.length === recordCount) wrappedCb(null);
  }


  if(program.bucket) uploadStream = new UploadStream(program.bucket, program.profile);

  data.forEach(function(record){

    //Don't allow to traverse to other folders via data.json
    if(restrictedReg.test(record.name)){
      return recordCallback(new Error(util.format('Invalid record name %s. Must not contain ".." or "/".', record.name)));
    }

    //If the record is filtered, remove it from the count
    if(stringMatch && program.match.indexOf(record.name) === -1 ||
      regMatch && !program.match.test(record.name)
    ){
      if(--recordCount === processedRecords.length){
        return wrappedCb(null);
      }
      return recordCount;
    }

    var urlObj = url.parse(record.url);

    if(urlObj.protocol === 'ftp:'){

      var ftpClient = new ftp();

      ftpClient.on('ready', function(){
        ftpClient.get(urlObj.path, function(err, stream){

          if(err){
            ftpClient.end();
            return recordCallback(err);
          }

          eos(stream, function(){
            ftpClient.end();
          });

          processRequest(stream, record);
        });
      });

      ftpClient.connect({host: urlObj.hostname});

    }else{
      processRequest(request(record.url), record);
    }
  });


  function processRequest(stream, record){
    checkHash(stream, record.hash, function(hashIsEqual, remoteHash){
      if(hashIsEqual){
        logger.info('Remote file for %s verified.', record.name);
        return;
      }
      stream.emit('error', new Error('The hash from ' + record.name + ' did not match the downloaded file\'s hash.\nRecord hash: ' + record.hash +'\nRemote hash: ' + remoteHash +'\n'));
    });

    stream.on('error', handleStreamError);

    if(zipReg.test(record.url)){
      //unzip stream can't be pumped
      stream.pipe(unzip.Extract({path: path.join(scratchSpace, record.name)}))
       .on('close', function(){

        var unzipped = path.join(scratchSpace, record.name, record.file);

        if(csvReg.test(record.file)){
          csvToVrt(unzipped, record.sourceSrs, function(err, vrt){
            if(err) return recordCallback(err);
            handleStream(spawnOgr(vrt), record);
          });
        }else{
          handleStream(spawnOgr(unzipped), record);
        }
      })
      .on('error', handleStreamError);
    }else{
      if(csvReg.test(record.file)){
        var csv = path.join(scratchSpace, record.file);
        var csvStream = fs.createWriteStream(csv);

        pump(stream, csvStream, function(err){
          if(err) return recordCallback(err);

          csvToVrt(csv, record.sourceSrs, function(err, vrt){
            if(err) return recordCallback(err);
            handleStream(spawnOgr(vrt), record);
          });
        });

      }else{
        handleStream(spawnOgr(null, stream), record);
      }
    }
  }


  function handleStreamError(err){
    if(this.unpipe) this.unpipe();
    if(this.destroy) this.destroy();
    recordCallback(err);
  }


  function spawnOgr(file, stream){
    var jsonChild;

    if(stream){
      jsonChild = spawn('ogr2ogr', ['-f', 'GeoJSON', '-t_srs', 'WGS84', '/vsistdout/', '/vsistdin/']);
      pump(stream, jsonChild.stdin);
    }else{
      jsonChild = spawn('ogr2ogr', ['-f', 'GeoJSON', '-t_srs', 'WGS84', '/vsistdout/', file]);
    }

    var centroids = centroidStream();
    var csvChild = spawn('ogr2ogr', ['-f', 'CSV', '-t_srs', 'WGS84', '-lco', 'GEOMETRY=AS_XY', '/vsistdout/', '/vsistdin/']);

    pump(jsonChild.stdout, centroids, csvChild.stdin);
    return csvChild.stdout;
  }


  function handleStream(stream, record){
    if(!program.bucket && !program.directory){
      return eos(stream, function(err){
        recordCallback(err);
      });
    }

    if(program.bucket && !program.directory){
      program.directory = '.';
    }

    var endfile = path.join(program.directory, record.name + '.csv.gz');
    var zipStream = zlib.createGzip();
    var destStream;

    if(program.bucket){
      destStream = uploadStream.stream(endfile);
    }else{
      destStream = fs.createWriteStream(endfile);
    }

    pump(stream, zipStream, destStream, function(err){
      recordCallback(err);
    });
  }

}

module.exports = retrieve;
