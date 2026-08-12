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

const OPERATIONS_LIST = [
  { icon: BiData, label: "CSV Data Loader" },
  { icon: MdCleaningServices, label: "Data Cleaner" },
  { icon: LuAtom, label: "Atomicity Checker" },
  { icon: TbDatabaseCog, label: "Data Type Profiler" },
  { icon: AiOutlineNodeIndex, label: "FD Miner" },
  { icon: FaKey, label: "Key Discovery" },
  { icon: FaCodeBranch, label: "Cardinality Analyzer" },
  { icon: RiNumber1, label: "1NF" },
  { icon: RiNumber2, label: "2NF" },
  { icon: RiNumber3, label: "3NF" },
  { icon: CiSquareCheck, label: "Lossless Check" },
  { icon: BsLock, label: "Dependency Preservation" },
  { icon: FaProjectDiagram, label: "ERD Generator" },
  { icon: MdAccountTree, label: "Relation Generator" },
  { icon: FiTarget, label: "SQL Generator" },
  { icon: HiOutlineDocumentReport, label: "Report Generator" },
];

export default function SideBar({ onAddNode }: { onAddNode: (label: string) => void }) {
  return (
    <nav className="sidebar-container h-full overflow-y-auto" aria-label="Pipeline Operations">
      <ul className="grid grid-cols-2 gap-2 justify-items-center">
        {OPERATIONS_LIST.map(({ icon: Icon, label }) => (
          <li key={label} className="button-container flex flex-col items-center">
            <button
              type="button"
              aria-label={`Add ${label} node`}
              title={label}
              className="w-12 h-12 rounded-full bg-white hover:bg-teal-50 flex items-center justify-center text-gray-700 hover:text-teal-700 shadow-xs hover:shadow-md border border-gray-200 hover:border-teal-300 circular-button sidebar-button transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
              onClick={() => onAddNode(label)}
            >
              <Icon className="sidebar-icon w-5 h-5" />
            </button>
            <span className="operation-label text-[10px] leading-tight text-gray-600 text-center mt-1 font-serif">
              {label}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}