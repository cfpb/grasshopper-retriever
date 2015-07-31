# Grasshopper Retriever

Fetches public address data for use by the [grasshopper-loader](https://github.com/cfpb/grasshopper-loader).

## Dependencies
 - [node](https://nodejs.org/) 
 - [GDAL 1.11.2](http://www.gdal.org/)
 - [Docker](https://www.docker.com/)
   - Optional, removes need for preinstalled node and GDAL

## Installation
 - Clone the repo

#### Local installation
 - Install GDAL 1.11.2
 - Install node 0.12.x
 - `npm install`

#### Dockerized installation 
 - `docker build --rm --tag=<your-image:your-tag> .`

##### OR
 - `docker pull hmda/retriever:0.3`

## Usage
The retriever is a command-line application that can be used in the following ways:

#### Local Usage
Run `./retriever.js` with the following options:

 - **-f, --file** *Required* The metadata file that contains data source informatation. See `data.json` for example schemas.
 - **-b, --bucket** An AWS S3 bucket where the data should be loaded after retrieval. 
 - **-d, --directory** The directory relative to the current directory or an S3 bucket's root, where data should be deposited. If neither a bucket not a directory is provided, the retriever will check for file changes but will not load them anywhere. This is useful for monitoring endpoints via a scheduler. If a bucket is provided with no directory, data will be loaded to the bucket's root.
 - **-p, --profile** *Default: default* The aws credentials profile in ~/.aws/credentials to use. Environment variables will override this option.
 - **-m, --match** A string or regex that `names` from the metafile must match in order to be retrieved.
 - **-q, --quiet** *Default: false* Suppresses logging. Useful for automated error testing without polluting logs.

#### Dockerized Usage
- Run `./docker-run.sh <image-name:tag-name> <rest.. of.. args.. from.. above>`
- The shell script is used to automatically set up a volume containing your `~/.aws/credentials` file

## Testing

#### Local testing
 - `npm test`

#### Dockerized testing
 - `./docker-test.sh <image-name:tag-name>`

----

## Open source licensing info
1. [TERMS](TERMS.md)
2. [LICENSE](LICENSE)
3. [CFPB Source Code Policy](https://github.com/cfpb/source-code-policy/)

----
