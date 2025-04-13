// Importing necessary libraries and local files in JavaScript
// For part-of-speech tagging and other utilities

import { TextRank4Keyword } from './TextRank/textrank';
import { KneeLocator } from './TextRank/KneeLocator/knee_locator';
import { ENStopwords } from './discord-stopword-en';
import { assignUniqueParents } from './GroupTheory2';
import { compressGlossaryEntries } from './glossary_compression';
import { POS } from './TextRank/POS/index';

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
 * Utility functions for bit vector operations.
 */

/**
 * Returns a bit vector (Uint32Array) with given bit indices set.
 *
 * @param {number[]} indices - Array of indices to set.
 * @param {number} totalMessages - Total number of messages.
 * @return {Uint32Array} - The resulting bit vector.
 */
function indicesToBitVector(indices, totalMessages) {
  const vector = new Uint32Array(Math.ceil(totalMessages / 32));
  indices.forEach(index => {
    const wordIndex = index >> 5; // equivalent to Math.floor(index/32)
    const bitPos = index & 31;    // equivalent to index % 32
    vector[wordIndex] |= (1 << bitPos);
  });
  return vector;
}

/**
 * Performs a bitwise union of two bit vectors.
 * Assumes both vectors are of equal length.
 *
 * @param {Uint32Array} a - The first bit vector.
 * @param {Uint32Array} b - The second bit vector.
 * @return {Uint32Array} - The resulting union bit vector.
 */
function bitVectorUnion(a, b) {
  if (a.length !== b.length) {
    throw new Error("Bit vectors must be of equal length to union.");
  }
  const result = new Uint32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] | b[i];
  }
  return result;
}

function filterWordsByPartOfSpeechTag(words, posTags) {
  /**
   * Filters words from an array based on the given list of POS tags.
   * 
   * @param words {Array} A list of words (strings).
   * @param posTags {Array} A list of POS tags to keep (e.g., ['NN', 'VB']).
   * @return {Array} A list of words that match the specified POS tags.
   */
  const wordList = new POS.Lexer().lex(words.join(' '));
  const tagger = new POS.Tagger();
  const taggedWords = tagger.tag(wordList);

  const filteredWords = taggedWords
    .filter(([word, tag]) => posTags.includes(tag))
    .map(([word]) => word);

  return filteredWords;
}

function findKnee(scores) {
  if (!scores.length) return 0;

  const deltas = scores.slice(1).map((s, i) => scores[i] - s);
  const maxDelta = Math.max(...deltas);
  const dropThreshold = maxDelta * 0.2; // heuristic: 20% of max drop

  for (let i = 1; i < deltas.length; i++) {
    if (deltas[i] < dropThreshold) {
      return i + 1;
    }
  }
  return scores.length;
}

function extractTopics(text) {
  /**
   * Extract keywords from the text.
   * 
   * @param text {String} The input text to analyze.
   * @return {Array} List of optimal keywords based on TextRank.
   */
  const textRank = new TextRank4Keyword(null, ['NN']);
  textRank.analyze(text, 5, true);
  const keywords = textRank.getKeywords(100, 5);

  const scores = keywords.map(kw => kw.weight);
  if (!scores.length) {
    return [];
  }

  const cutoff = findKnee(scores);
  const optimalKeywords = keywords.slice(0, cutoff).map(kw => kw.word);
  return optimalKeywords;
}

function extractTopicsOrig(text) {
  /**
   * Original keyword extraction method.
   */
  const textRank = new TextRank4Keyword(null, ['NN']);
  textRank.analyze(text, 5, true);
  const keywords = textRank.getKeywords(100, 5);

  const scores = keywords.map(kw => kw.weight);
  if (!scores.length) {
    return [];
  }

  const x = Array.from({ length: scores.length }, (_, i) => i + 1);
  const kneeLocator = new KneeLocator(x, scores, { curve: 'convex', direction: 'decreasing' });
  const cutoff = kneeLocator.knee || scores.length;
  const optimalKeywords = keywords.slice(0, cutoff).map(kw => kw.word);
  return optimalKeywords;
}

console.log("HI");

