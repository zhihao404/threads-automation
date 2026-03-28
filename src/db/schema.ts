import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// =============================================================================
// Better Auth tables
// =============================================================================

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// =============================================================================
// Application tables
// =============================================================================

export const threadsAccounts = sqliteTable(
  "threads_accounts",
  {
    id: text("id").primaryKey(), // ULID
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    threadsUserId: text("threads_user_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    accessToken: text("access_token").notNull(), // encrypted
    tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }).notNull(),
    profilePictureUrl: text("profile_picture_url"),
    biography: text("biography"),
    isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("threads_accounts_user_id_idx").on(table.userId),
    uniqueIndex("threads_accounts_threads_user_id_idx").on(table.threadsUserId),
  ],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(), // ULID
    accountId: text("account_id")
      .notNull()
      .references(() => threadsAccounts.id, { onDelete: "cascade" }),
    threadsMediaId: text("threads_media_id"), // set after publish
    content: text("content").notNull(),
    mediaType: text("media_type", {
      enum: ["TEXT", "IMAGE", "VIDEO", "CAROUSEL"],
    }).notNull(),
    mediaUrls: text("media_urls"), // JSON array
    topicTag: text("topic_tag"),
    replyControl: text("reply_control", {
      enum: ["everyone", "accounts_you_follow", "mentioned_only"],
    })
      .notNull()
      .default("everyone"),
    replyToId: text("reply_to_id"), // for reply posts
    status: text("status", {
      enum: ["draft", "scheduled", "queued", "publishing", "published", "failed"],
    })
      .notNull()
      .default("draft"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").notNull().default(0),
    permalink: text("permalink"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("posts_account_id_idx").on(table.accountId),
    index("posts_status_idx").on(table.status),
    index("posts_scheduled_at_idx").on(table.scheduledAt),
  ],
);

export const postMetrics = sqliteTable(
  "post_metrics",
  {
    id: text("id").primaryKey(), // ULID
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    reposts: integer("reposts").notNull().default(0),
    quotes: integer("quotes").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("post_metrics_post_id_idx").on(table.postId),
  ],
);

export const accountMetrics = sqliteTable(
  "account_metrics",
  {
    id: text("id").primaryKey(), // ULID
    accountId: text("account_id")
      .notNull()
      .references(() => threadsAccounts.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    reposts: integer("reposts").notNull().default(0),
    quotes: integer("quotes").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    followersCount: integer("followers_count").notNull().default(0),
    fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("account_metrics_account_id_date_idx").on(table.accountId, table.date),
  ],
);

export const postTemplates = sqliteTable("post_templates", {
  id: text("id").primaryKey(), // ULID
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  mediaType: text("media_type", {
    enum: ["TEXT", "IMAGE", "VIDEO", "CAROUSEL"],
  })
    .notNull()
    .default("TEXT"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const recurringSchedules = sqliteTable("recurring_schedules", {
  id: text("id").primaryKey(), // ULID
  accountId: text("account_id")
    .notNull()
    .references(() => threadsAccounts.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => postTemplates.id, {
    onDelete: "set null",
  }),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const postQueue = sqliteTable(
  "post_queue",
  {
    id: text("id").primaryKey(), // ULID
    accountId: text("account_id")
      .notNull()
      .references(() => threadsAccounts.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("post_queue_post_id_idx").on(table.postId),
  ],
);

// =============================================================================
// Relations
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  threadsAccounts: many(threadsAccounts),
  postTemplates: many(postTemplates),
  subscriptions: many(subscriptions),
  usageRecords: many(usageRecords),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(users, {
    fields: [session.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(users, {
    fields: [account.userId],
    references: [users.id],
  }),
}));

export const threadsAccountsRelations = relations(threadsAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [threadsAccounts.userId],
    references: [users.id],
  }),
  posts: many(posts),
  accountMetrics: many(accountMetrics),
  recurringSchedules: many(recurringSchedules),
  postQueue: many(postQueue),
  reports: many(reports),
  notifications: many(notifications),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  account: one(threadsAccounts, {
    fields: [posts.accountId],
    references: [threadsAccounts.id],
  }),
  metrics: many(postMetrics),
  queueEntries: many(postQueue),
}));

export const postMetricsRelations = relations(postMetrics, ({ one }) => ({
  post: one(posts, {
    fields: [postMetrics.postId],
    references: [posts.id],
  }),
}));

export const accountMetricsRelations = relations(accountMetrics, ({ one }) => ({
  account: one(threadsAccounts, {
    fields: [accountMetrics.accountId],
    references: [threadsAccounts.id],
  }),
}));

export const postTemplatesRelations = relations(postTemplates, ({ one, many }) => ({
  user: one(users, {
    fields: [postTemplates.userId],
    references: [users.id],
  }),
  recurringSchedules: many(recurringSchedules),
}));

export const recurringSchedulesRelations = relations(recurringSchedules, ({ one }) => ({
  account: one(threadsAccounts, {
    fields: [recurringSchedules.accountId],
    references: [threadsAccounts.id],
  }),
  template: one(postTemplates, {
    fields: [recurringSchedules.templateId],
    references: [postTemplates.id],
  }),
}));

export const postQueueRelations = relations(postQueue, ({ one }) => ({
  account: one(threadsAccounts, {
    fields: [postQueue.accountId],
    references: [threadsAccounts.id],
  }),
  post: one(posts, {
    fields: [postQueue.postId],
    references: [posts.id],
  }),
}));

// =============================================================================
// Type exports
// =============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export type ThreadsAccount = typeof threadsAccounts.$inferSelect;
export type NewThreadsAccount = typeof threadsAccounts.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type PostMetric = typeof postMetrics.$inferSelect;
export type NewPostMetric = typeof postMetrics.$inferInsert;

export type AccountMetric = typeof accountMetrics.$inferSelect;
export type NewAccountMetric = typeof accountMetrics.$inferInsert;

export type PostTemplate = typeof postTemplates.$inferSelect;
export type NewPostTemplate = typeof postTemplates.$inferInsert;

export type RecurringSchedule = typeof recurringSchedules.$inferSelect;
export type NewRecurringSchedule = typeof recurringSchedules.$inferInsert;

export type PostQueueEntry = typeof postQueue.$inferSelect;
export type NewPostQueueEntry = typeof postQueue.$inferInsert;

// =============================================================================
// Reports table
// =============================================================================

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(), // ULID
    accountId: text("account_id")
      .notNull()
      .references(() => threadsAccounts.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["weekly", "monthly"] }).notNull(),
    title: text("title").notNull(),
    periodStart: text("period_start").notNull(), // YYYY-MM-DD
    periodEnd: text("period_end").notNull(), // YYYY-MM-DD
    content: text("content").notNull(), // Full HTML report content
    summary: text("summary").notNull(), // AI-generated summary
    metrics: text("metrics").notNull(), // JSON: aggregated metrics snapshot
    status: text("status", { enum: ["generating", "completed", "failed"] })
      .notNull()
      .default("generating"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("reports_account_id_idx").on(table.accountId),
    index("reports_created_at_idx").on(table.createdAt),
  ],
);

export const reportsRelations = relations(reports, ({ one }) => ({
  account: one(threadsAccounts, {
    fields: [reports.accountId],
    references: [threadsAccounts.id],
  }),
}));

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;

// =============================================================================
// Webhook & Notifications tables
// =============================================================================

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(), // ULID
    accountId: text("account_id")
      .notNull()
      .references(() => threadsAccounts.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["reply", "mention", "publish", "delete", "token_refresh_failed"] }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    metadata: text("metadata"), // JSON: additional data (permalink, username, etc.)
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("notifications_account_id_idx").on(table.accountId),
    index("notifications_created_at_idx").on(table.createdAt),
  ],
);

