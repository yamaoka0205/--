#!/usr/bin/env bash
# Start DynamoDB Local on port 8000 (in-memory, sharedDb).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.dynamodb-local"
PORT="${DYNAMODB_LOCAL_PORT:-8000}"

if [[ ! -f "$DIR/DynamoDBLocal.jar" ]]; then
  mkdir -p "$DIR"
  curl -fsSL -o /tmp/dynamodb_local_latest.tar.gz \
    https://d1ni2b6xgvw0s0.cloudfront.net/v2.x/dynamodb_local_latest.tar.gz
  tar -xzf /tmp/dynamodb_local_latest.tar.gz -C "$DIR"
  rm -f /tmp/dynamodb_local_latest.tar.gz
fi

cd "$DIR"
exec java -Djava.library.path=./DynamoDBLocal_lib \
  -jar DynamoDBLocal.jar -sharedDb -inMemory -port "$PORT"
