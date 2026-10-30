import { describe, expect, it } from 'vitest';
import * as surface from './aggregate-search-surface';
import type { AggregateSearchResponse, FeedbackDescriptor } from './aggregate-search-surface';

type Callback = (response?: AggregateSearchResponse) => void;

function createRuntime(options: { throwOnSend?: boolean } = {}) {
  const messages: object[] = [];
  const callbacks: Callback[] = [];
  const runtime: { lastError: unknown; sendMessage: (message: object, callback: Callback) => void } = {
    lastError: null,
    sendMessage(message, callback) {
      if (options.throwOnSend) {
        throw new Error('send failed');
      }
      messages.push(message);
      callbacks.push(callback);
    }
  };
  const answer = (index: number, response?: AggregateSearchResponse) => {
    const callback = callbacks[index];
    if (!callback) throw new Error(`No request ${index} was sent.`);
    callback(response);
  };
  return { answer, chromeApi: { runtime }, messages, runtime };
}

function createController(options: { throwOnSend?: boolean } = {}) {
  const runtime = createRuntime(options);
  const feedback: Array<{ descriptor: FeedbackDescriptor; runtimeError: unknown }> = [];
  const controller = surface.createAggregateSearchRequestController({
    chromeApi: runtime.chromeApi,
    onFeedback(descriptor, _response, runtimeError) {
      feedback.push({ descriptor, runtimeError });
    }
  });
  return { controller, feedback, runtime };
}

const REQUEST = { aggregateId: 'research', disposition: 'newTab', query: 'Lumno 聚合' };

describe('aggregate search requests', () => {
  it('sends one request for a rapid duplicate and tells that it is in progress', () => {
    const { controller, feedback, runtime } = createController();
    const first = controller.run(REQUEST);
    const duplicate = controller.run(REQUEST);
    expect(first.started).toBe(true);
    expect(duplicate.duplicate).toBe(true);
    expect(runtime.messages).toEqual([{
      action: 'runAggregateSearchQuery',
      aggregateId: 'research',
      disposition: 'newTab',
      query: 'Lumno 聚合'
    }]);
    expect(feedback[0]?.descriptor.messageKey).toBe('aggregate_search_in_progress');
    expect(feedback[0]?.descriptor.isError).toBe(false);
  });

  it('releases the request on completion, says nothing for a clean success and reports a partial failure as an error', () => {
    const { controller, feedback, runtime } = createController();
    const successes: AggregateSearchResponse[] = [];
    const onSuccess = (response: AggregateSearchResponse) => successes.push(response);
    controller.run(REQUEST, { onSuccess });
    runtime.answer(0, { ok: true, warnings: [] });
    expect(successes).toHaveLength(1);
    expect(feedback).toHaveLength(0);

    controller.run(REQUEST, { onSuccess });
    expect(runtime.messages).toHaveLength(2);
    runtime.answer(1, { failedCount: 1, ok: true, warnings: ['partial-tab-create-failure'] });
    expect(successes).toHaveLength(2);
    expect(feedback[0]?.descriptor.messageKey).toBe('aggregate_search_partial_failure');
    expect(feedback[0]?.descriptor.isError).toBe(true);
  });

  it('reports a worker error with the runtime error', () => {
    const { controller, feedback, runtime } = createController();
    controller.run({ ...REQUEST, query: 'runtime failure' });
    runtime.runtime.lastError = { message: 'worker stopped' };
    runtime.answer(0, undefined);
    runtime.runtime.lastError = null;
    expect(feedback[0]?.descriptor.messageKey).toBe('toast_error');
    expect(feedback[0]?.runtimeError).toEqual({ message: 'worker stopped' });
  });

  it('does not start when the message cannot be sent', () => {
    const { controller, feedback } = createController({ throwOnSend: true });
    expect(controller.run(REQUEST).started).toBe(false);
    expect(feedback[0]?.descriptor.messageKey).toBe('toast_error');
  });
});

describe('aggregate search feedback', () => {
  const ANCILLARY = { ok: true, failedCount: 0, warnings: ['group denied'] };

  it('does not count grouping, naming or focus warnings as failed results', () => {
    expect(surface.hasPartialFailure(ANCILLARY)).toBe(false);
    expect(surface.hasAncillaryWarning(ANCILLARY)).toBe(true);
    expect(surface.getResponseDescriptor(ANCILLARY)).toEqual({
      fallback: 'Search results opened, but tab grouping, naming, or focus could not be completed.',
      isError: false,
      messageKey: 'aggregate_search_degraded_success'
    });
  });

  it('tells when an aggregate has removed or disabled sources', () => {
    expect(surface.getResponseDescriptor({ reason: 'aggregate-search-not-found' })).toEqual({
      fallback: 'This aggregate search contains removed or disabled sources. Update it in Settings.',
      isError: true,
      messageKey: 'aggregate_search_sources_unavailable_error'
    });
  });

  it('keeps success feedback up for a warning, for the worker activation delay, and not at all for a clean success', () => {
    expect(surface.getSuccessFeedbackDelayMs({
      activationDeferred: false, activationDelayMs: 0, ok: true, warnings: ['activation denied']
    })).toBe(surface.PARTIAL_FEEDBACK_DELAY_MS);
    expect(surface.getSuccessFeedbackDelayMs({
      activationDeferred: true, activationDelayMs: 900, ok: true, warnings: ['partial-tab-create-failure']
    })).toBe(900);
    expect(surface.getSuccessFeedbackDelayMs({ ok: true, warnings: [] })).toBe(0);
  });
});
