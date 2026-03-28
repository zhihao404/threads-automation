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
    lastRefreshAt: integer("last_refresh_at", { mode: "timestamp" }),
    refreshFailureCount: integer("refresh_failure_count").notNull().default(0),
    refreshError: text("refresh_error"),
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
    maxRetries: integer("max_retries").notNull().default(3),
    permalink: text("permalink"),
    dedupeKey: text("dedupe_key"), // SHA-256 hash of account+content+scheduledAt for idempotency
    containerId: text("container_id"), // Threads media container ID for publish resumption
    lastErrorCategory: text("last_error_category", {
      enum: ["retryable", "non_retryable", "manual_intervention"],
    }), // error classification for retry logic
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("posts_account_id_idx").on(table.accountId),
    index("posts_status_idx").on(table.status),
    index("posts_scheduled_at_idx").on(table.scheduledAt),
    uniqueIndex("posts_dedupe_key_idx").on(table.dedupeKey),
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
  replyDrafts: many(replyDrafts),
  replyDecisions: many(replyDecisions),
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
  profileApiUsage: many(profileApiUsage),
  inboxItems: many(inboxItems),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  account: one(threadsAccounts, {
    fields: [posts.accountId],
    references: [threadsAccounts.id],
  }),
  metrics: many(postMetrics),
  queueEntries: many(postQueue),
  publishAttempts: many(publishAttempts),
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

export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(), // ULID
    topic: text("topic").notNull(),
    metaEventId: text("meta_event_id"), // For deduplication of Meta webhook events
    payload: text("payload").notNull(), // Raw JSON
    processed: integer("processed", { mode: "boolean" }).notNull().default(false),
    receivedAt: integer("received_at", { mode: "timestamp" }), // When the event was received
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("webhook_events_meta_event_id_idx").on(table.metaEventId),
  ],
);

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

// =============================================================================
// Publish Attempts table (media container state machine audit log)
// =============================================================================

