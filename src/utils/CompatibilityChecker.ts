export interface ValidationRule {
    rule: string;
    validator: (context: ProcessingContext) => ValidationResult;
    errorMessage: string;
    severity: 'error' | 'warning';
    recommendation?: string;
}

export interface OperationDependency {
    operation: string;
    requiredOperations: string[];
    requiredNormalForm?: '1NF' | '2NF' | '3NF';
    dataQualityThreshold?: number;
    validationRules: ValidationRule[];
    category: 'PREP' | 'ANALYZE' | 'NORMAL' | 'OUTPUT';
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
    missingOperations: string[];
    currentNormalForm?: string;
    requiredNormalForm?: string;
}

export interface ProcessingContext {
    completedOperations: string[];
    currentNormalForm: string | null;
    dataQuality: {
        atomicity: number;
        completeness: number;
        consistency: number;
    };
    hasData: boolean;
    hasFunctionalDependencies: boolean;
    hasCandidateKeys: boolean;
    hasRelationships: boolean;
    fileUploaded: boolean;
    uploadedFile: File | null;
    has1NF?: boolean;
    has2NF?: boolean;
    has3NF?: boolean;
    hasAtomicityCheck?: boolean;
    hasDataCleaning?: boolean;
    hasDataProfiling?: boolean;
}

export class CompatibilityChecker {
    private dependencies: Map<string, OperationDependency> = new Map();
    
    constructor() {
        this.initializeDependencies();
    }

    public getAllDependencies(): Map<string, OperationDependency> {
        return new Map(this.dependencies);
    }

