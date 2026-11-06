import type { Reward } from './types'

export interface RewardProgress {
  reward: Reward
  pct: number
  ready: boolean
}

export function rewardProgress(stars: number, rewards: Reward[]): RewardProgress[] {
  return rewards.map((reward) => ({
    reward,
    pct: Math.min(100, Math.round((stars / reward.stars_required) * 100)),
    ready: stars >= reward.stars_required,
  }))
}
