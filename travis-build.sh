#!/bin/bash
set -e
# This is run at ci, created an image that contains all the tools needed in
# databuild

ORG=${ORG:-hsldevcom}
DOCKER_IMAGE=$ORG/otp-data-builder
DOCKER_TAG="latest"

if [ "$TRAVIS_TAG" ]; then
  DOCKER_TAG="prod"
elif [ "$TRAVIS_BRANCH" != "master" ]; then
  DOCKER_TAG=$TRAVIS_BRANCH
fi

DOCKER_TAG_LONG=$DOCKER_TAG-$(date +"%Y-%m-%dT%H.%M.%S")-${TRAVIS_COMMIT:0:7}
DOCKER_IMAGE_LATEST=$DOCKER_IMAGE:latest
DOCKER_IMAGE_TAG=$DOCKER_IMAGE:$DOCKER_TAG
DOCKER_IMAGE_TAG_LONG=$DOCKER_IMAGE:$DOCKER_TAG_LONG

### DOCKER_TAG="ci-${TRAVIS_COMMIT}"

# Set these environment variables
#DOCKER_USER=
#DOCKER_AUTH=

# Deprecated
function tagandpush {
  docker tag $ORG/$1:$3$DOCKER_TAG $ORG/$1:$2
  docker push $ORG/$1:$2
}

function imagedeploy {

  if [ "${TRAVIS_PULL_REQUEST}" == "false" ]; then
    docker login -u $DOCKER_USER -p $DOCKER_AUTH

    if [ "$TRAVIS_TAG" ];then
      echo "processing release $TRAVIS_TAG"
      docker pull $DOCKER_IMAGE_LATEST
      docker tag $DOCKER_IMAGE_LATEST $DOCKER_IMAGE_TAG
      docker tag $DOCKER_IMAGE_LATEST $DOCKER_IMAGE_TAG_LONG
      docker push $DOCKER_IMAGE_TAG
      docker push $DOCKER_IMAGE_TAG_LONG
      ###
      echo "processing master build $TRAVIS_COMMIT"
      #master branch, build and tag as latest
      docker build --tag="$ORG/$1:$DOCKER_TAG" .
      docker push $ORG/$1:$DOCKER_TAG
      tagandpush $1 "latest" ""
    else
      #echo "Pushing $DOCKER_TAG image"
      #docker push $DOCKER_IMAGE_TAG_LONG
      #docker tag $DOCKER_IMAGE_TAG_LONG $DOCKER_IMAGE_TAG
      #docker push $DOCKER_IMAGE_TAG
      ###
      echo "processing release $TRAVIS_TAG"
      #release do not rebuild, just tag
      docker pull $ORG/$1:$DOCKER_TAG
      tagandpush $1 "prod" ""
      tagandpush $1 "prod" ""
    fi
  fi

      else
        #check if branch is greenkeeper branch
        echo Not Pushing greenkeeper to docker hub
        exit 0


  if [ "$TRAVIS_PULL_REQUEST" = "false" ]; then

    docker login -u $DOCKER_USER -p $DOCKER_AUTH
    if [ "$TRAVIS_TAG" ];then
      echo "processing release $TRAVIS_TAG"
      #release do not rebuild, just tag
      docker pull $ORG/$1:$DOCKER_TAG
      tagandpush $1 "prod" ""
    else
      if [ "$TRAVIS_BRANCH" = "master" ]; then
        echo "processing master build $TRAVIS_COMMIT"
        #master branch, build and tag as latest
        docker build --tag="$ORG/$1:$DOCKER_TAG" .
        docker push $ORG/$1:$DOCKER_TAG
        tagandpush $1 "latest" ""
      elif [ "$TRAVIS_BRANCH" = "next" ]; then
        echo "processing master build $TRAVIS_COMMIT"
        #master branch, build and tag as latest
        docker build --tag="$ORG/$1:next-$DOCKER_TAG" .
        docker push $ORG/$1:next-$DOCKER_TAG
        tagandpush $1 "next" "next-"
      else
        #check if branch is greenkeeper branch
        echo Not Pushing greenkeeper to docker hub
        exit 0
      fi
    fi
  else
    echo "processing pr $TRAVIS_PULL_REQUEST"
    docker build --tag="$ORG/$1:$DOCKER_TAG" .
  fi
}

imagedeploy "otp-data-builder"

cd otp-data-tools

imagedeploy "otp-data-tools"

echo Build completed
