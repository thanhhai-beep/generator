
import { AnalyzerTool } from "@/components/analyzer-tool";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Web Insight Analyzer",
  description: "Instantly check the title and status of any website.",
};

export default function DomainAnalyzerPage() {
  return (
    <div className="w-full space-y-4">
        <div className="text-center mb-8">
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Web Insight Analyzer
            </h1>
            <p className="text-lg text-muted-foreground sm:text-xl">
                Instantly check the title and status of any website.
            </p>
        </div>
        <div className="w-full">
            <AnalyzerTool />
        </div>
    </div>
  );
}
