import { ReactNode } from "react";

// Props for Table
interface TableProps {
  children: ReactNode; // Table content (thead, tbody, etc.)
  className?: string; // Optional className for styling
}

// Props for TableHeader
interface TableHeaderProps {
  children: ReactNode; // Header row(s)
  className?: string; // Optional className for styling
  style?: React.CSSProperties;
}

// Props for TableBody
interface TableBodyProps {
  children: ReactNode; // Body row(s)
  className?: string; // Optional className for styling
  style?: React.CSSProperties; // Optional style for styling
}

// Props for TableRow
interface TableRowProps {
  children: ReactNode; // Cells (th or td)
  className?: string; // Optional className for styling
  style?: React.CSSProperties; // Optional style for styling
  onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  onTouchStart?: (e: React.TouchEvent<HTMLTableRowElement>) => void;
  onTouchMove?: (e: React.TouchEvent<HTMLTableRowElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLTableRowElement>) => void;
  onTouchCancel?: (e: React.TouchEvent<HTMLTableRowElement>) => void;
}

// Props for TableCell
interface TableCellProps {
  children: ReactNode; // Cell content
  isHeader?: boolean; // If true, renders as <th>, otherwise <td>
  style?: React.CSSProperties; // Optional style for styling
  className?: string; // Optional className for styling
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  colSpan?: number;
}

// Table Component
const Table: React.FC<TableProps> = ({ children, className = "" }) => {
  return <table className={`min-w-full  ${className}`}>{children}</table>;
};

// TableHeader Component
const TableHeader: React.FC<TableHeaderProps> = ({ children, className, style }) => {
  return <thead className={className} style={style}>{children}</thead>;
};

// TableBody Component
const TableBody: React.FC<TableBodyProps> = ({ children, className, style }) => {
  return <tbody className={className} style={style}>{children}</tbody>;
};

// TableRow Component
const TableRow: React.FC<TableRowProps> = ({ children, className, style, onClick, onMouseDown, onMouseUp, onMouseLeave, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel }) => {
  return (
    <tr
      className={className}
      style={style}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      {children}
    </tr>
  );
};

// TableCell Component
const TableCell: React.FC<TableCellProps> = ({
  children,
  isHeader = false,
  style,
  className,
  onClick,
  colSpan,
}) => {
  const CellTag = isHeader ? "th" : "td";
  return <CellTag 
    style={style}
    className={`${className}`}
    onClick={onClick}
    colSpan={colSpan}
  >
    {children}
  </CellTag>;
};

export { Table, TableHeader, TableBody, TableRow, TableCell };
