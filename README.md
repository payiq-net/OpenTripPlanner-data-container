# Build process for OpenTripPlanner-data-container

[![Build](https://github.com/hsldevcom/OpenTripPlanner-data-container/workflows/Process%20master%20push%20or%20pr/badge.svg?branch=master)](https://github.com/HSLdevcom/OpenTripPlanner-data-container/actions)

## This project:
Contains tools for fetching, building and deploying fresh otp data-containers
for consumption by hsl, waltti, waltti-alt and finland otp instances. This project can be
reused for building data for other otp instances but it is only tested to
work for the aforementioned otp instances. This is used for OTP
version 2.x.

## Main components

### otp-data-builder
The actual data builder application. This is a node.js application that fetches
and processes new gtfs/osm data. It's build around gulp and all separate steps of
databuilding process can also be called directly from the source tree. The only
required external dependency is docker. Docker is used for launching external
commands that do for example data manipulation.

install gulp cli:
  `npm install -g gulp-cli`

install app deps:
  `npm install`

update osm data:
  `gulp osm:update`

download new gtfs data for waltti:
  `ROUTER_NAME=waltti gulp gtfs:dl`

#### Configuration
It is possible to change the behaviour of the data builder by defining environment variables.

* "ROUTER_NAME" defines which data container will be built and deployed.
* "DOCKER_USER" defines username for authenticating to docker hub.
* "DOCKER_AUTH" defines password for authenticating to docker hub.
* (Optional, default latest and tag based on date) "DOCKER_TAG" defines what will be the updated docker tag of the data container images in the remote container registry.
* (Optional, default hsldevcom) "ORG" defines what organization images belong to in the remote container registry.
* (Optional, default v3) "SEED_TAG" defines what version of data container should be used for seeding.
* (Optional, default v2) "OTP_TAG" defines what version of OTP is used for testing and building graphs.
* (Optional, default v3) "TOOLS_TAG" defines what version of otp-data-tools image is used for testing.
* (Optional) "CRON" defines cronjob pattern when data build is being run. Uses local time.
* (Optional, default dev) "BUILDER_TYPE" used as a postfix to slack bot name
* (Optional) "SLACK_CHANNEL_ID" defines to which slack channel the messages are sent to
* (Optional) "SLACK_ACCESS_TOKEN" bearer token for slack messaging
* (Optional, default {}) "EXTRA_SRC" defines gtfs src values that should be overridden or completely new src that should be added with unique id. "routers" is always a mandatory field. Example format:
  - `{"FOLI": {"url": "http://data.foli.fi/gtfs/gtfs.zip",  "fit": false, "rules": ["router-waltti/gtfs-rules/waltti.rule"], "routers": ["hsl", "finland"]}}`
  - You can remove a src by including "remove": true, `{"FOLI": {"remove": true, "routers": ["hsl"]}`
* (Optional, default {}) "EXTRA_UPDATERS" defines router-config.json updater values that should be overridden or completely new updater that should be added with unique id. "routers" is always a mandatory field. Example format:
  - `{"turku-alerts": {"type": "real-time-alerts", "frequencySec": 30, "url": "https://foli-beta.nanona.fi/gtfs-rt/reittiopas", "feedId": "FOLI", "fuzzyTripMatching": true, "routers": ["waltti"]}}`
  - You can remove a src by including "remove": true, `{"turku-alerts": {"remove": true, "routers": ["waltti"]}`
* (Optional) "VERSION_CHECK" is a comma-separated list of feedIds from which the GTFS data's `feed_info.txt`'s file's `feed_version` field is parsed into a date object and it's checked if the data has been updated within the last 8 hours. If not, a message is sent to stdout (and slack, only monday-friday) to inform about usage of "old" data.
* (Optional) "SKIPPED_SITES" defines a comma-separated list of sites from OTPQA tests that should be skipped. Example format:
  - `"turku.digitransit.fi,reittiopas.hsl.fi"`
* (Optional) "DISABLE_BLOB_VALIDATION" should be included if blob (OSM) validation should be disabled temporarily.
* (Optional) "NOSEED" should be included (together with DISABLE_BLOB_VALIDATION) when data loading for a new configuration is run first time and no seed image is available.
* (Optional) "JAVA_OPTS" Java parameters for running OTP

#### Data processing steps

Seed data can be retrieved with a single gulp command:

1. seed

Downloads previous data container (env variable SEED_TAG can be used to customize which tag is pulled)
and extracts osm, dem and gtfs data from there and places it in 'data/seed' and 'data/ready' directories.
Old data acts as backup in case fetching/validating new data fails.

2. osm:update

This command downloads required OSM packages from configured location, tests the file(s) with otp,
and if tests pass data is copied to 'data/downloads/osm' directory.

The data is then processed with the following steps:

3. gtfs:dl
Downloads a GTFS package from configured location, tests the file with otp, if
test passes data is copied to directory 'data/fit/gtfs'. The resulting zip is named <feedid>.zip.

4. gtfs:fit
Runs configured map fits. Copies data to directory 'data/filter/gtfs'.

5. gtfs:filter
Runs configured filterings. Copies data to directory 'data/id/gtfs'.

6. gtfs:id
Sets the gtfs feed id to <id> and copies data to directory 'data/ready/gtfs'.


Steps 2. - 6. can also be run together using a single gtfs:update command.

Building the router from available (seeded or downloaded and processed) data:

7. router:buildGraph

Prebuilds graph with either current latest version or user defined version (with env variable OTP_TAG) of OTP and creates zip files
ready for building the otp-data container.


The final step is router deployment:

8. deploy.sh

Builds a data container, starts it, starts either latest or user defined version (with env variable OTP_TAG) of otp and runs
routing tests (otp-data-tools latest image is used for it by default, TOOLS_TAG env variable can be used to change that)
to verify that the data container looks ok. If tests pass the fresh data container is pushed to Dockerhub.

Normally when the application is running (as a container) the index.js is used.
It runs the data updating process on a schedule specified as a cron pattern. Data build can be executed immediately
by attaching to the builder container with bash 'docker exec -i -t <dockerid> /bin/bash' and then
exexuting the command 'node index.js'. The end result of the build is 2 docker containers uploaded into dockerhub.
Digitransit-deployer detects the changes and restarts OTP instances, so that new data becomes in use.

Each data container image runs a http server listening to port 8080, serving both a gtfs data bundle and a pre-built graph:

- hsl: http://localhost:8080/router-hsl.zip and graph-hsl-<otpversion>.zip
- waltti: http://localhost:8080/router-waltti.zip and graph-waltti-<otpversion>.zip
- finland: http://localhost:8080/router-finland.zip and graph-finland-<otpversion>.zip
- waltti-alt: http://localhost:8080/router-waltti-alt.zip and graph-waltti-alt-<otpversion>.zip

### otp-data-tools

Contains tools for gtfs manipulation, such as One Bus Away gtfs filter.
These tools are packaged inside docker container and are used during the data build process.
