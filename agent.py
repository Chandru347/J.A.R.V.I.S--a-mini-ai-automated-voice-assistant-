from dotenv import load_dotenv
from prompt import AGENT_INSTRUCTION, AGENT_RESPONSE

from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions, RunContext, function_tool
from livekit.plugins import google, noise_cancellation

import asyncio
import os
import shutil
import subprocess
from urllib.parse import quote_plus, urlparse

load_dotenv()


class Assistant(Agent):
    def __init__(self):
        super().__init__(instructions=AGENT_INSTRUCTION)
        self.memory = {}

    async def on_session_start(self, session: AgentSession):
        print("FRIDAY voice session is active and listening.")

    @staticmethod
    def _chrome_path() -> str | None:
        candidates = [
            shutil.which("chrome"),
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        ]
        return next((path for path in candidates if path and os.path.isfile(path)), None)

    @function_tool
    async def open_chrome(self, ctx: RunContext) -> str:
        """Open Google Chrome on the user's Windows computer."""
        chrome = self._chrome_path()
        if not chrome:
            return "Google Chrome is not installed or could not be found."
        try:
            subprocess.Popen([chrome], close_fds=True)
            return "Google Chrome is open now."
        except OSError as error:
            return f"I could not open Google Chrome: {error}"

    @function_tool
    async def search_web(self, query: str, ctx: RunContext) -> str:
        """Search Google for the user's query by opening Chrome."""
        query = query.strip()
        if not query:
            return "Tell me what you want me to search for."
        chrome = self._chrome_path()
        if not chrome:
            return "Google Chrome is not installed or could not be found."
        search_url = f"https://www.google.com/search?q={quote_plus(query)}"
        try:
            subprocess.Popen([chrome, search_url], close_fds=True)
            return f"I opened Chrome and searched Google for {query}."
        except OSError as error:
            return f"I could not start the search: {error}"

    @function_tool
    async def open_website(self, url: str, ctx: RunContext) -> str:
        """Open a user-requested HTTP or HTTPS website in Google Chrome."""
        url = url.strip()
        parsed = urlparse(url if "://" in url else f"https://{url}")
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return "I can only open valid HTTP or HTTPS websites."
        chrome = self._chrome_path()
        if not chrome:
            return "Google Chrome is not installed or could not be found."
        safe_url = parsed.geturl()
        try:
            subprocess.Popen([chrome, safe_url], close_fds=True)
            return f"I opened {safe_url} in Chrome."
        except OSError as error:
            return f"I could not open that website: {error}"

    def detect_emotion(self, message: str) -> str:
        message = message.lower()
        if any(word in message for word in ["emergency", "urgent", "problem", "crash", "now"]):
            return "urgent"
        if any(word in message for word in ["thanks", "awesome", "good", "great", "cool"]):
            return "friendly"
        if any(word in message for word in ["tired", "i'm sad", "stress", "depressed", "lonely"]):
            return "supportive"
        if any(word in message for word in ["shut down", "deploy", "initiate", "do it now"]):
            return "tactical"
        return "neutral"

    async def on_message(self, ctx: AgentSession, message: str) -> str:
        message = message.strip()

        if "sleep now" in message:
            return f"{AGENT_RESPONSE.replace('{{user_query}}', message)}\nTone: Stay ready and explain that idle mode is disabled."

        if ctx and ctx.is_speaking:
            await ctx.stop_speaking()

        emotion = self.detect_emotion(message)

        emotion_style = {
            "urgent": "Respond urgently and seriously, like a tactical alert.",
            "friendly": "Use a cheerful, upbeat, and relaxed tone.",
            "supportive": "Respond gently and calmly with emotional support.",
            "tactical": "Be concise and direct, like a mission operator.",
            "neutral": "Maintain a clear, respectful, and professional tone."
        }

        tone_instruction = emotion_style.get(emotion, emotion_style["neutral"])

        styled_prompt = f"{AGENT_RESPONSE.replace('{{user_query}}', message)}\nTone: {tone_instruction}"

        return styled_prompt

async def entrypoint(ctx: agents.JobContext):
    assistant = Assistant()

    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.5-flash-native-audio-latest",
            voice="Charon",
            temperature=0.5,
            instructions=AGENT_INSTRUCTION,
          #  video_enabled=True,
        ),
    )

    await session.start(
        room=ctx.room,
        agent=assistant,
        room_input_options=RoomInputOptions(
            noise_cancellation=(
                noise_cancellation.BVC()
                if os.getenv("JARVIS_NOISE_CANCELLATION", "0") == "1"
                else None
            ),
        ),
    )


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))



