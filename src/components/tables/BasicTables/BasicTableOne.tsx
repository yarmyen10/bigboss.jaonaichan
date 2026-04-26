import { ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";

export interface BasicTableColumn {
  key: string;
  label: ReactNode;
  className?: string;
}

interface BasicTableOneProps {
  columns: BasicTableColumn[];
  rows: Record<string, ReactNode>[];
}

export default function BasicTableOne({ columns, rows }: BasicTableOneProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  isHeader
                  className={twMerge(
                    "px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400",
                    col.className,
                  )}
                >
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {rows.map((row, rowIdx) => (
              <TableRow key={rowIdx}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={twMerge(
                      "px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400",
                      col.className,
                    )}
                  >
                    {row[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
