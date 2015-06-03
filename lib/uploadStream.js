var aws = require('aws-sdk');
var autoAuth = require('aws-auto-auth');
var s3Stream = require('s3-upload-stream');

var bucket;
var S3;


function init(bkt, profile){
  autoAuth(aws, profile); 

  bucket = bkt; 
  S3 = new aws.S3();
  s3Stream = s3Stream(S3); 
  return S3;
}


function streamToBucket(stream, key, cb){
  console.log("Uploading to " + bucket + '.\n');

  var upload = s3Stream.upload({Bucket: bucket, Key: key});

  upload.on('error', function(err){
    console.log('Error piping to ' + bucket + '.\n');  
    stream.unpipe(upload);
    cb(err);
  });

  upload.on('uploaded', function(details){
    cb(null, details); 
  });

  stream.pipe(upload); 

  return upload;
}


module.exports = {
  init:init,
  stream:streamToBucket
};
