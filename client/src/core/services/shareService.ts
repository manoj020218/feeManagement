import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser'; // optional, to open WA web

export function shareViralInvite(inviteCode: string, institutionName: string, appLink: string = 'https://feeflow.iotsoft.in/') {
  const message = `🏆 *${institutionName}* uses FeeFlow for smart fee management.\n\nJoin with code: *${inviteCode}*\n📱 Install FeeFlow: ${appLink}\n\n✅ Track fees, get receipts on WhatsApp, 100% private.`;
  Share.share({
    title: 'Invite to join',
    text: message,
    dialogTitle: 'Share via',
  });
}

export function shareReceiptText(instName: string, memberName: string, amount: number, period: string, receiptNo: string, appLink: string) {
  const text = `✅ *Fee Receipt* - ${instName}\n\nMember: ${memberName}\nAmount: ₹${amount.toLocaleString('en-IN')}\nPeriod: ${period}\nReceipt #${receiptNo}\n\n📱 Track all your fees with FeeFlow: ${appLink}`;
  Share.share({ title: 'Receipt', text, dialogTitle: 'Share receipt' });
}