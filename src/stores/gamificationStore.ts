import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  setItem: (name: string, value: string) => storage.set(name, value),
  getItem: (name: string) => storage.getString(name) ?? null,
  removeItem: (name: string) => storage.delete(name),
};

export interface Mission {
  id: string;
  title: string;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
}

interface GamificationState {
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string | null;
  missions: Mission[];
  
  addXP: (amount: number) => void;
  incrementMission: (id: string, amount?: number) => void;
  checkStreak: () => void;
  resetMissions: () => void;
}

const XP_PER_LEVEL = 1000;

const DEFAULT_MISSIONS: Mission[] = [
  { id: 'view_companies', title: 'Review 10 Companies', target: 10, current: 0, xpReward: 50, completed: false },
  { id: 'view_people', title: 'Review 5 People', target: 5, current: 0, xpReward: 30, completed: false },
  { id: 'like_entities', title: 'Like 3 Entities', target: 3, current: 0, xpReward: 20, completed: false },
];

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      xp: 0,
      level: 1,
      streak: 0,
      lastActiveDate: null,
      missions: DEFAULT_MISSIONS,

      addXP: (amount) => {
        const newXP = get().xp + amount;
        const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;
        set({ xp: newXP, level: newLevel });
      },

      incrementMission: (id, amount = 1) => {
        const missions = get().missions.map(m => {
          if (m.id === id && !m.completed) {
            const current = m.current + amount;
            const completed = current >= m.target;
            if (completed) {
              get().addXP(m.xpReward);
            }
            return { ...m, current, completed };
          }
          return m;
        });
        set({ missions });
      },

      checkStreak: () => {
        const now = new Date().toISOString().split('T')[0];
        const last = get().lastActiveDate;
        
        if (last === now) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (last === yesterdayStr) {
          set({ streak: get().streak + 1, lastActiveDate: now });
        } else {
          set({ streak: 1, lastActiveDate: now });
        }
        
        get().resetMissions();
      },

      resetMissions: () => {
        set({ missions: DEFAULT_MISSIONS });
      },
    }),
    {
      name: 'specter-gamification',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
