// A slower scene must never overwrite a more recent navigation request.
export class LatestNavigation {
  begin() {
    this.controller?.abort();
    const controller = this.controller = new AbortController();
    return {
      signal: controller.signal,
      current: () => !controller.signal.aborted,
      wait: promise => new Promise((resolve, reject) => {
        const abort = () => resolve(undefined);
        if (controller.signal.aborted) return abort();
        controller.signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(promise).then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', abort));
      })
    };
  }
}
