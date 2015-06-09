var test = require('tape');
var fs = require('fs');

var retriever = require('../index');
var checkHash = require('../lib/checkHash');
var UploadStream = require('../lib/UploadStream');

var maine = 'test/data/maine.json';


test('checkHash module',function(t){
  t.plan(3);
  var stream = fs.createReadStream(maine);
  var hash = 'f0a85b3c64f19900c47f168ea97363943ee7d83b1a3d20cc79801865046cef4d';
  
  checkHash(stream, hash, function(hashIsEqual, computedHash){
    t.ok(hashIsEqual, 'Computes proper hash'); 
    t.equal(hash, computedHash, 'Precomputed hash equals computed hash');
  });

  checkHash(stream, 'wronghash', function(hashIsEqual){
    t.notOk(hashIsEqual, 'Returns falsy if the hashes aren\'t equal.');
  })
});

test('uploadStream module',function(t){
  t.plan(7);

  var uploadStream = UploadStream('wyatt-test', 'default');
  t.ok(uploadStream.S3, 'Creates and returns an S3 instance.');
  t.ok(uploadStream.credentials, 'Creates credentials object.');
  t.equal(uploadStream.bucket, 'wyatt-test', 'Saves reference to bucket.');

  try{
    UploadStream();
  }catch(e){
    t.pass('Errors without a bucket passed in.');
  }

  uploadStream.stream(fs.createReadStream(maine), 'output/data/upload.csv.gz', function(err, details){
    t.notOk(err, 'No error on okay upload.');
    t.ok(details, 'Returns upload details.');
  }); 

  var up = UploadStream('fakebucketqwkMljeqhwegqw');

  up.stream(fs.createReadStream(maine), 'output/data/up.csv.gz', function(err, details){
    t.ok(err, 'Errors on bad bucket.');
  });

});

test('retriever', function(t){
  t.plan(6);

  try{
    retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:'nofile'}); 
  }catch(e){
    t.pass('Errors on bad file.');
  }

  try{
    retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:'parent_dir.json'}); 
  }catch(e){
    t.pass('Errors on parent dir in record name.');
  }

  try{
    retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:'slash.json'}); 
  }catch(e){
    t.pass('Errors on forward slash in record name.');
  }

  try{
    retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:''}); 
  }catch(e){
    t.pass('Errors on bad file.');
  }

  retriever({bucket:'wyatt-test', profile:'default', directory:'.', file: maine}, function(err, count){
    t.notOk(err, 'No error on good file and bucket.');
    t.equal(count, 1, 'Loads data from the test dataset.');
  });
//retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:'test/data/maine.json'}); 

 // retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:'test/data/maine.json'}); 
});
