#!/bin/bash
set +e

# set defaults
ORG=${ORG:-hsldevcom}
ROUTER_NAME=${ROUTER_NAME:-hsl}
DOCKER_IMAGE=$ORG/opentripplanner-data-container-$ROUTER_NAME:test

# remove old version (may be necessary in local use)
docker rmi --force $DOCKER_IMAGE &> /dev/null
cd data/build/$ROUTER_NAME
echo "Building data-container image..."
docker build -t $DOCKER_IMAGE -f Dockerfile.data-container .
