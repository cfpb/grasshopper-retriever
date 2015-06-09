'use strict';
var aws = require('aws-sdk');
var autoAuth = require('aws-auto-auth');
var s3Stream = require('s3-upload-stream');


function UploadStream(bucket, profile){
  if(!bucket) throw new Error('Need to initialize uploadStream with an S3 bucket.');

  if(!(this instanceof UploadStream)) return new UploadStream(bucket, profile);

  this.credentials = autoAuth(aws, profile); 

  this.bucket = bucket;
  this.S3 = new aws.S3();
  this.s3Stream = s3Stream(this.S3); 
}


function streamToBucket(stream, key, cb){
  var upload = this.s3Stream.upload({Bucket: this.bucket, Key: key});

  upload.on('error', function(err){
    stream.unpipe(upload);
    cb(err);
  });

  upload.on('uploaded', function(details){
    cb(null, details); 
  });

  stream.pipe(upload); 

  return upload;
}


UploadStream.prototype.stream = streamToBucket;


module.exports = UploadStream;
