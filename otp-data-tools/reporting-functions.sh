#!/usr/bin/env bash

post_slack_message () {
  MSG="$1"

  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    >&2 echo "Environment variable SLACK_WEBHOOK_URL missing. Not sending to slack: $MSG"
    return 1
  fi

  echo "Sending to slack: $MSG"
  SLACK_MSG='{"text":"'"$MSG"'","username":"OTP data builder '"${BUILDER_TYPE:-dev}"'","channel":"'"${SLACK_CHANNEL:-topic-ci}"'"}'

  if [ ! "$(curl -X POST -H 'Content-type: application/json' --data "$SLACK_MSG" "$SLACK_WEBHOOK_URL")" ]; then
    >&2 echo "Not sending to slack: $MSG"
    return 1
  fi
}

die_with_error () {
    post_slack_message "$1 :boom:"
    exit 1
}
