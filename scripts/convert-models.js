import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import fse from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const converterDir = path.join(__dirname, '../model-converter');
const publicModelsDir = path.join(__dirname, '../public/models');

// Helper to get correct pip/python path for venv
function venvBin(bin) {
  // Windows compatibility
  const binDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  return path.join(converterDir, '.venv', binDir, bin + (process.platform === 'win32' ? '.exe' : ''));
}

// Ensure .venv exists and install deps
console.log('Setting up Python virtual environment...');
if (!fs.existsSync(path.join(converterDir, '.venv'))) {
  execSync('python3 -m venv .venv', { cwd: converterDir, stdio: 'inherit' });
}

const requirementsPath = path.join(converterDir, 'requirements.txt');
if (fs.existsSync(requirementsPath)) {
  try {
    execSync(`${venvBin('pip')} install -r requirements.txt`, { cwd: converterDir, stdio: 'inherit' });
  } catch (err) {
    console.error('pip install failed:', err.stderr?.toString() || err.message);
    process.exit(1);
  }
} else {
  console.warn('requirements.txt not found, skipping pip install.');
}

console.log('Running model conversion...');
try {
  execSync(`${venvBin('python')} convert_model.py`, { cwd: converterDir, stdio: 'inherit' });
} catch (err) {
  console.error('Python script failed:', err.stderr?.toString() || err.message);
  process.exit(1);
}

const modelsDir = path.join(converterDir, 'models');
const MODEL_NAMES = [
  "yolo11n",
  "yolo11s",
  "yoloe-11s-seg",
  "yoloe-11m-seg"
];

console.log('Copying converted models...');
fse.ensureDirSync(publicModelsDir);

let found = false;
for (const modelName of MODEL_NAMES) {
  const src = path.join(modelsDir, modelName + '_web_model');
  const dst = path.join(publicModelsDir, modelName);
  if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
    fse.copySync(src, dst);
    console.log(`Copied ${src} to ${dst}`);
    found = true;
  }
}
if (!found) {
  console.warn('No web models were found in /model-converter/models.');
}

console.log('Done.');
