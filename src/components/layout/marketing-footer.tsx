import Link from "next/link";
import { Sparkles } from "lucide-react";

interface FooterLink {
  label: string;
  href: string;
}

interface MarketingFooterProps {
  /**
   * Footer navigation links. Defaults to standard marketing links.
   */
  links?: FooterLink[];
}

const defaultLinks: FooterLink[] = [
  { label: "機能", href: "/#features" },
  { label: "料金", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "利用規約", href: "/terms" },
  { label: "プライバシーポリシー", href: "/privacy" },
  { label: "特定商取引法", href: "/tokushoho" },
];

export function MarketingFooter({ links = defaultLinks }: MarketingFooterProps) {
  return (
    <footer className="border-t bg-muted/30 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-base font-semibold">Threads Auto</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Threadsの成長を加速する、オールインワンの運用ツール。
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Threads Auto. All rights
          reserved.
        </div>
      </div>
    </footer>
  );
}
