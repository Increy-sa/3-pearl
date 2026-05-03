import { GoogleGenerativeAI } from '@google/generative-ai';

const getGenAI = () => {
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

  const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const key = rawKey.replace(/[\"']/g, '').trim();
  
  if (!key) {
    console.error("CRITICAL: Neither GEMINI_API_KEY nor GOOGLE_API_KEY is defined.");
  }
  return new GoogleGenerativeAI(key);
};

const cleanJSON = (text: string) => {
  try {
    let cleaned = text.replace(/```json\n?|```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
  } catch (e) {
    return text;
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// ACTIVE MODELS (both are current, non-deprecated as of Apr 2026):
//   gemini-2.5-flash      → primary  (best price/performance)
//   gemini-2.5-flash-lite → fallback (fastest, budget-friendly)
// ============================================================

export async function generateBrandProposal(businessName: string, industry: string, description: string) {
  const modelNames = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
  let lastError: any;

  const genAI = getGenAI();

  const prompt = `أنت خبير عالمي في بناء الهويات التجارية الفاخرة (Luxury Brand Strategist). 
  المهمة: اقترح 5 أسماء تجارية إبداعية و 5 لوحات ألوان احترافية لنشاط تجاري جديد في مجال '${industry}'.
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

  for (const modelName of modelNames) {
    try {
      console.log(`[AI] Attempting brand proposal with model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      console.log(`[AI] ✅ Success with ${modelName}`);
      const cleanedText = cleanJSON(text);
      const parsed = JSON.parse(cleanedText);
      if (!parsed.names || !parsed.palettes) throw new Error("Invalid response structure");
      return parsed;
    } catch (error: any) {
      console.error(`[AI] ❌ Failed with ${modelName}: ${error.message}`);
      lastError = error;
      const is503 = error.message?.includes('503') || error.message?.includes('Service Unavailable');
      const is429 = error.message?.includes('429') || error.message?.includes('Too Many Requests');
      // Wait longer for 503 (overloaded), shorter for other errors
      if (modelNames.indexOf(modelName) < modelNames.length - 1) {
        await sleep(is503 ? 3000 : 800);
      }
    }
  }
  throw lastError || new Error("All AI models failed");
}

export async function generateLogoSVG(brandName: string, industry: string, colors: string[]): Promise<string> {
  const modelNames = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
  const genAI = getGenAI();

  const prompt = `Create a clean minimalist SVG logo for "${brandName}" in the ${industry} industry. 
  Use colors: ${colors.join(', ')}. 
  Output ONLY the raw SVG code, no markdown, no explanation, just the SVG element.`;

  for (const modelName of modelNames) {
    try {
      console.log(`[AI] Attempting logo generation with model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      // Strip markdown code blocks if present
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:svg|xml|html)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
      }
      const svgMatch = text.match(/<svg[\s\S]*<\/svg>/i);
      if (svgMatch) {
        console.log(`[AI] ✅ Logo generated with ${modelName}`);
        const svg = svgMatch[0];
        return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
      }
      throw new Error("No valid SVG found in response");
    } catch (error: any) {
      console.error(`[AI] ❌ Logo failed with ${modelName}: ${error.message}`);
      const is503 = error.message?.includes('503') || error.message?.includes('Service Unavailable');
      if (modelNames.indexOf(modelName) < modelNames.length - 1) {
        await sleep(is503 ? 3000 : 800);
      }
    }
  }

  // Graceful fallback SVG with brand colors
  const primaryColor = colors[0] || "#1e293b";
  const secondaryColor = colors[1] || "#64748b";
  const fallbackSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="20" fill="${primaryColor}"/>
  <text x="100" y="115" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">${brandName.slice(0, 10)}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(fallbackSVG).toString('base64')}`;
}

