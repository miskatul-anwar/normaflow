import { Key, Hash, GitBranch, Target, Database, CheckCircle, AlertCircle } from 'lucide-react';

interface KeysSectionProps {
  keyData: any;
}

export function KeysSection({ keyData }: KeysSectionProps) {
  if (!keyData || (!keyData.candidateKeys?.length && !keyData.superkeys?.length)) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No keys discovered</p>
        <p className="text-sm text-gray-400 mt-2">Key discovery requires functional dependencies</p>
      </div>
    );
  }

  const candidateKeys = keyData.candidateKeys || [];
  const superkeys = keyData.superkeys || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Key className="w-5 h-5 text-yellow-600" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
              Candidate Keys
            </h4>
          </div>

          {candidateKeys.length === 0 ? (
            <p className="text-gray-500 text-sm">No candidate keys identified</p>
          ) : (
            <div className="space-y-3">
              {candidateKeys.map((key: string[], index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">Key {index + 1}</span>
                    <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${key.length === 1 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {key.length === 1 ? (
                        <> <Hash className="w-3 h-3" /> Simple </>
                      ) : (
                        <> <GitBranch className="w-3 h-3" /> Composite </>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {key.map((attr, attrIndex) => (
                      <span key={attrIndex} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm font-mono">
                        {attr}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    {key.length <= 2 ? 'Suitable for primary key' : 'Consider surrogate key'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
              Super Keys
            </h4>
          </div>

          {superkeys.length === 0 ? (
            <p className="text-gray-500 text-sm">No super keys identified</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {superkeys.map((key: string[], index: number) => {
                const isCandidate = candidateKeys.some((ck: string[]) =>
                  ck.length === key.length && ck.every((attr: string) => key.includes(attr))
                );

                return (
                  <div key={index} className={`border rounded-lg p-2 ${isCandidate ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {key.map((attr, attrIndex) => (
                          <span key={attrIndex} className="bg-gray-100 text-gray-700 px-1 py-0.5 rounded text-xs font-mono">
                            {attr}
                          </span>
                        ))}
                      </div>
                      {isCandidate && (
                        <span className="text-xs text-yellow-700 font-medium flex items-center gap-1">
                          <Key className="w-3 h-3" /> Candidate
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <div>Total Super Keys: {superkeys.length}</div>
              <div>Minimal Keys: {candidateKeys.length}</div>
              {candidateKeys.length > 0 && (
                <div>Average Key Size: {(candidateKeys.reduce((sum: number, key: string[]) => sum + key.length, 0) / candidateKeys.length).toFixed(1)}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
          <Target className="w-5 h-5" />
          Recommendations
        </h5>
        <div className="space-y-3 text-sm">
          {candidateKeys.length > 0 ? (
            <>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <div>
                  <span className="font-medium">Primary Key Suggestion: </span>
                  {(() => {
                    const simpleKeys = candidateKeys.filter((key: string[]) => key.length === 1);
                    if (simpleKeys.length > 0) {
                      return `Consider using {${simpleKeys[0].join(', ')}} as the primary key`;
                    } else {
                      const shortestKey = candidateKeys.reduce((min: string[], key: string[]) =>
                        key.length < min.length ? key : min
                      );
                      return `Consider using {${shortestKey.join(', ')}} as the primary key`;
                    }
                  })()}
                </div>
              </div>
              {candidateKeys.length > 1 && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div>
                    <span className="font-medium">Alternative Keys: </span>
                    Other candidate keys can serve as unique constraints
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5" />
                <div>
                  <span className="font-medium">Index Strategy: </span>
                  Create indexes on all candidate keys for optimal performance
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                <div>
                  <span className="font-medium">Action Required: </span>
                  Manual key identification needed
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                <div>
                  <span className="font-medium">Consider: </span>
                  Adding surrogate keys (auto-increment IDs)
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
