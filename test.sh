#!/bin/bash
set +e

# set defaults
ORG=${ORG:-hsldevcom}
JAVA_OPTS=${JAVA_OPTS:--Xmx9g}
ROUTER_NAME=${1:-hsl}
TEST_TAG=${2:-latest}
TOOLS_TAG=${3:-latest}
SKIPPED_SITES="$4"
DOCKER_IMAGE=$ORG/opentripplanner-data-container-$ROUTER_NAME:test

function shutdown() {
  echo shutting down
  docker stop otp-data-$ROUTER_NAME || true
  docker stop otp-$ROUTER_NAME || true
}

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

if [ -n "$SKIPPED_SITES" ] && [ $SKIPPED_SITES == "all" ]; then
    echo "*** Skipping all tests"
    exit 0;
fi

echo -e "\n##### Testing $ROUTER_NAME ($DOCKER_IMAGE)#####\n"

echo "Starting data container..."
docker run --rm --name otp-data-$ROUTER_NAME $DOCKER_IMAGE > /dev/stdout &
sleep 120
echo "Starting otp..."
if [ -v TEST_TAG ] && [ "$TEST_TAG" != "undefined" ]; then
  docker run --rm --name otp-$ROUTER_NAME -e ROUTER_NAME=$ROUTER_NAME -e JAVA_OPTS=$"JAVA_OPTS" -e ROUTER_DATA_CONTAINER_URL=http://otp-data:8080/ --link otp-data-$ROUTER_NAME:otp-data $ORG/opentripplanner:$TEST_TAG > /dev/stdout &
  sleep 5
else
  docker run --rm --name otp-$ROUTER_NAME -e ROUTER_NAME=$ROUTER_NAME -e JAVA_OPTS=$"JAVA_OPTS" -e ROUTER_DATA_CONTAINER_URL=http://otp-data:8080/ --link otp-data-$ROUTER_NAME:otp-data $ORG/opentripplanner:latest > /dev/stdout &
  sleep 5
fi
echo "Getting otp ip.."
timeout=$(($(date +%s) + 480))
until IP=$(docker inspect --format '{{ .NetworkSettings.IPAddress }}' otp-$ROUTER_NAME) || [[ $(date +%s) -gt $timeout ]]; do sleep 1;done;

if [ "$IP" == "" ]; then
  echo "Could not get ip. failing test"
  shutdown
  exit 1
fi

echo "Got otp ip: $IP"

date=$(date '+%Y%m%d')

if [ "$ROUTER_NAME" == "hsl" ]; then
    MAX_WAIT=30
    URL="http://$IP:8080/otp/routers/default/plan?fromPlace=60.19812876015124%2C24.934051036834713&toPlace=60.218630210423306%2C24.807472229003906&date=${date}&time=14:00"
elif [ "$ROUTER_NAME" == "waltti" ]; then
    MAX_WAIT=60
    URL="http://$IP:8080/otp/routers/default/plan?fromPlace=60.44638185995603%2C22.244396209716797&toPlace=60.45053041945487%2C22.313575744628906&date=${date}&time=14:00"
elif [ "$ROUTER_NAME" == "waltti-alt" ]; then
    MAX_WAIT=60
    URL="http://$IP:8080/otp/routers/default/plan?fromPlace=60.36627023055039%2C23.1210708618164&toPlace=60.40639308599%2C23.185958862&date=${date}&time=14:00"
elif [ "$ROUTER_NAME" == "varely" ]; then
    MAX_WAIT=60
    URL="http://$IP:8080/otp/routers/default/plan?fromPlace=60.629165131895085%2C22.05413103103638&toPlace=60.44274085084863%2C22.288684844970703&date=${date}&time=14:00"
else
    MAX_WAIT=60
    URL="http://$IP:8080/otp/routers/default/plan?fromPlace=60.19812876015124%2C24.934051036834713&toPlace=60.218630210423306%2C24.807472229003906&date=${date}&time=14:00"
fi

ITERATIONS=$(($MAX_WAIT * 6))
echo "max wait (minutes): $MAX_WAIT"

for (( c=1; c<=$ITERATIONS; c++ ));do
  STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$IP:8080/otp/routers/default || true)

  if [ $STATUS_CODE = 200 ]; then
    echo "OTP started"
    curl -s "$URL"|grep error
    if [ $? = 1 ]; then #grep finds no error
	echo "OK"
    break
    else
	echo "ERROR"
	shutdown
	exit 1;
    fi
  else
    echo "waiting for service"
    sleep 10
  fi
done

echo "running otpqa"
docker pull $ORG/otp-data-tools:$TOOLS_TAG
docker run --rm --name otp-data-tools $ORG/otp-data-tools:$TOOLS_TAG /bin/sh -c "cd OTPQA; python otpprofiler_json.py http://$IP:8080/otp/routers/default $ROUTER_NAME $SKIPPED_SITES"
if [ $? == 0 ]; then
  echo "OK"
  shutdown
  exit 0;
else
  echo "ERROR"
  shutdown
  exit 1;
fi

shutdown
exit 1;
