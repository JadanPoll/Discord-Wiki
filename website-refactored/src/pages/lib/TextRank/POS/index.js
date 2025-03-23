// Importing modules using relative paths
import { POSTagger } from './POSTagger';
import { Lexer } from './lexer';

// Assign the POSTagger to a new variable Tagger
const Tagger = POSTagger;

// Exporting both the individual modules and a combined POS object
export const POS = { Tagger, Lexer };

// Export individual components for flexibility
export { POSTagger, Lexer };
