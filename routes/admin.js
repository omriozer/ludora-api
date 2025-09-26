import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const execAsync = promisify(exec);

// Apply admin authentication to all routes
router.use(authenticateToken, requireAdmin);

// Start database manager for development environment
router.post('/database/dev', async (req, res) => {
  try {
    console.log('🔧 Starting development database manager (Adminer)...');

    // Path to the development adminer script
    const scriptPath = path.join(process.cwd(), '..', 'scripts', 'run-adminer-dev.sh');

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({
        error: 'Development adminer script not found',
        path: scriptPath
      });
    }

    // Execute the script in the background
    const command = `chmod +x "${scriptPath}" && "${scriptPath}"`;

    // Start adminer in background (don't wait for completion)
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error starting dev adminer:', error);
      } else {
        console.log('✅ Dev adminer started successfully');
        console.log('stdout:', stdout);
      }
      if (stderr) {
        console.log('stderr:', stderr);
      }
    });

    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    res.json({
      success: true,
      message: 'Development database manager started',
      url: 'http://localhost:8080',
      environment: 'development'
    });
  } catch (error) {
    console.error('Error starting development database manager:', error);
    res.status(500).json({
      error: 'Failed to start development database manager',
      details: error.message
    });
  }
});

// Start database manager for production environment
router.post('/database/prod', async (req, res) => {
  try {
    console.log('🔧 Starting production database manager (Adminer)...');

    // Path to the production adminer script
    const scriptPath = path.join(process.cwd(), '..', 'scripts', 'run-adminer-prod.sh');

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({
        error: 'Production adminer script not found',
        path: scriptPath
      });
    }

    // Execute the script in the background
    const command = `chmod +x "${scriptPath}" && "${scriptPath}"`;

    // Start adminer in background (don't wait for completion)
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error starting prod adminer:', error);
      } else {
        console.log('✅ Prod adminer started successfully');
        console.log('stdout:', stdout);
      }
      if (stderr) {
        console.log('stderr:', stderr);
      }
    });

    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    res.json({
      success: true,
      message: 'Production database manager started',
      url: 'http://localhost:8080',
      environment: 'production'
    });
  } catch (error) {
    console.error('Error starting production database manager:', error);
    res.status(500).json({
      error: 'Failed to start production database manager',
      details: error.message
    });
  }
});

// Check adminer status
router.get('/database/status', async (req, res) => {
  try {
    // Try to check if adminer is running on port 8080
    const { stdout } = await execAsync('lsof -i :8080 || echo "No process found"');

    const isRunning = !stdout.includes('No process found') && stdout.trim() !== '';

    res.json({
      running: isRunning,
      port: 8080,
      url: 'http://localhost:8080',
      details: stdout
    });
  } catch (error) {
    console.error('Error checking adminer status:', error);
    res.json({
      running: false,
      port: 8080,
      url: 'http://localhost:8080',
      error: error.message
    });
  }
});

// Stop adminer
router.post('/database/stop', async (req, res) => {
  try {
    console.log('🛑 Stopping database manager (Adminer)...');

    // Kill processes running on port 8080
    await execAsync('pkill -f "adminer" || true');
    await execAsync('lsof -ti:8080 | xargs kill -9 || true');

    res.json({
      success: true,
      message: 'Database manager stopped'
    });
  } catch (error) {
    console.error('Error stopping database manager:', error);
    res.status(500).json({
      error: 'Failed to stop database manager',
      details: error.message
    });
  }
});

export default router;