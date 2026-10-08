import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
      <header className="border-b border-border pb-6">
        <h1 className="text-page-title font-semibold">CivicFix</h1>
        <p className="mt-2 max-w-prose text-body">
          Community-powered civic issue reporting and resolution platform.
        </p>
      </header>

      <section aria-labelledby="type-sample" className="flex flex-col gap-3">
        <h2 id="type-sample" className="text-section font-semibold">
          Type
        </h2>
        <h3 className="text-subsection font-semibold">Subsection</h3>
        <p className="max-w-prose text-body">
          Body text for records, descriptions, and explanations.
        </p>
        <p className="text-small text-muted-foreground">
          Small text for supporting detail.
        </p>
        <p className="text-label font-semibold">Label</p>
        <p className="text-metadata text-muted-foreground">Metadata</p>
      </section>

      <section aria-labelledby="control-sample" className="flex flex-col gap-6">
        <h2 id="control-sample" className="text-section font-semibold">
          Controls
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="w-full sm:w-auto">Primary</Button>
          <Button variant="secondary" className="w-full sm:w-auto">
            Secondary
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Badge variant="outline">Neutral</Badge>
          </li>
          <li>
            <Badge variant="success">Success</Badge>
          </li>
          <li>
            <Badge variant="warning">Warning</Badge>
          </li>
          <li>
            <Badge variant="destructive">Destructive</Badge>
          </li>
        </ul>
        <p>
          <a href="#control-sample">Text link</a>
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sample-place">Place</Label>
          <Input id="sample-place" autoComplete="off" aria-describedby="sample-place-hint" />
          <p id="sample-place-hint" className="text-small text-muted-foreground">
            Example field.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Surface</CardTitle>
          </CardHeader>
          <CardContent>
            <p>A bordered panel for grouped information.</p>
            <dl className="mt-4 border border-border text-small">
              <div className="flex items-baseline justify-between gap-4 border-b border-border px-3 py-2">
                <dt className="font-semibold">Label</dt>
                <dd className="text-metadata text-muted-foreground">Metadata</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-3 py-2">
                <dt className="font-semibold">Label</dt>
                <dd className="text-metadata text-muted-foreground">Metadata</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
