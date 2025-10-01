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
echo "║        📚 영단어 암기장 앱           ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}"

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}📍 작업 디렉토리: $SCRIPT_DIR${NC}"
echo ""

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js가 설치되어 있지 않습니다.${NC}"
    echo "Node.js를 먼저 설치해주세요: https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 버전: $(node -v)${NC}"

# npm 설치 확인
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm이 설치되어 있지 않습니다.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm 버전: $(npm -v)${NC}"
echo ""

# 백엔드 의존성 설치
echo -e "${BLUE}📦 백엔드 패키지 설치 중...${NC}"
cd backend

if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 백엔드 패키지 설치 실패${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ 백엔드 패키지 설치 완료${NC}"
else
    echo -e "${GREEN}✅ 백엔드 패키지 이미 설치됨${NC}"
fi

# 백엔드 서버 시작
echo -e "${BLUE}🚀 백엔드 서버 시작 중...${NC}"
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!

# 백엔드 서버가 시작될 때까지 대기
sleep 2

# 백엔드 서버 상태 확인
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✅ 백엔드 서버 실행 중 (PID: $BACKEND_PID)${NC}"
    echo -e "${GREEN}   주소: http://localhost:5001${NC}"
else
    echo -e "${RED}❌ 백엔드 서버 시작 실패${NC}"
    echo "로그 확인: cat backend.log"
    exit 1
fi

cd ..

# 프론트엔드 의존성 설치
echo ""
echo -e "${BLUE}📦 프론트엔드 패키지 설치 중...${NC}"
cd frontend

if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 프론트엔드 패키지 설치 실패${NC}"
        # 백엔드 서버 종료
        kill $BACKEND_PID
        exit 1
    fi
    echo -e "${GREEN}✅ 프론트엔드 패키지 설치 완료${NC}"
else
    echo -e "${GREEN}✅ 프론트엔드 패키지 이미 설치됨${NC}"
fi

# 성공 메시지
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ 모든 준비가 완료되었습니다!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📱 프론트엔드 서버를 시작합니다...${NC}"
echo -e "${YELLOW}   브라우저가 자동으로 열립니다.${NC}"
echo ""
echo -e "${BLUE}종료하려면 Ctrl+C를 누르거나 stop.sh를 실행하세요.${NC}"
echo ""

# 종료 시그널 처리
trap "echo -e '\n${YELLOW}앱을 종료합니다...${NC}'; kill $BACKEND_PID 2>/dev/null; exit" INT TERM

# 프론트엔드 서버 시작
BROWSER=open npm start

# 백엔드 서버 종료
kill $BACKEND_PID 2>/dev/null