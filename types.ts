
export enum UserRole {
  ADMIN = 'ADMIN',
  COACH = 'COACH',
  TRAINEE = 'TRAINEE'
}

export interface User {
  id: string;
  email: string; // Used for login
  password?: string; // Mock password
  name: string;
  role: UserRole;
  coachId?: string | null; // If Trainee, who is their coach?
  points: number; // For trainees
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description: string;
}

// Represents the long-term standing instructions for a trainee
export interface WorkoutPlan {
  id: string;
  coachId: string;
  traineeId: string;
  exerciseIds: string[];
  lastUpdated: number;
}

export interface Submission {
  id: string;
  planId: string;
  traineeId: string;
  exerciseIds: string[]; // Which exercises were performed in this specific session
  videoIds: string[]; // List of Keys for IndexedDB (supports multiple videos)
  timestamp: number;
  status: 'PENDING' | 'COMPLETED';
  feedback?: string;
  traineeNote?: string; // Note from trainee to coach
  pointsAwarded?: number; // Points given for this specific session
  videosDeleted?: boolean; // Flag if videos were manually or automatically deleted
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  read: boolean;
}
