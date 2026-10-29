// While an undoable change to the bookmarks or shortcuts runs, no other may
// start: the change holds this lock until it settles.
class MoveHistoryLock {
  private held = false;

  get busy(): boolean {
    return this.held;
  }

  hold(): void {
    this.held = true;
  }

  release(): void {
    this.held = false;
  }
}

export { MoveHistoryLock };
