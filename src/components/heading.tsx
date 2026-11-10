import { useRef, useState } from "react";
import { CiRedo, CiUndo } from "react-icons/ci";
import { FaCode, FaUpload } from "react-icons/fa";
import { MdOutlineOutput } from "react-icons/md";
import { TbRefresh } from "react-icons/tb";
import { Loader2, Zap, Save, FolderOpen } from "lucide-react";

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
}: HeadingProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadStateInputRef = useRef<HTMLInputElement>(null);
  const [fileCount, setFileCount] = useState<number>(uploadedFileCount);

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
    <div className="flex items-center justify-between w-full h-full px-3 py-1.5 relative z-30">
      {/* Brand & Logo Section */}
      <div className="flex items-center gap-2.5">
        <img src="/icon.png" alt="NormaFlow Logo" className="h-7 w-7 object-contain drop-shadow-xs" />
        <div className="flex flex-col">
          <span
            className="text-lg font-bold tracking-tight text-gray-900 leading-tight"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            NormaFlow
          </span>
          <span className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">
            Relational Normalization Engine
          </span>
        </div>
      </div>

      {/* Center Action Group: Undo & Redo */}
      <div className="flex items-center gap-1 bg-white/80 p-1 rounded-xl border border-gray-200/80 shadow-xs backdrop-blur-sm">
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          onClick={onUndo}
          disabled={!canUndo || isRunning}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <CiUndo className="h-5 w-5" />
        </button>
        <button
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-teal-600 hover:bg-teal-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          onClick={onRedo}
          disabled={!canRedo || isRunning}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <CiRedo className="h-5 w-5" />
        </button>
      </div>

      {/* Right Action Group: Pipeline Controls */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv"
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

        {/* Load Workflow */}
        <button
          className="w-9 h-9 rounded-xl bg-white/90 border border-gray-200/80 text-gray-700 hover:text-teal-600 hover:border-teal-400 flex items-center justify-center transition-all shadow-xs active:scale-95 disabled:opacity-50"
          onClick={handleLoadStateClick}
          disabled={isRunning}
          title="Load Workflow (.json)"
          aria-label="Load Workflow"
        >
          <FolderOpen className="h-4 w-4" />
        </button>

        {/* Save Workflow */}
        <button
          className="w-9 h-9 rounded-xl bg-white/90 border border-gray-200/80 text-gray-700 hover:text-teal-600 hover:border-teal-400 flex items-center justify-center transition-all shadow-xs active:scale-95 disabled:opacity-50"
          onClick={onSaveState}
          disabled={isRunning}
          title="Save Workflow (.json)"
          aria-label="Save Workflow"
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
            <span className="absolute -top-1 -right-1 bg-teal-600 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-bold border border-white shadow-xs">
              {activeFiles}
            </span>
          )}
        </button>

        {/* Refresh App */}
        <button
          className="w-9 h-9 rounded-xl bg-white/90 border border-gray-200/80 text-gray-700 hover:text-teal-600 hover:border-teal-400 flex items-center justify-center transition-all shadow-xs active:scale-95 disabled:opacity-50"
          onClick={handleRefresh}
          disabled={isRunning}
          title="Reset Workspace"
          aria-label="Reset Workspace"
        >
          <TbRefresh className="h-4 w-4" />
        </button>

        <div className="h-5 w-px bg-gray-300 mx-0.5" />

        {/* Run Selected Step */}
        <button
          className="px-3 h-9 rounded-xl bg-gray-900 text-white hover:bg-gray-800 flex items-center gap-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-50 text-xs font-semibold"
          onClick={onRun}
          disabled={isRunning}
          title="Execute Selected Pipeline Steps"
          aria-label="Execute Selected Pipeline Steps"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
          ) : (
            <FaCode className="h-3.5 w-3.5 text-teal-300" />
          )}
          <span>Run Step</span>
        </button>

        {/* Run All Pipeline */}
        <button
          className="px-3.5 h-9 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 text-xs font-semibold"
          onClick={onRunAll}
          disabled={isRunning}
          title="Synthesize Full 3NF Pipeline"
          aria-label="Synthesize Full 3NF Pipeline"
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
          ) : (
            <Zap className="h-3.5 w-3.5 fill-current text-white" />
          )}
          <span>Synthesize 3NF</span>
        </button>

        {/* View Output */}
        <button
          className={`px-3.5 h-9 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 text-xs font-semibold ${
            isOutputReady
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
          }`}
          onClick={onViewOutput}
          title="View Generated ERD, SQL DDL & Reports"
          aria-label="View Results"
        >
          <MdOutlineOutput className="h-4 w-4" />
          <span>Output</span>
        </button>
      </div>
    </div>
  );
}