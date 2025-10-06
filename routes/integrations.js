import express from 'express';
import multer from 'multer';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { validateBody, rateLimiters, schemas, customValidators } from '../middleware/validation.js';
import LLMService from '../services/LLMService.js';
import EmailService from '../services/EmailService.js';
import FileService from '../services/FileService.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  storage: multer.memoryStorage()
});

// Core Integration: Invoke LLM
router.post('/invokeLLM', authenticateToken, rateLimiters.llm, validateBody(schemas.llmRequest), async (req, res) => {
  try {
    const result = await LLMService.invokeLLM(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error invoking LLM:', error);
    res.status(500).json({ error: error.message });
  }
});

// Core Integration: Send Email
router.post('/sendEmail', authenticateToken, rateLimiters.email, validateBody(schemas.sendEmail), async (req, res) => {
  try {
    const result = await EmailService.sendEmail(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Core Integration: Upload File
router.post('/uploadFile', authenticateToken, rateLimiters.upload, upload.single('file'), customValidators.validateFileUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const result = await FileService.uploadFile({ file: req.file, userId: req.user.uid });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Core Integration: Upload Private File
router.post('/uploadPrivateFile', authenticateToken, rateLimiters.upload, upload.single('file'), customValidators.validateFileUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const result = await FileService.uploadPrivateFile({ 
      file: req.file, 
      folder: req.body.folder, 
      tags: req.body.tags, 
      userId: req.user.uid 
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error uploading private file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Core Integration: Generate Image
router.post('/generateImage', authenticateToken, rateLimiters.llm, validateBody(schemas.generateImage), async (req, res) => {
  try {
    const { prompt, size = '1024x1024', style = 'natural', quality = 'standard' } = req.body;
    
    // Mock implementation until ImageService is created
    const imageResult = {
      imageId: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      prompt,
      url: `https://images.ludora.app/generated/${Date.now()}.png`,
      size,
      style,
      quality,
      generatedAt: new Date().toISOString(),
      requestedBy: req.user.uid,
      status: 'mock_generated'
    };
    
    res.json({
      success: true,
      data: imageResult
    });
  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Core Integration: Extract Data from Uploaded File
router.post('/extractDataFromUploadedFile', authenticateToken, rateLimiters.upload, upload.single('file'), customValidators.validateFileUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded for data extraction' });
    }
    
    const result = await FileService.extractDataFromUploadedFile({ 
      file: req.file, 
      extractionType: req.body.extractionType 
    });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error extracting data from file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Core Integration: Create File Signed URL
router.post('/createFileSignedUrl', authenticateToken, rateLimiters.upload, validateBody(schemas.signedUrl), async (req, res) => {
  try {
    const result = await FileService.createFileSignedUrl(req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error creating signed URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check for integrations
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    integrations: {
      llm: 'available',
      email: 'available',
      fileUpload: 'available',
      imageGeneration: 'available',
      dataExtraction: 'available',
      signedUrls: 'available'
    },
    timestamp: new Date().toISOString()
  });
});

// Get integration capabilities
router.get('/capabilities', optionalAuth, (req, res) => {
  const llmModels = LLMService.getAvailableModels();
  
  res.json({
    llm: {
      models: [...llmModels.openai, ...llmModels.anthropic],
      openai: llmModels.openai,
      anthropic: llmModels.anthropic,
      capabilities: llmModels.capabilities,
      maxTokens: 8192,
      supportedLanguages: ['en', 'he', 'es', 'fr', 'ar', 'de', 'it', 'pt']
    },
    email: {
      providers: ['smtp', 'sendgrid', 'ses'],
      features: ['html', 'text', 'templates', 'triggers', 'automation'],
      templateTypes: ['registration_confirmation', 'payment_confirmation', 'student_invitation']
    },
    fileUpload: {
      maxSize: '50MB',
      supportedTypes: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'text/csv',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'audio/mpeg', 'audio/wav', 'video/mp4'
      ],
      storage: process.env.USE_S3 === 'true' ? ['s3'] : ['local'],
      features: ['public-upload', 'private-upload', 'signed-urls', 'data-extraction']
    },
    imageGeneration: {
      status: 'mock', // Indicates this is not fully implemented
      providers: ['mock'],
      sizes: ['256x256', '512x512', '1024x1024'],
      styles: ['natural', 'vivid', 'artistic']
    },
    dataExtraction: {
      supportedTypes: ['pdf', 'image', 'csv', 'excel', 'text'],
      features: ['metadata-extraction', 'text-extraction'],
      status: 'partial' // Some features not fully implemented
    },
    environment: {
      storage: process.env.USE_S3 === 'true' ? 's3' : 'local',
      llmProviders: {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY
      },
      email: !!process.env.EMAIL_HOST
    }
  });
});

// Get LLM models (dedicated endpoint)
router.get('/llm/models', optionalAuth, (req, res) => {
  try {
    const models = LLMService.getAvailableModels();
    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;