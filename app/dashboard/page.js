import { getDb } from '@/lib/firebaseAdmin';
import Link from 'next/link';
import PostCard from '@/components/PostCard';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const db = getDb();
  let posts = [];

  if (db) {
    const snapshot = await db.collection('posts')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toLocaleString() || 'Just now',
    }));
  }

  return (
    <div className="container py-12 animate-fade-in mb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <Link href="/" className="text-slate-500 hover:text-white transition-colors mb-2 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-extrabold tracking-tight">Post Vault</h1>
        </div>
        <div className="glass p-4 px-6 flex items-center gap-4">
          <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Active Bot</p>
            <p className="font-mono text-accent">@your_bot_username</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        {posts.length === 0 && (
          <div className="col-span-full py-32 text-center glass glass-card">
            <h2 className="text-2xl font-bold mb-2">Your vault is empty</h2>
            <p className="text-slate-500 mb-8">Send a voice note or text to your bot to see it here.</p>
            <Link href="/" className="btn-primary">Return Home</Link>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
