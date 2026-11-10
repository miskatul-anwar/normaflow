import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, TrendingUp, TrendingDown, BarChart3, ArrowRight, ChevronRight, ChevronDown, Info } from 'lucide-react';
import { FunctionalDependency } from '../../types';
import { Button } from '@/components/ui/button';

export function FunctionalDependenciesSection({ fdData }: { fdData: FunctionalDependency[] }) {
  const [expandedFD, setExpandedFD] = useState<number | null>(null);

  if (!fdData || fdData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p style={{ fontFamily: "'Inter', sans-serif" }}>No functional dependencies discovered</p>
        <p className="text-sm text-gray-400 mt-2">This could indicate data is already normalized or lacks patterns</p>
      </div>
    );
  }

  const highConfFDs = fdData.filter(fd => (fd.confidence || 0) > 0.98);
  const mediumConfFDs = fdData.filter(fd => (fd.confidence || 0) > 0.90 && (fd.confidence || 0) <= 0.98);
  const lowConfFDs = fdData.filter(fd => (fd.confidence || 0) <= 0.90);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <div className="text-2xl font-bold text-green-600" style={{ fontFamily: "'Inter', sans-serif" }}>
              {highConfFDs.length}
            </div>
          </div>
          <div className="text-sm text-green-700" style={{ fontFamily: "'Inter', sans-serif" }}>
            High Confidence ({'>'}98%)
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-yellow-600" />
            <div className="text-2xl font-bold text-yellow-600" style={{ fontFamily: "'Inter', sans-serif" }}>
              {mediumConfFDs.length}
            </div>
          </div>
          <div className="text-sm text-yellow-700" style={{ fontFamily: "'Inter', sans-serif" }}>
            Medium Confidence (90-98%)
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <div className="text-2xl font-bold text-red-600" style={{ fontFamily: "'Inter', sans-serif" }}>
              {lowConfFDs.length}
            </div>
          </div>
          <div className="text-sm text-red-700" style={{ fontFamily: "'Inter', sans-serif" }}>
            Low Confidence ({'<'}90%)
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h5 className="font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
            Discovered Dependencies ({fdData.length})
          </h5>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dependency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coverage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quality</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fdData.map((fd, index) => {
                const lhsStr = Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs || 'Unknown';
                const rhsStr = fd.rhs || 'Unknown';
                const confidence = ((fd.confidence || 0) * 100).toFixed(2);
                const coverage = ((fd.coverage || 0) * 100).toFixed(2);
                const qualityLevel = (fd.confidence || 0) > 0.98 ? 'High' : (fd.confidence || 0) > 0.90 ? 'Medium' : 'Low';
                const qualityColor = (fd.confidence || 0) > 0.98 ? 'text-green-600 bg-green-100' : (fd.confidence || 0) > 0.90 ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100';

                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <span className="font-mono">{lhsStr}</span>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                        <span className="font-mono">{rhsStr}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{confidence}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{coverage}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${qualityColor}`}>
                        {qualityLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={expandedFD === index}
                        onClick={() => setExpandedFD(expandedFD === index ? null : index)}
                      >
                        {expandedFD === index ? <ChevronDown /> : <ChevronRight />}
                        {expandedFD === index ? 'Hide' : 'View'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <AnimatePresence>
          {expandedFD !== null && fdData[expandedFD] && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-200 bg-gray-50 overflow-hidden"
            >
              <div className="p-6">
                <h6 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" /> Dependency Analysis
                </h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Unique Groups:</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        {fdData[expandedFD].uniqueGroups || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Violations:</span>
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                        {fdData[expandedFD].violations || 0}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">LHS Size:</span>
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                        {Array.isArray(fdData[expandedFD].lhs) ? fdData[expandedFD].lhs.length : 1}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Minimality:</span>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">Verified</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                  <span className="font-medium text-gray-700">Interpretation:</span>
                  <p className="text-gray-600 mt-1">
                    {(fdData[expandedFD].confidence || 0) > 0.98
                      ? 'This dependency is highly reliable and recommended for normalization. It shows a strong deterministic relationship between the left-hand side attributes and the right-hand side attribute.'
                      : (fdData[expandedFD].confidence || 0) > 0.90
                      ? 'This dependency has moderate confidence and may be useful for normalization. Consider reviewing the violations to understand data quality issues.'
                      : 'This dependency has low confidence and should be reviewed carefully. High violation count suggests potential data quality issues or complex relationships.'}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
