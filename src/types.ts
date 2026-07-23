export interface HealthData {
  id: string;
  label: string; // e.g., "熬夜爆肝程式碼" (Late-night coding fatigue)
  heartRate: number; // bpm
  bloodPressure: string; // mmHg
  sleepDuration: number; // hours
  fatigueLevel: 'Low' | 'Medium' | 'High';
  stressLevel: 'Chill' | 'Productive' | 'Overloaded';
  bodyTemperature: number; // °C
}

export interface RecommendedSong {
  title: string;
  url: string; // YouTube URL or Video ID
}

export interface Comment {
  id: string;
  sender: string;
  text: string;
  time: string;
  replyTo?: string; // ID of comment being replied to
  healthDataId?: string; // linked health database profile
  song?: RecommendedSong; // Optional attached YouTube song
  googleAvatar?: string;
  isGoogleAuth?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'busy' | 'away' | 'offline';
  statusText: string;
  todayStatement: string;
  healthDataId: string; // ID of the health metrics in database
  comments: Comment[];
}

export interface DanmakuMessage {
  id: string;
  text: string;
  senderName: string;
  avatar: string;
  isUserSent: boolean;
  targetUserId?: string; // Linked user
  speed: number; // pixels per frame or animation duration in seconds
  track: number; // lane index
  top: number; // y coordinate in px
  paused: boolean;
  xOffset?: number; // for paused state or manual translation
  createdAt: number;
  song?: RecommendedSong; // Optional attached YouTube song
}
