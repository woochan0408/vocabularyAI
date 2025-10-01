const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5001;
const EXCEL_FILE = 'vocabulary.xlsx';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 엑셀 파일 초기화
function initExcelFile() {
    if (!fs.existsSync(EXCEL_FILE)) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['단어', '한국어 뜻', '암기법 추천', '예문', '예문 해석', '헷갈리는 단어(엑셀)', '헷갈리는 단어(직접)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '날짜']
        ]);

        // 컬럼 너비 설정
        ws['!cols'] = [
            { wch: 20 },  // A: 단어
            { wch: 30 },  // B: 한국어 뜻
            { wch: 40 },  // C: 암기법
            { wch: 50 },  // D: 예문
            { wch: 50 },  // E: 예문 해석
            { wch: 40 },  // F: 헷갈리는 단어(엑셀)
            { wch: 40 },  // G: 헷갈리는 단어(직접)
            ...Array(18).fill({ wch: 10 }), // H-Y: 예비
            { wch: 12 }   // Z: 날짜
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

// 중복 단어 체크
function checkDuplicateWord(word) {
    try {
        const { data } = readExcelFile();
        // 헤더 제외하고 검색 (대소문자 구분 없이)
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] && data[i][0].toLowerCase() === word.toLowerCase()) {
                return {
                    exists: true,
                    data: {
                        word: data[i][0],
                        meaning: data[i][1],
                        method: data[i][2],
                        example: data[i][3],
                        translation: data[i][4],
                        confusingWordsExcel: data[i][5] || '',
                        confusingWordsDirect: data[i][6] || '',
                        date: data[i][25] || ''
                    }
                };
            }
        }
        return { exists: false };
    } catch (error) {
        console.error('중복 체크 실패:', error);
        return { exists: false };
    }
}

// 엑셀에 데이터 추가
function appendToExcel(vocabData) {
    try {
        const { workbook, worksheet, sheetName, data } = readExcelFile();

        // 중복 체크
        const duplicate = checkDuplicateWord(vocabData.word);
        if (duplicate.exists) {
            return {
                success: false,
                isDuplicate: true,
                existingWord: duplicate.data
            };
        }

        // 현재 날짜 생성 (YYYY-MM-DD 형식)
        const today = new Date().toISOString().split('T')[0];

        // 새로운 행 데이터 (Z컬럼에 날짜)
        const newRow = new Array(26).fill('');
        newRow[0] = vocabData.word;           // A
        newRow[1] = vocabData.meaning;        // B
        newRow[2] = vocabData.method;         // C
        newRow[3] = vocabData.example;        // D
        newRow[4] = vocabData.translation;    // E
        newRow[5] = '';                       // F: 헷갈리는 단어(엑셀)
        newRow[6] = '';                       // G: 헷갈리는 단어(직접)
        newRow[25] = today;                   // Z: 날짜

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
            { wch: 40 },  // F: 헷갈리는 단어(엑셀)
            { wch: 40 },  // G: 헷갈리는 단어(직접)
            ...Array(18).fill({ wch: 10 }), // H-Y: 예비
            { wch: 12 }   // Z: 날짜
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

    return result;
}

// 최근 저장된 단어 가져오기
function getRecentVocabulary(count = 3) {
    try {
        const { data } = readExcelFile();

        // 헤더 제외하고 최근 데이터 가져오기
        if (data.length <= 1) {
            return [];
        }

        const startIndex = Math.max(1, data.length - count);
        const recentData = data.slice(startIndex).reverse();

        return recentData.map(row => ({
            word: row[0] || '',
            meaning: row[1] || '',
            method: row[2] || '',
            example: row[3] || '',
            translation: row[4] || '',
            confusingWordsExcel: row[5] || '',
            confusingWordsDirect: row[6] || '',
            date: row[25] || ''
        }));
    } catch (error) {
        console.error('최근 단어 가져오기 실패:', error);
        return [];
    }
}

// 단어 삭제 함수
function deleteWord(word) {
    try {
        const { workbook, sheetName, data } = readExcelFile();

        // 헤더 제외하고 검색
        let deleted = false;
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] && data[i][0].toLowerCase() === word.toLowerCase()) {
                data.splice(i, 1);
                deleted = true;
                break;
            }
        }

        if (!deleted) {
            return { success: false, error: '단어를 찾을 수 없습니다.' };
        }

        // 새로운 워크시트 생성
        const newWorksheet = XLSX.utils.aoa_to_sheet(data);

        // 컬럼 너비 설정
        newWorksheet['!cols'] = [
            { wch: 20 },  // A: 단어
            { wch: 30 },  // B: 한국어 뜻
            { wch: 40 },  // C: 암기법
            { wch: 50 },  // D: 예문
            { wch: 50 },  // E: 예문 해석
            { wch: 40 },  // F: 헷갈리는 단어(엑셀)
            { wch: 40 },  // G: 헷갈리는 단어(직접)
            ...Array(18).fill({ wch: 10 }), // H-Y: 예비
            { wch: 12 }   // Z: 날짜
        ];

        workbook.Sheets[sheetName] = newWorksheet;
        XLSX.writeFile(workbook, EXCEL_FILE);

        return { success: true };
    } catch (error) {
        console.error('단어 삭제 실패:', error);
        return { success: false, error: error.message };
    }
}

