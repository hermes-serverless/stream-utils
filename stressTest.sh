#!/bin/bash
set -euo pipefail

display_info() {
  printf "Usage ./stressTest.sh [OPT]\nOptions are:\n"
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

printf "=== STRESS TEST FOR: %s SECONDS ===\n\n" "$TOTALTIME"

SECONDS=0

yarn test
while [ "$?" == "0" ]; do
  printf "====== SECONDS: %s =======\n\n" "$SECONDS"
  if [ $SECONDS -gt $TOTALTIME ]; then
    exit 0
  fi
  yarn test
done

printf "=== DONE STRESS ==="