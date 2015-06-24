#!/usr/bin/env bash
#Ubuntu installation
sudo apt-get update -q
sudo apt-get -y install python-software-properties g++ build-essential git curl

curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash -
apt-get install -y nodejs

curl http://download.osgeo.org/gdal/1.11.2/gdal-1.11.2.tar.gz | tar xz 
cd gdal-1.11.2
./configure && make && sudo make install
sudo ldconfig
cd ..

curl http://download.osgeo.org/proj/proj-4.9.1.tar.gz | tar xz 
cd proj-4.9.1
./configure && make && sudo make install
sudo ldconfig
cd ..

