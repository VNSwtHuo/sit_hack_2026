import type { ObstacleType } from '../motion/motionTypes';

export interface ObstacleMeta {
  label: string;
  hint: string;
  emoji: string;
  accent: string;
}

export const OBSTACLE_META: Record<ObstacleType, ObstacleMeta> = {
  JUMP: {
    label: 'JUMP!',
    hint: 'Hop straight up',
    emoji: '⬆️',
    accent: '#facc15',
  },
  DODGE_LEFT: {
    label: 'DODGE RIGHT',
    hint: 'Lean to your right',
    emoji: '➡️',
    accent: '#38bdf8',
  },
  DODGE_RIGHT: {
    label: 'DODGE LEFT',
    hint: 'Lean to your left',
    emoji: '⬅️',
    accent: '#38bdf8',
  },
  SIX_SEVEN: {
    label: '6 7 !!',
    hint: 'Pump both hands up & down',
    emoji: '🙌',
    accent: '#f472b6',
  },
};
