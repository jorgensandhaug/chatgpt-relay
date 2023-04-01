const axios = require("axios");
const FormData = require("form-data");
const { Readable } = require("stream");

const { Configuration, OpenAIApi } = require("openai");

const { EmailClient } = require("@azure/communication-email");

const connectionString =
  process.env["COMMUNICATION_SERVICES_CONNECTION_STRING"];

const emailClient = new EmailClient(connectionString);

const SENDER_ADDRESS =
  "donotreply@7996eff4-4419-4ba3-a0f7-2b437d7fbf34.azurecomm.net";

const expnd = (obj) => JSON.stringify(obj, null, 2);

async function chat(messages, api_key) {
  const configuration = new Configuration({
    apiKey: api_key,
  });
  const openai = new OpenAIApi(configuration);

  const response = await openai.createChatCompletion({
    model: "gpt-3.5",
    messages: messages,
  });
  return response.data.choices[0].message.content;
}

async function sendMail(
  context,
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

    context.log("message,", expnd(message));

    const poller = await emailClient.beginSend(message);
    const response = await poller.pollUntilDone();
    return response;
  } catch (e) {
    console.log(e);
  }
}

async function sendMemoAsMail(
  context,
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
    .map((message) => `\n\n[${message.role}] ${message.content}`)
    .join("\n")}
  `;

  // Send the mail
  return await sendMail(
    context,
    fromAddress,
    toAddress,
    recipientName,
    subject,
    mailBody
  );
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

      context.log("successfully created email client");

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

      // const doc = context.bindings.inDocument;

      // if (!doc) {
      //   context.res = {
      //     status: 404,
      //     body: "Cosmos doc not found.",
      //   };
      //   return;
      // }
      // const memos = doc.memos || [];

      context.log("Generating title from transcription");
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
            "You are Alfred, a helpful assistant that handles memos that are transcribed from speech. Because the transcription can have errors, try the best you can to understand what the user is trying to say or ideating. The first time you're given a memo, your task is to summarize it into bullet points. If it contains any action points, also create a list with these. Additionally, follow any instructions given to you (Alfred) by the user and respond with what the user wants in addition to the Summary and Action points. Finally, if and only if the user's text contains any kind of business idea or startup idea, include a section where you help the user by expanding and exploring their idea by discussing it further with another AI assistant called Bernard. Direct the business idea discussion towards Bernard, Be concise and creative in your dialogue. If the user's text does not contain any business idea or startup idea, do not include this section. The structure of your first response should be like the following:\nSummary:\n- <bullet point 1>\n- <bullet point 2>\n\nAction Points:\n- <action point 1>\n- <action point 2>\n\n<your response to all user instructions given>. \n\nBusiness Idea:\n<your exploration of the business idea>. <Stop your first answer here>. \n\n\nAfter your first answer you will conduct a discussion with Bernard.",
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

      const system_prompt_assistant_2 =
        "You are Bernard. You are a helpful assistant that loves to discuss and explore business ideas. You will talk to The AI assistant Alfred and Develop further the business idea. You should ask questions about the business idea and discuss it with Alfred. You should also give your own ideas about the business idea. Be concise and creative in your dialogue.";
      // Now for the back and forth exploration of the business idea.
      if (followup.includes("Business Idea:")) {
        context.log("Business Idea found");
        const businessIdea = followup.split("Business Idea:")[1].trim();
        // copy messages but replace the first index with the new prompt

        context.log("Business Idea: " + businessIdea);

        const messages2 = [
          {
            role: "system",
            content: system_prompt_assistant_2,
          },
          {
            role: "user",
            content: businessIdea,
          },
        ];

        // 3 times back and forth
        for (let i = 0; i < 3; i++) {
          context.log("Business Idea Assistant iteration " + i);
          try{
            let bia = await chat(messages2, api_key);
            messages2.push({
              role: "assistant",
              content: bia,
            });
            messages.push({
              role: "user",
              content: bia,
            });

            let alf = await chat(messages, api_key);
            messages.push({
              role: "assistant",
              content: alf,
            });
            messages2.push({
              role: "user",
              content: alf,
            });
          }
          catch(e){
            context.log.error("Error in Business Idea Assistant iteration " + i + ": " + e);
          }
        }
      }

      memo.conversation = messages;

      // context.log("Updating Cosmos DB document");
      // context.bindings.outDocument = {
      //   ...doc,
      //   memos: [...memos, memo],
      // };

      context.log("Sending mail");

      try {
        // Call the function with arguments
        const mailStatus = await sendMemoAsMail(
          context,
          SENDER_ADDRESS,
          email,
          "<recipient-name>",
          "MemoGPT: " + memo.title,
          memo
        );

        context.log("Mail sent");
        context.log(mailStatus);

        //status: 'Succeeded', error: null
        if (mailStatus.status != "Succeeded" || mailStatus.error != null) {
          context.log.error("mail send Error:", mailStatus.error);
          context.res = {
            status: 500,
            body: "Error when sending mail: " + mailStatus.error,
          };
          return;
        }

        context.res = {
          status: 200,
          body: "Successfully transcribed and sent memo.",
        };

        context.log("Completed processing request");
      } catch (error) {
        context.log.error("Error:", error.message);
        context.res = {
          status: 500,
          body: "Error: " + error.message,
        };
      }
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
