import { RiNumber1, RiNumber2, RiNumber3 } from "react-icons/ri";
import { MdCleaningServices } from "react-icons/md";
import { CiSquareCheck } from "react-icons/ci";
import { FaKey, FaProjectDiagram } from 'react-icons/fa';
import { MdAccountTree } from 'react-icons/md';
import { TbDatabaseCog } from "react-icons/tb";
import { AiOutlineNodeIndex } from "react-icons/ai";
import { BiData } from "react-icons/bi";
import { HiOutlineDocumentReport } from "react-icons/hi";
import { LuAtom } from "react-icons/lu";
import { FiTarget } from "react-icons/fi";
import { BsLock } from "react-icons/bs";
import { FaCodeBranch } from "react-icons/fa6";

function CircularIconButton({
    icon: Icon,
    label,
    onClick,
    state = 'default'
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    state?: 'default' | 'loading' | 'success' | 'error' | 'disabled';
}) {
    return (
        <div className="button-container">
            <button
                type="button"
                title={label}
                className={`w-12 h-12 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-gray-700 hover:text-gray-900 shadow-sm hover:shadow-md border border-gray-200 hover:border-gray-300 circular-button sidebar-button ${state !== 'default' ? state : ''}`}
                onClick={onClick}
                disabled={state === 'disabled' || state === 'loading'}
            >
                <Icon className="sidebar-icon" />
            </button>
            <span className="operation-label">
                {label}
            </span>
        </div>
    );
}

export default function SideBar({ onAddNode }: { onAddNode: (label: string) => void }) {
    return (
        <div className="sidebar-container">
            <div className="grid grid-cols-2 gap-2 align-center justify-center">
                {/* Row 1 */}
                <CircularIconButton
                    icon={BiData}
                    label="CSV Data Loader"
                    onClick={() => onAddNode("CSV Data Loader")}
                />
                <CircularIconButton
                    icon={MdCleaningServices}
                    label="Data Cleaner"
                    onClick={() => onAddNode("Data Cleaner")}
                />

                {/* Row 2 */}
                <CircularIconButton
                    icon={LuAtom}
                    label="Atomicity Checker"
                    onClick={() => onAddNode("Atomicity Checker")}
                />
                <CircularIconButton
                    icon={TbDatabaseCog}
                    label="Data Type Profiler"
                    onClick={() => onAddNode("Data Type Profiler")}
                />

                {/* Row 3 */}
                <CircularIconButton
                    icon={AiOutlineNodeIndex}
                    label="FD Miner"
                    onClick={() => onAddNode("FD Miner")}
                />
                <CircularIconButton
                    icon={FaKey}
                    label="Key Discovery"
                    onClick={() => onAddNode("Key Discovery")}
                />

                {/* Row 4 */}
                <CircularIconButton
                    icon={FaCodeBranch}
                    label="Cardinality Analyzer"
                    onClick={() => onAddNode("Cardinality Analyzer")}
                />
                <CircularIconButton
                    icon={RiNumber1}
                    label="1NF"
                    onClick={() => onAddNode("1NF")}
                />

                {/* Continue with remaining buttons to fill more rows if needed */}
                <CircularIconButton
                    icon={RiNumber2}
                    label="2NF"
                    onClick={() => onAddNode("2NF")}
                />
                <CircularIconButton
                    icon={RiNumber3}
                    label="3NF"
                    onClick={() => onAddNode("3NF")}
                />

                <CircularIconButton
                    icon={CiSquareCheck}
                    label="Lossless Check"
                    onClick={() => onAddNode("Lossless Check")}
                />
                <CircularIconButton
                    icon={BsLock}
                    label="Dependency Preservation"
                    onClick={() => onAddNode("Dependency Preservation")}
                />

                <CircularIconButton
                    icon={FaProjectDiagram}
                    label="ERD Generator"
                    onClick={() => onAddNode("ERD Generator")}
                />
                <CircularIconButton
                    icon={MdAccountTree}
                    label="Relation Generator"
                    onClick={() => onAddNode("Relation Generator")}
                />

                <CircularIconButton
                    icon={FiTarget}
                    label="SQL Generator"
                    onClick={() => onAddNode("SQL Generator")}
                />
                <CircularIconButton
                    icon={HiOutlineDocumentReport}
                    label="Report Generator"
                    onClick={() => onAddNode("Report Generator")}
                />
            </div>
        </div>
    );
}