let FILEPATH = null;
let GLOSSARY_FILEPATH = null;
let SUMMARIES_FILEPATH = null;
const MESSAGE_SEPARATOR = '--------------------------------------------------';

// Load stopwords from JSON file
let loadedStopwords = new Set(ENStopwords);

const punctuations = `",!?.)(:”’''*🙏🤔💀😈😭😩😖🤔🥰🥴😩🙂😄'“\``;
console.log(punctuations);

function removeStopwordsFromMessageText(messageText) {
  const filteredTokens = [];
  const tokens = messageText.replace(new RegExp(`[${punctuations}]`, 'g'), '').split(/\s+/);

  tokens.forEach(token => {
    const lowerToken = token.toLowerCase();
    if (lowerToken.startsWith('http')) {
      const normalized = token.replace(/[:\/.\-]/g, ' ');
      normalized.split(/\s+/).forEach(subToken => {
        const lowerSubToken = subToken.toLowerCase();
        if (
          !lowerSubToken.startsWith('http') &&
          !['com', 'www', 'ai'].includes(lowerSubToken) &&
          !loadedStopwords.has(lowerSubToken)
        ) {
          filteredTokens.push(subToken);
        }
      });
    } else if (!loadedStopwords.has(lowerToken) || (token === token.toUpperCase() && token.length > 1)) {
      filteredTokens.push(token);
    }
  });

  return filteredTokens;
}

function groupAndPreprocessMessages(messageData) {
  const LIMIT = 3;
  const conversationBlocks = [];
  const processedConversationBlocks = [];
  let currentAuthor = null;
  let authorMessages = [];
  let DLimit = 0;

  if (typeof messageData === 'object' && 'messages' in messageData) {
    messageData = messageData.messages;
  }

  messageData.forEach(messageEntry => {
    const authorName = messageEntry.author?.name || messageEntry.author?.username;

    if (authorName) {
      if (authorName !== currentAuthor || DLimit === LIMIT) {
        if (authorMessages.length > 0) {
          const joinedMessageBlock = authorMessages.join(' ');
          conversationBlocks.push(joinedMessageBlock);
          const preprocessedBlock = removeStopwordsFromMessageText(joinedMessageBlock).join(' ');
          processedConversationBlocks.push(preprocessedBlock);
        }
        currentAuthor = authorName;
        authorMessages = [];
        DLimit = 0;
      }
      authorMessages.push(messageEntry.content);
      DLimit++;
    }
  });

  if (authorMessages.length > 0) {
    const joinedMessageBlock = authorMessages.join(' ');
    conversationBlocks.push(joinedMessageBlock);
    const preprocessedBlock = removeStopwordsFromMessageText(joinedMessageBlock).join(' ');
    processedConversationBlocks.push(preprocessedBlock);
  }

  return [conversationBlocks, processedConversationBlocks];
}

window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups = Object.create(null);
let summaryArrayHtmlResults = Object.create(null);

function loadConversationEngine(discord_data) {
  window.conversationBlocks = [];
  window.processedConversationBlocks = [];

  let discordMessageData;
  try {
    discordMessageData = JSON.parse(discord_data);
  } catch (error) {
    console.error("Error parsing JSON data:", error);
    return;
  }

  const [conversationBlocks, processedConversationBlocks] = groupAndPreprocessMessages(discordMessageData);
  window.conversationBlocks = conversationBlocks;
  window.processedConversationBlocks = processedConversationBlocks;
  return {
    conversationBlocks: window.conversationBlocks,
    processedConversationBlocks: window.processedConversationBlocks
  };
}

/**
 * Checks if the provided message contains any word from the query words set.
 *
 * @param {Set<string>} queryWordsSet - A set of words to search for.
 * @param {string} message - The message text to search in.
 * @return {boolean} - Returns true if any query word is found.
 */
function messageContainsAnyQueryWord(queryWordsSet, message) {
  const messageWordsSet = new Set(message.split(' '));
  return [...queryWordsSet].some(word => messageWordsSet.has(word));
}

