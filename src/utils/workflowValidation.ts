import { Node } from '@xyflow/react';
import { OPERATIONS } from '../config/operations';
import { ValidationResult } from '../types';

export function validateSequence(nodes: Node[]): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (nodes.length <= 1) {
    return result;
  }

  const operationLabels = nodes.slice(1).map(node => String(node.data?.label || ''));
  const operationConfigs = operationLabels.map(label => OPERATIONS[label]);

  // Check for undefined operations
  operationConfigs.forEach((config, index) => {
    if (!config) {
      result.isValid = false;
      result.errors.push(`Unknown operation: ${operationLabels[index]}`);
    }
  });

  if (!result.isValid) return result;

  // Check dependencies are met
  for (let i = 0; i < operationLabels.length; i++) {
    const currentOp = operationLabels[i];
    const currentConfig = OPERATIONS[currentOp];
    const previousOps = operationLabels.slice(0, i);

    for (const dependency of currentConfig.dependencies) {
      if (!previousOps.includes(dependency)) {
        result.isValid = false;
        result.errors.push(`${currentOp} requires ${dependency} to be executed first`);
      }
    }
  }

  // Check normalization form order
  const nfOperations = ['1NF', '2NF', '3NF'];
  const nfIndices = nfOperations.map(nf => operationLabels.indexOf(nf)).filter(idx => idx !== -1);

  for (let i = 1; i < nfIndices.length; i++) {
    if (nfIndices[i] < nfIndices[i - 1]) {
      result.isValid = false;
      result.errors.push(`Normalization forms must be applied in order: 1NF → 2NF → 3NF`);
      break;
    }
  }

  // Check phase ordering
  const phases = ['PREP', 'ANALYZE', 'NORMAL', 'OUTPUT'];
  let lastPhaseIndex = -1;

  for (const config of operationConfigs) {
    const currentPhaseIndex = phases.indexOf(config.phase);
    if (currentPhaseIndex < lastPhaseIndex) {
      result.warnings.push(`Phase ordering warning: ${config.phase} operation after ${phases[lastPhaseIndex]} phase`);
    }
    lastPhaseIndex = Math.max(lastPhaseIndex, currentPhaseIndex);
  }

  // Specific validation rules
  const fdIndex = operationLabels.indexOf('FD Miner');
  const oneNFIndex = operationLabels.indexOf('1NF');

  if (fdIndex !== -1 && oneNFIndex !== -1 && fdIndex < oneNFIndex) {
    result.isValid = false;
    result.errors.push("FD Miner must come after 1NF normalization");
  }

  // Check for missing essential operations
  if (operationLabels.includes('2NF') && !operationLabels.includes('1NF')) {
    result.isValid = false;
    result.errors.push("2NF requires 1NF to be applied first");
  }

  if (operationLabels.includes('3NF') && !operationLabels.includes('2NF')) {
    result.isValid = false;
    result.errors.push("3NF requires 2NF to be applied first");
  }

  // Check output generation prerequisites
  if (operationLabels.includes('SQL Generator') && !operationLabels.includes('Relation Generator')) {
    result.isValid = false;
    result.errors.push("SQL Generator requires Relation Generator");
  }

  if (operationLabels.includes('Report Generator')) {
    const requiredForReport = ['Lossless Check', 'Dependency Preservation'];
    const missingForReport = requiredForReport.filter(req => !operationLabels.includes(req));
    if (missingForReport.length > 0) {
      result.warnings.push(`Report Generator recommended after: ${missingForReport.join(', ')}`);
    }
  }

  return result;
}
