export declare const FORSA_EMAIL_STYLES = "\n  body { margin: 0; padding: 0; background: #f0f4ff; font-family: 'Segoe UI', Arial, sans-serif; }\n  .wrapper { max-width: 600px; margin: 32px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15,28,66,0.08); }\n  .header { background: linear-gradient(135deg, #0F1C42 0%, #1B2A5E 100%); padding: 32px 40px; text-align: center; }\n  .logo { font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.02em; }\n  .logo span { color: #2dd4bf; }\n  .tagline { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px; }\n  .body { padding: 40px; }\n  .greeting { font-size: 22px; font-weight: 700; color: #0F1C42; margin-bottom: 12px; }\n  .text { font-size: 15px; color: #4b5563; line-height: 1.7; margin-bottom: 16px; }\n  .highlight-box { background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }\n  .highlight-box.success { background: #f0fdf4; border-color: #86efac; }\n  .highlight-box.warning { background: #fffbeb; border-color: #fde68a; }\n  .highlight-box.navy { background: #f0f4ff; border-color: #c7d2fe; }\n  .highlight-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 4px; }\n  .highlight-value { font-size: 18px; font-weight: 700; color: #0F1C42; }\n  .btn { display: inline-block; background: #14b8a6; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 15px; margin: 24px 0; }\n  .btn:hover { background: #0891b2; }\n  .btn.navy { background: #0F1C42; }\n  .divider { border: none; border-top: 1px solid #f3f4f6; margin: 32px 0; }\n  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }\n  .info-item { background: #f9fafb; border-radius: 10px; padding: 14px 16px; }\n  .info-item-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; }\n  .info-item-value { font-size: 15px; font-weight: 600; color: #111827; margin-top: 2px; }\n  .checklist { list-style: none; padding: 0; margin: 0; }\n  .checklist li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: #374151; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }\n  .checklist li:last-child { border-bottom: none; }\n  .check { color: #14b8a6; font-weight: 700; flex-shrink: 0; }\n  .footer { background: #0F1C42; padding: 24px 40px; text-align: center; }\n  .footer-text { font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6; }\n  .footer-text a { color: rgba(255,255,255,0.5); text-decoration: none; }\n  .disclaimer { font-size: 12px; color: #9ca3af; font-style: italic; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f3f4f6; }\n";
export declare const applicationReceivedEmail: (data: {
    firstName: string;
    lastName: string;
    university: string;
    program: string;
    tuition: string;
    applicationRef: string;
}) => {
    subject: string;
    html: string;
};
export declare const aiInterviewCompletedEmail: (data: {
    firstName: string;
    score?: number;
    recommendation?: string;
}) => {
    subject: string;
    html: string;
};
export declare const preApprovedEmail: (data: {
    firstName: string;
    lastName: string;
    university: string;
    program: string;
    amount: string;
    meetingContact: string;
}) => {
    subject: string;
    html: string;
};
export declare const activationMeetingEmail: (data: {
    firstName: string;
    meetingDate?: string;
    meetingTime?: string;
    meetingAddress: string;
    contactEmail: string;
    contactPhone: string;
}) => {
    subject: string;
    html: string;
};
export declare const paymentReminderEmail: (data: {
    firstName: string;
    installmentNumber: number;
    totalInstallments: number;
    amount: string;
    dueDate: string;
    paymentReference: string;
    bankName: string;
    rib: string;
    iban: string;
}) => {
    subject: string;
    html: string;
};
export declare const paymentReceivedEmail: (data: {
    firstName: string;
    installmentNumber: number;
    totalInstallments: number;
    amount: string;
    paidDate: string;
    paymentReference: string;
    remainingAmount: string;
    remainingInstallments: number;
}) => {
    subject: string;
    html: string;
};
export declare const bronzeMemberEmail: (data: {
    firstName: string;
    lastName: string;
    university: string;
    program: string;
}) => {
    subject: string;
    html: string;
};
export declare const EMAIL_TEMPLATES: {
    APPLICATION_RECEIVED: (data: {
        firstName: string;
        lastName: string;
        university: string;
        program: string;
        tuition: string;
        applicationRef: string;
    }) => {
        subject: string;
        html: string;
    };
    AI_INTERVIEW_COMPLETED: (data: {
        firstName: string;
        score?: number;
        recommendation?: string;
    }) => {
        subject: string;
        html: string;
    };
    PRE_APPROVED: (data: {
        firstName: string;
        lastName: string;
        university: string;
        program: string;
        amount: string;
        meetingContact: string;
    }) => {
        subject: string;
        html: string;
    };
    ACTIVATION_MEETING: (data: {
        firstName: string;
        meetingDate?: string;
        meetingTime?: string;
        meetingAddress: string;
        contactEmail: string;
        contactPhone: string;
    }) => {
        subject: string;
        html: string;
    };
    PAYMENT_REMINDER: (data: {
        firstName: string;
        installmentNumber: number;
        totalInstallments: number;
        amount: string;
        dueDate: string;
        paymentReference: string;
        bankName: string;
        rib: string;
        iban: string;
    }) => {
        subject: string;
        html: string;
    };
    PAYMENT_RECEIVED: (data: {
        firstName: string;
        installmentNumber: number;
        totalInstallments: number;
        amount: string;
        paidDate: string;
        paymentReference: string;
        remainingAmount: string;
        remainingInstallments: number;
    }) => {
        subject: string;
        html: string;
    };
    BRONZE_MEMBER: (data: {
        firstName: string;
        lastName: string;
        university: string;
        program: string;
    }) => {
        subject: string;
        html: string;
    };
};
export type EmailTemplate = keyof typeof EMAIL_TEMPLATES;
export declare const GUARANTOR_INVITED: (guarantorName: string, studentName: string, activationLink: string) => {
    subject: string;
    html: string;
};
export declare const GUARANTOR_PAYMENT_REMINDER: (guarantorName: string, studentName: string, amount: number, dueDate: string, paymentUrl: string) => {
    subject: string;
    html: string;
};
export declare const GUARANTOR_PAYMENT_CONFIRMED: (guarantorName: string, studentName: string, amount: number, month: string) => {
    subject: string;
    html: string;
};
