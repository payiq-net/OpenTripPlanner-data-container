#!/usr/bin/env bash
set -e

apt-get update && apt-get -y install git python3 python3-pip

rm -rf /var/lib/apt/lists/*

pip install future grequests numpy

ONEBUSAWAY_URL="http://nexus.onebusaway.org/service/local/artifact/maven/content?r=public&g=org.onebusaway&a=onebusaway-gtfs-transformer-cli&v=1.3.9"

mkdir -p one-busaway-gtfs-transformer && \
  wget -O one-busaway-gtfs-transformer/onebusaway-gtfs-transformer-cli.jar $ONEBUSAWAY_URL

git clone https://github.com/HSLdevcom/OTPQA.git && cd OTPQA && git checkout v3
