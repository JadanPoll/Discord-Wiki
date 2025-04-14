// Driver for calling Engine to Analyse Data.
import { loadConversationEngine, processAllContextChains, calculateGlossary, calculateDisplayGlossary } from  './engine2';

// TODO make variables more readable

export async function engineAnalyseDriver(fileContent, filename)
{
    // fileContent MUST be string.
    // returns {status: [BOOL], message: [STRING], glossary: [OBJECT], tree: [OBJECT], conversationBlocks: [OBJECT]}
    try {
        // Load the conversation blocks and generate context chains
        const { conversationBlocks } = loadConversationEngine(fileContent);
        const { dictionaryGlossaryTopicAnd__itsArrayConversationGroups } = processAllContextChains();



        // Make a deep clone of the global glossary data.
        // Deep clone (in case you plan to manipulate it)
        let glossary = JSON.parse(JSON.stringify(dictionaryGlossaryTopicAnd__itsArrayConversationGroups));


        // Converts a Uint32Array bit vector into an array of message IDs
        function bitVectorToMessageIDs(bitVec) {
        const result = [];
        for (let wordIndex = 0; wordIndex < bitVec.length; wordIndex++) {
            let word = bitVec[wordIndex];
            if (word === 0) continue;
            for (let bit = 0; bit < 32; bit++) {
            if (word & (1 << bit)) {
                const blockIndex = (wordIndex << 5) + bit;
                result.push(blockIndex);
            }
            }
        }
        return result;
        }

        // Final output structure
        const glossaryMessageIDs = {};

        for (const topic in glossary) {
        glossaryMessageIDs[topic] = glossary[topic].map((bitObj, i) => {
            const length = Object.keys(bitObj).length;
            const vec = new Uint32Array(length);
            for (let key in bitObj) {
            vec[parseInt(key)] = bitObj[key];
            }

            const messageIDs = bitVectorToMessageIDs(vec);
            return messageIDs;
        });
        }

        //let conversation_block = conversationBlocks;

        const { independentGroups, hierarchicalRelationships } = await calculateDisplayGlossary()

        // DONE.
        return { "status": true, "message": "Success", glossary: glossaryMessageIDs, tree: hierarchicalRelationships, blocks: conversationBlocks}

    } catch (error) {
        return { "status": false, "message": error }
    }
}