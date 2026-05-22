import Link from 'next/link';

export default function Home() {
  return (
    <main className="container flex flex-col items-center justify-center min-h-[90vh] text-center animate-fade-in">
      <div className="mb-8">
        <span className="badge badge-completed mb-4 inline-block">v2.0 Beta Live</span>
        <h1 className="text-6xl md:text-8xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
          Ghostwriter AI
        </h1>
        <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          The elite social media engine for builders. Turn your voice and text into high-impact posts for LinkedIn and X instantly.
        </p>
      </div>

      <div className="flex gap-4 items-center justify-center">
        <Link href="/dashboard" className="btn-primary text-lg px-8 py-4">
          Open Dashboard
        </Link>
        <a 
          href="https://t.me/your_bot_username" 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn-secondary text-lg px-8 py-4"
        >
          Launch Telegram
        </a>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        <div className="glass glass-card p-8">
          <div className="text-3xl mb-4">🎙️</div>
          <h3 className="text-xl font-bold mb-2">Voice First</h3>
          <p className="text-slate-400">Record a raw thought on Telegram. We handle the polish.</p>
        </div>
        <div className="glass glass-card p-8">
          <div className="text-3xl mb-4">🧠</div>
          <h3 className="text-xl font-bold mb-2">Llama 3.1 Powered</h3>
          <p className="text-slate-400">Context-aware ghostwriting with a sharp tech-builder persona.</p>
        </div>
        <div className="glass glass-card p-8">
          <div className="text-3xl mb-4">📊</div>
          <h3 className="text-xl font-bold mb-2">Cloud Synced</h3>
          <p className="text-slate-400">Access your generated content anywhere via your private dashboard.</p>
        </div>
      </div>
    </main>
  );
}
