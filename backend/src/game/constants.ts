import type { Difficulty, ObstacleType } from "../types.js";

export const DEFAULT_DIFFICULTY: Difficulty = "EASY";
export const GAME_UPDATE_MS = 100;
export const MOTION_STALE_MS = 650;
export const OBSTACLE_TYPES: ObstacleType[] = [
  "JUMP",
  "DUCK",
  "DODGE_LEFT",
  "DODGE_RIGHT",
  "SIX_SEVEN",
];
export const SPEED_INCREMENT_INTERVAL_MS = 1500;
export const SPEED_INCREMENT = 0.2;
export const MAX_SPEED_MULTIPLIER = 2.2;

export interface DifficultyConfig {
  chaseRate: number;
  recoveryRate: number;
  obstacleMinMs: number;
  obstacleMaxMs: number;
  obstacleDurationMs: number;
  missPenalty: number;
  comboBonus: number;
  maxDistance: number;
  startingDistance: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  EASY: {
    chaseRate: 0.16,
    recoveryRate: 0.28,
    obstacleMinMs: 4500,
    obstacleMaxMs: 7000,
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

export function getSpeedMultiplier(survivalTimeSeconds: number) {
  const elapsedMs = Math.max(0, survivalTimeSeconds * 1000);
  const increments = Math.floor(elapsedMs / SPEED_INCREMENT_INTERVAL_MS);
  return Math.min(MAX_SPEED_MULTIPLIER, 1 + increments * SPEED_INCREMENT);
}

export function getDynamicDifficultyConfig(
  survivalTimeSeconds: number,
): DifficultyConfig {
  const base = DIFFICULTY_CONFIGS.EASY;
  const speedMultiplier = getSpeedMultiplier(survivalTimeSeconds);

  return {
    ...base,
    chaseRate: base.chaseRate * speedMultiplier,
    obstacleMinMs: Math.max(
      1800,
      Math.round(base.obstacleMinMs / speedMultiplier),
    ),
    obstacleMaxMs: Math.max(
      2800,
      Math.round(base.obstacleMaxMs / speedMultiplier),
    ),
    obstacleDurationMs: Math.max(
      1800,
      Math.round(base.obstacleDurationMs / Math.sqrt(speedMultiplier)),
    ),
    missPenalty: Math.round(base.missPenalty * speedMultiplier),
  };
}
