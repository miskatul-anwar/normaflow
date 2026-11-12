import { useState, useEffect } from 'react';
import { Table, Hash, Layers, Database, GitBranch, Key, ExternalLink, ArrowRight } from 'lucide-react';
import { RelationSchema } from '../../types';
import { relationSignature } from '../../services/naming/relationNames';
import { saveUserName } from '../../services/naming/userNames';

interface NormalFormSectionProps {
  relations1NF?: RelationSchema[];
  relations2NF?: RelationSchema[];
  relations3NF?: RelationSchema[];
  relationsBCNF?: RelationSchema[];
}

export function NormalFormSection({ relations1NF, relations2NF, relations3NF, relationsBCNF }: NormalFormSectionProps) {
  const [activeNF, setActiveNF] = useState<'1nf' | '2nf' | '3nf' | 'bcnf'>('1nf');

  const has1NF = Boolean(relations1NF && relations1NF.length > 0);
  const has2NF = Boolean(relations2NF && relations2NF.length > 0);
  const has3NF = Boolean(relations3NF && relations3NF.length > 0);
  const hasBCNF = Boolean(relationsBCNF && relationsBCNF.length > 0);

  useEffect(() => {
    if (hasBCNF) setActiveNF('bcnf');
    else if (has3NF) setActiveNF('3nf');
    else if (has2NF) setActiveNF('2nf');
    else if (has1NF) setActiveNF('1nf');
  }, [has1NF, has2NF, has3NF, hasBCNF]);

  if (!has1NF && !has2NF && !has3NF && !hasBCNF) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Table className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No normalized relations generated</p>
        <p className="text-sm text-gray-500 mt-2">Relations are created during normalization process</p>
      </div>
    );
  }

  const getActiveRelations = () => {
    switch (activeNF) {
      case '1nf': return relations1NF || [];
      case '2nf': return relations2NF || [];
      case '3nf': return relations3NF || [];
      case 'bcnf': return relationsBCNF || [];
      default: return [];
    }
  };

  const activeRelations = getActiveRelations();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 overflow-x-auto px-3" aria-label="Normal forms" role="tablist">
            {([
              { id: '1nf', short: '1NF', full: 'First normal form', has: has1NF, n: relations1NF?.length ?? 0, Icon: Hash },
              { id: '2nf', short: '2NF', full: 'Second normal form', has: has2NF, n: relations2NF?.length ?? 0, Icon: Layers },
              { id: '3nf', short: '3NF', full: 'Third normal form', has: has3NF, n: relations3NF?.length ?? 0, Icon: Database },
              { id: 'bcnf', short: 'BCNF', full: 'Boyce-Codd normal form', has: hasBCNF, n: relationsBCNF?.length ?? 0, Icon: GitBranch },
            ] as const).map(({ id, short, full, has, n, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeNF === id}
                title={full}
                onClick={() => setActiveNF(id)}
                disabled={!has}
                className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  activeNF === id
                    ? 'border-teal-600 text-teal-700'
                    : has
                    ? 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                    : 'cursor-not-allowed border-transparent text-gray-300'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {short}
                <span className="hidden text-xs font-normal text-gray-500 xl:inline">{full.replace(' normal form', '')}</span>
                {has && <span className={`rounded-full px-2 py-0.5 text-xs ${activeNF === id ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>{n}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeRelations && activeRelations.length > 0 ? (
            <div className="space-y-4">
              {activeRelations.map((relation, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <h4 className="flex items-center gap-2 text-base font-semibold text-gray-900">
                      <Table className="w-5 h-5 text-gray-500" />
                      <RelationTitle relation={relation} />
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Hash className="w-4 h-4" />
                        {relation.attributes?.length || 0} attributes
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-4 h-4" />
                        {relation.rows?.length || 0} rows
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h5 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 [&_svg]:size-3.5">
                      <GitBranch className="w-4 h-4" />
                      Attributes
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {relation.attributes?.map((attr: string) => {
                        const isPK = relation.primaryKey?.includes(attr);
                        const isFK = relation.foreignKeys?.some((fk: any) => fk.attributes.includes(attr));

                        return (
                          <span
                            key={attr}
                            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${
                              isPK
                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                                : isFK
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-gray-100 text-gray-800 border border-gray-300'
                            }`}
                          >
                            {isPK && <Key className="w-3 h-3" />}
                            {isFK && <ExternalLink className="w-3 h-3" />}
                            {attr}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {relation.primaryKey && relation.primaryKey.length > 0 && (
                    <div className="mb-3">
                      <h5 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 [&_svg]:size-3.5">
                        <Key className="w-4 h-4" />
                        Primary Key
                      </h5>
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        {relation.primaryKey.join(', ')}
                      </code>
                    </div>
                  )}

                  {relation.foreignKeys && relation.foreignKeys.length > 0 && (
                    <div className="mb-3">
                      <h5 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 [&_svg]:size-3.5">
                        <ExternalLink className="w-4 h-4" />
                        Foreign Keys
                      </h5>
                      <div className="space-y-1">
                        {relation.foreignKeys.map((fk: any, fkIndex: number) => (
                          <div key={fkIndex} className="text-sm bg-blue-50 px-3 py-2 rounded border border-blue-200">
                            <span className="font-mono">{fk.attributes.join(', ')}</span>
                            <ArrowRight className="w-3 h-3 inline mx-2 text-blue-600" />
                            <span className="font-mono text-blue-700">{fk.references}</span>
                            <span className="text-blue-600 ml-2">({fk.cardinality})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {relation.originalFD && (
                    <div className="bg-green-50 border border-green-200 rounded p-3">
                      <h5 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-green-800 [&_svg]:size-3.5">
                        <GitBranch className="w-4 h-4" />
                        Source Functional Dependency
                      </h5>
                      <div className="text-sm text-green-700">
                        <span className="font-mono">{relation.originalFD.lhs.join(', ')}</span>
                        <ArrowRight className="w-3 h-3 inline mx-2" />
                        <span className="font-mono">{relation.originalFD.rhs}</span>
                        <span className="ml-2 bg-green-100 px-2 py-1 rounded text-xs">
                          {(relation.originalFD.confidence * 100).toFixed(2)}% confidence
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No {activeNF.toUpperCase()} relations available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A relation's name with where it came from: "suggested" for the on-device model, "unnamed" when there is none, and a
 * rename box either way. A typed name is remembered for these columns and used on the next run.
 */
function RelationTitle({ relation }: { relation: RelationSchema }) {
  const [typed, setTyped] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const source = typed ? 'user' : relation.nameSource;
  const shown = typed ?? relation.displayName ?? (source === 'placeholder' ? 'Unnamed relation' : relation.name);
  const canRename = source !== 'source' && !!relation.sourceTable;

  if (editing) {
    const commit = (value: string) => {
      setEditing(false);
      if (value.trim() === shown) return;
      saveUserName(relationSignature(relation.sourceTable!, relation), value);
      setTyped(value.trim() || null);
    };
    return (
      <input
        autoFocus
        aria-label="Relation name"
        defaultValue={source === 'placeholder' ? '' : shown}
        placeholder="Name this relation"
        className="nf-input min-w-0 rounded border border-gray-300 px-2 py-0.5 text-base font-semibold"
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <>
      <span className={source === 'placeholder' ? 'italic text-gray-500' : undefined}>{shown}</span>
      {source === 'model' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-800" title="Suggested by the on-device model. Check it and rename if it is wrong.">suggested</span>}
      {source === 'placeholder' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">unnamed</span>}
      {canRename && (
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-normal text-teal-700 underline underline-offset-2 hover:text-teal-900">
          rename
        </button>
      )}
    </>
  );
}
