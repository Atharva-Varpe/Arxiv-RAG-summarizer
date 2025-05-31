import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse';
import axios from 'axios';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
  console.error('❌ ERROR: OpenAI API key is not configured!');
  console.error('Please set your OpenAI API key in backend/.env file');
  console.error('Get your API key from: https://platform.openai.com/api-keys');
  console.error('Example: OPENAI_API_KEY=sk-...');
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper function to extract text from PDF buffer
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error('Failed to extract text from PDF');
  }
}

// Helper function to download arXiv paper
async function downloadArxivPaper(arxivUrl: string): Promise<Buffer> {
  try {
    // Extract arXiv ID from URL
    const arxivIdMatch = arxivUrl.match(/(?:arxiv\.org\/(?:abs|pdf)\/)?(\d+\.\d+)/);
    if (!arxivIdMatch) {
      throw new Error('Invalid arXiv URL format');
    }
    
    const arxivId = arxivIdMatch[1];
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
    
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error('Failed to download arXiv paper');
  }
}

// Helper function to chunk text for RAG
function chunkText(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
  const chunks = [];
  const sentences = text.split(/[.!?]+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      // Keep some overlap
      const words = currentChunk.split(' ');
      currentChunk = words.slice(-overlap / 10).join(' ') + ' ' + sentence;
    } else {
      currentChunk += sentence + '. ';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
}

// Helper function to generate embeddings and find relevant chunks
async function retrieveRelevantChunks(chunks: string[], query: string, topK: number = 3): Promise<string[]> {
  try {
    // For simplicity, we'll return the first few chunks
    // In a production system, you'd use vector embeddings for better retrieval
    return chunks.slice(0, topK);
  } catch (error) {
    // Fallback to first chunks if embedding fails
    return chunks.slice(0, topK);
  }
}

// Generate summary using OpenAI with RAG
async function generateSummary(text: string): Promise<string> {
  try {
    // Chunk the text
    const chunks = chunkText(text);
    
    // Retrieve relevant chunks (simplified - in production you'd use vector search)
    const relevantChunks = await retrieveRelevantChunks(chunks, 'summarize this research paper');
    
    const context = relevantChunks.join('\n\n');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a research paper summarization expert. Please provide a comprehensive summary of the given research paper in the following format:

**Title & Authors**: Extract and present the title and authors if available.

**Abstract Summary**: Provide a concise summary of the abstract.

**Key Contributions**: List the main contributions and findings.

**Methodology**: Briefly describe the methods used.

**Results**: Summarize the key results and findings.

**Conclusions**: Present the main conclusions and implications.

**Significance**: Explain the significance and potential impact of this work.

Please be thorough but concise, and focus on the most important aspects of the research.`
        },
        {
          role: 'user',
          content: `Please summarize this research paper:\n\n${context}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || 'Failed to generate summary';
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error('Failed to generate summary with OpenAI');
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ArXiv RAG Server is running' });
});

// Upload PDF file
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Read the uploaded file
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    
    // Extract text from PDF
    const text = await extractTextFromPDF(buffer);
    
    if (!text || text.trim().length < 100) {
      return res.status(400).json({ error: 'Could not extract sufficient text from PDF' });
    }

    // Generate summary using RAG
    const summary = await generateSummary(text);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      summary: summary,
      extractedTextLength: text.length,
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Process arXiv URL
app.post('/arxiv', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'ArXiv URL is required' });
    }

    // Download the paper
    const buffer = await downloadArxivPaper(url);
    
    // Extract text from PDF
    const text = await extractTextFromPDF(buffer);
    
    if (!text || text.trim().length < 100) {
      return res.status(400).json({ error: 'Could not extract sufficient text from PDF' });
    }

    // Generate summary using RAG
    const summary = await generateSummary(text);
    
    res.json({
      success: true,
      summary: summary,
      extractedTextLength: text.length,
      arxivUrl: url,
    });

  } catch (error) {
    console.error('ArXiv processing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
