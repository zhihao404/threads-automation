"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "Threads Autoとは何ですか？",
    answer:
      "Threads Autoは、Meta Threadsのための総合管理ツールです。投稿の自動化・スケジュール管理、AIによるコンテンツ生成、パフォーマンス分析など、Threadsでの成長に必要な機能をワンストップで提供します。",
  },
  {
    question: "無料プランで何ができますか？",
    answer:
      "無料プランでは、1つのThreadsアカウントを連携し、月30件の投稿、5件のスケジュール投稿、10回のAI生成、基本的な分析機能をご利用いただけます。クレジットカードの登録は不要です。",
  },
  {
    question: "Threads APIのアクセスは必要ですか？",
    answer:
      "いいえ、特別なAPIアクセスの申請は不要です。Threads Autoの画面からThreadsアカウントを連携するだけで、すべての機能をご利用いただけます。",
  },
  {
    question: "データは安全ですか？",
    answer:
      "はい、お客様のデータの安全性を最優先に考えています。すべての通信はSSL暗号化され、データは安全なサーバーに保管されます。アカウント情報やコンテンツデータは厳重に管理されています。",
  },
  {
    question: "いつでもキャンセルできますか？",
    answer:
      "はい、いつでもキャンセル可能です。有料プランをキャンセルしても、現在の請求期間の終了まではすべての機能をご利用いただけます。キャンセル後は自動的に無料プランに移行します。",
  },
  {
    question: "サポートはありますか？",
    answer:
      "はい、すべてのプランでメールサポートをご利用いただけます。Businessプランでは優先サポートが含まれ、より迅速な対応が可能です。",
  },
];

function FAQItemComponent({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-purple-600"
      >
        <span className="pr-4 text-sm font-medium sm:text-base">
          {item.question}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FAQSection() {
  return (
    <div className="mx-auto max-w-2xl divide-y-0 rounded-2xl border bg-card px-6 sm:px-8">
      {faqItems.map((item) => (
        <FAQItemComponent key={item.question} item={item} />
      ))}
    </div>
  );
}
