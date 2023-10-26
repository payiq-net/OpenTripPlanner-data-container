#!/bin/bash
set +e

# set defaults
ORG=${ORG:-hsldevcom}
ROUTER_NAME=${ROUTER_NAME:-hsl}
DOCKER_IMAGE=$ORG/opentripplanner-data-container-$ROUTER_NAME:test

echo "Making sure there are no old test containers or image available"
docker stop otp-data-finland || true
docker stop otp-finland || true
docker stop otp-data-waltti || true
docker stop otp-waltti || true
docker stop otp-data-hsl || true
docker stop otp-hsl || true
docker stop otp-data-waltti-alt || true
docker stop otp-waltti-alt || true
docker stop otp-data-varely || true
docker stop otp-varely || true
docker stop otp-data-kela || true
docker stop otp-kela || true
docker rmi --force $DOCKER_IMAGE || true
cd data/build/$ROUTER_NAME
echo "Building data-container image..."
docker build -t $DOCKER_IMAGE -f Dockerfile.data-container .