// 단어 수정 함수
function updateWord(oldWord, updatedData) {
    try {
        const { workbook, sheetName, data } = readExcelFile();

        // 헤더 제외하고 검색
        let updated = false;
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] && data[i][0].toLowerCase() === oldWord.toLowerCase()) {
                data[i][0] = updatedData.word || data[i][0];
                data[i][1] = updatedData.meaning || data[i][1];
                data[i][2] = updatedData.method || data[i][2];
                data[i][3] = updatedData.example || data[i][3];
                data[i][4] = updatedData.translation || data[i][4];
                data[i][5] = updatedData.confusingWordsExcel || data[i][5];
                data[i][6] = updatedData.confusingWordsDirect || data[i][6];
                // 날짜는 유지
                updated = true;
                break;
            }
        }

        if (!updated) {
            return { success: false, error: '단어를 찾을 수 없습니다.' };
        }

        // 새로운 워크시트 생성
        const newWorksheet = XLSX.utils.aoa_to_sheet(data);

        // 컬럼 너비 설정
        newWorksheet['!cols'] = [
            { wch: 20 },  // A: 단어
            { wch: 30 },  // B: 한국어 뜻
            { wch: 40 },  // C: 암기법
            { wch: 50 },  // D: 예문
            { wch: 50 },  // E: 예문 해석
            { wch: 40 },  // F: 헷갈리는 단어(엑셀)
            { wch: 40 },  // G: 헷갈리는 단어(직접)
            ...Array(18).fill({ wch: 10 }), // H-Y: 예비
            { wch: 12 }   // Z: 날짜
        ];

        workbook.Sheets[sheetName] = newWorksheet;
        XLSX.writeFile(workbook, EXCEL_FILE);

        return { success: true, data: updatedData };
    } catch (error) {
        console.error('단어 수정 실패:', error);
        return { success: false, error: error.message };
    }
}

// 라우트
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: '서버가 정상 작동 중입니다.' });
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

        if (!result.success && result.isDuplicate) {
            return res.status(409).json({
                success: false,
                isDuplicate: true,
                existingWord: result.existingWord,
                error: '이미 존재하는 단어입니다.'
            });
        }

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

// 단어 삭제 API
app.delete('/api/vocabulary/:word', (req, res) => {
    try {
        const { word } = req.params;
        const result = deleteWord(decodeURIComponent(word));

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('단어 삭제 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 단어 수정 API
app.put('/api/vocabulary/:word', (req, res) => {
    try {
        const { word } = req.params;
        const updatedData = req.body;
        const result = updateWord(decodeURIComponent(word), updatedData);

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('단어 수정 실패:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 단어 검색 API
app.get('/api/vocabulary/search', (req, res) => {
    try {
        const { q } = req.query;
        const { data } = readExcelFile();

        if (!q) {
            return res.status(400).json({
                success: false,
                error: '검색어를 입력해주세요.'
            });
        }

        const searchTerm = q.toLowerCase();
        const results = [];

        // 헤더 제외하고 검색
        for (let i = 1; i < data.length; i++) {
            const word = (data[i][0] || '').toLowerCase();
            const meaning = (data[i][1] || '').toLowerCase();

            if (word.includes(searchTerm) || meaning.includes(searchTerm)) {
                results.push({
                    word: data[i][0] || '',
                    meaning: data[i][1] || '',
                    method: data[i][2] || '',
                    example: data[i][3] || '',
                    translation: data[i][4] || '',
                    confusingWordsExcel: data[i][5] || '',
                    confusingWordsDirect: data[i][6] || '',
                    date: data[i][25] || ''
                });
            }
        }

        res.json({
            success: true,
            data: results,
            count: results.length
        });
    } catch (error) {
        console.error('검색 실패:', error);
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
            confusingWordsExcel: row[5] || '',
            confusingWordsDirect: row[6] || '',
            date: row[25] || ''
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


// 서버 시작
app.listen(PORT, () => {
    initExcelFile();
    console.log(`\n🚀 백엔드 서버가 시작되었습니다!`);
    console.log(`📍 주소: http://localhost:${PORT}`);
    console.log(`📂 엑셀 파일: ${path.join(__dirname, EXCEL_FILE)}`);
});