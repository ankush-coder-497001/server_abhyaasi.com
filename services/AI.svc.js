// chatService.js
import Groq from "groq-sdk";
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const client = new MongoClient(process.env.MONGODB_URI);
let collection;


const datasetPath = path.join(process.cwd(), "data", "platform.json");
let dataset = [];


function loadDataset() {
  try {
    const raw = fs.readFileSync(datasetPath, "utf8");
    dataset = JSON.parse(raw);

    // Convert long data into chunks array
    dataset = Object.entries(dataset).map(([key, value]) => ({
      key,
      text: typeof value === "string" ? value : JSON.stringify(value)
    }));

    console.log("Dataset Loaded:", dataset.length, "chunks");
  } catch (err) {
    console.error("Dataset Load Error:", err);
  }
}

loadDataset();

// -----------------------------
// HELPER: Get Embedding
// -----------------------------
async function generateEmbedding(text) {
  const response = await groq.embeddings.create({
    model: "llama-embed",
    input: text
  });
  return response.data[0].embedding;
}

async function searchLocalData(userEmbedding) {
  const score = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
    return sum;
  };

  const scored = [];

  for (const item of dataset) {
    const emb = await generateEmbedding(item.text);
    const similarity = score(userEmbedding, emb);

    scored.push({
      text: item.text,
      score: similarity
    });
  }

  // Sort best match first
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 3);
}


async function initDB() {
  if (!collection) {
    await client.connect();
    const db = client.db("abhyasi");
    collection = db.collection("embeddings");
    console.log("MongoDB Connected");
  }
}
initDB();

async function askPureAI(message) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: "You are a helpful educational tutor."
      },
      {
        role: "user",
        content: message
      }
    ]
  });

  return completion.choices[0].message.content;
}

export async function chatWithAI(message, embedding = null, typeVoice = false) {
  try {

    if (typeVoice) {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are an educational AI assistant. keep the response concise and clear and short." },
          { role: "user", content: message }
        ]
      });
      return completion.choices[0].message.content;
    }

    if (!embedding) {
      return await askPureAI(message);
    }

    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: embedding,
            numCandidates: 20,
            limit: 3,
            include: { score: true }
          }
        }
      ])
      .toArray();

    const topMatch = results[0];
    const relevant = topMatch && topMatch.score > 0.50;

    if (!relevant) {
      return await askPureAI(message);
    }

    const context = results.map((r) => r.text).join("\n\n");

    const ragPrompt = `
You are Abhyasi Educational AI.
Use ONLY the context below to answer accurately.
If answer is not in context, say: "Not available in Abhyasi content".

CONTEXT:
${context}

QUESTION:
${message}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are an educational AI assistant." },
        { role: "user", content: ragPrompt }
      ]
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.error("Chat Service Error:", err);
    return "Something went wrong, please try again.";
  }
}

export async function chatWithAIRelatedPlatform(message) {
  try {
    const results = await searchLocalData(await generateEmbedding(message));
    const topMatch = results[0];
    const relevant = topMatch && topMatch.score > 0.75;
    if (!relevant) {
      return "No relevant platform information found.";
    }
    const context = results.map((r) => r.text).join("\n\n");

    const ragPrompt = `
You are Abhyasi Platform AI.
Use ONLY the context below to answer accurately.
If answer is not in context, say: "Not available in Abhyasi platform content".
CONTEXT:
${context}
QUESTION:
${message}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are an educational AI assistant." },
        { role: "user", content: ragPrompt }
      ]
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Chat With AI Related Platform Error:", error);
    return "Error processing request.";
  }
}
