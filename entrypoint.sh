#!/bin/sh
set -e
cp -a /home/node/cache /home/node/.cache
exec "$@"
