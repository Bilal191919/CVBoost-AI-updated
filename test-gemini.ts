import { analyzeCV } from './src/lib/gemini.js';
import fs from 'fs';

async function test() {
  try {
    const base64 = Buffer.from('test pdf content').toString('base64');
    const result = await analyzeCV(base64, 'application/pdf', 'Software Engineer');
    console.log(result);
  } catch (e) {
    console.error(e);
  }
}

test();
