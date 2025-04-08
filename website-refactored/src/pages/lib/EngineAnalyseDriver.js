// Driver for calling Engine to Analyse Data.
import { loadConversationEngine, processAllContextChains, calculateGlossary, calculateDisplayGlossary } from  './engine';

// TODO make variables more readable

export async function engineAnalyseDriver(fileContent, filename)
{
    // fileContent MUST be string.
    // returns {status: [BOOL], message: [STRING], glossary: [OBJECT], tree: [OBJECT], conversationBlocks: [OBJECT]}
    try {
        // Load the conversation blocks and generate context chains
        const { conversationBlocks } = loadConversationEngine(fileContent);
        const { dictionaryGlossaryTopicAndLinkedConversationGroups } = processAllContextChains();


        // Store glossary and conversation blocks in global variables
        let glossary = dictionaryGlossaryTopicAndLinkedConversationGroups;
        //let conversation_block = conversationBlocks;

        const { independentGroups, hierarchicalRelationships } = await calculateDisplayGlossary()

        // DONE.
        return { "status": true, "message": "Success", glossary: glossary, tree: hierarchicalRelationships, blocks: conversationBlocks}

    } catch (error) {
        return { "status": false, "message": error }
    }
}