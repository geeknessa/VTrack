import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppFooter } from '../components/AppFooter';
import { exportFinancialStatementPdf } from '../utils/pdfExport';
import {
  FileText,
  ShieldCheck,
  ArrowLeft,
  Printer,
  Copy,
  Check,
  Download,
  Trash2,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';

interface LegalViewerProps {
  initialTab?: 'privacy' | 'terms';
}

export const LegalViewer: React.FC<LegalViewerProps> = ({ initialTab = 'terms' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(() => {
    if (location.pathname.includes('/privacy')) return 'privacy';
    if (location.pathname.includes('/terms')) return 'terms';
    return initialTab;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (location.pathname.includes('/privacy') && activeTab !== 'privacy') {
      setActiveTab('privacy');
    } else if (location.pathname.includes('/terms') && activeTab !== 'terms') {
      setActiveTab('terms');
    }
  }, [location.pathname]);

  const handleTabSwitch = (tab: 'privacy' | 'terms') => {
    setActiveTab(tab);
    setSearchQuery('');
    navigate(tab === 'privacy' ? '/privacy' : '/terms', { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportData = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setIsExporting(true);
    try {
      await exportFinancialStatementPdf(user, null);
    } catch (err: any) {
      alert(err.message || 'Failed to download fine PDF statement.');
    } finally {
      setIsExporting(false);
    }
  };

  const termsSections = useMemo(
    () => [
      {
        id: 'preamble',
        title: '1. PREAMBLE AND BINDING AGREEMENT',
        content: `
          1.1. These Terms of Service ("Terms" or "Agreement") constitute a legally binding agreement between you ("User," "you," or "your") and VTrack ("VTrack," "we," "us," or "our") governing your access to and use of the VTrack website, web application, APIs, and associated mobile or electronic services (collectively, the "Service").

          1.2. By registering an account, clicking an acceptance checkbox, accessing, or otherwise utilizing any portion of the Service, you acknowledge that you have read, understood, and unconditionally agree to be bound by all terms, conditions, policies, and notices contained herein, as well as the VTrack Privacy Policy incorporated by reference.

          1.3. IF YOU DO NOT AGREE TO THESE TERMS IN THEIR ENTIRETY, YOU ARE NOT AUTHORIZED TO ACCESS OR USE THE SERVICE AND MUST CEASE ALL USAGE IMMEDIATELY.
        `,
      },
      {
        id: 'eligibility',
        title: '2. ELIGIBILITY AND REGISTRATION REQUIREMENTS',
        content: `
          2.1. Eligibility: You represent and warrant that you are at least thirteen (13) years of age. If you are between the ages of 13 and 18 (or the age of legal majority in your jurisdiction), you represent and warrant that your parent or legal guardian has reviewed and agreed to these Terms on your behalf.

          2.2. Account Integrity: When registering for an account, you agree to provide truthful, accurate, and complete information, including a valid personal email address. You agree not to impersonate any other individual or entity, nor create an account for any third party without express legal authorization.

          2.3. Account Security: You are solely responsible for safeguarding the confidentiality of your login credentials (email and password). You agree to assume full legal and operational responsibility for any and all activities that occur under your account. You agree to notify VTrack immediately at support@vtrack.app upon discovering or suspecting any unauthorized access or breach of security.
        `,
      },
      {
        id: 'financial-disclaimer',
        title: '3. NATURE OF SERVICE & ABSOLUTE FINANCIAL DISCLAIMER',
        content: `
          3.1. Informational Budgeting Tool Only: VTrack provides self-directed personal expense tracking, allowance runway calculations, cafeteria menu item organization, and budget analytics engineered for students. VTrack is strictly a record-keeping and estimation software utility.

          3.2. NOT A FINANCIAL INSTITUTION: VTRACK IS NOT A BANK, MICROFINANCE INSTITUTION, BROKER-DEALER, MONEY TRANSMITTER, LENDER, OR LICENSED DEPOSIT-TAKING ENTITY. VTRACK DOES NOT HOLD, TRANSMIT, CONVERT, LEND, OR DEPOSIT FIAT MONEY OR ANY FORM OF FINANCIAL ASSET.

          3.3. NO FINANCIAL, LEGAL, OR TAX ADVICE: No calculation, burn-rate projection, runway estimation, safe-to-spend figure, or mascot illustration (including CoinBuddy) provided by the Service constitutes professional, certified, or fiduciary financial, investment, legal, or tax advice. All figures are mathematical models generated solely from user-reported numbers.

          3.4. USER SOLE RESPONSIBILITY: You acknowledge and agree that you are solely responsible for evaluating your own financial condition, controlling your actual spending, and maintaining personal solvency. VTrack expressly disclaims any liability for financial decisions, overdrafts, bank penalties, or personal shortfalls resulting from your reliance on projections or records generated by the Service.
        `,
      },
      {
        id: 'acceptable-use',
        title: '4. ACCEPTABLE USE AND PROHIBITED CONDUCT',
        content: `
          4.1. Lawful Purposes: You agree to use the Service exclusively for personal, non-commercial, and lawful purposes in accordance with all applicable local, national, and international laws, regulations, and statutes.

          4.2. Prohibited Acts: You specifically agree that you will NOT, directly or indirectly:
          (a) Probe, scan, test, or circumvent the vulnerability, security, or authentication measures of the Service, servers, or connected networks;
          (b) Use any automated system, bot, spider, scraper, crawler, or extraction software to retrieve data or interfere with the proper functioning of the Service;
          (c) Impose an unreasonable or disproportionately large load on our infrastructure, or transmit denial-of-service (DoS/DDoS) payloads;
          (d) Upload, transmit, or process files or images through the menu digitizer or receipt scanner containing viruses, malicious code, trojan horses, worms, or illicit content;
          (e) Decompile, reverse engineer, disassemble, or derive the source code or underlying structure of the Service;
          (f) Resell, sublicense, lease, or commercially exploit any part of the Service without our prior written authorization.
        `,
      },
      {
        id: 'intellectual-property',
        title: '5. USER DATA & INTELLECTUAL PROPERTY RIGHTS',
        content: `
          5.1. User Ownership: As between you and VTrack, you retain all ownership rights and title to the personal expense records, financial values, transaction notes, and cafeteria menu items that you submit or input into the Service ("User Content").

          5.2. Limited Operational License: By submitting User Content to the Service, you grant VTrack a worldwide, royalty-free, non-exclusive license solely to host, store, cache, format, calculate, and display such content to you for the operational purpose of delivering and maintaining the Service.

          5.3. VTrack Proprietary Rights: All rights, title, and interest in and to the Service—including software code, system architecture, database design, interface layouts, graphics, typography, audio, and the CoinBuddy trademark, mascot, and branding—are the exclusive intellectual property of VTrack and protected under international copyright, trademark, and trade secret laws.
        `,
      },
      {
        id: 'sponsor-statements',
        title: '6. TOKENIZED SPONSOR STATEMENTS',
        content: `
          6.1. User-Initiated Statement Sharing: VTrack provides an optional functionality allowing you to generate public, tokenized, read-only summary URLs (/share/[token]) to display your runway and budget health to parents, guardians, or sponsors.

          6.2. Distribution Risk: You acknowledge that any individual in possession of an active share link will be able to review the specific financial summary associated with that token. You assume full legal responsibility for the dissemination and distribution of share links.

          6.3. Revocation: You may invalidate, revoke, or delete any generated share token at any time through the Settings panel of your account.
        `,
      },
      {
        id: 'disclaimer-warranties',
        title: '7. DISCLAIMER OF WARRANTIES',
        content: `
          7.1. THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.

          7.2. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VTRACK DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, AND ACCURACY.

          7.3. VTRACK DOES NOT WARRANT THAT: (A) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (B) CALCULATIONS, RUNWAY ESTIMATES, OR OPTICAL CHARACTER RECOGNITION (OCR) EXTRACTIONS WILL BE 100% ACCURATE OR RELIABLE; OR (C) DEFECTS WILL BE PROMPTLY DETECTED OR CORRECTED.
        `,
      },
      {
        id: 'limitation-liability',
        title: '8. LIMITATION OF LIABILITY',
        content: `
          8.1. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL VTRACK, ITS AFFILIATES, OFFICERS, DIRECTORS, DEVELOPERS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES WHATSOEVER (INCLUDING DAMAGES FOR LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF SAVINGS, BUSINESS INTERRUPTION, LOSS OF DATA, OR FINANCIAL SHORTFALLS) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE THE SERVICE.

          8.2. IN NO EVENT SHALL VTRACK'S AGGREGATE TOTAL LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE EXCEED THE GREATER OF: (A) THE AMOUNT PAID BY YOU TO VTRACK IN THE THREE (3) MONTHS PRECEDING THE CLAIM; OR (B) TEN THOUSAND NIGERIAN NAIRA (NGN 10,000) OR EQUIVALENT USD.
        `,
      },
      {
        id: 'termination',
        title: '9. TERMINATION AND ACCOUNT CANCELLATION',
        content: `
          9.1. Termination by User: You may terminate this Agreement at any time by utilizing the self-service "Delete My Account" feature located in the Settings section. Upon deletion, your data is permanently removed in accordance with our Privacy Policy.

          9.2. Termination by VTrack: VTrack reserves the right, in its sole discretion and without prior notice, to suspend or terminate your access to the Service if you breach any provision of these Terms or engage in conduct harmful to VTrack, other users, or third parties.

          9.3. Survival: Sections 3, 5, 7, 8, 9, 10, and 11 shall survive any termination or expiration of these Terms.
        `,
      },
      {
        id: 'governing-law',
        title: '10. GOVERNING LAW AND DISPUTE RESOLUTION',
        content: `
          10.1. Governing Law: This Agreement shall be governed by, construed, and enforced in accordance with the laws of the Federal Republic of Nigeria, without regard to conflict of law principles.

          10.2. Amicable Consultation: In the event of any controversy, claim, or dispute arising out of or relating to these Terms, the parties agree to first attempt in good faith to resolve the dispute through amicable informal negotiations for a period of at least thirty (30) business days before initiating formal legal proceedings.
        `,
      },
      {
        id: 'modifications-contact',
        title: '11. AMENDMENTS AND CONTACT INFORMATION',
        content: `
          11.1. Amendments: We reserve the right to amend or replace these Terms at any time. When we make material changes, we will update the "Last Updated" date at the top of this document. Your continued use of the Service following the publication of revised Terms constitutes your irrevocable acceptance of the modifications.

          11.2. Official Notices: All legal notices and queries regarding these Terms of Service should be directed to:
          • Legal Inquiries: legal@vtrack.app
          • General Support: support@vtrack.app
        `,
      },
    ],
    []
  );

  const privacySections = useMemo(
    () => [
      {
        id: 'privacy-preamble',
        title: '1. SCOPE AND APPLICABILITY',
        content: `
          1.1. This Privacy Policy sets forth the principles, practices, and legal bases governing the collection, storage, processing, transfer, and protection of personal data by VTrack ("we," "us," or "our") when you access or use the VTrack application, website, and related services.

          1.2. We are committed to processing personal data in full compliance with the Nigeria Data Protection Act 2023 (NDPA), the Nigeria Data Protection Regulation (NDPR), and international data privacy benchmarks, including the General Data Protection Regulation (GDPR).

          1.3. By accessing or using the Service, you acknowledge the collection and processing of your personal data as described in this Privacy Policy.
        `,
      },
      {
        id: 'data-collected',
        title: '2. CATEGORIES OF DATA COLLECTED',
        content: `
          2.1. Account Identification Data: When registering an account, we collect your email address, an encrypted password (hashed with salted bcrypt), and an optional self-selected display name or nickname.

          2.2. User-Reported Financial Records: To deliver allowance tracking and runway calculations, we process information you manually enter, including allowance cycles, frequency anchors, expected income dates, opening balances, daily transaction logs, budget caps, expense categories, and emergency vault goals.

          2.3. Campus Dining and Cafeteria Records: Menu item names, food descriptions, prices, meal dates, and dietary preferences that you record in the food module.

          2.4. Optical Character Recognition (OCR) Data: When you photograph or upload physical receipts or cafeteria menus, image data is processed in ephemeral, secure memory solely to extract merchant names, line items, and monetary totals. Raw images are not retained, sold, or used for commercial profiling.

          2.5. Technical and Session Metadata: Pseudonymized browser identifiers, operating system data, display dimensions, and authentication tokens stored in secure, HttpOnly browser storage.
        `,
      },
      {
        id: 'data-not-collected',
        title: '3. DATA EXCLUSIONS: INFORMATION WE NEVER COLLECT',
        content: `
          3.1. Architectural Separation from Banking Systems: VTrack maintains a strict architectural policy of zero integration with core banking vaults or third-party bank screen-scraping services.

          3.2. Explicit Non-Collection: We NEVER collect, process, or store:
          (a) Online banking login credentials, usernames, internet banking passwords, or token pins;
          (b) Bank Verification Numbers (BVN), National Identification Numbers (NIN), or Social Security Numbers;
          (c) Credit or debit card numbers (PAN), CVV/CVC codes, card expiration dates, or ATM PINs;
          (d) Real-time GPS coordinates or physical location tracking.
        `,
      },
      {
        id: 'legal-bases',
        title: '4. PURPOSES AND LEGAL BASES FOR PROCESSING',
        content: `
          4.1. Contractual Performance: Processing required to calculate your allowance runway, project daily safe-to-spend limits, track recurring subscriptions, and deliver requested account functionality.

          4.2. Legitimate Interests: Processing necessary to protect system security, enforce rate limits against automated attacks, and maintain infrastructure stability.

          4.3. Explicit Consent: Processing conducted on the basis of your explicit user consent, such as generating shareable sponsor statement tokens.
        `,
      },
      {
        id: 'data-sharing',
        title: '5. DATA DISCLOSURE AND THIRD-PARTY SHARING',
        content: `
          5.1. NO SALE OF PERSONAL DATA: VTRACK DOES NOT SELL, RENT, LEASE, OR MONETIZE PERSONAL DATA OR FINANCIAL HABITS TO ADVERTISERS, MARKETING AGENCIES, OR DATA BROKERS.

          5.2. User-Directed Sponsor Summaries: You may generate tokenized, read-only links (/share/[token]) to share high-level financial runway summaries with designated sponsors. You control the generation and revocation of these links.

          5.3. Service Providers: We partner with trusted cloud hosting and database infrastructure providers operating under strict Data Processing Agreements (DPAs) with enterprise-grade encryption.

          5.4. Legal Compliance: We will disclose personal information only when strictly mandated by a valid court subpoena or statutory legal obligation under applicable law.
        `,
      },
      {
        id: 'data-rights',
        title: '6. DATA SUBJECT RIGHTS, PORTABILITY & COMPLETE ERASURE',
        content: `
          6.1. Under the NDPA/NDPR and GDPR, you possess the following self-service data rights:

          6.2. Right of Access and Portability: You have the right to obtain a complete, machine-readable export of all your transaction records in CSV format at any time directly through the Settings panel.

          6.3. Right to Erasure ("Right to Be Forgotten"): You retain the unilateral right to permanently erase your account and all associated data. You can execute this instantly under Settings > Data & Privacy > Danger Zone. When confirmed with your password, all records, budgets, food menus, and transaction histories are permanently deleted from our active database.

          6.4. Right to Rectification: You may freely edit, correct, or delete any recorded transaction, category, or budget entry at any time.
        `,
      },
      {
        id: 'security-standards',
        title: '7. DATA SECURITY AND ENCRYPTION STANDARDS',
        content: `
          7.1. We enforce rigorous organizational and technical safeguards:
          • Passwords are encrypted using bcrypt hashing with high cryptographic cost factors;
          • All data in transit is protected using Transport Layer Security (TLS 1.3 / HTTPS);
          • Session authentication utilizes Secure, HttpOnly, and SameSite cookie policies;
          • Multi-tier rate limiting prevents credential stuffing and automated abuse.
        `,
      },
      {
        id: 'student-privacy',
        title: '8. STUDENT AGE AND MINOR PROTECTIONS',
        content: `
          8.1. The Service is intended for students aged thirteen (13) and older. We do not knowingly solicit or collect personal data from children under the age of 13. If we discover that personal data of a child under 13 has been collected without verifiable parental consent, we will immediately take steps to permanently delete that information.
        `,
      },
      {
        id: 'dpo-contact',
        title: '9. DATA PROTECTION OFFICER AND INQUIRIES',
        content: `
          9.1. If you have questions regarding this Privacy Policy, wish to file a data inquiry, or desire to exercise statutory privacy rights, contact our Data Protection team at:
          • Privacy Email: privacy@vtrack.app
          • Data Protection Lead: Vanessa / VTrack Security
          • Response SLA: All privacy inquiries and data subject requests are processed within 48 business hours.
        `,
      },
    ],
    []
  );

  const currentSections = activeTab === 'privacy' ? privacySections : termsSections;

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return currentSections;
    const q = searchQuery.toLowerCase();
    return currentSections.filter(
      (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }, [currentSections, searchQuery]);

  return (
    <div className="min-h-screen bg-bg text-text-main font-body selection:bg-accent/20 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(user ? '/' : '/');
              }
            }}
            className="flex items-center gap-2 text-xs font-bold text-text-muted hover:text-text-main p-2 rounded-xl bg-bg border border-border hover:border-accent transition-colors btn-tap"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-accent" />
            <span className="hidden sm:inline">
              {user ? 'Back to App' : 'Back to Home'}
            </span>
          </button>

          {/* Document Tabs */}
          <div className="flex items-center p-1 bg-bg border border-border rounded-xl gap-1">
            <button
              type="button"
              onClick={() => handleTabSwitch('terms')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all btn-tap ${
                activeTab === 'terms'
                  ? 'bg-accent text-white shadow-none'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Terms of Service</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('privacy')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all btn-tap ${
                activeTab === 'privacy'
                  ? 'bg-accent text-white shadow-none'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl text-text-muted hover:text-text-main bg-bg border border-border hover:border-accent transition-colors btn-tap"
              title="Print document"
              aria-label="Print document"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text-main bg-bg border border-border hover:border-accent transition-colors btn-tap"
              title="Copy URL"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green" />
                  <span className="text-green hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-accent" />
                  <span className="hidden sm:inline">Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Document Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Document Header */}
        <div className="border-b border-border pb-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-text-main tracking-tight uppercase">
              {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            </h1>
            <span className="text-xs font-mono text-text-muted">
              Doc ID: VT-{activeTab === 'terms' ? 'TOS-2026' : 'PRIV-2026'}
            </span>
          </div>

          <p className="text-xs text-text-muted">
            <strong>Effective Date:</strong> October 17, 2026 &nbsp;|&nbsp; <strong>Last Updated:</strong> October 17, 2026 &nbsp;|&nbsp; <strong>Applicable to:</strong> VTrack Web Platform &amp; Services
          </p>

          {/* Formal Legal Notice Box */}
          <div className="mt-4 p-4 rounded-xl bg-surface border border-border text-xs text-text-muted leading-relaxed flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div>
              <strong className="text-text-main block uppercase font-mono text-[11px] mb-1">
                Legal Notice &amp; Binding Agreement
              </strong>
              {activeTab === 'terms' ? (
                <span>
                  PLEASE READ THESE TERMS OF SERVICE CAREFULLY. THIS DOCUMENT CONTAINS IMPORTANT PROVISIONS GOVERNING YOUR LEGAL RIGHTS, REMEDIES, AND OBLIGATIONS, INCLUDING A COMPREHENSIVE FINANCIAL AND BANKING DISCLAIMER (SECTION 3), DISCLAIMER OF WARRANTIES (SECTION 7), AND LIMITATION OF LIABILITY (SECTION 8).
                </span>
              ) : (
                <span>
                  PLEASE REVIEW THIS PRIVACY POLICY TO UNDERSTAND OUR DATA PROTECTION PRACTICES PURSUANT TO THE NIGERIA DATA PROTECTION ACT 2023 (NDPA), NDPR, AND GDPR PRINCIPLES. VTRACK DOES NOT CONNECT TO CORE BANKING SYSTEMS, DOES NOT COLLECT BANK LOGINS OR BVN, AND NEVER SELLS YOUR PERSONAL DATA.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Layout Grid: Sticky TOC Sidebar + Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Table of Contents Sidebar */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clauses..."
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-border bg-surface text-text-main text-xs focus:outline-none focus:border-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-main"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="card-base p-4 bg-surface border border-border">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-3 px-1 border-b border-border pb-2">
                Table of Contents
              </p>
              <nav className="space-y-1 max-h-[55vh] overflow-y-auto pr-1">
                {currentSections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(sec.id);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth' });
                        setActiveSectionId(sec.id);
                      }
                    }}
                    className={`block px-2.5 py-1.5 rounded-lg text-xs transition-colors truncate font-medium ${
                      activeSectionId === sec.id
                        ? 'bg-accent-soft text-accent font-bold'
                        : 'text-text-muted hover:text-text-main hover:bg-bg'
                    }`}
                  >
                    {sec.title}
                  </a>
                ))}
              </nav>
            </div>

            {/* Quick Actions for Signed-in Users in Privacy Mode */}
            {user && activeTab === 'privacy' && (
              <div className="card-base p-4 bg-surface border border-border space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-1">
                  Exercise Your Data Rights
                </p>
                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="w-full py-2 px-3 rounded-xl bg-accent text-white hover:bg-accent-hover font-bold text-xs btn-tap flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-none"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Generating PDF...' : 'Download Statement (.PDF)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="w-full py-2 px-3 rounded-xl bg-red/10 text-red hover:bg-red/20 font-bold text-xs btn-tap flex items-center justify-center gap-2 transition-colors border border-red/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Account Erasure in Settings</span>
                </button>
              </div>
            )}
          </aside>

          {/* Main Clauses */}
          <div className="lg:col-span-8 space-y-6">
            {/* Mobile Search Bar */}
            <div className="block lg:hidden relative mb-4">
              <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clauses..."
                className="w-full pl-8 pr-7 py-2 rounded-xl border border-border bg-surface text-text-main text-xs focus:outline-none focus:border-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-main"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {filteredSections.length === 0 ? (
              <div className="card-base p-8 text-center bg-surface border border-border">
                <p className="font-heading font-bold text-sm text-text-main mb-1">
                  No matching clauses found
                </p>
                <p className="text-xs text-text-muted mb-4">
                  No sections matched "{searchQuery}".
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 rounded-lg bg-accent text-white font-bold text-xs btn-tap"
                >
                  Clear filter
                </button>
              </div>
            ) : (
              filteredSections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="card-base p-6 sm:p-7 bg-surface border border-border scroll-mt-24"
                >
                  <h2 className="font-heading font-bold text-base sm:text-lg text-text-main mb-3 pb-2 border-b border-border flex items-center justify-between">
                    <span>{section.title}</span>
                    <a
                      href={`#${section.id}`}
                      className="text-text-muted hover:text-accent text-xs font-mono select-none"
                      title="Link to section"
                    >
                      §
                    </a>
                  </h2>

                  <div className="text-xs sm:text-sm text-text-main/90 leading-relaxed space-y-3 whitespace-pre-line font-normal">
                    {section.content.trim()}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Unified Global Footer */}
      <AppFooter variant="bar" />
    </div>
  );
};
