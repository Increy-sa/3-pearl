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

/**
 * Generates a comprehensive brand identity proposal using AI.
 * Returns the full schema: suggestedName, slogan, brandColors, logoDescription,
 * brandPersonality, brandVoice, typography, and rationale.
 */
export async function generateFullBrandIdentity(
  businessName: string,
  industry: string,
  description: string,
  targetAudience: string
) {
  const modelNames = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
  let lastError: any;

  const genAI = getGenAI();

  const prompt = `أنت خبير عالمي في تصميم الهوية البصرية للمتاجر والعلامات التجارية العربية.

بيانات المتجر:
- اسم النشاط التجاري: ${businessName}
- مجال العمل: ${industry}
- وصف النشاط: ${description}
- الجمهور المستهدف: ${targetAudience}

المطلوب: قم بتوليد مقترح هوية بصرية كامل ومتميز بناءً على البيانات أعلاه.

أرجع الرد بصيغة JSON فقط بدون أي نص إضافي، بهذا الشكل بالضبط:
{
  "suggestedName": "اسم مقترح مبتكر للعلامة التجارية (يجب أن يكون مختلفاً عن اسم النشاط الأصلي)",
  "alternativeNames": ["اسم بديل 1", "اسم بديل 2", "اسم بديل 3", "اسم بديل 4"],
  "slogan": "شعار أو tagline قصير وجذاب",
  "brandColors": [
    { "name": "اسم اللون", "hex": "#XXXXXX", "usage": "الاستخدام الرئيسي" },
    { "name": "اسم اللون", "hex": "#XXXXXX", "usage": "الاستخدام الثانوي" },
    { "name": "اسم اللون", "hex": "#XXXXXX", "usage": "لون التمييز" },
    { "name": "اسم اللون", "hex": "#XXXXXX", "usage": "لون الخلفية" }
  ],
  "logoDescription": "وصف تفصيلي للشعار المقترح يشمل الشكل والأسلوب والرموز المستخدمة",
  "brandPersonality": "شخصية العلامة التجارية (مثلاً: فاخرة، شبابية، احترافية، مرحة)",
  "brandVoice": "أسلوب التواصل مع الجمهور (مثلاً: ودي ومهني، عصري وملهم)",
  "typography": {
    "arabic": "نوع خط عربي مقترح مع السبب",
    "latin": "نوع خط لاتيني مقترح مع السبب"
  },
  "rationale": "شرح مختصر لأسباب هذه الاختيارات وكيف تخدم النشاط التجاري والجمهور المستهدف"
}

ملاحظات مهمة:
- اختر ألواناً متناسقة واحترافية تناسب المجال والجمهور المستهدف.
- الأسماء يجب أن تكون سهلة النطق والتذكر.
- الرد يجب أن يكون كائن JSON خام فقط بدون أي نصوص أو شروحات خارجية.`;

  for (const modelName of modelNames) {
    try {
      console.log(`[AI] Attempting full brand identity with model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      console.log(`[AI] ✅ Success with ${modelName}`);
      const cleanedText = cleanJSON(text);
      const parsed = JSON.parse(cleanedText);

      // Validate required fields
      if (!parsed.suggestedName || !parsed.brandColors || !parsed.brandVoice) {
        throw new Error("Invalid response structure — missing required fields");
      }

      return parsed;
    } catch (error: any) {
      console.error(`[AI] ❌ Failed with ${modelName}: ${error.message}`);
      lastError = error;
      if (modelNames.indexOf(modelName) < modelNames.length - 1) {
        const is503 = error.message?.includes('503') || error.message?.includes('Service Unavailable');
        await sleep(is503 ? 3000 : 800);
      }
    }
  }
  throw lastError || new Error("All AI models failed");
}

/**
 * Legacy brand proposal generator — kept for backward compatibility
 * with the /api/ai/suggest-brand endpoint.
 */
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
      if (modelNames.indexOf(modelName) < modelNames.length - 1) {
        await sleep(is503 ? 3000 : 800);
      }
    }
  }
  throw lastError || new Error("All AI models failed");
}

export async function generateLogoSVG(brandName: string, industry: string, colors: string[], baseUrl?: string): Promise<string> {
  const modelNames = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
  const genAI = getGenAI();
  const fs = require('fs');
  const path = require('path');
  const uploadsDir = path.resolve(__dirname, '../../uploads');

  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const prompt = `Create a clean minimalist SVG logo for "${brandName}" in the ${industry} industry. 
  Use colors: ${colors.join(', ')}. 
  Output ONLY the raw SVG code, no markdown, no explanation, just the SVG element.`;

  /**
   * Save SVG content to a file and return the URL
   */
  const saveSvgFile = (svgContent: string): string => {
    const fileName = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.svg`;
    fs.writeFileSync(path.join(uploadsDir, fileName), svgContent, 'utf-8');
    const base = baseUrl || process.env.BASE_URL || 'http://localhost:5000';
    return `${base}/uploads/${fileName}`;
  };

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
        return saveSvgFile(svgMatch[0]);
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
  const fallbackSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="20" fill="${primaryColor}"/>
  <text x="100" y="115" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">${brandName.slice(0, 10)}</text>
  </svg>`;
  return saveSvgFile(fallbackSVG);
}
