import { useRef, useState, useEffect } from "react";
import { CiRedo, CiUndo } from "react-icons/ci";
import { FaCode, FaUpload } from "react-icons/fa";
import { MdOutlineOutput } from "react-icons/md";
import { TbRefresh } from "react-icons/tb";
import { Loader2, Zap, Save, Loader, Cpu, ChevronDown, Check } from "lucide-react";

interface HeadingProps {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onRun?: () => void;
  onRunAll?: () => void;
  onFileUpload?: (files: File[]) => void;
  uploadedFileCount?: number;
  onViewOutput?: () => void;
  onSaveState?: () => void;
  onLoadState?: (file: File) => void;
  isRunning?: boolean;
  isOutputReady?: boolean;
  selectedModel?: string;
  installedModels?: string[];
  ollamaReady?: boolean | null;
  onModelSelect?: (model: string) => void;
  onRefreshModels?: () => void;
}

export default function Heading({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRun,
  onRunAll,
  onFileUpload,
  uploadedFileCount = 0,
  onViewOutput,
  onSaveState,
  onLoadState,
  isRunning,
  isOutputReady,
  selectedModel = '',
  installedModels = [],
  ollamaReady = null,
  onModelSelect,
  onRefreshModels
}: HeadingProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadStateInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [fileCount, setFileCount] = useState<number>(uploadedFileCount);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleLoadStateClick = () => {
    loadStateInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      setFileCount(files.length);
      onFileUpload?.(files);
    }
    e.target.value = "";
  };

  const handleLoadStateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "json") {
        onLoadState?.(file);
      } else {
        alert("Please select a valid JSON state file.");
      }
    }
    e.target.value = "";
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const activeFiles = fileCount || uploadedFileCount;

  return (
    <div className="flex items-center justify-between w-full h-full px-2 py-1 relative z-30">
      {/* Brand & Logo Section */}
      <div className="flex items-center gap-2">
        <img src="/icon.png" alt="NormaFlow Logo" className="h-7 w-7 object-contain drop-shadow-xs" />
        <span
          className="text-xl font-bold tracking-tight text-gray-900"
          style={{ fontFamily: "'CMU Serif Bold', serif" }}
        >
          NormaFlow
        </span>
      </div>

      {/* Center Action Group: Undo & Redo */}
      <div className="flex items-center gap-1.5 bg-white/80 p-1 rounded-xl border border-gray-200/80 shadow-xs backdrop-blur-sm">
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          onClick={onUndo}
          disabled={!canUndo || isRunning}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <CiUndo className="h-5 w-5" />
        </button>
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          onClick={onRedo}
          disabled={!canRedo || isRunning}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <CiRedo className="h-5 w-5" />
        </button>
      </div>

      {/* Right Action Group: Icon-Only Controls */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={loadStateInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleLoadStateFileChange}
        />

        {/* Model Selection Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/90 border border-gray-200/80 text-gray-700 hover:border-teal-400 hover:text-teal-600 transition-all shadow-xs active:scale-95 ${
              isRunning ? 'cursor-not-allowed opacity-60' : ''
            }`}
            onClick={() => !isRunning && setIsModelMenuOpen(!isModelMenuOpen)}
            disabled={isRunning}
            title={selectedModel ? `Ollama Model: ${selectedModel}` : 'Select Ollama Model'}
            aria-label="Select Ollama Model"
          >
            <Cpu className="h-4 w-4 text-teal-600" />
            {selectedModel && (
              <span className="text-xs font-mono font-medium max-w-[80px] truncate text-gray-700">
                {selectedModel}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>

          {isModelMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white/95 backdrop-blur-md rounded-xl border border-gray-200/90 shadow-xl py-1.5 z-50 text-sm">
              <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                <span className="font-semibold text-xs text-gray-500 uppercase tracking-wider font-mono">
                  Ollama Models
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefreshModels?.();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Refresh Ollama Models"
                >
                  <TbRefresh className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto py-1">
                {ollamaReady && installedModels.length > 0 ? (
                  installedModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        onModelSelect?.(m);
                        setIsModelMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-gray-100 transition-colors ${
                        m === selectedModel ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-gray-700'
                      }`}
                      style={{ fontFamily: "'CMU Serif Roman', serif" }}
                    >
                      <span>{m}</span>
                      {m === selectedModel && <Check className="h-3.5 w-3.5 text-teal-600" />}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-500 text-center">
                    {ollamaReady ? 'No models found' : 'Ollama Offline (Rule Engine Active)'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Load State */}
        <button
          className="w-9 h-9 rounded-xl bg-white/90 border border-gray-200/80 text-gray-700 hover:text-teal-600 hover:border-teal-400 flex items-center justify-center transition-all shadow-xs active:scale-95 disabled:opacity-50"
          onClick={handleLoadStateClick}
          disabled={isRunning}
          title="Load State (.json)"
          aria-label="Load State"
        >
          <Loader className="h-4 w-4" />
        </button>

        {/* Save State */}
        <button
          className="w-9 h-9 rounded-xl bg-white/90 border border-gray-200/80 text-gray-700 hover:text-teal-600 hover:border-teal-400 flex items-center justify-center transition-all shadow-xs active:scale-95 disabled:opacity-50"
          onClick={onSaveState}
          disabled={isRunning}
          title="Save State (.json)"
          aria-label="Save State"
        >
          <Save className="h-4 w-4" />
        </button>

        {/* Upload Datasets */}
        <button
          className="w-9 h-9 rounded-xl bg-white/90 border border-gray-200/80 text-gray-700 hover:text-teal-600 hover:border-teal-400 flex items-center justify-center transition-all shadow-xs active:scale-95 relative disabled:opacity-50"
          onClick={handleUploadClick}
          disabled={isRunning}
          title="Upload CSV Datasets"
          aria-label="Upload CSV Datasets"
        >
          <FaUpload className="h-4 w-4" />
          {activeFiles > 0 && (
            <span className="absolute -top-1 -right-1 bg-teal-600 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold border border-white">
              {activeFiles}
            </span>
          )}
        </button>

        {/* Refresh App */}
        <button
          className="w-9 h-9 rounded-xl bg-white/90 border border-gray-200/80 text-gray-700 hover:text-teal-600 hover:border-teal-400 flex items-center justify-center transition-all shadow-xs active:scale-95 disabled:opacity-50"
          onClick={handleRefresh}
          disabled={isRunning}
          title="Refresh Workspace"
          aria-label="Refresh Workspace"
        >
          <TbRefresh className="h-4 w-4" />
        </button>

        {/* Run Selected Step */}
        <button
          className="w-9 h-9 rounded-xl bg-gray-900 text-white hover:bg-gray-800 flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-50"
          onClick={onRun}
          disabled={isRunning}
          title="Run Selected Node Operation"
          aria-label="Run Selected Node Operation"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-teal-400" /> : <FaCode className="h-4 w-4" />}
        </button>

        {/* Run All Pipeline */}
        <button
          className="w-9 h-9 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:from-teal-600 hover:to-emerald-600 flex items-center justify-center transition-all shadow-md active:scale-95 disabled:opacity-50"
          onClick={onRunAll}
          disabled={isRunning}
          title="Run Complete Pipeline (Automated Multi-CSV)"
          aria-label="Run Complete Pipeline"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-current" />}
        </button>

        {/* View Output */}
        <button
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 ${
            isOutputReady
              ? "bg-emerald-500 text-white hover:bg-emerald-600"
              : "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200"
          }`}
          onClick={onViewOutput}
          title="View Output & Normalization Results"
          aria-label="View Output & Normalization Results"
        >
          <MdOutlineOutput className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}