import './style.css';
import { createIcons, Triangle, LayoutDashboard, AudioLines, Layers2, Settings2, VolumeX, Volume2, Activity, Cpu, Info, Terminal, Power, ShieldCheck, Sparkles, ArrowUpRight, Command, ScanLine, Globe, MessagesSquare, RotateCcw, Mic, MicOff, ArrowUp, ArrowRight, X } from 'lucide';
import { Room, RoomEvent, ConnectionState, Track } from 'livekit-client';

const iconSet = { Triangle, LayoutDashboard, AudioLines, Layers2, Settings2, VolumeX, Volume2, Activity, Cpu, Info, Terminal, Power, ShieldCheck, Sparkles, ArrowUpRight, Command, ScanLine, Globe, MessagesSquare, RotateCcw, Mic, MicOff, ArrowUp, ArrowRight, X };
const $ = (selector) => document.querySelector(selector);
const icons = () => createIcons({ icons: iconSet });
let room = null;
let connecting = false;
let spokenResponses = false;
let recognition = null;
let toastTimer;
const messages = [];
const events = [];
const audioElements = new Set();
const settings = $('#settings-dialog');
const infoDialog = $('#info-dialog');

function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500);
}
function setCore(state = 'standby') {
  $('#reactor').classList.toggle('listening', state === 'listening');
  $('#reactor').classList.toggle('speaking', state === 'speaking');
  $('#core-state').textContent = `CORE ${state.toUpperCase()}`;
  $('#core-caption').textContent = state === 'listening' ? 'I’m listening, Boss.' : state === 'speaking' ? 'A little intelligence at work' : 'Ready when you are';
  $('#reactor-subtitle').textContent = state === 'listening' ? 'VOICE INPUT ACTIVE' : state === 'speaking' ? 'RESPONSE IN PROGRESS' : 'AWAITING YOUR COMMAND';
}
function timeLabel() { return new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }); }
function addMessage(author, text, link) {
  messages.push({ author, text, time:timeLabel() });
  const row = document.createElement('div');
  row.className = `message ${author === 'YOU' ? 'user' : 'assistant'}`;
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = author === 'YOU' ? 'S' : 'J';
  const body = document.createElement('div');
  const heading = document.createElement('span');
  heading.className = 'message-author';
  heading.textContent = author;
  const time = document.createElement('time');
  time.textContent = timeLabel();
  heading.append(time);
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  if (link) {
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = ' Open search ↗';
    anchor.style.color = 'var(--cyan)';
    paragraph.append(anchor);
  }
  body.append(heading, paragraph);
  row.append(avatar, body);
  $('#chat-messages').append(row);
  $('#chat-messages').scrollTop = $('#chat-messages').scrollHeight;
}
function addEvent(title, detail) {
  events.push({ title, detail, time:timeLabel() });
  const event = document.createElement('article');
  event.className = 'event';
  const icon = document.createElement('span');
  icon.className = 'event-icon';
  icon.innerHTML = '<i data-lucide="terminal"></i>';
  const body = document.createElement('div');
  const time = document.createElement('span');
  time.className = 'event-time';
  time.textContent = timeLabel();
  const strong = document.createElement('strong');
  strong.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  body.append(time, strong, p);
  event.append(icon, body);
  $('#activity-list').prepend(event);
  while ($('#activity-list').children.length > 3) $('#activity-list').lastElementChild.remove();
  icons();
}
function speak(text) {
  if (!spokenResponses || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = .97;
  utterance.onstart = () => setCore('speaking');
  utterance.onend = utterance.onerror = () => setCore();
  window.speechSynthesis.speak(utterance);
}
function previewReply(command) {
  const lower = command.toLowerCase();
  let reply, link;
  if (/^(search|search google|search the web)( for)?\s+/i.test(command)) {
    const query = command.replace(/^(search google|search the web|search)( for)?\s+/i, '').trim();
    link = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    reply = `Your search for “${query}” is ready. Follow the link to open Google.`;
  } else if (/status|diagnostic/.test(lower)) {
    reply = 'The command deck is ready, Boss. This is a local preview; the telemetry is illustrative. Connect your LiveKit agent for a live voice session.';
  } else if (/time|date/.test(lower)) {
    reply = `It’s ${new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} on ${new Date().toLocaleDateString([], { weekday:'long', month:'long', day:'numeric' })}.`;
  } else if (/hello|hey|hi\b/.test(lower)) {
    reply = 'At your service, Boss. Try asking for the time, a system status report, or “search Google for space exploration”.';
  } else if (/thank/.test(lower)) {
    reply = 'Always a pleasure, Boss.';
  } else {
    reply = 'In preview mode I can tell you the time, report interface status, and prepare a Google search. Connect your LiveKit agent for Gemini conversations and the Python voice tools.';
  }
  addMessage('J.A.R.V.I.S.', reply, link);
  addEvent('Preview command processed', command.length > 55 ? `${command.slice(0, 55)}…` : command);
  speak(reply);
}
$('#command-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#command-input');
  const command = input.value.trim();
  if (!command) return input.focus();
  input.value = '';
  addMessage('YOU', command);
  if (room?.state === ConnectionState.Connected) {
    try {
      await room.localParticipant.sendText(command, { topic:'lk.chat' });
      addEvent('Command sent', 'Delivered to the connected room.');
    } catch { addMessage('J.A.R.V.I.S.', 'That command could not be sent. Check your room connection and try again.'); }
  } else previewReply(command);
});
for (const button of document.querySelectorAll('[data-command]')) {
  button.addEventListener('click', () => {
    $('#command-input').value = button.dataset.command;
    $('#command-input').focus();
    if (!button.dataset.command.endsWith(' ')) $('#command-form').requestSubmit();
  });
}
function showInfo(title, content) {
  $('#info-title').textContent = title;
  $('#info-body').replaceChildren();
  if (typeof content === 'string') {
    const p = document.createElement('p');
    p.textContent = content;
    $('#info-body').append(p);
  } else $('#info-body').append(content);
  infoDialog.showModal();
}
function showLog() {
  const list = document.createElement('div');
  if (!messages.length && !events.length) {
    const p = document.createElement('p');
    p.textContent = 'Your session is ready. Send a command to start your log.';
    list.append(p);
  }
  for (const message of messages) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const label = document.createElement('strong');
    label.textContent = `${message.time} / ${message.author}`;
    const p = document.createElement('p');
    p.textContent = message.text;
    entry.append(label, p);
    list.append(entry);
  }
  for (const event of events) {
    const p = document.createElement('p');
    p.textContent = `${event.time} · ${event.title}: ${event.detail}`;
    list.append(p);
  }
  showInfo('This session.', list);
}
$('#view-log').addEventListener('click', showLog);
$('#history-button').addEventListener('click', showLog);
$('#dashboard-button').addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));
$('#capabilities-button').addEventListener('click', () => showInfo('A little more capable.', 'Your Python agent supports realtime Gemini voice conversations, Google searches, and opening websites in Chrome on its Windows host. Here in preview, try the time, a status report, or a web search. Connect a LiveKit room to use your agent.'));
$('#profile-button').addEventListener('click', () => showInfo('Your personal command deck.', 'J.A.R.V.I.S. brings your voice assistant into a cinematic workspace. This session is kept in memory and clears when you reload. Use connection settings to join your agent’s LiveKit room.'));
$('#clear-chat').addEventListener('click', () => {
  messages.length = 0;
  $('#chat-messages').replaceChildren();
  addMessage('J.A.R.V.I.S.', 'A fresh start, Boss. What’s next?');
  toast('Conversation cleared.');
});
for (const button of document.querySelectorAll('.settings-trigger')) button.addEventListener('click', () => settings.showModal());
for (const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
$('#sound-button').addEventListener('click', () => {
  spokenResponses = !spokenResponses;
  const label = spokenResponses ? 'Mute spoken responses' : 'Enable spoken responses';
  $('#sound-button').innerHTML = `<i data-lucide="${spokenResponses ? 'volume-2' : 'volume-x'}"></i>`;
  $('#sound-button').setAttribute('aria-label', label);
  $('#sound-button').title = label;
  for (const audio of audioElements) audio.muted = !spokenResponses;
  if (spokenResponses && room) room.startAudio().catch(() => toast('Audio playback is blocked. Check browser permissions.'));
  if (!spokenResponses) { window.speechSynthesis?.cancel(); setCore(); }
  icons();
  toast(spokenResponses ? 'Spoken responses enabled.' : 'Spoken responses muted.');
});
function updateConnection(connected) {
  $('#connection-status').textContent = connected ? 'AGENT CONNECTED' : 'PREVIEW MODE';
  $('#engine-label').textContent = connected ? 'LiveKit room connected' : 'Preview initialized';
  $('#footer-state').textContent = connected ? 'LIVE CONNECTION' : 'LOCAL PREVIEW';
  $('#footer-hint').textContent = connected ? 'Realtime audio · LiveKit' : 'Connect your agent to unlock realtime intelligence';
  $('#mic-button').innerHTML = '<i data-lucide="mic"></i>';
  $('#mic-button').classList.remove('listening');
  $('#mic-button').setAttribute('aria-label', connected ? 'Enable microphone' : 'Start voice input');
  setCore();
  icons();
}
function clearAudio() {
  for (const audio of audioElements) { audio.srcObject = null; audio.remove(); }
  audioElements.clear();
}
$('#connection-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (connecting) return;
  const url = $('#livekit-url').value.trim();
  if (!/^wss?:\/\//i.test(url)) { $('#connection-error').textContent = 'Use a LiveKit WebSocket URL beginning with wss:// or ws://.'; return; }
  const token = $('#livekit-token').value.trim();
  if (!token) return;
  connecting = true;
  $('#connect-button').disabled = true;
  $('#connection-error').textContent = '';
  recognition?.abort();
  window.speechSynthesis?.cancel();
  if (room) await room.disconnect();
  const nextRoom = new Room({ adaptiveStream:true, dynacast:true });
  room = nextRoom;
  nextRoom.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== Track.Kind.Audio) return;
    const audio = track.attach();
    audio.muted = !spokenResponses;
    audioElements.add(audio);
    document.body.append(audio);
    audio.play().catch(() => toast('Click the sound control to enable agent audio.'));
  });
  nextRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
    for (const element of track.detach()) { audioElements.delete(element); element.remove(); }
  });
  nextRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    setCore(speakers.some((p) => !p.isLocal) ? 'speaking' : nextRoom.localParticipant.isMicrophoneEnabled ? 'listening' : 'standby');
  });
  nextRoom.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
    for (const segment of segments) if (segment.final) addMessage(participant?.isLocal ? 'YOU' : 'J.A.R.V.I.S.', segment.text);
  });
  nextRoom.registerTextStreamHandler('lk.transcription', async (reader, participant) => {
    try {
      const text = await reader.readAll();
      if (text.trim()) addMessage(participant.identity === nextRoom.localParticipant.identity ? 'YOU' : 'J.A.R.V.I.S.', text);
    } catch { toast('A transcription was interrupted.'); }
  });
  nextRoom.registerTextStreamHandler('lk.chat', async (reader) => {
    try { const text = await reader.readAll(); if (text.trim()) addMessage('J.A.R.V.I.S.', text); }
    catch { toast('An incoming message was interrupted.'); }
  });
  nextRoom.on(RoomEvent.Disconnected, () => {
    if (room !== nextRoom) return;
    room = null;
    clearAudio();
    updateConnection(false);
    addEvent('Room disconnected', 'Returned to local preview.');
  });
  try {
    await nextRoom.connect(url, token);
    await nextRoom.localParticipant.setMicrophoneEnabled(true);
    spokenResponses = true;
    $('#sound-button').innerHTML = '<i data-lucide="volume-2"></i>';
    $('#sound-button').setAttribute('aria-label', 'Mute spoken responses');
    $('#sound-button').title = 'Mute spoken responses';
    for (const audio of audioElements) audio.muted = false;
    await nextRoom.startAudio();
    updateConnection(true);
    $('#mic-button').classList.add('listening');
    $('#mic-button').setAttribute('aria-label', 'Mute microphone');
    setCore('listening');
    $('#livekit-token').value = '';
    settings.close();
    addEvent('Room connected', 'Microphone is active. Waiting for your agent.');
    addMessage('J.A.R.V.I.S.', 'Room connected. Your microphone is live. Start speaking, or send a text command to your agent.');
  } catch {
    await nextRoom.disconnect();
    if (room === nextRoom) { room = null; clearAudio(); updateConnection(false); }
    $('#connection-error').textContent = 'Could not start the session. Check the URL, token, room permissions, and microphone access.';
  } finally {
    connecting = false;
    $('#connect-button').disabled = false;
  }
});
$('#disconnect-button').addEventListener('click', async () => {
  if (connecting) return;
  if (room) { await room.disconnect(); toast('Disconnected from LiveKit.'); }
  else toast('You’re already in local preview.');
});
$('#mic-button').addEventListener('click', async () => {
  if (connecting) return;
  if (room?.state === ConnectionState.Connected) {
    try {
      const enabled = !room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      $('#mic-button').classList.toggle('listening', enabled);
      $('#mic-button').innerHTML = `<i data-lucide="${enabled ? 'mic' : 'mic-off'}"></i>`;
      $('#mic-button').setAttribute('aria-label', enabled ? 'Mute microphone' : 'Enable microphone');
      setCore(enabled ? 'listening' : 'standby');
      icons();
    } catch { toast('Microphone unavailable. Check browser permissions.'); }
    return;
  }
  if (recognition) { recognition.stop(); return; }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { toast('Voice input isn’t supported in this browser. Type a command, or connect your LiveKit agent.'); return; }
  window.speechSynthesis?.cancel();
  recognition = new SpeechRecognition();
  recognition.lang = navigator.language || 'en-US';
  recognition.interimResults = true;
  recognition.onstart = () => { setCore('listening'); $('#mic-button').classList.add('listening'); $('#mic-button').setAttribute('aria-label', 'Stop voice input'); };
  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    $('#command-input').value = result[0].transcript;
    if (result.isFinal) $('#command-form').requestSubmit();
  };
  recognition.onerror = (event) => { if (event.error !== 'aborted') toast(event.error === 'not-allowed' ? 'Microphone access was denied. You can still type a command.' : 'Voice input unavailable. Please try again or type a command.'); };
  recognition.onend = () => { recognition = null; $('#mic-button').classList.remove('listening'); $('#mic-button').setAttribute('aria-label', 'Start voice input'); setCore(); };
  try { recognition.start(); } catch { recognition = null; toast('Unable to start voice input. Please type your command.'); }
});
function updateClock() {
  $('#date-display').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' }).toUpperCase();
  $('#clock').replaceChildren(document.createTextNode(`${new Date().toLocaleTimeString('en-GB', { timeZone:'UTC' })} `));
  const label = document.createElement('small');
  label.textContent = 'UTC';
  $('#clock').append(label);
}
for (const bars of document.querySelectorAll('.wave-bars')) {
  for (let i = 0; i < 9; i++) {
    const bar = document.createElement('i');
    bar.style.setProperty('--height', `${[4,7,12,8,17,11,6,10,4][i]}px`);
    bar.style.setProperty('--delay', `${i * -.18}s`);
    bars.append(bar);
  }
}
updateClock();
setInterval(updateClock, 1000);
icons();
