// Importing necessary libraries and local files in JavaScript
// For part-of-speech tagging

// Natural language processing utilities

import { TextRank4Keyword } from './TextRank/textrank'
// For knee detection (if necessary)
import { KneeLocator } from 'knee-locator';  

// Importing custom local modules for group theory and glossary compression
import GroupTheory from './GroupTheory.js';  // Import your group theory module
import GlossaryCompression from './glossary_compression.js';  // Import glossary compression module


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
    
    const textRank = TextRank4Keyword();
    textRank.analyze(text, { windowSize: 5, useLowerCase: true });
    const keywords = textRank.getRankedPhrases({ minWordLength: 3 });

    const scores = keywords.map(kw => kw.score);

    if (!scores.length) {
        return [];
    }

    const x = Array.from({ length: scores.length }, (_, i) => i + 1);
    const kneeLocator = new KneeLocator(x, scores, { curve: 'convex', direction: 'decreasing' });
    const cutoff = kneeLocator.knee || scores.length;

    const optimalKeywords = keywords.slice(0, cutoff).map(kw => kw.phrase);

    const posToKeep = ['Noun'];  // POS tags to keep (e.g., Nouns)
    const filteredWords = filterWordsByPartOfSpeechTag(optimalKeywords, posToKeep);

    console.log(filteredWords);
    return filteredWords;
}






let FILEPATH = null;
let GLOSSARY_FILEPATH = null;
let SUMMARIES_FILEPATH = null;
const MESSAGE_SEPARATOR = '--------------------------------------------------';

// Load stopwords from JSON file
let loadedStopwords = new Set();

