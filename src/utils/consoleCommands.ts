import { ValidationResult } from '../types';
import { ALL_OPERATION_NAMES } from '../config/operations';

export interface CommandContext {
  onExecuteCommand?: (line: string) => void;
  onAddNode?: (label: string) => void;
  onRunOperation?: () => void;
  onRunAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearLogs?: () => void;
  onPauseLogs?: () => void;
  availableOperations?: string[];
  blockedOperations?: Set<string>;
  validateOperation?: (op: string) => ValidationResult;
  getBlockingReason?: (op: string) => ValidationResult;
  getOperationDependencies?: (op: string) => string[];
  currentNormalForm?: string | null;
  normalizationProgress?: any;
  nodes?: any[];
  currentPhase?: string;
  completedOperations?: string[];
  logs?: string[];
}

export function executeConsoleCommand(command: string, ctx: CommandContext): void {
  const trimmed = command.trim();
  if (!trimmed) return;

  const parts = trimmed.split(' ');
  const mainCommand = parts[0].toLowerCase();
  const args = parts.slice(1);

  ctx.onExecuteCommand?.(`$ ${command}`);

  switch (mainCommand) {
    case 'help':
      [
        'Available Commands:',
        '',
        'Operation Commands:',
        '  add <operation>        - Add operation to workflow',
        '  run                    - Execute current workflow',
        '  run-all                - Execute complete pipeline',
        '  undo                   - Remove last operation',
        '  redo                   - Restore last undone operation',
        '',
        'Validation Commands:',
        '  validate [operation]   - Check operation validity',
        '  check-dependencies <op>- Show operation dependencies',
        '  show-requirements <op> - Show detailed requirements',
        '  normalization-status   - Show current NF progress',
        '  next-steps             - Show recommended operations',
        '',
        'Status Commands:',
        '  status                 - Show current status',
        '  phase                  - Show current phase',
        '  list                   - List all operations',
        '',
        'Control Commands:',
        '  clear                  - Clear console logs',
        '  pause                  - Pause log updates',
        '  resume                 - Resume log updates',
        '  export-logs            - Download console logs'
      ].forEach(line => ctx.onExecuteCommand?.(line));
      break;

    case 'add':
      if (args.length === 0) {
        ctx.onExecuteCommand?.('Usage: add <operation_name>');
      } else {
        const opName = args.join(' ').replace(/^["']|["']$/g, '');
        if (ctx.onAddNode) {
          ctx.onAddNode(opName);
        } else {
          ctx.onExecuteCommand?.(`Cannot add operation: Handler not attached`);
        }
      }
      break;

    case 'run':
      if (ctx.onRunOperation) {
        ctx.onRunOperation();
      } else {
        ctx.onExecuteCommand?.('Run handler not attached');
      }
      break;

    case 'run-all':
      if (ctx.onRunAll) {
        ctx.onRunAll();
      } else {
        ctx.onExecuteCommand?.('Run-all handler not attached');
      }
      break;

    case 'undo':
      ctx.onUndo?.();
      break;

    case 'redo':
      ctx.onRedo?.();
      break;

    case 'clear':
      ctx.onClearLogs?.();
      break;

    case 'pause':
      ctx.onPauseLogs?.();
      break;

    case 'status':
      ctx.onExecuteCommand?.(`Current Phase: ${ctx.currentPhase || 'PREP'}`);
      ctx.onExecuteCommand?.(`Completed Ops: ${(ctx.completedOperations || []).join(', ') || 'None'}`);
      ctx.onExecuteCommand?.(`Node Count: ${(ctx.nodes || []).length}`);
      break;

    case 'phase':
      ctx.onExecuteCommand?.(`Current Phase: ${ctx.currentPhase || 'PREP'}`);
      break;

    case 'list':
      ctx.onExecuteCommand?.('Available Operations:');
      ALL_OPERATION_NAMES.forEach(op => ctx.onExecuteCommand?.(`  • ${op}`));
      break;

    case 'validate':
      if (args.length === 0) {
        ctx.onExecuteCommand?.('Validation Status:');
        (ctx.availableOperations || []).forEach(op => ctx.onExecuteCommand?.(`✓ ${op} - Ready`));
        Array.from(ctx.blockedOperations || []).forEach(op => {
          const reason = ctx.getBlockingReason?.(op);
          ctx.onExecuteCommand?.(`✗ ${op} - Blocked: ${reason?.errors[0] || 'Prerequisites missing'}`);
        });
      } else {
        const opName = args.join(' ').replace(/^["']|["']$/g, '');
        const val = ctx.validateOperation?.(opName);
        if (val?.isValid) {
          ctx.onExecuteCommand?.(`✓ ${opName} is ready to execute`);
        } else {
          ctx.onExecuteCommand?.(`✗ ${opName} is blocked: ${val?.errors[0] || 'Validation failed'}`);
        }
      }
      break;

    case 'check-dependencies':
      if (args.length === 0) {
        ctx.onExecuteCommand?.('Usage: check-dependencies <operation_name>');
      } else {
        const opName = args.join(' ').replace(/^["']|["']$/g, '');
        const deps = ctx.getOperationDependencies?.(opName) || [];
        if (deps.length === 0) {
          ctx.onExecuteCommand?.(`✓ ${opName} has no dependencies`);
        } else {
          ctx.onExecuteCommand?.(`Dependencies for ${opName}: ${deps.join(', ')}`);
        }
      }
      break;

    default:
      ctx.onExecuteCommand?.(`Unknown command: '${mainCommand}'. Type 'help' for available commands.`);
      break;
  }
}
