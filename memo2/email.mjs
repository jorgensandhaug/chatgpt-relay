export function formatEmail(idea, summary, alfredConversation) {
    let emailText = `Idea:\n${idea}\n\nThe idea has been further explored by Alfred and Bernard. Here is a summary of the exploration:\n\nSummary:\n${summary}\n\nConversation:\n`;

    alfredConversation.slice(1).forEach((message) => {
      const role = message.role === "assistant" ? "Alfred" : "Bernard";
      emailText += `${role}: ${message.content}\n`;
    });
  
    return emailText;
  }
  