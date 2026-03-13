const XLSX = require('xlsx');
const workbook = XLSX.readFile('c:/Users/pedap/OneDrive/Desktop/Review/WONDERS_OF_AI_3.0_students.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

let lastTeam = '';
let count = 0;
data.forEach(row => {
    const rawTeam = row['Team Name'] || row['team_id'] || row['team'] || '';
    if (rawTeam && rawTeam.toString().trim() !== '') {
        lastTeam = rawTeam.toString().trim();
    }
    if (lastTeam.toLowerCase().includes('trophy')) {
        count++;
    }
});

console.log('COUNT_SEARCH_RESULT:' + count);
