"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    postPublished: true,
    scheduledReminder: true,
    weeklyReport: false,
    newReplies: true,
    tokenExpiry: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your application preferences.
        </p>
      </div>

      <div className="grid gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>
              Configure your general application settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select defaultValue="asia-tokyo">
                <SelectTrigger id="timezone" className="w-full sm:w-72">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="utc">UTC</SelectItem>
                  <SelectItem value="us-eastern">US Eastern (ET)</SelectItem>
                  <SelectItem value="us-pacific">US Pacific (PT)</SelectItem>
                  <SelectItem value="europe-london">Europe/London (GMT)</SelectItem>
                  <SelectItem value="europe-paris">Europe/Paris (CET)</SelectItem>
                  <SelectItem value="asia-tokyo">Asia/Tokyo (JST)</SelectItem>
                  <SelectItem value="asia-shanghai">Asia/Shanghai (CST)</SelectItem>
                  <SelectItem value="australia-sydney">
                    Australia/Sydney (AEST)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select defaultValue="en">
                <SelectTrigger id="language" className="w-full sm:w-72">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="zh">Chinese (Simplified)</SelectItem>
                  <SelectItem value="ko">Korean</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Choose what notifications you want to receive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Post published</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when your post is published.
                </p>
              </div>
              <Switch
                checked={notifications.postPublished}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    postPublished: checked,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Scheduled post reminder</Label>
                <p className="text-sm text-muted-foreground">
                  Reminder before a scheduled post goes live.
                </p>
              </div>
              <Switch
                checked={notifications.scheduledReminder}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    scheduledReminder: checked,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Weekly report</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a weekly summary of your analytics.
                </p>
              </div>
              <Switch
                checked={notifications.weeklyReport}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    weeklyReport: checked,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>New replies</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when someone replies to your posts.
                </p>
              </div>
              <Switch
                checked={notifications.newReplies}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    newReplies: checked,
                  }))
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Token expiry warning</Label>
                <p className="text-sm text-muted-foreground">
                  Alert when your API tokens are about to expire.
                </p>
              </div>
              <Switch
                checked={notifications.tokenExpiry}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({
                    ...prev,
                    tokenExpiry: checked,
                  }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* API / Connected accounts */}
        <Card>
          <CardHeader>
            <CardTitle>API & Connected Accounts</CardTitle>
            <CardDescription>
              View connected account status and API token information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">@threads_main</p>
                <p className="text-xs text-muted-foreground">
                  Token expires in 52 days
                </p>
              </div>
              <Badge
                variant="secondary"
                className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              >
                <CheckCircle2 className="h-3 w-3" />
                Active
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">@brand_official</p>
                <p className="text-xs text-muted-foreground">
                  Token expires in 5 days
                </p>
              </div>
              <Badge
                variant="secondary"
                className="gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              >
                Expiring soon
              </Badge>
            </div>

            <div className="pt-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/accounts">Manage accounts</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
