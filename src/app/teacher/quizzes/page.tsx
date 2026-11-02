import { redirect } from "next/navigation";

/** My quizzes and hosted games live on the home page now. */
export default function MyQuizzesPage() {
  redirect("/home");
}