export const publishAttempts = sqliteTable(
  "publish_attempts",
  {
    id: text("id").primaryKey(), // ULID
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    containerId: text("container_id"), // Threads API container ID (null until created)
    status: text("status", {
      enum: [
        "creating",
        "processing",
        "polling",
        "publishing",
        "published",
        "failed",
        "expired",
      ],
    }).notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    errorMessage: text("error_message"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("publish_attempts_post_id_idx").on(table.postId),
    index("publish_attempts_status_idx").on(table.status),
  ],
);

export const publishAttemptsRelations = relations(publishAttempts, ({ one }) => ({
  post: one(posts, {
    fields: [publishAttempts.postId],
    references: [posts.id],
  }),
}));

export type PublishAttempt = typeof publishAttempts.$inferSelect;
export type NewPublishAttempt = typeof publishAttempts.$inferInsert;

// =============================================================================
// Profile API Usage table (rate gate tracking for Threads API limits)
// =============================================================================

export const profileApiUsage = sqliteTable(
  "profile_api_usage",
  {
    id: text("id").primaryKey(), // ULID
    threadsAccountId: text("threads_account_id")
      .notNull()
      .references(() => threadsAccounts.id, { onDelete: "cascade" }),
    actionType: text("action_type", {
      enum: ["post", "reply", "api_call"],
    }).notNull(),
    timestamp: integer("timestamp").notNull(), // Unix seconds when the action occurred
    createdAt: integer("created_at").notNull(), // Unix seconds
  },
  (table) => [
    index("profile_api_usage_account_action_idx").on(
      table.threadsAccountId,
      table.actionType,
    ),
    index("profile_api_usage_timestamp_idx").on(table.timestamp),
  ],
);

export const profileApiUsageRelations = relations(profileApiUsage, ({ one }) => ({
  account: one(threadsAccounts, {
    fields: [profileApiUsage.threadsAccountId],
    references: [threadsAccounts.id],
  }),
}));

export type ProfileApiUsage = typeof profileApiUsage.$inferSelect;
export type NewProfileApiUsage = typeof profileApiUsage.$inferInsert;

// =============================================================================
// Audit Events table
// =============================================================================

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(), // ULID
    actorId: text("actor_id"), // user ID or system identifier
    actorType: text("actor_type", {
      enum: ["user", "system", "webhook", "cron"],
    }).notNull(),
    action: text("action").notNull(), // e.g. 'post.create', 'data_deletion.request'
    resourceType: text("resource_type", {
      enum: ["post", "reply", "account", "template", "webhook_event"],
    }),
    resourceId: text("resource_id"),
    beforeState: text("before_state"), // JSON nullable - previous state
    afterState: text("after_state"), // JSON nullable - new state
    metadata: text("metadata"), // JSON nullable - extra context
    ipAddress: text("ip_address"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("audit_events_action_idx").on(table.action),
    index("audit_events_resource_idx").on(table.resourceType, table.resourceId),
    index("audit_events_actor_id_idx").on(table.actorId),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;

// =============================================================================
// Data Deletions table (tracks Meta GDPR deletion requests)
// =============================================================================

export const dataDeletions = sqliteTable(
  "data_deletions",
  {
    id: text("id").primaryKey(), // ULID
    threadsUserId: text("threads_user_id").notNull(),
    confirmationCode: text("confirmation_code").notNull().unique(),
    status: text("status", {
      enum: ["pending", "processing", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    tablesDeleted: text("tables_deleted"), // JSON array of table names processed
    errorMessage: text("error_message"),
    requestedAt: integer("requested_at", { mode: "timestamp" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("data_deletions_threads_user_id_idx").on(table.threadsUserId),
    index("data_deletions_confirmation_code_idx").on(table.confirmationCode),
  ],
);

export type DataDeletion = typeof dataDeletions.$inferSelect;
export type NewDataDeletion = typeof dataDeletions.$inferInsert;

// =============================================================================
// Reply Approval Workflow tables
// =============================================================================

/**
 * Inbox items represent incoming replies, mentions, and quotes received on
 * Threads posts. They form the starting point of the approval workflow:
 * receive -> classify -> AI draft -> approve -> send.
 */
export const inboxItems = sqliteTable(
  "inbox_items",
  {
    id: text("id").primaryKey(), // ULID
    threadsAccountId: text("threads_account_id")
      .notNull()
      .references(() => threadsAccounts.id, { onDelete: "cascade" }),
    threadsPostId: text("threads_post_id").notNull(), // original post that received the reply
    threadsReplyId: text("threads_reply_id").notNull(), // the incoming reply/mention media ID
    replyUsername: text("reply_username").notNull(),
    replyText: text("reply_text").notNull(),
    replyMediaUrl: text("reply_media_url"), // nullable
    replyTimestamp: integer("reply_timestamp").notNull(), // Unix seconds
    itemType: text("item_type", {
      enum: ["reply", "mention", "quote"],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "draft_ready", "approved", "sent", "ignored", "hidden"],
    })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("inbox_items_account_id_idx").on(table.threadsAccountId),
    index("inbox_items_status_idx").on(table.status),
    index("inbox_items_reply_timestamp_idx").on(table.replyTimestamp),
    uniqueIndex("inbox_items_threads_reply_id_idx").on(table.threadsReplyId),
  ],
);

/**
 * Reply drafts are AI-generated or manually created response drafts for an
 * inbox item. Multiple drafts can exist per inbox item (e.g. regenerated
 * suggestions) but only one is ultimately approved.
 */
export const replyDrafts = sqliteTable(
  "reply_drafts",
  {
    id: text("id").primaryKey(), // ULID
    inboxItemId: text("inbox_item_id")
      .notNull()
      .references(() => inboxItems.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    generatedBy: text("generated_by", {
      enum: ["ai", "manual"],
    }).notNull(),
    aiModel: text("ai_model"), // nullable - which model generated this
    aiPrompt: text("ai_prompt"), // nullable - the prompt used
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("reply_drafts_inbox_item_id_idx").on(table.inboxItemId),
  ],
);

/**
 * Reply decisions record approval/rejection actions taken on inbox items.
 * This provides a full audit trail of who approved/rejected/ignored each
 * incoming reply, supporting the mandatory approval workflow.
 */
export const replyDecisions = sqliteTable(
  "reply_decisions",
  {
    id: text("id").primaryKey(), // ULID
    inboxItemId: text("inbox_item_id")
      .notNull()
      .references(() => inboxItems.id, { onDelete: "cascade" }),
    replyDraftId: text("reply_draft_id").references(() => replyDrafts.id, {
      onDelete: "set null",
    }), // nullable - not required for ignore/hide decisions
    decision: text("decision", {
      enum: ["approve", "reject", "ignore", "hide", "edit_and_approve"],
    }).notNull(),
    decidedBy: text("decided_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"), // nullable - optional justification
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("reply_decisions_inbox_item_id_idx").on(table.inboxItemId),
    index("reply_decisions_decided_by_idx").on(table.decidedBy),
  ],
);

// =============================================================================
// Reply Approval Workflow relations
// =============================================================================

export const inboxItemsRelations = relations(inboxItems, ({ one, many }) => ({
  account: one(threadsAccounts, {
    fields: [inboxItems.threadsAccountId],
    references: [threadsAccounts.id],
  }),
  drafts: many(replyDrafts),
  decisions: many(replyDecisions),
}));

export const replyDraftsRelations = relations(replyDrafts, ({ one }) => ({
  inboxItem: one(inboxItems, {
    fields: [replyDrafts.inboxItemId],
    references: [inboxItems.id],
  }),
  createdByUser: one(users, {
    fields: [replyDrafts.createdBy],
    references: [users.id],
  }),
}));

export const replyDecisionsRelations = relations(replyDecisions, ({ one }) => ({
  inboxItem: one(inboxItems, {
    fields: [replyDecisions.inboxItemId],
    references: [inboxItems.id],
  }),
  draft: one(replyDrafts, {
    fields: [replyDecisions.replyDraftId],
    references: [replyDrafts.id],
  }),
  decidedByUser: one(users, {
    fields: [replyDecisions.decidedBy],
    references: [users.id],
  }),
}));

export type InboxItem = typeof inboxItems.$inferSelect;
export type NewInboxItem = typeof inboxItems.$inferInsert;

export type ReplyDraft = typeof replyDrafts.$inferSelect;
export type NewReplyDraft = typeof replyDrafts.$inferInsert;

export type ReplyDecision = typeof replyDecisions.$inferSelect;
export type NewReplyDecision = typeof replyDecisions.$inferInsert;
