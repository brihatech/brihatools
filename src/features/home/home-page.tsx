import { FileText, Image, LayoutPanelTop, UserCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const TOOLS = [
  {
    category: "design",
    description: "Batch photos onto frames",
    href: "/framer",
    icon: Image,
    title: "Photo Framer",
  },
  {
    category: "design",
    description: "Create custom posters",
    href: "/poster",
    icon: LayoutPanelTop,
    title: "Poster Builder",
  },
  {
    category: "design",
    description: "Facebook profile frames",
    href: "/fb-frame",
    icon: UserCircle,
    title: "FB Frame",
  },
  {
    category: "documents",
    description: "Extract Nepali PDF tables",
    href: "/nepali-pdf",
    icon: FileText,
    title: "PDF Extractor",
  },
  {
    category: "documents",
    description: "Enter Bansawali data",
    href: "/bansawali-data-entry",
    icon: FileText,
    title: "Bansawali Entry",
  },
] as const;

const CATEGORIES = [
  { id: "all", label: "All Tools" },
  { id: "design", label: "Design" },
  { id: "documents", label: "Documents" },
] as const;

export function HomePage() {
  const [activeCategory, setActiveCategory] = useState<
    "all" | "images" | "documents" | "design"
  >("all");

  const filteredTools =
    activeCategory === "all"
      ? TOOLS
      : TOOLS.filter((tool) => tool.category === activeCategory);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <h1 className="font-bold text-2xl text-foreground">brihatools</h1>
        <p className="mt-1 text-muted-foreground">
          Utility Tools powered by{" "}
          <a
            className="text-[#133395] hover:underline"
            href="https://www.brihatech.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            brihatech
          </a>
        </p>
      </header>

      <div className="mb-6 flex gap-2 border-b">
        {CATEGORIES.map((category) => (
          <button
            className={`border-b-2 px-1 pb-3 font-medium text-sm transition-colors ${
              activeCategory === category.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            type="button"
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filteredTools.map((tool) => (
          <Link key={tool.href} to={tool.href}>
            <div className="group flex items-center gap-3 rounded-lg border p-4 transition-colors hover:border-primary hover:bg-accent">
              <tool.icon className="size-5 text-primary" />
              <div>
                <div className="font-medium">{tool.title}</div>
                <div className="text-muted-foreground text-sm">
                  {tool.description}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
