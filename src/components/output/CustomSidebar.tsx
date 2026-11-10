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
    <div className="bg-white border-r border-gray-200/90 h-full overflow-y-auto p-3">
      <div className="space-y-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            disabled={!item.hasData}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
              activeTab === item.id
                ? 'bg-teal-50 text-teal-800 border border-teal-300 shadow-xs font-semibold'
                : item.hasData
                ? 'text-gray-700 hover:bg-gray-100/80 hover:text-teal-700 border border-transparent'
                : 'text-gray-400 cursor-not-allowed opacity-50 border border-transparent'
            }`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            <span className={`${activeTab === item.id ? 'text-teal-600' : item.hasData ? 'text-gray-500' : 'text-gray-300'}`}>
              {item.icon}
            </span>
            <span className="flex-1 text-sm">{item.label}</span>
            {item.count !== undefined && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                  activeTab === item.id
                    ? 'bg-teal-100 text-teal-800 font-bold'
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
