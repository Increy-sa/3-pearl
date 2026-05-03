const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../.env' });

console.log("Key found:", process.env.GEMINI_API_KEY ? "YES (starts with " + process.env.GEMINI_API_KEY.substring(0, 5) + ")" : "NO");

async function listModels() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return;
  
  const genAI = new GoogleGenerativeAI(key);
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent("test");
    console.log("Success with gemini-1.5-flash");
  } catch (e) {
    console.log("Failed with gemini-1.5-flash:", e.message);
  }
}

listModels();
