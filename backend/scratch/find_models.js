// Direct REST API call to list available models — no SDK guessing
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const key = (process.env.GEMINI_API_KEY || '').replace(/["']/g, '').trim();
console.log("API Key loaded:", key ? `YES (${key.substring(0,10)}...)` : "NO — MISSING!");

if (!key) {
  console.error("Cannot proceed without API key.");
  process.exit(1);
}

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  console.log("\nFetching available models from Google API...\n");
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`API returned ${res.status}: ${errBody}`);
      return;
    }
    const data = await res.json();
    const models = data.models || [];
    
    console.log(`Found ${models.length} models. Filtering for generateContent support:\n`);
    
    const contentModels = models.filter(m => 
      m.supportedGenerationMethods && 
      m.supportedGenerationMethods.includes('generateContent')
    );
    
    contentModels.forEach(m => {
      console.log(`  ✅ ${m.name.replace('models/', '')}  — ${m.displayName || ''}`);
    });
    
    console.log(`\n--- Total generateContent models: ${contentModels.length} ---`);
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

listModels();
