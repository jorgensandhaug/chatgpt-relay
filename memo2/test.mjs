import { chat } from "./chat.mjs";
import { formatEmail } from "./email.mjs";

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;
  
    // User provides an idea and optional instructions
    const userMessage = "I have an idea about implementing solar-powered charging stations for electric vehicles in public spaces.";
  
    // Chatbot 3 (Idea Facilitator) processes the user's idea and instructions
    const ideaFacilitatorResponse = await chat(
      [
        { role: "system", content: "Your role is to be an idea facilitator and exploration coordinator. Collect ideas from the user and any optional instructions on how the idea should be explored, the amount of exploration, or specific aspects to consider. Then, provide the idea and any instructions in two separate formats that can be easily extracted later. Start the idea with 'BEGIN_IDEA' and end with 'END_IDEA.' Start the instructions with 'BEGIN_INSTRUCTIONS' and end with 'END_INSTRUCTIONS' for clarity. Only use the instructions part if the user has provided instructions as stated earlier." },
        { role: "user", content: userMessage },
      ],
      apiKey
    );

    console.log(ideaFacilitatorResponse);
  
    // Extract idea and instructions from Chatbot 3's response
    const idea = ideaFacilitatorResponse.match(/BEGIN_IDEA(.+?)END_IDEA/)[1].trim();
    const instructions = ideaFacilitatorResponse.match(/BEGIN_INSTRUCTIONS(.+?)END_INSTRUCTIONS/);
  
    // Start a conversation between Alfred (Chatbot 1) and Bernard (Chatbot 2)
    const alfredConversation = [
      {
        role: "system",
        content: `Alfred, you are an AI chatbot and your role is to be a constructive critic and analytical thinker. You will be discussing ideas with Bernard, another AI chatbot. Explore the idea: '${idea}'. Follow any specific instructions: '${instructions}'. Analyze and evaluate the idea critically, focusing on feasibility, practicality, and potential challenges. Offer constructive feedback and data-driven insights, considering different perspectives and risks. Provide extensive and well-thought-out answers. Be concise and prioritize the content of your critiques rather than the formalities of dialogue. If you feel the conversation has reached a natural conclusion or has become repetitive, use the stop word 'END_CONVERSATION.'`
      },
    ];
  
    const bernardConversation = [
      {
        role: "system",
        content: `Bernard, you are an AI chatbot and your role is to be a curious optimist and idea generator. You will be discussing ideas with Alfred, another AI chatbot. Explore the idea: '${idea}'. Follow any specific instructions: '${instructions}'. Encourage creative thinking, curiosity, and optimism while discussing the idea. Actively listen, ask clarifying questions, and build upon the idea. Provide extensive and well-thought-out answers. Be concise and prioritize the content of your contributions rather than the formalities of dialogue. If you feel the conversation has reached a natural conclusion or has become repetitive, use the stop word 'END_CONVERSATION.'`
      },
    ];
  
    let ongoingConversation = true;
    let chatbotRole = "Alfred";
    const maxBackAndForth = 10;
    let currentIteration = 0;
  
    while (ongoingConversation && currentIteration < maxBackAndForth) {
        try {
          const response = await chat(
            chatbotRole === "Alfred" ? alfredConversation : bernardConversation,
            apiKey
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
        } catch (error) {
          console.error("Error during chat:", error);
          break;
        }
      }
    
      try {
        const summaryResponse = await chat(
          [
            ...alfredConversation,
            { role: "user", content: "Alfred, please summarize the main points of our discussion so far." },
          ],
          apiKey
        );
        console.log("Summary:", summaryResponse);

        const emailText = formatEmail(idea, summaryResponse, alfredConversation);
        console.log("Email text:", emailText);
      } catch (error) {
        console.error("Error during summary request:", error);
      }
    
}

main();

