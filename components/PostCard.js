'use client';

import { useState } from 'react';

export default function PostCard({ post }) {
  const [copied, setCopied] = useState(null);

  const copyToClipboard = (type) => {
    const content = post.generatedContent;
    if (!content) return;

    let textToCopy = content;
    if (type === 'linkedin') {
      const match = content.match(/### LINKEDIN([\s\S]*?)(### X|$)/);
      textToCopy = match ? match[1].trim() : content;
    } else if (type === 'x') {
      const match = content.match(/### X \(TWITTER\)([\s\S]*?)$/);
      textToCopy = match ? match[1].trim() : content;
    }

    navigator.clipboard.writeText(textToCopy);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="glass glass-card flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <span className={`badge ${post.status === 'completed' ? 'badge-completed' : 'badge-processing'}`}>
          {post.status}
        </span>
        <span className="text-xs text-slate-500">{post.createdAt}</span>
      </div>
      
      <div className="mb-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Raw Input</h3>
        <p className="text-sm text-slate-300 line-clamp-3 italic">
          "{post.rawInput}"
        </p>
      </div>

      <div className="flex-grow">
        <h3 className="text-xs font-bold text-accent uppercase tracking-widest mb-2">Generated Drafts</h3>
        {post.generatedContent ? (
          <div className="text-sm bg-black/30 p-4 rounded-xl border border-white/5 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
            {post.generatedContent}
          </div>
        ) : (
          <div className="flex items-center justify-center p-8 text-slate-600 animate-pulse">
            AI is thinking...
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-white/5 flex gap-2">
        <button 
          onClick={() => copyToClipboard('linkedin')}
          className="btn-secondary text-xs py-2 flex-grow"
        >
          {copied === 'linkedin' ? '✅ Copied' : '📄 Copy LinkedIn'}
        </button>
        <button 
          onClick={() => copyToClipboard('x')}
          className="btn-secondary text-xs py-2 flex-grow"
        >
          {copied === 'x' ? '✅ Copied' : '📄 Copy X Post'}
        </button>
      </div>
    </div>
  );
}
