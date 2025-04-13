/**
 * Computes the number of 1 bits in a 32-bit integer.
 * Brian Kernighan's algorithm.
 * @param {number} x
 * @returns {number}
 */
function popCount(x) {
    let count = 0;
    while (x) {
      count++;
      x &= (x - 1);
    }
    return count;
  }
  
  /**
   * Returns the total number of set bits in a Uint32Array.
   * @param {Uint32Array} vector 
   * @returns {number}
   */
  function bitCount(vector) {
    let total = 0;
    for (let i = 0; i < vector.length; i++) {
      total += popCount(vector[i]);
    }
    return total;
  }
  
  /**
   * Compute the Jaccard similarity between two bit vectors.
   * @param {Uint32Array} bitVecA 
   * @param {Uint32Array} bitVecB 
   * @returns {number}
   */
  function computeAffinity(bitVecA, bitVecB) {
    let common = 0;
    const len = bitVecA.length;
    for (let i = 0; i < len; i++) {
      common += popCount(bitVecA[i] & bitVecB[i]);
    }
    const countA = bitCount(bitVecA);
    const countB = bitCount(bitVecB);
    const union = countA + countB - common;
    return union === 0 ? 0 : common / union;
  }
  
  /**
   * Builds an affinity graph (as a 2D array) between topics.
   * @param {Array} topics - Array of topic objects, each with a bitVec property.
   * @returns {Array} - 2D similarity matrix.
   */
  function buildAffinityGraph(topics) {
    const N = topics.length;
    const graph = Array.from({ length: N }, () => Array(N).fill(0));
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        // Basic similarity measure
        let sim = computeAffinity(topics[i].bitVec, topics[j].bitVec);
        // Heuristic: penalize deeper (or smaller) topics.
        // We assume that topics have a 'size' property (or weight) and an initial depth of 0.
        // For example, we subtract a penalty factor multiplied by (desiredDepth - currentDepth)
        // to discourage deep hierarchies.
        const penaltyFactor = 0.05; // Tweak this factor.
        sim -= penaltyFactor * topics[i].depth; // Penalize topic i depth.
        sim -= penaltyFactor * topics[j].depth; // Penalize topic j depth.
        // Ensure similarity remains in [0,1]
        sim = Math.max(0, sim);
        graph[i][j] = sim;
        graph[j][i] = sim;
      }
    }
    return graph;
  }
  
  /**
   * Constructs a maximum spanning tree (MST) using a variant of Prim's algorithm.
   * Additionally, we record the "depth" of each topic node as we add it.
   * @param {Array} graph - 2D similarity matrix.
   * @param {Array} topics - Array of topic objects (with size and depth).
   * @returns {Array} parent - parent[i] is the index of the parent of topics[i] in the MST.
   */
  function maximumSpanningTree(graph, topics) {
    const N = graph.length;
    const parent = new Array(N).fill(null);
    const key = new Array(N).fill(-Infinity);
    const inMST = new Array(N).fill(false);
    // Initialize: start at node 0.
    key[0] = 0;
    topics[0].depth = 0; // root depth is 0.
  
    for (let count = 0; count < N; count++) {
      let u = -1, maxVal = -Infinity;
      for (let v = 0; v < N; v++) {
        if (!inMST[v] && key[v] > maxVal) {
          maxVal = key[v];
          u = v;
        }
      }
      if (u === -1) break;
      inMST[u] = true;
      for (let v = 0; v < N; v++) {
        if (!inMST[v]) {
          // Adjust the similarity with the parent's depth.
          // Also, if a candidate parent's depth is too high, reduce the effective weight.
          const adjustedSim = graph[u][v] - penaltyFactorForDepth(topics[u].depth);
          if (adjustedSim > key[v]) {
            key[v] = adjustedSim;
            parent[v] = u;
            // Set the depth of topic v to parent's depth + 1.
            topics[v].depth = topics[u].depth + 1;
          }
        }
      }
    }
    return parent;
  }
  
  /**
   * Penalty function that increases with depth.
   * You can adjust the function to increase the penalty more steeply if desired.
   * @param {number} depth
   * @returns {number}
   */
  function penaltyFactorForDepth(depth) {
    const factor = 0.05; // base penalty factor
    return factor * depth;
  }
  
  /**
   * Given the MST parent array, assigns direction (i.e. a unique parent per topic)
   * by optionally reassigning nodes if the subtree becomes too deep.
   * @param {Array} topics - Array of topic objects.
   *        Each topic object should have a size, depth, and bitVec property.
   * @param {Array} mstParent - Array where mstParent[i] is the index of the parent for topic i.
   * @param {number} maxDepth - Maximum allowed depth.
   * @returns {Object} tree - Mapping each topic index to { parent: index|null, children: [indexes] }.
   */
  function assignDirections(topics, mstParent, maxDepth = 3) {
    const N = topics.length;
    // Choose root as the topic with maximum size (or weight).
    let root = 0;
    for (let i = 0; i < N; i++) {
      if (topics[i].size > topics[root].size) {
        root = i;
      }
    }
    // Build tree structure.
    const tree = {};
    for (let i = 0; i < N; i++) {
      tree[i] = { parent: null, children: [] };
    }
    // Initially assign based on MST.
    for (let i = 0; i < N; i++) {
      if (mstParent[i] !== null) {
        tree[i].parent = mstParent[i];
        tree[mstParent[i]].children.push(i);
      }
    }
    // Enforce depth constraints: if any node is deeper than maxDepth, reassign it to an ancestor.
    function adjustDepth(node, currentDepth) {
      // If depth exceeds maxDepth, move node upward.
      if (currentDepth > maxDepth && tree[node].parent !== null) {
        let ancestor = node;
        // Climb up until the ancestor is at (maxDepth - 1) or less.
        while (currentDepth > maxDepth && tree[ancestor].parent !== null) {
          ancestor = tree[ancestor].parent;
          currentDepth--;
        }
        // Remove node from its current parent's children.
        const oldParent = tree[node].parent;
        tree[oldParent].children = tree[oldParent].children.filter(child => child !== node);
        // Reassign new parent.
        tree[node].parent = ancestor;
        tree[ancestor].children.push(node);
      }
      // Recursively adjust children.
      tree[node].children.forEach(child => {
        adjustDepth(child, currentDepth + 1);
      });
    }
    adjustDepth(root, 0);
    // Ensure the chosen root has no parent.
    tree[root].parent = null;
    return { tree, root };
  }
  
  /**
   * High-level function that integrates the steps to assign a unique parent to every topic.
   * It builds the affinity graph, computes the MST, and then assigns directions with depth limiting.
   * @param {Array} topics - Array of topic objects.
   *        Each topic should have properties: bitVec (Uint32Array), size (number), and an initial depth (number, e.g. 0).
   * @param {number} maxDepth - Maximum allowed depth in the final tree.
   * @returns {Object} hierarchy - Returns the hierarchy tree and the root.
   */
  function assignUniqueParents(topics, maxDepth = 3) {
    const affinityGraph = buildAffinityGraph(topics);
    const mstParent = maximumSpanningTree(affinityGraph, topics);
    const hierarchy = assignDirections(topics, mstParent, maxDepth);
    return hierarchy;
  }
  