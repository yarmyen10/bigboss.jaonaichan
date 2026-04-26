import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import BasicTableOne, {
  BasicTableColumn,
} from "../../components/tables/BasicTables/BasicTableOne";
import Badge from "../../components/ui/badge/Badge";

interface DemoOrder {
  id: number;
  user: { image: string; name: string; role: string };
  projectName: string;
  team: { images: string[] };
  status: string;
  budget: string;
}

const demoData: DemoOrder[] = [
  {
    id: 1,
    user: { image: "/images/user/user-17.jpg", name: "Lindsey Curtis", role: "Web Designer" },
    projectName: "Agency Website",
    team: { images: ["/images/user/user-22.jpg", "/images/user/user-23.jpg", "/images/user/user-24.jpg"] },
    budget: "3.9K",
    status: "Active",
  },
  {
    id: 2,
    user: { image: "/images/user/user-18.jpg", name: "Kaiya George", role: "Project Manager" },
    projectName: "Technology",
    team: { images: ["/images/user/user-25.jpg", "/images/user/user-26.jpg"] },
    budget: "24.9K",
    status: "Pending",
  },
  {
    id: 3,
    user: { image: "/images/user/user-17.jpg", name: "Zain Geidt", role: "Content Writing" },
    projectName: "Blog Writing",
    team: { images: ["/images/user/user-27.jpg"] },
    budget: "12.7K",
    status: "Active",
  },
  {
    id: 4,
    user: { image: "/images/user/user-20.jpg", name: "Abram Schleifer", role: "Digital Marketer" },
    projectName: "Social Media",
    team: { images: ["/images/user/user-28.jpg", "/images/user/user-29.jpg", "/images/user/user-30.jpg"] },
    budget: "2.8K",
    status: "Cancel",
  },
  {
    id: 5,
    user: { image: "/images/user/user-21.jpg", name: "Carla George", role: "Front-end Developer" },
    projectName: "Website",
    team: { images: ["/images/user/user-31.jpg", "/images/user/user-32.jpg", "/images/user/user-33.jpg"] },
    budget: "4.5K",
    status: "Active",
  },
];

const columns: BasicTableColumn[] = [
  { key: "user", label: "User", className: "px-5 py-4 sm:px-6" },
  { key: "projectName", label: "Project Name" },
  { key: "team", label: "Team" },
  { key: "status", label: "Status" },
  { key: "budget", label: "Budget" },
];

const rows = demoData.map((order) => ({
  user: (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 overflow-hidden rounded-full">
        <img width={40} height={40} src={order.user.image} alt={order.user.name} />
      </div>
      <div>
        <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
          {order.user.name}
        </span>
        <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
          {order.user.role}
        </span>
      </div>
    </div>
  ),
  projectName: order.projectName,
  team: (
    <div className="flex -space-x-2">
      {order.team.images.map((teamImage, index) => (
        <div
          key={index}
          className="w-6 h-6 overflow-hidden border-2 border-white rounded-full dark:border-gray-900"
        >
          <img
            width={24}
            height={24}
            src={teamImage}
            alt={`Team member ${index + 1}`}
            className="w-full size-6"
          />
        </div>
      ))}
    </div>
  ),
  status: (
    <Badge
      size="sm"
      color={
        order.status === "Active"
          ? "success"
          : order.status === "Pending"
          ? "warning"
          : "error"
      }
    >
      {order.status}
    </Badge>
  ),
  budget: order.budget,
}));

export default function BasicTables() {
  return (
    <>
      <PageMeta
        title="React.js Basic Tables Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Basic Tables Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Basic Tables" />
      <div className="space-y-6">
        <ComponentCard title="Basic Table 1">
          <BasicTableOne columns={columns} rows={rows} />
        </ComponentCard>
      </div>
    </>
  );
}
