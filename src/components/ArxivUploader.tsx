import React, { useState } from 'react';
import './ArxivUploader.css';

interface Summary {
  success: boolean;
  summary: string;
  extractedTextLength?: number;
  arxivUrl?: string;
}

interface ArxivUploaderProps {
  onSummaryReceived: (summary: Summary) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const ArxivUploader: React.FC<ArxivUploaderProps> = ({ 
  onSummaryReceived, 
  loading, 
  setLoading 
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [arxivUrl, setArxivUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = 'http://localhost:3001';

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process file');
      }

      onSummaryReceived(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing the file');
    } finally {
      setLoading(false);
    }
  };

  const handleArxivSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!arxivUrl.trim()) {
      setError('Please enter an arXiv URL');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/arxiv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: arxivUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process arXiv paper');
      }

      onSummaryReceived(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing the arXiv paper');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="uploader-container">
      <div className="tab-container">
        <button 
          className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
          disabled={loading}
        >
          📄 Upload PDF
        </button>
        <button 
          className={`tab ${activeTab === 'url' ? 'active' : ''}`}
          onClick={() => setActiveTab('url')}
          disabled={loading}
        >
          🔗 arXiv URL
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {activeTab === 'upload' && (
        <div 
          className={`upload-area ${dragActive ? 'drag-active' : ''} ${loading ? 'loading' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-input"
            accept=".pdf"
            onChange={handleFileInputChange}
            disabled={loading}
            style={{ display: 'none' }}
          />
          <label htmlFor="file-input" className="upload-label">
            {loading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Processing your paper...</p>
              </div>
            ) : (
              <div className="upload-content">
                <div className="upload-icon">📄</div>
                <h3>Drag and drop your PDF here</h3>
                <p>or click to browse files</p>
                <div className="upload-info">
                  <small>Supports PDF files up to 10MB</small>
                </div>
              </div>
            )}
          </label>
        </div>
      )}

      {activeTab === 'url' && (
        <form onSubmit={handleArxivSubmit} className="url-form">
          <div className="input-group">
            <label htmlFor="arxiv-url">arXiv Paper URL</label>
            <input
              type="url"
              id="arxiv-url"
              value={arxivUrl}
              onChange={(e) => setArxivUrl(e.target.value)}
              placeholder="https://arxiv.org/abs/2301.00001 or https://arxiv.org/pdf/2301.00001.pdf"
              disabled={loading}
              required
            />
            <small className="input-help">
              Enter the full arXiv URL (abs or pdf link)
            </small>
          </div>
          <button 
            type="submit" 
            className="submit-button"
            disabled={loading || !arxivUrl.trim()}
          >
            {loading ? (
              <span className="button-loading">
                <div className="button-spinner"></div>
                Processing...
              </span>
            ) : (
              'Generate Summary'
            )}
          </button>
        </form>
      )}
    </div>
  );
};
