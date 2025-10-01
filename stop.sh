#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 앱 이름 출력
echo -e "${BLUE}"
echo "╔══════════════════════════════════════╗"
echo "║        📚 영단어 암기장 종료         ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# 종료할 포트 목록
BACKEND_PORT=5001
FRONTEND_PORT=3000

# 함수: 특정 포트를 사용하는 프로세스 종료
kill_port_process() {
    local PORT=$1
    local SERVICE_NAME=$2

    # 포트를 사용하는 프로세스 찾기
    local PID=$(lsof -ti:$PORT 2>/dev/null)

    if [ ! -z "$PID" ]; then
        echo -e "${YELLOW}🔍 $SERVICE_NAME (포트 $PORT) 프로세스 발견 (PID: $PID)${NC}"

        # 프로세스 종료
        kill -TERM $PID 2>/dev/null

        # 잠시 대기
        sleep 1

        # 프로세스가 아직 살아있으면 강제 종료
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  정상 종료 실패, 강제 종료 시도...${NC}"
            kill -9 $PID 2>/dev/null
        fi

        echo -e "${GREEN}✅ $SERVICE_NAME 종료 완료${NC}"
    else
        echo -e "${BLUE}ℹ️  $SERVICE_NAME (포트 $PORT)는 실행 중이 아닙니다${NC}"
    fi
}

# Node 프로세스 확인 및 종료
echo -e "${BLUE}📋 실행 중인 서버를 확인합니다...${NC}"
echo ""

# 백엔드 서버 종료
kill_port_process $BACKEND_PORT "백엔드 서버"

# 프론트엔드 서버 종료
kill_port_process $FRONTEND_PORT "프론트엔드 서버"

# React 개발 서버 관련 추가 프로세스 정리
echo ""
echo -e "${YELLOW}🧹 React 관련 프로세스 정리 중...${NC}"

# react-scripts 프로세스 찾아서 종료
REACT_PIDS=$(ps aux | grep -E "react-scripts|webpack-dev-server" | grep -v grep | awk '{print $2}')
if [ ! -z "$REACT_PIDS" ]; then
    for PID in $REACT_PIDS; do
        kill -TERM $PID 2>/dev/null
        echo -e "${GREEN}✅ React 프로세스 종료 (PID: $PID)${NC}"
    done
fi

# vocabulary-app 관련 Node 프로세스 정리
NODE_PIDS=$(ps aux | grep "vocabulary-app" | grep node | grep -v grep | awk '{print $2}')
if [ ! -z "$NODE_PIDS" ]; then
    for PID in $NODE_PIDS; do
        kill -TERM $PID 2>/dev/null
        echo -e "${GREEN}✅ Node 프로세스 종료 (PID: $PID)${NC}"
    done
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ 모든 서버가 종료되었습니다!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""

# 포트 상태 최종 확인
echo -e "${BLUE}📊 포트 상태 확인:${NC}"

if lsof -ti:$BACKEND_PORT >/dev/null 2>&1; then
    echo -e "${RED}⚠️  백엔드 포트 $BACKEND_PORT가 아직 사용 중입니다${NC}"
else
    echo -e "${GREEN}✅ 백엔드 포트 $BACKEND_PORT 사용 가능${NC}"
fi

if lsof -ti:$FRONTEND_PORT >/dev/null 2>&1; then
    echo -e "${RED}⚠️  프론트엔드 포트 $FRONTEND_PORT가 아직 사용 중입니다${NC}"
else
    echo -e "${GREEN}✅ 프론트엔드 포트 $FRONTEND_PORT 사용 가능${NC}"
fi

echo ""
echo -e "${BLUE}💡 다시 시작하려면 './start.sh'를 실행하세요${NC}"