// Whether the mouse is in the recent sites section, or left it a moment
// ago: a bookmark hovered on the way out of the section waits before it
// takes its theme.
class RecentPointer {
  private inside = false;
  private leftAt = 0;

  enter(): void {
    this.inside = true;
    this.leftAt = 0;
  }

  leave(): void {
    this.inside = false;
    this.leftAt = Date.now();
  }

  // The pointer went away without leaving (a touch, or the window lost it).
  cancel(): void {
    this.inside = false;
  }

  // The section was hidden under the pointer.
  reset(): void {
    this.inside = false;
    this.leftAt = 0;
  }

  // Whether the mouse is inside, or left no more than `ms` ago.
  wasInsideWithin(ms: number): boolean {
    return this.inside || (this.leftAt > 0 && Date.now() - this.leftAt <= ms);
  }
}

export { RecentPointer };
