import { useRef, useState, useEffect } from "react";
import { CiRedo, CiUndo } from "react-icons/ci";
import { FaCode, FaUpload, FaFileCsv } from "react-icons/fa";
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

  return (
    <div className="text-2xl items-center font-bold font-serif text-gray-800 flex mb-2 p-2 relative z-30">
      <img src="/icon.png" alt="NormaFlow Logo" className="inline-block h-8 w-8 mr-2" />
      <span
        style={{
          fontFamily: "'CMU Serif Bold', serif",
          letterSpacing: "0.02em",
          fontWeight: "bold",
          fontSize: "2.1rem",
        }}
      >
        NormaFlow
      </span>

      <div className="flex-1 flex justify-center">
        <div className="flex items-center space-x-2">
          <button
            className={`flex items-center px-2 py-0.5 rounded ${
              canUndo && !isRunning
                ? "bg-gray-200 text-gray-700 hover:bg-gray-100"
                : "bg-gray-100 text-gray-400"
            } transition text-sm drop-shadow-sm`}
            onClick={onUndo}
            disabled={!canUndo || isRunning}
            style={{ fontFamily: "'CMU Serif Roman', serif" }}
          >
            <CiUndo className="mr-1 h-4 w-4" />
            Undo
          </button>
          <button
            className={`flex items-center px-2 py-0.5 rounded ${
              canRedo && !isRunning
                ? "bg-gray-200 text-gray-700 hover:bg-gray-100"
                : "bg-gray-100 text-gray-400"
            } transition text-sm drop-shadow-sm`}
            onClick={onRedo}
            disabled={!canRedo || isRunning}
            style={{ fontFamily: "'CMU Serif Roman', serif" }}
          >
            <CiRedo className="mr-1 h-4 w-4" />
            Redo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
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

        {/* Custom Popover Model Selection Submenu matching top header design */}
        <div className="relative" ref={menuRef}>
          <button
            className={`flex items-center px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-100 transition text-sm drop-shadow-sm ${
              isRunning ? 'cursor-not-allowed opacity-60' : ''
            }`}
            onClick={() => !isRunning && setIsModelMenuOpen(!isModelMenuOpen)}
            disabled={isRunning}
            style={{ fontFamily: "'CMU Serif Roman', serif" }}
            title="Select Ollama Model"
          >
            <Cpu className="mr-1 h-4 w-4 text-teal-600" />
            <span>
              {selectedModel ? selectedModel : (ollamaReady ? 'Select Model' : 'NLP Rules')}
            </span>
            <ChevronDown className="ml-1 h-3.5 w-3.5 text-gray-500" />
          </button>

          {isModelMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg border border-gray-200 shadow-xl py-1.5 z-50 text-sm">
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

        <button
          className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${
            isRunning
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
          onClick={handleLoadStateClick}
          disabled={isRunning}
          style={{ fontFamily: "'CMU Serif Roman', serif" }}
        >
          <Loader className="mr-1 h-4 w-4" /> Load State
        </button>

        <button
          className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${
            isRunning
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
          onClick={onSaveState}
          disabled={isRunning}
          style={{ fontFamily: "'CMU Serif Roman', serif" }}
        >
          <Save className="mr-1 h-4 w-4" /> Save State
        </button>

        <button
          className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${
            isRunning
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
          onClick={handleUploadClick}
          disabled={isRunning}
          style={{ fontFamily: "'CMU Serif Roman', serif" }}
        >
          <FaUpload className="mr-1 h-4 w-4" /> Upload
        </button>

        {(fileCount > 0 || uploadedFileCount > 0) && (
          <span className="flex items-center gap-1 bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded border border-teal-300 font-medium">
            <FaFileCsv className="text-teal-600 h-3.5 w-3.5" />
            {fileCount || uploadedFileCount} CSV{ (fileCount || uploadedFileCount) > 1 ? 's' : '' }
          </span>
        )}

        <button
          className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${
            isRunning
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
          onClick={handleRefresh}
          disabled={isRunning}
          style={{ fontFamily: "'CMU Serif Roman', serif" }}
        >
          <TbRefresh className="mr-1 h-4 w-4" /> Refresh
        </button>

        <button
          className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${
            isRunning
              ? "bg-blue-200 text-blue-700 cursor-not-allowed"
              : "bg-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
          onClick={onRun}
          disabled={isRunning}
          style={{ fontFamily: "'CMU Serif Roman', serif" }}
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <FaCode className="mr-1 h-4 w-4" />
              Run
            </>
          )}
        </button>

        <button
          className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${
            isRunning
              ? "bg-teal-100 text-teal-700 cursor-not-allowed"
              : "bg-gradient-to-r from-green-400 to-[#2dd4bf] text-white hover:from-green-500 hover:to-[#2dd4bf] shadow-lg"
          }`}
          onClick={onRunAll}
          disabled={isRunning}
          style={{ fontFamily: "'CMU Serif Roman', serif" }}
          title="Automated multi-CSV pipeline"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Zap className="mr-1 h-4 w-4" />
              Run All
            </>
          )}
        </button>

        <button
          className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${
            isOutputReady
              ? "bg-green-200 text-green-700 hover:bg-green-100 font-semibold"
              : "bg-gray-200 text-gray-700 hover:bg-gray-100"
          }`}
          onClick={onViewOutput}
          style={{ fontFamily: "'CMU Serif Roman', serif" }}
          title="View Normalization Outputs"
        >
          <MdOutlineOutput className="mr-1 h-4 w-4 text-green-700" /> Output
        </button>
      </div>
    </div>
  );
}