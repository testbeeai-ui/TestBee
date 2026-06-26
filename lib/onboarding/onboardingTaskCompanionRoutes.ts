/** Pathname (no query) where the floating task companion may appear for each checklist task. */

/** Curriculum lesson URLs: /cbse/physics/class-11/unit/subtopic/level */

const CURRICULUM_TOPIC_PATH = /^\/(cbse|icse)\/[^/]+\/class-\d+\//i;

function pathOnly(pathname: string): string {
  const q = pathname.indexOf("?");

  return q === -1 ? pathname : pathname.slice(0, q);
}

/** Prep + Mock hub and library (CBSE MCQ, mocks, quick tests). */

function isPrepMockPath(p: string): boolean {
  return (
    p === "/mock" ||
    p.startsWith("/mock/") ||
    p === "/mock-test" ||
    p.startsWith("/mock-test/") ||
    p === "/mock-test-library" ||
    p.startsWith("/mock-test-library/") ||
    p === "/exam-prep" ||
    p.startsWith("/exam-prep/")
  );
}

/** Classrooms list + class detail (intro video, Live tab). */

function isPrepClassesPath(p: string): boolean {
  return (
    isPrepMockPath(p) ||
    p === "/classrooms" ||
    p.startsWith("/classrooms/") ||
    p.startsWith("/classroom/")
  );
}

export function isPathRelevantForOnboardingTask(taskId: string, pathname: string): boolean {
  const p = pathOnly(pathname);

  switch (taskId) {
    case "magic_wall":
      return p === "/magic-wall" || p.startsWith("/magic-wall/") || CURRICULUM_TOPIC_PATH.test(p);

    case "lessons":
      return p === "/explore-1" || p.startsWith("/explore-1/") || CURRICULUM_TOPIC_PATH.test(p);

    case "prep_classes":
      return isPrepClassesPath(p);

    case "prep_mcq":
      return isPrepMockPath(p);

    case "gyan_plus":
      return p === "/doubts" || p.startsWith("/doubts/");

    case "earn_buddy":

    case "earn_challenge":
      return p === "/refer-earn" || p.startsWith("/refer-earn/");

    case "news_blog":
      return p === "/news-blog" || p.startsWith("/news-blog/");

    case "edufund":
      return p === "/edufund" || p.startsWith("/edufund/");

    case "profile":
      return p === "/profile" || p.startsWith("/profile/");

    case "dashboard":
      return p === "/home" || p.startsWith("/home/");

    case "prep_mock":
      return isPrepClassesPath(p) || isPrepMockPath(p);

    case "rdm_wallet":
      return p === "/profile" || p.startsWith("/profile/");

    case "play_dailydose":
      return p === "/play" || p.startsWith("/play/");

    default:
      return false;
  }
}
