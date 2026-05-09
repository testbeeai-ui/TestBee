/**
 * Default teacher landing: "My Classroom" tab (classrooms + assignments hub).
 * Use after sign-in, onboarding, and middleware redirects so teachers never land on Profile by default.
 */
export const TEACHER_PORTAL_CLASSROOMS_URL = "/teacher-portal?section=myClassroom" as const;
