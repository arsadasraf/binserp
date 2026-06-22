import fs from 'fs';
import path from 'path';

const backendPath = 'c:/Users/DELL/Desktop/BinsAnalytics/binsanalytics_backend/src';

function splitModels() {
  const modelFile = path.join(backendPath, 'models/store.model.js');
  const outDir = path.join(backendPath, 'models/store');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const content = fs.readFileSync(modelFile, 'utf8');
  const lines = content.split('\n');

  let currentModel = null;
  let currentBuffer = [];
  const models = {};
  const indexes = [];

  // Very basic regex for export const XYZSchema = new mongoose.Schema(
  const schemaRegex = /^export const ([a-zA-Z0-9_]+)Schema\s*=\s*new mongoose\.Schema/;
  // Also companyInfoSchema uses export const
  const printConfigRegex = /^const printConfigSchema\s*=\s*new mongoose\.Schema/;

  // We will collect common imports
  let imports = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('import ')) {
      imports.push(line);
      continue;
    }

    if (printConfigRegex.test(line)) {
       currentModel = 'printConfig';
       currentBuffer = [line];
       continue;
    }

    const match = line.match(schemaRegex);
    if (match) {
      if (currentModel) {
        models[currentModel] = currentBuffer.join('\n');
      }
      currentModel = match[1]; // e.g. deliveryChallan
      currentBuffer = [line];
      continue;
    }

    if (line.includes('.index(')) {
       indexes.push(line);
       continue;
    }

    if (currentModel) {
      currentBuffer.push(line);
    }
  }

  if (currentModel) {
    models[currentModel] = currentBuffer.join('\n');
  }

  // Now create the files
  let indexFileContent = ``;

  for (const [name, code] of Object.entries(models)) {
    if (name === 'printConfig') continue; // Print config goes to companyInfo usually or we handle it

    let finalCode = imports.join('\n') + '\n\n';
    
    // Add printConfig before companyInfo
    if (name === 'companyInfo') {
        finalCode += models['printConfig'] + '\n\n';
    }

    finalCode += code + '\n';

    // Add related indexes
    const relatedIndexes = indexes.filter(idx => idx.includes(`${name}Schema`));
    if (relatedIndexes.length > 0) {
        finalCode += '\n// Indexes\n' + relatedIndexes.join('\n') + '\n';
    }

    const fileName = `${name}.model.js`;
    fs.writeFileSync(path.join(outDir, fileName), finalCode);

    indexFileContent += `export { ${name}Schema } from './${fileName}';\n`;
  }

  fs.writeFileSync(path.join(outDir, 'index.js'), indexFileContent);
  console.log('Models split successfully!');
}

function splitControllers() {
  const ctrlFile = path.join(backendPath, 'controllers/store.controller.js');
  const outDir = path.join(backendPath, 'controllers/store');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const content = fs.readFileSync(ctrlFile, 'utf8');
  
  // We need to extract imports and helper functions at the top.
  const lines = content.split('\n');
  let headerBuffer = [];
  let currentFunc = null;
  let currentBuffer = [];
  const controllers = {};

  const funcRegex = /^export const ([a-zA-Z0-9_]+)\s*=\s*async\s*\(/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const match = line.match(funcRegex);
    if (match) {
      if (!currentFunc && headerBuffer.length === 0) {
         // This is the first function, save whatever was before as header
         headerBuffer = currentBuffer;
      } else if (currentFunc) {
         controllers[currentFunc] = currentBuffer.join('\n');
      }
      currentFunc = match[1];
      currentBuffer = [line];
      continue;
    }

    currentBuffer.push(line);
  }

  if (currentFunc) {
    controllers[currentFunc] = currentBuffer.join('\n');
  }

  // Find all imports in headerBuffer
  let importsStr = '';
  let helpersStr = '';
  let inImport = false;
  
  // A better way to get the header
  const headerContent = headerBuffer.join('\n');
  // Just use the entire header for all files since it has shared stuff
  // But we need to fix the imports from '../models/store.model.js' to '../../models/store/index.js'
  const fixedHeader = headerContent.replace(/\.\.\/models\/store\.model\.js/g, '../../models/store/index.js')
                                   .replace(/\.\.\/models\//g, '../../models/')
                                   .replace(/\.\.\/utils\//g, '../../utils/');

  let indexExports = [];

  for (const [name, code] of Object.entries(controllers)) {
    const finalCode = fixedHeader + '\n\n' + code + '\n';
    const fileName = `${name}.controller.js`;
    fs.writeFileSync(path.join(outDir, fileName), finalCode);
    indexExports.push(`export { ${name} } from './${fileName}';`);
  }

  fs.writeFileSync(path.join(outDir, 'index.js'), indexExports.join('\n') + '\n');
  console.log('Controllers split successfully!');
}

splitModels();
splitControllers();
