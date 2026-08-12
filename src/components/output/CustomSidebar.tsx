import React from 'react';

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
  hasData?: boolean;
}

export interface CustomSidebarProps {
  items: SidebarItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function CustomSidebar({ items, activeTab, onTabChange }: CustomSidebarProps) {
  return (
    <div className="bg-white border-r border-gray-200 h-full overflow-y-auto">
      <div className="p-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            disabled={!item.hasData}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 ${
              activeTab === item.id
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
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  activeTab === item.id
                    ? 'bg-teal-100 text-teal-700'
                    : item.hasData
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-gray-50 text-gray-400'
                }`}
              >
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
