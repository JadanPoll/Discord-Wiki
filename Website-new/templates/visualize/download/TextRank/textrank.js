
import { util } from '/util.js'
import { Segmentation } from '/Segmentation.js';
export class TextRank4Keyword {
    constructor(stopWordsFile = null, allowSpeechTags = util.allowSpeechTags, delimiters = util.sentenceDelimiters) {
        /**
         * Constructor for TextRank4Keyword
         * @param {string|null} stopWordsFile - Path to stop words file
         * @param {Array<string>} allowSpeechTags - List of allowed speech tags
         * @param {Array<string>} delimiters - Sentence delimiters
         */
        this.text = '';
        this.keywords = null;
        this.segmentation = new Segmentation(stopWordsFile, allowSpeechTags, delimiters);

        this.sentences = null;
        this.wordsNoFilter = null;      // 2D array
        this.wordsNoStopWords = null;  // 2D array
        this.wordsAllFilters = null;   // 2D array
    }

    analyze(text, window = 2, lower = false, vertexSource = 'all_filters', edgeSource = 'no_stop_words', pagerankConfig = { alpha: 0.85 }) {
        /**
         * Analyze the text and construct the word graph.
         * @param {string} text - Input text
         * @param {number} window - Window size for constructing edges
         * @param {boolean} lower - Convert text to lowercase
         * @param {string} vertexSource - Source for vertex construction
         * @param {string} edgeSource - Source for edge construction
         * @param {Object} pagerankConfig - PageRank configuration
         */
        this.text = text;
        this.wordIndex = Object.create(null);
        this.indexWord = Object.create(null);
        this.keywords = [];
        this.graph = null;

        const result = this.segmentation.segment(text, lower);
        this.sentences = result.sentences;
        this.wordsNoFilter = result.wordsNoFilter;
        this.wordsNoStopWords = result.wordsNoStopWords;
        this.wordsAllFilters = result.wordsAllFilters;

        const options = ['noFilter', 'noStopWords', 'allFilters'];
        const vertexSourceKey = options.includes(vertexSource) ? `words${vertexSource}` : 'wordsAllFilters';
        const edgeSourceKey = options.includes(edgeSource) ? `words${edgeSource}` : 'wordsNoStopWords';

        const vertexSourceWords = result[vertexSourceKey];
        const edgeSourceWords = result[edgeSourceKey];


        this.keywords = util.sortWords(vertexSourceWords, edgeSourceWords, window, pagerankConfig);
    }

    getKeywords(num = 6, wordMinLen = 1) {
        /**
         * Get the top `num` keywords with a minimum word length of `wordMinLen`.
         * @param {number} num - Number of keywords to return
         * @param {number} wordMinLen - Minimum length of a keyword
         * @returns {Array} - List of keywords
         */
        const result = [];
        let count = 0;
        for (const item of this.keywords) {
            if (count >= num) break;
            if (item.word.length >= wordMinLen) {
                result.push(item);
                count++;
            }
        }
        return result;
    }

    getKeyphrases(keywordsNum = 12, minOccurNum = 2) {
        /**
         * Extract key phrases based on the top `keywordsNum` keywords.
         * @param {number} keywordsNum - Number of top keywords to consider
         * @param {number} minOccurNum - Minimum occurrences of a phrase in the text
         * @returns {Array} - List of key phrases
         */
        const keywordsSet = new Set(this.getKeywords(keywordsNum, 1).map(item => item.word));
        const keyphrases = new Set();

        for (const sentence of this.wordsNoFilter) {
            let tempPhrase = [];
            for (const word of sentence) {
                if (keywordsSet.has(word)) {
                    tempPhrase.push(word);
                } else {
                    if (tempPhrase.length > 1) keyphrases.add(tempPhrase.join(''));
                    tempPhrase = [];
                }
            }
            if (tempPhrase.length > 1) keyphrases.add(tempPhrase.join(''));
        }

        return Array.from(keyphrases).filter(phrase => this.text.split(phrase).length - 1 >= minOccurNum);
    }
}

// Example Usage
// Assuming Segmentation and util are implemented with necessary functionality
//const tr4k = new TextRank4Keyword();
//tr4k.analyze("Your text here.");
//console.log(tr4k.getKeywords());
//console.log(tr4k.getKeyphrases());
