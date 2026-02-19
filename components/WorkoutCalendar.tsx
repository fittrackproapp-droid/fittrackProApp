import React, { useState } from 'react';
import { Submission } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TranslationKey } from '../services/translations';

interface WorkoutCalendarProps {
    submissions: Submission[];
    onDateSelect: (date: Date) => void;
    t: (key: TranslationKey) => string;
}

const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ submissions, onDateSelect, t }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Adjust for Sunday start (0) vs Monday start if needed, currently Standard Sun=0
    
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const days = [];
    // Padding
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`pad-${i}`} className="h-10 md:h-14"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        // Normalize time for comparison
        const startOfDay = new Date(year, month, d).setHours(0,0,0,0);
        const endOfDay = new Date(year, month, d).setHours(23,59,59,999);

        const subs = submissions.filter(s => s.timestamp >= startOfDay && s.timestamp <= endOfDay);
        const hasPending = subs.some(s => s.status === 'PENDING');
        const hasCompleted = subs.some(s => s.status === 'COMPLETED');

        let indicator = null;
        if (hasPending) indicator = "bg-yellow-400";
        else if (hasCompleted) indicator = "bg-green-500";

        days.push(
            <div 
                key={d} 
                onClick={() => onDateSelect(date)}
                className="h-10 md:h-14 border border-gray-100 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition relative rounded-lg"
            >
                <span className={`text-sm ${indicator ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{d}</span>
                {indicator && (
                    <div className={`w-1.5 h-1.5 rounded-full ${indicator} mt-1`} />
                )}
            </div>
        );
    }

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const weekDays: TranslationKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-gray-100">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-200 rounded-full"><ChevronLeft size={20} /></button>
                <h3 className="font-bold text-gray-800">{monthNames[month]} {year}</h3>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-200 rounded-full"><ChevronRight size={20} /></button>
            </div>
            <div className="grid grid-cols-7 text-center border-b border-gray-100">
                {weekDays.map(d => (
                    <div key={d} className="py-2 text-xs font-bold text-gray-400 uppercase">{t(d)}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 p-2 gap-1">
                {days}
            </div>
            <div className="p-2 flex gap-4 text-xs justify-center border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> {t('col_status')}: {t('status_completed')}</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> {t('col_status')}: {t('status_pending')}</div>
            </div>
        </div>
    );
};

export default WorkoutCalendar;
