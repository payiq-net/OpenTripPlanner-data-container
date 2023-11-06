#!/bin/bash
#deploys data container from prepared data

#Set these environment variables
#DOCKER_USER // dockerhub credentials
#DOCKER_AUTH
set -e

ROUTER_NAME=${ROUTER_NAME:-hsl}
DATE=$(date +"%Y-%m-%dT%H.%M.%S")

ORG=${ORG:-hsldevcom}
DOCKER_TAG=${DOCKER_TAG:-v3}
CONTAINER=opentripplanner-data-container
DOCKER_IMAGE=$ORG/$CONTAINER-$ROUTER_NAME
DOCKER_TEST_IMAGE=$DOCKER_IMAGE:test

docker login -u $DOCKER_USER -p $DOCKER_AUTH

DOCKER_DATE_IMAGE=$DOCKER_IMAGE:$DOCKER_TAG-$DATE
DOCKER_IMAGE_TAGGED=$DOCKER_IMAGE:$DOCKER_TAG
docker tag $DOCKER_TEST_IMAGE $DOCKER_DATE_IMAGE
echo "*** Pushing $DOCKER_DATE_IMAGE"
docker push $DOCKER_DATE_IMAGE
docker tag $DOCKER_TEST_IMAGE $DOCKER_IMAGE_TAGGED
echo "*** Pushing $DOCKER_IMAGE_TAGGED"
docker push $DOCKER_IMAGE_TAGGED
