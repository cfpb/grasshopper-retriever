'use strict';
var crypto = require('crypto');

module.exports = function(stream, hash, cb){
  var shasum = crypto.createHash('sha256');

  stream.on('data', function(data){
    shasum.update(data);
  });

  stream.on('end', function(){
    var remoteHash = shasum.digest('hex');
    cb(remoteHash === hash);
  });
};
