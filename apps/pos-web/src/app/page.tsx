import { redirect } from "next/navigation";

export default function Home() {
  // When someone opens the app root "/", send them to "/login"
  redirect("/login");
}
