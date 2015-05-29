var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var hyperquest = require('hyperquest');
var unzip = require('unzip');
var csvToVrt = require('csv-to-vrt');

var zipReg = /.zip$/i;
var csvReg = /(?:txt|csv)$/i;
var restrictedReg = /\.\.|\//g;

//provide data file and output path
var data = JSON.parse(fs.readFileSync('maine.json'));

data.forEach(function(record){
  //Don't allow to traverse to other folders via data.json
  var name = record.name = record.name.replace(restrictedReg,'');
  var request = hyperquest(record.url);
  if(zipReg.test(record.url)){
    request.pipe(unzip.Extract({path: name}))
      .on('close', function(){
        var unzipped = path.join(name, record.file)
        if(csvReg.test(record.file)){
          csvToVrt(unzipped, record.sourceSrs, function(vrt){
            handleStream(spawnOgr(vrt), record);
          });
        }else{
          handleStream(spawnOgr(unzipped), record);
        }
      })
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

function handleStream(stream, record){
  var endfile = path.join('output', record.name + '.csv');
  stream.pipe(fs.createWriteStream(endfile));
}
