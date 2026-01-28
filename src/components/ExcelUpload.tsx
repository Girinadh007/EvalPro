import { ChangeEvent } from 'react';
import { Upload, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

interface ExcelUploadProps {
    onDataLoaded: (data: any[]) => void;
}

const ExcelUpload = ({ onDataLoaded }: ExcelUploadProps) => {
    const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const bstr = event.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    toast.error('The excel sheet appears to be empty');
                    return;
                }

                // Basic validation: look for 'name' and 'team' or 'team_id'
                const firstRow = data[0] as any;
                const keys = Object.keys(firstRow).map(k => k.toLowerCase());

                if (!keys.includes('name') && !keys.includes('student name')) {
                    toast.error('Sheet must have a "name" column');
                    return;
                }

                toast.success(`Loaded ${data.length} students successfully!`);
                onDataLoaded(data);
            } catch (err) {
                toast.error('Failed to parse Excel file');
                console.error(err);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div
            className="glass"
            style={{
                padding: '2rem',
                border: '2px dashed var(--border-color)',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                background: 'rgba(255, 255, 255, 0.02)'
            }}
        >
            <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%'
                }}
            />

            <div style={{ pointerEvents: 'none' }}>
                <div style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto'
                }}>
                    <Upload size={24} color="var(--primary)" />
                </div>
                <h3 style={{ marginBottom: '0.5rem' }}>Upload Student List</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Drag and drop your .xlsx file here, or click to browse
                </p>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <FileText size={12} /> Expected: name, team_id, student_id
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ExcelUpload;
