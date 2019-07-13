#!/bin/bash

set -euo pipefail

display_info() {
  printf "Usage ./generateTestFile.sh [OPT] filePath fileSize\nOptions are:\n"
  printf "  -z: Use /dev/zero\n"
  exit 0
}

STREAM_SOURCE="/dev/urandom"
VERBOSE="false"
while getopts "zh" OPT; do
  case "$OPT" in
    "z") STREAM_SOURCE="/dev/zero";;
    "v") VERBOSE="true";;
    "h") display_info;;
    "?") display_info;;
  esac 
done

shift $((OPTIND - 1)) 
FILE_PATH=$1
FILE_SIZE=$2

mkdir -p "$( dirname $FILE_PATH )"

if [ "$VERBOSE" == "true" ]; then
  printf "Generate %s - %s MB from %s\n" "$1" "$( echo "print($2/1000)" | python3 )" "$STREAM_SOURCE"
  dd if="$STREAM_SOURCE" of="$FILE_PATH" bs=1000 count="$FILE_SIZE" status=progress
  printf "DONE\n\n"
else
  dd if="$STREAM_SOURCE" of="$FILE_PATH" bs=1000 count="$FILE_SIZE" status=none
fi




