import { OpenAIApi, Configuration } from "openai";

export async function chat(messages, api_key) {
    const configuration = new Configuration({
      apiKey: api_key,
    });
    const openai = new OpenAIApi(configuration);
  
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: messages,
    });
    return response.data.choices[0].message.content;
  }