import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  TableLayoutType,
  VerticalAlign,
  PageBreak,
} from 'docx';
import { OrderData, FormattedAddress, CN22LabelData } from './types';

const FROM_ADDRESS = {
  line1: 'Vedashi Wellness / Sunrise Luxury',
  line2: 'Shop No.1 & 2, Plot No.56, Sector-9E, Airoli,',
  line3: 'Navi Mumbai, Thane, Mh, 400708 Ph: 9920600198',
  line4: 'BNPL NO.-NMR/DA-NM/1254/26-29',
};

function formatToAddress(address: FormattedAddress): string[] {
  const lines: string[] = [];
  if (address.name) lines.push(address.name);
  if (address.addressLine1) lines.push(address.addressLine1);
  if (address.addressLine2) lines.push(address.addressLine2);
  if (address.city) lines.push(address.city);
  if (address.state) lines.push(address.state);
  if (address.pincode) lines.push(`${address.pincode} South Korea`);
  if (address.phone) lines.push(`Ph: ${address.phone}`);
  return lines;
}

function formatFromAddress(companyName?: string): string[] {
  const line1 = companyName ? `Vedashi Wellness / ${companyName}` : FROM_ADDRESS.line1;
  return [line1, FROM_ADDRESS.line2, FROM_ADDRESS.line3, FROM_ADDRESS.line4];
}

function createAddressTable(label: string, addressLines: string[]): Table {
  const textRuns: TextRun[] = [];
  textRuns.push(new TextRun({ text: label, bold: true, size: 24, font: 'Cambria' }));
  textRuns.push(new TextRun({ break: 1 }));

  addressLines.forEach((line) => {
    textRuns.push(new TextRun({ text: line, bold: true, size: 24, font: 'Cambria', break: 1 }));
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: textRuns })],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
              left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
              right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            },
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
        ],
      }),
    ],
  });
}

function buildCN22Table(data: CN22LabelData): Table {
  const SZ = 24;
  const FONT = 'Cambria';
  const W0 = 600, W1 = 5448, W2 = 1584, W3 = 1584, W4 = 1584;
  const ALL = {
    top: { style: BorderStyle.SINGLE, size: 6 },
    bottom: { style: BorderStyle.SINGLE, size: 6 },
    left: { style: BorderStyle.SINGLE, size: 6 },
    right: { style: BorderStyle.SINGLE, size: 6 },
  };
  const CELL_PAD = { top: 60, bottom: 60, left: 100, right: 100 };

  const p = (text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
    new Paragraph({
      children: [new TextRun({ text, bold: opts.bold ?? false, size: SZ, font: FONT })],
      alignment: opts.align ?? AlignmentType.LEFT,
      spacing: { before: 40, after: 40 },
    });

  const c = (
    paras: Paragraph[],
    widthDxa: number,
    span = 1,
    vAlign: (typeof VerticalAlign)[keyof typeof VerticalAlign] = VerticalAlign.TOP,
    rSpan = 1
  ) =>
    new TableCell({
      width: { size: widthDxa, type: WidthType.DXA },
      columnSpan: span,
      rowSpan: rSpan,
      borders: ALL,
      verticalAlign: vAlign,
      margins: CELL_PAD,
      children: paras,
    });

  const row1 = new TableRow({
    children: [
      c([p('CUSTOMS DECLARATION', { bold: true })], W0 + W1, 2),
      c([p('May be Opened', { align: AlignmentType.CENTER }), p('officially', { align: AlignmentType.CENTER })], W2 + W3, 2, VerticalAlign.CENTER),
      c([p('CN22', { bold: true, align: AlignmentType.CENTER })], W4, 1, VerticalAlign.CENTER),
    ],
  });

  const row2 = new TableRow({
    children: [
      c([p('India post')], W0 + W1, 2),
      c([p('Important', { align: AlignmentType.CENTER }), p('See instruction on the back', { align: AlignmentType.CENTER })], W2 + W3 + W4, 3, VerticalAlign.CENTER),
    ],
  });

  const row3 = new TableRow({ children: [c([p('')], W0), c([p('Gift')], W1), c([p('Commercial Sample')], W2 + W3 + W4, 3)] });
  const row4 = new TableRow({ children: [c([p('')], W0), c([p('Document')], W1), c([p('Returned goods')], W2 + W3 + W4, 3)] });
  const row5 = new TableRow({
    children: [
      c([p('✓', { bold: true, align: AlignmentType.CENTER })], W0, 1, VerticalAlign.CENTER),
      c([p('Sale of goods')], W1),
      c([p('Other')], W2 + W3 + W4, 3),
    ],
  });

  const row6 = new TableRow({
    children: [
      c([p('Quantity and detailed description of content (1)', { bold: true })], W0 + W1, 2),
      c([p('Net Weight(2)', { bold: true })], W2),
      c([p('Value and Currency(3)', { bold: true })], W3),
      c([p('Country of Origin(5)', { bold: true, align: AlignmentType.CENTER })], W4, 1, VerticalAlign.CENTER),
    ],
  });

  const row7 = new TableRow({
    children: [
      c([p(data.productName || '', { bold: true })], W0 + W1, 2),
      c([p('')], W2, 1, VerticalAlign.CENTER, 2),
      c([p(String(data.productPrice || ''), { align: AlignmentType.CENTER })], W3, 1, VerticalAlign.CENTER, 2),
      c([p('INDIA', { bold: true, align: AlignmentType.CENTER })], W4, 1, VerticalAlign.CENTER, 2),
    ],
  });

  const row8 = new TableRow({ children: [c([p('HSN CODE: 30043919', { bold: true })], W0 + W1, 2)] });

  const row9 = new TableRow({
    children: [c([p('Total Weight', { bold: true })], W0 + W1, 2), c([p('')], W2), c([p('')], W3), c([p('')], W4)],
  });

  const row10 = new TableRow({
    children: [
      c([
        p('I, the undersigned, whose name and address are given on the item, certify that the particulars given in this declaration are correct and that this item does not contain any dangerous article or articles prohibited by legislation or postal or customs regulations.', { bold: true }),
        p(''),
        p("Date and Sender's signature: ______________________", { bold: true }),
      ], W0 + W1 + W2 + W3 + W4, 5),
    ],
  });

  return new Table({
    width: { size: 10800, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [W0, W1, W2, W3, W4],
    rows: [row1, row2, row3, row4, row5, row6, row7, row8, row9, row10],
  });
}

export async function generateBulkCN22Word(orders: OrderData[]): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  orders.forEach((order, index) => {
    if (!order.formattedAddress) return;

    children.push(createAddressTable('TO:', formatToAddress(order.formattedAddress)));
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    children.push(createAddressTable('FROM:', formatFromAddress(order.rawAddress.companyName)));
    children.push(new Paragraph({ text: '', spacing: { after: 400 } }));
    children.push(buildCN22Table({
      productName: order.rawAddress.productName,
      productPrice: order.rawAddress.productPrice,
    }));

    if (index < orders.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children,
    }],
  });

  return Packer.toBlob(doc);
}
