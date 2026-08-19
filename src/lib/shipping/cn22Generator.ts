import { jsPDF } from 'jspdf';
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

function drawCN22Table(doc: jsPDF, m: number, startY: number, width: number, data: CN22LabelData) {
  const FONT_FACE = 'times';
  const FONT_SIZE = 8;

  const w0 = (600 / 10800) * width;
  const w1 = (5448 / 10800) * width;
  const w2 = (1584 / 10800) * width;
  const w3 = (1584 / 10800) * width;
  const w4 = (1584 / 10800) * width;

  let y = startY;
  const pad = 1.5;

  const rect = (x: number, ry: number, w: number, h: number) => doc.rect(x, ry, w, h);

  const r1h = 6;
  rect(m, y, w0 + w1, r1h);
  rect(m + w0 + w1, y, w2 + w3, r1h);
  rect(m + w0 + w1 + w2 + w3, y, w4, r1h);
  doc.setFont(FONT_FACE, 'bold');
  doc.setFontSize(FONT_SIZE);
  doc.text('CUSTOMS DECLARATION', m + pad, y + 4);
  doc.setFont(FONT_FACE, 'normal');
  doc.setFontSize(7);
  doc.text('May be Opened', m + w0 + w1 + (w2 + w3) / 2, y + 2.5, { align: 'center' });
  doc.text('officially', m + w0 + w1 + (w2 + w3) / 2, y + 5, { align: 'center' });
  doc.setFont(FONT_FACE, 'bold');
  doc.setFontSize(FONT_SIZE);
  doc.text('CN22', m + w0 + w1 + w2 + w3 + w4 / 2, y + 4, { align: 'center' });
  y += r1h;

  const r2h = 6;
  rect(m, y, w0 + w1, r2h);
  rect(m + w0 + w1, y, w2 + w3 + w4, r2h);
  doc.setFont(FONT_FACE, 'normal');
  doc.text('India post', m + pad, y + 4);
  doc.setFontSize(7);
  doc.text('Important', m + w0 + w1 + (w2 + w3 + w4) / 2, y + 2.5, { align: 'center' });
  doc.text('See instruction on the back', m + w0 + w1 + (w2 + w3 + w4) / 2, y + 5, { align: 'center' });
  doc.setFontSize(FONT_SIZE);
  y += r2h;

  const drawCheckRow = (leftText: string, rightText: string, hasCheck = false) => {
    rect(m, y, w0, 4);
    rect(m + w0, y, w1, 4);
    rect(m + w0 + w1, y, w2 + w3 + w4, 4);
    if (hasCheck) {
      doc.setLineWidth(0.5);
      doc.line(m + pad, y + 2, m + w0 / 2, y + 3.5);
      doc.line(m + w0 / 2, y + 3.5, m + w0 - 1.5, y + 1);
      doc.setLineWidth(0.200025);
    }
    doc.text(leftText, m + w0 + pad, y + 3);
    doc.text(rightText, m + w0 + w1 + pad, y + 3);
    y += 4;
  };

  drawCheckRow('Gift', 'Commercial Sample');
  drawCheckRow('Document', 'Returned goods');
  drawCheckRow('Sale of goods', 'Other', true);

  doc.setFont(FONT_FACE, 'bold');
  doc.setFontSize(7);
  const mainHeader = 'Quantity and detailed description of content (1)';
  const mainHeaderLines = doc.splitTextToSize(mainHeader, w0 + w1 - pad * 2);
  const r6h = Math.max(7, mainHeaderLines.length * 3 + 2);

  rect(m, y, w0 + w1, r6h);
  rect(m + w0 + w1, y, w2, r6h);
  rect(m + w0 + w1 + w2, y, w3, r6h);
  rect(m + w0 + w1 + w2 + w3, y, w4, r6h);

  mainHeaderLines.forEach((line: string, i: number) => {
    doc.text(line, m + pad, y + 3 + i * 3);
  });

  doc.setFontSize(6);
  doc.text(doc.splitTextToSize('Net Weight(2)', w2 - pad), m + w0 + w1 + pad, y + 2.5);
  doc.text(doc.splitTextToSize('Value and Currency(3)', w3 - pad), m + w0 + w1 + w2 + pad, y + 2.5);
  doc.text(doc.splitTextToSize('Country of Origin(5)', w4 - pad), m + w0 + w1 + w2 + w3 + pad, y + 2.5);
  doc.setFontSize(FONT_SIZE);
  y += r6h;

  doc.setFont(FONT_FACE, 'bold');
  const productText = data.productName || '';
  const maxTextWidth = w0 + w1 - pad * 3;
  const splitLines = doc.splitTextToSize(productText, maxTextWidth);
  const r7h = Math.max(8, splitLines.length * 3.5 + 3);
  const combinedH = r7h + 4;

  rect(m, y, w0 + w1, r7h);
  rect(m + w0 + w1, y, w2, combinedH);
  rect(m + w0 + w1 + w2, y, w3, combinedH);
  rect(m + w0 + w1 + w2 + w3, y, w4, combinedH);

  splitLines.forEach((line: string, idx: number) => {
    doc.text(line, m + pad, y + 3.5 + idx * 3.5, { maxWidth: maxTextWidth });
  });

  if (data.productPrice) {
    doc.setFont(FONT_FACE, 'normal');
    doc.text(String(data.productPrice), m + w0 + w1 + w2 + w3 / 2, y + combinedH / 2 + 1, { align: 'center' });
  }

  doc.setFont(FONT_FACE, 'bold');
  doc.text('INDIA', m + w0 + w1 + w2 + w3 + w4 / 2, y + combinedH / 2 + 1, { align: 'center' });
  y += r7h;

  rect(m, y, w0 + w1, 4);
  doc.text('HSN CODE: 30043919', m + pad, y + 3);
  y += 4;

  rect(m, y, w0 + w1, 4);
  rect(m + w0 + w1, y, w2, 4);
  rect(m + w0 + w1 + w2, y, w3, 4);
  rect(m + w0 + w1 + w2 + w3, y, w4, 4);
  doc.text('Total Weight', m + pad, y + 3);
  y += 4;

  const footerText = 'I, the undersigned, whose name and address are given on the item, certify that the particulars given in this declaration are correct and that this item does not contain any dangerous article or articles prohibited by legislation or postal or customs regulations.';
  const fLines = doc.splitTextToSize(footerText, width - pad * 2);
  const r10h = fLines.length * 3 + 12;
  rect(m, y, width, r10h);
  doc.setFont(FONT_FACE, 'bold');
  doc.setFontSize(7);
  fLines.forEach((l: string, i: number) => {
    doc.text(l, m + pad, y + 3.5 + i * 3);
  });
  doc.setFontSize(8);
  doc.text("Date and Sender's signature: ______________________", m + pad, y + r10h - 3);
}

