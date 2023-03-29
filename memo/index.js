const axios = require("axios");
const FormData = require("form-data");
const { Readable } = require("stream");

const { Configuration, OpenAIApi } = require("openai");

const { EmailClient } = require("@azure/communication-email");

const SENDER_ADDRES = "7996eff4-4419-4ba3-a0f7-2b437d7fbf34.azurecomm.netw";

const connectionString =
  process.env["COMMUNICATION_SERVICES_CONNECTION_STRING"];
const emailClient = new EmailClient(connectionString);

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
  await sendMail(fromAddress, toAddress, recipientName, subject, mailBody);
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

  if (req.body && req.headers.api_key && req.headers.email) {
    try {
      const api_key = req.headers.api_key;
      const email = req.headers.email;

      // Add your code here.
      const formData = new FormData();
      const readableStream = new Readable();

      readableStream.push(req.body);
      readableStream.push(null);

      formData.append("file", readableStream, { filename: "audio.m4a" });
      formData.append("model", "whisper-1");

      context.log("FormData " + formData);

      context.log(formData.getHeaders());

      context.log("Sending request to Whisper API");

      let err = null;
      const response = await axios
        .post("https://api.openai.com/v1/audio/translations", formData, {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${api_key}`,
          },
        })
        .catch((error) => {
          context.log(error);
          context.res = {
            status: 500,
            body: "Error in Whisper API request. " + error,
          };
          err = true;
        });

      if (err) {
        return;
      }

      context.log("Whisper API response received");

      const transcription = response.data.text;

      context.log("Transcription: " + transcription);

      const doc = context.bindings.inDocument;

      if (!doc) {
        context.res = {
          status: 404,
          body: "Cosmos doc not found.",
        };
        return;
      }
      context.log("Generating title from transcription");
      const memos = doc.memos || [];

      const memo = {
        date: new Date().toISOString(),
        transcription: transcription,
        title: await getTitleFromTranscription(transcription, api_key),
      };

      context.log(
        "Generating bullet points, action points, and following instructions"
      );
      const messages = [
        {
          role: "system",
          content:
            "You are Alfred, a helpful assistant that handles memos that are transcribed from speech. Because the transcription can have errors, try the best you can to understand what the user is trying to say or ideating. The first time you're given a memo, your task is to summarize it into bullet points. If it contains any action points, also create a list with these. Additionally, follow any instructions directed towards you given in the transcription.",
        },
        {
          role: "user",
          content: transcription,
        },
      ];

      const followup = await chat(messages, api_key);

      messages.push({
        role: "assistant",
        content: followup,
      });

      memo.conversation = messages;

      context.log("Updating Cosmos DB document");
      context.bindings.outDocument = {
        ...doc,
        memos: [...memos, memo],
      };

      // Call the function with arguments
      sendMemoAsMail(
        SENDER_ADDRES,
        email,
        "<recipient-name>",
        "MemoGPT: " + memo.title,
        memo
      );

      context.res = {
        status: 200,
        body: "Successfully transcribed and stored memo.",
      };
      context.log("Completed processing request");
    } catch (error) {
      context.log.error("Error:", error.message);
      context.res = {
        status: 500,
        body: "Error: " + error.message,
      };
    }
  } else {
    context.res = {
      status: 400,
      body: "Please provide an audio file and API key.",
    };
  }
};
