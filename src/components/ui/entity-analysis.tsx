import { useMemo } from 'react';
import { BarChart3, Database, Key, Link } from 'lucide-react';

interface EntityAnalysisProps {
    erdContent: string;
    relations: any[];
}

export function EntityAnalysis({ erdContent }: EntityAnalysisProps) {
    const analysis = useMemo(() => {
        const lines = erdContent.split('\n').filter(line => line.trim());
        const entityMetrics: Record<string, {
            attributeCount: number;
            relationships: number;
            primaryKeys: number;
            foreignKeys: number;
            entityType: 'simple' | 'junction' | 'complex';
        }> = {};

        let currentEntity = '';
        let inEntityBlock = false;

        lines.forEach(line => {
            const trimmed = line.trim();

            if (trimmed.includes('{') && !trimmed.includes('}')) {
                currentEntity = trimmed.replace('{', '').trim();
                entityMetrics[currentEntity] = {
                    attributeCount: 0,
                    relationships: 0,
                    primaryKeys: 0,
                    foreignKeys: 0,
                    entityType: 'simple'
                };
                inEntityBlock = true;
            }
            else if (trimmed === '}') {
                if (currentEntity && entityMetrics[currentEntity]) {
                    // Determine entity type
                    const metrics = entityMetrics[currentEntity];
                    if (metrics.attributeCount <= 2 && metrics.foreignKeys >= 2) {
                        metrics.entityType = 'junction';
                    } else if (metrics.attributeCount > 5 || metrics.relationships > 3) {
                        metrics.entityType = 'complex';
                    }
                }
                inEntityBlock = false;
                currentEntity = '';
            }
            else if (inEntityBlock && currentEntity && entityMetrics[currentEntity]) {
                const attrMatch = trimmed.match(/(\w+)\s+(\w+)\s*"([^"]*)?"/);
                if (attrMatch) {
                    entityMetrics[currentEntity].attributeCount++;
                    const constraints = attrMatch[3] || '';
                    if (constraints.includes('PK')) {
                        entityMetrics[currentEntity].primaryKeys++;
                    }
                    if (constraints.includes('FK')) {
                        entityMetrics[currentEntity].foreignKeys++;
                    }
                }
            }
            else if (trimmed.includes('--')) {
                const relMatch = trimmed.match(/(\w+)\s+([|}o\-{]+)\s+(\w+)/);
                if (relMatch) {
                    const source = relMatch[1];
                    const target = relMatch[3];
                    if (entityMetrics[source]) entityMetrics[source].relationships++;
                    if (entityMetrics[target]) entityMetrics[target].relationships++;
                }
            }
        });

        return entityMetrics;
    }, [erdContent]);

    const statistics = useMemo(() => {
        const entities = Object.keys(analysis);
        const totalAttributes = Object.values(analysis).reduce((sum, entity) => sum + entity.attributeCount, 0);
        const totalRelationships = Object.values(analysis).reduce((sum, entity) => sum + entity.relationships, 0) / 2; // Divide by 2 to avoid double counting

        const entityTypes = Object.values(analysis).reduce((acc, entity) => {
            acc[entity.entityType] = (acc[entity.entityType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const complexityScore = entities.length * 0.3 + totalRelationships * 0.5 + totalAttributes * 0.2;

        return {
            totalEntities: entities.length,
            totalAttributes,
            totalRelationships,
            entityTypes,
            complexityScore: Math.round(complexityScore),
            averageAttributesPerEntity: Math.round(totalAttributes / entities.length * 10) / 10
        };
    }, [analysis]);

    const getComplexityLevel = (score: number) => {
        if (score < 50) return { level: 'Simple', color: 'text-green-600', bg: 'bg-green-100' };
        if (score < 100) return { level: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-100' };
        return { level: 'Complex', color: 'text-red-600', bg: 'bg-red-100' };
    };

    const complexity = getComplexityLevel(statistics.complexityScore);

    return (
        <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <Database className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold text-gray-900">{statistics.totalEntities}</div>
                    <div className="text-sm text-gray-600">Entities</div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <Key className="w-8 h-8 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold text-gray-900">{statistics.totalAttributes}</div>
                    <div className="text-sm text-gray-600">Attributes</div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <Link className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                    <div className="text-2xl font-bold text-gray-900">{statistics.totalRelationships}</div>
                    <div className="text-sm text-gray-600">Relationships</div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                    <div className={`text-2xl font-bold ${complexity.color}`}>{complexity.level}</div>
                    <div className="text-sm text-gray-600">Complexity</div>
                </div>
            </div>

            {/* Detailed Analysis */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h5 className="font-semibold text-gray-900" style={{ fontFamily: "'Inter', sans-serif" }}>
                        Entity Breakdown
                    </h5>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Entity Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Attributes
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Relationships
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Keys (PK/FK)
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {Object.entries(analysis).map(([entityName, metrics]) => (
                                <tr key={entityName} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {entityName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {metrics.attributeCount}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {metrics.relationships}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {metrics.primaryKeys}/{metrics.foreignKeys}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${metrics.entityType === 'junction'
                                            ? 'bg-blue-100 text-blue-800'
                                            : metrics.entityType === 'complex'
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-green-100 text-green-800'
                                            }`}>
                                            {metrics.entityType}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h5 className="font-semibold text-gray-900 mb-4" style={{ fontFamily: "'Inter', sans-serif" }}>
                    Schema Analysis & Recommendations
                </h5>

                <div className="space-y-4">
                    <div className={`p-4 rounded-lg ${complexity.bg}`}>
                        <h6 className={`font-medium ${complexity.color} mb-2`}>
                            Complexity Assessment: {complexity.level}
                        </h6>
                        <p className="text-sm text-gray-700">
                            {complexity.level === 'Simple' &&
                                "This schema has good simplicity with manageable entity relationships. Consider if further normalization is needed."
                            }
                            {complexity.level === 'Moderate' &&
                                "This schema shows moderate complexity. Review junction tables and consider denormalization for frequently accessed data."
                            }
                            {complexity.level === 'Complex' &&
                                "This schema is highly complex with many entities and relationships. Consider creating views or summary tables for common queries."
                            }
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <h6 className="font-medium text-blue-800 mb-2">Entity Distribution</h6>
                            <div className="space-y-1 text-sm">
                                {Object.entries(statistics.entityTypes).map(([type, count]) => (
                                    <div key={type} className="flex justify-between">
                                        <span className="capitalize text-blue-700">{type} entities:</span>
                                        <span className="font-medium text-blue-800">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-green-50 rounded-lg">
                            <h6 className="font-medium text-green-800 mb-2">Performance Considerations</h6>
                            <div className="space-y-1 text-sm text-green-700">
                                <div>Avg. attributes per entity: {statistics.averageAttributesPerEntity}</div>
                                <div>Total relationships: {statistics.totalRelationships}</div>
                                <div className="mt-2 text-xs">
                                    Consider indexing foreign key columns for better join performance.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}