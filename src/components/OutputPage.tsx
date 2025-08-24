import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';
import '@xyflow/react/dist/style.css';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import {
    CheckCircle, AlertCircle, ArrowLeft, Copy, Download, Layers, GitBranch,
    Image, Code, Activity, Workflow, Key, Database, FileText,
    ChevronRight, ChevronDown, ChevronUp, Table, BarChart3, Shield,
    Target, Zap, TrendingUp, Lock, Unlock, ExternalLink,
    Hash, ArrowRight, TrendingDown, Info, Clock, FolderOpen,
    Files, Folder, Settings
} from 'lucide-react';

// Initialize Mermaid
mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'CMU Serif Roman',
    fontSize: 14
});

// Custom Sidebar Component
interface SidebarItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    count?: number;
    hasData?: boolean;
}

interface CustomSidebarProps {
    items: SidebarItem[];
    activeTab: string;
    onTabChange: (tab: string) => void;
}

function CustomSidebar({ items, activeTab, onTabChange }: CustomSidebarProps) {
    return (
        <div className="bg-white border-r border-gray-200 h-full overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                    Analysis Results
                </h3>
                <p className="text-sm text-gray-500 mt-1" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                    Navigate through normalization outputs
                </p>
            </div>
            <div className="p-2">
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        disabled={!item.hasData}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${activeTab === item.id
                            ? 'bg-teal-50 text-teal-700 border border-teal-200 shadow-sm'
                            : item.hasData
                                ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                : 'text-gray-400 cursor-not-allowed opacity-50'
                            }`}
                        style={{ fontFamily: "'CMU Serif Roman', serif" }}
                    >
                        <span className={`${activeTab === item.id ? 'text-teal-600' : item.hasData ? 'text-gray-400' : 'text-gray-300'}`}>
                            {item.icon}
                        </span>
                        <span className="flex-1 font-medium">{item.label}</span>
                        {item.count !== undefined && (
                            <span className={`text-xs px-2 py-1 rounded-full ${activeTab === item.id
                                ? 'bg-teal-100 text-teal-700'
                                : item.hasData
                                    ? 'bg-gray-100 text-gray-600'
                                    : 'bg-gray-50 text-gray-400'
                                }`}>
                                {item.count}
                            </span>
                        )}
                        {!item.hasData && (
                            <span className="text-xs text-gray-400">No data</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

// FIXED: Enhanced Functional Dependencies Component (NO SVG, Working View Button)
function FunctionalDependenciesSection({ fdData }: { fdData: any[] }) {
    const [expandedFD, setExpandedFD] = useState<number | null>(null);

    if (!fdData || fdData.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No functional dependencies discovered</p>
                <p className="text-sm text-gray-400 mt-2">This could indicate data is already normalized or lacks patterns</p>
            </div>
        );
    }

    // Group FDs by confidence level
    const highConfFDs = fdData.filter(fd => (fd.confidence || 0) > 0.98);
    const mediumConfFDs = fdData.filter(fd => (fd.confidence || 0) > 0.90 && (fd.confidence || 0) <= 0.98);
    const lowConfFDs = fdData.filter(fd => (fd.confidence || 0) <= 0.90);

    return (
        <div className="space-y-6">
            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <div className="text-2xl font-bold text-green-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                            {highConfFDs.length}
                        </div>
                    </div>
                    <div className="text-sm text-green-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                        High Confidence ({'>'}98%)
                    </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <BarChart3 className="w-5 h-5 text-yellow-600" />
                        <div className="text-2xl font-bold text-yellow-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                            {mediumConfFDs.length}
                        </div>
                    </div>
                    <div className="text-sm text-yellow-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                        Medium Confidence (90-98%)
                    </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                        <div className="text-2xl font-bold text-red-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                            {lowConfFDs.length}
                        </div>
                    </div>
                    <div className="text-sm text-red-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                        Low Confidence ({'<'}90%)
                    </div>
                </div>
            </div>

            {/* Detailed FD Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h5 className="font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                        Discovered Dependencies ({fdData.length})
                    </h5>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Dependency
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Confidence
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Coverage
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Quality
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Details
                                </th>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {confidence}%
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {coverage}%
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${qualityColor}`}>
                                                {qualityLevel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <button
                                                onClick={() => setExpandedFD(expandedFD === index ? null : index)}
                                                className="text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
                                            >
                                                {expandedFD === index ? (
                                                    <>
                                                        <ChevronDown className="w-4 h-4" />
                                                        Hide
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronRight className="w-4 h-4" />
                                                        View
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* FIXED: Expanded Details */}
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
                                    <Info className="w-4 h-4" />
                                    Dependency Analysis
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
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                                Verified
                                            </span>
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
                                                : 'This dependency has low confidence and should be reviewed carefully. High violation count suggests potential data quality issues or complex relationships.'
                                        }
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

// FIXED: Updated Normal Forms Section to show 1NF, 2NF, 3NF
function NormalFormSection({ relations1NF, relations2NF, relations3NF }: { relations1NF?: any[]; relations2NF?: any[]; relations3NF?: any[] }) {
    const [activeNF, setActiveNF] = useState<'1nf' | '2nf' | '3nf'>('1nf');

    // Check what data we have
    const has1NF = relations1NF && relations1NF.length > 0;
    const has2NF = relations2NF && relations2NF.length > 0;
    const has3NF = relations3NF && relations3NF.length > 0;

    // Set default active tab to first available
    useEffect(() => {
        if (has1NF) setActiveNF('1nf');
        else if (has2NF) setActiveNF('2nf');
        else if (has3NF) setActiveNF('3nf');
    }, [has1NF, has2NF, has3NF]);

    if (!has1NF && !has2NF && !has3NF) {
        return (
            <div className="text-center py-12 text-gray-500">
                <Table className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No normalized relations generated</p>
                <p className="text-sm text-gray-400 mt-2">Relations are created during normalization process</p>
            </div>
        );
    }

    const getActiveRelations = () => {
        switch (activeNF) {
            case '1nf': return relations1NF || [];
            case '2nf': return relations2NF || [];
            case '3nf': return relations3NF || [];
            default: return [];
        }
    };

    const activeRelations = getActiveRelations();

    return (
        <div className="space-y-6">
            {/* NF Selection Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        <button
                            onClick={() => setActiveNF('1nf')}
                            disabled={!has1NF}
                            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeNF === '1nf'
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
                            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeNF === '2nf'
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
                            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeNF === '3nf'
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
                    </nav>
                </div>

                {/* Relations Content */}
                <div className="p-6">
                    {activeRelations && activeRelations.length > 0 ? (
                        <div className="space-y-4">
                            {activeRelations.map((relation, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
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

                                    {/* Attributes */}
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
                                                        className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${isPK
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

                                    {/* Primary Key */}
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

                                    {/* Foreign Keys */}
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

                                    {/* Original FD */}
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

// FIXED: Cardinality Analysis Section with proper relationship types and confidence
function CardinalitySection({ cardinalityAnalysis }: { cardinalityAnalysis?: any }) {
    if (!cardinalityAnalysis || Object.keys(cardinalityAnalysis).length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No cardinality analysis available</p>
                <p className="text-sm text-gray-400 mt-2">Cardinality analysis requires the Cardinality Analyzer operation</p>
            </div>
        );
    }

    const cardinalityEntries = Object.entries(cardinalityAnalysis);

    // Helper function to determine relationship type from cardinality data
    const getRelationshipType = (analysis: any) => {
        if (!analysis) return "Unknown";

        const uniqueRatio = analysis.uniqueValues && analysis.totalValues ?
            analysis.uniqueValues / analysis.totalValues : analysis.cardinality || 0;

        if (uniqueRatio > 0.95) {
            return "One-to-One (1:1)";
        } else if (uniqueRatio > 0.3) {
            return "One-to-Many (1:N)";
        } else {
            return "Many-to-Many (M:N)";
        }
    };

    // Helper function to calculate confidence
    const getConfidence = (analysis: any) => {
        if (!analysis) return '0.0%';

        if (analysis.confidence) {
            return (analysis.confidence * 100).toFixed(1) + '%';
        }

        // Calculate confidence based on data quality indicators
        const uniqueRatio = analysis.uniqueValues && analysis.totalValues ?
            analysis.uniqueValues / analysis.totalValues : analysis.cardinality || 0;

        const duplicateRatio = analysis.duplicateRatio || 0;
        const confidence = Math.max(0, Math.min(1, uniqueRatio * (1 - duplicateRatio) * 0.9 + 0.1));

        return (confidence * 100).toFixed(1) + '%';
    };

    // FIXED: Helper function to get numeric confidence for filtering
    const getNumericConfidence = (analysis: any) => {
        if (!analysis) return 0;

        if (analysis.confidence) {
            return analysis.confidence * 100;
        }

        // Calculate confidence based on data quality indicators
        const uniqueRatio = analysis.uniqueValues && analysis.totalValues ?
            analysis.uniqueValues / analysis.totalValues : analysis.cardinality || 0;

        const duplicateRatio = analysis.duplicateRatio || 0;
        const confidence = Math.max(0, Math.min(1, uniqueRatio * (1 - duplicateRatio) * 0.9 + 0.1));

        return confidence * 100;
    };

    // FIXED: Helper function to get uniqueness ratio for key candidate detection
    const getUniquenessRatio = (analysis: any) => {
        if (!analysis) return 0;

        if (analysis.uniqueValues && analysis.totalValues) {
            return analysis.uniqueValues / analysis.totalValues;
        }

        return analysis.cardinality || 0;
    };

    return (
        <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                    <BarChart3 className="w-5 h-5" />
                    Attribute Cardinality Analysis
                </h4>
                <p className="text-gray-600 mb-4" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                    Analysis of attribute value distributions and relationships to determine optimal cardinality mappings.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Attribute
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Total Values
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Unique Values
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Relationship Type
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Confidence
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Data Type
                                </th>
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {analysis.totalValues || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div className="flex items-center gap-2">
                                            <span>{analysis.uniqueValues || 'N/A'}</span>
                                            {analysis.cardinality && (
                                                <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500"
                                                        style={{ width: `${Math.min(100, (analysis.cardinality || 0) * 100)}%` }}
                                                    />
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

            {/* Cardinality Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <div className="text-2xl font-bold text-green-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                            {cardinalityEntries.filter(([, analysis]: [string, any]) => {
                                const ratio = getUniquenessRatio(analysis);
                                return ratio > 0.9;
                            }).length}
                        </div>
                    </div>
                    <div className="text-sm text-green-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                        High Uniqueness ({'>'}90%)
                    </div>
                    <div className="text-xs text-green-600 mt-1">One-to-One relationships</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <BarChart3 className="w-5 h-5 text-yellow-600" />
                        <div className="text-2xl font-bold text-yellow-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                            {cardinalityEntries.filter(([, analysis]: [string, any]) => {
                                const ratio = getUniquenessRatio(analysis);
                                return ratio > 0.3 && ratio <= 0.9;
                            }).length}
                        </div>
                    </div>
                    <div className="text-sm text-yellow-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                        Medium Uniqueness (30-90%)
                    </div>
                    <div className="text-xs text-yellow-600 mt-1">One-to-Many relationships</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <TrendingDown className="w-5 h-5 text-red-600" />
                        <div className="text-2xl font-bold text-red-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                            {cardinalityEntries.filter(([, analysis]: [string, any]) => {
                                const ratio = getUniquenessRatio(analysis);
                                return ratio <= 0.3;
                            }).length}
                        </div>
                    </div>
                    <div className="text-sm text-red-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                        Low Uniqueness (≤30%)
                    </div>
                    <div className="text-xs text-red-600 mt-1">Many-to-Many relationships</div>
                </div>
            </div>

            {/* FIXED: Relationship Insights with proper data filtering */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h5 className="font-semibold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
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
                                    return (
                                        <div className="bg-gray-50 px-2 py-1 rounded text-gray-500 text-xs">
                                            No attributes with confidence {'>'} 70%
                                        </div>
                                    );
                                }

                                return highConfidenceAttrs.map(([attr, analysis]: [string, any]) => (
                                    <div key={attr} className="bg-green-50 px-2 py-1 rounded text-green-700 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">{attr}</span>
                                            <span className="text-green-600">{getConfidence(analysis)}</span>
                                        </div>
                                        <div className="text-green-600 text-xs">
                                            {analysis.uniqueValues || 'N/A'} unique of {analysis.totalValues || 'N/A'} total
                                        </div>
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
                                    .filter(([, analysis]: [string, any]) => {
                                        const ratio = getUniquenessRatio(analysis);
                                        return ratio > 0.8; // Lowered threshold to be more inclusive
                                    })
                                    .slice(0, 5);

                                if (keyCandidates.length === 0) {
                                    return (
                                        <div className="bg-gray-50 px-2 py-1 rounded text-gray-500 text-xs">
                                            No attributes with uniqueness {'>'} 80%
                                        </div>
                                    );
                                }

                                return keyCandidates.map(([attr, analysis]: [string, any]) => (
                                    <div key={attr} className="bg-yellow-50 px-2 py-1 rounded text-yellow-700 text-xs">
                                        <div className="flex items-center gap-1">
                                            <Key className="w-3 h-3" />
                                            <span className="font-medium">{attr}</span>
                                            <span className="text-yellow-600">
                                                ({(getUniquenessRatio(analysis) * 100).toFixed(1)}% unique)
                                            </span>
                                        </div>
                                        <div className="text-yellow-600 text-xs">
                                            {getRelationshipType(analysis)}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>

                {/* FIXED: Additional insights based on actual data patterns */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <h6 className="font-medium text-gray-700 mb-2">Data Distribution Insights:</h6>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="bg-blue-50 px-3 py-2 rounded">
                            <div className="font-medium text-blue-800">Total Attributes Analyzed</div>
                            <div className="text-blue-600 text-lg font-bold">{cardinalityEntries.length}</div>
                        </div>
                        <div className="bg-purple-50 px-3 py-2 rounded">
                            <div className="font-medium text-purple-800">Avg Uniqueness Ratio</div>
                            <div className="text-purple-600 text-lg font-bold">
                                {cardinalityEntries.length > 0 ?
                                    (cardinalityEntries.reduce((sum, [, analysis]) =>
                                        sum + getUniquenessRatio(analysis), 0) / cardinalityEntries.length * 100).toFixed(1)
                                    : '0'
                                }%
                            </div>
                        </div>
                        <div className="bg-indigo-50 px-3 py-2 rounded">
                            <div className="font-medium text-indigo-800">Data Types Found</div>
                            <div className="text-indigo-600 text-lg font-bold">
                                {new Set(cardinalityEntries.map(([, analysis]) => (analysis as any).dataType || 'string')).size}
                            </div>
                        </div>
                    </div>
                </div>

                {/* FIXED: Recommendations based on actual analysis */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <h6 className="font-medium text-gray-700 mb-2">Recommendations:</h6>
                    <div className="space-y-1 text-xs">
                        {(() => {
                            const recommendations = [];
                            const highUniqueCount = cardinalityEntries.filter(([, analysis]) => getUniquenessRatio(analysis) > 0.9).length;
                            const lowUniqueCount = cardinalityEntries.filter(([, analysis]) => getUniquenessRatio(analysis) < 0.1).length;

                            if (highUniqueCount > 0) {
                                recommendations.push(
                                    <div key="unique" className="text-green-700">
                                        • {highUniqueCount} attribute(s) show high uniqueness - consider as primary key candidates
                                    </div>
                                );
                            }

                            if (lowUniqueCount > 0) {
                                recommendations.push(
                                    <div key="duplicate" className="text-orange-700">
                                        • {lowUniqueCount} attribute(s) have low uniqueness - may indicate categorical data or normalization opportunities
                                    </div>
                                );
                            }

                            const avgConfidence = cardinalityEntries.reduce((sum, [, analysis]) =>
                                sum + getNumericConfidence(analysis), 0) / cardinalityEntries.length;

                            if (avgConfidence > 80) {
                                recommendations.push(
                                    <div key="quality" className="text-blue-700">
                                        • High overall data quality detected - analysis results are reliable
                                    </div>
                                );
                            } else if (avgConfidence < 50) {
                                recommendations.push(
                                    <div key="clean" className="text-red-700">
                                        • Consider data cleaning to improve analysis confidence
                                    </div>
                                );
                            }

                            return recommendations.length > 0 ? recommendations : (
                                <div className="text-gray-500">No specific recommendations based on current data patterns</div>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}

// FIXED: Quality Assurance Section with proper dependency preservation showing ALL dependencies
// FIXED: Quality Assurance Section with proper dependency preservation showing ALL dependencies in responsive columns
function QualityAssuranceSection({ losslessCheck, dependencyPreservation }: { losslessCheck?: any; dependencyPreservation?: any }) {
    const [showAllPreserved, setShowAllPreserved] = useState(false);
    const [showAllLost, setShowAllLost] = useState(false);

    if (!losslessCheck && !dependencyPreservation) {
        return (
            <div className="text-center py-12 text-gray-500">
                <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No quality assurance data available</p>
                <p className="text-sm text-gray-400 mt-2">Quality checks require Lossless Check and Dependency Preservation operations</p>
            </div>
        );
    }

    // Helper function to determine if we should use columns
    const useColumns = (count: number) => count > 8;

    // Helper function to split array into two columns
    const splitIntoColumns = (items: any[]) => {
        const midpoint = Math.ceil(items.length / 2);
        return [items.slice(0, midpoint), items.slice(midpoint)];
    };

    return (
        <div className="space-y-6">
            {/* Lossless Join Check */}
            {losslessCheck && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${losslessCheck.isLossless ? 'bg-green-100' : 'bg-red-100'}`}>
                            {losslessCheck.isLossless ? (
                                <Unlock className="w-5 h-5 text-green-600" />
                            ) : (
                                <Lock className="w-5 h-5 text-red-600" />
                            )}
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                Lossless Join Property
                            </h4>
                            <p className="text-sm text-gray-600">Decomposition preserves all original information</p>
                        </div>
                        <div className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${losslessCheck.isLossless
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {losslessCheck.isLossless ? 'LOSSLESS' : 'LOSSY'}
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                            The decomposition is <strong>{losslessCheck.isLossless ? 'lossless' : 'lossy'}</strong>.
                            This means that joining the decomposed relations {losslessCheck.isLossless ? 'will' : 'will NOT'}
                            produce the original relation without any loss or addition of information.
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

            {/* FIXED: Dependency Preservation Check - Show ALL dependencies in responsive columns */}
            {dependencyPreservation && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${dependencyPreservation.isPreserved ? 'bg-green-100' : 'bg-red-100'}`}>
                            <Zap className={`w-5 h-5 ${dependencyPreservation.isPreserved ? 'text-green-600' : 'text-red-600'}`} />
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                Dependency Preservation
                            </h4>
                            <p className="text-sm text-gray-600">Functional dependencies maintained in decomposition</p>
                        </div>
                        <div className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${dependencyPreservation.isPreserved
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {dependencyPreservation.isPreserved ? 'PRESERVED' : 'NOT PRESERVED'}
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 mb-3">
                            {dependencyPreservation.isPreserved
                                ? 'All functional dependencies are preserved in the decomposition. This ensures that all integrity constraints can be enforced without joins.'
                                : 'Some functional dependencies are lost in the decomposition. This may require joins to enforce certain integrity constraints.'
                            }
                        </p>

                        {/* Summary Statistics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                    <CheckCircle className="w-6 h-6" />
                                    {dependencyPreservation.preserved?.length || 0}
                                </div>
                                <div className="text-sm text-green-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                    Preserved Dependencies
                                </div>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                    <AlertCircle className="w-6 h-6" />
                                    {dependencyPreservation.lost?.length || 0}
                                </div>
                                <div className="text-sm text-red-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                    Lost Dependencies
                                </div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                    <BarChart3 className="w-6 h-6" />
                                    {((dependencyPreservation.preserved?.length || 0) /
                                        ((dependencyPreservation.preserved?.length || 0) + (dependencyPreservation.lost?.length || 0)) * 100).toFixed(1)}%
                                </div>
                                <div className="text-sm text-blue-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                    Preservation Rate
                                </div>
                            </div>
                        </div>

                        {/* FIXED: Dependencies Display with Responsive Columns */}
                        <div className="space-y-6">
                            {/* FIXED: Preserved Dependencies - Responsive Columns */}
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
                                                {showAllPreserved ? (
                                                    <>
                                                        <ChevronUp className="w-3 h-3" />
                                                        Show Less
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="w-3 h-3" />
                                                        Show All
                                                    </>
                                                )}
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
                                                    {/* Left Column */}
                                                    <div className="space-y-1">
                                                        {leftColumn.map((fd: any, index: number) => (
                                                            <div key={index} className="text-xs font-mono bg-green-50 px-3 py-2 rounded border border-green-200 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-green-800 font-medium">
                                                                        {Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}
                                                                    </span>
                                                                    <ArrowRight className="w-3 h-3 text-green-600" />
                                                                    <span className="text-green-800 font-medium">{fd.rhs}</span>
                                                                </div>
                                                                {fd.confidence && (
                                                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                                                                        {(fd.confidence * 100).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Right Column */}
                                                    <div className="space-y-1">
                                                        {rightColumn.map((fd: any, index: number) => (
                                                            <div key={index + leftColumn.length} className="text-xs font-mono bg-green-50 px-3 py-2 rounded border border-green-200 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-green-800 font-medium">
                                                                        {Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}
                                                                    </span>
                                                                    <ArrowRight className="w-3 h-3 text-green-600" />
                                                                    <span className="text-green-800 font-medium">{fd.rhs}</span>
                                                                </div>
                                                                {fd.confidence && (
                                                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                                                                        {(fd.confidence * 100).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            // Single column for fewer items
                                            return (
                                                <div className="space-y-1">
                                                    {displayItems.map((fd: any, index: number) => (
                                                        <div key={index} className="text-xs font-mono bg-green-50 px-3 py-2 rounded border border-green-200 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-green-800 font-medium">
                                                                    {Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}
                                                                </span>
                                                                <ArrowRight className="w-3 h-3 text-green-600" />
                                                                <span className="text-green-800 font-medium">{fd.rhs}</span>
                                                            </div>
                                                            {fd.confidence && (
                                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                                                                    {(fd.confidence * 100).toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                    })()}

                                    {!showAllPreserved && dependencyPreservation.preserved.length > 12 && (
                                        <div className="text-xs text-gray-500 text-center py-3 bg-gray-50 rounded border border-gray-200 mt-2">
                                            ... and {dependencyPreservation.preserved.length - 12} more preserved dependencies
                                            <button
                                                onClick={() => setShowAllPreserved(true)}
                                                className="ml-2 text-green-600 hover:text-green-700 underline font-medium"
                                            >
                                                Show all {dependencyPreservation.preserved.length} dependencies
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* FIXED: Lost Dependencies - Responsive Columns */}
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
                                                {showAllLost ? (
                                                    <>
                                                        <ChevronUp className="w-3 h-3" />
                                                        Show Less
                                                    </>
                                                ) : (
                                                    <>
                                                        <ChevronDown className="w-3 h-3" />
                                                        Show All
                                                    </>
                                                )}
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
                                                    {/* Left Column */}
                                                    <div className="space-y-1">
                                                        {leftColumn.map((fd: any, index: number) => (
                                                            <div key={index} className="text-xs font-mono bg-red-50 px-3 py-2 rounded border border-red-200 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-red-800 font-medium">
                                                                        {Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}
                                                                    </span>
                                                                    <ArrowRight className="w-3 h-3 text-red-600" />
                                                                    <span className="text-red-800 font-medium">{fd.rhs}</span>
                                                                </div>
                                                                {fd.confidence && (
                                                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                                                                        {(fd.confidence * 100).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Right Column */}
                                                    <div className="space-y-1">
                                                        {rightColumn.map((fd: any, index: number) => (
                                                            <div key={index + leftColumn.length} className="text-xs font-mono bg-red-50 px-3 py-2 rounded border border-red-200 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-red-800 font-medium">
                                                                        {Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}
                                                                    </span>
                                                                    <ArrowRight className="w-3 h-3 text-red-600" />
                                                                    <span className="text-red-800 font-medium">{fd.rhs}</span>
                                                                </div>
                                                                {fd.confidence && (
                                                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                                                                        {(fd.confidence * 100).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            // Single column for fewer items
                                            return (
                                                <div className="space-y-1">
                                                    {displayItems.map((fd: any, index: number) => (
                                                        <div key={index} className="text-xs font-mono bg-red-50 px-3 py-2 rounded border border-red-200 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-red-800 font-medium">
                                                                    {Array.isArray(fd.lhs) ? fd.lhs.join(', ') : fd.lhs}
                                                                </span>
                                                                <ArrowRight className="w-3 h-3 text-red-600" />
                                                                <span className="text-red-800 font-medium">{fd.rhs}</span>
                                                            </div>
                                                            {fd.confidence && (
                                                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                                                                    {(fd.confidence * 100).toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }
                                    })()}

                                    {!showAllLost && dependencyPreservation.lost.length > 12 && (
                                        <div className="text-xs text-gray-500 text-center py-3 bg-gray-50 rounded border border-gray-200 mt-2">
                                            ... and {dependencyPreservation.lost.length - 12} more lost dependencies
                                            <button
                                                onClick={() => setShowAllLost(true)}
                                                className="ml-2 text-red-600 hover:text-red-700 underline font-medium"
                                            >
                                                Show all {dependencyPreservation.lost.length} dependencies
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Detailed Analysis */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <h6 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Dependency Analysis
                            </h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">Total Original Dependencies:</span>
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                            {(dependencyPreservation.preserved?.length || 0) + (dependencyPreservation.lost?.length || 0)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">Successfully Preserved:</span>
                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                            {dependencyPreservation.preserved?.length || 0}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">Dependencies Lost:</span>
                                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                            {dependencyPreservation.lost?.length || 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-700">Preservation Quality:</span>
                                        <span className={`px-2 py-1 rounded text-xs ${((dependencyPreservation.preserved?.length || 0) /
                                            ((dependencyPreservation.preserved?.length || 0) + (dependencyPreservation.lost?.length || 0))) > 0.9
                                            ? 'bg-green-100 text-green-800'
                                            : ((dependencyPreservation.preserved?.length || 0) /
                                                ((dependencyPreservation.preserved?.length || 0) + (dependencyPreservation.lost?.length || 0))) > 0.7
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {((dependencyPreservation.preserved?.length || 0) /
                                                ((dependencyPreservation.preserved?.length || 0) + (dependencyPreservation.lost?.length || 0))) > 0.9
                                                ? 'Excellent'
                                                : ((dependencyPreservation.preserved?.length || 0) /
                                                    ((dependencyPreservation.preserved?.length || 0) + (dependencyPreservation.lost?.length || 0))) > 0.7
                                                    ? 'Good'
                                                    : 'Needs Review'
                                            }
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recommendations based on preservation rate */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <h6 className="font-medium text-gray-700 mb-2">Recommendations:</h6>
                            <div className="text-sm space-y-1">
                                {(() => {
                                    const preservationRate = (dependencyPreservation.preserved?.length || 0) /
                                        ((dependencyPreservation.preserved?.length || 0) + (dependencyPreservation.lost?.length || 0));

                                    if (preservationRate === 1) {
                                        return (
                                            <div className="text-green-700 flex items-start gap-2">
                                                <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
                                                <span>Perfect dependency preservation achieved. All integrity constraints can be enforced locally.</span>
                                            </div>
                                        );
                                    } else if (preservationRate > 0.9) {
                                        return (
                                            <div className="text-green-700 flex items-start gap-2">
                                                <CheckCircle className="w-4 h-4 mt-0.5 text-green-600" />
                                                <span>Excellent preservation rate. Minor dependency losses are acceptable for most applications.</span>
                                            </div>
                                        );
                                    } else if (preservationRate > 0.7) {
                                        return (
                                            <div className="text-yellow-700 flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-600" />
                                                <span>Good preservation rate. Review lost dependencies to ensure critical constraints are maintained.</span>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="text-red-700 flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 mt-0.5 text-red-600" />
                                                <span>Significant dependency loss detected. Consider alternative normalization strategies or implement additional constraints.</span>
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Keys Section (unchanged but enhanced)
function KeysSection({ keyData }: { keyData: any }) {
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
            {/* Key Statistics */}
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
                                        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${key.length === 1 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {key.length === 1 ? (
                                                <>
                                                    <Hash className="w-3 h-3" />
                                                    Simple
                                                </>
                                            ) : (
                                                <>
                                                    <GitBranch className="w-3 h-3" />
                                                    Composite
                                                </>
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
                                    <div key={index} className={`border rounded-lg p-2 ${isCandidate ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                                        }`}>
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
                                                    <Key className="w-3 h-3" />
                                                    Candidate
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
                                <div>Average Key Size: {
                                    (candidateKeys.reduce((sum: number, key: string[]) => sum + key.length, 0) / candidateKeys.length).toFixed(1)
                                }</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Key Recommendations */}
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

// NEW: Generated Files Section
function GeneratedFilesSection({ outputFiles }: { outputFiles: any[] }) {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [expandedFile, setExpandedFile] = useState<string | null>(null);

    if (!outputFiles || outputFiles.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <Files className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No output files generated</p>
                <p className="text-sm text-gray-400 mt-2">Files are created during the normalization process</p>
            </div>
        );
    }

    // Group files by category
    const categories = ['all', ...new Set(outputFiles.map(f => f.category))];
    const filteredFiles = selectedCategory === 'all'
        ? outputFiles
        : outputFiles.filter(f => f.category === selectedCategory);

    const downloadFile = (file: any) => {
        const content = typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2);
        const blob = new Blob([content], { type: getMimeType(file.type) });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getMimeType = (type: string) => {
        const mimeTypes: { [key: string]: string } = {
            'json': 'application/json',
            'csv': 'text/csv',
            'markdown': 'text/markdown',
            'sql': 'application/sql',
            'mermaid': 'text/plain',
            'svg': 'image/svg+xml'
        };
        return mimeTypes[type] || 'text/plain';
    };

    const getFileIcon = (type: string) => {
        switch (type) {
            case 'json': return <Code className="w-4 h-4" />;
            case 'csv': return <Table className="w-4 h-4" />;
            case 'markdown': return <FileText className="w-4 h-4" />;
            case 'sql': return <Database className="w-4 h-4" />;
            case 'mermaid': return <GitBranch className="w-4 h-4" />;
            case 'svg': return <Image className="w-4 h-4" />;
            default: return <FileText className="w-4 h-4" />;
        }
    };

    const formatFileSize = (size: number) => {
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-6">
            {/* Category Filter */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                    <FolderOpen className="w-5 h-5" />
                    Generated Files ({outputFiles.length})
                </h4>

                <div className="flex flex-wrap gap-2 mb-4">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedCategory === category
                                ? 'bg-teal-100 text-teal-700 border border-teal-300'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {category === 'all' ? 'All Files' : category}
                            <span className="ml-1 text-xs">
                                ({category === 'all' ? outputFiles.length : outputFiles.filter(f => f.category === category).length})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Files List */}
                <div className="space-y-3">
                    {filteredFiles.map((file, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="p-4 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 rounded-lg">
                                            {getFileIcon(file.type)}
                                        </div>
                                        <div>
                                            <h5 className="font-medium text-gray-900">{file.name}</h5>
                                            <p className="text-sm text-gray-500">{file.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right text-sm text-gray-500">
                                            <div>{file.type.toUpperCase()}</div>
                                            <div>{formatFileSize(file.size)}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setExpandedFile(expandedFile === file.name ? null : file.name)}
                                                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                                title="Preview"
                                            >
                                                {expandedFile === file.name ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => downloadFile(file)}
                                                className="p-2 bg-teal-100 text-teal-600 hover:bg-teal-200 rounded-lg transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* File Preview */}
                            <AnimatePresence>
                                {expandedFile === file.name && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border-t border-gray-200 bg-gray-50"
                                    >
                                        <div className="p-4">
                                            <div className="bg-gray-900 rounded-lg overflow-hidden">
                                                <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                                                    <span className="text-sm text-gray-300 font-mono">{file.name}</span>
                                                    <button
                                                        onClick={() => {
                                                            const content = typeof file.content === 'string' ? file.content : JSON.stringify(file.content, null, 2);
                                                            navigator.clipboard.writeText(content);
                                                        }}
                                                        className="text-gray-400 hover:text-gray-200 transition-colors"
                                                        title="Copy content"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="p-4 max-h-64 overflow-y-auto">
                                                    <pre className="text-sm text-gray-100 whitespace-pre-wrap">
                                                        {typeof file.content === 'string'
                                                            ? file.content.substring(0, 1000) + (file.content.length > 1000 ? '\n...\n[Content truncated - download for full content]' : '')
                                                            : JSON.stringify(file.content, null, 2).substring(0, 1000) + (JSON.stringify(file.content).length > 1000 ? '\n...\n[Content truncated - download for full content]' : '')
                                                        }
                                                    </pre>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Enhanced Markdown Renderer with better table support
function MarkdownRenderer({ content, filename }: { content: string; filename?: string }) {
    const downloadMarkdown = () => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'document.md';
        a.click();
        URL.revokeObjectURL(url);
    };

    // Improved content processing that preserves markdown structure
    const processedContent = useMemo(() => {
        if (!content) return '';

        // Only remove emoji patterns, preserve all markdown formatting
        return content
            .replace(/[🔑🔗✅❌📊🎯⚡📈📉🔧🛠️⭐🎉🚀]/g, '')
            .replace(/\s{3,}/g, '  ') // Preserve double spaces for markdown line breaks
            .trim();
    }, [content]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filename && (
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <h5 className="font-semibold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                        <FileText className="w-5 h-5" />
                        {filename}
                    </h5>
                    <button
                        onClick={downloadMarkdown}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Download
                    </button>
                </div>
            )}
            <div className="p-6">
                <div className="markdown-body prose prose-slate max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                            // Custom components to ensure proper rendering
                            table: ({ children, ...props }) => (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200" {...props}>
                                        {children}
                                    </table>
                                </div>
                            ),
                            th: ({ children, ...props }) => (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" {...props}>
                                    {children}
                                </th>
                            ),
                            td: ({ children, ...props }) => (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" {...props}>
                                    {children}
                                </td>
                            )
                        }}
                    >
                        {processedContent}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}

function SVGPreviewSection({ erdContent }: { erdContent: string }) {
    const [svgContent, setSvgContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (erdContent) {
            generateSVGFromMermaid(erdContent);
        }
    }, [erdContent]);

    const generateSVGFromMermaid = async (content: string) => {
        try {
            setIsLoading(true);
            setError('');
            const { svg } = await mermaid.render('erd-preview', content);
            setSvgContent(svg);
            setIsLoading(false);
        } catch (err) {
            console.error('SVG generation error:', err);
            setError('Failed to generate SVG preview');
            setIsLoading(false);
        }
    };

    const downloadSVG = () => {
        if (svgContent) {
            const blob = new Blob([svgContent], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'database_erd.svg';
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const copyToClipboard = () => {
        if (erdContent) {
            navigator.clipboard.writeText(erdContent);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                        Entity Relationship Diagram
                    </h4>
                </div>
                <div className="p-8 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
                        <p className="text-gray-500">Generating SVG preview...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-pink-50 px-6 py-4 border-b border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                        ERD Preview - Error
                    </h4>
                </div>
                <div className="p-6">
                    <div className="flex items-center gap-3 text-red-600 mb-4">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <pre className="text-sm text-gray-600 whitespace-pre-wrap">{erdContent}</pre>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-900" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                        Entity Relationship Diagram
                    </h4>
                    <div className="flex gap-2">
                        <button
                            onClick={copyToClipboard}
                            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors"
                        >
                            <Copy className="w-4 h-4" />
                            Copy Code
                        </button>
                        <button
                            onClick={downloadSVG}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download SVG
                        </button>
                    </div>
                </div>
            </div>
            <div className="p-6">
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <div
                        className="w-full min-h-[400px] flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: svgContent }}
                        style={{ maxHeight: '600px', overflow: 'auto' }}
                    />
                </div>
            </div>
        </div>
    );
}

export default function OutputPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { results, selectedOperations } = location.state || {};

    // Dynamic date and time
    const currentDateTime = useMemo(() => {
        const now = new Date();
        return {
            formatted: now.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }),
            utc: now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
        };
    }, []);

    const safeResults = useMemo(() => {
        if (!results || !results.success) return null;
        return results;
    }, [results]);

    const relationData = safeResults?.relations || [];
    const relations1NF = safeResults?.relations1NF || []; // NEW: 1NF data
    const relations2NF = safeResults?.relations2NF || [];
    const erdContent = safeResults?.erdContent || '';
    const cardinalityAnalysis = safeResults?.cardinalityAnalysis || {};
    const losslessCheck = safeResults?.losslessCheck || null;
    const dependencyPreservation = safeResults?.dependencyPreservation || null;

    const fdData = useMemo(() => {
        if (!safeResults?.outputFiles) return [];
        const fdFile = safeResults.outputFiles.find((f: any) => f.name.includes('functional_dependencies') && f.type === 'json');
        if (fdFile?.content && Array.isArray(fdFile.content)) {
            return fdFile.content;
        }
        return [];
    }, [safeResults]);

    const keyData = useMemo(() => {
        if (!safeResults?.outputFiles) return null;
        const keyFile = safeResults.outputFiles.find((f: any) => f.name.includes('keys_analysis') && f.type === 'json');
        return keyFile?.content || null;
    }, [safeResults]);

    const [activeTab, setActiveTab] = useState("overview");

    const sqlFile = safeResults?.outputFiles?.find((f: any) => f.type === "sql");
    const reportFile = safeResults?.outputFiles?.find((f: any) => f.name.includes("report"));
    const schemaFile = safeResults?.outputFiles?.find((f: any) => f.name.includes("relation_schemas"));

    const sidebarItems: SidebarItem[] = [
        {
            id: "overview",
            label: "Overview",
            icon: <Activity className="w-4 h-4" />,
            hasData: true
        },
        {
            id: "normal-forms",
            label: "Normal Forms",
            icon: <Layers className="w-4 h-4" />,
            count: (relations1NF.length || 0) + (relations2NF.length || 0) + (relationData.length || 0),
            hasData: relations1NF.length > 0 || relations2NF.length > 0 || relationData.length > 0
        },
        {
            id: "functional-dependencies",
            label: "Functional Dependencies",
            icon: <GitBranch className="w-4 h-4" />,
            count: fdData.length,
            hasData: fdData.length > 0
        },
        {
            id: "cardinality",
            label: "Cardinality Analysis",
            icon: <BarChart3 className="w-4 h-4" />,
            count: Object.keys(cardinalityAnalysis).length,
            hasData: Object.keys(cardinalityAnalysis).length > 0
        },
        {
            id: "keys",
            label: "Keys & Superkeys",
            icon: <Key className="w-4 h-4" />,
            count: (keyData?.candidateKeys?.length || 0) + (keyData?.superkeys?.length || 0),
            hasData: keyData && ((keyData.candidateKeys?.length > 0) || (keyData.superkeys?.length > 0))
        },
        {
            id: "quality-assurance",
            label: "Quality Assurance",
            icon: <Shield className="w-4 h-4" />,
            hasData: !!losslessCheck || !!dependencyPreservation
        },
        {
            id: "erd",
            label: "ERD",
            icon: <Image className="w-4 h-4" />,
            hasData: !!erdContent
        },
        {
            id: "sql-ddl",
            label: "SQL DDL",
            icon: <Code className="w-4 h-4" />,
            hasData: !!sqlFile
        },
        {
            id: "generated-files",
            label: "Generated Files",
            icon: <Folder className="w-4 h-4" />,
            count: safeResults?.outputFiles?.length || 0,
            hasData: (safeResults?.outputFiles?.length || 0) > 0
        },
        {
            id: "report",
            label: "Process Report",
            icon: <Workflow className="w-4 h-4" />,
            hasData: !!reportFile
        }
    ];

    if (!safeResults) {
        return (
            <div className="normaflow-app">
                <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white p-10 rounded-2xl shadow-2xl max-w-md text-center border border-slate-200"
                    >
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-4" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                            No Results Found
                        </h2>
                        <p className="text-slate-600 mb-8 text-lg" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                            Please run the normalization process first to see results.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="bg-gradient-to-r from-cyan-500 to-teal-600 text-white px-8 py-4 rounded-xl hover:from-cyan-600 hover:to-teal-700 transition-all duration-300 font-medium text-lg shadow-lg"
                            style={{ fontFamily: "'CMU Serif Bold', serif" }}
                        >
                            <ArrowLeft className="w-5 h-5 inline mr-3" />
                            Go Back to Flow
                        </button>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="normaflow-app">
            <div className="normaflow-output-grid">
                {/* Header */}
                <header className="normaflow-output-header">
                    <div className="flex items-center justify-between p-4 bg-gray-100 text-gray-800 w-full border-b-2 border-gray-300">
                        <div className="flex items-center gap-6">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate('/')}
                                className="flex items-center gap-2 px-3 py-1 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded transition text-sm drop-shadow-sm"
                                style={{ fontFamily: "'CMU Serif Bold', serif" }}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Flow
                            </motion.button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                    NormaFlow Analysis Results
                                </h1>
                                <p className="text-sm text-gray-500" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                    Database Normalization Analysis Complete
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <div className="text-sm text-gray-500 flex items-center gap-1" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                    <Clock className="w-3 h-3" />
                                    Completed
                                </div>
                                <div className="font-bold text-gray-800" style={{ fontFamily: "'CMU Typewriter Text', monospace" }}>
                                    {currentDateTime.utc}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                    <Settings className="w-3 h-3" />
                                    Duration: {safeResults.duration}
                                </div>
                            </div>
                            <div className="px-3 py-1 rounded bg-gray-200 text-green-700 font-bold text-sm drop-shadow-sm hover:bg-gray-100 transition flex items-center gap-2"
                                style={{ fontFamily: "'CMU Serif Bold', serif" }}
                            >
                                <CheckCircle className="w-4 h-4" />
                                SUCCESS
                            </div>
                        </div>
                    </div>
                </header>

                {/* Custom Sidebar */}
                <aside className="normaflow-output-sidebar">
                    <CustomSidebar
                        items={sidebarItems}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                </aside>

                {/* Main Content */}
                <main className="normaflow-output-main">
                    <div className="h-full overflow-auto">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="h-full bg-gradient-to-br from-slate-50 to-white"
                            >
                                {activeTab === "overview" && (
                                    <section className="p-8 space-y-8">
                                        <div className="bg-gradient-to-br from-cyan-50 via-teal-50 to-slate-50 rounded-2xl p-8 border border-cyan-200">
                                            <div className="flex items-center justify-between mb-6">
                                                <div>
                                                    <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent mb-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                        Analysis Complete
                                                    </h2>
                                                    <p className="text-xl text-slate-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>Comprehensive Database Normalization Results</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm text-slate-500 flex items-center gap-1" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                        <Settings className="w-4 h-4" />
                                                        Generated by
                                                    </div>
                                                    <div className="text-lg font-bold text-slate-700" style={{ fontFamily: "'CMU Serif Bold', serif" }}>NormEngine</div>
                                                    <div className="text-sm text-slate-500" style={{ fontFamily: "'CMU Typewriter Text', monospace" }}>{currentDateTime.formatted}</div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20 text-center shadow-sm">
                                                    <div className="text-3xl font-bold text-cyan-600 flex items-center justify-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                        <Key className="w-8 h-8" />
                                                        {safeResults.stats?.candidateKeys || 0}
                                                    </div>
                                                    <div className="text-sm font-medium text-slate-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                        Candidate Keys
                                                    </div>
                                                </div>
                                                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20 text-center shadow-sm">
                                                    <div className="text-3xl font-bold text-teal-600 flex items-center justify-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                        <Database className="w-8 h-8" />
                                                        {safeResults.stats?.relations3NF || 0}
                                                    </div>
                                                    <div className="text-sm font-medium text-slate-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                        3NF Relations
                                                    </div>
                                                </div>
                                                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20 text-center shadow-sm">
                                                    <div className="text-3xl font-bold text-purple-600 flex items-center justify-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                        <GitBranch className="w-8 h-8" />
                                                        {safeResults.stats?.functionalDependencies || 0}
                                                    </div>
                                                    <div className="text-sm font-medium text-slate-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                        Functional Dependencies
                                                    </div>
                                                </div>
                                                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl border border-white/20 text-center shadow-sm">
                                                    <div className="text-3xl font-bold text-orange-600 flex items-center justify-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                        <Activity className="w-8 h-8" />
                                                        {selectedOperations?.length || 0}
                                                    </div>
                                                    <div className="text-sm font-medium text-slate-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                        Operations Completed
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                                            <h3 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <Workflow className="w-7 h-7 text-cyan-600" />
                                                Process Summary
                                            </h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                <div>
                                                    <h4 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                        <Clock className="w-5 h-5" />
                                                        Operations Timeline
                                                    </h4>
                                                    <div className="space-y-3">
                                                        {selectedOperations?.map((operation: string, index: number) => (
                                                            <div key={operation + index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                                                                <div className="w-8 h-8 bg-cyan-600 text-white rounded-full flex items-center justify-center text-sm font-bold" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                                    {index + 1}
                                                                </div>
                                                                <span className="font-medium text-slate-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>{operation}</span>
                                                                <div className="ml-auto flex items-center gap-2">
                                                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                                                    <span className="text-sm text-green-600 font-medium" style={{ fontFamily: "'CMU Serif Bold', serif" }}>Completed</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                        <BarChart3 className="w-5 h-5" />
                                                        Data Quality Metrics
                                                    </h4>
                                                    <div className="space-y-4">
                                                        <div className="bg-gradient-to-r from-cyan-50 to-teal-50 p-4 rounded-lg border border-cyan-200">
                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div>
                                                                    <span className="font-medium text-slate-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>Original Rows:</span>
                                                                    <span className="ml-2 text-slate-800" style={{ fontFamily: "'CMU Typewriter Text', monospace" }}>{safeResults.stats?.originalRows || 'N/A'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-slate-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>Cleaned Rows:</span>
                                                                    <span className="ml-2 text-slate-800" style={{ fontFamily: "'CMU Typewriter Text', monospace" }}>{safeResults.stats?.cleanedRows || 'N/A'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-slate-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>Data Retention:</span>
                                                                    <span className="ml-2 text-slate-800" style={{ fontFamily: "'CMU Typewriter Text', monospace" }}>{safeResults.stats?.dataRetention || 'N/A'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-slate-600" style={{ fontFamily: "'CMU Serif Bold', serif" }}>Attributes:</span>
                                                                    <span className="ml-2 text-slate-800" style={{ fontFamily: "'CMU Typewriter Text', monospace" }}>{safeResults.stats?.attributes || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                                                            <h5 className="font-semibold text-green-800 mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                                <Shield className="w-4 h-4" />
                                                                Normalization Quality
                                                            </h5>
                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div className="text-center">
                                                                    <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                                        {safeResults.stats?.losslessJoin ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
                                                                    </div>
                                                                    <div className="text-green-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>Lossless Join</div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                                        {safeResults.stats?.dependencyPreservation ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6 text-red-600" />}
                                                                    </div>
                                                                    <div className="text-green-700" style={{ fontFamily: "'CMU Serif Roman', serif" }}>Dependency Preservation</div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                                                            <h5 className="font-semibold text-blue-800 mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                                <TrendingUp className="w-4 h-4" />
                                                                Advanced Metrics
                                                            </h5>
                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div>
                                                                    <span className="font-medium text-blue-700">2NF Relations:</span>
                                                                    <span className="ml-2 text-blue-800">{safeResults.stats?.relations2NF || 0}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-blue-700">Cardinalities:</span>
                                                                    <span className="ml-2 text-blue-800">{safeResults.stats?.cardinalityMappings || 0}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-blue-700">Super Keys:</span>
                                                                    <span className="ml-2 text-blue-800">{safeResults.stats?.superkeys || 0}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-blue-700">Relationships:</span>
                                                                    <span className="ml-2 text-blue-800">{safeResults.stats?.relationships || 0}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {activeTab === "normal-forms" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <Layers className="w-6 h-6 text-teal-600" />
                                                Normal Forms Analysis
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                Complete normalization analysis across First, Second, and Third Normal Forms
                                            </p>
                                        </div>

                                        <NormalFormSection
                                            relations1NF={relations1NF}
                                            relations2NF={relations2NF}
                                            relations3NF={relationData}
                                        />
                                    </section>
                                )}

                                {activeTab === "functional-dependencies" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <GitBranch className="w-6 h-6 text-blue-600" />
                                                Functional Dependencies
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                Discovered functional dependencies with confidence metrics and detailed analysis
                                            </p>
                                        </div>

                                        <FunctionalDependenciesSection fdData={fdData} />
                                    </section>
                                )}

                                {activeTab === "cardinality" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <BarChart3 className="w-6 h-6 text-purple-600" />
                                                Cardinality Analysis
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                Relationship cardinality analysis with proper types and confidence metrics
                                            </p>
                                        </div>

                                        <CardinalitySection cardinalityAnalysis={cardinalityAnalysis} />
                                    </section>
                                )}

                                {activeTab === "keys" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <Key className="w-6 h-6 text-yellow-600" />
                                                Keys & Superkeys Analysis
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                Candidate keys, superkeys, and key selection recommendations
                                            </p>
                                        </div>

                                        <KeysSection keyData={keyData} />
                                    </section>
                                )}

                                {activeTab === "quality-assurance" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <Shield className="w-6 h-6 text-green-600" />
                                                Quality Assurance
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                Lossless join property and dependency preservation analysis
                                            </p>
                                        </div>

                                        <QualityAssuranceSection losslessCheck={losslessCheck} dependencyPreservation={dependencyPreservation} />
                                    </section>
                                )}

                                {activeTab === "erd" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <Image className="w-6 h-6 text-emerald-600" />
                                                Entity Relationship Diagram
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                SVG preview of the generated Entity Relationship Diagram
                                            </p>
                                        </div>

                                        {erdContent ? (
                                            <SVGPreviewSection erdContent={erdContent} />
                                        ) : (
                                            <div className="text-center py-12 text-gray-500">
                                                <Image className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                                <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No ERD diagram available</p>
                                                <p className="text-sm text-gray-400 mt-2">ERD generation requires complete 3NF normalization</p>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {activeTab === "sql-ddl" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <Code className="w-6 h-6 text-blue-600" />
                                                SQL Data Definition Language
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                Complete SQL DDL for database creation with constraints and indexes
                                            </p>
                                        </div>

                                        {sqlFile ? (
                                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 flex items-center justify-between">
                                                    <h5 className="font-semibold text-gray-900 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                        <Code className="w-5 h-5" />
                                                        database_schema.sql
                                                    </h5>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(sqlFile.content)}
                                                            className="bg-white hover:bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                            Copy SQL
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const blob = new Blob([sqlFile.content], { type: 'application/sql' });
                                                                const url = URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = 'database_schema.sql';
                                                                a.click();
                                                                URL.revokeObjectURL(url);
                                                            }}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium transition-colors"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                            Download SQL
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-6">
                                                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                                                        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                                                            <span className="text-sm text-gray-300 font-mono">database_schema.sql</span>
                                                            <div className="flex gap-2 text-xs text-gray-400">
                                                                <span>SQL DDL</span>
                                                                <span>•</span>
                                                                <span>{(sqlFile.content.length / 1024).toFixed(1)} KB</span>
                                                                <span>•</span>
                                                                <span>{sqlFile.content.split('\n').length} lines</span>
                                                            </div>
                                                        </div>
                                                        <div className="max-h-96 overflow-auto">
                                                            <SyntaxHighlighter
                                                                language="sql"
                                                                style={oneDark}
                                                                showLineNumbers={true}
                                                                lineNumberStyle={{
                                                                    minWidth: '3em',
                                                                    paddingRight: '1em',
                                                                    textAlign: 'right',
                                                                    userSelect: 'none',
                                                                    backgroundColor: '#1f2937',
                                                                    color: '#9ca3af',
                                                                    borderRight: '1px solid #374151',
                                                                    marginRight: '1em'
                                                                }}
                                                                customStyle={{
                                                                    margin: 0,
                                                                    background: '#111827',
                                                                    fontSize: '14px',
                                                                    lineHeight: '1.4',
                                                                    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Roboto Mono', monospace"
                                                                }}
                                                                codeTagProps={{
                                                                    style: {
                                                                        backgroundColor: 'transparent',
                                                                        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', 'Roboto Mono', monospace"
                                                                    }
                                                                }}
                                                                wrapLines={true}
                                                                wrapLongLines={true}
                                                            >
                                                                {sqlFile.content}
                                                            </SyntaxHighlighter>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 text-gray-500">
                                                <Code className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                                <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No SQL DDL available</p>
                                                <p className="text-sm text-gray-400 mt-2">SQL generation requires complete 3NF normalization with key discovery</p>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* NEW: Generated Files Tab */}
                                {activeTab === "generated-files" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <Folder className="w-6 h-6 text-indigo-600" />
                                                Generated Files
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                All generated files from the normalization process - nothing is hidden
                                            </p>
                                        </div>

                                        <GeneratedFilesSection outputFiles={safeResults?.outputFiles || []} />
                                    </section>
                                )}

                                {activeTab === "report" && (
                                    <section className="p-8">
                                        <div className="mb-6">
                                            <h4 className="text-2xl font-bold mb-2 flex items-center gap-2" style={{ fontFamily: "'CMU Serif Bold', serif" }}>
                                                <FileText className="w-6 h-6 text-green-600" />
                                                Process Report
                                            </h4>
                                            <p className="text-gray-600" style={{ fontFamily: "'CMU Serif Roman', serif" }}>
                                                Normalization process documentation and analysis
                                            </p>
                                            {(reportFile || schemaFile) ? (
                                                <MarkdownRenderer
                                                    content={
                                                        [
                                                            schemaFile?.content,
                                                            reportFile?.content
                                                        ].filter(Boolean).join('\n\n---\n\n')
                                                    }
                                                // filename="process_report.md"
                                                />
                                            ) : (
                                                <div className="text-center py-12 text-gray-500">
                                                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                                    <p style={{ fontFamily: "'CMU Serif Roman', serif" }}>No process report available</p>
                                                    <p className="text-sm text-gray-400 mt-2">Reports are generated when the Report Generator operation is included</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>)}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    );
}