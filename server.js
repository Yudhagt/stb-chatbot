import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { supabase } from './supabaseClient.js'

const ambilData = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')

  console.log(data)
}

ambilData()

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Stb_Chatbot Running 🚀");
});

const client = new OpenAI({
  apiKey: process.env.X5LAB_API_KEY,
  baseURL: "https://api.x5lab.dev/v1",
});

// LIST MODEL FALLBACK
const models = [
  "deepseek-chat",
  "gemini-flash",
  "claude-3-haiku",
  "gpt-4o-mini"
];

// DELAY
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

app.post("/chat", async (req, res) => {

  const { message, model: preferredModel } = req.body;

  console.log("Pesan User:", message);
  console.log("Model dipilih:", preferredModel || "auto (fallback)");

  const attemptModels = preferredModel
    ? [preferredModel, ...models.filter((m) => m !== preferredModel)]
    : models;

  let lastError = null;

  for (const model of attemptModels) {

    try {

      console.log("Mencoba model:", model);

      const completion = await client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content:
              "Kamu adalah AI chatbot bernama Stb_Chatbot dan selalu menjawab dalam bahasa Indonesia.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      });

      const reply =
        completion.choices?.[0]?.message?.content ||
        "AI tidak memberi jawaban";

      console.log("Berhasil pakai model:", model);

      return res.json({
        reply,
        model,
      });

    } catch (error) {

      console.log("Model gagal:", model);
      console.log(error.message);

      lastError = error;

      await sleep(1000);
    }
  }

  res.status(500).json({
    reply:
      "Semua model AI sedang sibuk/server penuh. Coba lagi beberapa menit.",
    error: lastError?.message,
  });
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});