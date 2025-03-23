export function pagerank(G, alpha = 0.85, maxIter = 100, tol = 1e-6) {
  const N = G.length;
  if (N === 0) return [];

  const danglingNodes = G.map((row, i) => row.every(weight => weight === 0));
  let ranks = Array(N).fill(1 / N);
  const teleport = 1 - alpha;

  for (let iter = 0; iter < maxIter; iter++) {
      const prevRanks = [...ranks];
      const danglingSum = prevRanks.reduce((sum, rank, i) => sum + (danglingNodes[i] ? rank : 0), 0);

      for (let i = 0; i < N; i++) {
          ranks[i] = teleport / N;
          for (let j = 0; j < N; j++) {
              if (G[j][i] > 0) {
                  const outDegree = G[j].reduce((sum, weight) => sum + weight, 0);
                  ranks[i] += alpha * (prevRanks[j] * G[j][i]) / outDegree;
              }
          }
          ranks[i] += alpha * danglingSum / N;
      }

      const error = ranks.reduce((sum, rank, i) => sum + Math.abs(rank - prevRanks[i]), 0);
      if (error < tol) break;
  }

  return ranks;
}