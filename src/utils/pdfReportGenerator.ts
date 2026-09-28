import { jsPDF } from 'jspdf';
import { Expense, Settlement, UserProfile } from '../types';
import { formatMonthDisplay, getExpenseMonthKey, getCurrentMonthKey } from './monthFilter';
import { toPaisa, fromPaisa, sumExactAmounts } from './money';
import { isMemberMatch } from './balanceEngine';
import { compareHistoryItemsDesc } from './historyEngine';

export interface MonthlyReportData {
  monthKey: string;
  monthDisplay: string;
  generatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
    systemRole?: string;
  };
  expenses: {
    personal: Expense[];
    personalTotal: number;
    shared: Expense[];
    sharedTotal: number;
    totalAmount: number;
    allSorted: Expense[];
  };
  settlements: {
    items: Settlement[];
    totalActivity: number;
    settleUpTotal: number;
    settleDownTotal: number;
  };
}

/**
 * Checks if an expense belongs to the current user (paid or created by them).
 * Single shared source of truth for user expense ownership across Dashboard and PDF.
 */
export function isUserExpense(exp: Expense, user: { id: string; name: string; email?: string }): boolean {
  if (!exp || !user) return false;
  const cleanUserEmail = (user.email || '').toLowerCase();
  const userMember = { id: user.id, name: user.name, email: user.email };
  if (isMemberMatch(userMember, exp.paidByUserId, exp.paidByName)) return true;
  if (exp.paidByUserId && user.id && exp.paidByUserId === user.id) return true;
  if (exp.createdBy && user.id && exp.createdBy === user.id) return true;
  if (exp.createdByEmail && cleanUserEmail && (exp as any).createdByEmail.toLowerCase() === cleanUserEmail) return true;
  if (exp.paidByName && user.name) {
    const cleanExpName = exp.paidByName.toLowerCase().replace(/\(you\)/gi, '').trim();
    const cleanUserName = user.name.toLowerCase().replace(/\(you\)/gi, '').trim();
    if (cleanExpName === cleanUserName && cleanUserName.length > 0) return true;
  }
  return false;
}

/**
 * Checks if a settlement involves the current user (as payer, recipient, or creator).
 */
function isUserSettlement(stl: Settlement, user: UserProfile): boolean {
  const cleanUserEmail = (user.email || '').toLowerCase();
  const userMember = { id: user.id, name: user.name, email: user.email };
  return (
    isMemberMatch(userMember, stl.fromUserId, stl.fromUserName) ||
    isMemberMatch(userMember, stl.toUserId, stl.toUserName) ||
    stl.fromUserId === user.id ||
    stl.toUserId === user.id ||
    stl.requestedByUserId === user.id ||
    stl.createdBy === user.id
  );
}

/**
 * Aggregates all transactions and settlements for a specific calendar month.
 * Strictly separates expense totals from settlement activity.
 */
