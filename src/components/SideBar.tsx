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
  { icon: BiData, label: "CSV Data Loader", category: "loader" },
  { icon: MdCleaningServices, label: "Data Cleaner", category: "cleaner" },
  { icon: LuAtom, label: "Atomicity Checker", category: "cleaner" },
  { icon: TbDatabaseCog, label: "Data Type Profiler", category: "cleaner" },
  { icon: AiOutlineNodeIndex, label: "FD Miner", category: "mining" },
  { icon: FaKey, label: "Key Discovery", category: "mining" },
  { icon: FaCodeBranch, label: "Cardinality Analyzer", category: "mining" },
  { icon: RiNumber1, label: "1NF", category: "norm" },
  { icon: RiNumber2, label: "2NF", category: "norm" },
  { icon: RiNumber3, label: "3NF", category: "norm" },
  { icon: CiSquareCheck, label: "Lossless Check", category: "norm" },
  { icon: BsLock, label: "Dependency Preservation", category: "norm" },
  { icon: FaProjectDiagram, label: "ERD Generator", category: "gen" },
  { icon: MdAccountTree, label: "Relation Generator", category: "gen" },
  { icon: FiTarget, label: "SQL Generator", category: "gen" },
  { icon: HiOutlineDocumentReport, label: "Report Generator", category: "gen" },
];

export default function SideBar({ onAddNode }: { onAddNode: (label: string) => void }) {
  return (
    <nav
      className="sidebar-container h-full flex flex-col items-center py-2 px-1 gap-2 overflow-y-auto custom-scrollbar"
      aria-label="Pipeline Operations"
    >
      <ul className="flex flex-col gap-2.5 items-center w-full">
        {OPERATIONS_LIST.map(({ icon: Icon, label }) => (
          <li key={label} className="relative group flex items-center justify-center">
            <button
              type="button"
              aria-label={`Add ${label} node`}
              className="w-10 h-10 rounded-xl bg-white/90 hover:bg-teal-50 flex items-center justify-center text-gray-700 hover:text-teal-600 border border-gray-200/90 hover:border-teal-400 shadow-xs hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 active:scale-95"
              onClick={() => onAddNode(label)}
            >
              <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
            </button>

            {/* Ultra-sleek floating tooltip */}
            <div className="absolute left-12 px-2.5 py-1 bg-gray-900/90 backdrop-blur-md text-white text-xs rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 pointer-events-none z-50 font-serif border border-gray-700/50">
              {label}
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}