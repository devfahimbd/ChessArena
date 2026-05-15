/**
 * ELO Rating Calculation
 *
 * Uses the standard Elo formula:
 *   Expected score: Ea = 1 / (1 + 10^((Rb - Ra) / 400))
 *   New rating:    Ra' = Ra + K * (Sa - Ea)
 *
 * K-factor: 32 (standard for new players / casual play)
 */

export function calculateElo(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'loss' | 'draw'
): number {
  const K = 32

  const expectedScore =
    1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400))

  const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0

  return Math.round(playerRating + K * (actualScore - expectedScore))
}
