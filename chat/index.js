async function fetchChatResponse(key, messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: messages,
    }),
    });
    const data = await response.json();
    const text =  data['choices'][0]["message"]["content"];

    // double escape twice all possible json characters
    const escapedText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'")
    return escapedText;
}


module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');
    // Your JSON string

const api_key = req.headers.api_key;
context.log(api_key);

const messages_text = req.body.messages;

const jsonArrayString = `[${messages_text.replace(/\\\"/g, '\"').replace(/\n/g, ',').replace(/\'/g, '')}]`;
context.log(jsonArrayString);
const escapedJsonString = jsonArrayString

// Escape quotes inside the content part of the JSON string, aka
// ....{"content":"This is a test","role":"user"},{"content":"I understand, I am here to help you with your questions and tasks. Please ask anything you need assistance with.","role":"assistant"},{"content":"What did I just say to you","role":"user"},{"content":"You just said, "This is a test."","role":"assistant"},{"content":"Can ice","role":"user"}]
// ....becomes
// ....{"content":"This is a test","role":"user"},{"content":"I understand, I am here to help you with your questions and tasks. Please ask anything you need assistance with.","role":"assistant"},{"content":"What did I just say to you","role":"user"},{"content":"You just said, \"This is a test.\"","role":"assistant"},{"content":"Can ice","role":"user"}]

// const escapedJsonString = jsonArrayString.replace(/"content":"([^"]*)",/g, (match, p1) => {
//     return `"content":"${p1.replace(/"/g, '\\"')}"`
// });



// Parse the JSON array string into a JavaScript array
messages = JSON.parse(escapedJsonString);

context.log(messages);

const response = await fetchChatResponse(api_key, messages);
context.res = {
        // status: 200, /* Defaults to 200 */
        body: response
    };
}