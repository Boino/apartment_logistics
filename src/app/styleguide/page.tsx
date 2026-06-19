import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusPill } from '@/components/ui/status-pill'
import { Stepper } from '@/components/ui/stepper'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Package } from 'lucide-react'

export const metadata = { title: 'Styleguide' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 border-b pb-2 text-xl font-semibold">{title}</h2>
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  )
}

export default function StyleguidePage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">StayBase UI Styleguide</h1>
      <p className="mb-10 text-muted-foreground">All components rendered for visual review</p>

      <Section title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="Badges">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="purple">Purple</Badge>
      </Section>

      <Section title="Status Pills">
        {['DRAFT', 'PUBLISHED', 'ARCHIVED', 'OPEN', 'ANSWERED', 'CONFIRMED', 'DECLINED', 'UPCOMING', 'IN_HOUSE', 'COMPLETED', 'REQUESTED', 'ACCEPTED', 'DONE', 'STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY', 'FULL', 'LOW', 'EMPTY'].map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </Section>

      <Section title="Spinner">
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" />
      </Section>

      <Section title="Avatar">
        <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
        <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
      </Section>

      <section className="mb-10">
        <h2 className="mb-4 border-b pb-2 text-xl font-semibold">Inputs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email" type="email" placeholder="you@example.com" />
          <Input label="Password" type="password" placeholder="••••••••" />
          <Input label="With Error" error="This field is required" />
          <Textarea label="Message" placeholder="Type your message…" rows={3} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 border-b pb-2 text-xl font-semibold">Card</h2>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>A simple card component</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Card body content goes here.</p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 border-b pb-2 text-xl font-semibold">Tabs</h2>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1"><p className="mt-2 text-sm">Content for Tab 1</p></TabsContent>
          <TabsContent value="tab2"><p className="mt-2 text-sm">Content for Tab 2</p></TabsContent>
          <TabsContent value="tab3"><p className="mt-2 text-sm">Content for Tab 3</p></TabsContent>
        </Tabs>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 border-b pb-2 text-xl font-semibold">Table</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Beach House</TableCell>
              <TableCell><StatusPill status="PUBLISHED" /></TableCell>
              <TableCell>€120/night</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>City Flat</TableCell>
              <TableCell><StatusPill status="DRAFT" /></TableCell>
              <TableCell>€85/night</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 border-b pb-2 text-xl font-semibold">Stepper</h2>
        <Stepper
          steps={[
            { label: 'Details' },
            { label: 'Photos' },
            { label: 'Amenities' },
            { label: 'Publish' },
          ]}
          currentStep={1}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-4 border-b pb-2 text-xl font-semibold">Empty State</h2>
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No listings yet"
          description="Create your first listing to get started."
          action={<Button>Create Listing</Button>}
        />
      </section>
    </div>
  )
}
