import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(req: NextRequest) {
  try {
    const { studentEmail, studentName, caseType, riskStatus, expiryDate } =
      await req.json();
    const testRecipient = process.env.RESEND_TEST_TO?.trim();
    const recipient = testRecipient || studentEmail;

    if (!studentEmail) {
      return NextResponse.json(
        { error: "Missing student email" },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: "Email service not configured. Add RESEND_API_KEY to environment.",
        },
        { status: 500 }
      );
    }

    const resend = getResend();

    const emailSubject =
      riskStatus === "EXPIRED"
        ? `⚠️ Urgent: Your Visa Permit Has Expired`
        : `🕐 Alert: Your Visa Permit is Expiring Soon`;

    const emailBody =
      riskStatus === "EXPIRED"
        ? `Dear ${studentName},

Your ${caseType?.replace(/_/g, " ")} permit has EXPIRED as of ${expiryDate}.

This requires immediate action. Please contact the International Office urgently to resolve your compliance status.

EXPIRED permits may result in:
- Academic penalties
- Immigration violations
- Inability to register for courses

Please reach out to the Compliance Office immediately.

Best regards,
Daystar University International Office
SpiroHub Compliance System`
        : `Dear ${studentName},

Your ${caseType?.replace(/_/g, " ")} permit is EXPIRING SOON on ${expiryDate}.

Please prepare the following:
1. Renewal documents
2. Medical examination (if required)
3. Updated financial proof

Contact the International Office to submit your renewal application.

Best regards,
Daystar University International Office
SpiroHub Compliance System`;

    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "noreply@daystar.ac.ke",
      to: recipient,
      subject: emailSubject,
      text:
        recipient !== studentEmail
          ? `${emailBody}\n\n---\nOriginal intended recipient: ${studentEmail}`
          : emailBody,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.data?.id,
      deliveredTo: recipient,
      sandboxMode: recipient !== studentEmail,
    });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
