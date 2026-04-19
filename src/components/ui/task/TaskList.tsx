import { useState } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
} from "@dnd-kit/sortable";
import TaskItem from "./index";

const initialTasks = [
    { id: "1", title: "Finish user onboarding" },
    { id: "2", title: "Design new dashboard" },
    { id: "3", title: "Fix login bug" },
];

export default function TaskList() {
    const [tasks, setTasks] = useState(initialTasks);

    return (
        <DndContext
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;

                setTasks((items) => {
                    const oldIndex = items.findIndex((item) => item.id === active.id);
                    const newIndex = items.findIndex((item) => item.id === over.id);
                    return arrayMove(items, oldIndex, newIndex);
                });
            }}
        >
            <SortableContext
                items={tasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-3">
                    {tasks.map((task) => (
                        <TaskItem
                            key={task.id}
                            id={task.id}
                            title={task.title}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}