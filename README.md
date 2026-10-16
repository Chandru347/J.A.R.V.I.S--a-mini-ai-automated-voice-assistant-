# JARVIS Voice Assistant

JARVIS is a beginner-friendly Python voice assistant built with LiveKit and Google's Gemini realtime model.
It can listen to you, respond with voice, open Google Chrome, search Google, and open websites.

> This project is currently designed for Windows because it opens Google Chrome directly on the computer.

## Features

- Voice conversations with Gemini realtime audio
- Natural responses with different tones
- Open Google Chrome by voice
- Search Google by voice
- Open HTTP and HTTPS websites in Chrome
- Optional LiveKit noise cancellation
- Simple Python code that is easy to customize

## Requirements

Install these before starting:

- Windows 10 or newer
- Python 3.10 or newer
- Google Chrome
- A Google AI API key
- A LiveKit Cloud project and credentials
- A microphone and speakers

## Installation

1. Download or clone this repository.

2. Open PowerShell in the project folder:

   ```powershell
   cd path\to\Jarvis_v1-main
   ```

3. Create a virtual environment:

   ```powershell
   python -m venv .venv
   ```

4. Activate the virtual environment:

   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```

   If PowerShell blocks the activation script, run this command once for your user account:

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

5. Install the dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

## Environment Variables

Create a file named `.env` in the project folder. Add your own credentials:

```env
GOOGLE_API_KEY=your_google_api_key_here
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
JARVIS_NOISE_CANCELLATION=0
```

### Getting the keys

- Create a Google AI API key in [Google AI Studio](https://aistudio.google.com/apikey).
- Create a LiveKit Cloud project at [LiveKit Cloud](https://cloud.livekit.io/).
- Copy the LiveKit URL, API key, and API secret into `.env`.

Never publish `.env`, API keys, or API secrets on GitHub. Treat these values like passwords.

## Running JARVIS

With the virtual environment active, run:

```powershell
python agent.py dev
```

The LiveKit agent will start and wait for a voice session. Connect to it using a LiveKit-compatible client or the LiveKit testing tools connected to your project.

To enable noise cancellation, change this value in `.env`:

```env
JARVIS_NOISE_CANCELLATION=1
```

## Example Requests

After connecting to the voice session, try saying:

- "Open Chrome."
- "Search Google for beginner Python tutorials."
- "Open github.com."
- "I need help planning my project."

## Project Structure

```text
.
|-- agent.py              Main assistant and voice tools
|-- prompt.py             Assistant instructions and response style
|-- list_models.py        Lists Google models that support the required method
|-- requirements.txt      Python packages used by the project
|-- .env                  Local credentials (do not upload this file)
|-- KMS/                  Project logs or supporting files
```

## Optional: Check Available Models

To list Google models that support bidirectional content generation, run:

```powershell
python list_models.py
```

The results are written to `bidi_model_name.txt`.

## Troubleshooting

### `API Key not found`

Check that `.env` exists in the same folder as `agent.py` and that it contains `GOOGLE_API_KEY`.

### Chrome does not open

Make sure Google Chrome is installed. The assistant searches common Windows Chrome installation folders.

### The microphone does not work

Check Windows microphone permissions and make sure the correct microphone is selected in your LiveKit client.

### PowerShell will not activate the virtual environment

Run the execution-policy command shown in the Installation section, then activate the environment again.

## Security Note

Do not commit `.env`, `*.secret`, or API keys to a public repository. If a key has already been shared or committed, revoke it and create a replacement before publishing the project.

## License

See [LICENSE](LICENSE) for license information.

## Web command deck

The responsive frontend includes an animated reactor, a conversation console, session history, quick commands, optional spoken responses, and LiveKit audio controls. It respects your system's reduced motion preference.

### Start the frontend

With Node.js 20.19+ (or 22.12+) and npm installed, run from the repository root:

```sh
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). For a production build, run `npm run build`; `npm run preview` serves that build locally. Serve the frontend over HTTPS outside localhost to use microphone features.

### Preview mode

The interface works without provider credentials. Preview commands support the time/date, interface status, capabilities, and Google search links. Telemetry values are illustrative, not measurements of the host. Browser voice input uses the browser's speech recognition service when available; use typed commands if unsupported. The speaker button enables browser speech synthesis for preview replies. Session history is held in memory and clears on reload.

### Connect the Python agent

1. Configure the Python environment as described above and start `python agent.py dev` on the machine where its tools should run.
2. Obtain a **participant access token** for a LiveKit room from your trusted server or LiveKit tools. Enable room joining, microphone publishing, track subscription, and data publishing. Dispatch the Python agent to that same room using LiveKit's tools or your deployment's dispatch configuration.
3. Click **Connect agent** in the frontend. Enter the LiveKit `wss://` URL and the participant token. Allow microphone access.
4. Speak to the agent, or send a typed command. Typed messages use LiveKit's `lk.chat` text topic. Final transcription events and incoming `lk.chat` streams appear in the console when provided by the agent.

The connection indicator confirms room connectivity; agent availability depends on dispatch and the Python worker. Use the microphone button to mute input, the speaker button to mute responses, and **Disconnect** in settings to leave the room. Room tokens remain in memory and are cleared from the input after connection. Never put Google API keys, LiveKit API keys, or API secrets in the frontend. A production deployment should issue short-lived participant tokens from an authenticated server; this frontend does not provide a token server.

The Python tools open Chrome on the agent's Windows host. They do not control the device running the web interface. Realtime conversations require your configured LiveKit and Gemini services; preview mode does not emulate them.
