#!/bin/sh
set -e

mkdir -m 0777 -p /data/db /data/downloads /data/tmp

exec su -s /bin/sh -c "exec $*" youbox -- "$@"
