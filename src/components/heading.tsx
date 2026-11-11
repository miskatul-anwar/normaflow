import { useRef } from "react";
import { FileOutput, FolderOpen, Play, Redo2, RotateCcw, Save, Undo2, Upload } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { INPUT_ACCEPT } from "@/services/processors/spreadsheetProcessor";

interface HeadingProps {
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onRun?: () => void;
  onFileUpload?: (files: File[]) => void;
  /** Number of data files the user has uploaded. */
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

  const handleUploadClick = () => {
    inputRef.current?.click();
  };

  const handleLoadStateClick = () => {
    loadStateInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
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

  const activeFiles = uploadedFileCount;
  const uploadTitle = activeFiles === 0
    ? 'Upload CSV or spreadsheet files to analyse'
    : `${activeFiles} file${activeFiles === 1 ? '' : 's'} loaded. Click to upload different files.`;

  // Labels collapse to icons on narrow windows; the tooltip and aria-label keep the name.
  const label = (text: string) => <span className="hidden min-[1180px]:inline">{text}</span>;

  return (
    // Three zones: history and reset on the left, file actions centred, run and results on the right.
    <div className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-1.5 relative z-30">
      <div className="flex min-w-0 items-center gap-2.5">
        {/* Brand: icon only */}
        <img src="/icon.png" alt="NormaFlow" title="NormaFlow" className="h-9 w-9 shrink-0 object-contain drop-shadow-xs" />

        <div className="flex items-center gap-1">
          <IconButton label="Undo (Ctrl+Z)" icon={<Undo2 />} onClick={onUndo} disabled={!canUndo || isRunning} />
          <IconButton label="Redo (Ctrl+Y)" icon={<Redo2 />} onClick={onRedo} disabled={!canRedo || isRunning} />
        </div>

        <Button onClick={handleRefresh} disabled={isRunning} title="Reload the app and reset every workspace" aria-label="Reset workspace">
          <RotateCcw />
          {label("Reset")}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <input ref={inputRef} type="file" multiple accept={INPUT_ACCEPT} className="hidden" onChange={handleFileChange} />
        <input ref={loadStateInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadStateFileChange} />

        <Button onClick={handleLoadStateClick} disabled={isRunning} title="Load a saved workflow (.json)" aria-label="Open workflow">
          <FolderOpen />
          {label("Open")}
        </Button>
        <Button onClick={onSaveState} disabled={isRunning} title="Save the workflow (.json)" aria-label="Save workflow">
          <Save />
          {label("Save")}
        </Button>
        <Button onClick={handleUploadClick} disabled={isRunning} title={uploadTitle} aria-label="Upload Datasets" className="relative">
          <Upload />
          {label("Upload")}
          {activeFiles > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-teal-700 px-1 text-[10px] font-semibold leading-none text-white">
              {activeFiles}
            </span>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="primary"
          onClick={onRun}
          loading={isRunning}
          title="Run the pipeline steps on the canvas"
          aria-label="Run the pipeline steps on the canvas"
        >
          {!isRunning && <Play />}
          <span>Run</span>
        </Button>
        <Button onClick={onViewOutput} title="View the generated ERD, SQL and reports" aria-label="View results" className="relative">
          <FileOutput />
          <span>Output</span>
          {isOutputReady && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-teal-600" aria-label="Results ready" />
          )}
        </Button>
      </div>
    </div>
  );
}
