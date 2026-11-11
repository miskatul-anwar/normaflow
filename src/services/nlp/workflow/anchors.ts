/**
 * Anchor data for natural-language matching, keyed by operation name.
 *
 *  - `aliases`: regexes for exact/keyword matching (acronyms, stems, typos);
 *  - `phrases`: example sentences, embedded once and compared with the user's
 *    request when no alias matches.
 *
 * `OPERATIONS` stays the only source of truth for what operations exist; a test
 * fails when an operation has no anchors or an anchor has no operation.
 */
export interface Anchor {
  aliases: RegExp[];
  phrases: string[];
}

export const ANCHORS: Record<string, Anchor> = {
  'CSV Data Loader': {
    aliases: [/\b(load|loader|import|ingest|read|open|upload)\b/i, /\bcsv\b/i],
    phrases: ['load the CSV file', 'import my data file', 'read the uploaded table', 'open the spreadsheet export', 'start by loading the data'],
  },
  'Data Cleaner': {
    aliases: [/\bclean(s|ed|er|ing|se|sing|up)?\b/i, /\bdedup(e|licate)?\b/i, /\bsanit[iy]/i, /\bremove (the )?(nulls?|blanks?|duplicates?)\b/i],
    phrases: ['clean the data', 'remove duplicate rows and blanks', 'tidy up the table', 'fix messy values', 'strip nulls and bad formatting'],
  },
  'Atomicity Checker': {
    aliases: [/\batomic\w*/i, /\bmulti[- ]?valued\b/i, /\bsingle[- ]valued?\b/i, /\bscalar\b/i],
    phrases: ['check that every cell holds one value', 'find columns with several values in one cell', 'validate atomic values', 'detect comma separated lists inside cells', 'make sure values are not lists'],
  },
  'Data Type Profiler': {
    aliases: [/\bprofil\w*/i, /\b(data|column) ?types?\b/i, /\binfer (the )?types?\b/i],
    phrases: ['profile the data types', 'detect the type of each column', 'infer column datatypes', 'what type is each field', 'analyse column formats'],
  },
  'NER Classifier': {
    aliases: [/\bner\b/i, /\bclassif\w*/i, /\bentity (type|types|recognition|recognizer|recogniser)\b/i, /\bsemantic (type|types|tag|tags)\b/i, /\bclassify entities\b/i],
    phrases: ['classify the entities in the columns', 'tag columns as person, place or date', 'find out what each column means', 'semantic classification of columns', 'recognise named entities'],
  },
  '1NF': {
    aliases: [/\b1 ?nf\b/i, /\bfirst normal form\b/i, /\bnormal form (1|one)\b/i, /\bnf ?1\b/i],
    phrases: ['convert it to 1NF', 'make the table first normal form', 'split multi-valued columns into atomic values', 'bring the data to first normal form', 'move repeating groups into a child table'],
  },
  'FD Miner': {
    aliases: [/\bfds?\b/i, /\bfunctional dependenc\w*/i, /\bmine (the )?dependenc\w*/i, /\bdependenc(y|ies) (mining|discovery)\b/i],
    phrases: ['find functional dependencies', 'mine the dependencies between columns', 'which columns determine other columns', 'discover FDs', 'detect determinants'],
  },
  'Key Discovery': {
    aliases: [/\b(candidate|primary|composite|super)[- ]?keys?\b/i, /\bkey (discovery|finder|detection)\b/i, /\bfind (the )?keys?\b/i, /\bkeys\b/i],
    phrases: ['find the candidate keys', 'discover the primary key', 'which column identifies each row', 'detect unique identifiers', 'work out the keys of the table'],
  },
  'Relation Detector': {
    aliases: [/\brelation detect\w*/i, /\bforeign[- ]?keys?\b/i, /\bfks?\b/i, /\bdetect (the )?relationships?\b/i, /\blink (the )?tables\b/i, /\bjoin (the )?tables\b/i],
    phrases: ['detect relationships between tables', 'find foreign keys across files', 'which tables are linked', 'connect the tables together', 'discover cross-table references'],
  },
  'Cardinality Analyzer': {
    aliases: [/\bcardinalit\w*/i, /\bone[- ]to[- ](one|many)\b/i, /\bmany[- ]to[- ]many\b/i, /\b1:n\b/i, /\bm:n\b/i],
    phrases: ['analyse the cardinality of relationships', 'is it one to many or many to many', 'work out relationship multiplicities', 'check how rows relate', 'count how many rows match'],
  },
  '2NF': {
    aliases: [/\b2 ?nf\b/i, /\bsecond normal form\b/i, /\bnormal form (2|two)\b/i, /\bpartial dependenc\w*/i],
    phrases: ['convert it to 2NF', 'bring the table to second normal form', 'remove partial dependencies', 'eliminate partial key dependencies', 'make it second normal form'],
  },
  '3NF': {
    aliases: [/\b3 ?nf\b/i, /\bthird normal form\b/i, /\bnormal form (3|three)\b/i, /\btransitive dependenc\w*/i],
    phrases: ['give me 3NF', 'convert the table to third normal form', 'remove transitive dependencies', 'normalize to 3NF', 'decompose into third normal form'],
  },
  BCNF: {
    aliases: [/\bbcnf\b/i, /\bboyce[- ]?codd\b/i],
    phrases: ['normalize to BCNF', 'convert it to Boyce-Codd normal form', 'make every determinant a key', 'decompose into BCNF', 'strongest normal form'],
  },
  'Lossless Check': {
    aliases: [/\bloss[- ]?less\b/i, /\blossy\b/i, /\bno (data )?loss\b/i, /\bjoin back\b/i],
    phrases: ['check the decomposition is lossless', 'verify nothing is lost when joining back', 'is the join lossless', 'make sure the split does not lose data', 'test lossless join property'],
  },
  'Dependency Preservation': {
    aliases: [/\bpreserv\w*/i, /\bdependency preservation\b/i],
    phrases: ['check dependency preservation', 'are all the dependencies preserved', 'verify no functional dependency is lost', 'test whether FDs survive the split', 'confirm dependencies are kept'],
  },
  'ERD Generator': {
    aliases: [/\berds?\b/i, /\ber[- ]?diagram\w*/i, /\bentity[- ]relationship\b/i, /\bdiagram\b/i, /\bmermaid\b/i],
    phrases: ['draw the ER diagram', 'generate an entity relationship diagram', 'show me the schema as a diagram', 'create the ERD', 'visualise the tables and links'],
  },
  'Relation Generator': {
    aliases: [/\brelation (generator|schemas?)\b/i, /\bgenerate (the )?relations?\b/i, /\brelational schemas?\b/i],
    phrases: ['generate the relation schemas', 'write out the relations', 'list the resulting tables and attributes', 'produce the relational schema', 'show the final relations'],
  },
  'SQL Generator': {
    aliases: [/\bsql\b/i, /\bddl\b/i, /\bcreate tables?\b/i, /\bpostgres(ql)?\b/i, /\bmysql\b/i, /\bsqlite\b/i],
    phrases: ['generate the SQL', 'write CREATE TABLE statements', 'give me the DDL script', 'produce database creation code', 'export SQL for the schema'],
  },
  'Report Generator': {
    aliases: [/\breports?\b/i, /\bsummary\b/i, /\bsummari[sz]e\b/i, /\bdocumentation\b/i],
    phrases: ['full report', 'write a summary report of the analysis', 'generate the normalization report', 'document everything that was found', 'give me a complete write-up'],
  },
};

/** Weaker, generic wording used only when a clause has no specific alias hit. */
export const WEAK_ALIASES: Array<{ operation: string; pattern: RegExp }> = [
  { operation: '3NF', pattern: /\bnormali[sz]\w*|\bdenormali[sz]\w*|\bnormal form\b/i },
];

export const NEGATION = /\b(don'?t|do not|dont|without|skip|exclude|except|excluding|no need( to| for)?|never|not)\b/i;
export const RUN_WORDS = /\b(run|execute|go ahead|start it|and run|then run)\b/i;
/** Negation after the operation: "sql is not needed", "skip nothing but erd is unnecessary". */
export const TRAILING_NEGATION = /\b(is(n'?t| not)|are(n'?t| not)|not) (needed|required|necessary|wanted)\b|\bunnecessary\b|\bno thanks\b/;
