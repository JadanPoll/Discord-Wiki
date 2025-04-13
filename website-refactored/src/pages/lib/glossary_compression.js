// ---------- Utility Bit Vector Functions ----------

/**
 * Count the number of set bits in a 32-bit integer using Brian Kernighan's algorithm.
 *
 * @param {number} x - A 32-bit integer.
 * @returns {number} - Number of set bits.
 */
function popCount(x) {
    let count = 0;
    while (x) {
      count++;
      x &= x - 1;
    }
    return count;
  }
  
  /**
   * Compute the total number of set bits in a Uint32Array.
   *
   * @param {Uint32Array} vector - The bit vector.
   * @returns {number} - Total set bits.
   */
  function bitCount(vector) {
    let count = 0;
    for (let i = 0; i < vector.length; i++) {
      count += popCount(vector[i]);
    }
    return count;
  }
  
  /**
   * Efficiently check the overlap between two bit vectors, and if the overlap
   * meets the threshold (relative to either vector’s size), return their union.
   *
   * @param {Uint32Array} bitVec1 - The first bit vector.
   * @param {Uint32Array} bitVec2 - The second bit vector.
   * @param {number} threshold - Overlap threshold (default is 0.9).
   * @returns {Uint32Array|null} - A new bit vector representing the union or null if threshold not met.
   */
  function efficientOverlapAndMergeBitVectors(bitVec1, bitVec2, threshold = 0.9) {
    const len1 = bitCount(bitVec1);
    const len2 = bitCount(bitVec2);
    
    // Compute intersection bit vector.
    const intersection = new Uint32Array(bitVec1.length);
    for (let i = 0; i < bitVec1.length; i++) {
      intersection[i] = bitVec1[i] & bitVec2[i];
    }
    const overlap = bitCount(intersection);
    
    // Check if the overlap is sufficient relative to either vector.
    if (overlap >= threshold * len1 || overlap >= threshold * len2) {
      // Compute union (bitwise OR) of two vectors.
      const unionVec = new Uint32Array(bitVec1.length);
      for (let i = 0; i < bitVec1.length; i++) {
        unionVec[i] = bitVec1[i] | bitVec2[i];
      }
      return unionVec;
    }
    return null;
  }
  
  // ---------- Compression Functions ----------
  
  /**
   * Compress the entries for a specific keyword.
   * Each entry is assumed to be a bit vector (Uint32Array) representing a context chain.
   *
   * @param {string} keyword - The topic keyword.
   * @param {Uint32Array[]} entries - Array of bit vectors for this keyword.
   * @param {number} threshold - Overlap threshold (default is 0.9).
   * @returns {Uint32Array[]} - Compressed array of bit vectors.
   */
  export function compressGlossaryEntries(keyword, entries, threshold = 0.9) {
    const n = entries.length;
    const mergedFlags = new Array(n).fill(false);
    
    // Compare every pair of bit vectors.
    for (let i = 0; i < n; i++) {
      if (mergedFlags[i]) continue;
      
      for (let j = i + 1; j < n; j++) {
        if (mergedFlags[j]) continue;
        
        // If the two bit vectors overlap sufficiently, merge them.
        const mergedResult = efficientOverlapAndMergeBitVectors(entries[i], entries[j], threshold);
        if (mergedResult) {
          // Overwrite the earlier vector with the merged result.
          entries[i] = mergedResult;
          mergedFlags[j] = true;
        }
      }
    }
    // Return only the unmerged entries.
    return entries.filter((_, i) => !mergedFlags[i]);
  }