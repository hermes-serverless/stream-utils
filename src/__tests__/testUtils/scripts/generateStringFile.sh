#!/bin/bash

set -euo pipefail

display_info() {
  printf "Usage ./generateTestFile.sh [OPT] filePath String\nOptions are:\n"
  printf "  -r [number]: Define the number of repeats\n"
  exit 0
}

REPEATS=1
VERBOSE="false"
while getopts "hr:" OPT; do
  case "$OPT" in
    "r") REPEATS=$OPTARG;;
    "v") VERBOSE="true";;
    "h") display_info;;
    "?") display_info;;
  esac 
done

shift $((OPTIND - 1)) 
FILE_PATH=$1
STRING=$2

mkdir -p "$( dirname $FILE_PATH )"
SCRIPT=$(readlink -f $0)
SCRIPTPATH=`dirname $SCRIPT`
PYTHONSCRIPT="$SCRIPTPATH/generateRepeatedString.py"

if [ "$VERBOSE" == "true" ]; then
  printf "Generate string file with '%s' repeated %s times: %s\n" "$STRING" "$REPEATS" "$FILE_PATH"
fi

printf "$STRING\n$REPEATS" | $PYTHONSCRIPT > "$FILE_PATH"







