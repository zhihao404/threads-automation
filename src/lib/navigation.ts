import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Calendar,
  CalendarDays,
  FileBarChart,
  FileText,
  LayoutDashboard,
  MessageCircle,
  PenSquare,
  Plus,
  Repeat,
  Settings,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

export interface DashboardNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface DashboardNavSection {
  label: string;
  items: DashboardNavItem[];
}

export const dashboardNavSections: DashboardNavSection[] = [
  {
    label: "Main",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Content",
    items: [
      { title: "Posts", href: "/posts", icon: PenSquare },
      { title: "New Post", href: "/posts/new", icon: Plus },
      { title: "Schedule", href: "/posts/schedule", icon: Calendar },
      { title: "Recurring", href: "/posts/recurring", icon: Repeat },
      { title: "Templates", href: "/posts/templates", icon: FileText },
    ],
  },
  {
    label: "AI",
    items: [
      { title: "AI Generate", href: "/ai/generate", icon: Sparkles },
      { title: "AI Insights", href: "/ai/insights", icon: Brain },
      { title: "Content Calendar", href: "/ai/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { title: "Engagement", href: "/dashboard/engagement", icon: Activity },
      { title: "Followers", href: "/dashboard/followers", icon: UserPlus },
      { title: "Replies", href: "/replies", icon: MessageCircle },
      { title: "Reports", href: "/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Notifications", href: "/notifications", icon: Bell },
      { title: "Accounts", href: "/accounts", icon: Users },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/posts": "Posts",
  "/posts/new": "New Post",
  "/posts/queue": "Queue",
  "/posts/schedule": "Schedule",
  "/posts/recurring": "Recurring",
  "/posts/templates": "Templates",
  "/ai/generate": "AI Generate",
  "/ai/insights": "AI Insights",
  "/ai/calendar": "Content Calendar",
  "/dashboard/analytics": "Analytics",
  "/dashboard/engagement": "Engagement",
  "/dashboard/followers": "Followers",
  "/replies": "Replies",
  "/accounts": "Accounts",
  "/reports": "Reports",
  "/settings": "Settings",
  "/settings/billing": "Billing",
  "/notifications": "Notifications",
};

export function getPageTitle(pathname: string): string {
  return (
    pageTitles[pathname] ||
    pathname
      .split("/")
      .pop()
      ?.replace(/-/g, " ")
      ?.replace(/\b\w/g, (letter) => letter.toUpperCase()) ||
    "Dashboard"
  );
}
