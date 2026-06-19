export const metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>

      <section className="prose prose-sm text-muted-foreground space-y-4">
        <p>Last updated: {new Date().getFullYear()}</p>

        <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
        <p>We collect your name, email address, and optional phone number when you register. We store the dates and details of any inquiries or stays you create on the platform.</p>

        <h2 className="text-lg font-semibold text-foreground">Why we collect it</h2>
        <p>Your information is used solely to operate the StayBase platform — to identify your account, send you booking-related notifications, and let hosts and guests communicate.</p>

        <h2 className="text-lg font-semibold text-foreground">Data storage</h2>
        <p>All data is stored in the EU. Passwords are hashed with bcrypt (cost 12) and never stored in plain text. Data in transit is encrypted with TLS.</p>

        <h2 className="text-lg font-semibold text-foreground">Your rights (GDPR)</h2>
        <p>You may request deletion of your account and all associated personal data at any time. To do so, sign in and use the account deletion option, or contact us at the email below. We will process your request within 30 days.</p>

        <h2 className="text-lg font-semibold text-foreground">Cookies</h2>
        <p>We use one httpOnly session cookie to keep you logged in. No analytics or advertising cookies are used.</p>

        <h2 className="text-lg font-semibold text-foreground">Contact</h2>
        <p>For any privacy-related requests, email: <a href="mailto:privacy@staybase.app" className="text-primary hover:underline">privacy@staybase.app</a></p>
      </section>
    </div>
  )
}
