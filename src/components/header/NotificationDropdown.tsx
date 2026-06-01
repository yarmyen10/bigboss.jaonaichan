import { useState } from "react";
import { useNavigate } from "react-router";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { useNotifications } from "../../hooks/useNotifications";
import { ORDER_STATUS_DETAILS } from "../../config/orderStatus.jaonaichan";
import Badge from "../ui/badge/Badge";

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "เมื่อกี้";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { items, unreadCount, markAllRead, dismiss } = useNotifications();
  const navigate = useNavigate();

  const handleOpen = () => {
    setIsOpen(true);
    markAllRead();
  };

  const handleItemClick = (orderId: number) => {
    setIsOpen(false);
    navigate(`/order-jaonaichan?orderId=${orderId}`);
  };

  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full dropdown-toggle hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
      >
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0.5 z-10 flex h-2 w-2 rounded-full bg-orange-400">
            <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping" />
          </span>
        )}
        <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            การแจ้งเตือน
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-orange-400 text-white text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </h5>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg className="fill-current" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {items.length === 0 ? (
            <li className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
              <svg width="40" height="40" viewBox="0 0 20 20" fill="currentColor" className="mb-2 opacity-40">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
                />
              </svg>
              <span className="text-sm">ไม่มีการแจ้งเตือน</span>
            </li>
          ) : (
            items.map(item => {
              const statusDetail = ORDER_STATUS_DETAILS[item.status];
              return (
                <li key={item.orderId}>
                  <div
                    onClick={() => handleItemClick(item.orderId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && handleItemClick(item.orderId)}
                    className={`group cursor-pointer relative flex flex-col gap-1.5 rounded-xl mx-1 mb-1 px-3.5 py-3 border transition-colors ${
                      !item.read
                        ? "bg-brand-50 border-brand-100 dark:bg-brand-500/8 dark:border-brand-500/20"
                        : "bg-white border-gray-100 dark:bg-white/3 dark:border-white/8 hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                  >
                    {/* unread dot */}
                    {!item.read && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-400" />
                    )}

                    {/* row 1: name + dismiss */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-gray-800 dark:text-white/90 truncate">
                        {item.customerName}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); dismiss(item.orderId); }}
                        className="flex-shrink-0 p-1 -mr-1 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-200 dark:text-white/20 dark:hover:text-white/60 dark:hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="ปิดการแจ้งเตือน"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path fillRule="evenodd" clipRule="evenodd" d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z" />
                        </svg>
                      </button>
                    </div>

                    {/* row 2: badge + order# */}
                    <div className="flex items-center gap-2">
                      {statusDetail && (
                        <Badge color={statusDetail.color} size="sm">
                          {statusDetail.text}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        #{item.orderNumber}
                      </span>
                    </div>

                    {/* row 3: time + amount */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {timeAgo(item.detectedAt)}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                        ฿{item.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </Dropdown>
    </div>
  );
}
