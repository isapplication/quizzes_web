/**
 * "Share to Google Classroom" and "Share to Teams" for an assignment. Only the assignment's public link goes into
 * these addresses: never its title, a class, a name or an email (learners are minors; the other service sees the
 * address it is opened with).
 */
export function classroomShareUrl(link: string): string {
  return "https://classroom.google.com/share?url=" + encodeURIComponent(link);
}

export function teamsShareUrl(link: string): string {
  return "https://teams.microsoft.com/share?href=" + encodeURIComponent(link);
}
