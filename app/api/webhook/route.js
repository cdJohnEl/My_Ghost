import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { db, admin } from '@/lib/firebaseAdmin';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export async function POST(req) {
  try {
    const body = await req.json();

    // 1. Validate Telegram Message
    if (!body.message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = body.message.chat.id;
    let textToProcess = '';
    let docId = null;

    // 2. Handle Text or Voice
    if (body.message.text) {
      textToProcess = body.message.text;
    } else if (body.message.voice) {
      const fileId = body.message.voice.file_id;
      
      // Get file path from Telegram
      const fileResponse = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
      const fileData = await fileResponse.json();
      
      if (fileData.ok) {
        const filePath = fileData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
        
        // Download voice file
        const audioResponse = await fetch(downloadUrl);
        const audioBlob = await audioResponse.blob();
        
        // Convert to virtual File object for Groq
        const voiceFile = new File([audioBlob], "voice.oga", { type: "audio/ogg" });
        
        // Transcribe using Groq Whisper
        const transcription = await groq.audio.transcriptions.create({
          file: voiceFile,
          model: "whisper-large-v3",
        });
        
        textToProcess = transcription.text;
      } else {
        throw new Error('Failed to retrieve voice file from Telegram');
      }
    }

    if (!textToProcess) {
      return NextResponse.json({ ok: true });
    }

    // 3. Firestore Logging (Pre-generation)
    const postRef = await db.collection('posts').add({
      chatId,
      rawInput: textToProcess,
      status: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    docId = postRef.id;

    // 4. Groq Post Generation (Llama 3 70B)
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a sharp, anti-cringe tech-builder ghostwriter. 
          Your style is punchy, high-signal, and avoids corporate fluff or overused AI buzzwords. 
          You write with a realistic, human rhythm.
          Return EXACTLY two variants explicitly separated by these markdown headings:
          ### 👔 LINKEDIN OPTION
          ### 🐦 X (TWITTER) OPTION`
        },
        {
          role: "user",
          content: `Transform this input into a high-impact LinkedIn post and a viral X (Twitter) post: ${textToProcess}`
        }
      ],
      model: "llama3-70b-8192",
      temperature: 0.7,
    });

    const generatedContent = completion.choices[0]?.message?.content || 'Generation failed.';

    // 5. Firestore Logging (Post-generation)
    await db.collection('posts').doc(docId).update({
      generatedContent,
      status: 'completed',
    });

    // 6. Telegram Dispatch
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: generatedContent,
        parse_mode: 'Markdown',
      }),
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    
    // Attempt to send error message back to user
    const body = await req.clone().json().catch(() => ({}));
    const chatId = body?.message?.chat?.id;
    
    if (chatId) {
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ Error processing your request: ${error.message}`,
        }),
      }).catch(err => console.error('Error sending Telegram error message:', err));
    }

    return NextResponse.json({ ok: true }); // Always return 200 to stop Telegram retries
  }
}