export function buildMonthlyReportData(
  monthKey: string,
  user: UserProfile,
  allExpenses: Expense[] = [],
  allSettlements: Settlement[] = []
): MonthlyReportData {
  const monthDisplay = formatMonthDisplay(monthKey);
  const now = new Date().toISOString();

  // 1. Filter expenses for this specific month
  const monthExpenses = allExpenses.filter((exp) => {
    const key = getExpenseMonthKey(exp.date);
    return key === monthKey && isUserExpense(exp, user);
  });

  const personal = monthExpenses.filter((e) => !e.isShared);
  const shared = monthExpenses.filter((e) => e.isShared);

  const personalTotal = sumExactAmounts(personal.map((e) => e.originalAmount ?? e.amount));
  const sharedTotal = sumExactAmounts(shared.map((e) => e.originalAmount ?? e.amount));
  const totalAmount = fromPaisa(toPaisa(personalTotal) + toPaisa(sharedTotal));

  const allSortedExpenses = [...monthExpenses].sort(compareHistoryItemsDesc);

  // 2. Filter settlements for this specific month
  const monthSettlements = allSettlements.filter((stl) => {
    const key = getExpenseMonthKey(stl.createdAt);
    return key === monthKey && isUserSettlement(stl, user);
  }).sort(compareHistoryItemsDesc);

  let settleUpPaisa = 0;
  let settleDownPaisa = 0;

  monthSettlements.forEach((s) => {
    const p = typeof s.amount_paisa === 'number' ? s.amount_paisa : toPaisa(s.originalAmount ?? s.amount);
    if (s.settlementType === 'SETTLE_DOWN') {
      settleDownPaisa += p;
    } else {
      settleUpPaisa += p;
    }
  });

  const settleUpTotal = fromPaisa(settleUpPaisa);
  const settleDownTotal = fromPaisa(settleDownPaisa);
  const totalActivity = fromPaisa(settleUpPaisa + settleDownPaisa);

  return {
    monthKey,
    monthDisplay,
    generatedAt: now,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      systemRole: user.systemRole,
    },
    expenses: {
      personal,
      personalTotal,
      shared,
      sharedTotal,
      totalAmount,
      allSorted: allSortedExpenses,
    },
    settlements: {
      items: monthSettlements,
      totalActivity,
      settleUpTotal,
      settleDownTotal,
    },
  };
}

/**
 * Generates an authoritative jsPDF document instance representing the monthly accounting report.
 */
