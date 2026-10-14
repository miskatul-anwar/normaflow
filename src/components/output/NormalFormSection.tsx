import { useState, useEffect } from 'react';
import { Table, Hash, Layers, Database, GitBranch, Key, ExternalLink, ArrowRight } from 'lucide-react';
import { RelationSchema } from '../../types';

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
        <p style={{ fontFamily: "'Inter', sans-serif" }}>No normalized relations generated</p>
        <p className="text-sm text-gray-400 mt-2">Relations are created during normalization process</p>
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveNF('1nf')}
              disabled={!has1NF}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeNF === '1nf'
                  ? 'border-teal-500 text-teal-600'
                  : has1NF
                  ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  : 'border-transparent text-gray-300 cursor-not-allowed'
              }`}
            >
              <Hash className="w-4 h-4" />
              First Normal Form (1NF)
              {has1NF && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {relations1NF?.length || 0}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveNF('2nf')}
              disabled={!has2NF}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeNF === '2nf'
                  ? 'border-teal-500 text-teal-600'
                  : has2NF
                  ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  : 'border-transparent text-gray-300 cursor-not-allowed'
              }`}
            >
              <Layers className="w-4 h-4" />
              Second Normal Form (2NF)
              {has2NF && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {relations2NF?.length || 0}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveNF('3nf')}
              disabled={!has3NF}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeNF === '3nf'
                  ? 'border-teal-500 text-teal-600'
                  : has3NF
                  ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  : 'border-transparent text-gray-300 cursor-not-allowed'
              }`}
            >
              <Database className="w-4 h-4" />
              Third Normal Form (3NF)
              {has3NF && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {relations3NF?.length || 0}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveNF('bcnf')}
              disabled={!hasBCNF}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeNF === 'bcnf'
                  ? 'border-teal-500 text-teal-600'
                  : hasBCNF
                  ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  : 'border-transparent text-gray-300 cursor-not-allowed'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Boyce-Codd Normal Form (BCNF)
              {hasBCNF && (
                <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                  {relationsBCNF?.length || 0}
                </span>
              )}
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeRelations && activeRelations.length > 0 ? (
            <div className="space-y-4">
              {activeRelations.map((relation, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                      <Table className="w-5 h-5 text-gray-500" />
                      {relation.name}
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
                    <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
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
                      <h5 className="font-medium text-gray-700 mb-1 flex items-center gap-2">
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
                      <h5 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
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
                      <h5 className="font-medium text-green-800 mb-1 flex items-center gap-2">
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
