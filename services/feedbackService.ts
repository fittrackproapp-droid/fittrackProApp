
import { Exercise } from '../types';

// Mock list of exercises for simple keyword-based suggestions
const LIBRARY_EXERCISES: Exercise[] = [
  { id: 'c1', name: 'Barbell Bench Press', category: 'Chest', description: 'Compound chest exercise.' },
  { id: 'c2', name: 'Incline Dumbbell Press', category: 'Chest', description: 'Upper chest focus.' },
  { id: 'b1', name: 'Deadlift', category: 'Back', description: 'Full body compound.' },
  { id: 'b2', name: 'Pull-ups', category: 'Back', description: 'Vertical pull.' },
  { id: 'l1', name: 'Barbell Squat', category: 'Legs', description: 'King of leg exercises.' },
  { id: 's1', name: 'Overhead Press', category: 'Shoulders', description: 'Vertical push.' },
  { id: 'a1', name: 'Barbell Curls', category: 'Arms', description: 'Bicep builder.' },
  { id: 'x1', name: 'Plank', category: 'Core', description: 'Static hold.' },
];

const MOTIVATIONAL_QUOTES = [
  "Fantastic work on those sets!",
  "Keep up the great intensity!",
  "Your form is looking solid. Keep at it!",
  "Great effort today, you're getting stronger!",
  "Consistency is key, and you nailed it today.",
  "That was a strong session. Well done!",
  "Patience and persistence pay off. Great job!"
];

/**
 * Replaces the AI-powered exercise suggestion with a simple keyword filter.
 */
export const generateExerciseSuggestions = async (prompt: string): Promise<Exercise[]> => {
    // Delay slightly to simulate a "service" call
    await new Promise(r => setTimeout(r, 400));
    
    const lowerPrompt = prompt.toLowerCase();
    const filtered = LIBRARY_EXERCISES.filter(ex => 
        ex.name.toLowerCase().includes(lowerPrompt) || 
        ex.category.toLowerCase().includes(lowerPrompt)
    );

    // If no match, return some random defaults
    if (filtered.length === 0) {
        return LIBRARY_EXERCISES.slice(0, 3).map(ex => ({
            ...ex,
            id: crypto.randomUUID()
        }));
    }

    return filtered.map(ex => ({
        ...ex,
        id: crypto.randomUUID()
    }));
};

/**
 * Replaces the AI-powered feedback with a randomized static quote.
 */
export const getMotivationalFeedback = async (exerciseNames: string): Promise<string> => {
    // Delay slightly to simulate a "service" call
    await new Promise(r => setTimeout(r, 200));
    
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    return MOTIVATIONAL_QUOTES[randomIndex];
};
