const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const profitLossInvoiceTemplate = ({
  companyName = "EA Consultancy",
  reportTitle = "Profit & Loss Invoice",
  reportDate = "",
  invoiceNumber = "",
  message = "",
  supportEmail = "ceo@eaconsultancy.info",
}) => {
  const safeCompanyName = escapeHtml(companyName);
  const safeReportTitle = escapeHtml(reportTitle);
  const safeReportDate = escapeHtml(reportDate);
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeMessage = escapeHtml(message);
  const safeSupportEmail = escapeHtml(supportEmail);

  return `
  <div style="margin:0; padding:24px; background:#f4f7fb; font-family:Arial, sans-serif;">
    <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
      <div style="padding:22px 24px; background:linear-gradient(135deg, #0f172a, #1d4ed8);">
        <h2 style="margin:0; color:#ffffff; font-size:20px; font-weight:700;">${safeCompanyName}</h2>
        <p style="margin:6px 0 0; color:#dbeafe; font-size:13px;">
          Your requested PDF report is attached with this email
        </p>
      </div>

      <div style="padding:24px;">
        <p style="margin:0 0 12px; color:#111827; font-size:14px;">Hello,</p>
        <p style="margin:0 0 16px; color:#374151; font-size:14px; line-height:1.7;">
          Please find attached your <strong>${safeReportTitle}</strong> PDF file.
          ${safeMessage ? `<br /><br />${safeMessage}` : ""}
        </p>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
          <p style="margin:0 0 8px; color:#0f172a; font-size:14px;"><strong>Document:</strong> ${safeReportTitle}</p>
          ${
            safeInvoiceNumber
              ? `<p style="margin:0 0 8px; color:#0f172a; font-size:14px;"><strong>Invoice No:</strong> ${safeInvoiceNumber}</p>`
              : ""
          }
          ${
            safeReportDate
              ? `<p style="margin:0; color:#0f172a; font-size:14px;"><strong>Report Date:</strong> ${safeReportDate}</p>`
              : ""
          }
        </div>

        <p style="margin:18px 0 0; color:#4b5563; font-size:13px; line-height:1.7;">
          If you have any questions or need any correction, please reply to this email or contact us at
          <a href="mailto:${safeSupportEmail}" style="color:#1d4ed8; text-decoration:none;">${safeSupportEmail}</a>.
        </p>
      </div>

      <div style="padding:14px 24px; border-top:1px solid #e5e7eb; background:#f9fafb;">
        <p style="margin:0; color:#6b7280; font-size:12px; line-height:1.6;">
          This is an automated message from ${safeCompanyName}. Please keep the attached PDF for your records.
        </p>
      </div>
    </div>
  </div>
  `;
};

module.exports = profitLossInvoiceTemplate;
