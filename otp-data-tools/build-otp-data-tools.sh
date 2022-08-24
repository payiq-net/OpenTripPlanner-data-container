#!/usr/bin/env bash

# This script is run inside the otp-data-tools container.

# import die_with_error
source ./reporting-functions.sh

set +e

# shellcheck disable=2015
apt-get update && \
  apt-get -y install \
    git build-essential python-dev protobuf-compiler libprotobuf-dev \
    make swig g++ python-dev libreadosm-dev \
    libboost-graph-dev libproj-dev libgoogle-perftools-dev \
    osmctools unzip zip python-pyproj wget python-argh \
    python-scipy python-sklearn python-pip python-numpy curl || die_with_error "apt-get update failed"

rm -rf /var/lib/apt/lists/*

# shellcheck disable=2015
wget https://bootstrap.pypa.io/pip/2.7/get-pip.py && \
  python get-pip.py && \
  pip install imposm.parser && \
  pip install argh && \
  pip install future && \
  pip install grequests && \
  pip install unicodecsv && \
  pip install cffi && \
  pip install utm || die_with_error "installation of python packages failed"

ONEBUSAWAY_URL="http://nexus.onebusaway.org/service/local/artifact/maven/content?r=public&g=org.onebusaway&a=onebusaway-gtfs-transformer-cli&v=1.3.9"

# shellcheck disable=2015
mkdir -p one-busaway-gtfs-transformer && \
  wget -O one-busaway-gtfs-transformer/onebusaway-gtfs-transformer-cli.jar $ONEBUSAWAY_URL || die_with_error "onebusaway-gtfs-transformer-cli fetch failed"

# shellcheck disable=2015
git clone https://github.com/jswhit/pyproj.git && \
  cd pyproj && \
  git checkout ec9151e8c6909f7fac72bb2eab927ff18fa4cf1d && \
  python setup.py build && \
  python setup.py install || die_with_error "pyproj build failed"
cd ..

# shellcheck disable=2015
git clone --recursive -b fastmapmatch https://github.com/HSLdevcom/gtfs_shape_mapfit.git && \
  cd gtfs_shape_mapfit && \
  make -C pymapmatch || die_with_error "installation of gtfs_shape_mapfit failed"
cd ..

# shellcheck disable=2015
git clone https://github.com/HSLdevcom/OTPQA.git && \
  cd OTPQA && \
  git checkout v3 || die_with_error "installation of OTPQA update failed"
cd ..
