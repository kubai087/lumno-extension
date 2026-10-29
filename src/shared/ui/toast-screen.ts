// The Toast's message queue, which every surface shares however it draws:
// short result messages, and loading messages for tasks that take a moment,
// shown only once the task has run past a short delay. The newest task that
// has passed its delay owns the Toast whenever no result message covers it.
import type { Store } from '../state/store';

// The page window, or a test double with its timers.
interface ToastWindow {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(timerId: number): void;
  requestAnimationFrame?(callback: () => void): number;
  cancelAnimationFrame?(frameId: number): void;
}

interface ToastControllerOptions {
  windowObj?: ToastWindow | null;
  // How long a message stays, in milliseconds.
  duration?: number;
  // How long a task runs before its loading message shows.
  loadingDelay?: number;
}

interface ToastShowOptions {
  error?: boolean;
  duration?: number;
}

interface ToastBeginOptions {
  delay?: number;
}

// A running task's loading message; finishing it may show a result message.
interface ToastTask {
  update(message: unknown): void;
  done(message?: unknown, options?: ToastShowOptions | null): void;
  fail(message?: unknown, options?: ToastShowOptions | null): void;
  cancel(): void;
}

interface ToastController {
  show(message: unknown, options?: ToastShowOptions | null): void;
  hide(): void;
  begin(message: unknown, options?: ToastBeginOptions | null): ToastTask;
  destroy(): void;
}

type ToastTone = 'loading' | 'error' | '';

// What the Toast shows; a hidden Toast keeps its last text while it fades.
interface ToastMessage {
  visible: boolean;
  text: string;
  tone: ToastTone;
}

// How a surface draws the Toast: the message store it follows, which the
// Toast sets.
interface ToastSurface {
  message: Store<ToastMessage>;
  // Called once, when the Toast is destroyed.
  destroy?(): void;
}

interface PendingTask {
  text: string;
  visible: boolean;
  delayTimer: number;
}

const NOOP_TASK: Readonly<ToastTask> = Object.freeze({ update() {}, done() {}, fail() {}, cancel() {} });

const NOOP_CONTROLLER: Readonly<ToastController> = Object.freeze({
  show() {},
  hide() {},
  begin() { return NOOP_TASK; },
  destroy() {}
});

