import { BarChart3, Hash, GitBranch, TrendingUp, TrendingDown, Target, Key } from 'lucide-react';

interface CardinalitySectionProps {
  cardinalityAnalysis?: Record<string, any>;
}

export function CardinalitySection({ cardinalityAnalysis }: CardinalitySectionProps) {
  if (!cardinalityAnalysis || Object.keys(cardinalityAnalysis).length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p style={{ fontFamily: "'Inter', sans-serif" }}>No cardinality analysis available</p>
        <p className="text-sm text-gray-400 mt-2">Cardinality analysis requires the Cardinality Analyzer operation</p>
      </div>
    );
  }

  const cardinalityEntries = Object.entries(cardinalityAnalysis);

  const getRelationshipType = (analysis: any) => {
    if (!analysis) return "Unknown";
    const uniqueRatio = analysis.uniqueValues && analysis.totalValues
      ? analysis.uniqueValues / analysis.totalValues
      : analysis.cardinality || 0;

    if (uniqueRatio > 0.95) return "One-to-One (1:1)";
    if (uniqueRatio > 0.3) return "One-to-Many (1:N)";
    return "Many-to-Many (M:N)";
  };

  const getConfidence = (analysis: any) => {
    if (!analysis) return '0.0%';
    if (analysis.confidence) return (analysis.confidence * 100).toFixed(1) + '%';

    const uniqueRatio = analysis.uniqueValues && analysis.totalValues
      ? analysis.uniqueValues / analysis.totalValues
      : analysis.cardinality || 0;
    const duplicateRatio = analysis.duplicateRatio || 0;
    const confidence = Math.max(0, Math.min(1, uniqueRatio * (1 - duplicateRatio) * 0.9 + 0.1));
    return (confidence * 100).toFixed(1) + '%';
  };

  const getNumericConfidence = (analysis: any) => {
    if (!analysis) return 0;
    if (analysis.confidence) return analysis.confidence * 100;

    const uniqueRatio = analysis.uniqueValues && analysis.totalValues
      ? analysis.uniqueValues / analysis.totalValues
      : analysis.cardinality || 0;
    const duplicateRatio = analysis.duplicateRatio || 0;
    const confidence = Math.max(0, Math.min(1, uniqueRatio * (1 - duplicateRatio) * 0.9 + 0.1));
    return confidence * 100;
  };

  const getUniquenessRatio = (analysis: any) => {
    if (!analysis) return 0;
    if (analysis.uniqueValues && analysis.totalValues) {
      return analysis.uniqueValues / analysis.totalValues;
    }
    return analysis.cardinality || 0;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
          <BarChart3 className="w-5 h-5" />
          Attribute Cardinality Analysis
        </h4>
        <p className="text-gray-600 mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
          Analysis of attribute value distributions and relationships to determine optimal cardinality mappings.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attribute</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Values</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Values</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relationship Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Type</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cardinalityEntries.map(([attribute, analysis]: [string, any], index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-gray-400" />
                      {attribute}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{analysis.totalValues || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{analysis.uniqueValues || 'N/A'}</span>
                      {analysis.cardinality && (
                        <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (analysis.cardinality || 0) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit">
                      <GitBranch className="w-3 h-3" />
                      {getRelationshipType(analysis)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      {getConfidence(analysis)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                      {analysis.dataType || 'string'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <div className="text-2xl font-bold text-green-600" style={{ fontFamily: "'Inter', sans-serif" }}>
              {cardinalityEntries.filter(([, analysis]: [string, any]) => getUniquenessRatio(analysis) > 0.9).length}
            </div>
          </div>
          <div className="text-sm text-green-700" style={{ fontFamily: "'Inter', sans-serif" }}>High Uniqueness ({'>'}90%)</div>
          <div className="text-xs text-green-600 mt-1">One-to-One relationships</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-yellow-600" />
            <div className="text-2xl font-bold text-yellow-600" style={{ fontFamily: "'Inter', sans-serif" }}>
              {cardinalityEntries.filter(([, analysis]: [string, any]) => {
                const ratio = getUniquenessRatio(analysis);
                return ratio > 0.3 && ratio <= 0.9;
              }).length}
            </div>
          </div>
          <div className="text-sm text-yellow-700" style={{ fontFamily: "'Inter', sans-serif" }}>Medium Uniqueness (30-90%)</div>
          <div className="text-xs text-yellow-600 mt-1">One-to-Many relationships</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <div className="text-2xl font-bold text-red-600" style={{ fontFamily: "'Inter', sans-serif" }}>
              {cardinalityEntries.filter(([, analysis]: [string, any]) => getUniquenessRatio(analysis) <= 0.3).length}
            </div>
          </div>
          <div className="text-sm text-red-700" style={{ fontFamily: "'Inter', sans-serif" }}>Low Uniqueness (≤30%)</div>
          <div className="text-xs text-red-600 mt-1">Many-to-Many relationships</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: "'Inter', sans-serif" }}>
          <Target className="w-5 h-5" />
          Relationship Insights
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h6 className="font-medium text-gray-700 mb-2">High Confidence Attributes:</h6>
            <div className="space-y-1">
              {(() => {
                const highConfidenceAttrs = cardinalityEntries
                  .filter(([, analysis]: [string, any]) => getNumericConfidence(analysis) > 70)
                  .slice(0, 5);

                if (highConfidenceAttrs.length === 0) {
                  return <div className="bg-gray-50 px-2 py-1 rounded text-gray-500 text-xs">No attributes with confidence {'>'} 70%</div>;
                }

                return highConfidenceAttrs.map(([attr, analysis]: [string, any]) => (
                  <div key={attr} className="bg-green-50 px-2 py-1 rounded text-green-700 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{attr}</span>
                      <span className="text-green-600">{getConfidence(analysis)}</span>
                    </div>
                    <div className="text-green-600 text-xs">{analysis.uniqueValues || 'N/A'} unique of {analysis.totalValues || 'N/A'} total</div>
                  </div>
                ));
              })()}
            </div>
          </div>
          <div>
            <h6 className="font-medium text-gray-700 mb-2">Potential Key Candidates:</h6>
            <div className="space-y-1">
              {(() => {
                const keyCandidates = cardinalityEntries
                  .filter(([, analysis]: [string, any]) => getUniquenessRatio(analysis) > 0.8)
                  .slice(0, 5);

                if (keyCandidates.length === 0) {
                  return <div className="bg-gray-50 px-2 py-1 rounded text-gray-500 text-xs">No attributes with uniqueness {'>'} 80%</div>;
                }

                return keyCandidates.map(([attr, analysis]: [string, any]) => (
                  <div key={attr} className="bg-yellow-50 px-2 py-1 rounded text-yellow-700 text-xs">
                    <div className="flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      <span className="font-medium">{attr}</span>
                      <span className="text-yellow-600">({(getUniquenessRatio(analysis) * 100).toFixed(1)}% unique)</span>
                    </div>
                    <div className="text-yellow-600 text-xs">{getRelationshipType(analysis)}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
