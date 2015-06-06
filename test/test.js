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
  t.end();
});
