import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div
      className="min-h-screen py-16 px-4"
      style={{ background: 'linear-gradient(135deg, #060810 0%, #0a0f1e 40%, #0c1222 100%)' }}
    >
      <div className="max-w-2xl mx-auto text-slate-300">
        <Link to="/" className="text-sm text-blue-400 hover:text-blue-300">&larr; Back to TradeVault</Link>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: July 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">What TradeVault is</h2>
            <p>TradeVault is a personal trading journal application. It lets you log trades, upload trade screenshots, and track your trading performance over time.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Information we collect</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Account information: your name and email address, provided directly or via Google Sign-In.</li>
              <li>Trading data you enter: trades, notes, missed opportunities, and screenshots you upload.</li>
              <li>Basic technical data (browser, device) needed to operate the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">How we use Google account data</h2>
            <p>When you sign in with Google, we only request your email address and basic profile information to create and authenticate your TradeVault account. We do not access your Gmail, contacts, files, or any other Google data.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Where your data is stored</h2>
            <p>Your data is stored in a Supabase (PostgreSQL) database dedicated to TradeVault, protected by row-level security so that only you can access your own trades and files. We do not sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Your rights</h2>
            <p>You can delete your trades, missed opportunities, and screenshots at any time from within the app. To request full account deletion, contact us at the address below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
            <p>Questions about this policy: <a href="mailto:support@tradevault.app" className="text-blue-400 hover:text-blue-300">support@tradevault.app</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
