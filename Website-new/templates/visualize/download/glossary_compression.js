// Required Imports
import { TextBlob } from 'textblob';
import KneeLocator from 'knee-locator';
import { TextRank4Keyword } from 'textrank4keyword';
import glossal_compression from './glossal_compression';
import GroupTheoryAPINonGUI2 from './GroupTheoryAPINonGUI2';


// Efficient Overlap and Merge Function
function efficientOverlapAndMerge(arr1, arr2, threshold = 0.9) {
    const len1 = arr1.length;
    const len2 = arr2.length;

    const shadowArr1Set = new Set(arr1);
    let overlap = 0;

    arr2.forEach(x => {
        if (shadowArr1Set.has(x)) {
            overlap++;
            shadowArr1Set.delete(x);
        }
    });

    if (overlap >= threshold * len1 || overlap >= threshold * len2) {
        return [...new Set([...arr2, ...shadowArr1Set])].sort();
    }

    return null;
}

// Compress Glossary Entries Function
function compressGlossaryEntries(keyword, entries, threshold = 0.9) {
    const n = entries.length;
    const mergedFlags = new Array(n).fill(false);

    for (let i = 0; i < n; i++) {
        if (mergedFlags[i]) {
            continue;
        }

        for (let j = i + 1; j < n; j++) {
            if (mergedFlags[j]) {
                continue;
            }

            const mergedResult = efficientOverlapAndMerge(entries[i], entries[j], threshold);
            if (mergedResult) {
                entries[i] = mergedResult;
                mergedFlags[j] = true;
            }
        }
    }

    return entries.filter((_, i) => !mergedFlags[i]);
}