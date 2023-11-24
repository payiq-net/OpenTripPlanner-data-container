#!/bin/bash
set +e

# note that container linking below does not work in mac OSX.
# use docker --link parameter to attach OTPQA to running OTP container

# set defaults
ORG=${ORG:-hsldevcom}
JAVA_OPTS=${JAVA_OPTS:--Xmx12g}
ROUTER_NAME=${ROUTER_NAME:-hsl}
OTP_TAG=${OTP_TAG:-v2}
TOOLS_TAG=${TOOLS_TAG:-v3}

# set useful variables
DOCKER_IMAGE=$ORG/opentripplanner-data-container-$ROUTER_NAME:test
TOOL_IMAGE=$ORG/otp-data-tools:$TOOLS_TAG

DATACONT=otp-data-$ROUTER_NAME
OTPCONT=otp-$ROUTER_NAME
TOOLCONT=otp-data-tools

function shutdown() {
  echo shutting down
  docker stop $DATACONT
  docker stop $OTPCONT
  docker rm $TOOLCONT &> /dev/null
}

echo -e "\n##### Testing $DOCKER_IMAGE #####\n"

echo Starting data container...
docker run --rm --name $DATACONT $DOCKER_IMAGE &
sleep 10

echo Starting otp...

docker run --rm --name $OTPCONT -e ROUTER_NAME=$ROUTER_NAME -e JAVA_OPTS="$JAVA_OPTS" -e ROUTER_DATA_CONTAINER_URL=http://otp-data:8080/ --link $DATACONT:otp-data --mount type=bind,source=$(pwd)/logback-include-extensions.xml,target=/opt/opentripplanner/logback-include-extensions.xml $ORG/opentripplanner:$OTP_TAG &
sleep 10

echo Getting otp ip..
timeout=$(($(date +%s) + 480))
until IP=$(docker inspect --format '{{ .NetworkSettings.IPAddress }}' $OTPCONT) || [[ $(date +%s) -gt $timeout ]]; do sleep 1;done;

if [ "$IP" == "" ]; then
  echo Could not get ip. failing test
  shutdown
  exit 1
fi

echo Got otp ip: $IP

OTP_URL=http://$IP:8080/otp/routers/default

for (( c=1; c<=20; c++ ));do
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" $OTP_URL || true)

  if [ $STATUS_CODE = 200 ]; then
    echo OTP started
    curl -s $OTP_URL/index/graphql -H "Content-Type: application/graphql" --data "{agencies {name}}" |grep error
    if [ $? = 1 ]; then #grep finds no error
	echo OTP works
    break
    else
	echo OTP has errors
	shutdown
	exit 1
    fi
  else
    echo waiting for service
    sleep 30
  fi
done

echo running otpqa

docker pull $TOOL_IMAGE
docker run --name $TOOLCONT $TOOL_IMAGE /bin/sh -c "cd OTPQA; python3 otpprofiler_json.py $OTP_URL $ROUTER_NAME $SKIPPED_SITES"

if [ $? == 0 ]; then
  echo getting failed feed list from container
  docker cp $TOOLCONT:/OTPQA/failed_feeds.txt . &> /dev/null
  shutdown
  exit 0
else
  shutdown
  exit 1
fi
