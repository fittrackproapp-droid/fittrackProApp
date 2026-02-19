
import React from 'react';
import { User, Message, UserRole } from '../types';
import { Mail, Send, Calendar, Clock, CheckCheck, ChevronRight, User as UserIcon } from 'lucide-react';
import { TranslationKey } from '../services/translations';

interface InboxViewProps {
    currentUser: User;
    messages: Message[];
    users: User[]; // All users to resolve names
    otherUser?: User; // Optional: used when coach is looking at a specific trainee's thread
    onSendMessage?: (content: string) => void;
    onMarkRead: (messageIds: string[]) => void;
    onSelectUser?: (userId: string) => void;
    t: (key: TranslationKey) => string;
}

const InboxView: React.FC<InboxViewProps> = ({ currentUser, messages, users, otherUser, onSendMessage, onMarkRead, onSelectUser, t }) => {
    const [newMessage, setNewMessage] = React.useState('');

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (onSendMessage && newMessage.trim()) {
            onSendMessage(newMessage);
            setNewMessage('');
        }
    };

    const handleMarkAllRead = () => {
         const unreadIds = messages
            .filter(m => m.receiverId === currentUser.id && !m.read)
            .map(m => m.id);
        
        if (unreadIds.length > 0) {
            onMarkRead(unreadIds);
        }
    };

    const handleMessageClick = (msg: Message) => {
        if (msg.receiverId === currentUser.id && !msg.read) {
            onMarkRead([msg.id]);
        }
    };

    // --- COACH: THREAD LIST VIEW (No specific user selected) ---
    if (currentUser.role === UserRole.COACH && !otherUser) {
        // Group messages by conversation partner
        const partnerIds = Array.from(new Set(messages.map(m => m.senderId === currentUser.id ? m.receiverId : m.senderId)));
        
        const threads = partnerIds.map(pid => {
            const partner = users.find(u => u.id === pid);
            if (!partner) return null;
            const threadMsgs = messages.filter(m => m.senderId === pid || m.receiverId === pid);
            if (threadMsgs.length === 0) return null;
            
            const lastMsg = threadMsgs.sort((a, b) => b.timestamp - a.timestamp)[0];
            const unreadCount = threadMsgs.filter(m => m.receiverId === currentUser.id && !m.read).length;
            
            return { partner, lastMsg, unreadCount };
        }).filter((t): t is { partner: User, lastMsg: Message, unreadCount: number } => t !== null)
          .sort((a, b) => b.lastMsg.timestamp - a.lastMsg.timestamp);

        return (
            <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                 <div className="flex items-center justify-between px-1 mb-2">
                    <h3 className="font-bold text-gray-500 text-xs uppercase tracking-widest">
                        {t('conversations')} ({threads.length})
                    </h3>
                 </div>

                 {threads.length === 0 && (
                    <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                        <Mail className="mx-auto text-gray-300 mb-3" size={48} />
                        <p className="text-gray-400 text-sm">{t('no_messages')}</p>
                    </div>
                 )}

                 {threads.map(thread => (
                     <div 
                        key={thread.partner.id}
                        onClick={() => onSelectUser && onSelectUser(thread.partner.id)}
                        className="bg-white p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition cursor-pointer flex items-center justify-between group"
                     >
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                    {thread.partner.name.charAt(0)}
                                </div>
                                {thread.unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                                        {thread.unreadCount}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h4 className={`font-bold ${thread.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                    {thread.partner.name}
                                </h4>
                                <p className={`text-sm max-w-[200px] md:max-w-md truncate ${thread.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                    {thread.lastMsg.senderId === currentUser.id ? 'You: ' : ''}{thread.lastMsg.content}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                {new Date(thread.lastMsg.timestamp).toLocaleDateString()}
                            </span>
                            <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition" />
                        </div>
                     </div>
                 ))}
            </div>
        );
    }

    // --- STANDARD CHAT VIEW ---

    const sortedMessages = [...messages].sort((a, b) => b.timestamp - a.timestamp);
    const unreadCount = messages.filter(m => m.receiverId === currentUser.id && !m.read).length;

    const getSenderName = (senderId: string) => {
        if (senderId === currentUser.id) return t('role_trainee'); // Or "Me"
        const u = users.find(user => user.id === senderId);
        return u ? u.name : 'Unknown';
    }

    return (
        <div className="flex flex-col gap-6 max-w-3xl mx-auto">
            {/* Header Actions */}
            <div className="flex items-center justify-between px-1">
                 <h3 className="font-bold text-gray-500 text-xs uppercase tracking-widest">
                    {otherUser ? `${t('chat_with')} ${otherUser.name}` : t('conversations')}
                </h3>
                {unreadCount > 0 && (
                    <button 
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition"
                    >
                        <CheckCheck size={14} />
                        {t('mark_all_read')}
                    </button>
                )}
            </div>

            {/* Compose Section - Only for Coach */}
            {currentUser.role === UserRole.COACH && otherUser && (
                <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Send size={20} className="text-indigo-600" />
                        {t('send_message')} {t('to')} {otherUser.name}
                    </h3>
                    <form onSubmit={handleSend} className="space-y-4">
                        <textarea 
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition min-h-[100px] resize-none"
                            placeholder={t('type_message')}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                        />
                        <div className="flex justify-end">
                            <button 
                                type="submit" 
                                disabled={!newMessage.trim()}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md flex items-center gap-2"
                            >
                                {t('send')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Message List */}
            <div className="space-y-4">
                
                {sortedMessages.length === 0 && (
                    <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                        <Mail className="mx-auto text-gray-300 mb-3" size={48} />
                        <p className="text-gray-400 text-sm">{t('no_messages')}</p>
                    </div>
                )}

                {sortedMessages.map(msg => {
                    const isMe = msg.senderId === currentUser.id;
                    const date = new Date(msg.timestamp);
                    const isUnread = !msg.read && !isMe;
                    const senderName = isMe ? t('role_trainee') + ' (Me)' : getSenderName(msg.senderId);
                    
                    return (
                        <div 
                            key={msg.id} 
                            onClick={() => handleMessageClick(msg)}
                            className={`bg-white rounded-2xl p-5 border shadow-sm transition-all cursor-pointer group ${
                                isUnread 
                                ? 'border-indigo-300 ring-2 ring-indigo-50 bg-indigo-50/10' 
                                : 'border-gray-100 hover:border-gray-200'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                        isMe ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {isMe ? 'M' : senderName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className={`text-sm ${isUnread ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                                            {isMe ? 'Me' : senderName}
                                        </p>
                                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                            <span className="flex items-center gap-1"><Calendar size={10}/> {date.toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1"><Clock size={10}/> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                                {isUnread && (
                                    <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm animate-pulse">New</span>
                                )}
                            </div>
                            <p className={`text-sm leading-relaxed whitespace-pre-wrap pl-11 ${isUnread ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>
                                {msg.content}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InboxView;
