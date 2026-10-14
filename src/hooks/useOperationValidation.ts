import { useState, useCallback, useMemo, useEffect } from 'react';
import { compatibilityChecker, ValidationResult, ProcessingContext } from '../utils/CompatibilityChecker';

interface UseOperationValidationProps {
    completedOperations: string[];
    currentNormalForm: string | null;
    uploadedFile: File | null;
    processedResults: any;
    nodes: any[];
}

interface ValidationState {
    validationResults: Map<string, ValidationResult>;
    blockedOperations: Set<string>;
    availableOperations: string[];
    nextRecommended: string[];
    lastValidation: number;
}

export function useOperationValidation({
    completedOperations,
    currentNormalForm,
    uploadedFile,
    processedResults,
    nodes
}: UseOperationValidationProps) {
    
    const [validationState, setValidationState] = useState<ValidationState>({
        validationResults: new Map(),
        blockedOperations: new Set(),
        availableOperations: [],
        nextRecommended: [],
        lastValidation: 0
    });

    const processingContext = useMemo((): ProcessingContext => {
        // Get operations from nodes (what's in the workflow)
        const nodeOperations = nodes.slice(1).map(node => node.data.label);
        
        // Combine actual completed operations with workflow operations
        const allAvailableOperations = [...new Set([...completedOperations, ...nodeOperations])];
        
        return {
            completedOperations: allAvailableOperations,
            currentNormalForm,
            dataQuality: {
                atomicity: processedResults?.dataQuality?.atomicity || 0,
                completeness: processedResults?.dataQuality?.completeness || 0,
                consistency: processedResults?.dataQuality?.consistency || 0
            },
            hasData: allAvailableOperations.includes('CSV Data Loader') || !!uploadedFile,
            hasFunctionalDependencies: allAvailableOperations.includes('FD Miner'),
            hasCandidateKeys: allAvailableOperations.includes('Key Discovery'),
            hasRelationships: allAvailableOperations.includes('Cardinality Analyzer'),
            fileUploaded: uploadedFile !== null,
            uploadedFile,
            // Add the required context flags
            has1NF: allAvailableOperations.includes('1NF') || currentNormalForm === '1NF' || currentNormalForm === '2NF' || currentNormalForm === '3NF',
            has2NF: allAvailableOperations.includes('2NF') || currentNormalForm === '2NF' || currentNormalForm === '3NF',
            has3NF: allAvailableOperations.includes('3NF') || currentNormalForm === '3NF',
            hasAtomicityCheck: allAvailableOperations.includes('Atomicity Checker'),
            hasDataCleaning: allAvailableOperations.includes('Data Cleaner'),
            hasDataProfiling: allAvailableOperations.includes('Data Type Profiler')
        };
    }, [nodes, completedOperations, currentNormalForm, uploadedFile, processedResults]);

    // Use the compatibility checker for validation
    const validateAllOperations = useCallback(() => {
        try {
            const allOperations = [
                'CSV Data Loader', 'Data Cleaner', 'Atomicity Checker', 'Data Type Profiler',
                'FD Miner', 'Key Discovery', 'Cardinality Analyzer',
                '1NF', '2NF', '3NF', 'Lossless Check', 'Dependency Preservation',
                'ERD Generator', 'Relation Generator', 'SQL Generator', 'Report Generator'
            ];
            
            const results = new Map<string, ValidationResult>();
            const blocked = new Set<string>();
            const available: string[] = [];

            allOperations.forEach(operation => {
                const validation = compatibilityChecker.validateOperation(operation, processingContext);
                results.set(operation, validation);
                
                if (!validation.isValid) {
                    blocked.add(operation);
                } else {
                    available.push(operation);
                }
            });

            const recommended = compatibilityChecker.getNextRecommendedOperations(processingContext);

            setValidationState({
                validationResults: results,
                blockedOperations: blocked,
                availableOperations: available,
                nextRecommended: recommended,
                lastValidation: Date.now()
            });
        } catch (error) {
            console.error('Validation error:', error);
            setValidationState({
                validationResults: new Map(),
                blockedOperations: new Set(),
                availableOperations: [],
                nextRecommended: [],
                lastValidation: Date.now()
            });
        }
    }, [processingContext]);

    const validateOperation = useCallback((operation: string): ValidationResult => {
        try {
            return compatibilityChecker.validateOperation(operation, processingContext);
        } catch (error) {
            console.error('Operation validation error:', error);
            return {
                isValid: true, // Default to allowing operations to prevent blocking
                errors: [],
                warnings: ['Validation system error'],
                recommendations: [],
                missingOperations: []
            };
        }
    }, [processingContext]);

    const validateSequence = useCallback((operations: string[]): ValidationResult => {
        try {
            return compatibilityChecker.validateOperationSequence(operations);
        } catch (error) {
            console.error('Sequence validation error:', error);
            return {
                isValid: true, // Default to allowing sequences
                errors: [],
                warnings: ['Sequence validation error'],
                recommendations: [],
                missingOperations: []
            };
        }
    }, []);

    const getBlockingReason = useCallback((operation: string): ValidationResult => {
        return validateOperation(operation);
    }, [validateOperation]);

    const getOperationDependencies = useCallback((operation: string): string[] => {
        try {
            return compatibilityChecker.getOperationDependencies(operation);
        } catch (error) {
            console.error('Dependencies error:', error);
            return [];
        }
    }, []);

    const canGenerateOutputs = useMemo(() => {
        const outputOps = ['ERD Generator', 'SQL Generator', 'Relation Generator', 'Report Generator'];
        return outputOps.some(op => !validationState.blockedOperations.has(op));
    }, [validationState.blockedOperations]);

    const normalizationProgress = useMemo(() => {
        const nfOrder = ['1NF', '2NF', '3NF'];
        const currentIndex = currentNormalForm ? nfOrder.indexOf(currentNormalForm) : -1;
        
        return {
            current: currentNormalForm,
            progress: Math.max(0, currentIndex + 1),
            total: 3,
            percentage: Math.max(0, ((currentIndex + 1) / 3) * 100),
            canProceed: currentIndex < 2,
            nextNF: currentIndex < 2 && currentIndex >= -1 ? nfOrder[currentIndex + 1] : null
        };
    }, [currentNormalForm]);

    // FIXED: Use useEffect instead of useMemo to prevent infinite loops
    useEffect(() => {
        validateAllOperations();
    }, [processingContext]); // Only depend on processingContext, not validateAllOperations

    return {
        validationResults: validationState.validationResults,
        blockedOperations: validationState.blockedOperations,
        availableOperations: validationState.availableOperations,
        nextRecommended: validationState.nextRecommended,
        validateOperation,
        validateAllOperations,
        validateSequence,
        isOperationBlocked: (operation: string) => !validateOperation(operation).isValid,
        getBlockingReason,
        getOperationDependencies,
        canGenerateOutputs,
        normalizationProgress,
        processingContext,
        lastValidation: validationState.lastValidation
    };
}