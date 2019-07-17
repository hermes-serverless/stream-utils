#!/bin/bash
set -euo pipefail

display_info() {
  printf "Usage ./stressTest.sh [OPT]\nOptions are:\n"
  printf "  -t [number]: Define the running time\n"
  printf "  -f [fileToTest]: Define the file to test\n"
  exit 0
}

TOTALTIME=30
FILE_OPT=""
while getopts "ht:f:" OPT; do
  case "$OPT" in
    "t") TOTALTIME=$OPTARG;;
    "f") FILE_OPT="-f $OPTARG";;
    "h") display_info;;
    "?") display_info;;
  esac 
done

IMAGE_NAME="stream-utils-container-test"
docker build -t $IMAGE_NAME .
printf "\n\n"
docker run -it $IMAGE_NAME ./stressTest.sh -t $TOTALTIME $FILE_OPT
