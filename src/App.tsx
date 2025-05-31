import { useState } from 'react'
import './App.css'
import { ArxivUploader } from './components/ArxivUploader'
import { SummaryDisplay } from './components/SummaryDisplay'

export interface Summary {
  success: boolean;
  summary: string;
  extractedTextLength?: number;
  arxivUrl?: string;
}

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>ArXiv Research Paper Summarizer</h1>
        <p>Upload a PDF or provide an arXiv link to get an AI-powered summary</p>
      </header>

      <main className="app-main">
        <ArxivUploader 
          onSummaryReceived={setSummary}
          loading={loading}
          setLoading={setLoading}
        />
        
        {summary && (
          <SummaryDisplay summary={summary} />
        )}
      </main>

      <footer className="app-footer">
        <p>Powered by OpenAI GPT and Retrieval-Augmented Generation</p>
      </footer>
    </div>
  )
}

export default App
