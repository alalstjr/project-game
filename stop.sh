#!/bin/bash

cd "$(dirname "$0")"

echo "=== project-game 종료 ==="

stopped=0

# 서버 종료
if [ -f .server.pid ]; then
  PID=$(cat .server.pid)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "[서버] 종료 완료 (PID: $PID)"
  else
    echo "[서버] 이미 종료됨 (PID: $PID)"
  fi
  rm -f .server.pid
  stopped=1
fi

# 클라이언트 종료
if [ -f .client.pid ]; then
  PID=$(cat .client.pid)
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    echo "[클라이언트] 종료 완료 (PID: $PID)"
  else
    echo "[클라이언트] 이미 종료됨 (PID: $PID)"
  fi
  rm -f .client.pid
  stopped=1
fi

if [ $stopped -eq 0 ]; then
  echo "실행 중인 프로세스가 없습니다."
fi
