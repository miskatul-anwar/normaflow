import { Fragment, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, TrendingUp, TrendingDown, BarChart3, ArrowRight, ChevronRight, ChevronDown, Info, Search, X } from 'lucide-react';
import { FunctionalDependency } from '../../types';
import { Button } from '@/components/ui/button';

/** The analysis for one dependency; rendered directly under the row it belongs to. */
function DependencyAnalysis({ fd }: { fd: FunctionalDependency }) {
  return (
      <div className="p-6">
        <h6 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Info className="w-4 h-4" /> Dependency Analysis
        </h6>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Unique Groups:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                {fd.uniqueGroups || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Violations:</span>
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                {fd.violations || 0}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">LHS Size:</span>
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                {Array.isArray(fd.lhs) ? fd.lhs.length : 1}
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
            {(fd.confidence || 0) > 0.98
              ? 'This dependency is highly reliable and recommended for normalization. It shows a strong deterministic relationship between the left-hand side attributes and the right-hand side attribute.'
              : (fd.confidence || 0) > 0.90
              ? 'This dependency has moderate confidence and may be useful for normalization. Consider reviewing the violations to understand data quality issues.'
              : 'This dependency has low confidence and should be reviewed carefully. High violation count suggests potential data quality issues or complex relationships.'}
          </p>
        </div>
      </div>
  );
}

type Quality = 'all' | 'high' | 'medium' | 'low';
const PAGE = 50;
const level = (c: number | undefined): Exclude<Quality, 'all'> => ((c || 0) > 0.98 ? 'high' : (c || 0) > 0.9 ? 'medium' : 'low');

/** `fdData` entries may carry the `table` they were mined from (multi-table runs). */
export function FunctionalDependenciesSection({ fdData }: { fdData: Array<FunctionalDependency & { table?: string }> }) {
  const [expandedFD, setExpandedFD] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [quality, setQuality] = useState<Quality>('all');
  const [shown, setShown] = useState(PAGE);

  const hasTables = fdData.some(f => f.table);
  // Keep the original index so an open analysis stays attached to its row while filtering.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fdData
      .map((fd, index) => ({ fd, index }))
      .filter(({ fd }) => {
        if (quality !== 'all' && level(fd.confidence) !== quality) return false;
        if (!q) return true;
        const text = `${Array.isArray(fd.lhs) ? fd.lhs.join(' ') : fd.lhs} ${fd.rhs} ${fd.table ?? ''}`.toLowerCase();
        return text.includes(q);
      });
  }, [fdData, query, quality]);
  const visible = filtered.slice(0, shown);

  if (!fdData || fdData.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p>No functional dependencies discovered</p>
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
            <div className="text-2xl font-bold text-green-600">
              {highConfFDs.length}
            </div>
          </div>
          <div className="text-sm text-green-700">
            High Confidence ({'>'}98%)
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-yellow-600" />
            <div className="text-2xl font-bold text-yellow-600">
              {mediumConfFDs.length}
            </div>
          </div>
          <div className="text-sm text-yellow-700">
            Medium Confidence (90-98%)
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <div className="text-2xl font-bold text-red-600">
              {lowConfFDs.length}
            </div>
          </div>
          <div className="text-sm text-red-700">
            Low Confidence ({'<'}90%)
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h5 className="text-sm font-semibold text-gray-900">
            Discovered dependencies{' '}
            <span className="font-normal text-gray-500">
              {filtered.length === fdData.length ? fdData.length : `${filtered.length} of ${fdData.length}`}
            </span>
          </h5>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="Filter by confidence">
              {(['all', 'high', 'medium', 'low'] as const).map(q => (
                <button
                  key={q}
                  type="button"
                  aria-pressed={quality === q}
                  onClick={() => {
                    setQuality(q);
                    setShown(PAGE);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    quality === q ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Search dependencies</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setShown(PAGE);
                }}
                placeholder="Search columns…"
                className="h-8 w-56 rounded-lg border border-gray-200 bg-white pl-8 pr-7 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700">
                  <X className="size-3.5" />
                </button>
              )}
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-50">
              <tr>
                {hasTables && <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dependency</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coverage</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quality</th>
                <th className="w-px px-4 py-2.5"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visible.map(({ fd, index }) => {
                const lhsStr = Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs || 'Unknown';
                const rhsStr = fd.rhs || 'Unknown';
                const confidence = ((fd.confidence || 0) * 100).toFixed(2);
                const coverage = ((fd.coverage || 0) * 100).toFixed(2);
                const qualityLevel = (fd.confidence || 0) > 0.98 ? 'High' : (fd.confidence || 0) > 0.90 ? 'Medium' : 'Low';
                const qualityColor = (fd.confidence || 0) > 0.98 ? 'text-green-600 bg-green-100' : (fd.confidence || 0) > 0.90 ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100';

                return (
                  <Fragment key={index}>
                  <tr className={`transition-colors ${expandedFD === index ? 'bg-teal-50/40' : 'hover:bg-gray-50'}`}>
                    {hasTables && <td className="px-4 py-2.5 text-sm text-gray-500">{fd.table}</td>}
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-gray-900">
                        <span className="font-mono">{lhsStr}</span>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                        <span className="font-mono">{rhsStr}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-gray-900">{confidence}%</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-gray-900">{coverage}%</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${qualityColor}`}>
                        {qualityLevel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-500">
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
                  <AnimatePresence initial={false}>
                    {expandedFD === index && (
                      <tr>
                        <td colSpan={hasTables ? 6 : 5} className="p-0">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden border-y border-gray-200 bg-gray-50"
                          >
                            <DependencyAnalysis fd={fd} />
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-gray-500">No dependencies match “{query}”{quality !== 'all' ? ` at ${quality} confidence` : ''}.</p>
        )}
        {filtered.length > visible.length && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-3 text-sm text-gray-600">
            <span>Showing {visible.length} of {filtered.length}</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShown(n => n + PAGE)}>Show {Math.min(PAGE, filtered.length - visible.length)} more</Button>
              <Button size="sm" variant="ghost" onClick={() => setShown(filtered.length)}>Show all</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
