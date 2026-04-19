import { useMemo, useState } from "react";
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    closestCorners,
    useDroppable,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import TaskItem from "./index";

type Task = {
    id: string;
    title: string;
    tag?: string;
    dueDate?: string;
    comments?: number;
    avatar?: string;
};

type Lists = {
    todo: Task[];
    done: Task[];
};

const initialLists: Lists = {
    todo: [
        {
            id: "1",
            title: "Finish user onboarding",
            tag: "Marketing",
            dueDate: "Tomorrow",
            comments: 1,
            avatar: "https://jaonaichan.com/wp-content/uploads/2026/03/S__8413199_0-150x150.jpg",
        },
        {
            id: "2",
            title: "Design dashboard",
            tag: "Product",
            dueDate: "Today",
            comments: 3,
            avatar: "https://i.pravatar.cc/40?img=15",
        },
    ],
    done: [
        {
            id: "3",
            title: "Fix login bug",
            tag: "Dev",
            dueDate: "Yesterday",
            comments: 2,
            avatar: "https://i.pravatar.cc/40?img=20",
        },
    ],
};

function BoardColumn({
    id,
    title,
    items,
}: {
    id: keyof Lists;
    title: string;
    items: Task[];
}) {
    const { setNodeRef, isOver } = useDroppable({
        id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`rounded-2xl border p-4 transition ${isOver ? "border-blue-400 bg-blue-50/40" : "border-slate-200 bg-white dark:border-gray-800 dark:bg-white/5"
                }`}
        >
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-medium text-gray-800 dark:text-white/90">
                    {title} ({items.length})
                </h2>
            </div>

            <SortableContext
                items={items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-3">
                    {items.length > 0 ? (
                        items.map((task) => (
                            <TaskItem
                                key={task.id}
                                id={task.id}
                                title={task.title}
                                tag={task.tag}
                                dueDate={task.dueDate}
                                comments={task.comments}
                                avatar={task.avatar}
                            />
                        ))
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-400">
                            Drop here
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

export default function TaskBoard() {
    const [lists, setLists] = useState<Lists>(initialLists);
    const [activeId, setActiveId] = useState<string | null>(null);

    const findContainer = (id: string): keyof Lists | undefined => {
        if (id in lists) return id as keyof Lists;

        return (Object.keys(lists) as (keyof Lists)[]).find((key) =>
            lists[key].some((item) => item.id === id)
        );
    };

    const getTaskById = (id: string | null) => {
        if (!id) return null;
        const container = findContainer(id);
        if (!container) return null;
        return lists[container].find((item) => item.id === id) ?? null;
    };

    const activeTask = useMemo(() => getTaskById(activeId), [activeId, lists]);

    const moveBetweenContainers = (
        prev: Lists,
        from: keyof Lists,
        to: keyof Lists,
        activeId: string,
        overId: string
    ): Lists => {
        const fromItems = [...prev[from]];
        const toItems = from === to ? fromItems : [...prev[to]];

        const activeIndex = fromItems.findIndex((item) => item.id === activeId);
        if (activeIndex === -1) return prev;

        const [movedItem] = fromItems.splice(activeIndex, 1);

        const overIsContainer = overId in prev;
        const overIndex = overIsContainer
            ? toItems.length
            : toItems.findIndex((item) => item.id === overId);

        const insertIndex = overIndex >= 0 ? overIndex : toItems.length;
        toItems.splice(insertIndex, 0, movedItem);

        return {
            ...prev,
            [from]: fromItems,
            [to]: toItems,
        };
    };

    const handleDragStart = ({ active }: DragStartEvent) => {
        setActiveId(String(active.id));
    };

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        setActiveId(null);
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        const from = findContainer(activeId);
        const to = findContainer(overId) ?? (overId as keyof Lists);

        if (!from || !to) return;

        if (from === to) {
            if (activeId === overId) return;

            setLists((prev) => {
                const oldIndex = prev[from].findIndex((item) => item.id === activeId);
                const newIndex = prev[to].findIndex((item) => item.id === overId);

                if (oldIndex === -1) return prev;

                if (newIndex === -1) {
                    return {
                        ...prev,
                        [from]: prev[from],
                    };
                }

                return {
                    ...prev,
                    [from]: arrayMove(prev[from], oldIndex, newIndex),
                };
            });
            return;
        }

        setLists((prev) => moveBetweenContainers(prev, from, to, activeId, overId));
    };

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DndContext
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <BoardColumn id="todo" title="To Do" items={lists.todo} />
                <BoardColumn id="done" title="Done" items={lists.done} />

                <DragOverlay>
                    {activeTask ? (
                        <div className="opacity-90">
                            <TaskItem
                                id={activeTask.id}
                                title={activeTask.title}
                                tag={activeTask.tag}
                                dueDate={activeTask.dueDate}
                                comments={activeTask.comments}
                                avatar={activeTask.avatar}
                            />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}