var test = require('tape');
var fs = require('fs');
var os = require('os');
var pump = require('pump');
var spawn = require('child_process').spawn;
var retriever = require('../index');
var checkHash = require('../lib/checkHash');
var UploadStream = require('../lib/UploadStream');

var maine = 'test/data/maine.json';

test('checkHash module', function(t){
  t.plan(3);
  var stream = fs.createReadStream(maine);
  var hash = '824f3e81244489f6458578b990bab5c9f6d1ab7697f89d5485edc1640c6d82a8';

  checkHash(stream, hash, function(hashIsEqual, computedHash){
    t.ok(hashIsEqual, 'Computes proper hash');
    t.equal(computedHash, hash, 'Precomputed hash equals computed hash');
  });

  checkHash(stream, 'wronghash', function(hashIsEqual){
    t.notOk(hashIsEqual, 'Returns falsy if the hashes aren\'t equal.');
  });
});

test('uploadStream module', function(t){
  t.plan(7);

  var uploadStream = new UploadStream('wyatt-test', 'default');
  t.ok(uploadStream.S3, 'Creates and returns an S3 instance.');
  t.ok(uploadStream.credentials, 'Creates credentials object.');
  t.equal(uploadStream.bucket, 'wyatt-test', 'Saves reference to bucket.');

  try{
    new UploadStream();
  }catch(e){
    t.pass('Errors without a bucket passed in.');
  }

  var upload = uploadStream.stream( 'test/output/upload.json');

  pump(fs.createReadStream(maine), upload, function(err){
    t.notOk(err, 'No error on okay upload.');
  })
  .on('uploaded', function(details){
    t.ok(details, 'Returns upload details.');
  });

  var up = new UploadStream('fakebucketqwkMljeqhwegqw');
  var errStream = up.stream('qwdqqqqs/up.csv.gz');

  pump(fs.createReadStream(maine), errStream, function(){
    t.pass('Errors on uploading to bad bucket.');
  });


});