/**
 * Recursively builds a context chain from adjacent message blocks.
 *
 * @param {Set<string>} inheritedWords - A set of words carried over.
 * @param {number} radius - Current search radius.
 * @param {number} currentIndex - Index of the current message block.
 * @param {Set<number>} visitedIndices - Set of already processed indices.
 * @param {Array<Object>} contextChain - Array accumulating context blocks.
 * @param {Uint32Array} bitVector - Bit vector tracking message indices.
 * @param {number} recursionDepth - Current recursion depth (default is 1).
 */
function buildContextChainRecursively(inheritedWords, radius, currentIndex, visitedIndices, contextChain, bitVector, recursionDepth = 1) {
  const startIndex = Math.max(0, currentIndex - radius);
  const endIndex = Math.min(window.processedConversationBlocks.length, currentIndex + radius + 1);

  for (let neighborIndex = startIndex; neighborIndex < endIndex; neighborIndex++) {
    if (!visitedIndices.has(neighborIndex)) {
      const neighborMessage = window.processedConversationBlocks[neighborIndex];
      if (messageContainsAnyQueryWord(inheritedWords, neighborMessage)) {
        visitedIndices.add(neighborIndex);
        contextChain.push({
          blockIndex: neighborIndex,
          message: window.conversationBlocks[neighborIndex],
          depth: recursionDepth
        });
        const wordIndex = neighborIndex >> 5;
        const bitPos = neighborIndex & 31;
        bitVector[wordIndex] |= (1 << bitPos);

        const expandedWords = new Set([...inheritedWords, ...neighborMessage.split(' ')]);
        const newRadius = Math.max(Math.floor(radius / 2), 1);
        buildContextChainRecursively(expandedWords, newRadius, neighborIndex, visitedIndices, contextChain, bitVector, recursionDepth + 1);
      }
    }
  }
}

window.contextChainsCircaSeedIndexIds = Object.create(null);
let processedBlockIndices = new Set();
let generatedChainCount = 0;

/**
 * Processes all conversation blocks to generate context chains.
 *
 * @returns The result from calculateGlossary().
 */
function processAllContextChains() {
  processedBlockIndices = new Set();
  window.contextChainsCircaSeedIndexIds = Object.create(null);

  for (let index = 0; index < window.processedConversationBlocks.length; index++) {
    if (!processedBlockIndices.has(index)) {
      processContextChainAtIndex(index);
    }
  }
  return calculateGlossary();
}

/**
 * Generates and displays a context chain for a given conversation block.
 * Also initializes and updates a bit vector for tracking message IDs.
 *
 * @param {number|null} index - Specific block index to process (or random if null).
 */
function processContextChainAtIndex(index = null) {
  let searchRadius = 50;
  if (isNaN(searchRadius)) {
    console.error("Invalid search radius input.");
    return;
  }
  if (window.processedConversationBlocks && window.processedConversationBlocks.length > 0) {
    const blockIndex = (index !== null) ? index : Math.floor(Math.random() * window.processedConversationBlocks.length);
    const initialMessage = window.processedConversationBlocks[blockIndex];
    const initialWordSet = new Set(initialMessage.split(' '));
    const visitedIndices = new Set([blockIndex]);
    const contextChain = [{
      blockIndex: blockIndex,
      message: window.conversationBlocks[blockIndex],
      depth: 1
    }];

    const totalMessages = window.processedConversationBlocks.length;
    const bitVector = new Uint32Array(Math.ceil(totalMessages / 32));
    const initWordIndex = blockIndex >> 5;
    const initBitPos = blockIndex & 31;
    bitVector[initWordIndex] |= (1 << initBitPos);

    buildContextChainRecursively(initialWordSet, searchRadius, blockIndex, visitedIndices, contextChain, bitVector);

    if (contextChain.length < Math.floor(searchRadius / 4) && index !== null) {
      processedBlockIndices.add(index);
      return;
    }

    contextChain.sort((a, b) => a.blockIndex - b.blockIndex);
    const seedId = blockIndex.toString();
    // Store the context chain along with its bit vector.
    window.contextChainsCircaSeedIndexIds[seedId] = {
      chain: contextChain.map(entry => ({
        message: entry.message,
        messageId: entry.blockIndex
      })),
      bitVector: Array.from(bitVector)
    };

    processedBlockIndices = new Set([...processedBlockIndices, ...contextChain.map(entry => entry.blockIndex)]);
    generatedChainCount++;
  }
}

