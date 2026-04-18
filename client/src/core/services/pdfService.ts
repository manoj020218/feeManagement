// src/core/services/pdfService.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface ReceiptData {
  institution: {
    name: string;
    logo?: string; // base64
    type: string;
  };
  member: {
    name: string;
    plan: string;
    memberId?: string;
  };
  transaction: {
    amount: number;
    period: string;
    paidDate: string;
    nextDue?: string;
    payMode: string;
    receiptNo: string;
  };
  footer?: string;
}

export async function generateReceiptImage(elementId: string): Promise<string> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Receipt element not found');
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
  return canvas.toDataURL('image/jpeg', 0.9);
}

export async function shareReceiptAsImage(imageDataUrl: string, message: string) {
  // Save to temporary file
  const fileName = `receipt_${Date.now()}.jpg`;
  const result = await Filesystem.writeFile({
    path: fileName,
    data: imageDataUrl.split(',')[1],
    directory: Directory.Cache,
  });
  // Share
  await Share.share({
    title: 'Fee Receipt',
    text: message,
    url: result.uri,
    dialogTitle: 'Share receipt via',
  });
  // Cleanup
  await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache });
}

export function buildReceiptHTML(data: ReceiptData): string {
  const logoHtml = data.institution.logo
    ? `<img src="${data.institution.logo}" style="width:60px;height:60px;object-fit:contain;border-radius:10px;margin-bottom:6px"/>`
    : `<div style="font-size:1.8rem;margin-bottom:4px">📄</div>`;
  return `
    <div id="receiptContainer" style="font-family: 'Outfit', sans-serif; max-width:400px; margin:0 auto; background:white; padding:20px; border-radius:16px; color:#1a1a1a;">
      <div style="text-align:center; border-bottom:2px solid #eee; padding-bottom:12px;">
        ${logoHtml}
        <div style="font-weight:800; font-size:1.2rem;">${data.institution.name}</div>
        <div style="font-size:0.7rem; color:#666;">${data.institution.type}</div>
      </div>
      <div style="margin:12px 0;">
        <div style="font-weight:700; font-size:0.8rem; color:#999; text-transform:uppercase;">Member Details</div>
        <div style="display:flex; justify-content:space-between; margin-top:5px;"><span>Name</span><span style="font-weight:600;">${data.member.name}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>${data.member.plan}</span><span>${data.member.memberId ? `ID: ${data.member.memberId}` : ''}</span></div>
      </div>
      <div style="margin:12px 0;">
        <div style="font-weight:700; font-size:0.8rem; color:#999; text-transform:uppercase;">Payment</div>
        <div style="display:flex; justify-content:space-between;"><span>Period</span><span>${data.transaction.period}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Date</span><span>${data.transaction.paidDate}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Mode</span><span>${data.transaction.payMode}</span></div>
        ${data.transaction.nextDue ? `<div style="display:flex; justify-content:space-between;"><span>Next Due</span><span>${data.transaction.nextDue}</span></div>` : ''}
        <div style="background:#f0f4ff; border-radius:12px; padding:10px; margin-top:12px; display:flex; justify-content:space-between; font-weight:800;">
          <span>Amount Paid</span><span>₹${data.transaction.amount.toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div style="text-align:center; margin-top:12px; font-size:0.7rem; color:#aaa;">
        Receipt #${data.transaction.receiptNo}<br/>
        ${data.footer || 'Thank you for your payment!'}
      </div>
    </div>
  `;
}