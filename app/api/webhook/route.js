import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { getDb, admin } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs'; // Ensure we are NOT on Edge runtime

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export async function POST(req) {
  let chatId = null;
  let docId = null;

  try {
    // Check Config
    if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
    if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");

    console.log("[Webhook] Step 1: Parsing JSON body...");
    const body = await req.json();

    if (!body.message) {
      console.log("[Webhook] No message object found in body");
      return NextResponse.json({ ok: true });
    }

    chatId = body.message.chat.id;
    let textToProcess = '';

    // 2. Handle Text or Voice
    if (body.message.text) {
      textToProcess = body.message.text;
      console.log(`[Webhook] Step 2: Received text: ${textToProcess.substring(0, 20)}`);
    } else if (body.message.voice) {
      console.log(`[Webhook] Step 2: Received voice note`);
      const fileId = body.message.voice.file_id;
      
      const fileResponse = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
      const fileData = await fileResponse.json();
      
      if (fileData.ok) {
        const filePath = fileData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
        
        const audioResponse = await fetch(downloadUrl);
        const audioBlob = await audioResponse.blob();
        
        const voiceFile = new File([audioBlob], "voice.oga", { type: "audio/ogg" });
        
        const transcription = await groq.audio.transcriptions.create({
          file: voiceFile,
          model: "whisper-large-v3",
        });
        
        textToProcess = transcription.text;
        console.log(`[Webhook] Transcription success: ${textToProcess.substring(0, 20)}`);
      } else {
        throw new Error('Telegram getFile failed');
      }
    }

    if (!textToProcess) return NextResponse.json({ ok: true });

    // Handle Start
    if (textToProcess.trim().toLowerCase() === '/start') {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "👋 Bot is active! Send me text or voice." }),
      });
      return NextResponse.json({ ok: true });
    }

    // 3. Firestore Logging
    console.log("[Webhook] Step 3: Firestore write...");
    const db = getDb();
    if (!db) throw new Error("Firestore not initialized. Check your credentials.");

    try {
      const postRef = await db.collection('posts').add({
        chatId,
        rawInput: textToProcess,
        status: 'processing',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      docId = postRef.id;
      console.log(`[Webhook] Firestore doc created: ${docId}`);
    } catch (fsError) {
      console.error("[Webhook] Firestore Add Error:", fsError);
      throw new Error(`Firestore Error: ${fsError.message}`);
    }

    // 4. Groq Generation
    console.log("[Webhook] Step 4: Groq Generation...");
    let generatedContent = '';
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are a tech ghostwriter. Return 1 LinkedIn post and 1 X post." },
          { role: "user", content: textToProcess }
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
      });
      generatedContent = completion.choices[0]?.message?.content || 'Generation failed.';
      console.log("[Webhook] Groq Generation success");
    } catch (groqError) {
      console.error("[Webhook] Groq Error:", groqError);
      throw new Error(`Groq Error: ${groqError.message}`);
    }

    // 5. Firestore Update
    console.log("[Webhook] Step 5: Firestore Update...");
    await db.collection('posts').doc(docId).update({
      generatedContent,
      status: 'completed',
    });

    // 6. Telegram Dispatch
    console.log("[Webhook] Step 6: Telegram Send...");
    const finalResponse = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: generatedContent }),
    });

    if (!finalResponse.ok) {
      const errorText = await finalResponse.text();
      throw new Error(`Telegram Dispatch failed: ${errorText}`);
    }

    console.log("[Webhook] Execution finished successfully.");
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[Webhook Critical Error]:', error);
    
    if (chatId) {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ Internal Error: ${error.message.substring(0, 100)}`,
        }),
      }).catch(e => console.error('Failed to send error alert:', e));
    }

    return NextResponse.json({ ok: true });
  }
}
