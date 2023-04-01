const axios = require("axios");
const FormData = require("form-data");
const { Readable } = require("stream");
const multer = require("multer");

async function fetchChatResponse(key, messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: messages,
    }),
  });
  const data = await response.json();
  const text = data["choices"][0]["message"]["content"];

  // Double escape all possible JSON characters
  const escapedText = text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
  return escapedText;
}

const upload = multer({ storage: multer.memoryStorage() });

async function transcribeAudioMultiPart(context, req, api_key) {
  return new Promise((resolve) => {
    // Use multer to handle the multipart/form-data request
    upload.single("audio")(req, {}, async (err) => {
      if (err) {
        context.log(err);
        context.res = {
          status: 500,
          body: "Error processing audio file. " + err,
        };
        resolve(null);
      } else {
        // Create FormData and Readable stream for the processed file
        const formData = new FormData();
        const readableStream = new Readable();
        readableStream.push(req.file.buffer);
        readableStream.push(null);

        // Append data to FormData
        formData.append("file", readableStream, { filename: "audio.m4a" });
        formData.append("model", "whisper-1");

        // Send request to Whisper API
        let error = null;
        const response = await axios
          .post("https://api.openai.com/v1/audio/translations", formData, {
            headers: {
              ...formData.getHeaders(),
              Authorization: `Bearer ${api_key}`,
            },
          })
          .catch((err) => {
            context.log(err);
            context.res = {
              status: 500,
              body: "Error in Whisper API request. " + err,
            };
            error = true;
          });

        if (error) {
          resolve(null);
        } else {
          // Extract transcription from Whisper API response
          const transcription = response.data.text;
          resolve(transcription);
        }
      }
    });
  });
}

module.exports = async function (context, req) {
  context.log("JavaScript HTTP trigger function processed a request.");

  // Create a promise to handle form fields
  const handleFormFields = new Promise((resolve, reject) => {
    upload.fields([{ name: 'messages' }, { name: 'audio' }])(req, {}, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  try {
    await handleFormFields;
  } catch (error) {
    context.log('Error in multer:', error);
    context.res = {
      status: 500,
      body: 'Error processing form fields. ' + error,
    };
    return;
  }

  const apiKey = req.headers.api_key;
  const reqMessages = req.body.messages ? JSON.parse(req.body.messages) : null;
  const reqAudio = req.files && req.files.audio ? req.files.audio[0].buffer : null;

  if (!apiKey || !reqMessages || !reqAudio) {
    context.res = {
      status: 400,
      body: 'Invalid request. Please provide API key, messages, and audio.',
    };
    return;
  }
  
  // Extract audio file from request body and transcribe it using Whisper API
  let transcription;
  try {
    transcription = await transcribeAudioMultiPart(context, req, apiKey);
    if (transcription === null) {
      return;
    }
  } catch (err) {
    context.log(err);
    context.res = {
      status: 500,
      body: "Unknown error. " + err,
    };
    return;
  }

  // Process messages from the request body
  const jsonArrayString = `[${reqMessages
    .replace(/\\\"/g, '"')
    .replace(/\n/g, ",")
    .replace(/\'/g, "")}]`;

  try {
    messages = JSON.parse(jsonArrayString);
  } catch (err) {
    context.log(err);
    context.res = {
      status: 500,
      body: "Error parsing messages. " + err,
    };
    return;
  }

  // Add transcription to messages
  messages.push({
    role: "user",
    content: transcription,
  });

  // Fetch new answer from OpenAI API

  let responseAI;

  try {
    responseAI = await fetchChatResponse(apiKey, messages);
  } catch (err) {
    context.log(err);
    context.res = {
      status: 500,
      body: "Error fetching response from OpenAI API. " + err,
    };
    return;
  }

  // Send the response
  context.res = {
    status: 200,
    body: {
      responseAI,
      transcription,
    },
  };
};
