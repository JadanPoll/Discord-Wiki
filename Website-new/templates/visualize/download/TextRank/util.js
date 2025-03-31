// JavaScript adaptation of Python script
// Author: letian
// Homepage: http://www.letiantian.me
// GitHub: https://github.com/someus/


import { pagerank } from '/pagerank.js'


let debugMode = false;

function debug(...args) {
    if (debugMode) {
        console.log(...args);
    }
}

class AttrDict {
    // Object that supports dot notation
    constructor(obj) {
        Object.assign(this, obj);
    }
}

// Combine words for constructing edges between words
function* combine(wordList, window = 2) {
    if (window < 2) window = 2;
    for (let x = 1; x < window; x++) {
        if (x >= wordList.length) break;
        const wordList2 = wordList.slice(x);
        for (let i = 0; i < wordList.length - x; i++) {
            yield [wordList[i], wordList2[i]];
        }
    }
}

// Calculate similarity between two sentences
function getSimilarity(wordList1, wordList2) {
    const words = Array.from(new Set([...wordList1, ...wordList2]));
    const vector1 = words.map(word => wordList1.filter(w => w === word).length);
    const vector2 = words.map(word => wordList2.filter(w => w === word).length);

    const coOccurNum = vector1.reduce((sum, val, idx) => sum + (val * vector2[idx] > 0 ? 1 : 0), 0);

    if (coOccurNum <= 1e-12) return 0;

    const denominator = Math.log(wordList1.length) + Math.log(wordList2.length);
    if (denominator < 1e-12) return 0;

    return coOccurNum / denominator;
}

// Sort words by importance using PageRank
function sortWords(vertexSource, edgeSource, window = 2, pagerankConfig = { alpha: 0.85 }) {
    const wordIndex = Object.create(null);
    const indexWord = Object.create(null);
    let wordsNumber = 0;

    vertexSource.forEach(wordList => {
        wordList.forEach(word => {
            if (!(word in wordIndex)) {
                wordIndex[word] = wordsNumber;
                indexWord[wordsNumber] = word;
                wordsNumber++;
            }
        });
    });

    const graph = Array.from({ length: wordsNumber }, () => Array(wordsNumber).fill(0));

    edgeSource.forEach(wordList => {
        for (const [w1, w2] of combine(wordList, window)) {
            if (w1 in wordIndex && w2 in wordIndex) {
                const index1 = wordIndex[w1];
                const index2 = wordIndex[w2];
                graph[index1][index2] = 1.0;
                graph[index2][index1] = 1.0;
            }
        }
    });

    debug('Graph:', graph);

    const scores = pagerank(graph, pagerankConfig.alpha);

    return scores
        .map((score, index) => new AttrDict({ word: indexWord[index], weight: score }))
        .sort((a, b) => b.weight - a.weight);
}

// Sort sentences by importance using PageRank
function sortSentences(sentences, words, simFunc = getSimilarity, pagerankConfig = { alpha: 0.85 }) {
    const sentencesNum = words.length;
    const graph = Array.from({ length: sentencesNum }, () => Array(sentencesNum).fill(0));

    for (let x = 0; x < sentencesNum; x++) {
        for (let y = x; y < sentencesNum; y++) {
            const similarity = simFunc(words[x], words[y]);
            graph[x][y] = similarity;
            graph[y][x] = similarity;
        }
    }

    const scores = pagerank(graph, pagerankConfig.alpha);

    return scores
        .map((score, index) => new AttrDict({ index, sentence: sentences[index], weight: score }))
        .sort((a, b) => b.weight - a.weight);
}


// Utility module (equivalent to the util module in Python)
export const util = {

    allowSpeechTags: [
      'JJ',   // Adjective (similar to 'an', 'j')
      'NN',   // Noun, singular or mass (similar to 'n')
      'NNS',  // Noun, plural
      'NNP',  // Proper noun, singular (similar to 'nr', 'ns', 'nt')
      'NNPS', // Proper noun, plural
      'RB',   // Adverb
      'VB',   // Verb, base form (similar to 'v')
      'VBD',  // Verb, past tense
      'VBG',  // Verb, gerund or present participle
      'VBN',  // Verb, past participle
      'VBP',  // Verb, non-3rd person singular present
      'VBZ',  // Verb, 3rd person singular present
      'IN',   // Preposition or subordinating conjunction (similar to 'i')
      'FW',   // Foreign word (similar to 'eng')
    ],
    
    sentenceDelimiters: ['?', '!', ';', '？', '！', '。', '；', '……', '…', '\n'],
    asText: (text) => String(text),
    debug: debug, // Use console.log for debugging
    combine: combine,
    getSimilarity: getSimilarity,
    sortWords: sortWords,
    sortSentences: sortSentences
  };