test('retriever', function(t){

  t.plan(27);

  retriever({quiet: true, profile: 'default', directory: '.', file: 'nofile'}, function(errs){
    t.equal(errs.length, 1, 'Errors on bad file and no bucket.');
  });

  retriever({quiet: true, profile: 'noprofilepresentfakeprofile', 'bucket': 'wyatt-test', file: maine}, function(errs){
    var errLen = 1;
    if(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) errLen = 0;
    t.equal(errs.length, errLen, 'Errors on bad profile, only without environment variables set.');
  });

  retriever({quiet: true, profile: 'default', directory: '.', file: ''}, function(errs){
    t.equal(errs.length, 1, 'Errors with no file passed.');
  });

  retriever({quiet: true, bucket: 'wyatt-test', profile: 'default', directory: '.', file: 'nofile'}, function(errs){
    t.equal(errs.length, 1, 'Errors on bad file and good bucket.');
  });

  retriever({quiet: true, bucket: 'wyatt-test', profile: 'default', directory: '.', file: 'test/data/parent_dir.json'}, function(errs){
    t.equal(errs.length, 1, 'Errors on parent dir in record name.');
  });

  retriever({quiet: true, bucket: 'wyatt-test', profile: 'default', directory: '.', file: 'test/data/slash.json'}, function(errs){
    t.equal(errs.length, 1, 'Errors on forward slash in record name.');
  });

  retriever({quiet: true, bucket: 'fakebucketskjhqblwjdqwobdjabmznmbxbcbcnnbmcioqwOws', profile: 'default', directory: '.', file: maine}, function(errs){
    t.equal(errs.length, 1, 'Error on bad bucket.');
  });

  retriever({quiet: true, bucket: 'wyatt-test', profile: 'default', directory: '.', file: maine}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error on good file and bucket.');
    t.equal(processedRecords.length, 1, 'Loads data from the test dataset to bucket.');
  });

  retriever({quiet: true, profile: 'default', directory: 'test/output', file: maine}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error on good file.');
    t.equal(processedRecords.length, 1, 'Loads data from test data locally.');
  });

  retriever({quiet: true, bucket: 'wyatt-test', profile: 'default', directory: '.', file: maine, match: 'maine'}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error with match.');
    t.equal(processedRecords.length, 1, 'Loads matched data.');
  });

  retriever({quiet: true, bucket: 'wyatt-test', profile: 'default', directory: '.', file: maine, match: 'nomatch'}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error with no match.');
    t.equal(processedRecords.length, 0, 'Loads nothing when no data matched.');
  });

  retriever({quiet: true, profile: 'default', directory: 'test/output', file: 'test/data/mainejson.json'}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error on good json file.');
    t.equal(processedRecords.length, 1, 'Loads data from json file.');
  });

  retriever({quiet: true, profile: 'default', directory: 'test/output', file: 'test/data/mainecsv.json'}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error on csv.');
    t.equal(processedRecords.length, 1, 'Loads data from csv.');
  });

  retriever({quiet: true, profile: 'default', directory: 'test/output', file: 'test/data/mainezipcsv.json'}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error on zipped csv.');
    t.equal(processedRecords.length, 1, 'Loads data from zipped csv.');
  });

  retriever({quiet: true, profile: 'default', directory: 'test/output', file: 'test/data/maineandarkanderr.json'}, function(errs, processedRecords){
    t.equal(errs.length, 1, 'Hash error from file with hash error.')
    t.equal(processedRecords.length, 2, 'Loads data after hash error.');
  });

  retriever({quiet: true, profile: 'default', directory: 'test/output', file: 'test/data/maineandarkandparenterr.json'}, function(errs, processedRecords){
    t.equal(errs.length, 1, 'Parent dir error');
    t.equal(processedRecords.length, 2, 'Loads data after parent dir error.');
  });

  spawn('./retriever.js', ['-b', 'wyatt-test', '-p', 'default', '-d', '.', '-f', maine])
    .on('exit', function(code){
      t.equal(code, 0, 'Loads via cli');
    });

  spawn('./test/no-cb.js', ['-b', 'wyatt-test', '-p', 'default', '-d', '.', '-f', maine])
    .on('exit', function(code){
      t.equal(code, 0, 'Works without a callback.');
    });

});

test('Ensure output', function(t){
  t.plan(10);
  var count = 0;

 retriever({quiet: true, profile: 'default', directory: 'test/output', file: 'test/data/parcelsjson.json'}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error on converted parcels.')
    t.equal(processedRecords.length, 1, 'Loads data from parcels');
    ensure(++count);
  });

  retriever({match: 'maine, arkansas', quiet: true, profile: 'default', directory: 'test/output', file: 'test/data/maineandarkanderr.json'}, function(errs, processedRecords){
    t.equal(errs.length, 0, 'No error on filtered file.')
    t.equal(processedRecords.length, 2, 'Loads data after filter.');
    ensure(++count);
  });

  function ensure(count){
    if(count < 2) return;

    var outfiles = [
      {file: 'test/output/arkansas.csv.gz', hash: '38af547a0147a0934f63bda7a4b6614e4b0bc4defca1ecd7eed9e4303fa7af59'},
      {file: 'test/output/maine.csv.gz', hash: '1af6790085e15625392157c2187a6e6624eaa3c1d856ee8531fe1873fe7548e7'},
      {file: 'test/output/sacramento.csv.gz', hash: '7f1be41d92041b0d5714fcb1f65a58d87efa3bb46681aa0c5160e7ff7701ae85'}
    ];

    outfiles.forEach(function(obj){
      var stream = fs.createReadStream(obj.file);

      checkHash(stream, obj.hash, function(hashIsEqual, computedHash){
        t.ok(hashIsEqual, 'Computes proper hash');
        t.equal(computedHash, obj.hash, 'Precomputed hash equals computed hash');
      });

    });
  }
});
