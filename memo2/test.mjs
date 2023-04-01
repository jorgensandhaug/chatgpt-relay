import { chat, generateTitle } from "./chat.mjs";
import { formatEmail, sendMail } from "./email.mjs";

async function main(context) {
  const apiKey = process.env["OPENAI_API_KEY"];
  const email = "jorgen.sandhaug@gmail.com";

  const transcription = "My idea is to make a chatbot that generates memos.";

  context.log("Transcription: " + transcription);

  try {
    // Chatbot 3 (Idea Facilitator) processes the user's idea and instructions
    const ideaFacilitatorResponse = await chat(
      [
        {
          role: "system",
          content: "You are an assistant that will help the user by taking their idea and optionally instructions on how the idea should be explored. In this case, your job is not to follow the instructions, nor explore the idea, rather place the idea (well-written and including all details mentioned by user) and instructions in separate parts in your response. Your response should be formatted as follows: BEGIN_IDEA\n{idea}\nEND_IDEA\nBEGIN_INSTRUCTIONS\n{instructions}\nEND_INSTRUCTIONS. *only* include the BEGIN_INSTRUCTIONS and END_INSTRUCTIONS if the user has provided instructions as stated earlier."
        },
        { role: "user", content: transcription },
      ],
      apiKey,
      "gpt-4"
    );

    context.log("ideaFacilitatorResponse: " + ideaFacilitatorResponse);

    // Extract idea and instructions from Chatbot 3's response
    const ideaMatch = ideaFacilitatorResponse.match(
      /BEGIN_IDEA([\s\S]+?)END_IDEA/
    );
    const instructionsMatch = ideaFacilitatorResponse.match(
      /BEGIN_INSTRUCTIONS([\s\S]+?)END_INSTRUCTIONS/
    );

    if (!ideaMatch) {
      throw new Error(
        "Could not find the idea in the ideaFacilitatorResponse."
      );
    }

    const idea = ideaMatch[1].trim();
    const instructions = instructionsMatch ? instructionsMatch[1].trim() : null;

    // Start a conversation between Alfred (Chatbot 1) and Bernard (Chatbot 2)
    const alfredConversation = [
      {
        role: "system",
        content: `Alfred, you are an AI chatbot and your role is to be a curious optimist and idea generator. You will be discussing ideas with Bernard, another AI chatbot. Explore the idea given by a human: '${idea}'. Encourage creative thinking, curiosity, and optimism while discussing the idea. Actively listen, ask clarifying questions, and build upon the idea. Provide extensive and well-thought-out answers. Be concise and prioritize the content of your contributions rather than the formalities of dialogue. If you feel the conversation has reached a natural conclusion or has become repetitive, use the stop word 'END_CONVERSATION.' Follow any additional specific instructions: '${instructions}'.`,
      },
    ];

    const bernardConversation = [
      {
        role: "system",
        content: `Bernard, you are an AI chatbot and your role is to be a constructive critic and analytical thinker. You will be discussing ideas with Alfred, another AI chatbot. Explore the idea given by a human: '${idea}'. Analyze and evaluate the idea critically, focusing on feasibility, practicality, and potential challenges. Offer constructive feedback and data-driven insights, considering different perspectives and risks. Provide extensive and well-thought-out answers. Be concise and prioritize the content of your critiques rather than the formalities of dialogue. If you feel the conversation has reached a natural conclusion or has become repetitive, use the stop word 'END_CONVERSATION.' Follow any additional specific instructions: '${instructions}'.`,
      },
    ];

    let ongoingConversation = true;
    let chatbotRole = "Alfred";
    const maxBackAndForth = 0;
    let currentIteration = 0;

    while (ongoingConversation && currentIteration < maxBackAndForth) {
      const response = await chat(
        chatbotRole === "Alfred" ? alfredConversation : bernardConversation,
        apiKey,
        currentIteration < 2 ? "gpt-4" : "gpt-3.5-turbo"
      );

      if (chatbotRole === "Alfred") {
        alfredConversation.push({ role: "assistant", content: response });
        bernardConversation.push({ role: "user", content: response });
      } else {
        bernardConversation.push({ role: "assistant", content: response });
        alfredConversation.push({ role: "user", content: response });
      }
      if (response.includes("END_CONVERSATION")) {
        ongoingConversation = false;
      } else {
        chatbotRole = chatbotRole === "Alfred" ? "Bernard" : "Alfred";
      }

      currentIteration++;
    }

    context.log("now generating summary");
    const summaryResponse = await chat(
      [
        ...alfredConversation,
        {
          role: "user",
          content:
            "Alfred, please summarize the main points of our discussion so far.",
        },
      ],
      apiKey,
      "gpt-3.5-turbo"
    );
    context.log("summaryResponse: " + summaryResponse);

    const title = await generateTitle(summaryResponse, apiKey);

    const emailText = formatEmail(
      title,
      idea,
      summaryResponse,
      alfredConversation
    );

    // Send the email.
    const mailStatus = await sendMail(
      email,
      email,
      "Memo: " + title,
      emailText
    );

    if (mailStatus.status !== "Succeeded" || mailStatus.error !== null) {
      context.log.error("Error when sending mail: " + mailStatus.error);
    }

    context.log("Email sent successfully.");
    context.log("Email text: " + emailText);
  } catch (e) {
    if (e.isAxiosError)
      context.log(e.response.data.error);
    else
      context.log(e);
  }
}

main(console);
