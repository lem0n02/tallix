import React from 'react';
import { Check, X } from 'lucide-react';

export const ComparisonTable: React.FC = () => {
  const comparisonRows = [
    {
      feature: 'Automated Debt Graph Reduction',
      tallix: true,
      spreadsheet: false,
      notes: false,
    },
    {
      feature: 'Real-time Multi-User Squad Sync',
      tallix: true,
      spreadsheet: false,
      notes: false,
    },
    {
      feature: 'Receipt Scanning & Proof Attachments',
      tallix: true,
      spreadsheet: false,
      notes: false,
    },
    {
      feature: 'Server-side AI Anomaly Detection',
      tallix: true,
      spreadsheet: false,
      notes: false,
    },
    {
      feature: 'Exportable CSV & JSON Tax Audits',
      tallix: true,
      spreadsheet: true,
      notes: false,
    },
    {
      feature: 'Zero Manual Formula Errors',
      tallix: true,
      spreadsheet: false,
      notes: false,
    },
  ];

  return (
    <section id="why-tallix" className="py-20 bg-[#09090b] border-t border-[#27272a]">
      <div className="max-w-7xl mx-auto px-6 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">
            Why Switch To Tallix
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#fafafa] tracking-tight">
            Stop Wrestling With Spreadsheets
          </h2>
          <p className="text-sm text-[#a1a1aa]">
            See how Tallix compares against traditional manual tracking tools.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#27272a] bg-[#1c1c1f]">
                  <th className="p-4 md:p-6 text-xs font-bold uppercase tracking-wider text-[#71717a] w-1/2">
                    Capabilities
                  </th>
                  <th className="p-4 md:p-6 text-center text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/20 w-1/6 border-x border-[#27272a]">
                    Tallix
                  </th>
                  <th className="p-4 md:p-6 text-center text-xs font-bold uppercase tracking-wider text-[#a1a1aa] w-1/6">
                    Spreadsheet
                  </th>
                  <th className="p-4 md:p-6 text-center text-xs font-bold uppercase tracking-wider text-[#a1a1aa] w-1/6">
                    Manual Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a] text-xs">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 md:p-6 font-medium text-[#fafafa]">
                      {row.feature}
                    </td>
                    <td className="p-4 md:p-6 text-center bg-emerald-950/10 border-x border-[#27272a]">
                      {row.tallix ? (
                        <div className="inline-flex p-1 bg-emerald-500/20 rounded-full text-emerald-400">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <X className="w-4 h-4 text-[#52525b] inline" />
                      )}
                    </td>
                    <td className="p-4 md:p-6 text-center">
                      {row.spreadsheet ? (
                        <div className="inline-flex p-1 bg-white/10 rounded-full text-[#a1a1aa]">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <X className="w-4 h-4 text-[#52525b] inline" />
                      )}
                    </td>
                    <td className="p-4 md:p-6 text-center">
                      {row.notes ? (
                        <div className="inline-flex p-1 bg-white/10 rounded-full text-[#a1a1aa]">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <X className="w-4 h-4 text-[#52525b] inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
