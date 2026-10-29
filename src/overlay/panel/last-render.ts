// The query and action context the results were last drawn for, so a
// response for the same query can update the rows in place and a cleared
// list draws afresh.
class LastRender {
  private renderedQuery = '';
  private renderedActionContextKey = '';

  get query(): string {
    return this.renderedQuery;
  }

  get actionContextKey(): string {
    return this.renderedActionContextKey;
  }

  record(query: string, actionContextKey: string): void {
    this.renderedQuery = query;
    this.renderedActionContextKey = actionContextKey;
  }

  clear(): void {
    this.record('', '');
  }
}

export { LastRender };