function readDelay(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

class ToastScreen implements ToastController {
  // Tasks still running, oldest first.
  private readonly tasks: PendingTask[] = [];
  private timer = 0;
  private messageShowing = false;
  private destroyed = false;
  private readonly surface: ToastSurface;
  private readonly win: ToastWindow;
  private readonly defaultDuration: number;
  private readonly loadingDelay: number;

  constructor(surface: ToastSurface, options?: ToastControllerOptions | null) {
    const config: ToastControllerOptions = options || {};
    this.surface = surface;
    this.win = config.windowObj || globalThis;
    this.defaultDuration = readDelay(config.duration, 2200);
    this.loadingDelay = readDelay(config.loadingDelay, 240);
  }

  readonly show = (message: unknown, showOptions?: ToastShowOptions | null): void => {
    const text = String(message || '');
    if (this.destroyed || !text) {
      return;
    }
    const nextOptions: ToastShowOptions = showOptions || {};
    this.stopTimer();
    this.messageShowing = true;
    this.surface.message.setState({ visible: true, text, tone: nextOptions.error ? 'error' : '' });
    const duration = readDelay(nextOptions.duration, this.defaultDuration);
    if (duration > 0) {
      this.timer = this.win.setTimeout(() => {
        this.timer = 0;
        this.hide();
      }, duration);
    }
  };

  // Falls back to the running task once a result message is gone.
  readonly hide = (): void => {
    this.stopTimer();
    this.messageShowing = false;
    if (this.destroyed) {
      return;
    }
    const task = this.visibleTask();
    if (task) {
      this.surface.message.setState({ visible: true, text: task.text, tone: 'loading' });
    } else {
      this.surface.message.setState({ visible: false });
    }
  };

  readonly begin = (message: unknown, beginOptions?: ToastBeginOptions | null): ToastTask => {
    if (this.destroyed) {
      return NOOP_TASK;
    }
    const delay = readDelay((beginOptions || {}).delay, this.loadingDelay);
    const task: PendingTask = { text: String(message || ''), visible: false, delayTimer: 0 };
    this.tasks.push(task);
    const running = new RunningToastTask(this, task);
    if (delay > 0) {
      task.delayTimer = this.win.setTimeout(() => running.reveal(), delay);
    } else {
      running.reveal();
    }
    return running;
  };

  readonly destroy = (): void => {
    if (this.destroyed) {
      return;
    }
    this.tasks.splice(0).forEach((task) => {
      if (task.delayTimer) {
        this.win.clearTimeout(task.delayTimer);
      }
    });
    this.hide();
    this.destroyed = true;
    if (this.surface.destroy) {
      this.surface.destroy();
    }
  };

  // Whether the task's loading message is what the Toast shows.
  isOnScreen(task: PendingTask): boolean {
    return task.visible && !this.messageShowing && this.visibleTask() === task;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  showLoading(task: PendingTask): void {
    if (this.isOnScreen(task)) {
      this.surface.message.setState({ visible: true, text: task.text, tone: 'loading' });
    }
  }

  // Drops a finished task: shows its result, or hands the Toast back.
  finish(task: PendingTask, resultMessage: unknown, resultOptions?: ToastShowOptions | null): void {
    if (task.delayTimer) {
      this.win.clearTimeout(task.delayTimer);
      task.delayTimer = 0;
    }
    const wasOnScreen = this.isOnScreen(task);
    this.tasks.splice(this.tasks.indexOf(task), 1);
    if (resultMessage) {
      this.show(resultMessage, resultOptions);
    } else if (wasOnScreen) {
      this.hide();
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      this.win.clearTimeout(this.timer);
    }
    this.timer = 0;
  }

  // The newest task that has passed its delay.
  private visibleTask(): PendingTask | null {
    for (let index = this.tasks.length - 1; index >= 0; index -= 1) {
      if (this.tasks[index].visible) {
        return this.tasks[index];
      }
    }
    return null;
  }
}

// A task shows its loading message once its delay passes; finishing it
// shows its result or hands the Toast back.
class RunningToastTask implements ToastTask {
  private finished = false;
  private readonly screen: ToastScreen;
  private readonly task: PendingTask;

  constructor(screen: ToastScreen, task: PendingTask) {
    this.screen = screen;
    this.task = task;
  }

  reveal(): void {
    this.task.delayTimer = 0;
    if (this.finished || this.screen.isDestroyed()) {
      return;
    }
    this.task.visible = true;
    this.screen.showLoading(this.task);
  }

  readonly update = (nextMessage: unknown): void => {
    if (this.finished) {
      return;
    }
    this.task.text = String(nextMessage || '');
    this.screen.showLoading(this.task);
  };

  readonly done = (resultMessage?: unknown, resultOptions?: ToastShowOptions | null): void => {
    this.finish(resultMessage, resultOptions);
  };

  readonly fail = (resultMessage?: unknown, resultOptions?: ToastShowOptions | null): void => {
    this.finish(resultMessage, { ...resultOptions, error: true });
  };

  readonly cancel = (): void => {
    this.finish('');
  };

  private finish(resultMessage: unknown, resultOptions?: ToastShowOptions | null): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.screen.finish(this.task, resultMessage, resultOptions);
  }
}

export type {
  ToastMessage,
  ToastBeginOptions,
  ToastController,
  ToastControllerOptions,
  ToastShowOptions,
  ToastSurface,
  ToastTask,
  ToastTone,
  ToastWindow
};
export { NOOP_CONTROLLER, ToastScreen };