function drawOrder(doc: jsPDF, order: OrderData) {
  const m = 4;
  const contentW = 92;

  doc.setFontSize(9);
  doc.setFont('times', 'bold');
  const maxToWidth = contentW - 4;
  const rawToLines = order.formattedAddress ? formatToAddress(order.formattedAddress) : [];
  const toLines: string[] = [];
  rawToLines.forEach((line) => {
    const split = doc.splitTextToSize(line, maxToWidth);
    if (Array.isArray(split)) toLines.push(...split);
    else toLines.push(split);
  });

  const toBoxHeight = 6 + toLines.length * 4;
  doc.rect(m, m, contentW, toBoxHeight);

  let y = m + 4;
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  doc.text('TO:', m + 2, y);
  y += 4;

  doc.setFontSize(9);
  toLines.forEach((line) => {
    doc.text(line, m + 2, y);
    y += 4;
  });

  const fromY = m + toBoxHeight + 2;
  const fromBoxHeight = 22;
  doc.rect(m, fromY, contentW, fromBoxHeight);

  y = fromY + 4;
  doc.setFontSize(8);
  doc.setFont('times', 'bold');
  doc.text('FROM:', m + 2, y);
  y += 3.5;

  const companyName = order.rawAddress.companyName;
  const fromLine1 = companyName ? `Vedashi Wellness / ${companyName}` : FROM_ADDRESS.line1;

  doc.text(fromLine1, m + 2, y);
  y += 3.5;
  doc.text(FROM_ADDRESS.line2, m + 2, y);
  y += 3.5;
  doc.text(FROM_ADDRESS.line3, m + 2, y);
  y += 3.5;
  doc.text(FROM_ADDRESS.line4, m + 2, y);

  y = fromY + fromBoxHeight + 4;
  drawCN22Table(doc, m, y, contentW, {
    productName: order.rawAddress.productName,
    productPrice: order.rawAddress.productPrice,
  });
}

export async function generateBulkCN22Pdf(orders: OrderData[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [100, 150],
  });

  for (let i = 0; i < orders.length; i++) {
    if (i > 0) doc.addPage();
    drawOrder(doc, orders[i]);
  }

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
}
