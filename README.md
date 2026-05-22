# 👻 Social Media AI Ghostwriter

A production-ready Next.js application that transforms Telegram voice notes and text messages into high-impact social media posts for LinkedIn and X (Twitter), powered by Groq (Whisper + Llama 3) and Firebase.

## 🚀 Features

- **Voice Transcription**: Uses Groq Whisper (`whisper-large-v3`) to transcribe voice notes from Telegram.
- **AI Ghostwriting**: Uses Groq Llama 3 (`llama3-70b-8192`) with a specialized tech-builder persona.
- **Dual Platforms**: Generates optimized variants for both LinkedIn and X.
- **Firestore Integration**: Persists all inputs and outputs for review and tracking.
- **Serverless Ready**: Designed for Vercel deployment.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **AI SDK**: Groq SDK
- **Database**: Firebase Admin SDK (Firestore)
- **Platform**: Telegram Bot API

## 📦 Setup

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Create a `.env.local` file with the following:
   ```env
   TELEGRAM_BOT_TOKEN=your_token
   GROQ_API_KEY=your_groq_key
   FIREBASE_PROJECT_ID=your_id
   FIREBASE_CLIENT_EMAIL=your_email
   FIREBASE_PRIVATE_KEY="your_private_key"
   ```
4. **Set Telegram Webhook**:
   ```text
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_DOMAIN>/api/webhook
   ```

## 📄 License

MIT
