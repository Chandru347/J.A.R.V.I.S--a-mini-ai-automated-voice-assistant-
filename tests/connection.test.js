import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// Exercise the browser entrypoint with injected DOM and LiveKit failures. No
// credentials, microphone, network, or changes to the production module needed.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '');
const iconNames = /const iconSet = \{ (.+) \};/.exec(source)[1].split(', ');

function element() {
  const classes = new Set();
  return {
    children: [], listeners: {}, attributes: {}, value: '', textContent: '', disabled: false,
    classList: {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
    },
    style: { setProperty() {} },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    prepend(child) { this.children.unshift(child); },
    get lastElementChild() {
      return { remove: () => this.children.pop() };
    },
    close() { this.closed = true; },
  };
}

function harness(options = {}) {
  const elements = new Map();
  const $ = (selector) => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const rooms = [];
  class Room {
    constructor() {
      rooms.push(this);
      this.state = 'disconnected';
      this.handlers = {};
      this.disconnectCalls = 0;
      this.rejectDisconnect = options.rejectDisconnect ?? false;
      this.localParticipant = {
        isMicrophoneEnabled: false,
        async setMicrophoneEnabled(enabled) {
          if (options.failMicrophone) throw new Error('microphone failed');
          this.isMicrophoneEnabled = enabled;
        },
      };
    }
    on(event, callback) { this.handlers[event] = callback; }
    registerTextStreamHandler() {}
    async connect() { this.state = 'connected'; }
    async startAudio() { if (options.failAudio) throw new Error('audio failed'); }
    async disconnect() {
      this.disconnectCalls++;
      if (this.rejectDisconnect) throw new Error('disconnect failed');
      this.state = 'disconnected';
      if (!options.omitDisconnectedEvent) this.handlers.disconnected?.();
    }
  }
  const icons = Object.fromEntries(iconNames.map((name) => [name, {}]));
  runInNewContext(source, {
    ...icons, createIcons() {}, Room,
    RoomEvent: { TrackSubscribed:'track', TrackUnsubscribed:'untrack', ActiveSpeakersChanged:'speakers', TranscriptionReceived:'transcription', Disconnected:'disconnected' },
    ConnectionState: { Connected:'connected' }, Track: { Kind: { Audio:'audio' } },
    document: { querySelector:$, querySelectorAll:() => [], createElement:element, createTextNode:() => element() },
    window: {}, setInterval() {}, setTimeout() {}, clearTimeout() {},
  });
  const submit = () => {
    $('#livekit-url').value = 'wss://synthetic.example';
    $('#livekit-token').value = 'synthetic-participant-token';
    return $('#connection-form').listeners.submit({ preventDefault() {} });
  };
  const click = (selector) => $(selector).listeners.click();
  return { $, rooms, submit, click };
}

function assertUnlocked(h) {
  assert.equal(h.$('#connect-button').disabled, false);
}
function assertMicrophone(h, enabled) {
  assert.equal(h.$('#connection-status').textContent, 'AGENT CONNECTED');
  assert.equal(h.$('#mic-button').classList.contains('listening'), enabled);
  assert.equal(h.$('#mic-button').attributes['aria-label'], enabled ? 'Mute microphone' : 'Enable microphone');
  assert.equal(h.$('#reactor').classList.contains('listening'), enabled);
  assert.match(h.$('#mic-button').innerHTML, enabled ? /data-lucide="mic"/ : /data-lucide="mic-off"/);
}

test('rejected prior disconnect retains room and unlocks retries', async () => {
  const h = harness();
  await h.submit();
  const original = h.rooms[0];
  original.rejectDisconnect = true;
  await h.submit();
  assert.equal(h.rooms.length, 1, 'no replacement room is created');
  assertUnlocked(h);
  assert.match(h.$('#connection-error').textContent, /Could not disconnect/);
  assertMicrophone(h, true);
  await h.click('#mic-button');
  assert.equal(original.localParticipant.isMicrophoneEnabled, false);
  await h.click('#disconnect-button');
  assert.equal(original.disconnectCalls, 2, 'disconnect control still targets original room');
  original.rejectDisconnect = false;
  await h.submit();
  assert.equal(h.rooms.length, 2, 'connection can be retried after rejection');
  assertUnlocked(h);
});

for (const microphoneEnabled of [true, false]) {
  test(`setup cleanup rejection preserves connected room with microphone ${microphoneEnabled ? 'on' : 'off'}`, async () => {
    const h = harness({ failAudio:microphoneEnabled, failMicrophone:!microphoneEnabled, rejectDisconnect:true });
    await h.submit();
    assertUnlocked(h);
    assertMicrophone(h, microphoneEnabled);
    assert.match(h.$('#connection-error').textContent, /could not disconnect/);
    assert.equal(h.$('#settings-dialog').closed, undefined, 'settings stays open for recovery');
    await h.click('#disconnect-button');
    assert.equal(h.rooms[0].disconnectCalls, 2);
    h.rooms[0].rejectDisconnect = false;
    await h.click('#disconnect-button');
    assert.equal(h.$('#connection-status').textContent, 'PREVIEW MODE');
    assert.equal(h.rooms[0].state, 'disconnected');
  });
}

for (const omitDisconnectedEvent of [false, true]) {
  test(`successful setup cleanup resets preview (disconnected event ${omitDisconnectedEvent ? 'absent' : 'present'})`, async () => {
    const h = harness({ failAudio:true, omitDisconnectedEvent });
    await h.submit();
    assertUnlocked(h);
    assert.equal(h.$('#connection-status').textContent, 'PREVIEW MODE');
    assert.equal(h.$('#mic-button').classList.contains('listening'), false);
    assert.equal(h.$('#mic-button').attributes['aria-label'], 'Start voice input');
    await h.click('#disconnect-button');
    assert.equal(h.rooms[0].disconnectCalls, 1, 'disconnected room is no longer retained');
  });
}
