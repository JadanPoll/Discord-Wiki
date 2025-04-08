// Importing necessary libraries and local files in JavaScript
// For part-of-speech tagging

// Natural language processing utilities

import { TextRank4Keyword } from './TextRank/textrank'
// For knee detection (if necessary)
import { KneeLocator } from './TextRank/KneeLocator/knee_locator';  

import { ENStopwords } from './discord-stopword-en';
// Importing custom local modules for group theory and glossary compression
import { generateSubtopicTreeAndDisplayTree } from './GroupTheory';  // Import your group theory module
import { compressGlossaryEntries } from './glossary_compression';  // Import glossary compression module
import { POS } from './TextRank/POS/index'

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

    // Filter words based on the specified POS tags
    const filteredWords = taggedWords
        .filter(([word, tag]) => posTags.includes(tag))
        .map(([word]) => word);

    return filteredWords;
}

function findKnee(scores) {
    if (!scores.length) return 0;
  
    // 1. Compute the differences between consecutive scores
    const deltas = scores.slice(1).map((s, i) => scores[i] - s);
  
    // 2. Define a threshold for a “significant” drop
    const maxDelta = Math.max(...deltas);
    const dropThreshold = maxDelta * 0.05; // heuristic: 5% of max drop
  
    // 3. Find the first index where the drop becomes small (plateau begins)
    for (let i = 1; i < deltas.length; i++) {
      if (deltas[i] < dropThreshold) {
        return i + 1;
      }
    }
  
    return scores.length;
  }
  function extractTopics(text) {
    /**
     * Extract keywords from the text,.
     * 
     * @param text {String} The input text to analyze.
     * @return {Array} List of optimal keywords based on TextRank.
     */
    
    const textRank = new TextRank4Keyword(null, ['NN']);
    textRank.analyze(text, 5, true );
    const keywords = textRank.getKeywords(100, 5);//I'm not supposed to be sorting this, there's something wrong with the algorithm



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
     * Extract keywords from the text,.
     * 
     * @param text {String} The input text to analyze.
     * @return {Array} List of optimal keywords based on TextRank.
     */
    
    const textRank = new TextRank4Keyword(null, ['NN']);
    textRank.analyze(text, 5, true );
    const keywords = textRank.getKeywords(100, 5);

    const scores = keywords.map(kw => kw.weight);

    if (!scores.length) {
        return [];
    }

    const x = Array.from({ length: scores.length }, (_, i) => i + 1);
    const kneeLocator = new KneeLocator(x, scores, { curve: 'convex', direction: 'decreasing' });
    const cutoff = kneeLocator.knee || scores.length;
    //console.log(cutoff)

    const optimalKeywords = keywords.slice(0, cutoff).map(kw => kw.word);  //Too much and we see too much information to cluster

    //console.log("Filtered",filteredWords);
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
    // Remove punctuation (defined in "punctuations") and split by whitespace.
    const tokens = messageText.replace(new RegExp(`[${punctuations}]`, 'g'), '').split(/\s+/);
  
    tokens.forEach(token => {
      const lowerToken = token.toLowerCase();
      if (lowerToken.startsWith('http')) {
        // Normalize the URL token by replacing certain punctuation with a space.
        // Then split into sub-tokens and filter out undesired parts.
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
      } 
      else if (!loadedStopwords.has(lowerToken) || (token === token.toUpperCase() && token.length > 1)) {
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













window.dictionaryGlossaryTopicAndLinkedConversationGroups = Object.create(null);
let summaryArrayHtmlResults = Object.create(null);




function loadConversationEngine(discord_data) {

    window.conversationBlocks = [];
    window.processedConversationBlocks = [];

    let discordMessageData;
    try {
        // Parse the provided JSON data
        discordMessageData = JSON.parse(discord_data);
    } catch (error) {
        console.error("Error parsing JSON data:", error);
        return;
    }

    // Process the messages based on the parsed data
    const [conversationBlocks, processedConversationBlocks] = groupAndPreprocessMessages(discordMessageData);
    
    window.conversationBlocks = conversationBlocks
    window.processedConversationBlocks = processedConversationBlocks
    // Return the processed conversation blocks
    return {
        conversationBlocks: window.conversationBlocks,
        processedConversationBlocks: window.processedConversationBlocks
    };
}

/**
 * Checks if the provided message contains any word from the query words set.
 *
 * @param {Set<string>} queryWordsSet - A set of words to search for.
 * @param {string} message - The message text in which to search for query words.
 * @return {boolean} - Returns true if any query word is found in the message.
 */
function messageContainsAnyQueryWord(queryWordsSet, message) {
    const messageWordsSet = new Set(message.split(' '));
    return [...queryWordsSet].some(word => messageWordsSet.has(word));
}

/**
 * Recursively builds a context chain from adjacent message blocks.
 *
 * @param {Set<string>} inheritedWords - A set of words carried over from previous blocks.
 * @param {number} radius - The current search radius.
 * @param {number} currentIndex - The index of the current message block.
 * @param {Set<number>} visitedIndices - A set of message indices that have already been processed.
 * @param {Array<Object>} contextChain - An array accumulating the chain of context blocks.
 * @param {number} recursionDepth - The current depth of recursion (default is 1).
 */
function buildContextChainRecursively(inheritedWords, radius, currentIndex, visitedIndices, contextChain, recursionDepth = 1) {
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

                // Expand the set of inherited words with the current message's words.
                const expandedWords = new Set([...inheritedWords, ...neighborMessage.split(' ')]);
                // Reduce the search radius for the next recursion level, ensuring it never falls below 1.
                const newRadius = Math.max(Math.floor(radius / 2), 1);
                buildContextChainRecursively(expandedWords, newRadius, neighborIndex, visitedIndices, contextChain, recursionDepth + 1);
            }
        }
    }
}

/**
 * Global object to store generated context chains keyed by topic IDs.
 */
window.contextChainsCircaSeedIndexIds = Object.create(null);

/**
 * A set to track message block indices that have already been processed.
 */
let processedBlockIndices = new Set();

/**
 * A counter for the number of generated chains.
 */
let generatedChainCount = 0;

/**
 * Processes all conversation blocks to autonomously generate context chains.
 * Ensures that each block is only processed once.
 *
 * @returns The result of the calculateGlossary() function.
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
 * If a specific index is provided, it will process that block; otherwise,
 * it can default to a random block if desired.
 *
 * @param {number|null} index - The index of the conversation block to process.
 */
function processContextChainAtIndex(index = null) {
    let searchRadius = 50;
    try {
        if (isNaN(searchRadius)) {
            throw new Error("Invalid search radius input.");
        }
    } catch (error) {
        console.error(error);
        return;
    }

    if (window.processedConversationBlocks && window.processedConversationBlocks.length > 0) {
        // Use the provided index or pick a random one if null.
        const blockIndex = (index !== null) ? index : Math.floor(Math.random() * window.processedConversationBlocks.length);
        const initialMessage = window.processedConversationBlocks[blockIndex];
        const initialWordSet = new Set(initialMessage.split(' '));
        const visitedIndices = new Set([blockIndex]);
        const contextChain = [{
            blockIndex: blockIndex,
            message: window.conversationBlocks[blockIndex],
            depth: 1
        }];

        // Build the context chain starting from the selected block.
        buildContextChainRecursively(initialWordSet, searchRadius, blockIndex, visitedIndices, contextChain);

        // If the context chain is too short and a specific index was provided, mark it as processed and exit.
        if (contextChain.length < Math.floor(searchRadius / 4) && index !== null) {
            processedBlockIndices.add(index);
            return;
        }

        // Sort the context chain by block index for consistent ordering.
        contextChain.sort((a, b) => a.blockIndex - b.blockIndex);
        const seedId = blockIndex.toString();
        window.contextChainsCircaSeedIndexIds[seedId] = contextChain.map(entry => ({
            message: entry.message,
            messageId: entry.blockIndex
        }));

        // Mark all indices in the chain as processed.
        processedBlockIndices = new Set([...processedBlockIndices, ...contextChain.map(entry => entry.blockIndex)]);
        generatedChainCount++;
    }
}



/**
 * For each context chain, aggregates the associated messages,
 * extracts topic descriptions from the aggregated text, and updates
 * a global topical matrix with weighted co-occurrence scores between topics.
 */
function calculateTopicsForEachMessage() {
    // Initialize the topical matrix.
    window.topicalMatrix = Object.create(null);
  
    const contextChains = window.contextChainsCircaSeedIndexIds;
    if (!Object.keys(contextChains).length) {
      return;
    }
  
    const IMPORTANCE_WEIGHT = 3;  // Higher weight means topics need to appear more often at the top to be considered important.
    const PROXIMITY_WEIGHT = 1;     // Adjusts how strongly the distance between topics affects their weighting.
  
    // Process each context chain.
    for (const [seedId, messagesDescribingThisContext] of Object.entries(contextChains)) {
      // Aggregate messages from the processed conversation blocks.
      const aggregatedText = messagesDescribingThisContext
        .map(entry => window.processedConversationBlocks[entry.messageId])
        .join("\n");
      
      // Extract topics from the aggregated text.
      const topics = extractTopics(aggregatedText);
      
      // Append the topic description to the chain entries.
      messagesDescribingThisContext.push({ description: topics });
      
      // Ensure each topic has an initialized entry in the topical matrix.
      topics.forEach(topic => {
        if (!window.topicalMatrix[topic]) {
          window.topicalMatrix[topic] = Object.create(null);
        }
      });
      
      // For each topic, update the co-occurrence weights with all higher-ranked topics.
      topics.forEach((currentTopic, currentIdx) => {
        for (let prevIdx = 0; prevIdx < currentIdx; prevIdx++) {
          const previousTopic = topics[prevIdx];
          if (!window.topicalMatrix[currentTopic][previousTopic]) {
            window.topicalMatrix[currentTopic][previousTopic] = 0;
          }
          const importanceFactor = 1 / (prevIdx + 1);
          const normalizedProximityFactor = (1 / (currentIdx - prevIdx)) / currentIdx;
          window.topicalMatrix[currentTopic][previousTopic] += 
            (1 / IMPORTANCE_WEIGHT) * importanceFactor +
            (1 / PROXIMITY_WEIGHT) * normalizedProximityFactor;
        }
      });
    }
  }
  
  
  /**
   * Iterates through each context chain (identified by topic)
   * and assigns each extracted topic (keyword) a corresponding group
   * of message IDs in the global glossary.
   */
  function assignEachTopicRelevantMessageGroups() {
    const contextChains = window.contextChainsCircaSeedIndexIds;
    const glossary = window.dictionaryGlossaryTopicAndLinkedConversationGroups;
    if (!contextChains) return;
  
    // For each context chain.
    Object.entries(contextChains).forEach(([seedId, messagesDescribingThisContext]) => {
      // Retrieve the topics from the last entry (the one containing the description).
      const lastEntry = messagesDescribingThisContext[messagesDescribingThisContext.length - 1];
      const topics = (lastEntry && lastEntry.description) || [];
      if (!topics.length) return;
  
      // Collect message IDs from the entire chain.
      const messageIds = messagesDescribingThisContext.map(entry => entry.messageId);
  
      // For each topic keyword, add the group of message IDs to the glossary.
      topics.forEach(topic => {
        if (!glossary[topic]) {
          glossary[topic] = [];
        }
        glossary[topic].push(messageIds);
      });
    });
  }
  





function intersectCompressor(data) {
    console.log("Compressing...");
    // Iterate through the data and compress each dictionaryGlossaryTopicAndLinkedConversationGroups entry

    let completeStart = Date.now();
    for (let keyword in data) {
        data[keyword] = compressGlossaryEntries(keyword, data[keyword], 0.7);
    }

    console.log(`End of compression: ${Date.now() - completeStart} ms`);
    return data; // Ensure the modified data is returned
}

function calculateGlossary() {
    window.dictionaryGlossaryTopicAndLinkedConversationGroups = Object.create(null);

    var completeStart = Date.now()
    
    calculateTopicsForEachMessage();

    console.log(`End of 1: ${Date.now() - completeStart} ms`);

    var completeStart = Date.now()
    
    //console.log(window.contextChainsCircaSeedIndexIds)
    assignEachTopicRelevantMessageGroups();

    console.log(`End of 2: ${Date.now() - completeStart} ms`);


    var completeStart = Date.now()

    window.dictionaryGlossaryTopicAndLinkedConversationGroups = intersectCompressor(window.dictionaryGlossaryTopicAndLinkedConversationGroups);

    console.log(`End of 3: ${Date.now() - completeStart} ms`);


    return {
        dictionaryGlossaryTopicAndLinkedConversationGroups: window.dictionaryGlossaryTopicAndLinkedConversationGroups,
    }

}


function breakCycles(graph) {
    let visited = new Set();
    let stack = new Set();
    let edgesToRemove = [];

    // Depth-First Search (DFS) helper function
    function dfs(node, parent) {
        if (stack.has(node)) {  // Cycle detected
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
                // Add the problematic edge to a list for removal
                edgesToRemove.push([node, neighbor]);
            }
        }

        stack.delete(node);
        return false;
    }

    // Detect cycles and track edges to remove
    for (let node in graph) {
        if (!visited.has(node)) {
            dfs(node, null);
        }
    }

    // Break the cycles by removing problematic edges
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

function calculateDisplayGlossary()
{
    var completeStart = Date.now()


    let key_structure = Object.create(null)
    // Build the topical matrix
    for (let key in window.topicalMatrix) {
        let topics = window.topicalMatrix[key];
        let max_score = -1;
        let max_topics = [];

        // Iterate through topics and scores
        for (let topic in topics) {
            let score = topics[topic];
            if (score > max_score) {
                max_score = score; // Update the maximum score
                max_topics = [topic]; // Reset to this topic
            } else if (score === max_score) {
                max_topics.push(topic); // Add this topic to the list of max-score topics
            }
        }

        // Handle the case where there are multiple topics with the same max score
        if (max_score !== -1) {
            let max_topic;
            if (max_topics.length > 1) {
                // Choose the topic with the largest size in window.topicalMatrix
                max_topic = max_topics.reduce((a, b) => 
                    (Object.keys(window.topicalMatrix[a]).length > Object.keys(window.topicalMatrix[b]).length ? a : b)
                );
            } else {
                max_topic = max_topics[0];
            }
            if (Object.keys(window.topicalMatrix[max_topic]).length > Object.keys(window.topicalMatrix[key]).length)
            {
            // Add the key to the "subgroups" of the topic with the max score
            if (!(max_topic in key_structure)) {
                key_structure[max_topic] = { "subgroups": [] };
            }
            key_structure[max_topic]["subgroups"].push(key);
        }
        }
    }
    console.log("Breaking cycles...")
    key_structure = breakCycles(key_structure)
    console.log(key_structure)
    console.log("Ended that")
    //const { independentGroups, hierarchicalRelationships } = generateSubtopicTreeAndDisplayTree(window.dictionaryGlossaryTopicAndLinkedConversationGroups);
    let hierarchicalRelationships =  key_structure 
    let independentGroups = []


    console.log(`End of 4: ${Date.now() - completeStart} ms`);

    return {
        independentGroups: independentGroups,
        hierarchicalRelationships: hierarchicalRelationships
    };
    
}



export { loadConversationEngine, processAllContextChains,calculateGlossary,calculateDisplayGlossary };