/**
 * For each context chain, aggregates messages, extracts topics, and updates a global topical matrix.
 */
function calculateTopicsForEachMessage() {
  const contextChainsCircaSeedIndexIds = window.contextChainsCircaSeedIndexIds;
  if (!Object.keys(contextChainsCircaSeedIndexIds).length) {
    return;
  }

  for (const [seedId, chainData] of Object.entries(contextChainsCircaSeedIndexIds)) {
    // Aggregate messages from the chain.
    const aggregatedText = chainData.chain
      .map(entry => window.processedConversationBlocks[entry.messageId])
      .join("\n");

    const topics = extractTopics(aggregatedText);
    // Append the topic description to the chain data.
    chainData.chain.push({ description: topics });

  }
}


/**
 * Iterates through each context chain and assigns each extracted topic a group of message IDs,
 * stored as bit vectors rather than plain arrays.
 *
 * Instead of unioning bit vectors for a topic, we now push the chain's bit vector into an array.
 */
function assignEachTopic__itsArrayConversationGroups() {
    const contextChainsCircaSeedIndexIds = window.contextChainsCircaSeedIndexIds;
    const glossary = window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups;
    if (!contextChainsCircaSeedIndexIds) return;
  
    // For each context chain.
    Object.entries(contextChainsCircaSeedIndexIds).forEach(([seedId, chainData]) => {
      // Retrieve topics from the last entry in the chain.
      const lastEntry = chainData.chain[chainData.chain.length - 1];
      const topics = (lastEntry && lastEntry.description) || [];
      if (!topics.length) return;
  
      // Retrieve the stored bit vector for the chain.
      const chainBitVector = new Uint32Array(chainData.bitVector);
      topics.forEach(topic => {
        if (!glossary[topic]) {
          // Initialize with a new array containing the current chain's bit vector.
          glossary[topic] = [chainBitVector];
        } else {
          // Push the chain's bit vector to the existing array.
          glossary[topic].push(chainBitVector);
        }
      });
    });
  }
  

/**
 * Compresses the glossary entries.
 */
function intersectCompressor(data) {
  console.log("Compressing...");
  let completeStart = Date.now();
  for (let keyword in data) {
    data[keyword] = compressGlossaryEntries(keyword, data[keyword], 0.7);
  }
  console.log(`End of compression: ${Date.now() - completeStart} ms`);
  return data;
}

/**
 * Aggregates data from the context chains to compute the glossary.
 */
function calculateGlossary() {
  window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups = Object.create(null);

  let completeStart = Date.now();
  calculateTopicsForEachMessage();
  console.log(`End of topics extraction: ${Date.now() - completeStart} ms`);

  completeStart = Date.now();
  assignEachTopic__itsArrayConversationGroups();
  console.log(`End of topic assignment: ${Date.now() - completeStart} ms`);

  completeStart = Date.now();
  window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups = intersectCompressor(window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups);
  console.log(`End of compression: ${Date.now() - completeStart} ms`);

  return {
    dictionaryGlossaryTopicAnd__itsArrayConversationGroups: window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups,
  };
}

/**
 * Breaks cycles in a hierarchical graph structure.
 *
 * @param {Object} graph - The graph to process.
 * @returns {Object} - The acyclic graph.
 */
