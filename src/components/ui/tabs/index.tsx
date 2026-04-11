import { useState } from "react";

interface TabOption {
    value: string;
    label: string;
}

interface ChartTabProps {
    options?: TabOption[];
    defaultValue?: string;
    onChange?: (value: string) => void;
}

const DEFAULT_OPTIONS: TabOption[] = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "annually", label: "Annually" },
];

const TabDefault: React.FC<ChartTabProps> = ({
    options = DEFAULT_OPTIONS,
    defaultValue,
    onChange,
}) => {
    const [selected, setSelected] = useState<string>(
        defaultValue ?? options[0]?.value ?? ""
    );

    const handleSelect = (value: string) => {
        setSelected(value);
        onChange?.(value);
    };

    return (
        <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900">
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`px-3 py-2 font-medium w-full rounded-md text-theme-sm hover:text-gray-900 dark:hover:text-white transition-colors ${selected === option.value
                            ? "shadow-theme-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};

export { TabDefault };
export type { TabOption };
