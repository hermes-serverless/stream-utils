#!/bin/bash
set -euo pipefail

display_info() {
  printf "Usage ./stressTest.sh [OPT]\nOptions are:\n"
  printf "  -t [number]: Define the running time\n"
  printf "  -f [fileToTest]: Define the file to test\n"
  exit 0
}

TOTALTIME=30
COMMAND="test"
while getopts "ht:f:" OPT; do
  case "$OPT" in
    "t") TOTALTIME=$OPTARG;;
    "f") COMMAND="jest $OPTARG --logHeapUsage";;
    "h") display_info;;
    "?") display_info;;
  esac 
done

printf "=== STRESS TEST FOR: %s SECONDS - Command: $COMMAND ===\n\n" "$TOTALTIME"

SECONDS=0

yarn $COMMAND
while [ "$?" == "0" ]; do
  printf "====== SECONDS: %s =======\n\n" "$SECONDS"
  if [ $SECONDS -gt $TOTALTIME ]; then
    exit 0
  fi
  yarn $COMMAND
done

printf "=== DONE STRESS ==="