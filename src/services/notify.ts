/**
 * System notifications. The app has no in-app toasts: progress and results are reported
 * through the operating system's notification centre, as
 *
 *     <workspace name>        (the OS already shows the app name and icon beside it)
 *     <message>
 *
 * In the desktop app this uses the Tauri notification plugin; in a plain browser (development)
 * it falls back to the Web Notifications API. Where neither is available or permission is
 * refused, the message is only written to the console; nothing is ever shown inside the page.
 */
export type NotifyLevel = 'success' | 'error' | 'warning' | 'info';

export const APP_NAME = 'NormaFlow';

type WorkspaceNameResolver = (workspaceId: string) => string | undefined;
let resolveWorkspaceName: WorkspaceNameResolver = () => undefined;

/** The app tells the notifier how to turn a workspace id into the tab's current name. */
export function setWorkspaceNameResolver(fn: WorkspaceNameResolver): void {
  resolveWorkspaceName = fn;
}

export interface NotificationContent {
  title: string;
  body: string;
}

const MAX_BODY = 240;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** What the OS will show: the workspace name as the title, the message as the body. The app name is the OS's job. */
export function composeNotification(message: string, workspace?: string): NotificationContent {
  const name = workspace ? clean(workspace) : '';
  const body = clean(message);
  return {
    title: name || APP_NAME,
    body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 1)}…` : body,
  };
}

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let tauriReady: Promise<boolean> | null = null;
async function ensureTauriPermission(): Promise<boolean> {
  tauriReady ??= (async () => {
    try {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      if (await isPermissionGranted()) return true;
      return (await requestPermission()) === 'granted';
    } catch {
      return false;
    }
  })();
  return tauriReady;
}

async function show({ title, body }: NotificationContent, level: NotifyLevel): Promise<void> {
  if (isTauri()) {
    if (!(await ensureTauriPermission())) return;
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    // The desktop shell shows the application icon with the notification.
    sendNotification({ title, body });
    return;
  }
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icon.png`, tag: `${level}:${body}` });
}

/**
 * Show a system notification for a workspace. Never throws and never blocks the caller.
 * `info` messages are logged only: they confirm routine clicks and would just be noise.
 */
export function notify(level: NotifyLevel, message: string, workspaceId?: string): void {
  if (!message || !message.trim()) return;
  const content = composeNotification(message, workspaceId ? resolveWorkspaceName(workspaceId) : undefined);
  console.log(`[${level}] ${content.title}: ${content.body}`);
  if (level === 'info') return;
  void show(content, level).catch(() => {});
}
