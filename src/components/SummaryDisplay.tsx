import React, { useState } from 'react';
import './SummaryDisplay.css';

interface Summary {
  success: boolean;
  summary: string;
  extractedTextLength?: number;
  arxivUrl?: string;
}

interface SummaryDisplayProps {
  summary: Summary;
}

export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ summary }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const formatSummary = (text: string) => {
    // Split by lines and format markdown-style content
    const lines = text.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        // Bold headers
        return (
          <h3 key={index} className="summary-header">
            {line.replace(/\*\*/g, '')}
          </h3>
        );
      } else if (line.startsWith('*') || line.startsWith('-')) {
        // List items
        return (
          <li key={index} className="summary-list-item">
            {line.replace(/^[-*]\s*/, '')}
          </li>
        );
      } else if (line.trim() === '') {
        // Empty lines
        return <br key={index} />;
      } else {
        // Regular paragraphs
        return (
          <p key={index} className="summary-paragraph">
            {line}
          </p>
        );
      }
    });
  };

  return (
    <div className="summary-container">
      <div className="summary-header-section">
        <h2>Research Paper Summary</h2>
        <div className="summary-actions">
          <button 
            onClick={handleCopy}
            className={`copy-button ${copied ? 'copied' : ''}`}
            title="Copy summary to clipboard"
          >
            {copied ? '✅ Copied!' : '📋 Copy'}
          </button>
        </div>
      </div>

      <div className="summary-meta">
        {summary.arxivUrl && (
          <div className="meta-item">
            <strong>Source:</strong> 
            <a 
              href={summary.arxivUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="arxiv-link"
            >
              {summary.arxivUrl}
            </a>
          </div>
        )}
        {summary.extractedTextLength && (
          <div className="meta-item">
            <strong>Extracted Text:</strong> {summary.extractedTextLength.toLocaleString()} characters
          </div>
        )}
      </div>

      <div className="summary-content">
        {formatSummary(summary.summary)}
      </div>

      <div className="summary-footer">
        <div className="disclaimer">
          <p>
            <strong>Note:</strong> This summary is generated using AI and may not capture all nuances 
            of the original research. Please refer to the original paper for complete accuracy.
          </p>
        </div>
      </div>
    </div>
  );
};
