#!/bin/bash

cd "$(dirname "$0")"

echo "=== project-game 시작 ==="

# 이미 실행 중인지 확인
if [ -f .server.pid ] || [ -f .client.pid ]; then
  echo "이미 실행 중인 프로세스가 있습니다. 먼저 ./stop.sh 를 실행하세요."
  exit 1
fi

# 서버 시작 (백그라운드)
npm run dev -w server > server.log 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > .server.pid
echo "[서버] 시작 완료 (PID: $SERVER_PID) - http://localhost:3001"

# 클라이언트 시작 (백그라운드)
npm run dev -w client > client.log 2>&1 &
CLIENT_PID=$!
echo "$CLIENT_PID" > .client.pid
echo "[클라이언트] 시작 완료 (PID: $CLIENT_PID) - http://localhost:5173"

echo ""
echo "로그 확인:"
echo "  서버:     tail -f server.log"
echo "  클라이언트: tail -f client.log"