export function generateMonthlyPdfDoc(reportData: MonthlyReportData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 18) {
      doc.addPage();
      cursorY = margin;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text(`TALLIX FINANCIAL ENGINE  |  MONTHLY ACCOUNTING STATEMENT  |  ${reportData.monthDisplay.toUpperCase()}`, margin, cursorY);
    cursorY += 4;
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.3);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 6;
  };

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, cursorY, contentWidth, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('TALLIX FINANCIAL ENGINE', margin + 6, cursorY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Official Monthly Accounting Statement - ${reportData.monthDisplay}`, margin + 6, cursorY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text('STATEMENT OF ACCOUNT', pageWidth - margin - 6, cursorY + 12, { align: 'right' });

  cursorY += 32;

  // Account Information Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, cursorY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('ACCOUNT HOLDER:', margin + 4, cursorY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${reportData.user.name} (${reportData.user.email})`, margin + 40, cursorY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('REPORTING PERIOD:', margin + 4, cursorY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(reportData.monthDisplay, margin + 40, cursorY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('GENERATED AT:', margin + 115, cursorY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(reportData.generatedAt.split('T')[0], margin + 145, cursorY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('ACCOUNT ROLE:', margin + 115, cursorY + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(reportData.user.systemRole || 'User', margin + 145, cursorY + 14);

  cursorY += 30;

  // Summary Metrics Cards (Separated!)
  const cardWidth = (contentWidth - 6) / 2;

  // Card 1: Expense Accounting
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, cursorY, cardWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('1. MONTHLY EXPENSE ACCOUNTING', margin + 4, cursorY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Personal Expenses:`, margin + 4, cursorY + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(`BDT ${reportData.expenses.personalTotal.toFixed(2)}`, margin + cardWidth - 4, cursorY + 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text(`Shared Contributions:`, margin + 4, cursorY + 19);
  doc.setFont('helvetica', 'bold');
  doc.text(`BDT ${reportData.expenses.sharedTotal.toFixed(2)}`, margin + cardWidth - 4, cursorY + 19, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 4, cursorY + 22, margin + cardWidth - 4, cursorY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199); // sky-600
  doc.text(`TOTAL EXPENSES:`, margin + 4, cursorY + 29);
  doc.text(`BDT ${reportData.expenses.totalAmount.toFixed(2)}`, margin + cardWidth - 4, cursorY + 29, { align: 'right' });

  // Card 2: Settlement Activity (Separated!)
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(margin + cardWidth + 6, cursorY, cardWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(6, 78, 59); // emerald-900
  doc.text('2. SETTLEMENT ACTIVITY (SEPARATE)', margin + cardWidth + 10, cursorY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text(`Settle Up Activity:`, margin + cardWidth + 10, cursorY + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(`BDT ${reportData.settlements.settleUpTotal.toFixed(2)}`, margin + contentWidth - 4, cursorY + 13, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text(`Settle Down Activity:`, margin + cardWidth + 10, cursorY + 19);
  doc.setFont('helvetica', 'bold');
  doc.text(`BDT ${reportData.settlements.settleDownTotal.toFixed(2)}`, margin + contentWidth - 4, cursorY + 19, { align: 'right' });

  doc.setDrawColor(187, 247, 208);
  doc.line(margin + cardWidth + 10, cursorY + 22, margin + contentWidth - 4, cursorY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`TOTAL SETTLEMENTS:`, margin + cardWidth + 10, cursorY + 29);
  doc.text(`BDT ${reportData.settlements.totalActivity.toFixed(2)}`, margin + contentWidth - 4, cursorY + 29, { align: 'right' });

  cursorY += 39;

  // Important Accounting Audit Note Banner
  doc.setFillColor(254, 242, 242); // rose-50
  doc.setDrawColor(254, 202, 202); // rose-200
  doc.roundedRect(margin, cursorY, contentWidth, 10, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(153, 27, 27); // rose-800
  doc.text(
    'ACCOUNTING RULE ENFORCED: Settlement activity is an independent balance adjustment and is strictly excluded from Expense totals.',
    margin + 4,
    cursorY + 6.5
  );

  cursorY += 16;

  // SECTION 1: EXPENSE TRANSACTIONS LEDGER TABLE
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Monthly Expense Transactions (${reportData.expenses.allSorted.length})`, margin, cursorY);
  cursorY += 4;

  // Table Header
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, cursorY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Date', margin + 3, cursorY + 4.8);
  doc.text('Description / Title', margin + 25, cursorY + 4.8);
  doc.text('Category', margin + 95, cursorY + 4.8);
  doc.text('Scope', margin + 130, cursorY + 4.8);
  doc.text('Amount (BDT)', margin + contentWidth - 3, cursorY + 4.8, { align: 'right' });
  cursorY += 7;

  if (reportData.expenses.allSorted.length === 0) {
    checkPageBreak(12);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, cursorY, contentWidth, 10, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('No expense transactions recorded for this billing period.', margin + 4, cursorY + 6.5);
    cursorY += 12;
  } else {
    reportData.expenses.allSorted.forEach((exp, idx) => {
      checkPageBreak(8);
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, cursorY, contentWidth, 6.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      const dStr = (exp.date || '').split('T')[0];
      doc.text(dStr, margin + 3, cursorY + 4.5);

      const desc = exp.title || exp.merchant || 'Expense';
      doc.text(desc.length > 35 ? desc.substring(0, 32) + '...' : desc, margin + 25, cursorY + 4.5);

      doc.text(exp.category || 'General', margin + 95, cursorY + 4.5);

      doc.setFont('helvetica', 'bold');
      if (exp.isShared) {
        doc.setTextColor(124, 58, 237); // purple
        doc.text('Shared Squad', margin + 130, cursorY + 4.5);
      } else {
        doc.setTextColor(37, 99, 235); // blue
        doc.text('Personal', margin + 130, cursorY + 4.5);
      }

      doc.setTextColor(15, 23, 42);
      const amtStr = (exp.originalAmount ?? exp.amount).toFixed(2);
      doc.text(`BDT ${amtStr}`, margin + contentWidth - 3, cursorY + 4.5, { align: 'right' });

      cursorY += 6.5;
    });
    cursorY += 4;
  }

  cursorY += 6;

  // SECTION 2: SETTLEMENT ACTIVITY TABLE (SEPARATE SECTION)
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Monthly Settlement Activity (${reportData.settlements.items.length}) - Separate Layer`, margin, cursorY);
  cursorY += 4;

  // Table Header
  doc.setFillColor(6, 78, 59); // emerald-900
  doc.rect(margin, cursorY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Date', margin + 3, cursorY + 4.8);
  doc.text('Settlement Type', margin + 25, cursorY + 4.8);
  doc.text('Counterparty / Squad', margin + 65, cursorY + 4.8);
  doc.text('Method', margin + 120, cursorY + 4.8);
  doc.text('Status', margin + 145, cursorY + 4.8);
  doc.text('Amount (BDT)', margin + contentWidth - 3, cursorY + 4.8, { align: 'right' });
  cursorY += 7;

  if (reportData.settlements.items.length === 0) {
    checkPageBreak(12);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, cursorY, contentWidth, 10, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('No settlement requests or records logged for this billing period.', margin + 4, cursorY + 6.5);
    cursorY += 12;
  } else {
    reportData.settlements.items.forEach((stl, idx) => {
      checkPageBreak(8);
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(240, 253, 244);
        doc.rect(margin, cursorY, contentWidth, 6.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      const dStr = (stl.createdAt || '').split('T')[0];
      doc.text(dStr, margin + 3, cursorY + 4.5);

      const isUp = stl.settlementType === 'SETTLE_UP';
      doc.setFont('helvetica', 'bold');
      if (isUp) {
        doc.setTextColor(5, 150, 105); // emerald
        doc.text('SETTLE UP (+Owed)', margin + 25, cursorY + 4.5);
      } else {
        doc.setTextColor(225, 29, 72); // rose
        doc.text('SETTLE DOWN (-Owe)', margin + 25, cursorY + 4.5);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      const cp = `${stl.fromUserName} -> ${stl.toUserName}`;
      doc.text(cp.length > 25 ? cp.substring(0, 22) + '...' : cp, margin + 65, cursorY + 4.5);

      doc.text(stl.paymentMethod || 'bKash', margin + 120, cursorY + 4.5);

      doc.setFont('helvetica', 'bold');
      if (stl.status === 'Accepted' || stl.status === 'Completed') {
        doc.setTextColor(5, 150, 105);
      } else if (stl.status === 'Cancelled' || stl.status === 'Rejected') {
        doc.setTextColor(225, 29, 72);
      } else {
        doc.setTextColor(217, 119, 6);
      }
      doc.text(stl.status || 'Pending', margin + 145, cursorY + 4.5);

      doc.setTextColor(15, 23, 42);
      const amtStr = (stl.originalAmount ?? stl.amount).toFixed(2);
      doc.text(`BDT ${amtStr}`, margin + contentWidth - 3, cursorY + 4.5, { align: 'right' });

      cursorY += 6.5;
    });
  }

  // Draw Page Footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.text('Tallix Production Financial Engine  •  Verified Immutable Client-Side Accounting', margin, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  return doc;
}

/**
 * Generates and triggers browser download of the monthly PDF report.
 */
export function downloadMonthlyPdf(
  monthKey: string,
  user: UserProfile,
  allExpenses: Expense[] = [],
  allSettlements: Settlement[] = []
): void {
  const data = buildMonthlyReportData(monthKey, user, allExpenses, allSettlements);
  const doc = generateMonthlyPdfDoc(data);
  const safeMonth = monthKey.replace('-', '_');
  doc.save(`Tallix_Monthly_Report_${safeMonth}.pdf`);
}

/**
 * Returns all available monthly keys from expenses, settlements, and current month in descending order.
 */
export function getAvailableReportMonths(
  allExpenses: Expense[] = [],
  allSettlements: Settlement[] = []
): string[] {
  const set = new Set<string>();
  set.add(getCurrentMonthKey());

  allExpenses.forEach((e) => {
    const k = getExpenseMonthKey(e.date);
    if (k) set.add(k);
  });

  allSettlements.forEach((s) => {
    const k = getExpenseMonthKey(s.createdAt);
    if (k) set.add(k);
  });

  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
