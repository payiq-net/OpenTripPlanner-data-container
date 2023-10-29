#!/bin/bash
set +e

# set defaults
ORG=${ORG:-hsldevcom}
JAVA_OPTS=${JAVA_OPTS:--Xmx12g}
ROUTER_NAME=${ROUTER_NAME:-hsl}
OTP_TAG=${OTP_TAG:-v2}
TOOLS_TAG=${TOOLS_TAG:-test}
DOCKER_IMAGE=$ORG/opentripplanner-data-container-$ROUTER_NAME:test
TOOL_IMAGE=$ORG/otp-data-tools:$TOOLS_TAG

function shutdown() {
  echo shutting down
  docker stop otp-data-$ROUTER_NAME || true
  docker stop otp-$ROUTER_NAME || true
  docker rm otp-data-tools || true &> /dev/null
}

echo -e "\n##### Testing $DOCKER_IMAGE #####\n"

echo Starting data container...
docker run --rm --name otp-data-$ROUTER_NAME $DOCKER_IMAGE > /dev/stdout &
sleep 10

echo Starting otp...

docker run --rm --name otp-$ROUTER_NAME -p 9080:8080 -e ROUTER_NAME=$ROUTER_NAME -e JAVA_OPTS="$JAVA_OPTS" -e ROUTER_DATA_CONTAINER_URL=http://otp-data:8080/ --link otp-data-$ROUTER_NAME:otp-data --mount type=bind,source=$(pwd)/logback-include-extensions.xml,target=/opt/opentripplanner/logback-include-extensions.xml $ORG/opentripplanner:$OTP_TAG > /dev/stdout &> /dev/null &
sleep 20

echo Getting otp ip..
timeout=$(($(date +%s) + 480))
until IP=$(docker inspect --format '{{ .NetworkSettings.IPAddress }}' otp-$ROUTER_NAME) || [[ $(date +%s) -gt $timeout ]]; do sleep 1;done;

if [ "$IP" == "" ]; then
  echo Could not get ip. failing test
  shutdown
  exit 1
fi

echo Got otp ip: $IP

# OTP_URL=http://$IP:8080/otp/routers/default
OTP_URL=http://localhost:9080/otp/routers/default

for (( c=1; c<=10; c++ ));do
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
    sleep 20
  fi
done

echo running otpqa

#docker pull $TOOL_IMAGE
docker run --name otp-data-tools --link otp-$ROUTER_NAME:otphost $TOOL_IMAGE /bin/sh -c "cd OTPQA; python otpprofiler_json.py http://otphost:8080/otp/routers/default $ROUTER_NAME $SKIPPED_SITES"

if [ $? == 0 ]; then
  echo getting feed log from container
  docker cp otp-data-tools:/OTPQA/failed_feeds.txt . &> /dev/null
  shutdown
  exit 0
else
  shutdown
  exit 1
fi


