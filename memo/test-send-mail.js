async function sendMail(
    senderAddress,
    recipientAddress,
    recipientName,
    subject,
    plainText
  ) {
    try {
      const message = {
        senderAddress: senderAddress,
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
  
  async function sendMemoAsMail(
    fromAddress,
    toAddress,
    recipientName,
    subject,
    memo
  ) {
    // Generate the mail body
    const mailBody = `Hello,
  
    Please find attached a memo transcribed from speech that was sent to me:
  
    Title: ${memo.title}
  
    Conversation:
    ${memo.conversation
      .map((message) => `[${message.role}] ${message.content}`)
      .join("\n")}
    `;
  
    // Send the mail
    await sendMail(context, fromAddress, toAddress, recipientName, subject, mailBody);
  }

function main() {
}