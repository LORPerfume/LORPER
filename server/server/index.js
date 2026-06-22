import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../client")));

const SYSTEM_PROMPT = `
أنت "مساعد صرح المحاسبي الذكي".
أنت مساعد تدريبي متخصص في الأعمال المحاسبية العملية في الأردن.

تساعد المستخدم في:
- القيود المحاسبية
- شجرة الحسابات
- تصنيف الحسابات
- المشتريات والمبيعات
- الشيكات المقبوضة والمدفوعة
- الرواتب
- الضمان الاجتماعي
- ضريبة الدخل
- ضريبة المبيعات
- مذكرة تسوية البنك
- القوائم المالية
- إغلاق الحسابات
- إعداد التقارير والمراسلات المالية

قواعد مهمة:
1. أجب باللغة العربية بشكل واضح ومهني.
2. اجعل الإجابة تدريبية وعملية.
3. عند إعطاء قيود محاسبية، اكتبها بصيغة:
   من حـ/ ...
   إلى حـ/ ...
4. إذا كان السؤال ضريبي أو قانوني، وضح أن الإجابة تعليمية ولا تعتبر استشارة قانونية أو ضريبية نهائية.
5. إذا كانت البيانات ناقصة، اطلب البيانات المطلوبة قبل إعطاء جواب نهائي.
6. لا تخترع نسب أو مواد قانونية غير مؤكدة.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "الرسالة فارغة" });
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    res.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "حدث خطأ في الاتصال بالمساعد الذكي",
    });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Sarh AI Accounting Assistant is running on port ${process.env.PORT || 3000}`);
});
