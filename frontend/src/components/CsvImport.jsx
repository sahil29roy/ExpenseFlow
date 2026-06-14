import React, { useState, useRef } from 'react';
import { apiRequest } from '../utils/api';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function CsvImport({ refreshTrigger, onImportSuccess, showToast }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleCsvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      handleCsvFile(e.target.files[0]);
    }
  };

  const handleCsvFile = (file) => {
    if (!file.name.endsWith('.csv')) {
      showToast('Only CSV spreadsheets are supported.', 'error');
      return;
    }
    setSelectedFile(file);
    setImportReport(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setImportReport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    const token = localStorage.getItem('token');
    
    try {
      const response = await fetch('http://localhost:5000/api/expenses/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const res = await response.json();
      
      if (response.ok && res.data && res.data.success) {
        showToast(res.message || 'CSV Imported successfully!', 'success');
        setImportReport(res.data.report);
        setIsSuccess(true);
        onImportSuccess();
      } else {
        showToast('Import aborted due to validation errors.', 'error');
        setImportReport(res.data ? res.data.report : { totalRows: 0, failedCount: 1, errors: [{ rowNum: 1, error: res.message }] });
        setIsSuccess(false);
      }
    } catch (error) {
      showToast(error.message || 'Network upload failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-panel">
      <div className="csv-import-wrapper">
        <div className="card-wrapper">
          <div className="section-header">
            <h3>Import Expenses from CSV File</h3>
          </div>
          <p className="section-subtitle">
            Select a CSV file to parse and save expenses. Supported split types: <strong>EQUAL, UNEQUAL, PERCENTAGE, EXACT</strong>.
            Required column headers: <code>description, paid_by, amount, split_type, split_with</code>. Optional headers: <code>split_details, notes</code>.
          </p>

          <div 
            className={`drag-drop-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={dragOver ? { backgroundColor: 'var(--accent-light)', borderColor: 'var(--accent)' } : {}}
          >
            <UploadCloud className="drag-icon" />
            <p>Drag and drop your CSV file here or <span className="text-accent link-style">browse files</span></p>
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept=".csv"
              onChange={handleFileChange}
            />
          </div>

          {selectedFile && (
            <div className="csv-metadata-bar">
              <div className="file-info">
                <FileText />
                <span>{selectedFile.name}</span>
                <span className="badge" style={{backgroundColor:'#e2e8f0', color:'#1e293b'}}>
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={handleClearFile}
                disabled={loading}
              >
                Remove
              </button>
            </div>
          )}

          <div className="csv-actions-bar">
            <button 
              type="button" 
              className="btn btn-primary"
              disabled={!selectedFile || loading}
              onClick={handleUpload}
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Uploading and importing...' : 'Process and Import File'}</span>
            </button>
          </div>
        </div>

        {importReport && (
          <div className="card-wrapper" id="csv-result-card" style={{marginTop:'24px'}}>
            <div className="section-header">
              <h3>CSV Import Report</h3>
            </div>
            
            <div className="csv-report-summary">
              <div className="report-stat-card" style={isSuccess ? {backgroundColor:'var(--success-bg)', color:'var(--success)'} : {backgroundColor:'#e2e8f0'}}>
                <h2>{isSuccess ? importReport.importedCount : 0}</h2>
                <p>Imported Rows</p>
              </div>
              <div className="report-stat-card" style={!isSuccess ? {backgroundColor:'var(--error-bg)', color:'var(--error)'} : {backgroundColor:'#e2e8f0'}}>
                <h2>{isSuccess ? 0 : importReport.failedCount}</h2>
                <p>Validation Failures</p>
              </div>
              <div className="report-stat-card" style={{backgroundColor:'#f1f5f9'}}>
                <h2>{importReport.totalRows}</h2>
                <p>Total Processed</p>
              </div>
            </div>

            {isSuccess ? (
              <p className="text-green text-center">
                <strong>Success: All expenses saved atomically in a single transaction block!</strong>
              </p>
            ) : (
              <div className="csv-errors-log">
                <h5 style={{color:'var(--error)', display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px'}}>
                  <AlertTriangle size={16} />
                  Import Aborted & Database Transaction Rolled Back
                </h5>
                <ul>
                  {importReport.errors.map((err, idx) => (
                    <li key={idx} style={{color:'#7f1d1d', marginBottom:'4px'}}>
                      Row {err.rowNum}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
