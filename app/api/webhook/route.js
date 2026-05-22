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

    const body = await req.json();

    // 1. Handle Callback Query (Button Clicks)
    if (body.callback_query) {
      const callback = body.callback_query;
      const [type, payload] = callback.data.split(':');
      chatId = callback.message.chat.id;

      if (type === 'tone') {
        const tone = payload.split('|')[0];
        docId = payload.split('|')[1];
        
        console.log(`[Webhook] Tone selected: ${tone} for doc: ${docId}`);
        
        const db = getDb();
        const doc = await db.collection('posts').doc(docId).get();
        if (!doc.exists) throw new Error("Original post not found.");
        
        const { rawInput } = doc.data();

        // Update Telegram Message
        await fetch(`${TELEGRAM_API}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: callback.message.message_id,
            text: `✨ Generating in ${tone} tone...`,
          }),
        });

        // Trigger AI Generation
        await processAndGenerate(chatId, docId, rawInput, tone);
        return NextResponse.json({ ok: true });
      }

      if (type === 'publish') {
        const platform = payload.split('|')[0];
        docId = payload.split('|')[1];
        
        const db = getDb();
        await db.collection('posts').doc(docId).update({
          [`publishedOn${platform.toUpperCase()}`]: true,
          status: 'published',
        });

        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callback.id,
            text: `✅ Published to ${platform}!`,
          }),
        });
        
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Validate Regular Telegram Message
    if (!body.message) {
      return NextResponse.json({ ok: true });
    }

    chatId = body.message.chat.id;
    let textToProcess = '';

    // 3. Handle Refinement (Reply to AI Message)
    if (body.message.reply_to_message) {
      console.log(`[Webhook] Refinement requested for chatId: ${chatId}`);
      const feedback = body.message.text;
      const originalOutput = body.message.reply_to_message.text;

      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: "🔄 Refining based on your feedback..." }),
      });

      // Trigger Refinement AI Generation
      await processAndRefine(chatId, originalOutput, feedback);
      return NextResponse.json({ ok: true });
    }

    // 4. Handle Regular Text or Voice
    if (body.message.text) {
      textToProcess = body.message.text;
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
        const voiceFile = new File([audioBlob], "voice.ogg", { type: "audio/ogg" });
        
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
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: "👋 AI Ghostwriter is active!\n\nSend me any text or voice note, then choose your tone.",
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // 4. Initial Firestore Logging
    console.log("[Webhook] Step 3: Firestore write...");
    const db = getDb();
    if (!db) throw new Error("Firestore not initialized.");

    const postRef = await db.collection('posts').add({
      chatId,
      rawInput: textToProcess,
      status: 'pending_tone',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    docId = postRef.id;

    // 5. Ask for Tone
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🎯 Select your preferred tone:",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "👔 Professional", callback_data: `tone:Professional|${docId}` },
              { text: "🔥 Viral/Hype", callback_data: `tone:Viral|${docId}` }
            ],
            [
              { text: "🤣 Sarcastic", callback_data: `tone:Sarcastic|${docId}` },
              { text: "🛹 Casual", callback_data: `tone:Casual|${docId}` }
            ]
          ]
        }
      }),
    });

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

async function processAndRefine(chatId, originalOutput, feedback) {
  try {
    const db = getDb();
    
    console.log(`[Webhook] Refining post for chatId: ${chatId}`);
    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are a sharp tech ghostwriter. 
          A user is asking to refine a previous set of social media posts.
          Keep exactly two variants with headings: ### LINKEDIN and ### X (TWITTER).` 
        },
        { 
          role: "user", 
          content: `ORIGINAL POSTS:\n${originalOutput}\n\nUSER FEEDBACK:\n${feedback}\n\nPlease update the posts based on the feedback.`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
    });

    const refinedContent = completion.choices[0]?.message?.content || 'Refinement failed.';

    // Send Refined Result
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: `✨ Refined Version:\n\n${refinedContent}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Publish LinkedIn", callback_data: `publish:linkedin|refined` },
              { text: "✅ Publish X", callback_data: `publish:x|refined` }
            ]
          ]
        }
      }),
    });
  } catch (err) {
    console.error("Async Refinement Error:", err);
  }
}
async function processAndGenerate(chatId, docId, rawInput, tone) {
  try {
    const db = getDb();
    
    // 4. Groq Generation
    console.log(`[Webhook] Generating with model: llama-3.1-8b-instant, Tone: ${tone}`);
    const completion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are a sharp tech-builder ghostwriter with a ${tone} tone. 
          Return exactly two variants with headings: 
          ### LINKEDIN
          ### X (TWITTER)` 
        },
        { role: "user", content: `Write posts based on: ${rawInput}` }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
    });

    const generatedContent = completion.choices[0]?.message?.content || 'Generation failed.';

    // 5. Firestore Update
    await db.collection('posts').doc(docId).update({
      generatedContent,
      tone,
      status: 'completed',
    });

    // 6. Telegram Dispatch with Publish buttons
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: generatedContent,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Publish LinkedIn", callback_data: `publish:linkedin|${docId}` },
              { text: "✅ Publish X", callback_data: `publish:x|${docId}` }
            ]
          ]
        }
      }),
    });
  } catch (err) {
    console.error("Async Generation Error:", err);
  }
}

