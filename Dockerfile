# Docker image for grasshopper-retriever
# Need to set AWS environment variables if fetching to a bucket
# Build with docker build -t hmda/retriever:0.1 .
# Run by calling ./docker-run.sh <image> <retriever args>
# Test by calling ./docker-test.sh <image>

FROM geodata/gdal:1.11.2
MAINTAINER Wyatt Pearsall <wyatt.pearsall@cfpb.gov>
USER root

RUN apt-get update && apt-get install -y curl git && \
    curl -sL https://deb.nodesource.com/setup_0.12 | sudo bash - && \
    apt-get install -y nodejs && \
    mkdir -p /usr/src/app

WORKDIR /usr/src/app
COPY . /usr/src/app

RUN useradd notroot && chown -R notroot /usr/src/app && chmod u+rwx /usr/src/app
RUN npm install

USER notroot

ENTRYPOINT ["./retriever.js"]

CMD ["--help"]
