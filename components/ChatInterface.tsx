import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { Send, User as UserIcon } from 'lucide-react';
import { TranslationKey } from '../services/translations';

interface ChatInterfaceProps {
    currentUser: User;
    otherUser: User;
    messages: Message[];
    onSendMessage: (content: string) => void;
    onMarkRead: (messageIds: string[]) => void;
    t: (key: TranslationKey) => string;
    canReply: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ currentUser, otherUser, messages, onSendMessage, onMarkRead, t, canReply }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Mark messages as read when viewing
        const unreadIds = messages
            .filter(m => m.receiverId === currentUser.id && !m.read)
            .map(m => m.id);
        
        if (unreadIds.length > 0) {
            onMarkRead(unreadIds);
        }
        scrollToBottom();
    }, [messages, currentUser.id, onMarkRead]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim()) {
            onSendMessage(newMessage);
            setNewMessage('');
        }
    };

    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    {otherUser.name.charAt(0)}
                 </div>
                 <div>
                     <h3 className="font-bold text-gray-900">{otherUser.name}</h3>
                     <p className="text-xs text-gray-500">{t(canReply ? 'chat_with' : 'assigned_by')}</p>
                 </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {sortedMessages.length === 0 && (
                    <div className="text-center text-gray-400 py-10 text-sm">{t('no_messages')}</div>
                )}
                {sortedMessages.map(msg => {
                    const isMe = msg.senderId === currentUser.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div 
                                className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm relative ${
                                    isMe 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
                                }`}
                            >
                                {msg.content}
                                <div className={`text-[9px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {isMe && msg.read && <span className="ml-1">✓✓</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Only for Coach */}
            {canReply && (
                <form onSubmit={handleSend} className="p-3 border-t border-gray-100 bg-white flex gap-2">
                    <input 
                        className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                        placeholder={t('type_message')}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button 
                        type="submit" 
                        disabled={!newMessage.trim()}
                        className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                    >
                        <Send size={18} />
                    </button>
                </form>
            )}
        </div>
    );
};

export default ChatInterface;