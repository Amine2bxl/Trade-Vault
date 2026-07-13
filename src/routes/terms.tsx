import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/terms')({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div
      className="min-h-screen py-16 px-4"
      style={{ background: 'linear-gradient(135deg, #060810 0%, #0a0f1e 40%, #0c1222 100%)' }}
    >
      <div className="max-w-2xl mx-auto text-slate-300">
        <Link to="/" className="text-sm text-blue-400 hover:text-blue-300">&larr; Back to TradeVault</Link>
        <h1 className="text-3xl font-bold text-white mt-4 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: July 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Acceptance of terms</h2>
            <p>By creating an account and using TradeVault, you agree to these terms. If you do not agree, please do not use the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">The service</h2>
            <p>TradeVault is a personal trading journal for logging trades, tracking performance, and reviewing missed opportunities. It is provided "as is", without warranty of any kind.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Not financial advice</h2>
            <p>TradeVault is a record-keeping and analytics tool only. Nothing in the app constitutes financial, investment, or trading advice. You are solely responsible for your own trading decisions.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Your account and content</h2>
            <p>You are responsible for the accuracy of the data you enter and for keeping your account credentials secure. You retain ownership of the trades, notes, and screenshots you upload.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Acceptable use</h2>
            <p>You agree not to misuse the service, attempt to access other users' data, or use the app for any unlawful purpose.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Changes</h2>
            <p>We may update these terms from time to time. Continued use of TradeVault after changes means you accept the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Contact</h2>
            <p>Questions about these terms: <a href="mailto:tradevault@outlook.fr" className="text-blue-400 hover:text-blue-300">tradevault@outlook.fr</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
