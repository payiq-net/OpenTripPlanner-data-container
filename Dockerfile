FROM docker:dind
MAINTAINER Digitransit version: 0.1

RUN apk add --update --no-cache bash curl nodejs nodejs-npm \
  && rm -rf /var/cache/apk/*

WORKDIR /opt/otp-data-builder

ADD . /opt/otp-data-builder/

RUN npm install

CMD ( dockerd-entrypoint.sh & ) && sleep 30 && unset DOCKER_HOST && node index.js
