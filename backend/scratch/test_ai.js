// FINAL VERIFICATION: Full brand proposal test with verified models
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const key = (process.env.GEMINI_API_KEY || '').replace(/["']/g, '').trim();
const genAI = new GoogleGenerativeAI(key);

async function fullTest() {
  // Use the model that CONFIRMED works
  const modelName = "gemini-2.5-flash-lite";
  console.log(`\n🔍 Full Brand Proposal Test with ${modelName}\n`);
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: { temperature: 0.95, topP: 0.95, maxOutputTokens: 1024 }
    });
    
    const industry = "قهوة";
    const prompt = `أنت خبير عالمي في بناء الهويات التجارية الفاخرة (Luxury Brand Strategist). 
  المهمة: اقترح 5 أسماء تجارية إبداعية و 5 لوحات ألوان احترافية لنشاط تجاري جديد في مجال '${industry}'.
  
  قواعد صارمة لضمان الابتكار:
  1. قم بتوليد أسماء فريدة وجديدة تماماً (UNSEEN, unique brand names).
  2. لا تستخدم أي أسماء شائعة أو مخزنة مسبقاً في ذاكرتك.
  3. لا تستخدم كلمة '${industry}' إطلاقاً داخل اسم العلامة التجارية.
  4. الأسماء يجب أن تكون راقية (High-End)، تجريدية (Abstract)، أو إيحائية (Evocative).
  5. نوع بين الأسماء العربية العصرية والإنجليزية الفاخرة.
  
  الرد يجب أن يكون كائن JSON واحد فقط:
  {
    "names": [
      { "name": "Creative Name", "description": "Short evocative vision" }
    ],
    "palettes": [
      { "title": "Palette Name", "colors": ["#hex1", "#hex2", "#hex3", "#hex4"] }
    ]
  }
  
  ملاحظة: الرد يجب أن يكون كائن JSON خام فقط بدون أي نصوص خارجية.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    console.log("✅ RAW AI RESPONSE:");
    console.log(text);
    
    // Parse it
    let cleaned = text.replace(/```json\n?|```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    const parsed = JSON.parse(cleaned);
    console.log("\n✅ PARSED SUCCESSFULLY!");
    console.log(`   Names: ${parsed.names.length}`);
    parsed.names.forEach((n, i) => console.log(`   ${i+1}. ${n.name} — ${n.description}`));
    console.log(`   Palettes: ${parsed.palettes.length}`);
    parsed.palettes.forEach((p, i) => console.log(`   ${i+1}. ${p.title}: ${p.colors.join(', ')}`));
    
  } catch (err) {
    console.error("❌ FAILED:", err.message);
  }
}

fullTest();
