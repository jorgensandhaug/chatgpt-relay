const axios = require("axios");
const FormData = require("form-data");

const { Configuration, OpenAIApi } = require("openai");

async function chat(messages, api_key) {
  const configuration = new Configuration({
    apiKey: api_key,
  });
  const openai = new OpenAIApi(configuration);

  const response = await openai.createChatCompletion({
    model: "gpt-4",
    messages: messages,
  });
  return response.data.choices[0].message.content;
}

async function getTitleFromTranscription(transcription, api_key) {
  const messages = [
    {
      role: "system",
      content:
        "You are a helpful assistant that generates a title for a memo from a given transcription. Try your best to create an appropriate and concise title based on the content, even if there might be errors in the transcription.",
    },
    {
      role: "user",
      content: transcription,
    },
  ];

  const title = await chat(messages, api_key);
  return title;
}

module.exports = async function (context, req) {
  context.log("JavaScript HTTP trigger function processed a request.");

  if (req.body && req.headers && req.headers["content-type"]) {
    try {
      const formData = new FormData();
      const audioBuffer = req.body;
      const contentType = req.headers["content-type"];
      const api_key = req.headers.api_key;

      formData.append("file", audioBuffer, {
        filename: "audiofile",
        contentType: contentType,
      });
      formData.append("model", "whisper-1");

      context.log(formData.getHeaders());

      const response = await axios.post(
        "https://api.openai.com/v1/audio/transcriptions",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${api_key}`,
          },
        }
      );

      const transcription = response.data.text;

      const doc = context.bindings.inDocument;

      if (!doc) {
        context.res = {
          status: 404,
          body: "Cosmos doc not found.",
        };
        return;
      }

      const memos = doc.memos || [];

      const memo = {
        date: new Date().toISOString(),
        transcription: transcription,
        title: await getTitleFromTranscription(transcription, api_key),
      };

      const messages = [
        {
          role: "system",
          content:
            "You are Alfred, a helpful assistant that handles memos that are transcribed from speech. Because the transcription can have errors, try the best you can to understand what the user is trying to say or ideating. The first time you're given a memo, your task is to summarize it into bullet points. If it contains any action points, also create a list with these. Additionally, follow any instructions directed towards you given in the transcription.",
        },
        {
          role: "user",
          content: response.text,
        },
      ];

      const followup = await chat(messages, api_key);

      messages.push({
        role: "assistant",
        content: followup,
      });

      memo.conversation = messages;

      context.bindings.outDocument = {
        ...doc,
        memos: [...memos, memo],
      };

      context.res = {
        status: 200,
        body: "Succesfully transcribed and stored memo.",
      };
    } catch (error) {
      context.log.error("Error calling Whisper API:", error.message);
      context.res = {
        status: 500,
        body: "Error calling Whisper API: " + error.message,
      };
    }
  } else {
    context.res = {
      status: 400,
      body: "Please provide an audio file in the request body.",
    };
  }
};
