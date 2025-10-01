const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;
const EXCEL_FILE = 'vocabulary.xlsx';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// 엑셀 파일 초기화
function initExcelFile() {
    if (!fs.existsSync(EXCEL_FILE)) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['단어', '한국어 뜻', '암기법 추천', '예문', '예문 해석', '날짜']
        ]);

        // 컬럼 너비 설정
        ws['!cols'] = [
            { wch: 20 },  // A: 단어
            { wch: 30 },  // B: 한국어 뜻
            { wch: 40 },  // C: 암기법
            { wch: 50 },  // D: 예문
            { wch: 50 },  // E: 예문 해석
            { wch: 12 }   // F: 날짜
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Vocabulary');
        XLSX.writeFile(wb, EXCEL_FILE);
        console.log('✅ vocabulary.xlsx 파일이 생성되었습니다.');
    }
}

// 엑셀 파일 읽기
function readExcelFile() {
    try {
        const workbook = XLSX.readFile(EXCEL_FILE);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        return { workbook, worksheet, sheetName, data };
    } catch (error) {
        console.error('엑셀 파일 읽기 실패:', error);
        throw error;
    }
}

// 엑셀에 데이터 추가
function appendToExcel(vocabData) {
    try {
        const { workbook, worksheet, sheetName, data } = readExcelFile();

        // 현재 날짜 생성 (YYYY-MM-DD 형식)
        const today = new Date().toISOString().split('T')[0];

        // 새로운 행 데이터
        const newRow = [
            vocabData.word,
            vocabData.meaning,
            vocabData.method,
            vocabData.example,
            vocabData.translation,
            today
        ];

        // 데이터 추가
        data.push(newRow);

        // 새로운 워크시트 생성
        const newWorksheet = XLSX.utils.aoa_to_sheet(data);

        // 컬럼 너비 설정
        newWorksheet['!cols'] = [
            { wch: 20 },  // A: 단어
            { wch: 30 },  // B: 한국어 뜻
            { wch: 40 },  // C: 암기법
            { wch: 50 },  // D: 예문
            { wch: 50 },  // E: 예문 해석
            { wch: 12 }   // F: 날짜
        ];

        // 워크북에 워크시트 업데이트
        workbook.Sheets[sheetName] = newWorksheet;

        // 파일 저장
        XLSX.writeFile(workbook, EXCEL_FILE);

        return {
            success: true,
            data: { ...vocabData, date: today }
        };
    } catch (error) {
        console.error('엑셀 파일 쓰기 실패:', error);
        throw error;
    }
}

// GPT 응답 파싱 함수
function parseGPTResponse(text) {
    const patterns = {
        word: /WORD:\s*(.+?)(?:\n|$)/i,
        meaning: /MEANING:\s*(.+?)(?:\n|$)/i,
        method: /METHOD:\s*([\s\S]+?)(?=\nEXAMPLE:|$)/i,
        example: /EXAMPLE:\s*(.+?)(?:\n|$)/i,
        translation: /TRANSLATION:\s*(.+?)(?:\n|$)/i
    };

    const result = {};
    let hasAllFields = true;
    const missingFields = [];

    for (const [key, pattern] of Object.entries(patterns)) {
        const match = text.match(pattern);
        if (match && match[1]) {
            result[key] = match[1].trim();
        } else {
            hasAllFields = false;
            missingFields.push(key.toUpperCase());
        }
    }

    if (!hasAllFields) {
        throw new Error(`파싱 실패: 다음 필드를 찾을 수 없습니다 - ${missingFields.join(', ')}`);
    }

    // 볼드 처리 변환: **text** → <span class="highlight">text</span>
    for (const key of Object.keys(result)) {
        result[key] = result[key].replace(/\*\*(.+?)\*\*/g, '<span class="highlight">$1</span>');
    }

    return result;
}

// 최근 저장된 단어 가져오기
function getRecentVocabulary(count = 3) {
    try {
        const { data } = readExcelFile();

        // 헤더 제외하고 최근 데이터 가져오기
        const recentData = data.slice(-count - 1, -1).reverse();

        if (recentData.length === 0) {
            return [];
        }

        return recentData.map(row => ({
            word: row[0] || '',
            meaning: row[1] || '',
            method: row[2] || '',
            example: row[3] || '',
            translation: row[4] || '',
            date: row[5] || ''
        }));
    } catch (error) {
        console.error('최근 단어 가져오기 실패:', error);
        return [];
    }
}

// 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 단어 저장 API
app.post('/api/save-vocabulary', (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                error: '텍스트가 비어있습니다.'
            });
        }

        // GPT 응답 파싱
        const vocabData = parseGPTResponse(text);

        // 엑셀에 저장
        const result = appendToExcel(vocabData);

        // 최근 저장된 단어들 가져오기
        const recentVocabulary = getRecentVocabulary(3);

        res.json({
            success: true,
            data: result.data,
            recentVocabulary
        });

    } catch (error) {
        console.error('단어 저장 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 최근 단어 조회 API
app.get('/api/recent-vocabulary', (req, res) => {
    try {
        const count = parseInt(req.query.count) || 3;
        const recentVocabulary = getRecentVocabulary(count);

        res.json({
            success: true,
            data: recentVocabulary
        });
    } catch (error) {
        console.error('최근 단어 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 전체 단어 조회 API
app.get('/api/all-vocabulary', (req, res) => {
    try {
        const { data } = readExcelFile();

        // 헤더 제외
        const vocabularyData = data.slice(1).map(row => ({
            word: row[0] || '',
            meaning: row[1] || '',
            method: row[2] || '',
            example: row[3] || '',
            translation: row[4] || '',
            date: row[5] || ''
        }));

        res.json({
            success: true,
            data: vocabularyData,
            total: vocabularyData.length
        });
    } catch (error) {
        console.error('전체 단어 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Public 디렉토리 생성
if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
}

// 서버 시작
app.listen(PORT, () => {
    initExcelFile();
    console.log(`\n🚀 서버가 시작되었습니다!`);
    console.log(`📍 주소: http://localhost:${PORT}`);
    console.log(`📂 엑셀 파일: ${path.join(__dirname, EXCEL_FILE)}`);
    console.log(`\n💡 브라우저가 자동으로 열리지 않으면 위 주소를 직접 입력하세요.`);

    // Mac에서 브라우저 자동 열기
    if (process.platform === 'darwin') {
        exec(`open http://localhost:${PORT}`);
    }
});