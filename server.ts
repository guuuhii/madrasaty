import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazily load and verify Gemini client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY configuration variable is missing. Please add it in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Hybrid endpoint: supports multimodal OCR file ingestion OR pure AI prompt-based question generation
app.post("/api/gemini/parse", async (req, res) => {
  try {
    const { fileData, mimeType, prompt, generateCount, subject, difficulty } = req.body;
    const ai = getGeminiClient();

    const systemPrompt = `You are Q-Bank Pro, an elite Arabic academic system designed to generate and extract questions.
Generate or extract structured questions in pure classical Arabic.
Return an array of JSON objects matching the schema.

For each question object:
1. Provide the main 'question_text' in elegant academic Arabic.
2. Provide 'options' which must be an array of exactly 4 choices in Arabic.
3. Specify 'correct_answer', which MUST be 'أ' or 'ب' or 'ج' or 'د' representing index 0, 1, 2, or 3 of the options array respectively.
4. Set the 'subject' category in Arabic (default to: '${subject || "العلوم العامة"}').
5. Set the 'difficulty' in Arabic (default to: '${difficulty || "متوسط"}').

Do not output any introductory or summary text. Output strictly JSON.`;

    const contents: any[] = [];
    
    if (fileData) {
      // Multimodal OCR flow
      contents.push({
        inlineData: {
          mimeType: mimeType || "image/png",
          data: fileData
        }
      });
      contents.push({
        text: prompt || "قم بقراءة الصورة المرفقة واستخراج جميع الأسئلة التعليمية وتنسيقها بشكل مثالي في بنية JSON المطلوبة."
      });
    } else {
      // Pure text-generation flow
      const numQs = generateCount || 5;
      const genPrompt = prompt || `أريد توليد عدد ${numQs} أسئلة ممتازة ومتكاملة في مادة '${subject || "العلوم العامة"}' بمستوى صعوبة '${difficulty || "متوسط"}' مع الخيارات الأربعة وتحديد الإجابة الصحيحة.`;
      contents.push({
        text: genPrompt
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of generated or extracted academic questions",
          items: {
            type: Type.OBJECT,
            properties: {
              question_text: { type: Type.STRING, description: "Text of the academic question in elegant Arabic" },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Array of exactly 4 multiple-choice options"
              },
              correct_answer: { type: Type.STRING, description: "Letter index of correct answer: MUST be 'أ', 'ب', 'ج', or 'د'" },
              subject: { type: Type.STRING, description: "Subject category" },
              difficulty: { type: Type.STRING, description: "Difficulty: 'سهل', 'متوسط', 'صعب'" }
            },
            required: ["question_text", "options", "correct_answer", "subject", "difficulty"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No structured output returned from Google Gemini.");
    }

    const questions = JSON.parse(text.trim());
    return res.json({ success: true, questions });
  } catch (error: any) {
    console.error("Gemini Server Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "عذراً، فشل الاتصال بخدمة الذكاء الاصطناعي لإنشاء الأسئلة."
    });
  }
});

// Clean server health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Q-Bank Pro Engine" });
});

// Serve frontend assets via Vite middleware in dev or express.static in prod
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Q-Bank Pro server running at http://0.0.0.0:${PORT}`);
  });
}

start();
