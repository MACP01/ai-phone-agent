const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const { twiml } = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';

app.post('/voice', (req, res) => {
  const response = new twiml.VoiceResponse();
  const gather = response.gather({
    input: 'speech',
    timeout: 5,
    speechTimeout: 'auto',
    action: '/process',
    method: 'POST'
  });

  gather.say("Hi, thanks for calling the barbershop. How can I help you today?");
  res.type('text/xml');
  res.send(response.toString());
});

app.post('/process', async (req, res) => {
  const callerSpeech = req.body.SpeechResult || "I'd like to book an appointment.";

  try {
    const gptResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful AI receptionist at a barbershop.' },
          { role: 'user', content: callerSpeech }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const gptReply = gptResponse.data.choices[0].message.content;

    const elevenResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        text: gptReply,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 1.0
        }
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    const audioPath = './response.mp3';
    fs.writeFileSync(audioPath, elevenResponse.data);

    const twimlResponse = new twiml.VoiceResponse();
    twimlResponse.play({ loop: 1 }, `${req.protocol}://${req.headers.host}/response.mp3`);
    res.type('text/xml');
    res.send(twimlResponse.toString());

  } catch (error) {
    console.error("Error:", error.message);
    const errorResponse = new twiml.VoiceResponse();
    errorResponse.say("Sorry, something went wrong. Please try again later.");
    res.type('text/xml');
    res.send(errorResponse.toString());
  }
});

app.get('/response.mp3', (req, res) => {
  res.sendFile(__dirname + '/response.mp3');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI phone agent running on port ${PORT}`);
});
