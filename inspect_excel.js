const XLSX = require('xlsx');
const workbook = XLSX.readFile('c:/Users/pedap/OneDrive/Desktop/Review/WONDERS_OF_AI_3.0_students.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
console.log(JSON.stringify(data.slice(0, 20), null, 2));