export const webhookEvents = sqliteTable("webhook_events", {
  id: text("id").primaryKey(), // ULID
  topic: text("topic").notNull(),
  payload: text("payload").notNull(), // Raw JSON
  processed: integer("processed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// =============================================================================
// Webhook & Notifications relations
// =============================================================================

export const notificationsRelations = relations(notifications, ({ one }) => ({
  account: one(threadsAccounts, {
    fields: [notifications.accountId],
    references: [threadsAccounts.id],
  }),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

// =============================================================================
// Subscriptions & Usage tables
// =============================================================================

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(), // ULID
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    plan: text("plan", { enum: ["free", "pro", "business"] })
      .notNull()
      .default("free"),
    status: text("status", {
      enum: ["active", "canceled", "past_due", "trialing", "incomplete"],
    })
      .notNull()
      .default("active"),
    currentPeriodStart: integer("current_period_start", { mode: "timestamp" }),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("subscriptions_user_id_idx").on(table.userId),
    uniqueIndex("subscriptions_stripe_subscription_id_idx").on(table.stripeSubscriptionId),
  ],
);

export const usageRecords = sqliteTable(
  "usage_records",
  {
    id: text("id").primaryKey(), // ULID
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["post", "ai_generation", "schedule", "template"],
    }).notNull(),
    count: integer("count").notNull().default(0),
    periodStart: text("period_start").notNull(), // YYYY-MM-DD
    periodEnd: text("period_end").notNull(), // YYYY-MM-DD
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("usage_records_user_period_idx").on(table.userId, table.periodStart),
    uniqueIndex("usage_records_user_type_period_idx").on(table.userId, table.type, table.periodStart),
  ],
);

// =============================================================================
// Subscriptions & Usage relations
// =============================================================================

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, {
    fields: [usageRecords.userId],
    references: [users.id],
  }),
}));

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;

// =============================================================================
// Rate Limits table
// =============================================================================

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    key: text("key").notNull(), // userId or IP
    endpoint: text("endpoint").notNull(),
    windowStart: integer("window_start").notNull(), // Unix timestamp in ms
    count: integer("count").notNull().default(1),
  },
  (table) => [
    uniqueIndex("rate_limits_key_endpoint_idx").on(table.key, table.endpoint),
  ],
);

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
