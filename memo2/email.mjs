import { EmailClient} from "@azure/communication-email";

  
const connectionString =
  process.env["COMMUNICATION_SERVICES_CONNECTION_STRING"];

const emailClient = new EmailClient(connectionString);

const SENDER_ADDRESS =
  "donotreply@7996eff4-4419-4ba3-a0f7-2b437d7fbf34.azurecomm.net";

export async function sendMail(
  recipientAddress,
  recipientName,
  subject,
  plainText
) {
  try {
    const message = {
      senderAddress: SENDER_ADDRESS,
      content: {
        subject: subject,
        plainText: plainText,
      },
      recipients: {
        to: [
          {
            address: recipientAddress,
            displayName: recipientName,
          },
        ],
      },
    };

    const poller = await emailClient.beginSend(message);
    const response = await poller.pollUntilDone();
    return response;
  } catch (e) {
    console.log(e);
  }
}


export function formatEmail(title, idea, summary, alfredConversation) {
    let emailText = `Title:${title}\n\nIdea:\n${idea}\n\nThe idea has been further explored by Alfred and Bernard. Here is a summary of the exploration:\n\nSummary:\n${summary}\n\nConversation:\n`;

    alfredConversation.slice(1).forEach((message) => {
      const role = message.role === "assistant" ? "Alfred" : "Bernard";
      emailText += `\n[${role}]: ${message.content}\n`;
    });
  
    return emailText;
  }