loadedStopwords = new Set(JSON.parse(window.ENStopword))

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
                    !stopwords.includes(part.toLowerCase())) {
                    result.push(part);
                }
            });
        } else if (!stopwords.includes(word.toLowerCase()) || (word === word.toUpperCase() && word.length > 1)) {
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












let conversationBlocks;
let processedConversationBlocks;
let dictionaryGlossaryTopicAndLinkedConversationGroups = {};
let summaryArrayHtmlResults = {};



function loadConversationEngine() {
    summaryArrayHtmlResults = {};

    // Create a file input element dynamically
    const fileInput = document.createElement('input');
    fileInput.type = 'file';  // Set file input type
    fileInput.accept = '.json';  // Restrict to JSON files

    // Event listener for when a file is selected
    fileInput.addEventListener('change', function(event) {
        const FILEPATH = fileInput.files[0];  // Get the selected file
        if (!FILEPATH) {
            console.log('No file selected.');
            return;
        }

        // Set the paths for glossary and summaries (based on the file name)
        GLOSSARY_FILEPATH = `GLOSSARY/GLOSSARY_${FILEPATH.name}`;
        SUMMARIES_FILEPATH = `SUMMARY/SUMMARY_${FILEPATH.name}`;

        const fileReader = new FileReader();

        // When the file is loaded, process it
        fileReader.onload = function() {
            let fileContent = fileReader.result;

            let discordMessageData;
            try {
                discordMessageData = JSON.parse(fileContent);  // Parse the JSON data
            } catch (error) {
                console.error("Error parsing JSON file:", error);
                return;
            }

            // Process the messages based on the parsed data
            const [conversationBlocks, processedConversationBlocks] = groupAndPreprocessMessagesByAuthor(discordMessageData);

            // Return the processed conversation blocks
            return {
                conversationBlocks: conversationBlocks,
                processedConversationBlocks: processedConversationBlocks
            };
        };

        // Read the selected file as text
        fileReader.readAsText(FILEPATH);
    });

    // Trigger the file input dialog
    fileInput.click();
}


// Optimized function to search for a query within a message block using set operations
function findQueryInMessageBlock(querySet, messageBlock) {
    const messageBlockWords = new Set(messageBlock.split(' '));
    return [...querySet].some(word => messageBlockWords.has(word));
}

// Optimized recursive function to construct context chain with probability updates
function constructContextChain(inheritedWordsSet, searchRadius, currentMessageIndex, visitedIndices, contextChain, recursionDepth = 1) {
    const startIndex = Math.max(0, currentMessageIndex - searchRadius);
    const endIndex = Math.min(processedConversationBlocks.length, currentMessageIndex + searchRadius + 1);

    for (let blockIndex = startIndex; blockIndex < endIndex; blockIndex++) {
        if (!visitedIndices.has(blockIndex)) {
            if (findQueryInMessageBlock(inheritedWordsSet, processedConversationBlocks[blockIndex])) {
                visitedIndices.add(blockIndex);
                contextChain.push({
                    blockIndex,
                    message: conversationBlocks[blockIndex],
                    depth: recursionDepth
                });

                const expandedWordSet = new Set([
                    ...inheritedWordsSet,
                    ...processedConversationBlocks[blockIndex].split(' ')
                ]);

                constructContextChain(expandedWordSet, Math.max(Math.floor(searchRadius / 2), 1), blockIndex, visitedIndices, contextChain, recursionDepth + 1);
            }
        }
    }
}


let dictionarySeedConversationAndGeneratedChain = {};
let setIdsOfFoundConversations = new Set();
let i = 0;

function generateAndDisplayAllRandomContextChain() {
    /**
     * Autonomously finds and generates context chains for all conversations.
     * Ensures no duplicate processing for conversations already found.
     */

    setIdsOfFoundConversations = new Set();
    dictionarySeedConversationAndGeneratedChain = {};
    console.log("Again", processedConversationBlocks.length);

    for (let index = 0; index < processedConversationBlocks.length; index++) {
        if (!setIdsOfFoundConversations.has(index)) {
            generateAndDisplayRandomContextChain2(index);
        }
    }
    return calculateThenDisplayGlossary()

}

function generateAndDisplayRandomContextChain2(index = null) {
    /**
     * Generates and displays a context chain for a specific conversation block.
     * If `index` is provided, it processes that specific conversation block; otherwise, 
     * it picks a random block to process.
     */
    try {
        const searchRadius = parseInt(contextRadiusInput.value, 10);
        if (isNaN(searchRadius)) throw new Error("Invalid input");
    } catch (error) {

        return;
    }

    if (processedConversationBlocks && processedConversationBlocks.length > 0) {
        const blockIndex = index;
        const blockWords = new Set(processedConversationBlocks[blockIndex].split(' '));
        const visitedBlockIndices = new Set([blockIndex]);
        const contextChain = [{ blockIndex, message: conversationBlocks[blockIndex], depth: 1 }];

        // Construct the context chain using the helper function
        constructContextChain(blockWords, searchRadius, blockIndex, visitedBlockIndices, contextChain);

        // If the chain is too short and `index` was specified, stop processing this block
        if (contextChain.length < Math.floor(searchRadius / 4) && index !== null) {
            setIdsOfFoundConversations.add(index);
            return;
        }

        contextChain.sort((a, b) => a.blockIndex - b.blockIndex);
        const topicId = blockIndex.toString();
        dictionarySeedConversationAndGeneratedChain[topicId] = contextChain.map(({ blockIndex, message }) => ({
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
    if (Object.keys(dictionarySeedConversationAndGeneratedChain).length === 0) {

        return;
    }

    let i = 0;
    for (const [topicId, convo] of Object.entries(dictionarySeedConversationAndGeneratedChain)) {
        const total = convo.map(entry => processedConversationBlocks[entry.messageId]).join("\n");
        const description = extractTopics(total);
        convo.push({ description });
        console.log(`Next: ${i}`);
        i++;
    }
}





function assignEachTopicRelevantMessageGroups() {
    /**
     * Updates the dictionaryGlossaryTopicAndLinkedConversationGroups with keywords mapped to message IDs.
     */
    if (!dictionarySeedConversationAndGeneratedChain) {
        return;
    }

    for (let [topicId, topicData] of Object.entries(dictionarySeedConversationAndGeneratedChain)) {
        let description = topicData[topicData.length - 1].description || ''; // Assume last entry is the description
        if (!description) {
            console.log("not here");
            continue;
        }

        let keywords = description;
        let messageIds = topicData
            .filter(entry => entry.messageId !== undefined)
            .map(entry => entry.messageId);

        for (let keyword of keywords) {
            if (!dictionaryGlossaryTopicAndLinkedConversationGroups[keyword]) {
                dictionaryGlossaryTopicAndLinkedConversationGroups[keyword] = []; // Initialize as an empty list
            }
            dictionaryGlossaryTopicAndLinkedConversationGroups[keyword].push(messageIds); // Append the messageIds array to the list
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
    if (dictionaryGlossaryTopicAndLinkedConversationGroups[topicName]) {
        let convoBlock = dictionaryGlossaryTopicAndLinkedConversationGroups[topicName][conversationNumber];
        for (let messageId of convoBlock) {
            // Fetch the message from the conversation block using messageId
            let message = conversationBlocks[messageId];


        }
    }
}

function intersectCompressor(data) {
    console.log("Compressing...");
    // Iterate through the data and compress each dictionaryGlossaryTopicAndLinkedConversationGroups entry

    let completeStart = Date.now();
    for (let keyword in data) {
        data[keyword] = GlossaryCompression.compressGlossaryEntries(keyword, data[keyword], 0.7);
    }

    console.log(`End of compression: ${Date.now() - completeStart} ms`);
    return data; // Ensure the modified data is returned
}

function calculateThenDisplayGlossary() {
    dictionaryGlossaryTopicAndLinkedConversationGroups = {};

    calculateTopicsForEachMessage();
    assignEachTopicRelevantMessageGroups();
    dictionaryGlossaryTopicAndLinkedConversationGroups = intersectCompressor(dictionaryGlossaryTopicAndLinkedConversationGroups);

    const { independentGroups, hierarchicalRelationships } = GroupTheory.generateSubtopicTreeAndDisplayTree(glossaryTree, 0.0, dictionaryGlossaryTopicAndLinkedConversationGroups);

    return {
        dictionaryGlossaryTopicAndLinkedConversationGroups: dictionaryGlossaryTopicAndLinkedConversationGroups,
        independentGroups: independentGroups,
        hierarchicalRelationships: hierarchicalRelationships
    };
    


}

export { loadConversationEngine, generateAndDisplayAllRandomContextChain };