// Importing necessary libraries and local files in JavaScript
// For part-of-speech tagging

// Natural language processing utilities

import { TextRank4Keyword } from '/textrank.js'
// For knee detection (if necessary)
import { KneeLocator } from '/knee_locator.js';  

// Importing custom local modules for group theory and glossary compression
import { generateSubtopicTreeAndDisplayTree } from '/GroupTheory.js';  // Import your group theory module
import { compressGlossaryEntries } from '/glossary_compression.js';  // Import glossary compression module
import { POS } from '/index.js'

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

function extractTopics(text, visualize = false) {
    /**
     * Extract keywords from the text and visualize the elbow/knee for keyword selection.
     * 
     * @param text {String} The input text to analyze.
     * @param visualize {Boolean} Whether or not to visualize the keyword selection.
     * @return {Array} List of optimal keywords based on TextRank.
     */
    
    const textRank = new TextRank4Keyword(null, ['NN']);
    textRank.analyze(text, 5, true );
    const keywords = textRank.getKeywords(100, 3);

    const scores = keywords.map(kw => kw.weight);

    if (!scores.length) {
        return [];
    }

    const x = Array.from({ length: scores.length }, (_, i) => i + 1);
    const kneeLocator = new KneeLocator(x, scores, { curve: 'convex', direction: 'decreasing' });
    const cutoff = kneeLocator.knee || scores.length;


    const optimalKeywords = keywords.slice(0, cutoff).map(kw => kw.word);

    //console.log("Filtered",filteredWords);
    return optimalKeywords;
}






let FILEPATH = null;
let GLOSSARY_FILEPATH = null;
let SUMMARIES_FILEPATH = null;
const MESSAGE_SEPARATOR = '--------------------------------------------------';

// Load stopwords from JSON file
let loadedStopwords = new Set(window.ENStopword);


const punctuations = `",!?.)(:”’''*🙏🤔💀😈😭😩😖🤔🥰🥴😩🙂😄'“\``;

console.log(punctuations);




function removeStopwordsFromMessageText(messageText) {
    const result = [];
    const words = messageText.replace(new RegExp(`[${punctuations}]`, 'g'), '').split(' ');

    words.forEach(word => {
        if (word.toLowerCase().startsWith('http')) {
            const translatedText = word.replace(/[:/. -]/g, ' ');
            translatedText.split(' ').forEach(part => {
                if (!part.toLowerCase().startsWith('http') &&
                    !['com', 'www', 'ai'].includes(part.toLowerCase()) &&
                    !loadedStopwords.has(part.toLowerCase())) {
                    result.push(part);
                }
            });
        } else if (!loadedStopwords.has(word.toLowerCase()) || (word === word.toUpperCase() && word.length > 1)) {
            result.push(word);
        }
    });

    return result;
}

function groupAndPreprocessMessagesByAuthor(messageData) {
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













window.dictionaryGlossaryTopicAndLinkedConversationGroups = {};
let summaryArrayHtmlResults = {};




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
    const [conversationBlocks, processedConversationBlocks] = groupAndPreprocessMessagesByAuthor(discordMessageData);
    
    window.conversationBlocks = conversationBlocks
    window.processedConversationBlocks = processedConversationBlocks
    // Return the processed conversation blocks
    return {
        conversationBlocks: window.conversationBlocks,
        processedConversationBlocks: window.processedConversationBlocks
    };
}


// Optimized function to search for a query within a message block using set operations
function findQueryInMessageBlock(querySet, messageBlock) {
    const messageBlockWords = new Set(messageBlock.split(' '));
    return [...querySet].some(word => messageBlockWords.has(word));
}

// Optimized recursive function to construct context chain with probability updates
function constructContextChain(inheritedWordsSet, searchRadius, currentMessageIndex, visitedIndices, contextChain, recursionDepth = 1) {
    const startIndex = Math.max(0, currentMessageIndex - searchRadius);
    const endIndex = Math.min(window.processedConversationBlocks.length, currentMessageIndex + searchRadius + 1);

    for (let blockIndex = startIndex; blockIndex < endIndex; blockIndex++) {
        if (!visitedIndices.has(blockIndex)) {
            if (findQueryInMessageBlock(inheritedWordsSet, window.processedConversationBlocks[blockIndex])) {
                visitedIndices.add(blockIndex);
                contextChain.push({
                    blockIndex,
                    message: window.conversationBlocks[blockIndex],
                    depth: recursionDepth
                });

                const expandedWordSet = new Set([
                    ...inheritedWordsSet,
                    ...window.processedConversationBlocks[blockIndex].split(' ')
                ]);

                constructContextChain(expandedWordSet, Math.max(Math.floor(searchRadius / 2), 1), blockIndex, visitedIndices, contextChain, recursionDepth + 1);
            }
        }
    }
}


window.dictionarySeedConversationAndGeneratedChain = {};
let setIdsOfFoundConversations = new Set();
let i = 0;

function generateAndDisplayAllRandomContextChain() {
    /**
     * Autonomously finds and generates context chains for all conversations.
     * Ensures no duplicate processing for conversations already found.
     */

    setIdsOfFoundConversations = new Set();
    window.dictionarySeedConversationAndGeneratedChain = {};


    for (let index = 0; index < window.processedConversationBlocks.length; index++) {
        if (!setIdsOfFoundConversations.has(index)) {

            generateAndDisplayRandomContextChain2(index);
        }
    }

    return calculateGlossary()

}

