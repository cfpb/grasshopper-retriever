FROM node:0.12
MAINTAINER Wyatt Pearsall <wyatt.pearsall@cfpb.gov>

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN useradd notroot && chown -R notroot /usr/src/app && chmod u+rwx /usr/src/app

COPY . /usr/src/app
RUN npm install

USER notroot

ENTRYPOINT ["./retriever.js"]

CMD ["--help"]
