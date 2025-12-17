import {SendEmailCommand, SESv2Client} from "@aws-sdk/client-sesv2";
import QRCode from "qrcode";

// Initialize SES client
const sesClient = new SESv2Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || "hello@stanfordspeakersbureau.com";

type TicketEmailData = {
  email: string;
  eventName: string;
  ticketType: string;
  eventStartTime: string | null;
  eventRoute: string | null;
  ticketId: string;
};

/**
 * Generate QR code as data URI for embedding in email
 */
async function generateQRCodeDataURI(ticketId: string): Promise<string> {
  try {
    return await QRCode.toDataURL(ticketId, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    // Return empty string if QR code generation fails
    return "";
  }
}

/**
 * Generate HTML email content for ticket confirmation
 */
async function generateTicketEmailHTML(
  data: TicketEmailData,
): Promise<string> {
  const { eventName, ticketType, eventStartTime, eventRoute, ticketId } = data;
  
  const formattedDate = eventStartTime
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(eventStartTime))
    : "TBA";

  const eventUrl = eventRoute
    ? `${process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com"}/events/${eventRoute}`
    : null;

  // Generate QR code
  const qrCodeDataURI = await generateQRCodeDataURI(ticketId);
  const isVIP = ticketType?.toUpperCase() === "VIP";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #18181b; color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #18181b;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #27272a; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #A80D0C 0%, #C11211 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Ticket Confirmed!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 24px 0; color: #f4f4f5; font-size: 16px; line-height: 1.6;">
                Thank you for your ticket purchase. Your ticket has been confirmed!
              </p>
              
              <!-- Ticket Details Card -->
              <div style="background-color: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 22px; font-weight: 600;">Event Details</h2>
                
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px; width: 120px;">Event:</td>
                    <td style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">${eventName || "Event"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px;">Date & Time:</td>
                    <td style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-weight: 500;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px;">Ticket Type:</td>
                    <td style="padding: 8px 0;">
                      <span style="display: inline-block; padding: 4px 12px; background-color: ${ticketType === "VIP" ? "#3b82f6" : "#71717a"}; color: #ffffff; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                        ${ticketType || "STANDARD"}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px;">Ticket ID:</td>
                    <td style="padding: 8px 0; color: #f4f4f5; font-size: 14px; font-family: monospace;">${ticketId}</td>
                  </tr>
                </table>
              </div>
              
              ${qrCodeDataURI ? `
              <!-- QR Code Section -->
              <div style="background-color: #18181b; border: 1px solid #3f3f46; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <h2 style="margin: 0 0 16px 0; color: #ffffff; font-size: 20px; font-weight: 600;">Your Ticket QR Code</h2>
                <div style="display: inline-block; background-color: #ffffff; padding: 16px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);">
                  <img src="${qrCodeDataURI}" alt="Ticket QR Code" style="display: block; width: 250px; height: 250px; max-width: 100%;" />
                </div>
                ${isVIP ? `
                <div style="margin-top: 12px;">
                  <span style="display: inline-block; padding: 6px 16px; background-color: #A80D0C; color: #ffffff; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                    VIP
                  </span>
                </div>
                ` : ""}
                <p style="margin: 16px 0 0 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                  Show this QR code at the event entrance for quick check-in.
                </p>
              </div>
              ` : ""}
              
              ${eventUrl ? `
              <!-- View Event Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${eventUrl}" style="display: inline-block; padding: 14px 28px; background-color: #A80D0C; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Event Details</a>
                  </td>
                </tr>
              </table>
              ` : ""}
              
              <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                Please bring a valid ID and this confirmation email to the event. We look forward to seeing you there!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #18181b; border-top: 1px solid #3f3f46; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #71717a; font-size: 12px;">
                Stanford Speakers Bureau
              </p>
              <p style="margin: 0; color: #71717a; font-size: 12px;">
                If you have any questions, please contact us at <a href="mailto:${FROM_EMAIL}" style="color: #a1a1aa; text-decoration: none;">${FROM_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email content for ticket confirmation
 */
function generateTicketEmailText(data: TicketEmailData): string {
  const { eventName, ticketType, eventStartTime, eventRoute, ticketId } = data;
  
  const formattedDate = eventStartTime
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(eventStartTime))
    : "TBA";

  const eventUrl = eventRoute
    ? `${process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com"}/events/${eventRoute}`
    : null;

  return `
Ticket Confirmed!

Thank you for your ticket purchase. Your ticket has been confirmed!

Event Details:
- Event: ${eventName || "Event"}
- Date & Time: ${formattedDate}
- Ticket Type: ${ticketType || "STANDARD"}
- Ticket ID: ${ticketId}
${eventUrl ? `- Event URL: ${eventUrl}` : ""}

Please bring a valid ID and this confirmation email to the event. We look forward to seeing you there!

Stanford Speakers Bureau
If you have any questions, please contact us at ${FROM_EMAIL}
  `.trim();
}

/**
 * Send ticket confirmation email via AWS SES
 * Throws an error if email sending fails
 */
export async function sendTicketEmail(data: TicketEmailData): Promise<void> {
  const htmlContent = await generateTicketEmailHTML(data);
  const textContent = generateTicketEmailText(data);

  const command = new SendEmailCommand({
    FromEmailAddress: FROM_EMAIL,
    Destination: {
      ToAddresses: [data.email],
    },
    Content: {
      Simple: {
        Subject: {
          Data: `Your Ticket Confirmation - ${data.eventName || "Event"}`,
          Charset: "UTF-8",
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: "UTF-8",
          },
          Text: {
            Data: textContent,
            Charset: "UTF-8",
          },
        },
      },
    },
  });

  await sesClient.send(command);
  console.log(`Ticket confirmation email sent to ${data.email}`);
}

