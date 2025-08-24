import { useRef, useState } from "react";
import { CiRedo, CiUndo } from "react-icons/ci";
import { FaCode, FaUpload, FaFileCsv, FaFileExcel } from "react-icons/fa";
import { MdOutlineOutput } from "react-icons/md";
import { TbRefresh } from "react-icons/tb";
import { Loader2, Zap, Save, Loader } from "lucide-react";

interface HeadingProps {
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onRun?: () => void;
    onRunAll?: () => void;
    onFileUpload?: (file: File) => void;
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
    onViewOutput,
    onSaveState,
    onLoadState,
    isRunning,
    isOutputReady,
}: HeadingProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const loadStateInputRef = useRef<HTMLInputElement>(null);
    const [fileType, setFileType] = useState<"csv" | "xlsx" | null>(null);

    const handleUploadClick = () => {
        inputRef.current?.click();
    };

    const handleLoadStateClick = () => {
        loadStateInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const extension = file.name.split(".").pop()?.toLowerCase();
            if (extension === "csv") {
                setFileType("csv");
            } else if (extension === "xlsx") {
                setFileType("xlsx");
            } else {
                setFileType(null);
            }
            onFileUpload?.(file);
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
        <div className="text-2xl items-center font-bold font-serif text-gray-800 flex mb-2 ml p-2">
            <img src="/icon.png" alt="NormaFlow Logo" className="inline-block h-8 w-8" />
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
                        className={`flex items-center px-2 py-0.5 rounded ${canUndo && !isRunning
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
                        className={`flex items-center px-2 py-0.5 rounded ${canRedo && !isRunning
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
                <button
                    className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${isRunning
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
                    className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${isRunning
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
                    className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${isRunning
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                    onClick={handleUploadClick}
                    disabled={isRunning}
                    style={{ fontFamily: "'CMU Serif Roman', serif" }}
                >
                    <FaUpload className="mr-1 h-4 w-4" /> Upload
                </button>
                {fileType === "csv" && <FaFileCsv className="text-blue-500 h-5 w-5" />}
                {fileType === "xlsx" && <FaFileExcel className="text-green-500 h-5 w-5" />}

                <button
                    className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${isRunning
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
                    className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${isRunning
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

                {/* Premium Run All Button */}
                <button
                    className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm relative ${isRunning
                        ? "bg-teal-100 text-teal-700 cursor-not-allowed"
                        : "bg-gradient-to-r from-green-400 to-[#2dd4bf] text-white hover:from-green-500 hover:to-[#2dd4bf] shadow-lg"
                        }`}

                    onClick={onRunAll}
                    disabled={isRunning}
                    style={{ fontFamily: "'CMU Serif Roman', serif" }}
                    title="Automated pipeline"
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
                    className={`flex items-center px-2 py-0.5 rounded transition text-sm drop-shadow-sm ${isOutputReady
                        ? "bg-green-200 text-green-700 hover:bg-green-100"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                    onClick={onViewOutput}
                    disabled={!isOutputReady}
                    style={{ fontFamily: "'CMU Serif Roman', serif" }}
                >
                    <MdOutlineOutput className="mr-1 h-4 w-4" /> Output
                </button>
            </div>
        </div>
    );
}