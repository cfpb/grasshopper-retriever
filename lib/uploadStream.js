var aws = require('aws-sdk');
var autoAuth = require('awsAutoAuth');

var bucket;
var S3;


function init(bkt, profile){
  autoAuth(aws, profile); 

  bucket = bkt; 
  S3 = new aws.S3();

  return S3;
}


function streamToBucket(stream, key, cb){
  return S3.putObject({Bucket: bucket, Key: key, Body: stream}, cb);
}


module.exports = {
  init:init,
  stream:streamToBucket
};
