#!/bin/sh
# Rebuilds the server binaries that the Umbrel containers run.
# Run this after changing any server/*.go file, then commit the bin/ folders.
set -e
cd "$(dirname "$0")"
for app in adm-esszencia:esszencia-site adm-esszencia-foglalasok:esszencia-foglalasok; do
  dir=${app%%:*}; name=${app##*:}
  mkdir -p "$dir/server/bin"
  for arch in amd64 arm64; do
    (cd "$dir/server" && CGO_ENABLED=0 GOOS=linux GOARCH=$arch GOTOOLCHAIN=local \
      go build -buildvcs=false -trimpath -ldflags="-s -w" -o "bin/$name-$arch" .)
    echo "built $dir/server/bin/$name-$arch"
  done
done
