

// Import required libraries
//const jieba = require('node-jieba'); // Jieba library for segmentation

import { POS } from './POS/index.js'
import { util } from './util.js'


// Get the default stopwords file
/*
Nathan remove
function getDefaultStopWordsFile() {
  return path.join(__dirname, 'stopwords.txt');
}
*/
// WordSegmentation class
class WordSegmentation {
  constructor(stopWordsFile = null, allowSpeechTags = util.allowSpeechTags) {
    this.defaultSpeechTagFilter = allowSpeechTags.map((tag) => util.asText(tag));
    this.stopWords = new Set();
    this.stopWordsFile = null//Nathan remove getDefaultStopWordsFile();

    if (typeof stopWordsFile === 'string') {
      this.stopWordsFile = stopWordsFile;
    }

    // Load stopwords
    /*
    Nathan Remove
    const stopWordsContent = fs.readFileSync(this.stopWordsFile, 'utf-8');
    stopWordsContent.split('\n').forEach((word) => {
      this.stopWords.add(word.trim());
    });
    */
  }

  segment0(text, lower = true, useStopWords = true, useSpeechTagsFilter = false) {
    text = util.asText(text);

    const jiebaResult = jieba.tag(text);

    // Filter by speech tags if needed
    const filteredResult = useSpeechTagsFilter
      ? jiebaResult.filter((w) => this.defaultSpeechTagFilter.includes(w.tag))
      : jiebaResult;

    // Remove special characters
    let wordList = filteredResult
      .map((w) => w.word.trim())
      .filter((word) => word.length > 0);

    if (lower) {
      wordList = wordList.map((word) => word.toLowerCase());
    }

    if (useStopWords) {
      wordList = wordList.filter((word) => !this.stopWords.has(word));
    }

    return wordList;
  }

  segment(text, lower = true, useStopWords = true, useSpeechTagsFilter = false) {

    // Ensure the input is a string
    text = util.asText(text);

    // Tokenize the text into words
    const words = new POS.Lexer().lex(text);

    // Tag the words with parts of speech
    const tagger = new POS.Tagger();
    const posResult = tagger.tag(words).map(([word, tag]) => ({ word, tag }));

    // Filter by speech tags if needed
    const filteredResult = useSpeechTagsFilter
        ? posResult.filter((w) => this.defaultSpeechTagFilter.includes(w.tag))
        : posResult;

    // Remove special characters
    let wordList = filteredResult
        .map((w) => w.word.trim())
        .filter((word) => word.length > 0);

    // Convert to lowercase if required
    if (lower) {
        wordList = wordList.map((word) => word.toLowerCase());
    }

    // Remove stop words if required
    if (useStopWords) {
        wordList = wordList.filter((word) => !this.stopWords.has(word));
    }

    return wordList;
}

  segmentSentences(sentences, lower = true, useStopWords = true, useSpeechTagsFilter = false) {
    return sentences.map((sentence) =>
      this.segment(sentence, lower, useStopWords, useSpeechTagsFilter)
    );
  }
}

// SentenceSegmentation class
class SentenceSegmentation {
  constructor(delimiters = util.sentenceDelimiters) {
    this.delimiters = new Set(delimiters.map((delim) => util.asText(delim)));
  }

  segment(text) {
    let result = [util.asText(text)];
    util.debug(result);
    util.debug(this.delimiters);

    this.delimiters.forEach((sep) => {
      const temp = [];
      result.forEach((seq) => {
        temp.push(...seq.split(sep));
      });
      result = temp;
    });

    return result.map((s) => s.trim()).filter((s) => s.length > 0);
  }
}

// Segmentation class
export class Segmentation {
  constructor(stopWordsFile = null, allowSpeechTags = util.allowSpeechTags, delimiters = util.sentenceDelimiters) {
    this.ws = new WordSegmentation(stopWordsFile, allowSpeechTags);
    this.ss = new SentenceSegmentation(delimiters);
  }

  segment(text, lower = false) {
    text = util.asText(text);

    const sentences = this.ss.segment(text);

    const wordsNoFilter = this.ws.segmentSentences(sentences, lower, false, false);
    const wordsNoStopWords = this.ws.segmentSentences(sentences, lower, true, false);
    const wordsAllFilters = this.ws.segmentSentences(sentences, lower, true, true);

    return {
      sentences,
      wordsNoFilter,
      wordsNoStopWords,
      wordsAllFilters,
    };
  }
}

