/**
 * Labelled requests for the natural-language workflow builder.
 *
 * `targets` are the operations the user asked for (the planner adds their
 * dependencies). `alt` lists other acceptable answers for ambiguous wording.
 * `reject` means the request is not about a pipeline and must not build one.
 */
export interface NLCase {
  text: string;
  targets: string[];
  alt?: string[][];
  excluded?: string[];
  reject?: boolean;
  kind: 'keyword' | 'paraphrase' | 'typo' | 'acronym' | 'compound' | 'negation' | 'junk';
}

const c = (kind: NLCase['kind'], text: string, targets: string[], extra: Partial<NLCase> = {}): NLCase => ({ kind, text, targets, ...extra });

export const NL_CASES: NLCase[] = [
  // keyword / direct
  c('keyword', 'Can you pls convert it to 1NF', ['1NF']),
  c('keyword', 'give me 3NF', ['3NF']),
  c('keyword', 'generate the SQL', ['SQL Generator']),
  c('keyword', 'load and clean the file', ['CSV Data Loader', 'Data Cleaner']),
  c('keyword', 'full report', ['Report Generator']),
  c('keyword', 'normalize to BCNF', ['BCNF']),
  c('keyword', 'find the functional dependencies', ['FD Miner']),
  c('keyword', 'discover the candidate keys', ['Key Discovery']),
  c('keyword', 'draw the ER diagram', ['ERD Generator']),
  c('keyword', 'check lossless join', ['Lossless Check']),
  c('keyword', 'verify dependency preservation', ['Dependency Preservation']),
  c('keyword', 'profile the data types', ['Data Type Profiler']),
  c('keyword', 'analyse the cardinality', ['Cardinality Analyzer']),
  c('keyword', 'detect foreign keys between the tables', ['Relation Detector']),
  c('keyword', 'classify the entities', ['NER Classifier']),
  c('keyword', 'check atomicity of the values', ['Atomicity Checker']),
  c('keyword', 'second normal form please', ['2NF']),
  c('keyword', 'generate the relation schemas', ['Relation Generator']),
  c('keyword', 'clean the data', ['Data Cleaner']),
  c('keyword', 'import my csv', ['CSV Data Loader']),

  // acronyms and forms
  c('acronym', '1nf', ['1NF']),
  c('acronym', 'make it 2 nf', ['2NF']),
  c('acronym', 'boyce-codd', ['BCNF']),
  c('acronym', 'bcnf pls', ['BCNF']),
  c('acronym', 'mine fds', ['FD Miner']),
  c('acronym', 'erd', ['ERD Generator']),
  c('acronym', 'ddl for postgres', ['SQL Generator']),
  c('acronym', 'run ner', ['NER Classifier']),
  c('acronym', 'third normal form', ['3NF']),
  c('acronym', 'first normal form', ['1NF']),

  // compound
  c('compound', 'normalize to 3NF and generate SQL', ['3NF', 'SQL Generator']),
  c('compound', 'check lossless join, then dependency preservation', ['Lossless Check', 'Dependency Preservation']),
  c('compound', 'give me the ERD and the report', ['ERD Generator', 'Report Generator']),
  c('compound', 'clean the data and profile the types', ['Data Cleaner', 'Data Type Profiler']),
  c('compound', 'find keys and fds', ['Key Discovery', 'FD Miner']),
  c('compound', 'bcnf then the sql', ['BCNF', 'SQL Generator']),
  c('compound', 'load it, clean it, and convert it to 1NF', ['1NF']),
  c('compound', 'generate postgres sql and run it', ['SQL Generator']),

  // negation
  c('negation', "normalize to BCNF but don't classify entities", ['BCNF'], { excluded: ['NER Classifier'] }),
  c('negation', 'give me 3NF without the cardinality analysis', ['3NF'], { excluded: ['Cardinality Analyzer'] }),
  c('negation', 'generate the sql, skip the ERD', ['SQL Generator'], { excluded: ['ERD Generator'] }),
  c('negation', 'give me the full report but skip the classification', ['Report Generator'], { excluded: ['NER Classifier'] }),

  // paraphrases without a keyword
  c('paraphrase', 'make every cell hold a single value', ['1NF'], { alt: [['Atomicity Checker']] }),
  c('paraphrase', 'split lists inside cells into their own rows', ['1NF'], { alt: [['Atomicity Checker']] }),
  c('paraphrase', 'which columns determine which other columns', ['FD Miner']),
  c('paraphrase', 'what uniquely identifies a row', ['Key Discovery']),
  c('paraphrase', 'show me the schema as a picture', ['ERD Generator']),
  c('paraphrase', 'produce the CREATE TABLE statements', ['SQL Generator']),
  c('paraphrase', 'write up everything you found', ['Report Generator']),
  c('paraphrase', 'is anything lost when the tables are joined back together', ['Lossless Check']),
  c('paraphrase', 'make sure the split kept all the dependencies', ['Dependency Preservation']),
  c('paraphrase', 'remove the duplicate rows and blanks', ['Data Cleaner']),
  c('paraphrase', 'what type is each column', ['Data Type Profiler']),
  c('paraphrase', 'tag columns as person, place or date', ['NER Classifier']),
  c('paraphrase', 'how are the tables linked to each other', ['Relation Detector']),
  c('paraphrase', 'is it one to many or many to many', ['Cardinality Analyzer']),
  c('paraphrase', 'remove partial dependencies on the key', ['2NF']),
  c('paraphrase', 'remove transitive dependencies', ['3NF']),
  c('paraphrase', 'open the spreadsheet export', ['CSV Data Loader']),

  // typos
  c('typo', 'convrt it to 1nf', ['1NF']),
  c('typo', 'genrate the sql', ['SQL Generator']),
  c('typo', 'normalise to thrid normal form', ['3NF']),
  c('typo', 'chek lossles join', ['Lossless Check']),
  c('typo', 'finde functonal dependancies', ['FD Miner']),
  c('typo', 'drw the er diagrm', ['ERD Generator']),
  c('typo', 'clen the dat', ['Data Cleaner']),
  c('typo', 'give me a raport', ['Report Generator']),

  // junk: must not build anything
  c('junk', 'what is the weather like today', [], { reject: true }),
  c('junk', 'tell me a joke', [], { reject: true }),
  c('junk', 'asdf qwerty', [], { reject: true }),
  c('junk', 'how do I bake bread', [], { reject: true }),
  c('junk', 'who won the world cup', [], { reject: true }),
  c('junk', 'hello', [], { reject: true }),
  c('junk', 'thanks a lot', [], { reject: true }),
  c('junk', 'book me a flight to Paris', [], { reject: true }),
  c('junk', 'translate this sentence to French', [], { reject: true }),
  c('junk', 'play some music', [], { reject: true }),
];
