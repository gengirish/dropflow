---
name: react-pdf-invoices
description: >-
  @react-pdf/renderer for generating Indian GST-compliant invoice PDFs in
  DropFlow. Use when building invoice templates, PDF generation in the worker,
  or any PDF output with GST breakdown tables.
---

# @react-pdf/renderer — GST Invoice PDFs

Package: `@react-pdf/renderer`  
Location: `apps/worker/src/pdf/`

## Installation

```bash
pnpm add @react-pdf/renderer --filter worker
```

## Invoice PDF Template

```typescript
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Noto Sans",
  src: "https://fonts.gstatic.com/s/notosans/v30/o-0IIpQlx3QUlC5A4PNb4g.ttf",
});

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Noto Sans", fontSize: 9 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "bold" },
  table: { width: "100%", marginTop: 10 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 4 },
  tableHeader: { backgroundColor: "#f5f5f5", fontWeight: "bold" },
  col1: { width: "5%" },
  col2: { width: "30%" },
  col3: { width: "10%", textAlign: "center" },
  col4: { width: "10%", textAlign: "right" },
  col5: { width: "15%", textAlign: "right" },
  col6: { width: "15%", textAlign: "right" },
  col7: { width: "15%", textAlign: "right" },
  right: { textAlign: "right" },
  bold: { fontWeight: "bold" },
  section: { marginTop: 15 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  divider: { borderBottomWidth: 1, borderColor: "#000", marginVertical: 8 },
});

const formatINR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

interface InvoicePDFProps {
  invoice: {
    invoiceNumber: string;
    createdAt: string;
    gstType: string;
    subtotalPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalTaxPaise: number;
    totalPaise: number;
  };
  seller: { name: string; gstin: string; address: string; stateCode: string };
  buyer: { name: string; address: string; gstin?: string; stateCode: string };
  items: { name: string; hsn: string; qty: number; unitPaise: number; totalPaise: number; gstRate: number }[];
}

export function InvoicePDF({ invoice, seller, buyer, items }: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>TAX INVOICE</Text>
            <Text>{invoice.invoiceNumber}</Text>
            <Text>Date: {invoice.createdAt}</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={s.bold}>{seller.name}</Text>
            <Text>GSTIN: {seller.gstin}</Text>
            <Text>{seller.address}</Text>
          </View>
        </View>

        {/* Buyer Details */}
        <View style={s.section}>
          <Text style={s.bold}>Bill To:</Text>
          <Text>{buyer.name}</Text>
          {buyer.gstin && <Text>GSTIN: {buyer.gstin}</Text>}
          <Text>{buyer.address}</Text>
        </View>

        {/* Items Table */}
        <View style={s.table}>
          <View style={[s.tableRow, s.tableHeader]}>
            <Text style={s.col1}>#</Text>
            <Text style={s.col2}>Description</Text>
            <Text style={s.col3}>HSN</Text>
            <Text style={s.col4}>Qty</Text>
            <Text style={s.col5}>Unit Price</Text>
            <Text style={s.col6}>GST %</Text>
            <Text style={s.col7}>Total</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.col1}>{i + 1}</Text>
              <Text style={s.col2}>{item.name}</Text>
              <Text style={s.col3}>{item.hsn}</Text>
              <Text style={s.col4}>{item.qty}</Text>
              <Text style={s.col5}>{formatINR(item.unitPaise)}</Text>
              <Text style={s.col6}>{item.gstRate}%</Text>
              <Text style={s.col7}>{formatINR(item.totalPaise)}</Text>
            </View>
          ))}
        </View>

        {/* Tax Summary */}
        <View style={[s.section, { alignItems: "flex-end" }]}>
          <View style={{ width: 200 }}>
            <View style={s.row}>
              <Text>Subtotal</Text>
              <Text>{formatINR(invoice.subtotalPaise)}</Text>
            </View>
            {invoice.gstType === "CGST_SGST" && (
              <>
                <View style={s.row}><Text>CGST</Text><Text>{formatINR(invoice.cgstPaise)}</Text></View>
                <View style={s.row}><Text>SGST</Text><Text>{formatINR(invoice.sgstPaise)}</Text></View>
              </>
            )}
            {invoice.gstType === "IGST" && (
              <View style={s.row}><Text>IGST</Text><Text>{formatINR(invoice.igstPaise)}</Text></View>
            )}
            {invoice.gstType === "EXPORT_LUT" && (
              <View style={s.row}><Text>IGST (LUT)</Text><Text>{formatINR(0)}</Text></View>
            )}
            <View style={s.divider} />
            <View style={s.row}>
              <Text style={s.bold}>Total</Text>
              <Text style={s.bold}>{formatINR(invoice.totalPaise)}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
```

## Rendering to Buffer (Worker)

```typescript
import { renderToBuffer } from "@react-pdf/renderer";
import { put } from "@vercel/blob";

export async function generateInvoicePDF(invoiceData: InvoicePDFProps) {
  const buffer = await renderToBuffer(<InvoicePDF {...invoiceData} />);

  const { url } = await put(
    `invoices/${invoiceData.invoice.invoiceNumber}.pdf`,
    buffer,
    { access: "public" },
  );

  return url;
}
```

## Invoice Number Format

```
INV/YYMM/NNNN
```

Sequential per tenant per financial year (April–March):

```typescript
export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const now = new Date();
  const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const yymm = `${String(fy).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const count = await prisma.invoice.count({
    where: { tenantId, invoiceNumber: { startsWith: `INV/${yymm}` } },
  });

  return `INV/${yymm}/${String(count + 1).padStart(4, "0")}`;
}
```

## Conventions

- All money rendered with `en-IN` Intl formatter (lakh separators)
- Include HSN code column — mandatory for GST invoices
- Show CGST+SGST or IGST based on `gstType` — never both
- Upload PDF to Vercel Blob, store URL in `Invoice.pdfUrl`
- Use Noto Sans font — supports ₹ symbol and Indian scripts
