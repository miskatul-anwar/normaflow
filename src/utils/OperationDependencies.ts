export const OPERATION_CATEGORIES = {
    PREP: 'Data Preparation',
    ANALYZE: 'Analysis',
    NORMAL: 'Normalization',
    OUTPUT: 'Output Generation'
} as const;

export const NORMALIZATION_FORMS = {
    '1NF': {
        name: 'First Normal Form',
        description: 'Eliminates repeating groups and ensures atomicity',
        requires: ['Atomicity Checker']
    },
    '2NF': {
        name: 'Second Normal Form', 
        description: 'Eliminates partial dependencies on candidate keys',
        requires: ['1NF', 'FD Miner', 'Key Discovery']
    },
    '3NF': {
        name: 'Third Normal Form',
        description: 'Eliminates transitive dependencies',
        requires: ['2NF']
    }
} as const;

export const OPERATION_HIERARCHY = {
    // Data Preparation Foundation
    'CSV Data Loader': {
        level: 1,
        unlocks: ['Data Cleaner', 'Data Type Profiler']
    },
    'Data Cleaner': {
        level: 2,
        unlocks: ['Atomicity Checker', 'Data Type Profiler']
    },
    'Atomicity Checker': {
        level: 3,
        unlocks: ['1NF']
    },
    'Data Type Profiler': {
        level: 3,
        unlocks: ['FD Miner']
    },
    
    // Normalization Core
    '1NF': {
        level: 4,
        unlocks: ['FD Miner', 'Cardinality Analyzer']
    },
    'FD Miner': {
        level: 5,
        unlocks: ['Key Discovery', '2NF']
    },
    'Key Discovery': {
        level: 6,
        unlocks: ['2NF']
    },
    'Cardinality Analyzer': {
        level: 5,
        unlocks: ['ERD Generator']
    },
    
    // Advanced Normalization
    '2NF': {
        level: 7,
        unlocks: ['3NF', 'Lossless Check', 'Dependency Preservation', 'Relation Generator', 'Report Generator']
    },
    '3NF': {
        level: 8,
        unlocks: ['ERD Generator', 'SQL Generator']
    },
    'Lossless Check': {
        level: 8,
        unlocks: []
    },
    'Dependency Preservation': {
        level: 8,
        unlocks: []
    },
    
    // Output Generation
    'ERD Generator': {
        level: 9,
        unlocks: []
    },
    'Relation Generator': {
        level: 8,
        unlocks: []
    },
    'SQL Generator': {
        level: 9,
        unlocks: []
    },
    'Report Generator': {
        level: 8,
        unlocks: []
    }
} as const;

export const BLOCKED_OPERATION_MESSAGES = {
    'ERD Generator': {
        title: 'ERD Generation Blocked',
        message: 'Entity Relationship Diagrams require complete 3NF normalization to ensure accurate entity and relationship modeling.',
        requiredSteps: ['Complete 1NF → 2NF → 3NF normalization sequence', 'Run Cardinality Analyzer for relationship detection'],
        rationale: '3NF provides the cleanest entity separation and eliminates redundancy for proper ERD generation.'
    },
    'SQL Generator': {
        title: 'SQL DDL Generation Blocked', 
        message: 'SQL Data Definition Language generation requires a complete 3NF schema with identified keys for production-ready database creation.',
        requiredSteps: ['Complete full normalization (1NF → 2NF → 3NF)', 'Run Key Discovery for primary/foreign key identification'],
        rationale: 'Production SQL requires properly normalized schema with complete constraint definitions.'
    },
    'Relation Generator': {
        title: 'Relation Generation Blocked',
        message: 'Relation generation requires at least 2NF normalization to produce meaningful decomposed tables.',
        requiredSteps: ['Complete normalization through 2NF minimum', 'Consider 3NF for optimal results'],
        rationale: '2NF eliminates partial dependencies and provides the foundation for proper relation decomposition.'
    },
    'FD Miner': {
        title: 'Functional Dependency Analysis Blocked',
        message: 'FD analysis requires 1NF data to ensure accurate dependency detection on atomic attributes.',
        requiredSteps: ['Complete 1NF normalization', 'Ensure data type profiling is completed'],
        rationale: 'Non-atomic data can produce false functional dependencies leading to incorrect normalization.'
    },
    '2NF': {
        title: '2NF Normalization Blocked',
        message: 'Second Normal Form requires 1NF completion and functional dependency analysis.',
        requiredSteps: ['Complete 1NF normalization', 'Run FD Miner to identify dependencies', 'Run Key Discovery to identify candidate keys'],
        rationale: '2NF specifically addresses partial dependencies on candidate keys, requiring both FD and key knowledge.'
    },
    '3NF': {
        title: '3NF Normalization Blocked',
        message: 'Third Normal Form requires successful 2NF completion to address transitive dependencies.',
        requiredSteps: ['Complete 2NF normalization first'],
        rationale: '3NF builds upon 2NF by eliminating transitive dependencies between non-key attributes.'
    }
} as const;

export function getOperationLevel(operation: string): number {
    return OPERATION_HIERARCHY[operation as keyof typeof OPERATION_HIERARCHY]?.level || 0;
}

export function getUnlockedOperations(completedOperations: string[]): string[] {
    const unlocked = new Set<string>();
    
    completedOperations.forEach(op => {
        const hierarchy = OPERATION_HIERARCHY[op as keyof typeof OPERATION_HIERARCHY];
        if (hierarchy) {
            hierarchy.unlocks.forEach(unlockedOp => unlocked.add(unlockedOp));
        }
    });
    
    return Array.from(unlocked);
}