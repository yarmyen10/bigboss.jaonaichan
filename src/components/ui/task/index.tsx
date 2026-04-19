import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Checkbox from "../../form/input/Checkbox";
import Badge from "../badge/Badge";

type TaskItemProps = {
    id: string;
    title: string;
    tag?: string;
    dueDate?: string;
    comments?: number;
    avatar?: string;
};

export default function TaskItem({
    id,
    title,
    tag = "Marketing",
    dueDate = "Tomorrow",
    comments = 1,
    avatar = "https://i.pravatar.cc/40?img=12",
}: TaskItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between p-5 mb-4 border border-gray-200 rounded-xl shadow-theme-sm dark:border-gray-800 dark:bg-white/5 ${isDragging ? "opacity-80" : ""
                }`}
        >
            <div className="flex items-center gap-3">
                <button
                    {...attributes}
                    {...listeners}
                    className={`text-slate-400 hover:text-white ${isDragging ? "!cursor-grabbing" : "!cursor-grab"}`}
                >
                    <span className="text-gray-400">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fill-rule="evenodd" clip-rule="evenodd" d="M2.43311 5.0001C2.43311 4.50304 2.83605 4.1001 3.33311 4.1001L16.6664 4.1001C17.1635 4.1001 17.5664 4.50304 17.5664 5.0001C17.5664 5.49715 17.1635 5.9001 16.6664 5.9001L3.33311 5.9001C2.83605 5.9001 2.43311 5.49716 2.43311 5.0001ZM2.43311 15.0001C2.43311 14.503 2.83605 14.1001 3.33311 14.1001L16.6664 14.1001C17.1635 14.1001 17.5664 14.503 17.5664 15.0001C17.5664 15.4972 17.1635 15.9001 16.6664 15.9001L3.33311 15.9001C2.83605 15.9001 2.43311 15.4972 2.43311 15.0001ZM3.33311 9.1001C2.83605 9.1001 2.43311 9.50304 2.43311 10.0001C2.43311 10.4972 2.83605 10.9001 3.33311 10.9001L16.6664 10.9001C17.1635 10.9001 17.5664 10.4972 17.5664 10.0001C17.5664 9.50304 17.1635 9.1001 16.6664 9.1001L3.33311 9.1001Z" fill="currentColor" />
                        </svg>
                    </span>
                </button>

                {/* <div className="h-5 w-5 rounded-md border border-slate-600" /> */}
                <Checkbox id={`checkbox-${id}`} checked={true} onChange={() => {}} />
                <span className="-mt-0.5 text-base text-gray-800 dark:text-white/90">{title}</span>
            </div>

            <div className="flex items-center gap-4 text-sm text-slate-300">
                {/* <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-300">
                    {tag}
                </span> */}
                <Badge variant="light" color={'light'} >{tag}</Badge>

                <div className="flex items-center gap-1">
                    <span>📅</span>
                    <span>{dueDate}</span>
                </div>

                <div className="flex items-center gap-1">
                    <span>💬</span>
                    <span>{comments}</span>
                </div>

                <img
                    src={avatar}
                    alt="avatar"
                    className="h-8 w-8 rounded-full object-cover"
                />
            </div>
        </div>
    );
}