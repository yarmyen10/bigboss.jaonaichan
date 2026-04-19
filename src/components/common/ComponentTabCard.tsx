import { TabDefault, TabOption } from "../ui/tabs";

interface ComponentTabCardProps {
  tabs?: TabOption[] | undefined;
  children: React.ReactNode;
  className?: string; // Additional custom classes for styling
  classNameBody?: string; // Additional custom classes for styling bodu
  desc?: string; // Description text
  onChange?: (value: string) => void;
}

const ComponentTabCard: React.FC<ComponentTabCardProps> = ({
  tabs,
  children,
  className = "",
  classNameBody = "",
  desc = "",
  onChange,
}) => {

  const handleTab = (value: string) => {
    // Handle save logic here
    console.log("📑 Tab:", value);
    onChange?.(value);
    // if (tabs?.length) {
    //   desc = tabs.find((tab: TabOption) => tab.value = value)?.desc ?? "";
    // }
  };

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
    >
      {/* Card Header */}
      <div className="px-6 py-5">
        <div className="relative max-w-fit flex-1">
          <TabDefault options={tabs} onChange={handleTab}/>
        </div>
        {desc && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {desc}
          </p>
        )}
      </div>

      {/* Card Body */}
      <div className={`p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6 ${classNameBody}`}>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
};

export default ComponentTabCard;
