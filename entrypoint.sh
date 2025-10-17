#!/bin/sh
set -e
mkdir -p /home/node/.cache
cp -r -n /home/node/cache /home/node/.cache
exec "$@"
