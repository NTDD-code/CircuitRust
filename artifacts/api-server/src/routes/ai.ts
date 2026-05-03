import { Router } from "express";
import { AiChatBody, GetOllamaModelsBody, CheckOllamaStatusBody } from "@workspace/api-zod";

const router = Router();

router.post("/ai/chat", async (req, res) => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { provider, model, systemPrompt, userMessage, apiKey, googleApiKey, ollamaUrl } = parsed.data;

  if (provider === "cloud") {
    const key = apiKey || process.env["ANTHROPIC_API_KEY"];
    if (!key) {
      res.status(400).json({ error: "No Anthropic API key configured. Set ANTHROPIC_API_KEY env var or pass apiKey in request." });
      return;
    }

    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: key });
      const message = await client.messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      res.json({ response: text, provider: "cloud", model });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Anthropic API error: ${msg}` });
    }
    return;
  }

  if (provider === "google") {
    const key = googleApiKey || process.env["GOOGLE_API_KEY"];
    if (!key) {
      res.status(400).json({ error: "No Google API key configured. Pass googleApiKey in request." });
      return;
    }

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey: key });
      const result = await client.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userMessage}` }],
          },
        ],
      });
      const text = result.text ?? "";
      res.json({ response: text, provider: "google", model });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `Google Gemini API error: ${msg}` });
    }
    return;
  }

  if (provider === "local") {
    const baseUrl = ollamaUrl || "http://localhost:11434";
    try {
      const ollamaRes = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: userMessage, system: systemPrompt, stream: false }),
        signal: AbortSignal.timeout(60000),
      });
      if (!ollamaRes.ok) {
        res.status(502).json({ error: `Ollama responded with ${ollamaRes.status}` });
        return;
      }
      const data = (await ollamaRes.json()) as { response?: string };
      res.json({ response: data.response ?? "", provider: "local", model });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `Ollama error: ${msg}` });
    }
    return;
  }

  res.status(400).json({ error: "Invalid provider" });
});

router.post("/ollama/models", async (req, res) => {
  const parsed = GetOllamaModelsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { baseUrl } = parsed.data;
  try {
    const r = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      res.json({ models: [], alive: false });
      return;
    }
    const data = (await r.json()) as { models?: Array<{ name: string; size: number; modified_at?: string }> };
    const models = (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
      modified: m.modified_at ?? "",
    }));
    res.json({ models, alive: true });
  } catch {
    res.json({ models: [], alive: false });
  }
});

router.post("/ollama/status", async (req, res) => {
  const parsed = CheckOllamaStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { baseUrl } = parsed.data;
  try {
    const r = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) {
      res.json({ alive: false });
      return;
    }
    const data = (await r.json()) as { version?: string };
    res.json({ alive: true, version: data.version ?? "" });
  } catch {
    res.json({ alive: false });
  }
});

router.post("/ollama/pull", async (req, res) => {
  const { baseUrl = "http://localhost:11434", model } = req.body as { baseUrl?: string; model?: string };
  if (!model) {
    res.status(400).json({ error: "model is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const ollamaRes = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model, stream: true }),
      signal: AbortSignal.timeout(600000),
    });

    if (!ollamaRes.ok || !ollamaRes.body) {
      res.write(`data: ${JSON.stringify({ error: `Ollama responded with ${ollamaRes.status}` })}\n\n`);
      res.end();
      return;
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          res.write(`data: ${line}\n\n`);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ status: "success" })}\n\n`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
