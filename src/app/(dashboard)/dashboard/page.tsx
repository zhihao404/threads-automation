import {
  Eye,
  Heart,
  MessageCircle,
  Users,
  TrendingUp,
  TrendingDown,
  Plus,
  Calendar,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const kpiCards = [
  {
    title: "Views",
    value: "12,483",
    trend: "+12.5%",
    trendUp: true,
    icon: Eye,
    description: "vs last 7 days",
  },
  {
    title: "Likes",
    value: "3,247",
    trend: "+8.2%",
    trendUp: true,
    icon: Heart,
    description: "vs last 7 days",
  },
  {
    title: "Replies",
    value: "482",
    trend: "-2.1%",
    trendUp: false,
    icon: MessageCircle,
    description: "vs last 7 days",
  },
  {
    title: "Followers",
    value: "1,829",
    trend: "+4.3%",
    trendUp: true,
    icon: Users,
    description: "net new this week",
  },
];

const recentPosts = [
  {
    id: "1",
    content: "Excited to share our latest product update! Check it out...",
    status: "published",
    likes: 142,
    replies: 23,
    date: "2 hours ago",
  },
  {
    id: "2",
    content: "Thread about building in public - lessons learned this month...",
    status: "published",
    likes: 89,
    replies: 15,
    date: "5 hours ago",
  },
  {
    id: "3",
    content: "What are your top 3 productivity tips? I will go first...",
    status: "scheduled",
    likes: 0,
    replies: 0,
    date: "Tomorrow, 9:00 AM",
  },
  {
    id: "4",
    content: "We just hit 10K followers! Thank you all for the support...",
    status: "draft",
    likes: 0,
    replies: 0,
    date: "Draft",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back!</h2>
        <p className="text-muted-foreground">
          Here is an overview of your Threads performance.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center gap-1 pt-1">
                {kpi.trendUp ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${
                    kpi.trendUp ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {kpi.trend}
                </span>
                <span className="text-xs text-muted-foreground">
                  {kpi.description}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Posts */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Posts</CardTitle>
              <CardDescription>Your latest Threads activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/posts">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-start gap-4 rounded-lg border p-3"
                >
                  <div className="flex-1 space-y-1">
                    <p className="text-sm leading-relaxed line-clamp-2">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{post.date}</span>
                      {post.status === "published" && (
                        <>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3" /> {post.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />{" "}
                            {post.replies}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      post.status === "published"
                        ? "default"
                        : post.status === "scheduled"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {post.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks at a glance</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button asChild className="w-full justify-start gap-2">
              <Link href="/posts/new">
                <Plus className="h-4 w-4" />
                New Post
              </Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full justify-start gap-2"
            >
              <Link href="/posts/schedule">
                <Calendar className="h-4 w-4" />
                Schedule Post
              </Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full justify-start gap-2"
            >
              <Link href="/dashboard/analytics">
                <BarChart3 className="h-4 w-4" />
                View Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
