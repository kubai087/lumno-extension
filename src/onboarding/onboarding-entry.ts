// The onboarding page's script, an ES module that runs once the markup is
// parsed: the in-page tab switcher, then the page itself, which imports its
// views.
// Its demo overlay is the overlay the worker injects into web pages, which
// the page imports when it first opens it.
import '../shared/tab-switcher/tab-switcher';
import '../shared/tab-switcher/page-bridge';
import './app/main';