function breakCycles(graph) {
  let visited = new Set();
  let stack = new Set();
  let edgesToRemove = [];

  function dfs(node, parent) {
    if (stack.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visited.add(node);
    stack.add(node);
    let subgroups = graph[node] && graph[node].subgroups ? graph[node].subgroups : [];
    for (let neighbor of subgroups) {
      if (dfs(neighbor, node)) {
        edgesToRemove.push([node, neighbor]);
      }
    }
    stack.delete(node);
    return false;
  }

  for (let node in graph) {
    if (!visited.has(node)) {
      dfs(node, null);
    }
  }

  for (let [parent, child] of edgesToRemove) {
    if (graph[parent] && graph[parent].subgroups) {
      let index = graph[parent].subgroups.indexOf(child);
      if (index > -1) {
        graph[parent].subgroups.splice(index, 1);
        console.log(`Removed cycle-causing edge: ${parent} → ${child}`);
      }
    }
  }
  return graph;
}
// --- calculateDisplayGlossary implementation ---

/**
 * calculateDisplayGlossary constructs and returns a hierarchical structure (a glossary)
 * by applying our fast MST-based unique parent assignment on topics extracted from the
 * dictionaryGlossaryTopicAnd__itsArrayConversationGroups global variable.
 *
 * It assumes that window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups is an object
 * where keys are topic names (strings) and values are arrays of bit vectors (each represented as
 * an array or Uint32Array).
 *
 * The function combines the bit vectors for each topic (via bitwise OR), computes a popcount as "size,"
 * builds an array of topic objects, applies the MST algorithm to assign unique parent relationships,
 * and finally returns the hierarchical structure.
 *
 * @returns {Object} An object with properties:
 *   - hierarchicalRelationships: Object representing tree structure.
 *   - independentGroups: (Empty array in this case, as a tree is built.)
 */
function calculateDisplayGlossary() {
    const startTime = Date.now();
    const glossaryData = window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups;
    console.log(window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups)
    if (!glossaryData) {
      console.error("No glossary data found in window.dictionaryGlossaryTopicAnd__itsArrayConversationGroups");
      return { hierarchicalRelationships: {}, independentGroups: [] };
    }
  
    // Determine the bit vector length from one of the stored vectors.
    let sampleKey = Object.keys(glossaryData)[0];
    let sampleArray = glossaryData[sampleKey];
    if (!sampleArray || sampleArray.length === 0) {
      console.error("No bit vectors found for topic: " + sampleKey);
      return { hierarchicalRelationships: {}, independentGroups: [] };
    }
    // Assume all bit vectors have same length:
    const bitVectorLength = (new Uint32Array(sampleArray[0])).length;
  
    // Combine bit vectors for each topic and build topic objects.
    const topicsArray = [];
    for (const topic in glossaryData) {
      const bitVecList = glossaryData[topic]; // an array of bit vectors (each stored as an array or Uint32Array)
      let combined = new Uint32Array(bitVectorLength);
      // Initialize with zeros (Uint32Array is already zeroed)
      for (const vec of bitVecList) {
        // Assume vec is either an array of numbers or a Uint32Array.
        const current = new Uint32Array(vec);
        for (let i = 0; i < bitVectorLength; i++) {
          combined[i] |= current[i];
        }
      }
      // Compute size as the number of set bits.
      const size = bitCount(combined);
      topicsArray.push({ name: topic, bitVec: combined, size: size });
    }
    console.log("Problemo",topicsArray)
    // Now build the hierarchy using our fast MST-based algorithm.
    const hierarchyResult = assignUniqueParents(topicsArray);
    const tree = hierarchyResult.tree;
    console.log("Stop him",tree)
    const rootIndex = hierarchyResult.root;


    // For display purposes, we can convert the index-based tree to one keyed by topic names.
    const hierarchicalRelationships = {};
    
    topicsArray.forEach((topicObj, idx) => {
      hierarchicalRelationships[topicObj.name] = {
        parent: (tree[idx].parent !== null) ? topicsArray[tree[idx].parent].name : null,
        children: tree[idx].children.map(childIdx => topicsArray[childIdx].name)
      };
    });
    
    const endTime = Date.now();
    console.log(`calculateDisplayGlossary executed in ${endTime - startTime} ms`);
    console.log(hierarchicalRelationships)
    // Return the hierarchical relationships along with an empty independentGroups array (all topics are in a tree)
    return {
      independentGroups: [],
      hierarchicalRelationships: hierarchicalRelationships
    };
  }
  
export {
  loadConversationEngine,
  processAllContextChains,
  calculateGlossary,
  calculateDisplayGlossary
};
