import { useState } from 'react';
import { Shield, Lock, Unlock, Zap, CheckCircle, AlertCircle, BarChart3, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

interface QualityAssuranceSectionProps {
  losslessCheck?: any;
  dependencyPreservation?: any;
}

export function calculatePreservationRate(dependencyPreservation?: {
  preserved?: any[];
  lost?: any[];
  preservationRatio?: number;
  isPreserved?: boolean;
} | null): string {
  if (!dependencyPreservation) return '0.0';

  const preservedCount = dependencyPreservation.preserved?.length ?? 0;
  const lostCount = dependencyPreservation.lost?.length ?? 0;
  const totalCount = preservedCount + lostCount;

  if (totalCount > 0) {
    return ((preservedCount / totalCount) * 100).toFixed(1);
  }

  if (
    typeof dependencyPreservation.preservationRatio === 'number' &&
    Number.isFinite(dependencyPreservation.preservationRatio)
  ) {
    return (dependencyPreservation.preservationRatio * 100).toFixed(1);
  }

  // If 0 dependencies exist, 0 dependencies are lost -> 100% preservation
  return dependencyPreservation.isPreserved !== false ? '100.0' : '0.0';
}

export function QualityAssuranceSection({ losslessCheck, dependencyPreservation }: QualityAssuranceSectionProps) {
  const [showAllPreserved, setShowAllPreserved] = useState(false);
  const [showAllLost, setShowAllLost] = useState(false);

  if (!losslessCheck && !dependencyPreservation) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p style={{ fontFamily: "'Inter', sans-serif" }}>No quality assurance data available</p>
        <p className="text-sm text-gray-400 mt-2">Quality checks require Lossless Check and Dependency Preservation operations</p>
      </div>
    );
  }

  const useColumns = (count: number) => count > 8;
  const splitIntoColumns = (items: any[]) => {
    const midpoint = Math.ceil(items.length / 2);
    return [items.slice(0, midpoint), items.slice(midpoint)];
  };

  return (
    <div className="space-y-6">
      {losslessCheck && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${losslessCheck.isLossless ? 'bg-green-100' : 'bg-red-100'}`}>
              {losslessCheck.isLossless ? <Unlock className="w-5 h-5 text-green-600" /> : <Lock className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                Lossless Join Property
              </h4>
              <p className="text-sm text-gray-600">Decomposition preserves all original information</p>
            </div>
            <div className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${losslessCheck.isLossless ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {losslessCheck.isLossless ? 'LOSSLESS' : 'LOSSY'}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              The decomposition is <strong>{losslessCheck.isLossless ? 'lossless' : 'lossy'}</strong>.
              This means that joining the decomposed relations {losslessCheck.isLossless ? 'will' : 'will NOT'} produce the original relation without any loss or addition of information.
            </p>

            {losslessCheck.details && (
              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Algorithm:</span>
                  <span className="ml-2">{losslessCheck.details.algorithm || 'Chase Algorithm'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Relations Tested:</span>
                  <span className="ml-2">{losslessCheck.details.relationCount || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {dependencyPreservation && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${dependencyPreservation.isPreserved ? 'bg-green-100' : 'bg-red-100'}`}>
              <Zap className={`w-5 h-5 ${dependencyPreservation.isPreserved ? 'text-green-600' : 'text-red-600'}`} />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                Dependency Preservation
              </h4>
              <p className="text-sm text-gray-600">Functional dependencies maintained in decomposition</p>
            </div>
            <div className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${dependencyPreservation.isPreserved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {dependencyPreservation.isPreserved ? 'PRESERVED' : 'NOT PRESERVED'}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-3">
              {dependencyPreservation.isPreserved
                ? 'All functional dependencies are preserved in the decomposition. This ensures that all integrity constraints can be enforced without joins.'
                : 'Some functional dependencies are lost in the decomposition. This may require joins to enforce certain integrity constraints.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <CheckCircle className="w-6 h-6" />
                  {dependencyPreservation.preserved?.length || 0}
                </div>
                <div className="text-sm text-green-700" style={{ fontFamily: "'Inter', sans-serif" }}>Preserved Dependencies</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <AlertCircle className="w-6 h-6" />
                  {dependencyPreservation.lost?.length || 0}
                </div>
                <div className="text-sm text-red-700" style={{ fontFamily: "'Inter', sans-serif" }}>Lost Dependencies</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <BarChart3 className="w-6 h-6" />
                  {calculatePreservationRate(dependencyPreservation)}%
                </div>
                <div className="text-sm text-blue-700" style={{ fontFamily: "'Inter', sans-serif" }}>Preservation Rate</div>
              </div>
            </div>

            <div className="space-y-6">
              {dependencyPreservation.preserved?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-green-700 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Preserved Dependencies ({dependencyPreservation.preserved.length})
                    </h5>
                    {dependencyPreservation.preserved.length > 12 && (
                      <button
                        onClick={() => setShowAllPreserved(!showAllPreserved)}
                        className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 transition-colors"
                      >
                        {showAllPreserved ? <> <ChevronUp className="w-3 h-3" /> Show Less </> : <> <ChevronDown className="w-3 h-3" /> Show All </>}
                      </button>
                    )}
                  </div>

                  {(() => {
                    const displayItems = showAllPreserved ? dependencyPreservation.preserved : dependencyPreservation.preserved.slice(0, 12);
                    const shouldUseColumns = useColumns(displayItems.length);

                    if (shouldUseColumns) {
                      const [leftColumn, rightColumn] = splitIntoColumns(displayItems);
                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            {leftColumn.map((fd: any, index: number) => (
                              <div key={index} className="text-xs font-mono bg-green-50 px-3 py-2 rounded border border-green-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-800 font-medium">{Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}</span>
                                  <ArrowRight className="w-3 h-3 text-green-600" />
                                  <span className="text-green-800 font-medium">{fd.rhs}</span>
                                </div>
                                {typeof fd.confidence === 'number' && Number.isFinite(fd.confidence) && fd.confidence > 0 && (
                                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">{(fd.confidence * 100).toFixed(1)}%</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            {rightColumn.map((fd: any, index: number) => (
                              <div key={index + leftColumn.length} className="text-xs font-mono bg-green-50 px-3 py-2 rounded border border-green-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-800 font-medium">{Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}</span>
                                  <ArrowRight className="w-3 h-3 text-green-600" />
                                  <span className="text-green-800 font-medium">{fd.rhs}</span>
                                </div>
                                {typeof fd.confidence === 'number' && Number.isFinite(fd.confidence) && fd.confidence > 0 && (
                                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">{(fd.confidence * 100).toFixed(1)}%</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="space-y-1">
                          {displayItems.map((fd: any, index: number) => (
                            <div key={index} className="text-xs font-mono bg-green-50 px-3 py-2 rounded border border-green-200 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-green-800 font-medium">{Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}</span>
                                <ArrowRight className="w-3 h-3 text-green-600" />
                                <span className="text-green-800 font-medium">{fd.rhs}</span>
                              </div>
                              {typeof fd.confidence === 'number' && Number.isFinite(fd.confidence) && fd.confidence > 0 && (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">{(fd.confidence * 100).toFixed(1)}%</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              {dependencyPreservation.lost?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Lost Dependencies ({dependencyPreservation.lost.length})
                    </h5>
                    {dependencyPreservation.lost.length > 12 && (
                      <button
                        onClick={() => setShowAllLost(!showAllLost)}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors"
                      >
                        {showAllLost ? <> <ChevronUp className="w-3 h-3" /> Show Less </> : <> <ChevronDown className="w-3 h-3" /> Show All </>}
                      </button>
                    )}
                  </div>

                  {(() => {
                    const displayItems = showAllLost ? dependencyPreservation.lost : dependencyPreservation.lost.slice(0, 12);
                    const shouldUseColumns = useColumns(displayItems.length);

                    if (shouldUseColumns) {
                      const [leftColumn, rightColumn] = splitIntoColumns(displayItems);
                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            {leftColumn.map((fd: any, index: number) => (
                              <div key={index} className="text-xs font-mono bg-red-50 px-3 py-2 rounded border border-red-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-red-800 font-medium">{Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}</span>
                                  <ArrowRight className="w-3 h-3 text-red-600" />
                                  <span className="text-red-800 font-medium">{fd.rhs}</span>
                                </div>
                                {typeof fd.confidence === 'number' && Number.isFinite(fd.confidence) && fd.confidence > 0 && (
                                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">{(fd.confidence * 100).toFixed(1)}%</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            {rightColumn.map((fd: any, index: number) => (
                              <div key={index + leftColumn.length} className="text-xs font-mono bg-red-50 px-3 py-2 rounded border border-red-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-red-800 font-medium">{Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}</span>
                                  <ArrowRight className="w-3 h-3 text-red-600" />
                                  <span className="text-red-800 font-medium">{fd.rhs}</span>
                                </div>
                                {typeof fd.confidence === 'number' && Number.isFinite(fd.confidence) && fd.confidence > 0 && (
                                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">{(fd.confidence * 100).toFixed(1)}%</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="space-y-1">
                          {displayItems.map((fd: any, index: number) => (
                            <div key={index} className="text-xs font-mono bg-red-50 px-3 py-2 rounded border border-red-200 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-red-800 font-medium">{Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}</span>
                                <ArrowRight className="w-3 h-3 text-red-600" />
                                <span className="text-red-800 font-medium">{fd.rhs}</span>
                              </div>
                              {typeof fd.confidence === 'number' && Number.isFinite(fd.confidence) && fd.confidence > 0 && (
                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">{(fd.confidence * 100).toFixed(1)}%</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