    private initializeDependencies(): void {
        const dependencies: OperationDependency[] = [
            // DATA PREPARATION PHASE
            {
                operation: 'CSV Data Loader',
                requiredOperations: [],
                category: 'PREP',
                validationRules: [
                    {
                        rule: 'file_uploaded',
                        validator: (ctx) => ({
                            isValid: ctx.fileUploaded,
                            errors: ctx.fileUploaded ? [] : ['No CSV file uploaded'],
                            warnings: [],
                            recommendations: ctx.fileUploaded ? [] : ['Upload a CSV file to begin normalization'],
                            missingOperations: []
                        }),
                        errorMessage: 'A CSV file must be uploaded before loading data',
                        severity: 'error',
                        recommendation: 'Please upload a CSV file using the file upload button'
                    }
                ]
            },
            {
                operation: 'Data Cleaner',
                requiredOperations: ['CSV Data Loader'],
                category: 'PREP',
                validationRules: [
                    {
                        rule: 'data_loaded',
                        validator: (ctx) => ({
                            isValid: ctx.hasData || ctx.completedOperations.includes('CSV Data Loader'),
                            errors: (ctx.hasData || ctx.completedOperations.includes('CSV Data Loader')) ? [] : ['CSV Data Loader must be executed first'],
                            warnings: [],
                            recommendations: (ctx.hasData || ctx.completedOperations.includes('CSV Data Loader')) ? [] : ['Run CSV Data Loader before cleaning data'],
                            missingOperations: (ctx.hasData || ctx.completedOperations.includes('CSV Data Loader')) ? [] : ['CSV Data Loader']
                        }),
                        errorMessage: 'Data must be loaded before cleaning',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: 'Atomicity Checker',
                requiredOperations: ['CSV Data Loader'],
                category: 'PREP',
                validationRules: [
                    {
                        rule: 'data_available',
                        validator: (ctx) => {
                            const hasRequired = ctx.hasData || ctx.completedOperations.includes('CSV Data Loader');
                            return {
                                isValid: hasRequired,
                                errors: hasRequired ? [] : ['Data loading is required before atomicity checking'],
                                warnings: [],
                                recommendations: hasRequired ? [] : ['Load data with CSV Data Loader first'],
                                missingOperations: hasRequired ? [] : ['CSV Data Loader']
                            };
                        },
                        errorMessage: 'Data is required for atomicity analysis',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: 'Data Type Profiler',
                requiredOperations: ['CSV Data Loader'],
                category: 'PREP',
                validationRules: [
                    {
                        rule: 'data_available',
                        validator: (ctx) => {
                            const hasRequired = ctx.hasData || ctx.completedOperations.includes('CSV Data Loader');
                            return {
                                isValid: hasRequired,
                                errors: hasRequired ? [] : ['Data profiling requires loaded data'],
                                warnings: [],
                                recommendations: hasRequired ? [] : ['Load data before profiling'],
                                missingOperations: hasRequired ? [] : ['CSV Data Loader']
                            };
                        },
                        errorMessage: 'Data type profiling requires loaded data',
                        severity: 'error'
                    }
                ]
            },

            // NORMALIZATION PHASE
            {
                operation: '1NF',
                requiredOperations: ['CSV Data Loader'],
                category: 'NORMAL',
                validationRules: [
                    {
                        rule: 'data_available_for_normalization',
                        validator: (ctx) => {
                            const hasData = ctx.hasData || ctx.completedOperations.includes('CSV Data Loader');
                            return {
                                isValid: hasData,
                                errors: hasData ? [] : ['Data must be loaded before 1NF normalization'],
                                warnings: [],
                                recommendations: hasData ? [] : ['Load data with CSV Data Loader before normalizing to 1NF'],
                                missingOperations: hasData ? [] : ['CSV Data Loader']
                            };
                        },
                        errorMessage: '1NF requires loaded data',
                        severity: 'error'
                    }
                ]
            },

            // ANALYSIS PHASE - CRITICAL FIX: FD Miner now requires 1NF
            {
                operation: 'FD Miner',
                requiredOperations: ['1NF'], // FIXED: Now requires 1NF
                category: 'ANALYZE',
                validationRules: [
                    {
                        rule: 'first_normal_form_required',
                        validator: (ctx) => {
                            const has1NF = ctx.has1NF || ctx.completedOperations.includes('1NF') || 
                                          ctx.currentNormalForm === '1NF' || 
                                          ctx.currentNormalForm === '2NF' || 
                                          ctx.currentNormalForm === '3NF';
                            return {
                                isValid: has1NF,
                                errors: has1NF ? [] : ['FD Miner requires 1NF completion for accurate dependency detection on atomic attributes'],
                                warnings: [],
                                recommendations: has1NF ? [] : ['Complete 1NF normalization before mining functional dependencies'],
                                missingOperations: has1NF ? [] : ['1NF']
                            };
                        },
                        errorMessage: 'FD analysis requires 1NF completion for atomic attribute analysis',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: 'Key Discovery',
                requiredOperations: ['FD Miner'],
                category: 'ANALYZE',
                validationRules: [
                    {
                        rule: 'functional_dependencies_required',
                        validator: (ctx) => {
                            const hasFDs = ctx.hasFunctionalDependencies || ctx.completedOperations.includes('FD Miner');
                            return {
                                isValid: hasFDs,
                                errors: hasFDs ? [] : ['Key discovery requires functional dependency analysis'],
                                warnings: [],
                                recommendations: hasFDs ? [] : ['Run FD Miner first for accurate key discovery'],
                                missingOperations: hasFDs ? [] : ['FD Miner']
                            };
                        },
                        errorMessage: 'Key discovery requires functional dependency analysis',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: 'Cardinality Analyzer',
                requiredOperations: ['CSV Data Loader'],
                category: 'ANALYZE',
                validationRules: [
                    {
                        rule: 'data_available',
                        validator: (ctx) => {
                            const hasData = ctx.hasData || ctx.completedOperations.includes('CSV Data Loader');
                            return {
                                isValid: hasData,
                                errors: hasData ? [] : ['Cardinality analysis requires loaded data'],
                                warnings: [],
                                recommendations: hasData ? [] : ['Load data before analyzing cardinalities'],
                                missingOperations: hasData ? [] : ['CSV Data Loader']
                            };
                        },
                        errorMessage: 'Cardinality analysis requires loaded data',
                        severity: 'error'
                    }
                ]
            },

            // ADVANCED NORMALIZATION
            {
                operation: '2NF',
                requiredOperations: ['1NF', 'FD Miner', 'Key Discovery'],
                category: 'NORMAL',
                validationRules: [
                    {
                        rule: 'prerequisites_for_2nf',
                        validator: (ctx) => {
                            const has1NF = ctx.has1NF || ctx.completedOperations.includes('1NF') || 
                                          ctx.currentNormalForm === '1NF' || 
                                          ctx.currentNormalForm === '2NF' || 
                                          ctx.currentNormalForm === '3NF';
                            const hasFDs = ctx.hasFunctionalDependencies || ctx.completedOperations.includes('FD Miner');
                            const hasKeys = ctx.hasCandidateKeys || ctx.completedOperations.includes('Key Discovery');
                            
                            const errors = [];
                            const missing = [];
                            
                            if (!has1NF) {
                                errors.push('1NF completion required');
                                missing.push('1NF');
                            }
                            if (!hasFDs) {
                                errors.push('Functional dependency analysis required');
                                missing.push('FD Miner');
                            }
                            if (!hasKeys) {
                                errors.push('Key discovery required');
                                missing.push('Key Discovery');
                            }
                            
                            return {
                                isValid: has1NF && hasFDs && hasKeys,
                                errors,
                                warnings: [],
                                recommendations: missing.length > 0 ? [`Complete required operations: ${missing.join(', ')}`] : [],
                                missingOperations: missing,
                                currentNormalForm: ctx.currentNormalForm ?? undefined,
                                requiredNormalForm: '1NF'
                            };
                        },
                        errorMessage: '2NF requires 1NF, FD analysis, and key discovery',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: '3NF',
                requiredOperations: ['2NF'],
                category: 'NORMAL',
                validationRules: [
                    {
                        rule: 'second_normal_form_completed',
                        validator: (ctx) => {
                            const has2NF = ctx.has2NF || ctx.completedOperations.includes('2NF') || 
                                          ctx.currentNormalForm === '2NF' || 
                                          ctx.currentNormalForm === '3NF';
                            
                            return {
                                isValid: has2NF,
                                errors: has2NF ? [] : ['3NF requires 2NF completion first'],
                                warnings: [],
                                recommendations: has2NF ? [] : ['Complete 2NF normalization before proceeding to 3NF'],
                                missingOperations: has2NF ? [] : ['2NF'],
                                currentNormalForm: ctx.currentNormalForm ?? undefined,
                                requiredNormalForm: '2NF'
                            };
                        },
                        errorMessage: '3NF requires successful 2NF completion',
                        severity: 'error'
                    }
                ]
            },

            // QUALITY CHECKS
            {
                operation: 'Lossless Check',
                requiredOperations: ['2NF'],
                category: 'NORMAL',
                validationRules: [
                    {
                        rule: 'decomposition_available',
                        validator: (ctx) => {
                            const has2NF = ctx.has2NF || ctx.completedOperations.includes('2NF') || 
                                          ctx.currentNormalForm === '2NF' || ctx.currentNormalForm === '3NF';
                            return {
                                isValid: has2NF,
                                errors: has2NF ? [] : ['Lossless check requires relation decomposition (2NF minimum)'],
                                warnings: [],
                                recommendations: has2NF ? [] : ['Complete 2NF to generate decomposed relations for lossless checking'],
                                missingOperations: has2NF ? [] : ['2NF']
                            };
                        },
                        errorMessage: 'Lossless checking requires decomposed relations',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: 'Dependency Preservation',
                requiredOperations: ['2NF', 'FD Miner'],
                category: 'NORMAL',
                validationRules: [
                    {
                        rule: 'decomposition_and_fds_available',
                        validator: (ctx) => {
                            const has2NF = ctx.has2NF || ctx.completedOperations.includes('2NF') || 
                                          ctx.currentNormalForm === '2NF' || ctx.currentNormalForm === '3NF';
                            const hasFDs = ctx.hasFunctionalDependencies || ctx.completedOperations.includes('FD Miner');
                            
                            const errors = [];
                            const missing = [];
                            
                            if (!has2NF) {
                                errors.push('Relation decomposition required (2NF minimum)');
                                missing.push('2NF');
                            }
                            if (!hasFDs) {
                                errors.push('Functional dependencies required');
                                missing.push('FD Miner');
                            }
                            
                            return {
                                isValid: has2NF && hasFDs,
                                errors,
                                warnings: [],
                                recommendations: missing.length > 0 ? [`Complete: ${missing.join(', ')}`] : [],
                                missingOperations: missing
                            };
                        },
                        errorMessage: 'Dependency preservation requires decomposition and FDs',
                        severity: 'error'
                    }
                ]
            },

            // OUTPUT GENERATION PHASE
            {
                operation: 'ERD Generator',
                requiredOperations: ['3NF', 'Key Discovery'],
                category: 'OUTPUT',
                validationRules: [
                    {
                        rule: 'complete_schema_for_erd',
                        validator: (ctx) => {
                            const has3NF = ctx.has3NF || ctx.completedOperations.includes('3NF') || ctx.currentNormalForm === '3NF';
                            const hasKeys = ctx.hasCandidateKeys || ctx.completedOperations.includes('Key Discovery');
                            
                            const errors = [];
                            const missing = [];
                            
                            if (!has3NF) {
                                errors.push('3NF normalization required for accurate ERD');
                                missing.push('3NF');
                            }
                            if (!hasKeys) {
                                errors.push('Key discovery required for relationship modeling');
                                missing.push('Key Discovery');
                            }
                            
                            return {
                                isValid: has3NF && hasKeys,
                                errors,
                                warnings: [],
                                recommendations: missing.length > 0 ? [`Complete: ${missing.join(', ')}`] : [],
                                missingOperations: missing
                            };
                        },
                        errorMessage: 'ERD generation requires complete 3NF schema with keys',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: 'Relation Generator',
                requiredOperations: ['2NF'],
                category: 'OUTPUT',
                validationRules: [
                    {
                        rule: 'minimum_normalization',
                        validator: (ctx) => {
                            const has2NF = ctx.has2NF || ctx.completedOperations.includes('2NF') || 
                                          ctx.currentNormalForm === '2NF' || ctx.currentNormalForm === '3NF';
                            return {
                                isValid: has2NF,
                                errors: has2NF ? [] : ['Relation generation requires at least 2NF normalization'],
                                warnings: ctx.currentNormalForm === '2NF' ? ['Consider 3NF for optimal relation design'] : [],
                                recommendations: has2NF ? 
                                    (ctx.currentNormalForm === '2NF' ? ['Complete 3NF for best results'] : []) : 
                                    ['Complete 2NF normalization before generating relations'],
                                missingOperations: has2NF ? [] : ['2NF']
                            };
                        },
                        errorMessage: 'Relation generation requires decomposed schema',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: 'SQL Generator',
                requiredOperations: ['3NF', 'Key Discovery'],
                category: 'OUTPUT',
                validationRules: [
                    {
                        rule: 'complete_schema_for_sql',
                        validator: (ctx) => {
                            const has3NF = ctx.has3NF || ctx.completedOperations.includes('3NF') || ctx.currentNormalForm === '3NF';
                            const hasKeys = ctx.hasCandidateKeys || ctx.completedOperations.includes('Key Discovery');
                            
                            const errors = [];
                            const missing = [];
                            
                            if (!has3NF) {
                                errors.push('SQL DDL generation requires 3NF schema');
                                missing.push('3NF');
                            }
                            if (!hasKeys) {
                                errors.push('Key discovery required for SQL constraints');
                                missing.push('Key Discovery');
                            }
                            
                            return {
                                isValid: has3NF && hasKeys,
                                errors,
                                warnings: [],
                                recommendations: missing.length > 0 ? [`Complete: ${missing.join(', ')}`] : [],
                                missingOperations: missing
                            };
                        },
                        errorMessage: 'SQL DDL generation requires complete schema',
                        severity: 'error'
                    }
                ]
            },
            {
                operation: 'Report Generator',
                requiredOperations: ['CSV Data Loader'],
                category: 'OUTPUT',
                validationRules: [
                    {
                        rule: 'basic_data_for_reporting',
                        validator: (ctx) => {
                            const hasData = ctx.hasData || ctx.completedOperations.includes('CSV Data Loader');
                            return {
                                isValid: hasData,
                                errors: hasData ? [] : ['Reporting requires at least basic data loading'],
                                warnings: [],
                                recommendations: hasData ? [] : ['Load data before generating reports'],
                                missingOperations: hasData ? [] : ['CSV Data Loader']
                            };
                        },
                        errorMessage: 'Reports require basic data processing',
                        severity: 'error'
                    }
                ]
            }
        ];

        dependencies.forEach(dep => {
            this.dependencies.set(dep.operation, dep);
        });
    }

    public validateOperation(operation: string, context: ProcessingContext): ValidationResult {
        const dependency = this.dependencies.get(operation);
        
        if (!dependency) {
            return {
                isValid: false,
                errors: [`Unknown operation: ${operation}`],
                warnings: [],
                recommendations: ['Please select a valid operation'],
                missingOperations: []
            };
        }

        const validationResults = dependency.validationRules.map(rule => 
            rule.validator(context)
        );

        const allErrors = validationResults.flatMap(result => result.errors);
        const allWarnings = validationResults.flatMap(result => result.warnings);
        const allRecommendations = validationResults.flatMap(result => result.recommendations);
        const allMissingOps = validationResults.flatMap(result => result.missingOperations);

        const isValid = allErrors.length === 0;

        return {
            isValid,
            errors: allErrors,
            warnings: allWarnings,
            recommendations: allRecommendations,
            missingOperations: [...new Set(allMissingOps)],
            currentNormalForm: context.currentNormalForm ?? undefined,
            requiredNormalForm: dependency.requiredNormalForm
        };
    }

    public getOperationDependencies(operation: string): string[] {
        const dependency = this.dependencies.get(operation);
        return dependency ? dependency.requiredOperations : [];
    }

    public getNextRecommendedOperations(context: ProcessingContext): string[] {
        const availableOps = Array.from(this.dependencies.keys());
        const validOps = availableOps.filter(op => {
            const validation = this.validateOperation(op, context);
            return validation.isValid;
        });

        const phaseOrder = ['PREP', 'NORMAL', 'ANALYZE', 'OUTPUT'];
        return validOps.sort((a, b) => {
            const depA = this.dependencies.get(a)!;
            const depB = this.dependencies.get(b)!;
            return phaseOrder.indexOf(depA.category) - phaseOrder.indexOf(depB.category);
        });
    }

    public validateOperationSequence(operations: string[]): ValidationResult {
        const context: ProcessingContext = {
            completedOperations: [],
            currentNormalForm: null,
            dataQuality: { atomicity: 0, completeness: 0, consistency: 0 },
            hasData: false,
            hasFunctionalDependencies: false,
            hasCandidateKeys: false,
            hasRelationships: false,
            fileUploaded: true,
            uploadedFile: null,
            has1NF: false,
            has2NF: false,
            has3NF: false,
            hasAtomicityCheck: false,
            hasDataCleaning: false,
            hasDataProfiling: false
        };

        const errors: string[] = [];
        const warnings: string[] = [];
        const recommendations: string[] = [];

        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            const validation = this.validateOperation(operation, context);

            if (!validation.isValid) {
                errors.push(`Operation ${i + 1} (${operation}): ${validation.errors.join(', ')}`);
                recommendations.push(...validation.recommendations);
                break;
            }

            // Update context after successful validation
            context.completedOperations.push(operation);
            
            if (operation === '1NF') {
                context.currentNormalForm = '1NF';
                context.has1NF = true;
            } else if (operation === '2NF') {
                context.currentNormalForm = '2NF';
                context.has2NF = true;
            } else if (operation === '3NF') {
                context.currentNormalForm = '3NF';
                context.has3NF = true;
            }
            
            if (operation === 'CSV Data Loader') context.hasData = true;
            if (operation === 'FD Miner') context.hasFunctionalDependencies = true;
            if (operation === 'Key Discovery') context.hasCandidateKeys = true;
            if (operation === 'Cardinality Analyzer') context.hasRelationships = true;
            if (operation === 'Atomicity Checker') context.hasAtomicityCheck = true;
            if (operation === 'Data Cleaner') context.hasDataCleaning = true;
            if (operation === 'Data Type Profiler') context.hasDataProfiling = true;

            warnings.push(...validation.warnings);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            recommendations: [...new Set(recommendations)],
            missingOperations: []
        };
    }
}

export const compatibilityChecker = new CompatibilityChecker();