function generateAndDisplayRandomContextChain2(index = null) {
    /**
     * Generates and displays a context chain for a specific conversation block.
     * If `index` is provided, it processes that specific conversation block; otherwise, 
     * it picks a random block to process.
     */
    let searchRadius = null;
    try {
        searchRadius = 50
        if (isNaN(searchRadius)) throw new Error("Invalid input");
    } catch (error) {

        return;
    }

    if (window.processedConversationBlocks && window.processedConversationBlocks.length > 0) {
        const blockIndex = index;
        const blockWords = new Set(window.processedConversationBlocks[blockIndex].split(' '));
        const visitedBlockIndices = new Set([blockIndex]);
        const contextChain = [{ blockIndex, message: window.conversationBlocks[blockIndex], depth: 1 }];

        // Construct the context chain using the helper function
        constructContextChain(blockWords, searchRadius, blockIndex, visitedBlockIndices, contextChain);

        // If the chain is too short and `index` was specified, stop processing this block
        if (contextChain.length < Math.floor(searchRadius / 4) && index !== null) {
            setIdsOfFoundConversations.add(index);
            return;
        }

        contextChain.sort((a, b) => a.blockIndex - b.blockIndex);
        const topicId = blockIndex.toString();
        window.dictionarySeedConversationAndGeneratedChain[topicId] = contextChain.map(({ blockIndex, message }) => ({
            message,
            messageId: blockIndex
        }));
        setIdsOfFoundConversations = new Set([...setIdsOfFoundConversations, ...contextChain.map(({ blockIndex }) => blockIndex)]);
        i += 1;
    }
}

function calculateTopicsForEachMessage() {
    /**
     * Processes topics in the conversation glossary tree and extracts descriptions.
     */

    if (Object.keys(window.dictionarySeedConversationAndGeneratedChain).length === 0) {

        return;
    }

    let i = 0;
    for (const [topicId, convo] of Object.entries(window.dictionarySeedConversationAndGeneratedChain)) {
        const total = convo.map(entry => window.processedConversationBlocks[entry.messageId]).join("\n");
        const description = extractTopics(total);
        convo.push({ description });


        i++;
    }
}



function assignEachTopicRelevantMessageGroups() {
    /**
     * Updates the dictionaryGlossaryTopicAndLinkedConversationGroups with keywords mapped to message IDs.
     */
    const dictionary = window.dictionarySeedConversationAndGeneratedChain;
    const glossary = window.dictionaryGlossaryTopicAndLinkedConversationGroups;

    if (!dictionary) {
        return;
    }

    // Iterate over all topics in the dictionary
    for (let [topicId, topicData] of Object.entries(dictionary)) {
        const lastEntry = topicData[topicData.length - 1];
        const description = lastEntry?.description || '';
        
        if (!description) {
            continue;
        }

        // Collect all message IDs upfront
        const messageIds = [];
        for (let entry of topicData) {
            messageIds.push(entry.messageId);
        }

        // Use a Set to avoid duplicating messageIds for the same keyword
        const keywords = description; // Split once and remove duplicates
        for (let keyword of keywords) {
            if (!glossary[keyword]) {
                glossary[keyword] = []; // Initialize if undefined
            }
            glossary[keyword].push(messageIds); // Append the message IDs to the list
        }
    }
}

function displayConversationsLinkedToSelectedTopic(item, conversationNumber) {
    /**
     * Displays the selected dictionaryGlossaryTopicAndLinkedConversationGroups item and its associated conversation blocks.
     *
     * @param {string} item - The selected dictionaryGlossaryTopicAndLinkedConversationGroups item (topic or ID) to be displayed.
     * @param {number} conversationNumber - The conversation number to display.
     */

    let topicName = item; // If the item is an ID, you might need to map it to the dictionaryGlossaryTopicAndLinkedConversationGroups data


    // Display associated conversation blocks for this topic
    if (window.dictionaryGlossaryTopicAndLinkedConversationGroups[topicName]) {
        let convoBlock = window.dictionaryGlossaryTopicAndLinkedConversationGroups[topicName][conversationNumber];
        for (let messageId of convoBlock) {
            // Fetch the message from the conversation block using messageId
            let message = window.conversationBlocks[messageId];


        }
    }
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
    window.dictionaryGlossaryTopicAndLinkedConversationGroups = {};

    var completeStart = Date.now()
    
    calculateTopicsForEachMessage();

    console.log(`End of 1: ${Date.now() - completeStart} ms`);

    var completeStart = Date.now()
    
    //console.log(window.dictionarySeedConversationAndGeneratedChain)
    assignEachTopicRelevantMessageGroups();

    console.log(`End of 2: ${Date.now() - completeStart} ms`);


    var completeStart = Date.now()

    window.dictionaryGlossaryTopicAndLinkedConversationGroups = intersectCompressor(window.dictionaryGlossaryTopicAndLinkedConversationGroups);

    console.log(`End of 3: ${Date.now() - completeStart} ms`);


    return {
        dictionaryGlossaryTopicAndLinkedConversationGroups: window.dictionaryGlossaryTopicAndLinkedConversationGroups,
    }

}

function calculateDisplayGlossary()
{
    var completeStart = Date.now()


    const { independentGroups, hierarchicalRelationships } = generateSubtopicTreeAndDisplayTree(window.dictionaryGlossaryTopicAndLinkedConversationGroups);


    console.log(`End of 4: ${Date.now() - completeStart} ms`);

    return {
        independentGroups: independentGroups,
        hierarchicalRelationships: hierarchicalRelationships
    };
    
}



export { loadConversationEngine, generateAndDisplayAllRandomContextChain,calculateGlossary,calculateDisplayGlossary };