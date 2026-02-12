import { FileText, Image, LayoutPanelTop, Plus } from "lucide-react";
import { Link } from "react-router";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const TOOLS = [
  {
    description: "Batch compose photos onto branded frames",
    href: "/framer",
    icon: Image,
    title: "Photo Framer",
  },
  {
    description: "Compose a portrait into a custom poster layout",
    href: "/poster",
    icon: LayoutPanelTop,
    title: "Poster Builder",
  },
  {
    description: "Extract Nepali tables to Unicode CSV/Excel",
    href: "/nepali-pdf",
    icon: FileText,
    title: "Nepali PDF Table Extractor",
  },
] as const;

export function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <h1 className="font-bold text-2xl text-foreground sm:text-3xl">
          Available Tools
        </h1>
        <p className="mt-1 text-muted-foreground">
          Select a utility to begin your workflow.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {TOOLS.map((tool) => (
          <Link key={tool.href} to={tool.href}>
            <Card className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <tool.icon className="size-5 text-primary" />
                </div>
                <CardTitle className="text-base transition-colors group-hover:text-primary sm:text-lg">
                  {tool.title}
                </CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}

        <Card className="flex h-full flex-col items-center justify-center border-dashed p-6 opacity-50">
          <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-muted">
            <Plus className="size-5 text-muted-foreground" />
          </div>
          <p className="text-center font-medium text-muted-foreground text-sm">
            More coming soon
          </p>
        </Card>
      </div>
    </main>
  );
}
