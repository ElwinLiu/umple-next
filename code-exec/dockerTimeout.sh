#!/bin/bash

set -e

to=$1
shift

cont=$(docker run --cpus=0.5 --memory=150m -d "$@")

cleanup() {
    docker rm -f "$cont" >/dev/null 2>&1 || true
}

trap cleanup EXIT

code=$(timeout "$to" docker wait "$cont" || true)
echo -n 'status: '
if [ -z "$code" ]; then
    docker kill "$cont" >/dev/null 2>&1 || true
    echo timeout
else
    echo exited: $code
fi

echo output:
# pipe to sed simply for pretty nice indentation
docker logs "$cont" | sed 's/^/\t/'

trap - EXIT
cleanup
