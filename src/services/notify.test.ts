// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendNotification = vi.fn();
const isPermissionGranted = vi.fn();
const requestPermission = vi.fn();
vi.mock('@tauri-apps/plugin-notification', () => ({ sendNotification, isPermissionGranted, requestPermission }));

async function load() {
  vi.resetModules();
  return import('./notify');
}
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  sendNotification.mockReset();
  isPermissionGranted.mockReset().mockResolvedValue(true);
  requestPermission.mockReset().mockResolvedValue('granted');
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  delete (window as any).__TAURI_INTERNALS__;
  vi.unstubAllGlobals();
});

describe('notification content', () => {
  it('names the app and the workspace, and carries the message', async () => {
    const { composeNotification } = await load();
    expect(composeNotification('Pipeline completed for 2 table(s)', 'Sales data')).toEqual({
      title: 'NormaFlow · Sales data',
      body: 'Pipeline completed for 2 table(s)',
    });
  });
  it('falls back to the app name, tidies whitespace and bounds the body', async () => {
    const { composeNotification } = await load();
    expect(composeNotification('a\n\n b').title).toBe('NormaFlow');
    expect(composeNotification('a\n\n b').body).toBe('a b');
    expect(composeNotification('x'.repeat(1000), 'W').body.length).toBeLessThanOrEqual(240);
  });
});

describe('desktop (Tauri) delivery', () => {
  beforeEach(() => {
    (window as any).__TAURI_INTERNALS__ = {};
  });

  it('sends a system notification titled with the app and the current workspace name', async () => {
    const { notify, setWorkspaceNameResolver } = await load();
    let name = 'Workspace 1';
    setWorkspaceNameResolver(id => (id === 't1' ? name : undefined));
    notify('success', 'Workflow saved (4 operations)', 't1');
    await flush();
    expect(sendNotification).toHaveBeenCalledWith({ title: 'NormaFlow · Workspace 1', body: 'Workflow saved (4 operations)' });
    name = 'Chinook'; // a rename is picked up
    notify('error', 'Processing failed', 't1');
    await flush();
    expect(sendNotification).toHaveBeenLastCalledWith({ title: 'NormaFlow · Chinook', body: 'Processing failed' });
  });

  it('asks for permission once and stays silent when it is refused', async () => {
    isPermissionGranted.mockResolvedValue(false);
    requestPermission.mockResolvedValue('denied');
    const { notify } = await load();
    notify('error', 'one');
    notify('error', 'two');
    await flush();
    await flush();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('does not notify for routine info messages or empty text, and never throws', async () => {
    const { notify } = await load();
    notify('info', 'Added 1NF with 4 prerequisites');
    notify('success', '   ');
    sendNotification.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => notify('warning', 'careful')).not.toThrow();
    await flush();
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});

describe('browser fallback', () => {
  it('uses the Web Notifications API with the app icon', async () => {
    const ctor = vi.fn();
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = vi.fn();
      constructor(title: string, opts: unknown) {
        ctor(title, opts);
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
    const { notify, setWorkspaceNameResolver } = await load();
    setWorkspaceNameResolver(() => 'Workspace 2');
    notify('success', 'Pipeline completed', 't2');
    await flush();
    expect(ctor).toHaveBeenCalledWith('NormaFlow · Workspace 2', expect.objectContaining({ body: 'Pipeline completed', icon: expect.stringMatching(/icon\.png$/) }));
  });

  it('does nothing visible when notifications are unavailable', async () => {
    vi.stubGlobal('Notification', undefined);
    const { notify } = await load();
    expect(() => notify('error', 'x')).not.toThrow();
    expect(document.body.textContent).toBe('');
  });
});
