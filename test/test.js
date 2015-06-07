var test = require('tape');
var fs = require('fs');

var retriever = require('../index');
var checkHash = require('../lib/checkHash');
var uploadStream = require('../lib/uploadStream');



test('checkHash module',function(t){
  t.plan(3);
  var stream = fs.createReadStream('test/data/maine.json');
  var hash = '9c8b3eb529b62bc3e96fb021970e0cd785df37536cf0f5f626d4552f60bc14c7';
  
  checkHash(stream, hash, function(hashIsEqual, computedHash){
    t.ok(hashIsEqual, 'Computes proper hash'); 
    t.equal(hash, computedHash, 'Precomputed hash equals computed hash');
  });

  checkHash(stream, 'wronghash', function(hashIsEqual){
    t.notOk(hashIsEqual, 'Returns falsy if the hashes aren\'t equal.');
  })
});

test('uploadStream module',function(t){
  t.plan(3);

  var S3 = uploadStream.init('wyatt-test', 'default')
  var S3Copy = uploadStream.init('wyatt-test');

  t.equal(typeof S3, 'object', 'Creates and returns an S3 instance.');
  t.equal(S3, S3Copy, 'Multiple calls to init return the same S3 instance.');

  try{
    uploadStream.init();
  }catch(e){
    t.pass('Errors without a bucket passed in.');
  }
});

test('retriever', function(t){
  t.plan(15);

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

  retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:'test/data/maine.json'}); 

  retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:'test/data/maine.json'}); 

  retriever({bucket:'wyatt-test', profile:'default', directory:'.', file:'test/data/maine.json'}); 
});
