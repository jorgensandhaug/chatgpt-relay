import { OpenAIApi, Configuration } from "openai";

export async function chat(messages, apiKey, model, max_tokens=4096) {
    const configuration = new Configuration({
      apiKey: apiKey,
    });
    const openai = new OpenAIApi(configuration);
  
    const response = await openai.createChatCompletion({
      model: model,
      messages: messages,
      max_tokens: max_tokens,
    });
    return response.data.choices[0].message.content;
  }

export async function generateTitle(summary, apiKey) {
  const messages = [
    {
      role: "system",
      content:
        "You are a helpful assistant that generates a title for a memo from a given summary. Try your best to create an appropriate and concise title based on the content.",
    },
    {
      role: "user",
      content: summary,
    },
  ];

  const title = await chat(messages, apiKey, "gpt-3.5-turbo");
  return title;
}
