#!/bin/bash
set -euo pipefail

display_info() {
  printf "Usage ./containerTest.sh [OPT]\nOptions are:\n"
  printf "  -t [number]: Define the running time\n"
  exit 0
}

TOTALTIME=30
while getopts "ht:" OPT; do
  case "$OPT" in
    "t") TOTALTIME=$OPTARG;;
    "h") display_info;;
    "?") display_info;;
  esac 
done

IMAGE_NAME="stream-utils-container-test"
docker build -t $IMAGE_NAME .
printf "\n\n"
docker run -it $IMAGE_NAME ./stressTest.sh -t $TOTALTIME
