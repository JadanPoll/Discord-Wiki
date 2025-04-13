// --- Helper Functions (from our fastest algorithm implementation) ---

/**
 * Counts the number of 1 bits in a 32-bit integer using Brian Kernighan's algorithm.
 * @param {number} x
 * @returns {number}
 */
function popCount(x) {
    let count = 0;
    while (x !== 0) {
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
   * Compute a symmetric affinity measure between two bit vectors.
   * Here we use the Jaccard similarity.
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
    return (union === 0 ? 0 : common / union);
  }
  
  /**
   * Builds an affinity graph (as a 2D array) between topics.
   * @param {Array} topics - Array of topic objects, each with a bitVec property.
   * @returns {Array} - 2D similarity matrix
   */
  function buildAffinityGraph(topics) {
    const N = topics.length;
    const graph = [];
    for (let i = 0; i < N; i++) {
      graph[i] = new Array(N).fill(0);
      for (let j = i + 1; j < N; j++) {
        const sim = computeAffinity(topics[i].bitVec, topics[j].bitVec);
        graph[i][j] = sim;
        graph[j] = graph[j] || [];
        graph[j][i] = sim;
      }
    }
    return graph;
  }
  
  /**
   * Constructs a maximum spanning tree (MST) using a variant of Prim's algorithm.
   * Returns an array "parent" where parent[i] is the index of the parent of topics[i].
   * @param {Array} graph - 2D similarity matrix.
   * @returns {Array} parent
   */
  function maximumSpanningTree(graph) {
    const N = graph.length;
    const parent = new Array(N).fill(null);
    const key = new Array(N).fill(-Infinity);
    const inMST = new Array(N).fill(false);
    key[0] = 0; // starting at index 0
  
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
        if (!inMST[v] && graph[u][v] > key[v]) {
          key[v] = graph[u][v];
          parent[v] = u;
        }
      }
    }
    return parent;
  }
  
  /**
   * Given the MST parent array, assigns direction (i.e. a unique parent per topic)
   * by first selecting a root (using a secondary statistic such as size) and then
   * forming a tree structure.
   * @param {Array} topics - Array of topic objects.
   * @param {Array} mstParent - Array where mstParent[i] is the index of the parent for topic i.
   * @returns {Object} tree - Object mapping each topic index to { parent: index|null, children: [indexes] }
   */
  function assignDirections(topics, mstParent) {
    const N = topics.length;
    // Choose root as the topic with maximum "size"
    let root = 0;
    for (let i = 0; i < N; i++) {
      if (topics[i].size > topics[root].size) {
        root = i;
      }
    }
    // Build tree structure
    const tree = {};
    for (let i = 0; i < N; i++) {
      tree[i] = { parent: null, children: [] };
    }
    for (let i = 0; i < mstParent.length; i++) {
      if (mstParent[i] !== null) {
        tree[i].parent = mstParent[i];
        tree[mstParent[i]].children.push(i);
      }
    }
    // Ensure the chosen root has no parent
    tree[root].parent = null;
    // Patch
    // Remove root from any other node's children list
    for (let i = 0; i < N; i++) {
      tree[i].children = tree[i].children.filter(child => child !== root);
    }
    return { tree: tree, root: root };
  }
  
  /**
   * High-level function that integrates the steps to assign a unique parent to every topic.
   * @param {Array} topics - Array of topic objects.
   * @returns {Object} hierarchy - Returns the hierarchy tree and root.
   */
  function assignUniqueParents(topics) {
    const affinityGraph = buildAffinityGraph(topics);
    const mstParent = maximumSpanningTree(affinityGraph);
    const hierarchy = assignDirections(topics, mstParent);
    return hierarchy;
  }
  
  
export {  assignUniqueParents };