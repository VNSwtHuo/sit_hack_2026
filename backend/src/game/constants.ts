import type { Difficulty, ObstacleType } from '../types.js';

export const DEFAULT_DIFFICULTY: Difficulty = 'NORMAL';
export const GAME_UPDATE_MS = 100;
export const MOTION_STALE_MS = 650;
export const OBSTACLE_TYPES: ObstacleType[] = ['JUMP', 'DODGE_LEFT', 'DODGE_RIGHT', 'SIX_SEVEN'];

export const DIFFICULTY_CONFIGS: Record<Difficulty, {
  chaseRate: number;
  recoveryRate: number;
  obstacleMinMs: number;
  obstacleMaxMs: number;
  obstacleDurationMs: number;
  missPenalty: number;
  comboBonus: number;
  maxDistance: number;
  startingDistance: number;
}> = {
  EASY: {
    chaseRate: 0.16,
    recoveryRate: 0.28,
    obstacleMinMs: 8500,
    obstacleMaxMs: 12000,
    obstacleDurationMs: 3400,
    missPenalty: 7,
    comboBonus: 12,
    maxDistance: 100,
    startingDistance: 78,
  },
  NORMAL: {
    chaseRate: 0.34,
    recoveryRate: 0.22,
    obstacleMinMs: 6000,
    obstacleMaxMs: 9000,
    obstacleDurationMs: 2800,
    missPenalty: 10,
    comboBonus: 15,
    maxDistance: 100,
    startingDistance: 65,
  },
  HARD: {
    chaseRate: 0.54,
    recoveryRate: 0.18,
    obstacleMinMs: 4200,
    obstacleMaxMs: 6500,
    obstacleDurationMs: 2300,
    missPenalty: 14,
    comboBonus: 18,
    maxDistance: 100,
    startingDistance: 58,
  },
};
