#!/usr/bin/env bash
image="$1"
# get rest parameters
shift

docker run --rm\
  -e "AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID"\
  -e "AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY"\
  "$image"\
  "$@"
