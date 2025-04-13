// Importing necessary libraries and local files in JavaScript
// For part-of-speech tagging and other utilities

import { TextRank4Keyword } from './TextRank/textrank';
import { KneeLocator } from './TextRank/KneeLocator/knee_locator';
import { ENStopwords } from './discord-stopword-en';
import { generateSubtopicTreeAndDisplayTree } from './GroupTheory2';
import { compressGlossaryEntries } from './glossary_compression';
import { POS } from './TextRank/POS/index';

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
  window.topicalMatrix = Object.create(null);
  const contextChainsCircaSeedIndexIds = window.contextChainsCircaSeedIndexIds;
  if (!Object.keys(contextChainsCircaSeedIndexIds).length) {
    return;
  }

  const IMPORTANCE_WEIGHT = 3;
  const PROXIMITY_WEIGHT = 1;

  for (const [seedId, chainData] of Object.entries(contextChainsCircaSeedIndexIds)) {
    // Aggregate messages from the chain.
    const aggregatedText = chainData.chain
      .map(entry => window.processedConversationBlocks[entry.messageId])
      .join("\n");

    const topics = extractTopics(aggregatedText);
    // Append the topic description to the chain data.
    chainData.chain.push({ description: topics });

    topics.forEach(topic => {
      if (!(topic in window.topicalMatrix)) {
        window.topicalMatrix[topic] = Object.create(null);
      }
    });

    topics.forEach((currentTopic, currentIdx) => {
      for (let earlierIdx = 0; earlierIdx < currentIdx; earlierIdx++) {
        const earlierTopic = topics[earlierIdx];
        if (!window.topicalMatrix[currentTopic][earlierTopic]) {
          window.topicalMatrix[currentTopic][earlierTopic] = 0;
        }
        const importanceFactor = 1 / (earlierIdx + 1);
        const normalizedProximityFactor = (1 / (currentIdx - earlierIdx)) / currentIdx;
        window.topicalMatrix[currentTopic][earlierTopic] += 
          (1 / IMPORTANCE_WEIGHT) * importanceFactor +
          (1 / PROXIMITY_WEIGHT) * normalizedProximityFactor;
      }
    });
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

function calculateDisplayGlossary() {
  let completeStart = Date.now();
  let key_structure = Object.create(null);

  for (let key in window.topicalMatrix) {
    let topics = window.topicalMatrix[key];
    let max_score = -1;
    let max_topics = [];

    for (let topic in topics) {
      let score = topics[topic];
      if (score > max_score) {
        max_score = score;
        max_topics = [topic];
      } else if (score === max_score) {
        max_topics.push(topic);
      }
    }

    if (max_score !== -1) {
      let max_topic;
      if (max_topics.length > 1) {
        max_topic = max_topics.reduce((a, b) =>
          (Object.keys(window.topicalMatrix[a]).length > Object.keys(window.topicalMatrix[b]).length ? a : b)
        );
      } else {
        max_topic = max_topics[0];
      }
      if (Object.keys(window.topicalMatrix[max_topic]).length > Object.keys(window.topicalMatrix[key]).length) {
        if (!(max_topic in key_structure)) {
          key_structure[max_topic] = { "subgroups": [] };
        }
        key_structure[max_topic]["subgroups"].push(key);
      }
    }
  }
  console.log("Breaking cycles...");
  key_structure = breakCycles(key_structure);
  console.log(key_structure);
  console.log("Ended that");
  let hierarchicalRelationships = key_structure;
  let independentGroups = [];

  console.log(`End of display glossary calculation: ${Date.now() - completeStart} ms`);
  return {
    independentGroups: independentGroups,
    hierarchicalRelationships: hierarchicalRelationships
  };
}

export {
  loadConversationEngine,
  processAllContextChains,
  calculateGlossary,
  calculateDisplayGlossary
};
