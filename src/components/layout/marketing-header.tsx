import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
}

interface MarketingHeaderProps {
  /**
   * Navigation items. Defaults to landing page anchors.
   * Override for pages like /pricing that need Link-based navigation.
   */
  navItems?: NavItem[];
}

const defaultNavItems: NavItem[] = [
  { label: "機能", href: "#features" },
  { label: "料金", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function MarketingHeader({ navItems = defaultNavItems }: MarketingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold">Threads Auto</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <Button key={item.href} variant="ghost" size="sm" asChild>
                {item.href.startsWith("#") ? (
                  <a href={item.href}>{item.label}</a>
                ) : (
                  <Link href={item.href}>{item.label}</Link>
                )}
              </Button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">ログイン</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 hover:from-purple-700 hover:to-pink-700"
          >
            <Link href="/register">無料で始める</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
