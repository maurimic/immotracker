# Immotracker System Audit & Roadmap Brainstorm

* **Author:** maurimic
* **Date:** 2026-11-08

## Overview

Immotracker manages real estate portfolios with focus on cashflow tracking, Google Sheets bank reconciliation, tenant management, loan amortization, maintenance tracking, and German tax calculations (§ 6 / § 21 EStG).

While core data entry, bank matching, and visual monitoring are functional, the system has operational bottlenecks, unhandled accounting edge cases, and missing compliance workflows that require manual workarounds.

## Analysis

### 1. Payment Matching & Banking Invariants
* **Current State:** Sync depends on manual user trigger via Google Sheets API. Transactions are matched 1:1 to tenants, loans, or properties based on IBAN, name, and date window.
* **Vulnerability & Edge Cases:**
  * **Split Bookings:** A tenant transferring 2 months of rent in a single sum or paying rent + deposit together cannot be split into distinct periods or categories. The payment remains partially matched or distorts monthly KPIs.
  * **Silent Sync Failures:** No background polling or cron job exists. If the user does not open the app and trigger sync, rent delays remain undetected until manual inspection.
  * **Absence of Direct Bank Feed (FinTS / Open Banking):** Reliance on Google Sheets introduces an external point of failure and delay between actual bank execution and sheet reflection.

### 2. Operating Costs & Utility Settlements (§ 556 BGB, BetrKV)
* **Current State:** Records utility invoices and basic cost distribution by sqm share.
* **Vulnerability & Edge Cases:**
  * **Legal Compliance Gaps:** German tenancy law enforces strict statutory requirements for annual utility settlements (*Betriebskostenabrechnung*): 12-month preclusion period (*Ausschlussfrist* § 556 Abs. 3 BGB), heating cost ordinance distribution (50-70% consumption vs. 30-50% area according to *HeizkostenV*), and tenant changeover mid-year graduation (*Gradtagstabelle*).
  * **No Legal PDF Export:** The system cannot produce legally binding tenant settlement letters ready for postal or email delivery.

### 3. Maintenance, Handwerker & § 6 EStG Integration
* **Current State:** Maintenance tickets and meter readings live in `/instandhaltung`, while capitalized renovation investments live in `PropertyInvestmentsDialog` (/steuern).
* **Vulnerability & Edge Cases:**
  * **Data Disconnection:** A repair ticket marked `DONE` with real invoice costs does not automatically link to the 3-year 15% threshold monitoring (§ 6 Abs. 1 Nr. 1a EStG), creating risk of tax misclassification or double entry.
  * **Voucher / Invoice Archiving:** Invoices can only be partially tracked without automated PDF text extraction or receipt linking.

### 4. Automated Notification & Dunning Workflows
* **Current State:** Dunning templates (friendly reminder, 1st warning, 2nd warning) are generated as copyable text inside `/zahlungen`.
* **Vulnerability & Edge Cases:**
  * **Manual Friction:** The landlord must manually notice the overdue flag, open the modal, copy the text, and paste it into an email client.
  * **No Audit Log:** The app does not persist when a reminder was sent, by whom, or what response was received.

### 5. Multi-User, Audit & Data Integrity
* **Current State:** Single cookie-based session with shared administrative credentials.
* **Vulnerability & Edge Cases:**
  * **No Access Segregation:** Co-owners (Poggel & Micciché) or external tax consultants (*Steuerberater*) cannot be given restricted or read-only audit views.
  * **No Audit Trail:** Entity deletions or manual transaction overrides lack historical change logging.

## Goals vs. Non-Goals

### Candidate In-Scope Goals
* **Automated Rent Monitor & Outbound Notification:** Background daemon checking daily for overdue rent (day 4/5 of month) with optional email/webhook notification.
* **Legally Compliant PDF Utility Statement Generator:** Producing standard-compliant annual statements per tenant with consumption keys and prepayments deduction.
* **Transaction Splitting:** Enabling one bank transaction to be split into multiple ledger lines (e.g. Miete + Kaution, or Nachzahlung + laufende Miete).
* **Direct Integration between Maintenance Tickets and 15%-Grenze:** Automatically proposing completed repair bills for tax categorization.

### Out-of-Scope Non-Goals
* Full ERP accounting suite for third-party property managers (*Hausverwaltungssoftware nach WEG für Fremdverwaltung*).
* Direct SEPA direct debit generation (*SEPA-Lastschrifteneinzug*), as rent is transferred by tenants directly.

## Alternatives Weighed

* **Alternative A: Build Full Direct FinTS/EBICS Banking Pipeline**
  * *Trade-off:* High maintenance burden with bank 2FA protocols (chipTAN, pushTAN) and bank API maintenance. Keeping Google Sheets or using a dedicated PSD2 gateway (e.g. GoCardless / FinAPI) is more cost-effective.
* **Alternative B: Retain Manual Status Quo for Utility Statements**
  * *Trade-off:* High risk of legal invalidity in tenant disputes if calculations fail to comply with formal requirements (§ 556 BGB).

## Key Decisions & Staging for Next Steps

* Clarify with portfolio owner which operational friction causes the most manual overhead right now:
  1. Cashflow & Banking (automated daily checks, split bookings, reminder dispatches).
  2. Legal & Tenant Operations (statutory utility bills PDF, document archiving).
  3. Tax & Maintenance Operations (unifying tickets with 15%-Grenze and ELSTER exports).
