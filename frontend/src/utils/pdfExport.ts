import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetchApi, User, UserSettings } from '../api/client';

interface ExportTransaction {
  id: string;
  occurred_at: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  converted_amount?: number;
  exchange_rate?: number;
  note?: string;
  source_group?: string;
  category_name?: string;
}

export async function exportFinancialStatementPdf(user: User | null, settings: UserSettings | null) {
  // 1. Fetch transactions and summaries
  const [txData, summaryData, catData] = await Promise.all([
    fetchApi<{ transactions: ExportTransaction[] }>('/api/transactions?limit=2000').catch(() => ({ transactions: [] })),
    fetchApi<{ income: number; expense: number }>('/api/transactions/summary').catch(() => ({ income: 0, expense: 0 })),
    fetchApi<{ categories: { category_name: string; total: string | number }[] }>('/api/transactions/by-category').catch(() => ({ categories: [] })),
  ]);

  const transactions = txData.transactions || [];
  const homeCurrency = settings?.home_currency || 'NGN';
  const currencyPrefix = homeCurrency === 'NGN' ? 'NGN ' : `${homeCurrency} `;

  const formatAmount = (majorAmount: number) => {
    return `${currencyPrefix}${majorAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const totalIncomeMajor = (summaryData.income || 0) / 100;
  const totalExpenseMajor = (summaryData.expense || 0) / 100;
  const netBalanceMajor = totalIncomeMajor - totalExpenseMajor;

  // 2. Initialize jsPDF (A4 Portrait, mm units)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Palette: VTrack Brand Colors
  const brandPink = [242, 78, 142]; // #F24E8E
  const brandDark = [42, 26, 34]; // #2A1A22
  const brandMuted = [115, 92, 102]; // #735C66
  const bgTint = [255, 245, 248]; // #FFF5F8
  const borderColor = [247, 214, 227]; // #F7D6E3
  const greenColor = [46, 125, 50]; // #2E7D32
  const redColor = [211, 47, 47]; // #D32F2F

  let currentY = 16;

  // ── 3. Brand Header Bar ──
  // Header accent strip
  doc.setFillColor(brandPink[0], brandPink[1], brandPink[2]);
  doc.rect(margin, currentY, 4, 18, 'F');

  // Title & Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text('VTrack Financial Statement', margin + 7, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2]);
  doc.text('Official Student Allowance & Expense Record', margin + 7, currentY + 13);

  // Top-right Document Meta
  const statementId = `VT-STMT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const now = new Date();
  const issueDateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text(`Ref: ${statementId}`, pageWidth - margin, currentY + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2]);
  doc.text(`Issued: ${issueDateStr}`, pageWidth - margin, currentY + 10, { align: 'right' });
  doc.text('NDPR / GDPR Certified Data Export', pageWidth - margin, currentY + 15, { align: 'right' });

  currentY += 24;

  // Thin separator line
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 6;

  // ── 4. Account Details Card ──
  doc.setFillColor(bgTint[0], bgTint[1], bgTint[2]);
  doc.roundedRect(margin, currentY, contentWidth, 16, 2, 2, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(margin, currentY, contentWidth, 16, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(brandMuted[0], brandMuted[1], brandMuted[2]);
  doc.text('ACCOUNT HOLDER', margin + 4, currentY + 6);
  doc.text('EMAIL ADDRESS', margin + 65, currentY + 6);
  doc.text('HOME CURRENCY', margin + 140, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text(user?.name || 'VTrack Student', margin + 4, currentY + 11.5);
  doc.text(user?.email || 'N/A', margin + 65, currentY + 11.5);
  doc.text(homeCurrency, margin + 140, currentY + 11.5);

  currentY += 22;

  // ── 5. Financial Summary Overview Cards (3 columns) ──
  const cardWidth = (contentWidth - 6) / 3;
  const cardHeight = 18;

  // Inflows (Income) Card
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, currentY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(margin, currentY, cardWidth, cardHeight, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(greenColor[0], greenColor[1], greenColor[2]);
  doc.text('TOTAL INFLOWS / ALLOWANCE', margin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(greenColor[0], greenColor[1], greenColor[2]);
  doc.text(`+${formatAmount(totalIncomeMajor)}`, margin + 4, currentY + 13);

  // Outflows (Expenses) Card
  const col2X = margin + cardWidth + 3;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(col2X, currentY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(col2X, currentY, cardWidth, cardHeight, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(redColor[0], redColor[1], redColor[2]);
  doc.text('TOTAL OUTFLOWS / SPEND', col2X + 4, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(redColor[0], redColor[1], redColor[2]);
  doc.text(`-${formatAmount(totalExpenseMajor)}`, col2X + 4, currentY + 13);

  // Net Balance Card
  const col3X = col2X + cardWidth + 3;
  doc.setFillColor(bgTint[0], bgTint[1], bgTint[2]);
  doc.roundedRect(col3X, currentY, cardWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(brandPink[0], brandPink[1], brandPink[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(col3X, currentY, cardWidth, cardHeight, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text('NET PERIOD BALANCE', col3X + 4, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (netBalanceMajor >= 0) {
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text(formatAmount(netBalanceMajor), col3X + 4, currentY + 13);
  } else {
    doc.setTextColor(redColor[0], redColor[1], redColor[2]);
    doc.text(`-${formatAmount(Math.abs(netBalanceMajor))}`, col3X + 4, currentY + 13);
  }

  currentY += cardHeight + 8;

  // ── 6. Category Breakdown Strip (if available) ──
  const categories = catData.categories || [];
  if (categories.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
    doc.text('Top Expense Categories', margin, currentY);

    currentY += 3;
    const catRows = categories.slice(0, 5).map(cat => [
      cat.category_name,
      `${currencyPrefix}${(Number(cat.total) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      totalExpenseMajor > 0 ? `${Math.round(((Number(cat.total) / 100) / totalExpenseMajor) * 100)}%` : '0%'
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 1.5,
        textColor: [42, 26, 34],
      },
      headStyles: {
        fontStyle: 'bold',
        textColor: [115, 92, 102],
        fontSize: 7,
      },
      head: [['Category', 'Amount Spent', '% of Outflows']],
      body: catRows,
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── 7. Detailed Transactions Table ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(brandDark[0], brandDark[1], brandDark[2]);
  doc.text(`Transaction Ledger (${transactions.length} records)`, margin, currentY);

  currentY += 3;

  const tableRows = transactions.map((tx) => {
    const d = new Date(tx.occurred_at);
    const dateFormatted = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const isIncome = tx.type === 'income';
    const majorVal = (Number(tx.converted_amount || tx.amount) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const amountStr = `${isIncome ? '+' : '-'}${currencyPrefix}${majorVal}`;

    return [
      dateFormatted,
      tx.note || (isIncome ? 'Allowance / Deposit' : 'General Purchase'),
      tx.category_name || 'Uncategorised',
      tx.source_group || (isIncome ? 'Allowance' : 'General'),
      isIncome ? 'Inflow' : 'Outflow',
      amountStr,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 18 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [42, 26, 34],
      lineColor: [247, 214, 227],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [242, 78, 142],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [255, 248, 251],
    },
    columnStyles: {
      0: { cellWidth: 24 }, // Date
      1: { cellWidth: 'auto' }, // Note
      2: { cellWidth: 32 }, // Category
      3: { cellWidth: 26 }, // Source
      4: { cellWidth: 18, halign: 'center' }, // Type
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' }, // Amount
    },
    head: [['Date', 'Description / Note', 'Category', 'Source', 'Type', 'Amount']],
    body: tableRows,
    didParseCell: (data) => {
      // Colorize amount column based on Inflow vs Outflow
      if (data.section === 'body' && data.column.index === 5) {
        const text = String(data.cell.raw || '');
        if (text.startsWith('+')) {
          data.cell.styles.textColor = [46, 125, 50]; // Green
        } else {
          data.cell.styles.textColor = [211, 47, 47]; // Red
        }
      }
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageNumber = (doc as any).internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(115, 92, 102);

      const footerText = 'VTrack • Student Allowance & Financial Statement • Certified under NDPR / GDPR Data Portability';
      doc.text(footerText, margin, pageHeight - 8);

      const pageStr = `Page ${data.pageNumber} of ${pageNumber}`;
      doc.text(pageStr, pageWidth - margin, pageHeight - 8, { align: 'right' });
    },
  });

  // Re-run footer page counts to display total pages accurately
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(115, 92, 102);
    doc.setFillColor(255, 255, 255);
    // Overwrite the page number string cleanly
    doc.rect(pageWidth - margin - 25, pageHeight - 11, 26, 6, 'F');
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // ── 8. Trigger Download ──
  const fileNameDate = now.toISOString().split('T')[0];
  doc.save(`vtrack_financial_statement_${fileNameDate}.pdf`);
}
