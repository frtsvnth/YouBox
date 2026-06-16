#!/bin/sh
set -e

mkdir -p /data/db /data/downloads /data/tmp
chown -R youbox:youbox /data

exec su -s /bin/sh -c "exec $*" youbox -- "$@"
